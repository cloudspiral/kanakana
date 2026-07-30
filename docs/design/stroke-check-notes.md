# Stroke check — design + implementation notes

Live in `Kanakana Prototype.dc.html` (trace step). **This is no longer a
heuristic** — it grades stroke order and direction from real data.

## Data

**KanjiVG** (Ulrich Apel, CC BY-SA 3.0) — `kanji/*.svg`, 46 hiragana copied into
this project from `KanjiVG/kanjivg@master`. One `<path>` per stroke, in writing
order, in a 109×109 viewBox. This gives shape, order, direction and stroke count
as data rather than my judgement.

Verified: KanjiVG's path count agrees with all 46 hand-entered stroke counts, so
the curriculum's `strokes` field is confirmed rather than replaced.

Two gotchas for whoever ports this:
- animCJK (a KanjiVG derivative) **splits self-overlapping kana strokes** like
  あ and ぬ into several paths. Raw KanjiVG does not — あ is 3 paths. Don't mix
  the two sources or stroke counts will drift.
- Paths must be sampled in the DOM (`getPointAtLength`) or with an SVG path
  parser; the `d` attributes are cubic béziers, not polylines.

## Algorithm

Per-stroke, one stroke at a time — adapted from the template-matching approach
`hanzi-writer` established for Chinese (MIT, ~10kb gzipped, `Make Me a Hanzi`
data). We use its leniency idea, but our guided surface deliberately keeps
ownership of correction with the learner.

On pointer-up the drawn polyline is resampled to 17 evenly-spaced points and
compared to the expected model stroke, resampled the same way:

- `fwd` = mean paired-point distance
- `rev` = same with the model reversed
- accept if `min(fwd, rev) ≤ TOL` (46px on a 262px square) **and not backwards**
- `rev < fwd × 0.75` ⇒ drawn **backwards**
- if another model stroke scores better than the expected one by 25%+ ⇒ drawn
  **out of order**, and we can name which stroke it actually was

### Guided feedback

The full faint model and numbered start points stay visible. Every non-tap
stroke is retained in ink and advances, even when it is backwards, out of
order, far from the guide, or beyond the expected stroke count. A specific note
explains the problem, but input is never rejected, deleted, recolored, or
replaced with a model stroke. Reaching the model count enables submission; it
never disables drawing. There is no miss ladder, progressive hint, or red mode.

The learner decides whether to use **Undo stroke**. Undo removes the retained
stroke and its associated order/direction warning. The whole-character grade is
computed only when the learner presses **Complete trace**, from the strokes
that remain at that moment. Corrected mistakes therefore have no effect on the
grade.

A responder cancellation is not a learner-finished stroke. Browser/OS
termination discards only the live fragment; a genuine pointer release retains
the stroke.

## Decisions

1. **Warnings are advisory.** Wrong order and backwards direction are named
   immediately during guided learning, but the stroke stays. The learner can
   undo and rebuild the motor pattern or keep going and let the final grade
   reflect it.
2. **The whole model stays visible**, with an **order number at every start
   point**. One marker communicates both where each stroke begins and when it
   is drawn; direction follows from it. A separate hint mode adds nothing.
3. **Both metrics read higher-is-better.** `Stroke accuracy` (mean per-stroke
   closeness) and `Order & direction` (1 − slips/strokes). The earlier pair
   ("shape covered" up-is-good, "ink off-shape" up-is-bad) forced the reader to
   flip mental direction between two adjacent bars.
4. **Undo is per stroke**, alongside Clear all. Losing three good strokes to fix
   the fourth was the single most irritating thing about the old surface.
5. **Reading and writing stay separate skills.** A poor writing score never
   reschedules the reading review; the profile screen shows two independent
   meters. In the app this is a second `SkillDefinition` (`kana_writing`) with
   its own `LearnerSkillState`, as `docs/ARCHITECTURE.md` anticipates.
6. **Recognition and teaching want opposite things.** Shirabe Jisho advertises
   that its recogniser "can handle wrong stroke order and small mistakes" —
   correct for a *dictionary*, wrong for a *teacher*. We deliberately notice
   what a lookup tool forgives.
7. **Reviews are exams; guided tracing is tutoring.** Guided learning may name
   a problem while leaving correction to the learner. A writing review is
   completely silent while drawing: it keeps every raw stroke without retries
   or feedback. Its explicit Check action grades the complete attempt and
   reveals all feedback at once.

## Prior art worth reading before extending this

- **hanzi-writer** (chanind, MIT) — the reference implementation of per-stroke
  quizzing; copy its option surface and its leniency tuning.
- **KanjiVG** — the stroke dataset; used by Kanji Study, WaniKani userscripts
  (via the DMAK animation library), KanjiDraw, kanji.sljfaq.org.
- **Zinnia** (Taku Kudo) — SVM recogniser returning n-best by confidence; the
  engine behind the sljfaq/jisho-era handwriting lookup and the iOS
  Zinnia-Japanese-Handwriting-Input framework. Model data from Tomoe/Tegaki.
- **"The Stroke Correspondence Problem, Revisited"** (arXiv 1909.11995) —
  finds template matching with *directional* stroke distance significantly
  outperforms Zinnia's learned approach **specifically for hiragana and
  katakana**, because kana are better separated by directional features. This
  validates the template approach here over training a classifier.
- **Hashigo** (Taele & Hammond, Texas A&M) — argues existing kanji recognisers
  "do not assess the written technique sufficiently enough to discourage
  students from developing bad learning habits", and targets instructor-level
  critique of technique, not just identity. The closest academic statement of
  what this feature is for.
- **animCJK** (parsimonhi) — stroke-order animation, and the source of the
  self-overlapping-kana warning above.

## Scheduling decisions (added after competitive review)

Reviewed **Kana — Hiragana and Katakana** (App to Learn, 12K ratings / 4.8, free,
7 years of changelog). Three things adopted, one thing deliberately not.

**Adapted — self-grade only after a writing review.** Their app asks learners to
resolve ambiguous handwriting. We keep that principle on the whole-character
review result, where the numbered model and grades make **Count it** an informed
override. Guided tracing instead accepts a marginal stroke when order and
direction are correct; learning should not stop for a self-grade dialog.

**Adopted — typo override.** Their v2.6 lets you edit a wrong result "useful if
you mistyped". A one-character slip should never tell the scheduler you have
forgotten a character. `nearMiss()` allows the override only at edit distance ≤ 1,
so it cannot become a free pass, and `settle()` snapshots prior state so the
revert is exact (strength, interval, lapses and the session outcome tallies).

**Adopted — latency as the signal after accuracy saturates.** They ship a "speed
matrix". Once a learner is at 100% on あ, accuracy carries no information and
reading *speed* is the only remaining measure of fluency — which is the actual
goal. Recall time is captured per review into a rolling `avgMs` and surfaced on
the profile as plain language ("fluent — no longer decoding it").

**Rejected — quiz builders and manual weak-spot queues.** Their app offers custom quizzes, smart quizzes,
flashcards, lists, study mode, free draw, customisable tables, separate scope
editing, up to 1000 questions. The reviews show the cost: one reviewer
misconfigured a quiz so its multiple-choice options gave the answer away ("I need
to cover the screen with one hand"); another asks the app to "put together a quiz
from all of our weaknesses instead… I like cutting the extra that isn't needed."
We answer that with the SRS queue itself, not another learner-managed queue.
**Their app opens on a control panel; ours opens on one decision.**

### Demo clock

Real intervals are hours to days, so a walkthrough cannot show a card returning.
"Skip ahead one day" in the You screen decrements every `dueIn`. It **moves the
schedule rather than shortening it**, which keeps the demo honest — the numbers
on screen are the ones the real scheduler would produce on that day. Labelled as
a demo tool, not dressed up as a feature.

### Bond states read history, not just strength

A character met six times and missed three was showing as "Newly met", because
the ladder only looked at current strength. `bondFor()` now overrides on history:
≥3 lapses ⇒ **"Your nemesis"** ("that is the system working, not you failing"),
≥2 lapses with ≥3 exposures ⇒ **"Still slippery"**.

## Still not done

- **Per-stroke *shape* critique** ("your second stroke is too short", hooks and
  stops) — Hashigo-level technique feedback. Currently a stroke is accept/reject.
- **Stroke-order animation** as a teaching demo before the first attempt; DMAK
  or animCJK do this off the same data.
- **Katakana + kanji**: copy the corresponding KanjiVG files; the engine is
  glyph-agnostic and already keys off codepoint.
- **Audio.** Still a synthesised placeholder tone. Needs a real per-kana
  recording set (one consistent voice), in Supabase storage, cached offline.
- **Confusion sets.** `CONFUSIONS` remains my own judgement. Best replacement is
  not a published list but this app's own `review_events`: which characters do
  *our* learners actually confuse? That is a better dataset than anyone
  publishes, and the schema already supports deriving it.
