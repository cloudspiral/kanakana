import { createInitialSnapshot, hydrateSnapshot } from './initialState';
import type {
  LearnerSnapshot,
  LearningRepository,
  RepositoryDiagnostics,
} from '@/domain/types';

const STORAGE_KEY = 'kanakana.learner.v1';

export class BrowserLearningRepository implements LearningRepository {
  async initialize(): Promise<void> {
    return Promise.resolve();
  }

  async loadSnapshot(): Promise<LearnerSnapshot> {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!value) {
      return createInitialSnapshot();
    }
    try {
      return hydrateSnapshot(JSON.parse(value));
    } catch {
      globalThis.localStorage?.removeItem(STORAGE_KEY);
      return createInitialSnapshot();
    }
  }

  async saveSnapshot(snapshot: LearnerSnapshot): Promise<void> {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }

  async reset(): Promise<void> {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  }

  async diagnostics(): Promise<RepositoryDiagnostics> {
    return {
      adapter: 'browser',
      status: 'ready',
      detail: 'localStorage · schema 1',
    };
  }
}

export const learningRepository: LearningRepository =
  new BrowserLearningRepository();
