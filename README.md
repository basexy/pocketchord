# PocketChord

A browser chord instrument inspired by the HiChord: seven diatonic chord
buttons you can't play a wrong note on, automatic voice leading, a "tinta"
(flavor) control, three timbres, reverb/delay, and a beat-synced looper.

## Run

ES modules need an HTTP server (opening `index.html` via `file://` won't work):

```sh
npm start          # python3 http.server on :8080
# or: npx serve
```

Open http://localhost:8080, tap to start (Web Audio needs a user gesture).

## Play

- **A S D F G H J** — the seven scale degrees (or click/tap the big buttons)
- **1 2 3 4** — flavor: triad / 7th / sus / add9
- **KEY** — root + major/minor
- **LOOPER** — `● REC` records quantized to 16ths (starts the transport if
  stopped); recording is always overdub. `▶ PLAY`/`■ STOP`, `✕ CLEAR`,
  loop length 2/4/8 bars. `CLICK` toggles the metronome.

## Architecture

```
index.html
styles.css
src/
  main.js          # bootstrap, wiring
  audio-engine.js  # Tone.js: synths, effects, output
  chords.js        # pure theory: scales, chords, voice leading, flavors
  looper.js        # record/playback on Tone.Transport (tick-based, BPM-safe)
  ui.js            # rendering, input, visual feedback
```

`src/chords.js` is pure and tested without audio:

```sh
npm test
```
