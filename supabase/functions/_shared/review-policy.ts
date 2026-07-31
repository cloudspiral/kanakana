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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The design's early-review bump, +0.08 against +0.22 for a due review, kept as
 * a ratio because FSRS has no strength field to add those absolute numbers to.
 */
const EARLY_STABILITY_GAIN_RATIO = 0.08 / 0.22;

/**
 * The shape this rule needs from an FSRS card.
 *
 * Structural rather than importing `Card` from ts-fsrs on purpose: this module
 * is shared between the Expo client and the Deno edge function, which resolve
 * that package under different specifiers. Keeping it dependency-free is what
 * lets both sides run the identical rule.
 */
export interface SettleableCard {
  due: Date;
  stability: number;
  scheduled_days: number;
}

/**
 * Answering before a card is due earns a smaller gain and can never push the
 * next review further out. So an early session — a weak-spots run, say — can
 * only ever rescue a schedule, never inflate it, which is what makes it safe to
 * offer whenever the learner wants it.
 *
 * This MUST run on both sides. The client applies it for immediate UX, but
 * `submit-reviews` is canonical and its result overwrites the client's, so a
 * server that skipped this would silently undo the rule on the next sync.
 *
 * Callers apply it only to a successful review that has a previous state: a
 * miss always counts in full, and a first-ever review has nothing to be early
 * against.
 */
export function settleEarlyReview<T extends SettleableCard>(
  before: { due: Date; stability: number },
  after: T,
  reviewedAt: Date,
): T {
  const previousDue = before.due.getTime();
  if (reviewedAt.getTime() >= previousDue) {
    return after;
  }
  const gain = Math.max(0, after.stability - before.stability);
  const due = new Date(Math.min(after.due.getTime(), previousDue));
  return {
    ...after,
    stability: before.stability + gain * EARLY_STABILITY_GAIN_RATIO,
    due,
    scheduled_days: Math.max(
      0,
      Math.round((due.getTime() - reviewedAt.getTime()) / MS_PER_DAY),
    ),
  };
}

/**
 * Settle a successful answer under the daily Review contract.
 *
 * A card selected because it is due before the learner's local day ends is a
 * scheduled review, even when its exact timestamp is still a few hours away,
 * so it earns the normal FSRS result rather than the reduced early-practice
 * bump. Successful session work is also kept beyond the current local day so
 * one completed queue cannot reopen a few minutes later.
 *
 * With no day boundary this preserves the legacy/optional-practice behavior.
 */
export function settleSuccessfulReview<T extends SettleableCard>(
  before: { due: Date; stability: number } | undefined,
  after: T,
  reviewedAt: Date,
  dayEndsAt?: Date,
): T {
  const hasValidDayEnd = Boolean(
    dayEndsAt &&
      !Number.isNaN(dayEndsAt.getTime()) &&
      dayEndsAt.getTime() > reviewedAt.getTime(),
  );
  const wasScheduledForToday = Boolean(
    before &&
      hasValidDayEnd &&
      before.due.getTime() < dayEndsAt!.getTime(),
  );
  const settled =
    before && !wasScheduledForToday
      ? settleEarlyReview(before, after, reviewedAt)
      : after;
  if (!hasValidDayEnd || settled.due.getTime() >= dayEndsAt!.getTime()) {
    return settled;
  }
  const due = new Date(dayEndsAt!);
  return {
    ...settled,
    due,
    scheduled_days: Math.max(
      0,
      Math.round((due.getTime() - reviewedAt.getTime()) / MS_PER_DAY),
    ),
  };
}
