/**
 * Hand-authored teaching copy from the design prototype.
 *
 * Reproduced verbatim except that "character" now reads "kana", which the app
 * uses throughout. Any other rewording should go through the design author.
 * Source: `docs/design/prototypes/Kanakana Prototype.dc.html`.
 *
 * Everything is keyed by the kana glyph itself, matching `content.glyph` on the
 * learning items in `./curriculum`. The prototype keyed these tables by romaji;
 * the glyph is the stabler key, since romaji has competing spellings (shi/si,
 * fu/hu) that the curriculum already treats as interchangeable aliases.
 */

/**
 * A real word the learner will actually meet a character inside.
 *
 * `word` stays a single string rather than pre-split parts because the design
 * paints the target character in the accent colour inside the word: the
 * consuming component finds the glyph with `indexOf` and slices around it. A
 * word whose target is absent (see the note on WORDS) simply renders unhighlighted.
 */
export interface KanaExampleWord {
  /** The word in kana. */
  word: string;
  /** Romaji reading of the whole word. */
  romaji: string;
  /** English gloss, in the prototype's sentence case. */
  gloss: string;
}

/** A visually similar kana, plus the one-line tell that separates the two. */
export interface KanaConfusion {
  /** The kana that gets mistaken for the keyed one. */
  glyph: string;
  /** Its romaji, for labelling and for lookup back into the curriculum. */
  romaji: string;
  /** What to look at to tell them apart, e.g. 'ri joins at the top'. */
  note: string;
}

/** Verdict copy shown after a traced character is graded. */
export interface StrokeVerdict {
  /** Headline verdict. */
  label: string;
  /** Hex colour the design uses for this verdict's label. */
  accent: string;
  /** The explanation underneath. */
  copy: string;
}

/**
 * The five outcomes the trace grader can reach. `partial` is not a failure —
 * it means too few strokes were drawn to judge anything.
 */
export type StrokeVerdictId = 'clean' | 'loose' | 'order' | 'guided' | 'partial';

/** Stroke notes by glyph. Partial: see the note on MEET_HINTS. */
export type KanaStrokeNoteTable = Readonly<Partial<Record<string, string>>>;

/** Example words by glyph. */
export type KanaExampleWordTable = Readonly<Record<string, readonly KanaExampleWord[]>>;

/** Confusable kana by glyph. */
export type KanaConfusionTable = Readonly<Record<string, readonly KanaConfusion[]>>;

/** Verdict copy by outcome id. */
export type StrokeVerdictTable = Readonly<Record<StrokeVerdictId, StrokeVerdict>>;

/**
 * Per-kana stroke notes shown when a character is first introduced.
 *
 * **Partial by design, not by omission.** The prototype only wrote these for the
 * first ten kana (the vowel and K rows) and fell back to a generic line for the
 * rest, so the type is `Partial`. Do not fill the gap with invented copy — use
 * `strokeNoteFor`, which reproduces the prototype's fallback exactly.
 */
export const MEET_HINTS: KanaStrokeNoteTable = {
  'あ': 'Three strokes. The last one curves back like a ribbon — that loop is what tells あ apart from お.',
  'い': 'Two short strokes, both falling left to right. The shortest kana in the set.',
  'う': 'A small tick, then one long curve. Keep the top stroke detached.',
  'え': 'A tick, then a shape like a folded flag. Compare it to ん later.',
  'お': 'Almost あ, but the loop opens the other way and it gains a flick on the right.',
  'か': 'Three strokes. The long diagonal comes first, then the crossbar, then the flick.',
  'き': 'Four strokes: two crossbars, then the long descent, then the curl.',
  'く': 'One stroke. A single sharp corner, like the beak of a bird.',
  'け': 'Three strokes. A vertical, then a lid, then a long right leg.',
  'こ': 'Two strokes, both short and horizontal-ish. The easiest one in the row.',
};

/** The prototype's own wording for a stroke count: 'One stroke' or 'N strokes'. */
function strokeCountText(strokes: number): string {
  return strokes === 1 ? 'One stroke' : `${strokes} strokes`;
}

/**
 * The stroke note for a glyph, falling back to the prototype's generic line for
 * the 36 kana MEET_HINTS does not cover. Every kana therefore has a note, and no
 * caller has to handle `undefined`.
 */
export function strokeNoteFor(glyph: string, strokes: number): string {
  return (
    MEET_HINTS[glyph] ??
    `${strokeCountText(strokes)}. Follow the faint guide, then try it once without.`
  );
}

/**
 * Real words each character shows up in — the design's "Where you'll meet it".
 *
 * Two words per kana, except を, which only makes sense as a particle and so
 * carries the single phrase ほんをよむ.
 *
 * One entry does not contain its own key: す lists みず, where the す appears in
 * its voiced form ず. The design's highlighter degrades to no highlight there
 * rather than breaking, so the entry is preserved as authored.
 */
export const WORDS: KanaExampleWordTable = {
  'あ': [
    { word: 'あめ', romaji: 'ame', gloss: 'rain' },
    { word: 'あさ', romaji: 'asa', gloss: 'morning' },
  ],
  'い': [
    { word: 'いぬ', romaji: 'inu', gloss: 'dog' },
    { word: 'いち', romaji: 'ichi', gloss: 'one' },
  ],
  'う': [
    { word: 'うみ', romaji: 'umi', gloss: 'sea' },
    { word: 'うた', romaji: 'uta', gloss: 'song' },
  ],
  'え': [
    { word: 'えき', romaji: 'eki', gloss: 'station' },
    { word: 'こえ', romaji: 'koe', gloss: 'voice' },
  ],
  'お': [
    { word: 'おと', romaji: 'oto', gloss: 'sound' },
    { word: 'おかね', romaji: 'okane', gloss: 'money' },
  ],
  'か': [
    { word: 'かさ', romaji: 'kasa', gloss: 'umbrella' },
    { word: 'かわ', romaji: 'kawa', gloss: 'river' },
  ],
  'き': [
    { word: 'きた', romaji: 'kita', gloss: 'north' },
    { word: 'つき', romaji: 'tsuki', gloss: 'moon' },
  ],
  'く': [
    { word: 'くつ', romaji: 'kutsu', gloss: 'shoes' },
    { word: 'くち', romaji: 'kuchi', gloss: 'mouth' },
  ],
  'け': [
    { word: 'けさ', romaji: 'kesa', gloss: 'this morning' },
    { word: 'いけ', romaji: 'ike', gloss: 'pond' },
  ],
  'こ': [
    { word: 'ここ', romaji: 'koko', gloss: 'here' },
    { word: 'ねこ', romaji: 'neko', gloss: 'cat' },
  ],
  'さ': [
    { word: 'さかな', romaji: 'sakana', gloss: 'fish' },
    { word: 'さくら', romaji: 'sakura', gloss: 'cherry blossom' },
  ],
  'し': [
    { word: 'しま', romaji: 'shima', gloss: 'island' },
    { word: 'あし', romaji: 'ashi', gloss: 'foot' },
  ],
  'す': [
    { word: 'すな', romaji: 'suna', gloss: 'sand' },
    { word: 'みず', romaji: 'mizu', gloss: 'water' },
  ],
  'せ': [
    { word: 'せかい', romaji: 'sekai', gloss: 'world' },
    { word: 'せなか', romaji: 'senaka', gloss: 'back' },
  ],
  'そ': [
    { word: 'そら', romaji: 'sora', gloss: 'sky' },
    { word: 'そこ', romaji: 'soko', gloss: 'over there' },
  ],
  'た': [
    { word: 'たまご', romaji: 'tamago', gloss: 'egg' },
    { word: 'たかい', romaji: 'takai', gloss: 'tall' },
  ],
  'ち': [
    { word: 'ちかい', romaji: 'chikai', gloss: 'near' },
    { word: 'くち', romaji: 'kuchi', gloss: 'mouth' },
  ],
  'つ': [
    { word: 'つき', romaji: 'tsuki', gloss: 'moon' },
    { word: 'つくえ', romaji: 'tsukue', gloss: 'desk' },
  ],
  'て': [
    { word: 'てがみ', romaji: 'tegami', gloss: 'letter' },
    { word: 'て', romaji: 'te', gloss: 'hand' },
  ],
  'と': [
    { word: 'とり', romaji: 'tori', gloss: 'bird' },
    { word: 'とけい', romaji: 'tokei', gloss: 'clock' },
  ],
  'な': [
    { word: 'なつ', romaji: 'natsu', gloss: 'summer' },
    { word: 'なまえ', romaji: 'namae', gloss: 'name' },
  ],
  'に': [
    { word: 'にく', romaji: 'niku', gloss: 'meat' },
    { word: 'にわ', romaji: 'niwa', gloss: 'garden' },
  ],
  'ぬ': [
    { word: 'ぬの', romaji: 'nuno', gloss: 'cloth' },
    { word: 'いぬ', romaji: 'inu', gloss: 'dog' },
  ],
  'ね': [
    { word: 'ねこ', romaji: 'neko', gloss: 'cat' },
    { word: 'おかね', romaji: 'okane', gloss: 'money' },
  ],
  'の': [
    { word: 'のみもの', romaji: 'nomimono', gloss: 'a drink' },
    { word: 'つの', romaji: 'tsuno', gloss: 'horn' },
  ],
  'は': [
    { word: 'はな', romaji: 'hana', gloss: 'flower' },
    { word: 'はし', romaji: 'hashi', gloss: 'bridge' },
  ],
  'ひ': [
    { word: 'ひと', romaji: 'hito', gloss: 'person' },
    { word: 'ひかり', romaji: 'hikari', gloss: 'light' },
  ],
  'ふ': [
    { word: 'ふゆ', romaji: 'fuyu', gloss: 'winter' },
    { word: 'ふね', romaji: 'fune', gloss: 'boat' },
  ],
  'へ': [
    { word: 'へや', romaji: 'heya', gloss: 'room' },
    { word: 'へび', romaji: 'hebi', gloss: 'snake' },
  ],
  'ほ': [
    { word: 'ほし', romaji: 'hoshi', gloss: 'star' },
    { word: 'ほん', romaji: 'hon', gloss: 'book' },
  ],
  'ま': [
    { word: 'まち', romaji: 'machi', gloss: 'town' },
    { word: 'まど', romaji: 'mado', gloss: 'window' },
  ],
  'み': [
    { word: 'みず', romaji: 'mizu', gloss: 'water' },
    { word: 'みち', romaji: 'michi', gloss: 'road' },
  ],
  'む': [
    { word: 'むし', romaji: 'mushi', gloss: 'insect' },
    { word: 'むら', romaji: 'mura', gloss: 'village' },
  ],
  'め': [
    { word: 'め', romaji: 'me', gloss: 'eye' },
    { word: 'あめ', romaji: 'ame', gloss: 'rain' },
  ],
  'も': [
    { word: 'もり', romaji: 'mori', gloss: 'forest' },
    { word: 'もの', romaji: 'mono', gloss: 'thing' },
  ],
  'や': [
    { word: 'やま', romaji: 'yama', gloss: 'mountain' },
    { word: 'やさい', romaji: 'yasai', gloss: 'vegetables' },
  ],
  'ゆ': [
    { word: 'ゆき', romaji: 'yuki', gloss: 'snow' },
    { word: 'ゆめ', romaji: 'yume', gloss: 'a dream' },
  ],
  'よ': [
    { word: 'よる', romaji: 'yoru', gloss: 'night' },
    { word: 'よむ', romaji: 'yomu', gloss: 'to read' },
  ],
  'ら': [
    { word: 'さくら', romaji: 'sakura', gloss: 'cherry blossom' },
    { word: 'そら', romaji: 'sora', gloss: 'sky' },
  ],
  'り': [
    { word: 'りんご', romaji: 'ringo', gloss: 'apple' },
    { word: 'とり', romaji: 'tori', gloss: 'bird' },
  ],
  'る': [
    { word: 'はる', romaji: 'haru', gloss: 'spring' },
    { word: 'よる', romaji: 'yoru', gloss: 'night' },
  ],
  'れ': [
    { word: 'これ', romaji: 'kore', gloss: 'this one' },
    { word: 'れきし', romaji: 'rekishi', gloss: 'history' },
  ],
  'ろ': [
    { word: 'ろく', romaji: 'roku', gloss: 'six' },
    { word: 'いろ', romaji: 'iro', gloss: 'colour' },
  ],
  'わ': [
    { word: 'わたし', romaji: 'watashi', gloss: 'I, me' },
    { word: 'かわ', romaji: 'kawa', gloss: 'river' },
  ],
  'を': [
    { word: 'ほんをよむ', romaji: 'hon wo yomu', gloss: 'to read a book' },
  ],
  'ん': [
    { word: 'ほん', romaji: 'hon', gloss: 'book' },
    { word: 'にほん', romaji: 'nihon', gloss: 'Japan' },
  ],
};

/**
 * Visually similar kana — the design's "Easy to mix up with".
 *
 * **Provenance caveat, recorded deliberately.** `docs/design/stroke-check-notes.md`
 * flags this table under "Still not done": it "remains my own judgement" — the
 * design author's, not a sourced or published confusion set. The intended
 * replacement is not someone else's list but this app's own `review_events`,
 * i.e. which characters *our* learners actually confuse. The notes argue that is
 * a better dataset than anyone publishes and that the schema already supports
 * deriving it. Treat these pairings as a reasonable placeholder to be measured
 * out of existence, not as ground truth.
 *
 * Consistent with that: the pairings are not symmetric (え lists ち, but ち does
 * not list え). That asymmetry is the author's, and is left as authored.
 */
export const CONFUSIONS: KanaConfusionTable = {
  'あ': [
    { glyph: 'お', romaji: 'o', note: 'the loop opens the other way' },
  ],
  'い': [
    { glyph: 'り', romaji: 'ri', note: 'ri joins at the top' },
  ],
  'う': [
    { glyph: 'つ', romaji: 'tsu', note: 'tsu has no top tick' },
    { glyph: 'ら', romaji: 'ra', note: 'ra is sharper' },
  ],
  'え': [
    { glyph: 'ち', romaji: 'chi', note: 'chi curves under' },
  ],
  'お': [
    { glyph: 'あ', romaji: 'a', note: 'a has no flick' },
    { glyph: 'ぬ', romaji: 'nu', note: 'nu loops closed' },
  ],
  'か': [
    { glyph: 'け', romaji: 'ke', note: 'ke stands upright' },
  ],
  'き': [
    { glyph: 'さ', romaji: 'sa', note: 'sa has one crossbar' },
    { glyph: 'ち', romaji: 'chi', note: 'chi is round' },
  ],
  'く': [
    { glyph: 'へ', romaji: 'he', note: 'he is flat and wide' },
  ],
  'け': [
    { glyph: 'か', romaji: 'ka', note: 'ka leans' },
  ],
  'こ': [
    { glyph: 'に', romaji: 'ni', note: 'ni has a stem' },
  ],
  'さ': [
    { glyph: 'き', romaji: 'ki', note: 'ki has two bars' },
    { glyph: 'ち', romaji: 'chi', note: 'chi faces the other way' },
  ],
  'し': [
    { glyph: 'つ', romaji: 'tsu', note: 'tsu curves the other way' },
    { glyph: 'も', romaji: 'mo', note: 'mo has bars' },
  ],
  'す': [
    { glyph: 'む', romaji: 'mu', note: 'mu has a tail' },
  ],
  'せ': [
    { glyph: 'さ', romaji: 'sa', note: 'sa has no box' },
  ],
  'そ': [
    { glyph: 'ん', romaji: 'n', note: 'n is one soft stroke' },
  ],
  'た': [
    { glyph: 'な', romaji: 'na', note: 'na has a loop' },
  ],
  'ち': [
    { glyph: 'さ', romaji: 'sa', note: 'sa is angular' },
    { glyph: 'き', romaji: 'ki', note: 'ki has two bars' },
  ],
  'つ': [
    { glyph: 'し', romaji: 'shi', note: 'shi opens upward' },
    { glyph: 'う', romaji: 'u', note: 'u has a tick' },
  ],
  'て': [
    { glyph: 'ら', romaji: 'ra', note: 'ra has two parts' },
  ],
  'と': [
    { glyph: 'り', romaji: 'ri', note: 'ri is two strokes' },
  ],
  'な': [
    { glyph: 'た', romaji: 'ta', note: 'ta has no loop' },
    { glyph: 'め', romaji: 'me', note: 'me is round' },
  ],
  'に': [
    { glyph: 'こ', romaji: 'ko', note: 'ko has no stem' },
  ],
  'ぬ': [
    { glyph: 'め', romaji: 'me', note: 'me has no loop' },
    { glyph: 'お', romaji: 'o', note: 'o is open' },
  ],
  'ね': [
    { glyph: 'れ', romaji: 're', note: 're has no loop' },
    { glyph: 'わ', romaji: 'wa', note: 'wa has no loop' },
  ],
  'の': [
    { glyph: 'そ', romaji: 'so', note: 'so is angular' },
  ],
  'は': [
    { glyph: 'ほ', romaji: 'ho', note: 'ho has two bars' },
    { glyph: 'け', romaji: 'ke', note: 'ke has no loop' },
  ],
  'ひ': [
    { glyph: 'へ', romaji: 'he', note: 'he is flat' },
  ],
  'ふ': [
    { glyph: 'を', romaji: 'wo', note: 'wo is one shape' },
  ],
  'へ': [
    { glyph: 'く', romaji: 'ku', note: 'ku is a corner' },
  ],
  'ほ': [
    { glyph: 'は', romaji: 'ha', note: 'ha has one bar' },
    { glyph: 'ま', romaji: 'ma', note: 'ma is looped' },
  ],
  'ま': [
    { glyph: 'ほ', romaji: 'ho', note: 'ho is squarer' },
    { glyph: 'も', romaji: 'mo', note: 'mo hangs down' },
  ],
  'み': [
    { glyph: 'な', romaji: 'na', note: 'na is taller' },
  ],
  'む': [
    { glyph: 'す', romaji: 'su', note: 'su has no tail' },
  ],
  'め': [
    { glyph: 'ぬ', romaji: 'nu', note: 'nu has a loop' },
    { glyph: 'な', romaji: 'na', note: 'na is taller' },
  ],
  'も': [
    { glyph: 'ま', romaji: 'ma', note: 'ma has a loop' },
    { glyph: 'し', romaji: 'shi', note: 'shi is one stroke' },
  ],
  'や': [
    { glyph: 'ち', romaji: 'chi', note: 'chi has no flick' },
  ],
  'ゆ': [
    { glyph: 'を', romaji: 'wo', note: 'wo is wider' },
  ],
  'よ': [
    { glyph: 'に', romaji: 'ni', note: 'ni is two parts' },
  ],
  'ら': [
    { glyph: 'う', romaji: 'u', note: 'u is rounder' },
    { glyph: 'ち', romaji: 'chi', note: 'chi is smoother' },
  ],
  'り': [
    { glyph: 'い', romaji: 'i', note: 'i is two short strokes' },
  ],
  'る': [
    { glyph: 'ろ', romaji: 'ro', note: 'ro has no loop' },
  ],
  'れ': [
    { glyph: 'ね', romaji: 'ne', note: 'ne has a loop' },
    { glyph: 'わ', romaji: 'wa', note: 'wa is open' },
  ],
  'ろ': [
    { glyph: 'る', romaji: 'ru', note: 'ru ends in a loop' },
  ],
  'わ': [
    { glyph: 'ね', romaji: 'ne', note: 'ne has a loop' },
    { glyph: 'れ', romaji: 're', note: 're hooks' },
  ],
  'を': [
    { glyph: 'ゆ', romaji: 'yu', note: 'yu is symmetrical' },
    { glyph: 'ふ', romaji: 'fu', note: 'fu is four strokes' },
  ],
  'ん': [
    { glyph: 'そ', romaji: 'so', note: 'so is angular' },
  ],
};

/**
 * Verdict copy for a graded trace.
 *
 * From the prototype: "Deliberately generous: a wobbly さ from a beginner should
 * pass. Nothing here ever blocks progress — 'Keep going' is always available."
 */
export const RESULTS: StrokeVerdictTable = {
  clean: {
    label: 'Clean, and in the right order',
    accent: '#1B1A17',
    copy:
      'Every stroke in the right place, the right order and the right direction. That is the motor pattern you want — it carries into every kanji later.',
  },
  loose: {
    label: 'Right order, a little loose',
    accent: '#8A6A1F',
    copy:
      'Order and direction were correct, which is the part that matters most. Proportion will tighten up on its own with repetition.',
  },
  order: {
    label: 'Shape is there, order needs work',
    accent: '#8A6A1F',
    copy:
      'Japanese builds each kana in a fixed sequence, and readers can see when it is off. Watch the dot — it marks where each stroke begins.',
  },
  guided: {
    label: 'Guided through it',
    accent: '#BC3E27',
    copy:
      'Some strokes were drawn in for you. No harm done — this one just needs a few more passes with the hint on.',
  },
  partial: {
    label: 'Stopped part-way',
    accent: '#8A6A1F',
    copy:
      'Only some of the strokes were drawn, so there is nothing to judge yet. Finish the kana to see how it went — or move on and come back to it.',
  },
};
