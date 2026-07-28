# Thursday demo rehearsal

## Device setup

- MacBook charged, local production web server ready.
- iPhone charged with current Expo Go installed.
- Hosted Supabase URL and publishable key configured.
- Demo build exported with `EXPO_PUBLIC_DEMO_TOOLS=true`.
- One successful browser tab kept open as backup.

## Primary 4-minute path

1. **Fresh onboarding**
   - Long-press the wordmark → **Fresh guest**.
   - Show the two-screen value proposition.
   - Emphasize that onboarding asks nothing it does not need.

2. **Progressive first lesson**
   - Begin vowels.
   - Introduce `あ` and `い`.
   - Intentionally miss `あ`.
   - Correctly enter `i` with spaces/capitalization.
   - Point out that `あ` returns only after intervening prompts.

3. **Outcome summary**
   - Complete the row.
   - Show introduced, strengthened, and returning soon.
   - Choose **Keep going** to prove the first daily batch is a recommendation, not a gate.

4. **Returning learner**
   - Long-press wordmark → **Seed returning learner**.
   - Home shows due work before the next row.
   - Progress shows mixed Not started, Learning, Strong, and Due states.
   - Diagnostics shows zero pending events and cloud synced.

## Architecture explanation

“Rows organize first exposure, but they disappear as a scheduling constraint after that. The durable learning key is user, item, and skill. Every answer saves locally before the UI advances, so a subway tunnel does not interrupt learning. The server later re-grades the answer and applies the canonical FSRS transition through an idempotent transaction.”

## Visible acceptance checks

- Return submits the answer.
- Wrong answer says it will return later and actually does.
- Correct answer advances automatically.
- Reload `/practice` and resume the same session.
- Disable the network, answer, and show pending outbox count.
- Reconnect, **Sync now**, and show pending zero.

## Backup path

If Expo Go or venue Wi-Fi is unreliable, use the same production web build in an iPhone-sized browser window. The core flow and Supabase sync are identical.
