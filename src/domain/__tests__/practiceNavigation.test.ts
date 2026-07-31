import { describe, expect, it } from 'vitest';

import { practiceExitPath } from '../practiceNavigation';

describe('practice exit navigation', () => {
  it('does not redirect while the last answer is being persisted', () => {
    expect(
      practiceExitPath({
        hasActivePrompt: false,
        isSubmittingAnswer: true,
        isShowingCompletedFeedback: false,
        hasSummary: true,
      }),
    ).toBeNull();
  });

  it('leaves the completed reading feedback in control of its one transition', () => {
    expect(
      practiceExitPath({
        hasActivePrompt: false,
        isSubmittingAnswer: false,
        isShowingCompletedFeedback: true,
        hasSummary: true,
      }),
    ).toBeNull();
  });

  it('falls back to the persisted summary only when no completion UI owns the route', () => {
    expect(
      practiceExitPath({
        hasActivePrompt: false,
        isSubmittingAnswer: false,
        isShowingCompletedFeedback: false,
        hasSummary: true,
      }),
    ).toBe('/summary');
  });

  it('returns home when practice is empty without a summary', () => {
    expect(
      practiceExitPath({
        hasActivePrompt: false,
        isSubmittingAnswer: false,
        isShowingCompletedFeedback: false,
        hasSummary: false,
      }),
    ).toBe('/');
  });
});
