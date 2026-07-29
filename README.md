# Kanakana

Kanakana is a beginner-focused hiragana-reading app built for the Nerdy / Varsity Tutors language-learning prompt. It teaches the 46 basic modern hiragana through short, cumulative introductions and independently schedules every learner’s `learning item × skill` state with FSRS.

V1 implements one skill: `kana_reading` — see a glyph and type its romaji. The architecture intentionally leaves audio, handwriting, games, katakana, kanji, and vocabulary as future teaching modules or skill definitions rather than hard-coding them into “cards.”

## Product flow

1. Two-screen beginner onboarding explains the promise and starts immediately with vowels.
2. A lesson introduces a small subset, checks recall, adds more kana, then mixes prior items.
3. Incorrect answers and **Show answer** return after intervening prompts until recalled correctly.
4. Future due reviews mix rows and schedule each kana independently.
5. The session summary reports introduced, strengthened, and returning-soon items—without scores or streaks.
6. Home always offers one primary **Continue** action: due reviews first, then the next row.

## Run locally

Requirements: Node 22.13+ and Expo Go for physical-device testing. Xcode is not required.

```bash
npm install
cp .env.example .env.local
npm start
```

Scan the Expo QR code with Expo Go, or press `w` for the web app.

Production-style web:

```bash
npm run export:web
npm run serve:web
```

Open `http://127.0.0.1:8081`. The local server supports direct reloads of Expo Router paths such as `/practice`.

## Local Supabase

Docker must be running.

```bash
npx supabase start
npm run smoke:supabase
```

Use the local API URL and publishable key printed by `npx supabase status` in `.env.local`. Never place the service-role key in an Expo environment variable.

The smoke verifies anonymous auth, the 46-item published manifest, one accepted review, idempotent replay, RLS isolation between two guests, and that raw typed input is not retained.

## Quality gates

```bash
npm run typecheck
npm run lint
npm test
npm run check:edge
npm run export:web
```

## Hosted Supabase setup

1. Create a dedicated Supabase project and enable anonymous sign-ins.
2. Authenticate and link the local repository:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

3. Deploy schema, curriculum, and function:

   ```bash
   npx supabase db push
   npx supabase functions deploy submit-reviews
   ```

4. Put only the project URL and publishable key in `.env.local`.
5. Run `npm run smoke:supabase` with `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` set to the hosted project values.

## Demo tools

Set `EXPO_PUBLIC_DEMO_TOOLS=true` before bundling, then long-press the Kanakana wordmark.

- **Fresh guest** clears local learning data, signs out, and creates a new anonymous identity.
- **Seed returning learner** creates a new guest, generates deterministic historical review behavior, and syncs mixed mastery/due states.
- **Sync now** flushes the outbox and reports accepted/pending counts.
- **Diagnostics** exposes guest ID, manifest, storage adapter, outbox size, last sync, and cloud status.

Unset the flag for the ordinary learner build.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for data flow, trust boundaries, module rendering, and future kanji compatibility. See [docs/DEMO.md](docs/DEMO.md) for the in-person rehearsal.

## Design

The "Paper & Ink" visual system and the `kana_writing` skill are specified in [docs/design/README.md](docs/design/README.md), with rationale in [docs/design/stroke-check-notes.md](docs/design/stroke-check-notes.md). Tokens live in [src/constants/theme.ts](src/constants/theme.ts) — the palette is deliberately small, there are no shadows, and every rectangle is 5px.

The kana faces are subset from Noto Sans JP to the kana ranges, because the full faces are 5.2 MB each:

```bash
npm run fonts:subset
```

## Credits

- **KanjiVG** stroke-order data (`assets/kanjivg/`) — © Ulrich Apel, released under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Used unmodified as the source for stroke paths.
- **Instrument Serif**, **DM Sans**, and **Noto Sans JP** — SIL Open Font License 1.1.

## Current verification

- Expo SDK 54 / React Native 0.81 / Expo Router
- Native SQLite and browser `localStorage` behind one repository contract
- FSRS v6 scheduling through `ts-fsrs`
- Local-first outbox with server-canonical reconciliation
- Supabase migrations apply cleanly from an empty local database
- Deno Edge Function type-checks
- Unit, type, lint, production web export, mobile-width browser flow, deep-link reload, and local Supabase smoke pass
- iOS Expo Go and hosted Supabase/EAS remain the authenticated release steps
