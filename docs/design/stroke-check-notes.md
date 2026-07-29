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

Per-stroke, one stroke at a time — the approach `hanzi-writer` established for
Chinese (MIT, ~10kb gzipped, `Make Me a Hanzi` data). Its quiz options map
almost 1:1 onto the pedagogy we want, and are worth copying by name:
`leniency`, `showHintAfterMisses` (default 3), `markStrokeCorrectAfterMisses`,
`acceptBackwardsStrokes` (default **false**).

On pointer-up the drawn polyline is resampled to 17 evenly-spaced points and
compared to the expected model stroke, resampled the same way:

- `fwd` = mean paired-point distance
- `rev` = same with the model reversed
- accept if `min(fwd, rev) ≤ TOL` (46px on a 262px square) **and not backwards**
- `rev < fwd × 0.75` ⇒ drawn **backwards**
- if a *later* model stroke scores better than the expected one by 25%+ ⇒ drawn
  **out of order**, and we can name which stroke it actually was

### Escalation ladder

| misses | behaviour |
| --- | --- |
| 1 | note explaining what was wrong |
| 2 | **progressive hint** — the next stroke only, dashed, with a dot at its start point |
| 4 | stroke is **drawn in** and the session moves on |

Nothing ever blocks. The forced-stroke count feeds the result but never stops
progress.

## Decisions

1. **Backwards strokes are rejected, not flagged.** Earlier they were accepted
   with a warning, which meant the learner never rebuilt the motor pattern —
   the entire point of writing practice. hanzi-writer defaults the same way.
2. **The hint shows one stroke, never the whole character**, and always with its
   **start dot**. Where a stroke begins is what beginners actually get wrong;
   direction follows from it.
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

**Adopted — self-grade on a close call.** Their most-praised detail: "if the app
can't detect if it's right, it gives you the model and asks you." When our
per-stroke score lands in the marginal band (`TOL` … `TOL × 1.7`) *and* order is
correct, we no longer guess or silently draw the stroke in — the attempt is
drawn in vermillion over the dashed model and the learner calls it. Honest about
recogniser limits, and self-assessment is itself a skill.

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

**Rejected — the quiz builder.** Their app offers custom quizzes, smart quizzes,
flashcards, lists, study mode, free draw, customisable tables, separate scope
editing, up to 1000 questions. The reviews show the cost: one reviewer
misconfigured a quiz so its multiple-choice options gave the answer away ("I need
to cover the screen with one hand"); another asks the app to "put together a quiz
from all of our weaknesses instead… I like cutting the extra that isn't needed."
We answer that with the scheduler, not a settings screen. **Their app opens on a
control panel; ours opens on one decision.**

### Weak spots

That reviewer's request is now a real feature, and it is *not* the due queue.
`weakItems()` ranks introduced-but-not-yet-due characters by **lapses first,
then by weakness**, capped at 6.

The pedagogical hazard is that practising early steals from the spacing effect.
So the rule, enforced in `settle()`:

> Answering before a card is due earns a smaller strength bump (0.08 vs 0.22)
> and **cannot push the next review further out**. A miss always counts in full.

So a weak-spots session can only ever *rescue* a schedule, never inflate it —
which is what makes it safe to offer on the home screen, and it is stated in the
session summary so the learner understands it too. (FSRS applies the same
principle to early reviews.)

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
