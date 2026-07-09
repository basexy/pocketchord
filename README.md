# PocketChord

Two browser instruments, all synthesized with Tone.js, no samples:

- **PocketChord** (`index.html`) — a chord instrument inspired by the
  HiChord: seven diatonic chord buttons you can't play a wrong note on,
  automatic voice leading, a "tinta" (flavor) control, three timbres,
  reverb/delay, and a beat-synced looper.
- **TH·Studio** (`studio.html`) — a tech house workstation: 909-style
  drum machine, 303-style acid bassline, chord-stab synth, performance FX,
  and a collapsible FL-style song dock (patterns + playlist) at the bottom.
  The project persists to localStorage.

## Run

ES modules need an HTTP server (opening `index.html` via `file://` won't work):

```sh
npm start          # python3 http.server on :8080
# or: npx serve
```

Open http://localhost:8080, tap to start (Web Audio needs a user gesture).

## PocketChord

- **A S D F G H J** — the seven scale degrees (or click/tap the big buttons)
- **1 2 3 4** — flavor: triad / 7th / sus / add9
- **KEY** — root + major/minor
- **LOOPER** — `● REC` records quantized to 16ths (starts the transport if
  stopped); recording is always overdub. `▶ PLAY`/`■ STOP`, `✕ CLEAR`,
  loop length 2/4/8 bars. `CLICK` toggles the metronome.

## TH·Studio

Everything runs on one 16th-note clock with adjustable swing.

- **DRUMS · 909** — 16-step × 6 rows (kick, clap, closed/open hat, ride, rim).
- **BASSLINE · 303** — mini piano-roll (natural minor degrees) with per-step
  ACC (accent) and SLD (slide/portamento), plus CUTOFF and RES.
- **STABS** — 16-step chord stabs (m7/m9/sus7/m6) following the global KEY.
- **FX** — DJ sweep filter (LP ◂ · ▸ HP, double-click to reset), hold-to-build
  noise riser, delay & reverb sends.
- **SONG dock** (bottom bar) — `＋ SAVE PATTERN` snapshots all sequencers as a
  1-bar pattern chip; open the dock, select a chip and click/drag on the
  playlist to paint clips; `▶ SONG` plays the arrangement. Everything persists
  in localStorage.

## Architecture

```
index.html / styles.css     # PocketChord
studio.html / studio.css    # TH·Studio
src/
  main.js          # PocketChord bootstrap, wiring
  audio-engine.js  # Tone.js: synths, effects, output
  chords.js        # pure theory: scales, chords, voice leading, flavors
  looper.js        # record/playback on Tone.Transport (tick-based, BPM-safe)
  ui.js            # PocketChord rendering, input, visual feedback
  studio/
    main.js        # studio bootstrap: clock, swing, live/song modes, storage
    kit.js         # synthesized 909-style kit + step grid
    bass.js        # 303-style mono bass: seq, accent, slide, filter
    stabs.js       # chord-stab synth
    fx.js          # master chain: sweep filter, riser, delay/reverb sends
    arrange.js     # pure pattern/playlist model
    ui.js          # studio DOM + input
```

`src/chords.js` and `src/studio/arrange.js` are pure and tested without
audio:

```sh
npm test
```
