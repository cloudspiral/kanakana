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
