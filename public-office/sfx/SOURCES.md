# 칼퇴근 대작전 — sound effects

Generated 2026-11-01 with the Higgsfield CLI, model **Seed Audio 1.0** (`seed_audio`, `--sample_rate 44100`), about 1.0–1.3 credits per clip (17 clips + 1 test ≈ 18.9 credits incl. one refund). Mirelo Text to Audio was tested once (0.25 cr) and rejected (noise bed, sound only at the end). AI-generated; no third-party samples.

Processing v1 (`master.py`, superseded) in the job tmp dir): onset at −40 dB of peak (2 ms pre-roll kept), tail cut below −50 dB, capped to the listed length with a 60 ms fade, 10 ms end fade otherwise, peak-normalized to −1 dBFS, 44.1 kHz stereo. Exports: OGG Vorbis via libsndfile (compression 0.5 ≈ `oggenc -q 5`; this ffmpeg build has no libvorbis) and M4A AAC 128 kb/s (ffmpeg `aac`, faststart). WAV masters stay in the job tmp dir.

Checked by waveform/peak/duration script and spectrograms (not by ear).

Processing v2 (`retrim.py`, 2026-11-02, from the raw WAVs): onset = first 5 ms RMS frame above −30 dB of the clip's RMS max; window = onset → onset + max length; if the loudest 0.3 s lies beyond it the window is shifted to end there (re-snapped to a local onset) — marked "shifted"; 3 ms fade-in, 70 ms fade-out, −1 dBFS peak. Peaks below are measured on the exported OGG (Vorbis overshoot/undershoot ±0.6 dB). Masters: job tmp `sfx/master2/`.

| name | out s | raw onset s | shifted | ogg peak dBFS | prompt |
|---|---|---|---|---|---|
| `jump1` | 0.35 | 0.10 |  | -0.99 | a light cartoon boing, one short springy bounce, short game sound effect, comic cartoon style, clean studio recording, no music, no speech, no words |
| `jump2` | 0.55 | 0.23 |  | -1.24 | a higher-pitched double cartoon boing, two quick springy bounces rising in pitch, short game sound effect, comic cartoon style, clean studio recording, no music, no speech, no words |
| `jump3` | 0.80 | 0.21 |  | -1.20 | a fast upward whoosh followed by a bright magical sparkle shimmer rising, short game sound effect, comic cartoon style, clean studio recording, no music, no speech, no words |
| `land` | 0.35 | 0.10 | yes | -1.18 | a soft cartoon thud of sneakers landing with a tiny rubber squeak, short game sound effect, comic cartoon style, clean studio recording, no music, no speech, no words |
| `slide` | 0.40 | 0.33 | yes | -1.62 | a quick cloth swoosh and short sneaker skid on a smooth floor, very short, short game sound effect, comic cartoon style, clean studio recording, no music, no speech, no words |
| `lane` | 0.25 | 0.12 | yes | -1.33 | a very short whip-like air swish, short game sound effect, comic cartoon style, clean studio recording, no music, no speech, no words |
| `pick-coin` | 0.60 | 0.10 |  | -1.13 | a bright coin pickup ding with a short sparkling coin shimmer, short game sound effect, comic cartoon style, clean studio recording, no music, no speech, no words |
| `pick-shield` | 0.70 | 0.09 |  | -1.32 | a soft bubble pop followed by a gentle airy shimmer, short game sound effect, comic cartoon style, clean studio recording, no music, no speech, no words |
| `pick-slow` | 0.80 | 0.52 | yes | -0.81 | ice cubes clinking in a plastic cup and a short straw sip slurp, short game sound effect, comic cartoon style, clean studio recording, no music, no speech, no words |
| `pick-heart` | 0.60 | 1.16 |  | -1.09 | a cute small crunchy bite of a rice snack and a tiny sparkle chime, short game sound effect, comic cartoon style, clean studio recording, no music, no speech, no words |
| `pick-item` | 0.50 | 0.16 |  | -0.86 | a rising two-note bright chime, cheerful collectible pickup, short game sound effect, comic cartoon style, clean studio recording, no music, no speech, no words |
| `pick-item-done` | 1.10 | 0.13 |  | -1.23 | a short triumphant cheerful jingle with bells, about 2 seconds, mission complete, short game sound effect, comic cartoon style, clean studio recording, no music, no speech, no words |
| `perfect` | 0.60 | 0.11 |  | -1.21 | a single crisp bright bell ding, very clean, short game sound effect, comic cartoon style, clean studio recording, no music, no speech, no words |
| `stamp` | 0.45 | 0.13 |  | -0.76 | a rubber stamp slammed onto paper on a desk, one solid thunk, short game sound effect, comic cartoon style, clean studio recording, no music, no speech, no words |
| `mission-ok` | 1.50 | 0.10 |  | -1.17 | a cheerful cartoon ta-da fanfare with brass and a cymbal, 1.5 seconds, short game sound effect, comic cartoon style, clean studio recording, no music, no speech, no words |
| `mission-miss` | 1.00 | 0.30 |  | -0.95 | a soft comic sad trombone wah-wah-wah, 1 second, short game sound effect, comic cartoon style, clean studio recording, no music, no speech, no words |
