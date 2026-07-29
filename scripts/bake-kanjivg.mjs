#!/usr/bin/env node
/**
 * Bake the KanjiVG stroke SVGs in assets/kanjivg/ into sampled polylines.
 *
 * React Native has no `getPointAtLength`, so the cubic béziers cannot be
 * measured at runtime the way a browser measures them. Sampling here removes
 * both the runtime parse and the fetch, and makes the model data diffable.
 *
 * Coordinates are normalised to 0-1 against KanjiVG's 109x109 viewBox, so the
 * consumer scales them to whatever square it renders — the design requires the
 * stroke tolerance to scale with the square, and normalised models make that
 * structural rather than something a caller can forget.
 *
 * Usage: npm run bake:strokes
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = join(root, 'assets/kanjivg');
const OUT_FILE = join(root, 'src/domain/generated/kanaStrokes.ts');

/** KanjiVG's viewBox is 109x109. */
const VIEWBOX = 109;

/** Samples per stroke. Enough to draw a smooth dashed hint at 262px. */
const SAMPLES = 32;

const PRECISION = 4;

/**
 * KanjiVG uses only absolute `M` and relative `c`, verified across all 46
 * files. Anything else is unexpected and should fail loudly rather than be
 * silently mis-sampled.
 */
function parsePath(d) {
  const tokens = d.match(/[MmCcLlSsQqZzHhVvAa]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const segments = [];
  let cursor = null;
  let start = null;
  let index = 0;

  while (index < tokens.length) {
    const command = tokens[index];
    if (command === 'M') {
      const x = Number(tokens[index + 1]);
      const y = Number(tokens[index + 2]);
      cursor = { x, y };
      start = cursor;
      index += 3;
    } else if (command === 'c') {
      index += 1;
      // A `c` run may carry several triples before the next command letter.
      while (index < tokens.length && !/[A-Za-z]/.test(tokens[index])) {
        const [dx1, dy1, dx2, dy2, dx, dy] = tokens
          .slice(index, index + 6)
          .map(Number);
        const p0 = cursor;
        const p1 = { x: p0.x + dx1, y: p0.y + dy1 };
        const p2 = { x: p0.x + dx2, y: p0.y + dy2 };
        const p3 = { x: p0.x + dx, y: p0.y + dy };
        segments.push([p0, p1, p2, p3]);
        cursor = p3;
        index += 6;
      }
    } else {
      throw new Error(
        `Unsupported path command "${command}" — KanjiVG was expected to use only M and c.`,
      );
    }
  }

  if (!start) {
    throw new Error('Path had no moveto.');
  }
  return { segments, start };
}

function cubicAt([p0, p1, p2, p3], t) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/** Dense flattening first, so the arc-length resample below is accurate. */
function flatten({ segments, start }) {
  if (segments.length === 0) {
    return [start];
  }
  const points = [segments[0][0]];
  const perSegment = 24;
  for (const segment of segments) {
    for (let step = 1; step <= perSegment; step += 1) {
      points.push(cubicAt(segment, step / perSegment));
    }
  }
  return points;
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Resample to `count` points spaced evenly by arc length, not by index. */
function resample(points, count) {
  if (points.length < 2) {
    return Array.from({ length: count }, () => points[0] ?? { x: 0, y: 0 });
  }
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(cumulative[index - 1] + distance(points[index - 1], points[index]));
  }
  const total = cumulative[cumulative.length - 1];
  if (total === 0) {
    return Array.from({ length: count }, () => points[0]);
  }

  const out = [];
  let cursor = 1;
  for (let step = 0; step < count; step += 1) {
    const target = (total * step) / (count - 1);
    while (cursor < cumulative.length - 1 && cumulative[cursor] < target) {
      cursor += 1;
    }
    const spanStart = cumulative[cursor - 1];
    const spanEnd = cumulative[cursor];
    const span = spanEnd - spanStart;
    const ratio = span === 0 ? 0 : (target - spanStart) / span;
    const a = points[cursor - 1];
    const b = points[cursor];
    out.push({ x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio });
  }
  return out;
}

const round = (value) => Number(value.toFixed(PRECISION));

const files = readdirSync(SOURCE_DIR)
  .filter((name) => name.endsWith('.svg'))
  .sort();

const entries = [];
let strokeTotal = 0;

for (const file of files) {
  const codepoint = file.replace(/\.svg$/, '');
  const glyph = String.fromCodePoint(Number.parseInt(codepoint, 16));
  const svg = readFileSync(join(SOURCE_DIR, file), 'utf8');

  // Only the StrokePaths group carries paths; StrokeNumbers is <text>. Parse in
  // document order — path[i] is stroke i+1.
  const ds = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((match) => match[1]);
  if (ds.length === 0) {
    throw new Error(`${file} contained no stroke paths.`);
  }

  const strokes = ds.map((d) =>
    resample(flatten(parsePath(d)), SAMPLES).map((point) => [
      round(point.x / VIEWBOX),
      round(point.y / VIEWBOX),
    ]),
  );

  strokeTotal += strokes.length;
  entries.push({ glyph, codepoint, strokes });
}

const body = entries
  .map(
    (entry) =>
      `  '${entry.glyph}': {\n` +
      `    glyph: '${entry.glyph}',\n` +
      `    codepoint: '${entry.codepoint}',\n` +
      `    strokes: [\n` +
      entry.strokes
        .map((stroke) => `      [${stroke.map(([x, y]) => `[${x},${y}]`).join(',')}],`)
        .join('\n') +
      `\n    ],\n  },`,
  )
  .join('\n');

const output = `/**
 * GENERATED FILE — do not edit by hand. Run \`npm run bake:strokes\`.
 *
 * Source: KanjiVG (Ulrich Apel, CC BY-SA 3.0) via assets/kanjivg/.
 * Each stroke is ${SAMPLES} points spaced evenly by arc length, normalised to
 * 0-1 against KanjiVG's ${VIEWBOX}x${VIEWBOX} viewBox, in writing order.
 */

/** A point in normalised model space, where 0-1 spans the writing square. */
export type ModelPoint = readonly [number, number];

export interface KanaStrokeModel {
  glyph: string;
  /** Lowercase hex codepoint, matching the KanjiVG filename. */
  codepoint: string;
  /** One entry per stroke, in writing order. */
  strokes: readonly (readonly ModelPoint[])[];
}

export const KANA_STROKES: Readonly<Record<string, KanaStrokeModel>> = {
${body}
};

/** Points per stroke in the baked data. */
export const STROKE_SAMPLES = ${SAMPLES};
`;

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, output);

console.log(
  `baked ${entries.length} characters, ${strokeTotal} strokes -> ${OUT_FILE.replace(root + '/', '')}`,
);
