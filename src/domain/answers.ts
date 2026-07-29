import type { AnswerClassification, LearningItem } from './types';
import {
  classificationIsCorrect,
  classifyReviewAnswer,
  normalizeReviewAnswer,
} from '../../supabase/functions/_shared/review-policy';

export function normalizeAnswer(answer: string): string {
  return normalizeReviewAnswer(answer);
}

export function classifyAnswer(
  item: LearningItem,
  rawAnswer: string,
): AnswerClassification {
  return classifyReviewAnswer(
    item.content.primaryAnswer,
    item.content.acceptedAnswers,
    rawAnswer,
  );
}

export function isCorrectClassification(
  classification: AnswerClassification,
): boolean {
  return classificationIsCorrect(classification);
}

/**
 * Whether an answer is one edit away from something we would have accepted.
 *
 * A one-character slip should not tell the scheduler the learner has forgotten
 * a character. The bound of 1 is what keeps the override honest: any looser and
 * "I meant that" becomes a free pass on anything.
 */
export function isNearMiss(item: LearningItem, answer: string): boolean {
  const attempt = normalizeAnswer(answer);
  if (attempt.length === 0) {
    return false;
  }
  return item.content.acceptedAnswers.some(
    (accepted) => editDistance(attempt, normalizeAnswer(accepted)) === 1,
  );
}

/** Levenshtein distance, bounded work for the short strings we compare. */
function editDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}
