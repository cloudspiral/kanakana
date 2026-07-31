interface PracticeExitState {
  hasActivePrompt: boolean;
  isSubmittingAnswer: boolean;
  isShowingCompletedFeedback: boolean;
  hasSummary: boolean;
}

/**
 * Choose a fallback destination only when practice no longer owns visible work.
 *
 * Persisting the last answer clears the active session before the answer
 * handler finishes. Treating that brief state as an exit would mount a
 * Redirect while the handler is still preparing its own summary transition.
 */
export function practiceExitPath({
  hasActivePrompt,
  isSubmittingAnswer,
  isShowingCompletedFeedback,
  hasSummary,
}: PracticeExitState): '/' | '/summary' | null {
  if (
    hasActivePrompt ||
    isSubmittingAnswer ||
    isShowingCompletedFeedback
  ) {
    return null;
  }
  return hasSummary ? '/summary' : '/';
}
