import { KANA_STROKES, type ModelPoint } from './generated/kanaStrokes';

/**
 * Stroke matching for the `kana_writing` skill.
 *
 * One stroke is graded at a time against the expected model stroke, following
 * the approach hanzi-writer established for Chinese. Direction and order are
 * judged, not forgiven: a dictionary recogniser should tolerate wrong stroke
 * order, but a teacher should not — see docs/design/stroke-check-notes.md.
 *
 * Every constant below was tuned against real drawing input in the design
 * prototype. Change them only with evidence.
 *
 * All geometry is in normalised 0-1 space, matching the baked model data. The
 * tolerance therefore scales with the rendered square automatically, which the
 * design requires; callers normalise pointer coordinates before grading.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Paired-point comparisons use SAMPLES + 1 points (17), spaced evenly by arc
 * length rather than by index.
 */
export const MATCH_SAMPLES = 16;

/**
 * Mean paired-point distance accepted, as a fraction of the square's edge —
 * 46px on the design's 262px square, ≈17.5%.
 */
export const STROKE_TOLERANCE = 46 / 262;

/** Upper edge of the marginal band that triggers a close-call self-grade. */
export const MARGINAL_FACTOR = 1.7;

/** Reversed scoring this much better than forwards means it was drawn backwards. */
export const BACKWARDS_FACTOR = 0.75;

/** A later stroke scoring this much better means the learner drew that one instead. */
export const OUT_OF_ORDER_FACTOR = 0.75;

/** Misses before the next-stroke hint appears. */
export const HINT_AFTER = 2;

/** Misses before the stroke is drawn in and the session moves on. Nothing ever blocks. */
export const FORCE_AFTER = 4;

/** Per-stroke closeness reaches zero at this multiple of the tolerance. */
const ACCURACY_SPAN = 1.6;

/** Accuracy at or above this reads as "clean" rather than "loose". */
const CLEAN_ACCURACY = 0.62;

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function toPoint(model: ModelPoint): Point {
  return { x: model[0], y: model[1] };
}

/**
 * Resample a polyline to `samples + 1` points spaced evenly by arc length.
 *
 * Arc-length parameterisation matters: sampling by index would let a slowly
 * drawn section dominate the comparison.
 */
export function resample(points: readonly Point[], samples = MATCH_SAMPLES): Point[] {
  const count = samples + 1;
  if (points.length === 0) {
    return [];
  }
  if (points.length === 1) {
    return Array.from({ length: count }, () => points[0]);
  }

  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(cumulative[index - 1] + distance(points[index - 1], points[index]));
  }
  const total = cumulative[cumulative.length - 1];
  if (total === 0) {
    return Array.from({ length: count }, () => points[0]);
  }

  const out: Point[] = [];
  let cursor = 1;
  for (let step = 0; step < count; step += 1) {
    const target = (total * step) / samples;
    while (cursor < cumulative.length - 1 && cumulative[cursor] < target) {
      cursor += 1;
    }
    const spanStart = cumulative[cursor - 1];
    const span = cumulative[cursor] - spanStart;
    const ratio = span === 0 ? 0 : (target - spanStart) / span;
    const a = points[cursor - 1];
    const b = points[cursor];
    out.push({ x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio });
  }
  return out;
}

export interface Comparison {
  /** Mean paired-point distance against the model as written. */
  fwd: number;
  /** The same, against the model reversed. */
  rev: number;
  /** The better of the two. */
  best: number;
}

/**
 * Mean paired-point distance, forwards and reversed. Reversed winning clearly
 * means the stroke was drawn backwards — worth telling the learner, because
 * direction is half of what makes handwriting look right.
 */
export function compare(drawn: readonly Point[], model: readonly Point[]): Comparison {
  const a = resample(drawn);
  const b = model.length === MATCH_SAMPLES + 1 ? model : resample(model);
  let fwd = 0;
  let rev = 0;
  for (let index = 0; index <= MATCH_SAMPLES; index += 1) {
    fwd += distance(a[index], b[index]);
    rev += distance(a[index], b[MATCH_SAMPLES - index]);
  }
  const n = MATCH_SAMPLES + 1;
  return { fwd: fwd / n, rev: rev / n, best: Math.min(fwd, rev) / n };
}

/** The model strokes for a glyph, resampled once for comparison. */
export function strokeModel(glyph: string): Point[][] | null {
  const entry = KANA_STROKES[glyph];
  if (!entry) {
    return null;
  }
  return entry.strokes.map((stroke) => resample(stroke.map(toPoint)));
}

export function strokeCount(glyph: string): number {
  return KANA_STROKES[glyph]?.strokes.length ?? 0;
}

export type StrokeReason = 'outOfOrder' | 'backwards' | 'shape';

export type StrokeDecision =
  /** Close enough and in the right direction. */
  | { kind: 'accepted'; score: number }
  /**
   * Marginal shape, right order: the recogniser genuinely cannot tell. Rather
   * than guess, the caller can either ask immediately or keep the stroke
   * provisionally until a whole-character Check.
   */
  | { kind: 'closeCall'; score: number; misses: number }
  /** Four misses. The stroke is drawn in and the session continues. */
  | { kind: 'forced'; score: number; misses: number; note: string; slip: boolean }
  /** Try again, with a note and — after two misses — the next-stroke hint. */
  | {
      kind: 'retry';
      score: number;
      misses: number;
      note: string;
      slip: boolean;
      hint: boolean;
      reason: StrokeReason;
      /** 1-based stroke the attempt actually resembled, when out of order. */
      actualStroke?: number;
    };

export interface JudgeInput {
  /** The polyline just drawn, in normalised space. */
  drawn: readonly Point[];
  /** The whole character's model strokes, in writing order. */
  model: readonly (readonly Point[])[];
  /** Index of the stroke the learner is meant to be drawing. */
  expectedIndex: number;
  /** Misses already accumulated on this stroke. */
  misses: number;
}

/**
 * Grade one stroke. Pure: all session state is passed in and the caller applies
 * the result, so the same decision can be unit-tested without a canvas.
 */
export function judgeStroke({
  drawn,
  model,
  expectedIndex,
  misses,
}: JudgeInput): StrokeDecision | null {
  const expected = model[expectedIndex];
  if (!expected || drawn.length < 2) {
    return null;
  }

  const mine = compare(drawn, expected);

  // Which remaining stroke does this actually look most like?
  let bestIndex = expectedIndex;
  let bestScore = mine.best;
  for (let later = expectedIndex + 1; later < model.length; later += 1) {
    const candidate = compare(drawn, model[later]);
    if (candidate.best < bestScore * OUT_OF_ORDER_FACTOR) {
      bestScore = candidate.best;
      bestIndex = later;
    }
  }

  const backwards = mine.rev < mine.fwd * BACKWARDS_FACTOR;

  if (mine.best <= STROKE_TOLERANCE && !backwards) {
    return { kind: 'accepted', score: mine.best };
  }

  const nextMisses = misses + 1;
  let note = 'Not that stroke yet — try again.';
  let reason: StrokeReason = 'shape';
  let slip = false;
  let actualStroke: number | undefined;

  if (bestIndex !== expectedIndex) {
    note = `That is stroke ${bestIndex + 1}. Japanese builds this kana in order — stroke ${expectedIndex + 1} comes first.`;
    reason = 'outOfOrder';
    slip = true;
    actualStroke = bestIndex + 1;
  } else if (backwards) {
    note = 'Right shape, drawn backwards — begin at the numbered marker and pull the other way.';
    reason = 'backwards';
    slip = true;
  }

  if (!slip && mine.best <= STROKE_TOLERANCE * MARGINAL_FACTOR) {
    return { kind: 'closeCall', score: mine.best, misses: nextMisses };
  }

  if (nextMisses >= FORCE_AFTER) {
    return {
      kind: 'forced',
      score: mine.best,
      misses: nextMisses,
      note: 'Drawn in for you — watch the start number and the direction.',
      slip,
    };
  }

  return {
    kind: 'retry',
    score: mine.best,
    misses: nextMisses,
    note,
    slip,
    hint: nextMisses >= HINT_AFTER,
    reason,
    actualStroke,
  };
}

export type TraceVerdict = 'clean' | 'loose' | 'order' | 'guided' | 'partial';

/** One entry per stroke the learner got through, in order. */
export interface CompletedStroke {
  /** What they drew. Absent for a stroke that was drawn in for them. */
  drawn?: readonly Point[];
  /** True when the stroke was forced after four misses. */
  forced?: boolean;
  /** True when the learner resolved a close call in their own favour. */
  selfGraded?: boolean;
}

export interface TraceResult {
  /** Mean per-stroke closeness across the whole character. Higher is better. */
  accuracy: number;
  /** 1 − (slips + forced) / strokes. Higher is better. */
  orderAndDirection: number;
  orderSlips: number;
  forced: number;
  complete: boolean;
  strokes: number;
  expected: number;
  verdict: TraceVerdict;
}

export interface TraceResultInput {
  completed: readonly CompletedStroke[];
  model: readonly (readonly Point[])[];
  orderSlips: number;
  forced: number;
}

/**
 * Grade a review attempt after the learner explicitly checks it.
 *
 * Unlike guided tracing, a review accepts every stroke while the learner is
 * drawing. Order and direction therefore have to be inferred here from the
 * complete raw attempt rather than accumulated from per-stroke interventions.
 */
export function reviewTraceResult({
  completed,
  model,
}: Pick<TraceResultInput, 'completed' | 'model'>): TraceResult {
  let orderSlips = 0;

  completed.forEach((stroke, expectedIndex) => {
    const drawn = stroke.drawn;
    const expected = model[expectedIndex];

    // Extra, empty, or otherwise ungradeable strokes cannot be in the correct
    // place and direction. Missing strokes are handled by traceResult's
    // incomplete verdict.
    if (!drawn || drawn.length < 2 || !expected) {
      orderSlips += 1;
      return;
    }

    const expectedComparison = compare(drawn, expected);
    const backwards =
      expectedComparison.rev < expectedComparison.fwd * BACKWARDS_FACTOR;

    let bestIndex = expectedIndex;
    let bestScore = expectedComparison.best;
    model.forEach((candidate, candidateIndex) => {
      if (candidateIndex === expectedIndex) {
        return;
      }
      const score = compare(drawn, candidate).best;
      if (score < bestScore) {
        bestIndex = candidateIndex;
        bestScore = score;
      }
    });

    const outOfOrder =
      bestIndex !== expectedIndex &&
      bestScore < expectedComparison.best * OUT_OF_ORDER_FACTOR;

    if (backwards || outOfOrder) {
      orderSlips += 1;
    }
  });

  return traceResult({
    completed,
    model,
    orderSlips,
    forced: 0,
  });
}

/**
 * Score a whole character.
 *
 * Both metrics read higher-is-better on purpose — an earlier design paired one
 * up-is-good bar with one up-is-bad bar and was unreadable.
 *
 * The division by `max(graded, expected)` is load-bearing rather than
 * defensive: undrawn strokes score zero, so an incomplete character is
 * arithmetically incapable of reporting as clean. In testing, a 1-of-3-stroke
 * attempt was once graded "Clean, 100%".
 */
export function traceResult({
  completed,
  model,
  orderSlips,
  forced,
}: TraceResultInput): TraceResult {
  const expected = model.length;

  let total = 0;
  completed.forEach((stroke, index) => {
    if (stroke.forced || !stroke.drawn || !model[index]) {
      return;
    }
    const { best } = compare(stroke.drawn, model[index]);
    total += Math.max(0, 1 - best / (STROKE_TOLERANCE * ACCURACY_SPAN));
  });

  const graded = completed.filter((stroke) => !stroke.forced).length || 1;
  const complete = completed.length >= expected;
  const accuracy = total / Math.max(graded, expected);
  const orderAndDirection =
    1 - Math.min(1, (orderSlips + forced) / Math.max(1, expected));

  const verdict: TraceVerdict = !complete
    ? 'partial'
    : forced > 0
      ? 'guided'
      : orderSlips > 0
        ? 'order'
        : accuracy >= CLEAN_ACCURACY
          ? 'clean'
          : 'loose';

  return {
    accuracy,
    orderAndDirection,
    orderSlips,
    forced,
    complete,
    strokes: completed.length,
    expected,
    verdict,
  };
}
