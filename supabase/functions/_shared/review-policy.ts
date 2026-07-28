export type SharedClassification =
  | 'exact'
  | 'accepted_alias'
  | 'incorrect'
  | 'revealed';

export const FSRS_CONFIG = {
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: false,
  enable_short_term: true,
  learning_steps: ['1m', '10m'] as const,
  relearning_steps: ['10m'] as const,
};

export function normalizeReviewAnswer(answer: string): string {
  return answer.trim().toLocaleLowerCase('en-US');
}

export function classifyReviewAnswer(
  primaryAnswer: string,
  acceptedAnswers: string[],
  rawAnswer: string,
  revealed = false,
): SharedClassification {
  if (revealed) {
    return 'revealed';
  }
  const answer = normalizeReviewAnswer(rawAnswer);
  if (answer === normalizeReviewAnswer(primaryAnswer)) {
    return 'exact';
  }
  return acceptedAnswers.map(normalizeReviewAnswer).includes(answer)
    ? 'accepted_alias'
    : 'incorrect';
}

export function classificationIsCorrect(
  classification: SharedClassification,
): boolean {
  return classification === 'exact' || classification === 'accepted_alias';
}
