import type { Rating, State } from 'ts-fsrs';

export type LearningItemKind = 'hiragana' | 'katakana' | 'kanji' | 'vocabulary';
export type SkillId = 'kana_reading' | (string & {});
export type ModuleType =
  | 'kana-introduction-v1'
  | 'kana-reading-input-v1'
  | 'kana-writing-input-v1'
  | 'session-summary-v1'
  | (string & {});

export interface LearningItem {
  id: string;
  kind: LearningItemKind;
  schemaVersion: number;
  content: {
    glyph: string;
    primaryAnswer: string;
    acceptedAnswers: string[];
    rowId: string;
    rowLabel: string;
    column: number;
    [key: string]: unknown;
  };
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

export type ActivityEventType =
  | 'module_started'
  | 'item_exposed'
  | 'module_completed'
  | 'session_completed';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  sessionId: string;
  moduleId?: string;
  itemId?: string;
  occurredAt: string;
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
  activityEvents: ActivityEvent[];
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
