import type {
  CurriculumManifest,
  CurriculumUnit,
  DerivedMark,
  LearningItem,
  TeachingModuleDefinition,
} from './types';
import {
  curriculumManifestSchema,
  validateSupportedModules,
} from './schemas';

export const BASE_KANA_COUNT = 46;
export const DAKUTEN_KANA_COUNT = 20;
export const HANDAKUTEN_KANA_COUNT = 5;
export const TOTAL_KANA_COUNT =
  BASE_KANA_COUNT + DAKUTEN_KANA_COUNT + HANDAKUTEN_KANA_COUNT;

interface KanaSeed {
  glyph: string;
  romaji: string;
  aliases?: string[];
  column: number;
  baseGlyph?: string;
  mark?: DerivedMark;
}

export interface RowSeed {
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

const VOICED_ROWS: RowSeed[] = [
  {
    id: 'g',
    title: 'The G row',
    shortTitle: 'G row',
    kana: [
      { glyph: 'が', romaji: 'ga', column: 0, baseGlyph: 'か', mark: 'dakuten' },
      { glyph: 'ぎ', romaji: 'gi', column: 1, baseGlyph: 'き', mark: 'dakuten' },
      { glyph: 'ぐ', romaji: 'gu', column: 2, baseGlyph: 'く', mark: 'dakuten' },
      { glyph: 'げ', romaji: 'ge', column: 3, baseGlyph: 'け', mark: 'dakuten' },
      { glyph: 'ご', romaji: 'go', column: 4, baseGlyph: 'こ', mark: 'dakuten' },
    ],
  },
  {
    id: 'z',
    title: 'The Z row',
    shortTitle: 'Z row',
    kana: [
      { glyph: 'ざ', romaji: 'za', column: 0, baseGlyph: 'さ', mark: 'dakuten' },
      {
        glyph: 'じ',
        romaji: 'ji',
        aliases: ['zi'],
        column: 1,
        baseGlyph: 'し',
        mark: 'dakuten',
      },
      { glyph: 'ず', romaji: 'zu', column: 2, baseGlyph: 'す', mark: 'dakuten' },
      { glyph: 'ぜ', romaji: 'ze', column: 3, baseGlyph: 'せ', mark: 'dakuten' },
      { glyph: 'ぞ', romaji: 'zo', column: 4, baseGlyph: 'そ', mark: 'dakuten' },
    ],
  },
  {
    id: 'd',
    title: 'The D row',
    shortTitle: 'D row',
    kana: [
      { glyph: 'だ', romaji: 'da', column: 0, baseGlyph: 'た', mark: 'dakuten' },
      {
        glyph: 'ぢ',
        romaji: 'ji',
        aliases: ['di'],
        column: 1,
        baseGlyph: 'ち',
        mark: 'dakuten',
      },
      {
        glyph: 'づ',
        romaji: 'zu',
        aliases: ['du'],
        column: 2,
        baseGlyph: 'つ',
        mark: 'dakuten',
      },
      { glyph: 'で', romaji: 'de', column: 3, baseGlyph: 'て', mark: 'dakuten' },
      { glyph: 'ど', romaji: 'do', column: 4, baseGlyph: 'と', mark: 'dakuten' },
    ],
  },
  {
    id: 'b',
    title: 'The B row',
    shortTitle: 'B row',
    kana: [
      { glyph: 'ば', romaji: 'ba', column: 0, baseGlyph: 'は', mark: 'dakuten' },
      { glyph: 'び', romaji: 'bi', column: 1, baseGlyph: 'ひ', mark: 'dakuten' },
      { glyph: 'ぶ', romaji: 'bu', column: 2, baseGlyph: 'ふ', mark: 'dakuten' },
      { glyph: 'べ', romaji: 'be', column: 3, baseGlyph: 'へ', mark: 'dakuten' },
      { glyph: 'ぼ', romaji: 'bo', column: 4, baseGlyph: 'ほ', mark: 'dakuten' },
    ],
  },
  {
    id: 'p',
    title: 'The P row',
    shortTitle: 'P row',
    kana: [
      {
        glyph: 'ぱ',
        romaji: 'pa',
        column: 0,
        baseGlyph: 'は',
        mark: 'handakuten',
      },
      {
        glyph: 'ぴ',
        romaji: 'pi',
        column: 1,
        baseGlyph: 'ひ',
        mark: 'handakuten',
      },
      {
        glyph: 'ぷ',
        romaji: 'pu',
        column: 2,
        baseGlyph: 'ふ',
        mark: 'handakuten',
      },
      {
        glyph: 'ぺ',
        romaji: 'pe',
        column: 3,
        baseGlyph: 'へ',
        mark: 'handakuten',
      },
      {
        glyph: 'ぽ',
        romaji: 'po',
        column: 4,
        baseGlyph: 'ほ',
        mark: 'handakuten',
      },
    ],
  },
];

const rowById = new Map(
  [...GOJUON_ROWS, ...VOICED_ROWS].map((row) => [row.id, row]),
);

/** Lesson order: each voiced sound rule follows the base row it modifies. */
export const CURRICULUM_ROWS: RowSeed[] = [
  rowById.get('vowels')!,
  rowById.get('k')!,
  rowById.get('g')!,
  rowById.get('s')!,
  rowById.get('z')!,
  rowById.get('t')!,
  rowById.get('d')!,
  rowById.get('n')!,
  rowById.get('h')!,
  rowById.get('b')!,
  rowById.get('p')!,
  rowById.get('m')!,
  rowById.get('y')!,
  rowById.get('r')!,
  rowById.get('w')!,
  rowById.get('final-n')!,
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

/** A lesson meets every kana in the row before checking the whole row. */
function createUnit(row: RowSeed, order: number): CurriculumUnit {
  const modules: TeachingModuleDefinition[] = [
    createModule(row, 'intro', 'kana-introduction-v1', row.kana),
    createModule(row, 'check-all', 'kana-reading-input-v1', row.kana),
    {
      id: `${row.id}-summary`,
      moduleType: 'session-summary-v1',
      schemaVersion: 1,
      content: { heading: `${row.title} complete` },
      targets: row.kana.map((seed) => ({
        itemId: itemId(row.id, seed.romaji),
        skillId: 'kana_reading',
      })),
    },
  ];

  return {
    id: `unit-${row.id}`,
    title: row.title,
    shortTitle: row.shortTitle,
    order,
    modules,
  };
}

const seedEntries = CURRICULUM_ROWS.flatMap((row, rowOrder) =>
  row.kana.map((seed, itemOrder) => ({
    row,
    seed,
    curriculumOrder: rowOrder * 10 + itemOrder,
  })),
);

const idByGlyph = new Map(
  seedEntries.map(({ row, seed }) => [
    seed.glyph,
    itemId(row.id, seed.romaji),
  ]),
);

const derivedFormsByBase = new Map<string, string[]>();
for (const { row, seed } of seedEntries) {
  if (!seed.baseGlyph) {
    continue;
  }
  const baseId = idByGlyph.get(seed.baseGlyph)!;
  const forms = derivedFormsByBase.get(baseId) ?? [];
  forms.push(itemId(row.id, seed.romaji));
  derivedFormsByBase.set(baseId, forms);
}

const items: LearningItem[] = seedEntries.map(
  ({ row, seed, curriculumOrder }) => {
    const id = itemId(row.id, seed.romaji);
    const derivedFrom = seed.baseGlyph
      ? idByGlyph.get(seed.baseGlyph)
      : undefined;
    return {
      id,
      kind: 'hiragana' as const,
      schemaVersion: 1,
      content: {
        glyph: seed.glyph,
        primaryAnswer: seed.romaji,
        acceptedAnswers: [seed.romaji, ...(seed.aliases ?? [])],
        rowId: row.id,
        rowLabel: row.shortTitle,
        column: seed.column,
        curriculumOrder,
        ...(derivedFrom ? { derivedFrom, mark: seed.mark } : {}),
        ...(derivedFormsByBase.has(id)
          ? { derivedForms: derivedFormsByBase.get(id)! }
          : {}),
      },
    };
  },
);

const rawBundledManifest: CurriculumManifest = {
  id: 'kanakana-hiragana-beginner',
  version: 3,
  publishedAt: '2026-07-30T00:00:00.000Z',
  items,
  skills: [
    {
      id: 'kana_reading',
      schemaVersion: 1,
      label: 'Kana reading',
      prompt: 'See a kana and recall its sound.',
      answerField: 'content.acceptedAnswers',
    },
    {
      id: 'kana_writing',
      schemaVersion: 1,
      label: 'Kana writing',
      prompt: 'Hear a sound and write its kana.',
      answerField: 'content.glyph',
    },
  ],
  units: CURRICULUM_ROWS.map(createUnit),
};

export const BUNDLED_MANIFEST = validateSupportedModules(
  curriculumManifestSchema.parse(rawBundledManifest),
) as CurriculumManifest;

/** The row name without the redundant trailing word "row". */
export function bareRowLabel(shortTitle: string): string {
  return shortTitle.replace(/\s+row$/i, '');
}

export function getItem(
  manifest: CurriculumManifest,
  id: string,
): LearningItem {
  const item = manifest.items.find((candidate) => candidate.id === id);
  if (!item) {
    throw new Error(`Unknown learning item: ${id}`);
  }
  return item;
}

export function baseItems(manifest: CurriculumManifest): LearningItem[] {
  return manifest.items.filter((item) => !item.content.derivedFrom);
}

export function derivedItems(
  manifest: CurriculumManifest,
  mark?: DerivedMark,
): LearningItem[] {
  return manifest.items.filter(
    (item) =>
      Boolean(item.content.derivedFrom) &&
      (mark === undefined || item.content.mark === mark),
  );
}
