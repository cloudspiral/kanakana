import * as SQLite from 'expo-sqlite';

import { createInitialSnapshot } from './initialState';
import type {
  LearnerSnapshot,
  LearningRepository,
  RepositoryDiagnostics,
  ReviewAttempt,
} from '@/domain/types';

const DATABASE_NAME = 'kanakana.db';
const DATABASE_VERSION = 1;

type SnapshotRow = { payload: string };
type OutboxRow = { payload: string };

class SQLiteLearningRepository implements LearningRepository {
  private database: SQLite.SQLiteDatabase | null = null;

  private async db() {
    if (!this.database) {
      this.database = await SQLite.openDatabaseAsync(DATABASE_NAME);
    }
    return this.database;
  }

  async initialize() {
    const database = await this.db();
    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS learner_snapshot (
        singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS review_outbox (
        event_id TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      PRAGMA user_version = ${DATABASE_VERSION};
    `);
  }

  async loadSnapshot(): Promise<LearnerSnapshot> {
    const database = await this.db();
    const row = await database.getFirstAsync<SnapshotRow>(
      'SELECT payload FROM learner_snapshot WHERE singleton_id = 1',
    );
    const initial = createInitialSnapshot();
    const snapshot = row
      ? ({ ...initial, ...JSON.parse(row.payload) } as LearnerSnapshot)
      : initial;
    const outboxRows = await database.getAllAsync<OutboxRow>(
      'SELECT payload FROM review_outbox ORDER BY created_at ASC',
    );
    snapshot.reviewOutbox = outboxRows.map(
      (outboxRow) => JSON.parse(outboxRow.payload) as ReviewAttempt,
    );
    return snapshot;
  }

  async saveSnapshot(snapshot: LearnerSnapshot): Promise<void> {
    const database = await this.db();
    const snapshotWithoutOutbox = { ...snapshot, reviewOutbox: [] };
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
        `INSERT INTO learner_snapshot (singleton_id, payload, updated_at)
         VALUES (1, ?, ?)
         ON CONFLICT(singleton_id) DO UPDATE SET
           payload = excluded.payload,
           updated_at = excluded.updated_at`,
        JSON.stringify(snapshotWithoutOutbox),
        new Date().toISOString(),
      );
      await transaction.runAsync('DELETE FROM review_outbox');
      for (const event of snapshot.reviewOutbox) {
        await transaction.runAsync(
          `INSERT INTO review_outbox (event_id, payload, created_at)
           VALUES (?, ?, ?)`,
          event.eventId,
          JSON.stringify(event),
          event.reviewedAt,
        );
      }
    });
  }

  async reset(): Promise<void> {
    const database = await this.db();
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync('DELETE FROM review_outbox');
      await transaction.runAsync('DELETE FROM learner_snapshot');
    });
  }

  async diagnostics(): Promise<RepositoryDiagnostics> {
    try {
      const database = await this.db();
      const version = await database.getFirstAsync<{ user_version: number }>(
        'PRAGMA user_version',
      );
      return {
        adapter: 'sqlite',
        status: 'ready',
        detail: `kanakana.db · schema ${version?.user_version ?? DATABASE_VERSION}`,
      };
    } catch (error) {
      return {
        adapter: 'sqlite',
        status: 'error',
        detail: error instanceof Error ? error.message : 'Unknown SQLite error',
      };
    }
  }
}

export const learningRepository: LearningRepository =
  new SQLiteLearningRepository();
