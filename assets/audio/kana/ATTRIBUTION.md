# Kana pronunciation clips — attribution

Recorded by **Kaori sensei**, a Japanese teacher based in Kamakura, and
published at <https://linkupnippon.com/table-of-hiragana/>.

## Terms

She granted reuse in apps in that page's comments. Asked directly about a
Japanese-learning app with a free and a paid tier, she replied:

> It is okay that you use my mp3 Hiragana sound. It is license free. I am happy
> if you share the link and your support!

and, to a second person asking about a website with credit:

> Sure, feel free to use it. Glad to collaborate with you. Thank you also for
> your credit.

**What we owe her: a visible credit and a link back to linkupnippon.com.** That
is the condition she asked for, twice. Any screen or about-page that surfaces
these recordings should carry it.

Two caveats worth knowing before release:

- The grant is a blog comment, not a licence file, and the site footer still
  asserts blanket copyright over its content. The wording "It is license free"
  reads generally, but it was written to individual askers.
- **Before launch, email her for written confirmation covering this app by
  name.** Cheap to do, and it turns an informal grant into a record.

## What is here

104 clips: 46 gojūon, 25 dakuten/handakuten, 33 yōon. Mono 24 kHz AAC at
40 kbps, each individually trimmed and loudness-normalised to −16 LUFS,
0.42–0.81 s, 524 KB for the set.

The source is three combined MP3 tracks — one per chart — which
`scripts/build-kana-audio.py` splits, verifies, levels and encodes. Do not edit
these files by hand; re-run the script instead.

The upstream Yōon track contains ~440 ms of steady hiss between きゃ and きゅ.
The build script gates it out; anyone else splitting these tracks naively will
ship it.
