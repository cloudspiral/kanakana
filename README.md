# Kanakana

Japanese is one of the most popular languages being learned by foreigners today,
and that journey begins at the same basic step for everyone: the kana. Instead
of an alphabet, Japanese has a syllabary, a group of sounds that you must become
deeply acquainted with and will form the basis of all further learning you do in
the language.

There are many different online and offline resources for learning the kana
today, but there are none that have the right combination of writing practice,
native voice samples, SRS scheduling, and elegant, simple user flow. I built
Kanakana to meet this need and be the kana-learning app I would've wanted back
when I first learned it instead of just watching YouTube videos and practicing
with sheets of paper.

Kanakana has a very simple onboarding process and is designed to be welcoming to
brand new users, but still rigorous enough that they master
the kana as much as they would with any other method.

It teaches the 46 basic modern hiragana plus 25 dakuten/handakuten forms through
short, cumulative introductions. The 71 items have independent reading and
writing schedules, while the familiar gojūon grid remains 46 base cells.

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

## Production web

The stable hiring-partner URL is [kanakana.expo.app](https://kanakana.expo.app).
Automatic production deployment is defined in `.eas/workflows/deploy-web.yml`
and uses the EAS `production` environment. Once the GitHub repository is
connected in the EAS project settings, pushes to `main` deploy the latest web
export to that same URL.

For a manual production deployment:

```bash
npx eas-cli@latest workflow:run .eas/workflows/deploy-web.yml
```

## Local Supabase

Docker must be running.

```bash
npx supabase start
npm run smoke:supabase
```

Use the local API URL and publishable key printed by `npx supabase status` in `.env.local`. Never place the service-role key in an Expo environment variable.

The smoke verifies anonymous auth, the 71-item/16-unit v3 manifest, review and
drawing idempotency, schedule-neutral free practice, RLS isolation between two
guests, and that neither typed answers nor raw drawing geometry are retained.

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

3. Deploy schema, curriculum, and functions in this order:

   ```bash
   npx supabase db push
   npx supabase functions deploy submit-reviews
   npx supabase functions deploy submit-drawings
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
- **Pronunciation recordings** (`assets/audio/kana/`) — recorded by Kaori sensei and published at [linkupnippon.com](https://linkupnippon.com/table-of-hiragana/). Used with her permission, whose condition is a visible credit and a link back; the app carries both on the You screen. See [assets/audio/kana/ATTRIBUTION.md](assets/audio/kana/ATTRIBUTION.md).
- **Instrument Serif**, **DM Sans**, and **Noto Sans JP** — SIL Open Font License 1.1.
