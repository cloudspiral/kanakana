import type {
  CurriculumManifest,
  CurriculumUnit,
  LearningItem,
  TeachingModuleDefinition,
} from './types';
import {
  curriculumManifestSchema,
  validateSupportedModules,
} from './schemas';

interface KanaSeed {
  glyph: string;
  romaji: string;
  aliases?: string[];
  column: number;
}

interface RowSeed {
  id: string;
  title: string;
  shortTitle: string;
  kana: KanaSeed[];
}

export const GOJUON_ROWS: RowSeed[] = [
  {
    id: 'vowels',
    title: 'The vowel row',
    shortTitle: 'Vowels',
    kana: [
      { glyph: 'あ', romaji: 'a', column: 0 },
      { glyph: 'い', romaji: 'i', column: 1 },
      { glyph: 'う', romaji: 'u', column: 2 },
      { glyph: 'え', romaji: 'e', column: 3 },
      { glyph: 'お', romaji: 'o', column: 4 },
    ],
  },
  {
    id: 'k',
    title: 'The K row',
    shortTitle: 'K row',
    kana: [
      { glyph: 'か', romaji: 'ka', column: 0 },
      { glyph: 'き', romaji: 'ki', column: 1 },
      { glyph: 'く', romaji: 'ku', column: 2 },
      { glyph: 'け', romaji: 'ke', column: 3 },
      { glyph: 'こ', romaji: 'ko', column: 4 },
    ],
  },
  {
    id: 's',
    title: 'The S row',
    shortTitle: 'S row',
    kana: [
      { glyph: 'さ', romaji: 'sa', column: 0 },
      { glyph: 'し', romaji: 'shi', aliases: ['si'], column: 1 },
      { glyph: 'す', romaji: 'su', column: 2 },
      { glyph: 'せ', romaji: 'se', column: 3 },
      { glyph: 'そ', romaji: 'so', column: 4 },
    ],
  },
  {
    id: 't',
    title: 'The T row',
    shortTitle: 'T row',
    kana: [
      { glyph: 'た', romaji: 'ta', column: 0 },
      { glyph: 'ち', romaji: 'chi', aliases: ['ti'], column: 1 },
      { glyph: 'つ', romaji: 'tsu', aliases: ['tu'], column: 2 },
      { glyph: 'て', romaji: 'te', column: 3 },
      { glyph: 'と', romaji: 'to', column: 4 },
    ],
  },
  {
    id: 'n',
    title: 'The N row',
    shortTitle: 'N row',
    kana: [
      { glyph: 'な', romaji: 'na', column: 0 },
      { glyph: 'に', romaji: 'ni', column: 1 },
      { glyph: 'ぬ', romaji: 'nu', column: 2 },
      { glyph: 'ね', romaji: 'ne', column: 3 },
      { glyph: 'の', romaji: 'no', column: 4 },
    ],
  },
  {
    id: 'h',
    title: 'The H row',
    shortTitle: 'H row',
    kana: [
      { glyph: 'は', romaji: 'ha', column: 0 },
      { glyph: 'ひ', romaji: 'hi', column: 1 },
      { glyph: 'ふ', romaji: 'fu', aliases: ['hu'], column: 2 },
      { glyph: 'へ', romaji: 'he', column: 3 },
      { glyph: 'ほ', romaji: 'ho', column: 4 },
    ],
  },
  {
    id: 'm',
    title: 'The M row',
    shortTitle: 'M row',
    kana: [
      { glyph: 'ま', romaji: 'ma', column: 0 },
      { glyph: 'み', romaji: 'mi', column: 1 },
      { glyph: 'む', romaji: 'mu', column: 2 },
      { glyph: 'め', romaji: 'me', column: 3 },
      { glyph: 'も', romaji: 'mo', column: 4 },
    ],
  },
  {
    id: 'y',
    title: 'The Y row',
    shortTitle: 'Y row',
    kana: [
      { glyph: 'や', romaji: 'ya', column: 0 },
      { glyph: 'ゆ', romaji: 'yu', column: 2 },
      { glyph: 'よ', romaji: 'yo', column: 4 },
    ],
  },
  {
    id: 'r',
    title: 'The R row',
    shortTitle: 'R row',
    kana: [
      { glyph: 'ら', romaji: 'ra', column: 0 },
      { glyph: 'り', romaji: 'ri', column: 1 },
      { glyph: 'る', romaji: 'ru', column: 2 },
      { glyph: 'れ', romaji: 're', column: 3 },
      { glyph: 'ろ', romaji: 'ro', column: 4 },
    ],
  },
  {
    id: 'w',
    title: 'The W row',
    shortTitle: 'W row',
    kana: [
      { glyph: 'わ', romaji: 'wa', column: 0 },
      { glyph: 'を', romaji: 'wo', aliases: ['o'], column: 4 },
    ],
  },
  {
    id: 'final-n',
    title: 'The final N',
    shortTitle: 'Final N',
    kana: [{ glyph: 'ん', romaji: 'n', aliases: ['nn', "n'"], column: 2 }],
  },
];

function itemId(rowId: string, answer: string) {
  return `hiragana-${rowId}-${answer.replace("'", '')}`;
}

function createModule(
  row: RowSeed,
  suffix: string,
  moduleType: TeachingModuleDefinition['moduleType'],
  kana: KanaSeed[],
): TeachingModuleDefinition {
  const itemIds = kana.map((seed) => itemId(row.id, seed.romaji));
  return {
    id: `${row.id}-${suffix}`,
    moduleType,
    schemaVersion: 1,
    content:
      moduleType === 'kana-introduction-v1'
        ? { itemIds, heading: `Meet ${kana.map((item) => item.glyph).join('  ')}` }
        : { itemIds, prompt: 'What sound does this make?' },
    targets: itemIds.map((id) => ({ itemId: id, skillId: 'kana_reading' })),
  };
}

function createUnit(row: RowSeed, order: number): CurriculumUnit {
  const splitIndex = Math.min(2, row.kana.length);
  const first = row.kana.slice(0, splitIndex);
  const rest = row.kana.slice(splitIndex);
  const modules: TeachingModuleDefinition[] = [
    createModule(row, 'intro-1', 'kana-introduction-v1', first),
    createModule(row, 'check-1', 'kana-reading-input-v1', first),
  ];

  if (rest.length > 0) {
    modules.push(
      createModule(row, 'intro-2', 'kana-introduction-v1', rest),
      createModule(row, 'check-all', 'kana-reading-input-v1', row.kana),
    );
  }

  modules.push({
    id: `${row.id}-summary`,
    moduleType: 'session-summary-v1',
    schemaVersion: 1,
    content: { heading: `${row.title} complete` },
    targets: row.kana.map((seed) => ({
      itemId: itemId(row.id, seed.romaji),
      skillId: 'kana_reading',
    })),
  });

  return {
    id: `unit-${row.id}`,
    title: row.title,
    shortTitle: row.shortTitle,
    order,
    modules,
  };
}

const items: LearningItem[] = GOJUON_ROWS.flatMap((row) =>
  row.kana.map((seed) => ({
    id: itemId(row.id, seed.romaji),
    kind: 'hiragana' as const,
    schemaVersion: 1,
    content: {
      glyph: seed.glyph,
      primaryAnswer: seed.romaji,
      acceptedAnswers: [seed.romaji, ...(seed.aliases ?? [])],
      rowId: row.id,
      rowLabel: row.shortTitle,
      column: seed.column,
    },
  })),
);

const rawBundledManifest: CurriculumManifest = {
  id: 'kanakana-hiragana-beginner',
  version: 1,
  publishedAt: '2026-07-28T00:00:00.000Z',
  items,
  skills: [
    {
      id: 'kana_reading',
      schemaVersion: 1,
      label: 'Kana reading',
      prompt: 'See a kana and recall its sound.',
      answerField: 'content.acceptedAnswers',
    },
  ],
  units: GOJUON_ROWS.map(createUnit),
};

export const BUNDLED_MANIFEST = validateSupportedModules(
  curriculumManifestSchema.parse(rawBundledManifest),
) as CurriculumManifest;

export function getItem(manifest: CurriculumManifest, id: string): LearningItem {
  const item = manifest.items.find((candidate) => candidate.id === id);
  if (!item) {
    throw new Error(`Unknown learning item: ${id}`);
  }
  return item;
}
