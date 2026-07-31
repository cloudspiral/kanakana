# Handoff: Kanakana — Paper & Ink redesign + kana writing skill

Target repo: **cloudspiral/kanakana** (Expo / React Native / expo-router, Supabase).

## Overview

Two pieces of work, separable:

1. **A visual redesign** ("Paper & Ink") of all existing screens — warm paper, one
   vermillion accent, Instrument Serif + DM Sans, and memory strength rendered as
   *ink density* rather than bars or scores.
2. **A new `kana_writing` skill** — real stroke-order-aware handwriting practice
   on KanjiVG data, plus typo override and review latency.

(2) is the substantial engineering. It slots into the existing
`SkillDefinition` / `LearnerSkillState` extension point that
`docs/ARCHITECTURE.md` already anticipates, so it should not require a
re-architecture.

## About the design files

`prototypes/*.dc.html` are **design references written as browser HTML** — they
show intended look and behaviour. They are **not production code to copy**. They
use a small custom runtime (`support.js`) and inline styles only; there is no
build step and no React Native in them.

The task is to **recreate these designs in the existing Expo / React Native app**,
using its established patterns: the components in `src/components/`
(`AppScreen`, `Surface`, `Buttons`, `Typography`, `BottomNav`), the tokens in
`src/constants/theme.ts`, and expo-router routes in `src/app/`.

The **algorithms**, however, *are* meant to be ported closely — the stroke
matching, the scheduling rules and the thresholds in
`Kanakana Prototype.dc.html`'s logic class are the deliverable, and the values
were tuned against real drawing input. See `stroke-check-notes.md`, which is the
design rationale document and should be read first.

## Fidelity

**High-fidelity.** Final colours, type, spacing and copy. Every value below is
lifted from the prototype. Recreate pixel-faithfully using RN equivalents
(`StyleSheet`, `react-native-svg`, `Pressable`).

Two caveats:
- The prototype is sized to a 390×844 iPhone viewport with a 262px drawing
  square. Scale the square proportionally to available width; **the stroke
  tolerance constants are in canvas px and must be scaled with it** (see below).
- `Kanakana Redesign.dc.html` contains three explored directions (`1a`, `1b`,
  `1c`). **Only `1a` Paper & Ink was chosen.** `1b`/`1c` are included for context
  only — do not build them. `Kanakana Current Build.dc.html` is a recreation of
  today's shipped UI, included as the before-state.

---

## Design tokens

Replace the contents of `src/constants/theme.ts` with these.

### Colour

| Token | Hex | Use |
| --- | --- | --- |
| `paper` | `#F4F1EA` | screen background |
| `card` | `#FDFCF8` | raised surfaces, the drawing square |
| `ink` | `#1B1A17` | primary text, primary button fill, drawn strokes |
| `inkMuted` | `#6E675A` | **all** secondary text and labels |
| `accent` | `#BC3E27` | vermillion: kickers, rings, hint stroke, logo tile |
| `accentSoft` | `#FBEFEB` | accent-tinted fill |
| `peach` | `#E4A08F` | arrow glyph — **only** on `ink` fill |
| `rule` | `#E0DACB` | dividers, secondary borders |
| `ruleSoft` | `#F0EBDE` | inner dividers on cards |
| `fieldBorder` | `#DCD5C4` | pill/control borders |
| `wellFill` | `#EFEADD` | progress-bar troughs, muted control fill |
| `guide` | `#EDE6D6` | genkō-yōshi guide lines |
| `caution` | `#8A6A1F` | "loose" / "partial" verdicts |
| `device` | `#14120E` | phone bezel (prototype only) |

**Contrast rules — these were violated three times during design, so enforce them:**
- `inkMuted` `#6E675A` is the **only** muted text colour. Do not introduce a
  lighter grey for disabled states.
- **Disabled controls do not invert.** A disabled button is `wellFill` background
  + `fieldBorder` border + `inkMuted` label — never light text on a mid-tone fill.
  Vary the border between states, not the label colour.
- `accent` at `#BC3E27` clears AA both as text on `paper` (4.83:1) and as a fill
  under `paper`-coloured text (4.83:1). Do not lighten it.

### Type

Instrument Serif (400 only) for headings and numerals; DM Sans (400/500/700) for
UI; Noto Sans JP (200/300) for kana glyphs.

| Role | Spec |
| --- | --- |
| Display | `400 44px/1.05 Instrument Serif`, `text-wrap: pretty` |
| Screen title | `400 34–38px/1.1 Instrument Serif` |
| Section title | `400 19–20px Instrument Serif` |
| Kicker | `500 10px DM Sans`, `letter-spacing .18em`, uppercase, `accent` |
| Nav label | `500 11px DM Sans`, `letter-spacing .14em`, uppercase |
| Meter label | `500 10px DM Sans`, `letter-spacing .14em`, uppercase, `inkMuted` |
| Body | `400 15px/1.55 DM Sans` |
| Body small | `400 12.5–13px/1.5 DM Sans`, `inkMuted` |
| Button | `500 15px DM Sans` |
| Glyph, hero | `200 168px/1 Noto Sans JP` |
| Glyph, tracing model | `200 200px/1 Noto Sans JP` |
| Glyph, grid cell | `300 25px Noto Sans JP` |
| Glyph, inline | `300 17–30px Noto Sans JP` |

### Geometry

Radius: **`5px` for every rectangle** (cards, buttons, the drawing square),
`3–4px` for small tiles, `999px` for pills only. This is a deliberately flat,
paper-like system — do **not** reintroduce the current build's 18/24px radii.

Spacing: `26px` screen gutter, `16–18px` card padding, `12px` between stacked
cards, `20–22px` between sections. Borders are `1px` (`rule`) or `1px` `ink` for
the emphasised primary card. **No shadows anywhere** — separation is by border
and paper tone only.

Bottom nav: three text-only tabs (`REVIEW` / `KANA` / `SETTINGS`), active marked by a
`16×2px` `accent` underline. Min 44px touch targets throughout.

---

## Screens

Route names below map to existing files in `src/app/`.

### 1. Onboarding, page 1 — `app/index.tsx` (unauthenticated state)

Wordmark row (30px `ink` tile with か in `card`, then "Kanakana" at 22px
Instrument Serif) + a 2-step progress indicator (18×2px `accent`, 8×2px `rule`).

Centre: a 290px-tall `card` square with `1px ink` border, genkō-yōshi cross-hair
guides in `guide`, あ at 168px centred, small faint か / ら at 44px in the top-left
and bottom-right corners at 14% opacity, and a flush-corner `accent` chip reading
"a".

Then display heading "Meet the kana" followed by the introductory body copy.
There is no kicker above the heading.
Page one uses a 190px-tall full-width hero banner, a 16px vertical section gap,
and 16px bottom padding. The longer welcome copy scrolls on shorter screens
rather than shrinking its body type or CTA touch target. Its body is top-aligned
so tall copy cannot center itself upward over the wordmark.

Primary CTA: full-width `ink` fill, "See how it works" + peach `→`.

### 2. Onboarding, page 2

Kicker "THREE MOVES, OVER AND OVER"; heading "Meet it, draw it, recall it."

Three rows, each a `card` with a 44px tile. **The middle row (Draw it once) is
emphasised** with a `1px ink` border, `accentSoft` tile and a 14px `accent` dot —
this is the differentiator and the layout should say so. Copy:
- Meet the shape — "See it large, hear the sound once."
- Draw it once — "Tracing the strokes is what makes the shape stop looking like a squiggle."
- Recall it later — "Misses come back after a little space — never as a penalty."

Then the five vowels in a row (32px glyphs + romaji), then "Begin with the five
vowels" (primary).

### 3. Home / Review — `app/index.tsx`

Wordmark + a right-aligned chip: `TUE · {n} REVIEWS` (singular when needed) or
`TUE · ALL CLEAR`.

Kicker "REVIEW", then a display heading that states the situation directly:
*"{n} reviews are ready."* / *"You're all caught up for today."* /
*"Every kana is in your ink."* A reading and writing prompt for the same kana
count as two reviews because they are independently scheduled skills.

When Review is clear but another curriculum row remains, the primary card stays
available as an optional **STUDY AHEAD** path to meet that next row. The daily
stopping point remains the prominent message; no extra queue is implied.

**Primary card** (`1px ink`): a left column with kicker + 25px serif title
("{n} reviews, about {m} minutes"), a right 90px column showing up to 4 due
glyphs in a 2×2 grid at their current ink opacity, and a full-width `ink` footer
button.

There is no secondary queue builder on Review. The SRS card owns the next
scheduled action; optional drawing of one specific kana lives on its profile.

**Your ink strip**: all 46 glyphs in a 10-column grid at 17px, each at its own
ink opacity; caption "{n} of 46 · fainter is newer".

### 4. Practice — Meet

Header: `×` + a segment bar (one 3px segment per session step; past `ink`,
current `accent`, future `#DDD6C6`).

Kicker "NEW CHARACTER"; the 262px guide square with the glyph at 168px and a
flush-corner `ink` chip showing the romaji in Instrument Serif; two pills ("Hear
it" with a 3-bar icon, and "{n} strokes"); a centred stroke note (see
`MEET_HINTS`); primary CTA "Now draw it".

### 5. Practice — Trace  ← the core new screen

Kicker "TRACE IT" + right-aligned "Stroke {i} of {n}" while below the guide
count. At or above it, show "{drawn} drawn · {n} in guide" (or "Loading
strokes…" while unavailable).

The 262px square contains, in z-order: guide lines; the whole-character model
at 10% `ink`; numbered start markers; the learner's ink; and a flush-corner
`ink` romaji chip.

Canvas rendering:
- retained strokes: `ink`, `lineWidth 12`, round cap/join
- the live stroke: same
- the model: 10% `ink`, `lineWidth 12`, with its order number at each start point

Controls row (pills): **Undo stroke** / **Clear all**.

Every real stroke stays on the canvas and advances the learner, including
strokes beyond the model's expected count. A wrong order, direction, shape, or
extra stroke produces only an advisory note. It never rejects, deletes,
recolors, or replaces their ink. **Undo stroke** removes both that ink and its
eventual order/direction penalty. Reaching the expected count enables
**Complete trace** but never disables drawing. The whole-character result is
calculated only when the learner presses it.

**While the model is loading**, the canvas and controls drop to 40%/45% opacity
and pointer input is rejected — do not let the square look drawable before it is.
Only a genuine pointer release commits a stroke. If the responder is cancelled
by the browser or OS, discard the live fragment instead of grading it as a
finished stroke.

### 6. Practice — Recall

Kicker; the 262px square with the glyph and a corner "HEAR IT" button; a text
input styled as a serif-on-a-rule field (30px Instrument Serif, `2px` bottom
border that darkens on input); helper "Romaji · shi, chi, tsu and fu accept
either spelling"; "Check" (muted until non-empty) and a "Show me the answer"
link.

### 7. Practice — Write review

The sound is shown while the answer stays hidden. The learner may undo and
clear freely; reaching the expected stroke count does **not** submit anything.
Every raw stroke stays on the page: there are no retries, direction/order
corrections, warnings, or grading while drawing. **Check** is the only grading
action, matching the reading review.

After Check, reveal the numbered model behind the learner's ink, show the two
result meters, and state **YES** or **NOT YET**. The left button overrides the
verdict; the right **Continue** button accepts it. Continue records the result
and advances directly.

### 8. Reading feedback overlay

Full-bleed `paper`. Kicker ("YES" / "NOT YET" / "HERE IT IS"), a 262px square
bordered `1.5px` in `ink` or `accent` with the glyph + romaji, one line of copy,
and — on a correct answer — a small centred "read in 1.4s".

On a miss: optional **"I typed it wrong — I knew this ↺"** row (see below),
then a "Keep going" link. Writing reviews do not enter this overlay because
their Check screen already communicated the result.

### 9. Session summary

A 60px `card` tick tile; serif title varying by session kind ("Reviews done" /
"Ink on paper" / "A new row is underway"); explanatory
copy; a `card` list of only the non-zero outcome rows (introduced /
strengthened / returning soon / shapes drawn) with serif numerals; "Keep going"
+ "Back to today".

Completing the final practice step navigates directly here. Do not insert a
separate "This practice is complete / See summary" handoff screen.

### 10. Ink map — `app/progress.tsx`

Kicker "YOUR INK", title "{n} of 46 characters", body *"These forty-six will
carry every Japanese word you ever read. Tap one to see where you two stand."*

**Legend (required):** faint あ "new" · dark あ "known" · `accent` ring "back
today".

Then the gojūon grid in a `1px ink` card: A/I/U/E/O column heads, row labels in
`inkMuted`, 43px rows, each cell a 25px glyph at its ink opacity with an optional
36px `accent` ring. Empty positions render nothing. Every cell is tappable.

### 11. Character profile  ← new screen (was a bottom sheet)

Full screen, scrollable, with a pinned footer.

Back row ("← Your ink") + "K ROW · 7 OF 46".

Header: a 132px guide square with the glyph at 88px and a romaji chip, beside the
**bond state** (kicker) + a serif line + provenance ("First met in the K lesson ·
four strokes").

Metric card: **Reading it** and **Writing it** as two independent meters (`ink`
and `accent` fills) — the app explicitly admits you can read ら long before you
can write it. Each started skill carries its own device-local scheduled date
(`NEXT REVIEW · TUE, AUG 4`, or `DUE · THU, JUL 23` for overdue work) directly
beneath its meter. Unstarted skills omit the date. Two serif figures show times
seen and times drawn.

"The shape" — the stroke note. **"Where you'll meet it"** — 2 real words with the
target character picked out in `accent` (あ**め** rain, **あ**さ morning); this is
the "these carry you for the rest of your Japanese" argument made concrete.
**"Easy to mix up with"** — tappable neighbour chips that navigate to that
character's profile.

Pinned footer: a 58px sound button + "Draw {glyph} →".

### 11. Settings — `app/settings.tsx`

Toggles for **Play sounds** and **Haptic feedback** (44×26px, `ink` when on); a
"How this works" card; reset progress; pronunciation attribution; footer
"Kanakana · hiragana · katakana coming".

Tracing guidance is not configurable. Learning and free practice always show
the model and genkō-yōshi guides; writing reviews hide the answer until Check,
then reveal the numbered model for comparison.

---

## The `kana_writing` skill

### Data — KanjiVG

`prototypes/kanji/*.svg`, 46 files, from `KanjiVG/kanjivg@master`.
**Ulrich Apel, CC BY-SA 3.0 — attribution is required in any shipped build.**

One `<path>` per stroke, in writing order, 109×109 viewBox. Parse in document
order; `path[i]` is stroke `i+1`.

Verified: KanjiVG's path count agrees with all 46 stroke counts already in
`src/domain/curriculum.ts`. No curriculum change needed.

**Do not substitute animCJK** — it splits self-overlapping kana (あ, ぬ) into
extra paths, so stroke counts drift.

In React Native, `getPointAtLength` is unavailable. Either pre-bake the sampled
polylines into JSON at build time (recommended — it removes the runtime parse and
the fetch) or use `react-native-svg`'s path measurement.

### Matching

Resample the drawn polyline to **17 evenly-spaced points** (arc-length
parameterised, not index-parameterised) and compare against the expected model
stroke resampled the same way:

```
fwd = mean euclidean distance over paired points
rev = same, with the model reversed
best = min(fwd, rev)
```

- **accept** if `best ≤ TOL` **and not backwards**
- **backwards** if `rev < fwd × 0.75`
- **out of order** if another model stroke scores better than the expected one
  by ≥25% — and then name which stroke it actually was

`TOL = 46px on a 262px square` ≈ **17.5% of the square's edge**. Scale it with
the rendered square; do not hard-code 46.

### Guided feedback

Marginal strokes in the correct order and direction advance silently with
guided leniency (`TOL×1.7`). Other non-tap strokes also remain and advance, even
after the model's expected count, but show a note naming a wrong order,
backwards direction, distant shape, or extra stroke.
Feedback is advisory: there is no miss counter, red mode, progressive hint,
automatic deletion, or forced model stroke. The numbered model is already
visible, and the learner chooses whether to undo and redraw.

The whole-character grade uses only the strokes still on the canvas. Retaining
an order/direction warning lowers that metric; undoing the stroke removes both
its ink and its penalty. Shape quality is calculated from the retained strokes
at **Complete trace**, never from mistakes the learner corrected first.

Writing reviews do not run the per-stroke judge at all. They keep every raw
stroke and let the whole-character **Check** calculate shape, order, and
direction for the single decision screen; drawing a stroke never submits or
gives feedback. The review result is the only surface that offers **Count it**.

`finalScore()` divides by `max(gradedStrokes, model.length)`, so undrawn strokes
score zero and an incomplete character cannot report as clean.

### Result metrics

Two, and **both must read higher-is-better**: `Stroke accuracy` (mean per-stroke
closeness over the whole character) and `Order & direction`
(`1 − slips / expected strokes`). An earlier pairing mixed directions between
adjacent bars and was unreadable.

Verdicts: `clean` / `loose` / `order` / `partial` — copy in
`RESULTS` in the prototype.

---

## Scheduler changes

### Early reviews

Review is one device-local daily queue. Starting it captures every independently
scheduled reading and writing target due before the next local midnight. A
successful answer from that queue is treated as scheduled work and cannot remain
due during the same local day; misses return through the active session's recheck
steps instead of opening a second queue.

Outside that daily queue, the early-practice rule still applies:

> Answering a card **before it is due** earns a smaller strength bump
> (**+0.08** vs +0.22) and **cannot push the next review further out**.
> A miss always counts in full.

This keeps optional practice from inflating the schedule. It does not create a
learner-selectable early-review queue.

### Typo override

A one-character slip must not tell the scheduler the learner has forgotten a
character. `settle()` snapshots prior state (`strength`, `dueIn`, `lapses`, and
the session outcome tallies) so a revert is exact. Offer the override **only when
the answer was within edit distance 1** of the target — otherwise it becomes a
free pass. Do not offer it after "Show me the answer".

### Latency

Start a timer when the recall input mounts; on check, record ms into a rolling
average (`avgMs = 0.6 × prev + 0.4 × new`). Once accuracy saturates, latency is
the only remaining measure of fluency — which is the real goal for kana. Surface
as language, not milliseconds: `<1.3s` "fluent — no longer decoding it",
`<2.2s` "quick, with a small pause", else "still working it out".

### Bond states must read history

Strength alone described a character seen 6 times and missed 3 as "Newly met".
Override on history **before** consulting the strength ladder:
- `lapses ≥ 3` → **"Your nemesis"** — *"Missed 3 times. It will keep coming back
  until it sticks — that is the system working, not you failing."*
- `lapses ≥ 2` and `seen ≥ 3` → **"Still slippery"**
- otherwise the ladder: Newly met → Getting acquainted → On familiar terms → Old friend

### Demo clock

"Skip ahead one day" decrements every `dueIn`. It **moves** the schedule rather
than shortening it, so on-screen numbers are exactly what the real scheduler
would produce on that day. Keep it clearly labelled as a demo tool and gate it
out of production builds.

---

## State

Per `item × skill` (this is the existing `LearnerSkillState`, extended):

```
strength   float 0–1
dueIn      int, days (prototype); a timestamp in production
lapses     int      — drives weakness ranking and bond state
seen       int
drawn      int
avgMs      int      — rolling recall latency
```

Session-local: `steps[]`, `index`, `answer`, `feedback`, `done[]` (retained
strokes with any order/direction warning attached), `note`, `traceResult`,
`outcomes`.

**Architectural note learned the hard way:** route *every* step change through a
single `advance(overrideSteps?)` that owns both the model load and all
per-stroke resets. A second code path that duplicated the index bump silently
graded one character's strokes against another character's model. `advance` takes
an override step list precisely so the "insert a repair trace" flow does not need
its own copy.

Grading stays **client-side** (it is UX only); only the resulting
`kana_writing` review event goes through `submit-reviews`, so the trust boundary
is unchanged.

---

## Assets

- **KanjiVG** stroke data — 71 SVGs in `assets/kanjivg/`: 46 base and 25 voiced
  forms. CC BY-SA 3.0, Ulrich Apel. Attribution required.
- **Fonts** — Instrument Serif, DM Sans, Noto Sans JP. All SIL Open Font
  License; load via `expo-font`.
- **No images or icons.** Every icon in the design is drawn from styled views
  (the 3-bar sound icon is three rounded rects; arrows and `×` are text glyphs).
- **Audio** — the bundled kana recordings are by Kaori sensei and remain
  credited in the app under the permission terms recorded in
  `assets/audio/kana/ATTRIBUTION.md`.
- **`CONFUSIONS` is my judgement, not sourced data.** The best replacement is
  this app's own `review_events` — which characters do *our* learners actually
  confuse? Better than any published list, and the schema already supports
  deriving it.

## Files

- `prototypes/Kanakana Prototype.dc.html` — **the build target.** All 11 screens,
  the working stroke engine, the scheduler. Read its logic class for exact
  thresholds.
- `prototypes/Kanakana Current Build.dc.html` — today's shipped UI, for before/after.
- `prototypes/Kanakana Redesign.dc.html` — three explored directions; **only `1a`
  was chosen.**
- `prototypes/kanji/*.svg` — KanjiVG stroke data.
- `prototypes/support.js` — the prototype runtime. **Not for production**; it
  exists only so the HTML opens in a browser.
- `stroke-check-notes.md` — design rationale, prior art (hanzi-writer, Zinnia,
  KanjiVG, Hashigo, arXiv 1909.11995), competitive analysis, and what is
  deliberately *not* built. **Read this first.**

## Suggested order

1. Tokens + `Typography`/`Surface`/`Buttons`/`BottomNav` restyle (unblocks everything).
2. Home, Ink map, Settings — the flat-radius, no-shadow system on known screens.
3. The character profile screen (new route).
4. Pre-bake KanjiVG polylines to JSON; build the trace canvas and matcher; unit-test
   accept / backwards / out-of-order / marginal against fixture polylines.
5. `kana_writing` as a `SkillDefinition`; wire the trace step into sessions.
6. Scheduler: early-review rule, typo override, latency.
