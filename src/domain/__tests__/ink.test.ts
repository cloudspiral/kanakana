import { Rating } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';

import { BUNDLED_MANIFEST } from '../curriculum';
import { inkColor, inkStrength, isIntroduced } from '../ink';
import { applyReview } from '../scheduler';
import type { LearnerSkillState } from '../types';

const now = new Date('2026-07-28T12:00:00.000Z');
const item = BUNDLED_MANIFEST.items[0];

function withStability(stability: number): LearnerSkillState {
  const state = applyReview(undefined, item.id, 'kana_reading', Rating.Good, now);
  return { ...state, stability };
}

function alphaOf(color: string): number {
  const match = color.match(/rgba\([^)]*,\s*([\d.]+)\)$/);
  if (!match) {
    throw new Error(`Not an rgba string: ${color}`);
  }
  return Number(match[1]);
}

describe('ink density', () => {
  it('treats an unmet character as not introduced', () => {
    expect(isIntroduced(undefined)).toBe(false);
    expect(inkStrength(undefined)).toBe(0);
  });

  it('draws an unmet character fainter than a just-met one', () => {
    expect(alphaOf(inkColor(undefined))).toBeLessThan(
      alphaOf(inkColor(withStability(0))),
    );
  });

  it('rises monotonically with stability', () => {
    const alphas = [0, 1, 4, 7, 14, 21].map((days) =>
      alphaOf(inkColor(withStability(days))),
    );
    const sorted = [...alphas].sort((left, right) => left - right);
    expect(alphas).toEqual(sorted);
    expect(new Set(alphas).size).toBe(alphas.length);
  });

  it('saturates at the top of the interval ladder rather than exceeding it', () => {
    expect(inkStrength(withStability(21))).toBe(1);
    expect(inkStrength(withStability(500))).toBe(1);
    expect(alphaOf(inkColor(withStability(500)))).toBeLessThanOrEqual(1);
  });

  it('never renders a fully opaque or fully invisible glyph', () => {
    for (const days of [0, 3, 21, 9999]) {
      const alpha = alphaOf(inkColor(withStability(days)));
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThanOrEqual(0.98);
    }
  });
});
