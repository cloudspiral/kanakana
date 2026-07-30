import { describe, expect, it } from 'vitest';

import { BUNDLED_MANIFEST } from '../curriculum';
import { KANA_STROKES } from '../generated/kanaStrokes';
import {
  MATCH_SAMPLES,
  STROKE_TOLERANCE,
  compare,
  judgeStroke,
  resample,
  reviewTraceResult,
  strokeCount,
  strokeModel,
  traceResult,
  type Point,
} from '../strokes';

/**
 * Stroke counts as hand-entered by the design author in the prototype's item
 * table. The original handoff covered the 46 base kana; this is that check.
 * (The claim says the counts live in curriculum.ts — they do not, the app has
 * no strokes field. They are in the prototype.)
 */
const PROTOTYPE_STROKE_COUNTS: Record<string, number> = {
  あ: 3, い: 2, う: 2, え: 2, お: 3, か: 3, き: 4, く: 1, け: 3, こ: 2,
  さ: 3, し: 1, す: 2, せ: 3, そ: 1, た: 4, ち: 2, つ: 1, て: 1, と: 2,
  な: 4, に: 3, ぬ: 2, ね: 2, の: 1, は: 3, ひ: 1, ふ: 4, へ: 1, ほ: 4,
  ま: 3, み: 2, む: 3, め: 2, も: 3, や: 3, ゆ: 2, よ: 2, ら: 2, り: 2,
  る: 1, れ: 2, ろ: 1, わ: 2, を: 3, ん: 1,
};

/** く is a single stroke, so out-of-order confusion cannot interfere. */
const SINGLE = 'く';
/** き has four strokes, for order tests. */
const MULTI = 'き';

function modelOf(glyph: string): Point[][] {
  const model = strokeModel(glyph);
  if (!model) {
    throw new Error(`No model for ${glyph}`);
  }
  return model;
}

function shift(points: readonly Point[], dx: number, dy = 0): Point[] {
  return points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
}

describe('baked KanjiVG data', () => {
  it('covers every character in the curriculum', () => {
    const missing = BUNDLED_MANIFEST.items
      .map((item) => item.content.glyph)
      .filter((glyph) => !KANA_STROKES[glyph]);
    expect(missing).toEqual([]);
  });

  it('agrees with the stroke counts entered by hand in the prototype', () => {
    const disagreements = Object.entries(PROTOTYPE_STROKE_COUNTS)
      .filter(([glyph, count]) => strokeCount(glyph) !== count)
      .map(([glyph, count]) => `${glyph}: prototype ${count}, KanjiVG ${strokeCount(glyph)}`);
    expect(disagreements).toEqual([]);
  });

  it('includes the trailing accent strokes for voiced forms', () => {
    expect(strokeCount('か')).toBe(3);
    expect(strokeCount('が')).toBe(5);
    expect(strokeCount('は')).toBe(3);
    expect(strokeCount('ば')).toBe(5);
    expect(strokeCount('ぱ')).toBe(4);
  });

  it('keeps every point inside the normalised square', () => {
    for (const entry of Object.values(KANA_STROKES)) {
      for (const stroke of entry.strokes) {
        for (const [x, y] of stroke) {
          expect(x).toBeGreaterThanOrEqual(-0.05);
          expect(x).toBeLessThanOrEqual(1.05);
          expect(y).toBeGreaterThanOrEqual(-0.05);
          expect(y).toBeLessThanOrEqual(1.05);
        }
      }
    }
  });
});

describe('resample', () => {
  it('returns SAMPLES + 1 points', () => {
    expect(resample([{ x: 0, y: 0 }, { x: 1, y: 0 }])).toHaveLength(MATCH_SAMPLES + 1);
  });

  it('spaces points evenly by arc length, not by index', () => {
    // Two segments of very different length, described by the same point count.
    const line = resample([
      { x: 0, y: 0 },
      { x: 0.1, y: 0 },
      { x: 1, y: 0 },
    ]);
    const gaps = line.slice(1).map((point, index) => point.x - line[index].x);
    for (const gap of gaps) {
      expect(gap).toBeCloseTo(1 / MATCH_SAMPLES, 5);
    }
  });
});

describe('judgeStroke', () => {
  it('accepts the model stroke drawn as written', () => {
    const model = modelOf(SINGLE);
    const decision = judgeStroke({
      drawn: model[0],
      model,
      expectedIndex: 0,
    });
    expect(decision).toMatchObject({ kind: 'accepted' });
  });

  it('flags the right shape drawn backwards without rejecting the stroke', () => {
    const model = modelOf(SINGLE);
    const decision = judgeStroke({
      drawn: [...model[0]].reverse(),
      model,
      expectedIndex: 0,
    });
    expect(decision).toMatchObject({ kind: 'warning', reason: 'backwards', slip: true });
  });

  it('names the stroke actually drawn when the order is wrong', () => {
    const model = modelOf(MULTI);
    const decision = judgeStroke({
      drawn: model[3],
      model,
      expectedIndex: 0,
    });
    expect(decision).toMatchObject({
      kind: 'warning',
      reason: 'outOfOrder',
      slip: true,
      actualStroke: 4,
    });
    expect((decision as { note: string }).note).toContain('stroke 4');
  });

  it('accepts a marginal guided stroke without asking the learner to grade it', () => {
    const model = modelOf(SINGLE);
    // Offset by more than the strict tolerance but inside guided leniency.
    const offset = STROKE_TOLERANCE * 1.3;
    const decision = judgeStroke({
      drawn: shift(model[0], offset),
      model,
      expectedIndex: 0,
    });
    expect(decision).toMatchObject({ kind: 'accepted' });
  });

  it('warns about a far-off shape without entering a hint mode', () => {
    const model = modelOf(SINGLE);
    const wild = shift(model[0], 0.9);
    expect(judgeStroke({ drawn: wild, model, expectedIndex: 0 })).toMatchObject({
      kind: 'warning',
      reason: 'shape',
      slip: false,
    });
  });

  it('recognises an earlier stroke drawn later as out of order', () => {
    const model = modelOf(MULTI);
    const decision = judgeStroke({
      drawn: model[0],
      model,
      expectedIndex: 3,
    });
    expect(decision).toMatchObject({
      kind: 'warning',
      reason: 'outOfOrder',
      actualStroke: 1,
      slip: true,
    });
  });

  it('keeps strokes drawn after the guide count as graded extras', () => {
    const model = modelOf(SINGLE);
    expect(
      judgeStroke({
        drawn: model[0],
        model,
        expectedIndex: model.length,
      }),
    ).toMatchObject({
      kind: 'warning',
      reason: 'extra',
      slip: true,
    });
  });

  it('ignores a stray tap', () => {
    const model = modelOf(SINGLE);
    expect(
      judgeStroke({
        drawn: [{ x: 0.5, y: 0.5 }],
        model,
        expectedIndex: 0,
      }),
    ).toBeNull();
  });
});

describe('compare', () => {
  it('reports a reversed stroke as better backwards than forwards', () => {
    const model = modelOf(SINGLE);
    const result = compare([...model[0]].reverse(), model[0]);
    expect(result.rev).toBeLessThan(result.fwd);
    expect(result.best).toBe(result.rev);
  });
});

describe('traceResult', () => {
  it('cannot report an incomplete character as clean', () => {
    const model = modelOf(MULTI);
    // One perfect stroke out of four — the bug this arithmetic exists to prevent.
    const result = traceResult({
      completed: [{ drawn: model[0] }],
      model,
    });
    expect(result.verdict).toBe('partial');
    expect(result.complete).toBe(false);
    expect(result.accuracy).toBeLessThan(0.62);
  });

  it('reports a fully and accurately drawn character as clean', () => {
    const model = modelOf(MULTI);
    const result = traceResult({
      completed: model.map((stroke) => ({ drawn: stroke })),
      model,
    });
    expect(result.verdict).toBe('clean');
    // Not exactly 1: re-resampling a polyline that approximates a curve moves
    // points by a chord's worth. A fraction of a percent is the expected floor.
    expect(result.accuracy).toBeGreaterThan(0.98);
    expect(result.orderAndDirection).toBe(1);
  });

  it('reports retained order slips ahead of accuracy', () => {
    const model = modelOf(MULTI);
    expect(
      traceResult({
        completed: model.map((stroke, index) => ({
          drawn: stroke,
          orderSlip: index === 0,
        })),
        model,
      }).verdict,
    ).toBe('order');
  });

  it('drops a warned stroke from the grade when that stroke is undone', () => {
    const model = modelOf(MULTI);
    const withWarning = model.map((stroke, index) => ({
      drawn: stroke,
      orderSlip: index === model.length - 1,
    }));

    expect(traceResult({ completed: withWarning, model }).orderSlips).toBe(1);
    const afterUndo = withWarning.slice(0, -1);
    expect(traceResult({ completed: afterUndo, model }).orderSlips).toBe(0);

    const redrawn = [...afterUndo, { drawn: model[model.length - 1] }];
    expect(traceResult({ completed: redrawn, model })).toMatchObject({
      orderSlips: 0,
      orderAndDirection: 1,
      verdict: 'clean',
    });
  });

  it('keeps both metrics reading higher-is-better', () => {
    const model = modelOf(MULTI);
    const good = traceResult({
      completed: model.map((stroke) => ({ drawn: stroke })),
      model,
    });
    const sloppy = traceResult({
      // These warnings remain because the learner chose not to undo them.
      completed: model.map((stroke, index) => ({
        drawn: shift(stroke, 0.12),
        orderSlip: index < 2,
      })),
      model,
    });
    expect(good.accuracy).toBeGreaterThan(sloppy.accuracy);
    expect(good.orderAndDirection).toBeGreaterThan(sloppy.orderAndDirection);
  });

  it('counts retained extra strokes against the final guided grade', () => {
    const model = modelOf(MULTI);
    const clean = traceResult({
      completed: model.map((stroke) => ({ drawn: stroke })),
      model,
    });
    const withExtra = traceResult({
      completed: [
        ...model.map((stroke) => ({ drawn: stroke })),
        { drawn: model[0], orderSlip: true },
      ],
      model,
    });

    expect(withExtra.strokes).toBe(model.length + 1);
    expect(withExtra.accuracy).toBeLessThan(clean.accuracy);
    expect(withExtra.orderAndDirection).toBeLessThan(clean.orderAndDirection);
    expect(withExtra.verdict).toBe('order');
  });
});

describe('reviewTraceResult', () => {
  it('grades a correct raw review attempt only after all strokes are present', () => {
    const model = modelOf(MULTI);
    const result = reviewTraceResult({
      completed: model.map((stroke) => ({ drawn: stroke })),
      model,
    });

    expect(result.verdict).toBe('clean');
    expect(result.orderSlips).toBe(0);
    expect(result.orderAndDirection).toBe(1);
  });

  it('detects a backwards stroke from the completed review attempt', () => {
    const model = modelOf(MULTI);
    const result = reviewTraceResult({
      completed: model.map((stroke, index) => ({
        drawn: index === 0 ? [...stroke].reverse() : stroke,
      })),
      model,
    });

    expect(result.verdict).toBe('order');
    expect(result.orderSlips).toBe(1);
    expect(result.orderAndDirection).toBeLessThan(1);
  });

  it('detects strokes drawn in the wrong order after Check', () => {
    const model = modelOf(MULTI);
    const swapped = [...model];
    [swapped[0], swapped[3]] = [swapped[3], swapped[0]];

    const result = reviewTraceResult({
      completed: swapped.map((stroke) => ({ drawn: stroke })),
      model,
    });

    expect(result.verdict).toBe('order');
    expect(result.orderSlips).toBeGreaterThanOrEqual(2);
    expect(result.orderAndDirection).toBeLessThan(1);
  });

  it('counts extra raw strokes against the review result', () => {
    const model = modelOf(MULTI);
    const result = reviewTraceResult({
      completed: [
        ...model.map((stroke) => ({ drawn: stroke })),
        { drawn: model[0] },
      ],
      model,
    });

    expect(result.complete).toBe(true);
    expect(result.strokes).toBe(model.length + 1);
    expect(result.orderSlips).toBe(1);
    expect(result.verdict).toBe('order');
  });
});
