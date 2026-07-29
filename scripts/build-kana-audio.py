#!/usr/bin/env python3
"""Rebuild `assets/audio/kana/` and `src/services/kanaAudioAssets.ts` from source.

Source: three combined MP3 tracks recorded by Kaori sensei, a Japanese teacher
in Kamakura, published at https://linkupnippon.com/table-of-hiragana/. She
granted reuse in apps in that page's comments — "It is okay that you use my mp3
Hiragana sound. It is license free. I am happy if you share the link and your
support!" — so credit and a link back are the terms. See ATTRIBUTION.md beside
the clips.

Each track holds one mora per utterance in standard chart order, separated by
silence. This splits them into 104 individual clips (46 gojuon + 25
dakuten/handakuten + 33 youon), levels each to -16 LUFS and encodes mono 24 kHz
AAC, then writes the glyph-keyed require() map the audio service imports.

The tracks are re-downloaded to a temp directory on each run; nothing outside
assets/ and src/services/ is written.

Requires ffmpeg/ffprobe on PATH.  Run:  python3 scripts/build-kana-audio.py
"""

import array
import math
import os
import statistics
import subprocess
import sys
import tempfile
import urllib.request

BASE = "https://linkupnippon.com/wp-content/uploads/2021/10"
UA = {"User-Agent": "kanakana-asset-build/1.0"}

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO_DIR = os.path.join(REPO, "assets", "audio", "kana")
MAP_FILE = os.path.join(REPO, "src", "services", "kanaAudioAssets.ts")

# (track, [(hiragana, romaji), ...] in chart order, indices after which a
# >0.8 s row pause is expected). The romaji doubles as the clip filename; it
# matches `GOJUON_ROWS` in src/domain/curriculum.ts for the 46 base morae.
TRACKS = [
    ("Gojuon", [
        ("あ", "a"), ("い", "i"), ("う", "u"), ("え", "e"), ("お", "o"),
        ("か", "ka"), ("き", "ki"), ("く", "ku"), ("け", "ke"), ("こ", "ko"),
        ("さ", "sa"), ("し", "shi"), ("す", "su"), ("せ", "se"), ("そ", "so"),
        ("た", "ta"), ("ち", "chi"), ("つ", "tsu"), ("て", "te"), ("と", "to"),
        ("な", "na"), ("に", "ni"), ("ぬ", "nu"), ("ね", "ne"), ("の", "no"),
        ("は", "ha"), ("ひ", "hi"), ("ふ", "fu"), ("へ", "he"), ("ほ", "ho"),
        ("ま", "ma"), ("み", "mi"), ("む", "mu"), ("め", "me"), ("も", "mo"),
        ("や", "ya"), ("ゆ", "yu"), ("よ", "yo"),
        ("ら", "ra"), ("り", "ri"), ("る", "ru"), ("れ", "re"), ("ろ", "ro"),
        ("わ", "wa"), ("を", "wo"),
        ("ん", "n"),
    ], [5, 10, 15, 20, 25, 30, 35, 38, 43]),
    ("Dakuon_Handakuon", [
        ("が", "ga"), ("ぎ", "gi"), ("ぐ", "gu"), ("げ", "ge"), ("ご", "go"),
        ("ざ", "za"), ("じ", "ji"), ("ず", "zu"), ("ぜ", "ze"), ("ぞ", "zo"),
        ("だ", "da"), ("ぢ", "di"), ("づ", "du"), ("で", "de"), ("ど", "do"),
        ("ば", "ba"), ("び", "bi"), ("ぶ", "bu"), ("べ", "be"), ("ぼ", "bo"),
        ("ぱ", "pa"), ("ぴ", "pi"), ("ぷ", "pu"), ("ぺ", "pe"), ("ぽ", "po"),
    ], [5, 10, 15, 20]),
    ("Youon", [
        ("きゃ", "kya"), ("きゅ", "kyu"), ("きょ", "kyo"),
        ("しゃ", "sha"), ("しゅ", "shu"), ("しょ", "sho"),
        ("ちゃ", "cha"), ("ちゅ", "chu"), ("ちょ", "cho"),
        ("にゃ", "nya"), ("にゅ", "nyu"), ("にょ", "nyo"),
        ("ひゃ", "hya"), ("ひゅ", "hyu"), ("ひょ", "hyo"),
        ("みゃ", "mya"), ("みゅ", "myu"), ("みょ", "myo"),
        ("りゃ", "rya"), ("りゅ", "ryu"), ("りょ", "ryo"),
        ("ぎゃ", "gya"), ("ぎゅ", "gyu"), ("ぎょ", "gyo"),
        ("じゃ", "ja"), ("じゅ", "ju"), ("じょ", "jo"),
        ("びゃ", "bya"), ("びゅ", "byu"), ("びょ", "byo"),
        ("ぴゃ", "pya"), ("ぴゅ", "pyu"), ("ぴょ", "pyo"),
    ], [3, 6, 9, 12, 15, 18, 21, 24, 27, 30]),
]

WIN = 0.005         # 5 ms envelope resolution
DROP = 30           # utterance threshold, dB below track peak
MIN_RUN = 0.05      # ignore blips shorter than this
MERGE_GAP = 0.15    # join runs closer than this (one mora, not two)
ROW_PAUSE = 0.8     # a gap this long marks a chart row boundary

# The coarse threshold above keys off the vowel, which is far louder than a
# fricative (/s/, /ʃ/) or a stop burst (/k/). Taking its edge as the clip
# boundary shears the consonant off the front — measured at up to 170 ms on
# せ and そ. So the coarse pass only counts and orders utterances; each edge is
# then walked out to where the signal meets the noise floor, in a high band as
# well as broadband, since /s/ energy lives above 2 kHz and barely moves a
# broadband meter.
EDGE_OVER_FLOOR = 6   # dB above the track's noise floor = "still speech"
PAD_HEAD = 0.06       # safety pre-roll beyond the measured onset
PAD_TAIL = 0.10       # safety tail beyond the measured offset
GAP_GUARD = 0.5       # never expand past this fraction of the following gap
MIN_ACTIVE = 0.02     # ignore bursts shorter than this: room tone, not speech

# The Youon take has ~440 ms of steady hiss parked in the gap between きゃ and
# きゅ, at -52 dB — far above the -62 dB floor, so the edge walk read it as
# speech and both morae picked it up. It separates neither by level (the s-row
# fricatives sit *deeper* below their own peak than the hiss does) nor by
# spectral tilt (the hiss lands between さ's vowel and its frication). What
# gives it away is that it is perfectly flat: speech, and even ordinary room
# tone, always wobbles more.
STATIONARY_WIN = 0.15   # window over which to judge flatness
STATIONARY_SD = 1.5     # dB; below this the window is machine noise, not speech
STATIONARY_BELOW = 25   # only ever gate material this far under the track peak

# Katakana share the hiragana recordings — same sound, different script. The
# main kana blocks are a fixed 0x60 apart, so the mapping is mechanical.
KATAKANA_OFFSET = 0x60


def envelope(path, tmp, highpass=None):
    """RMS envelope in dBFS, optionally of a high-passed copy."""
    filt = ["-af", f"highpass=f={highpass}"] if highpass else []
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", path] + filt +
                   ["-f", "s16le", "-ac", "1", "-ar", "16000", tmp], check=True)
    pcm = array.array("h")
    pcm.frombytes(open(tmp, "rb").read())
    win = int(16000 * WIN)
    return [20 * math.log10(math.sqrt(sum(v * v for v in pcm[i * win:(i + 1) * win]) / win)
                            / 32768 + 1e-9)
            for i in range(len(pcm) // win)]


def noise_floor(env):
    """10th percentile ~ the inter-utterance silence."""
    return sorted(env)[len(env) // 10]


def stationary(broad):
    """Frames belonging to a flat, low-level plateau — steady machine noise."""
    width = int(STATIONARY_WIN / WIN)
    ceiling = max(broad) - STATIONARY_BELOW
    flat = [False] * len(broad)
    for i in range(len(broad) - width):
        window = broad[i:i + width]
        if max(window) < ceiling and statistics.pstdev(window) < STATIONARY_SD:
            for k in range(i, i + width):
                flat[k] = True
    return flat


def active_mask(broad, high):
    """Per-frame "this is speech" flag, with lone blips and hiss discarded.

    A single frame above the floor is room tone, not a consonant — without that
    rule a stray transient dragged きゅ's onset 275 ms too early.
    """
    lo_b = noise_floor(broad) + EDGE_OVER_FLOOR
    lo_h = noise_floor(high) + EDGE_OVER_FLOOR
    flat = stationary(broad)
    mask = [(b > lo_b or h > lo_h) and not f
            for b, h, f in zip(broad, high, flat)]

    i = 0
    while i < len(mask):
        if not mask[i]:
            i += 1
            continue
        j = i
        while j < len(mask) and mask[j]:
            j += 1
        if (j - i) * WIN < MIN_ACTIVE:
            for k in range(i, j):
                mask[k] = False
        i = j
    return mask


def true_edges(mask, span, prev_end, next_start):
    """Widen a coarse (vowel-keyed) span to the real speech edges."""
    a, b = span

    # prev_end is where the previous mora's clip actually ended, so this can
    # never reach back into it. Without that, a slow decay tail reads as active
    # and the next mora starts inside it — きゃ's tail put 275 ms in front of きゅ.
    limit = prev_end if prev_end is not None else 0
    while a > limit and mask[a - 1]:
        a -= 1

    cap = next_start - int((next_start - b) * GAP_GUARD) if next_start is not None else len(mask)
    while b < cap and mask[b]:
        b += 1

    return a, b


def utterances(env):
    threshold = max(env) - DROP
    runs, start = [], None
    for i, level in enumerate(env):
        if level > threshold and start is None:
            start = i
        elif level <= threshold and start is not None:
            if (i - start) * WIN > MIN_RUN:
                runs.append((start, i))
            start = None
    if start is not None:
        runs.append((start, len(env)))
    merged = []
    for a, b in runs:
        if merged and (a - merged[-1][1]) * WIN < MERGE_GAP:
            merged[-1] = (merged[-1][0], b)
        else:
            merged.append((a, b))
    return merged


def to_katakana(hiragana):
    return "".join(chr(ord(c) + KATAKANA_OFFSET) for c in hiragana)


def write_map(entries):
    """Emit the glyph-keyed require() map.

    Metro resolves require() at build time, so every path has to be a literal —
    hence a generated file rather than a runtime lookup.
    """
    lines = [
        "/**",
        " * Generated by scripts/build-kana-audio.py — do not edit by hand.",
        " *",
        " * Metro resolves require() at build time, so each asset path must be a",
        " * literal. Clips are keyed by kana glyph rather than romaji because romaji",
        " * has competing spellings (shi/si, fu/hu) that the curriculum already treats",
        " * as aliases; the glyph is the stable key. Katakana map to the same",
        " * recordings — identical sound, different script.",
        " *",
        " * Recordings by Kaori sensei — see assets/audio/kana/ATTRIBUTION.md.",
        " */",
        "",
        "const CLIPS = {",
    ]
    for _, romaji in entries:
        lines.append(f"  {romaji}: require('../../assets/audio/kana/{romaji}.m4a'),")
    lines += ["} as const;", "",
              "/** Kana glyph (hiragana or katakana) to its bundled audio asset. */",
              "export const KANA_AUDIO: Readonly<Record<string, number>> = {"]
    for hira, romaji in entries:
        lines.append(f"  '{hira}': CLIPS.{romaji},")
    lines.append("")
    for hira, romaji in entries:
        lines.append(f"  '{to_katakana(hira)}': CLIPS.{romaji},")
    lines += ["};", ""]

    os.makedirs(os.path.dirname(MAP_FILE), exist_ok=True)
    with open(MAP_FILE, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


def main():
    os.makedirs(AUDIO_DIR, exist_ok=True)
    entries = []

    with tempfile.TemporaryDirectory() as work:
        tmp = os.path.join(work, "pcm.raw")
        for track, mora, row_breaks in TRACKS:
            src = os.path.join(work, f"{track}.mp3")
            with open(src, "wb") as fh:
                fh.write(urllib.request.urlopen(
                    urllib.request.Request(f"{BASE}/{track}.mp3", headers=UA)).read())

            broad = envelope(src, tmp)
            high = envelope(src, tmp, highpass=2000)
            mask = active_mask(broad, high)
            found = utterances(broad)

            # Two integrity checks. Without them a single missed utterance would
            # shift every label after it by one, silently and inaudibly.
            if len(found) != len(mora):
                sys.exit(f"{track}: found {len(found)} utterances, expected {len(mora)}. "
                         "Upstream audio changed — re-verify ordering before trusting labels.")
            gaps = [(found[i + 1][0] - found[i][1]) * WIN for i in range(len(found) - 1)]
            actual = [i + 1 for i, g in enumerate(gaps) if g > ROW_PAUSE]
            if actual != row_breaks:
                sys.exit(f"{track}: row boundaries at {actual}, expected {row_breaks}. "
                         "Chart order may have changed — labels cannot be trusted.")

            prev_b = None
            for i, ((a, b), (hira, romaji)) in enumerate(zip(found, mora)):
                a, b = true_edges(mask, (a, b), prev_b,
                                  found[i + 1][0] if i + 1 < len(found) else None)
                prev_b = b
                start = max(0.0, a * WIN - PAD_HEAD)
                dur = (b - a) * WIN + PAD_HEAD + PAD_TAIL
                subprocess.run([
                    "ffmpeg", "-y", "-v", "error", "-ss", f"{start:.3f}", "-t", f"{dur:.3f}",
                    "-i", src, "-af",
                    "afade=t=in:st=0:d=0.02,areverse,afade=t=in:st=0:d=0.03,areverse,"
                    "loudnorm=I=-16:TP=-1.5:LRA=11,"
                    "aformat=sample_rates=24000:channel_layouts=mono",
                    "-c:a", "aac", "-b:a", "40k", "-movflags", "+faststart",
                    os.path.join(AUDIO_DIR, f"{romaji}.m4a"),
                ], check=True)
                entries.append((hira, romaji))
            print(f"{track}: {len(mora)} morae ok")

    write_map(entries)
    total = sum(os.path.getsize(os.path.join(AUDIO_DIR, f"{r}.m4a")) for _, r in entries)
    print(f"\n{len(entries)} clips, {total / 1024:.0f} KB -> assets/audio/kana/")
    print(f"map with {len(entries) * 2} glyph keys -> src/services/kanaAudioAssets.ts")


if __name__ == "__main__":
    main()
