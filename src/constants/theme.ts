/**
 * "Paper & Ink" design tokens.
 *
 * Source of truth: docs/design/README.md (token table) and the values inlined in
 * docs/design/prototypes/Kanakana Prototype.dc.html. Prefer those documents over
 * inventing new values — the palette is deliberately small.
 */

export const Colors = {
  /** Screen background. */
  paper: '#F4F1EA',
  /** Raised surfaces and the drawing square. */
  card: '#FDFCF8',
  /** Primary text, primary button fill, drawn strokes. */
  ink: '#1B1A17',
  /** Pressed state for an `ink` fill. */
  inkPressed: '#2C2A24',
  /** The ONLY muted text colour. Do not add a lighter grey for disabled states. */
  inkMuted: '#6E675A',
  /** Vermillion: kickers, rings, hint stroke, logo tile. Clears AA at 4.83:1 — do not lighten. */
  accent: '#BC3E27',
  /** Accent-tinted fill. */
  accentSoft: '#FBEFEB',
  /** Arrow glyph — only ever on an `ink` fill. */
  peach: '#E4A08F',
  /** Dividers and secondary borders. */
  rule: '#E0DACB',
  /** Inner dividers on cards. */
  ruleSoft: '#F0EBDE',
  /** Pill and control borders; also the disabled-control border. */
  fieldBorder: '#DCD5C4',
  /** Progress troughs, muted control fill; also the disabled-control fill. */
  wellFill: '#EFEADD',
  /** Genkō-yōshi guide lines. */
  guide: '#EDE6D6',
  /** "Loose" / "partial" verdicts. */
  caution: '#8A6A1F',

  // Not in the README token table; taken from the prototype markup.
  /** Underline beneath a quiet text link. */
  linkUnderline: '#C9C1AE',
  /** The recall field's bottom rule before anything is typed. */
  fieldRule: '#D8D1C0',
  /** Future segments in the practice progress bar. */
  segmentFuture: '#DDD6C6',
} as const;

export const Fonts = {
  /** Headings and numerals. 400 is the only weight Instrument Serif ships. */
  serif: 'InstrumentSerif_400Regular',
  sans: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansBold: 'DMSans_700Bold',
  /** Kana glyphs. Subset to the kana ranges — see scripts/subset-kana-fonts.sh. */
  kanaThin: 'NotoSansJP_200ExtraLight',
  kanaLight: 'NotoSansJP_300Light',
} as const;

/**
 * Type roles from the design's type table. Sizes given as a range there are
 * pinned to a single value here; deviate only with a reason.
 */
export const Type = {
  display: { fontFamily: Fonts.serif, fontSize: 44, lineHeight: 46 },
  screenTitle: { fontFamily: Fonts.serif, fontSize: 36, lineHeight: 40 },
  sectionTitle: { fontFamily: Fonts.serif, fontSize: 20, lineHeight: 25 },
  kicker: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: Colors.accent,
  },
  navLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
  },
  meterLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: Colors.inkMuted,
  },
  body: { fontFamily: Fonts.sans, fontSize: 15, lineHeight: 23 },
  bodySmall: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 20, color: Colors.inkMuted },
  button: { fontFamily: Fonts.sansMedium, fontSize: 15 },
} as const;

/** Kana glyph sizes. The design uses weight to carry hierarchy, not just size. */
export const Glyph = {
  hero: { fontFamily: Fonts.kanaThin, fontSize: 168, lineHeight: 168 },
  tracingModel: { fontFamily: Fonts.kanaThin, fontSize: 200, lineHeight: 200 },
  gridCell: { fontFamily: Fonts.kanaLight, fontSize: 25, lineHeight: 30 },
  inline: { fontFamily: Fonts.kanaLight, fontSize: 17, lineHeight: 22 },
} as const;

export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 32,
  xxl: 48,
  /** Screen gutter. */
  gutter: 26,
  /** Padding inside a card. */
  card: 18,
  /** Gap between stacked cards. */
  stack: 12,
  /** Gap between sections. */
  section: 22,
} as const;

/**
 * Deliberately flat and paper-like. Every rectangle is 5px — do not reintroduce
 * the previous build's 18/24px radii.
 */
export const Radius = {
  /** Cards, buttons, the drawing square. */
  rect: 5,
  /** Small tiles. */
  tile: 4,
  small: 3,
  /** Pills only. */
  pill: 999,
} as const;

/** Minimum touch target, per the design's accessibility note. */
export const MinTouch = 44;

export const MaxContentWidth = 620;

/**
 * There are no shadows in this system. Separation comes from borders and paper
 * tone only. `Shadow` is intentionally absent — do not add it back.
 */
