import {
  BASE_KANA_COUNT,
  DAKUTEN_KANA_COUNT,
  GOJUON_ROWS,
  HANDAKUTEN_KANA_COUNT,
} from './curriculum';
import { learnerStateKey, type CurriculumManifest, type LearnerSnapshot } from './types';

export type KanaLens = 'plain' | 'dakuten' | 'handakuten';

export interface KanaGridCell {
  column: number;
  itemId?: string;
  glyph?: string;
  tick?: string;
}

export interface KanaGridRow {
  id: string;
  label: string;
  cells: KanaGridCell[];
}

function introduced(
  snapshot: LearnerSnapshot,
  itemId: string | undefined,
): boolean {
  if (!itemId) {
    return false;
  }
  return Boolean(
    snapshot.skillStates[learnerStateKey(itemId, 'kana_reading')]?.reps,
  );
}

export function voicedLensAvailable(
  manifest: CurriculumManifest,
  snapshot: LearnerSnapshot,
): boolean {
  return manifest.items.some(
    (item) =>
      item.content.derivedFrom && introduced(snapshot, item.id),
  );
}

export function lensProgress(
  manifest: CurriculumManifest,
  snapshot: LearnerSnapshot,
  lens: KanaLens,
): { introduced: number; total: number; label: string } {
  const relevant = manifest.items.filter((item) =>
    lens === 'plain'
      ? !item.content.derivedFrom
      : item.content.mark === lens,
  );
  return {
    introduced: relevant.filter((item) => introduced(snapshot, item.id)).length,
    total:
      lens === 'plain'
        ? BASE_KANA_COUNT
        : lens === 'dakuten'
          ? DAKUTEN_KANA_COUNT
          : HANDAKUTEN_KANA_COUNT,
    label:
      lens === 'plain' ? 'kana' : lens === 'dakuten' ? 'voiced' : 'in ゜',
  };
}

const DAKUTEN_LABELS: Record<string, string> = {
  k: 'G ゛',
  s: 'Z ゛',
  t: 'D ゛',
  h: 'B ゛',
};

export function kanaGridRows(
  manifest: CurriculumManifest,
  snapshot: LearnerSnapshot,
  lens: KanaLens,
): KanaGridRow[] {
  const byId = new Map(manifest.items.map((item) => [item.id, item]));

  return GOJUON_ROWS.map((row) => ({
    id: row.id,
    label:
      lens === 'dakuten'
        ? DAKUTEN_LABELS[row.id] ?? row.shortTitle.replace(/\s+row$/i, '')
        : lens === 'handakuten' && row.id === 'h'
          ? 'P ゜'
          : row.shortTitle.replace(/\s+row$/i, ''),
    cells: [0, 1, 2, 3, 4].map((column) => {
      const base = manifest.items.find(
        (item) =>
          !item.content.derivedFrom &&
          item.content.rowId === row.id &&
          item.content.column === column,
      );
      if (!base) {
        return { column };
      }
      const children = (base.content.derivedForms ?? [])
        .map((id) => byId.get(id))
        .filter((item) => item !== undefined);

      if (lens === 'plain') {
        const introducedMarks = children
          .filter((item) => introduced(snapshot, item.id))
          .map((item) => item.content.mark);
        return {
          column,
          itemId: base.id,
          glyph: base.content.glyph,
          tick: [
            introducedMarks.includes('dakuten') ? '゛' : '',
            introducedMarks.includes('handakuten') ? '゜' : '',
          ].join(''),
        };
      }

      const child = children.find(
        (item) =>
          item.content.mark === lens && introduced(snapshot, item.id),
      );
      return child
        ? {
            column,
            itemId: child.id,
            glyph: child.content.glyph,
          }
        : { column };
    }),
  }));
}
