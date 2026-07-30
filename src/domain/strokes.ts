import { KANA_STROKES, type ModelPoint } from './generated/kanaStrokes';

/**
 * Stroke matching for the `kana_writing` skill.
 *
 * One stroke is compared at a time against the expected model stroke. Guided
 * tracing keeps every stroke and uses the comparison for non-blocking feedback;
 * whole-character reviews grade only after Check.
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

/** Extra leniency while the model is visible in guided tracing. */
export const GUIDED_TOLERANCE_FACTOR = 1.7;

/** Reversed scoring this much better than forwards means it was drawn backwards. */
export const BACKWARDS_FACTOR = 0.75;

/** Another stroke scoring this much better means the learner drew that one instead. */
export const OUT_OF_ORDER_FACTOR = 0.75;

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

export type StrokeReason = 'outOfOrder' | 'backwards' | 'shape' | 'extra';

export type StrokeDecision =
  /** Close enough and in the right direction. */
  | { kind: 'accepted'; score: number }
  /** Keep the stroke, advance, and show this feedback without blocking input. */
  | {
      kind: 'warning';
      score: number;
      note: string;
      slip: boolean;
      reason: StrokeReason;
      /** 1-based stroke the attempt most resembled, when out of order. */
      actualStroke?: number;
    };

export interface JudgeInput {
  /** The polyline just drawn, in normalised space. */
  drawn: readonly Point[];
  /** The whole character's model strokes, in writing order. */
  model: readonly (readonly Point[])[];
  /** Index of the stroke the learner is meant to be drawing. */
  expectedIndex: number;
}

/**
 * Grade one stroke. Pure: all session state is passed in and the caller applies
 * the result, so the same decision can be unit-tested without a canvas.
 */
export function judgeStroke({
  drawn,
  model,
  expectedIndex,
}: JudgeInput): StrokeDecision | null {
  if (drawn.length < 2) {
    return null;
  }

  const expected = model[expectedIndex];
  if (!expected) {
    return {
      kind: 'warning',
      score: 1,
      note: 'That is an extra stroke — keep it or undo it before you submit.',
      slip: true,
      reason: 'extra',
    };
  }

  const mine = compare(drawn, expected);

  // Which model stroke does this actually look most like?
  let bestIndex = expectedIndex;
  let bestScore = mine.best;
  for (let candidateIndex = 0; candidateIndex < model.length; candidateIndex += 1) {
    if (candidateIndex === expectedIndex) {
      continue;
    }
    const candidate = compare(drawn, model[candidateIndex]);
    if (candidate.best < bestScore * OUT_OF_ORDER_FACTOR) {
      bestScore = candidate.best;
      bestIndex = candidateIndex;
    }
  }

  const backwards = mine.rev < mine.fwd * BACKWARDS_FACTOR;

  // The model is visible during guided tracing, so a reasonably close stroke
  // in the correct order and direction should advance without asking the
  // learner to grade it. Reviews use whole-character grading after Check.
  if (
    mine.best <= STROKE_TOLERANCE * GUIDED_TOLERANCE_FACTOR &&
    !backwards &&
    bestIndex === expectedIndex
  ) {
    return { kind: 'accepted', score: mine.best };
  }

  let note = 'That stroke is far from the guide — undo it if you want another try.';
  let reason: StrokeReason = 'shape';
  let slip = false;
  let actualStroke: number | undefined;

  if (bestIndex !== expectedIndex) {
    note = `That looks like stroke ${bestIndex + 1}, not stroke ${expectedIndex + 1} — undo it if you want another try.`;
    reason = 'outOfOrder';
    slip = true;
    actualStroke = bestIndex + 1;
  } else if (backwards) {
    note = 'Right shape, drawn backwards — undo it and pull from the numbered marker if you want another try.';
    reason = 'backwards';
    slip = true;
  }

  return {
    kind: 'warning',
    score: mine.best,
    note,
    slip,
    reason,
    actualStroke,
  };
}

export type TraceVerdict = 'clean' | 'loose' | 'order' | 'partial';

/** One entry per stroke the learner got through, in order. */
export interface CompletedStroke {
  /** What the learner drew. */
  drawn: readonly Point[];
  /** This retained stroke was drawn out of order or in the wrong direction. */
  orderSlip?: boolean;
}

export interface TraceResult {
  /** Mean per-stroke closeness across the whole character. Higher is better. */
  accuracy: number;
  /** 1 − slips / strokes. Higher is better. */
  orderAndDirection: number;
  orderSlips: number;
  complete: boolean;
  strokes: number;
  expected: number;
  verdict: TraceVerdict;
}

export interface TraceResultInput {
  completed: readonly CompletedStroke[];
  model: readonly (readonly Point[])[];
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
  const graded = completed.map((stroke, expectedIndex): CompletedStroke => {
    const drawn = stroke.drawn;
    const expected = model[expectedIndex];

    // Extra, empty, or otherwise ungradeable strokes cannot be in the correct
    // place and direction. Missing strokes are handled by traceResult's
    // incomplete verdict.
    if (drawn.length < 2 || !expected) {
      return { ...stroke, orderSlip: true };
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

    return { ...stroke, orderSlip: backwards || outOfOrder };
  });

  return traceResult({
    completed: graded,
    model,
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
}: TraceResultInput): TraceResult {
  const expected = model.length;
  const orderSlips = completed.filter((stroke) => stroke.orderSlip).length;

  let total = 0;
  completed.forEach((stroke, index) => {
    if (!model[index]) {
      return;
    }
    const { best } = compare(stroke.drawn, model[index]);
    total += Math.max(0, 1 - best / (STROKE_TOLERANCE * ACCURACY_SPAN));
  });

  const graded = completed.length || 1;
  const complete = completed.length >= expected;
  const accuracy = total / Math.max(graded, expected);
  const orderAndDirection =
    1 - Math.min(1, orderSlips / Math.max(1, expected));

  const verdict: TraceVerdict = !complete
    ? 'partial'
    : orderSlips > 0
      ? 'order'
      : accuracy >= CLEAN_ACCURACY
        ? 'clean'
        : 'loose';

  return {
    accuracy,
    orderAndDirection,
    orderSlips,
    complete,
    strokes: completed.length,
    expected,
    verdict,
  };
}
