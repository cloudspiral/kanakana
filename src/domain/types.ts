import type { Rating, State } from 'ts-fsrs';

export type LearningItemKind = 'hiragana' | 'katakana' | 'kanji' | 'vocabulary';
export type SkillId = 'kana_reading' | (string & {});
export type DerivedMark = 'dakuten' | 'handakuten';
export type ModuleType =
  | 'kana-introduction-v1'
  | 'kana-reading-input-v1'
  | 'kana-writing-input-v1'
  | 'session-summary-v1'
  | (string & {});

export interface LearningItemContent {
  glyph: string;
  primaryAnswer: string;
  acceptedAnswers: string[];
  rowId: string;
  rowLabel: string;
  column: number;
  /** Base item this voiced form is derived from. */
  derivedFrom?: string;
  /** Voiced forms derived from this base item; は has both ば and ぱ. */
  derivedForms?: string[];
  /** The mark added to the base glyph for this derived form. */
  mark?: DerivedMark;
  [key: string]: unknown;
}

export interface LearningItem {
  id: string;
  kind: LearningItemKind;
  schemaVersion: number;
  content: LearningItemContent;
}

export interface SkillDefinition {
  id: SkillId;
  schemaVersion: number;
  label: string;
  prompt: string;
  answerField: string;
}

export interface ModuleTarget {
  itemId: string;
  skillId: SkillId;
}

export interface TeachingModuleDefinition {
  id: string;
  moduleType: ModuleType;
  schemaVersion: number;
  content: Record<string, unknown>;
  targets: ModuleTarget[];
}

export interface CurriculumUnit {
  id: string;
  title: string;
  shortTitle: string;
  order: number;
  modules: TeachingModuleDefinition[];
}

export interface CurriculumManifest {
  id: string;
  version: number;
  publishedAt: string;
  items: LearningItem[];
  skills: SkillDefinition[];
  units: CurriculumUnit[];
}

export type AnswerClassification =
  | 'exact'
  | 'accepted_alias'
  | 'incorrect'
  | 'revealed';

export interface ReviewAttempt {
  eventId: string;
  sessionId: string;
  itemId: string;
  skillId: SkillId;
  answer: string;
  classification: AnswerClassification;
  rating: Rating.Again | Rating.Good;
  responseMs: number;
  exerciseVersion: number;
  reviewedAt: string;
  expectedStateVersion: number;
}

export type DrawingSource = 'lesson' | 'review' | 'practice';

/**
 * A completed drawing, intentionally separate from a graded review.
 *
 * Practice events count work without carrying any FSRS evidence. Lesson and
 * review drawings are also represented on the server from their accepted
 * writing review event, using the same event ID for idempotency.
 */
export interface DrawingEvent {
  eventId: string;
  itemId: string;
  source: DrawingSource;
  sessionId: string;
  occurredAt: string;
}

export interface LearnerSkillState {
  itemId: string;
  skillId: SkillId;
  version: number;
  updatedAt: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: State;
  last_review?: string;
}

export type PracticeSessionKind = 'lesson' | 'review';
export type PracticeStepKind = 'introduction' | 'assessment';

export interface PracticeStep {
  id: string;
  kind: PracticeStepKind;
  moduleId: string;
  moduleType: ModuleType;
  moduleSchemaVersion: number;
  itemId: string;
  skillId: SkillId;
  isRecheck: boolean;
}

export interface SessionOutcomes {
  introducedItemIds: string[];
  strengthenedItemIds: string[];
  againItemIds: string[];
  correctAttempts: number;
  totalAttempts: number;
}

export interface ActivePracticeSession {
  id: string;
  kind: PracticeSessionKind;
  unitId?: string;
  manifestVersion: number;
  localDate: string;
  startedAt: string;
  updatedAt: string;
  steps: PracticeStep[];
  currentIndex: number;
  outcomes: SessionOutcomes;
}

export interface LearnerSettings {
  hapticsEnabled: boolean;
  /**
   * Show the faint character underneath while tracing. On by default; the
   * learner turns it off when they are ready to write from memory.
   */
  tracingGuideEnabled: boolean;
  /** Play the recorded pronunciation when a character appears or is tapped. */
  soundEnabled: boolean;
}

export interface SyncMetadata {
  cloudStatus: 'unconfigured' | 'offline' | 'syncing' | 'synced' | 'error';
  guestId?: string;
  lastSyncAt?: string;
  lastError?: string;
  acceptedCount: number;
}

export interface LearnerSnapshot {
  schemaVersion: number;
  onboardingComplete: boolean;
  completedUnitIds: string[];
  settings: LearnerSettings;
  skillStates: Record<string, LearnerSkillState>;
  reviewOutbox: ReviewAttempt[];
  /** Server-confirmed completed drawing totals by item ID. */
  drawingCounts: Record<string, number>;
  /** Completed lesson or free-practice drawings waiting to sync. */
  drawingOutbox: DrawingEvent[];
  activeSession: ActivePracticeSession | null;
  lastSummary: {
    sessionId: string;
    kind: PracticeSessionKind;
    unitId?: string;
    outcomes: SessionOutcomes;
    completedAt: string;
  } | null;
  cachedManifest: CurriculumManifest | null;
  sync: SyncMetadata;
}

export interface RepositoryDiagnostics {
  adapter: 'sqlite' | 'browser';
  status: 'ready' | 'error';
  detail: string;
}

export interface LearningRepository {
  initialize(): Promise<void>;
  loadSnapshot(): Promise<LearnerSnapshot>;
  saveSnapshot(snapshot: LearnerSnapshot): Promise<void>;
  reset(): Promise<void>;
  diagnostics(): Promise<RepositoryDiagnostics>;
}

export interface SyncResult {
  pendingCount: number;
  acceptedCount: number;
  acceptedEventIds: string[];
  /**
   * Events the server refused for good — an item withdrawn from the curriculum,
   * say. Dropped from the outbox unaccepted, since retrying cannot help.
   */
  discardedEventIds: string[];
  pendingDrawingCount: number;
  acceptedDrawingEventIds: string[];
  discardedDrawingEventIds: string[];
  canonicalDrawingCounts: Record<string, number>;
  canonicalStates: LearnerSkillState[];
  guestId?: string;
  cloudStatus: SyncMetadata['cloudStatus'];
  error?: string;
}

export interface SyncService {
  sync(snapshot: LearnerSnapshot, manifest: CurriculumManifest): Promise<SyncResult>;
  fetchManifest(): Promise<CurriculumManifest | null>;
  startFreshGuest(): Promise<string | undefined>;
}

export function learnerStateKey(itemId: string, skillId: SkillId): string {
  return `${itemId}::${skillId}`;
}
