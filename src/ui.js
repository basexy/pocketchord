// ui.js — DOM rendering, input wiring (pointer + QWERTY), visual feedback.

import { DRUM_ROWS, STEPS } from './drums.js';
import { TRACKS, SONG_BARS, clipAt, patternById } from './song.js';

const DEGREE_KEYS = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ'];
const FLAVOR_KEYS = { Digit1: 'triad', Digit2: 'seventh', Digit3: 'sus', Digit4: 'add9' };
const KEY_HINTS = ['A', 'S', 'D', 'F', 'G', 'H', 'J'];

export class UI {
  /**
   * @param {object} handlers  { degreeOn, degreeOff, setRoot, setMode, setFlavor,
   *   setTimbre, setBpm, toggleReverb, toggleDelay, toggleMetronome,
   *   loopRecord, loopPlay, loopStop, loopClear, setBars, start }
   */
  constructor(handlers) {
    this.h = handlers;
    this.el = {
      overlay: document.getElementById('start-overlay'),
      startBtn: document.getElementById('start-btn'),
      grid: document.getElementById('chord-grid'),
      lcdKey: document.getElementById('lcd-key'),
      lcdChord: document.getElementById('lcd-chord'),
      lcdFlavor: document.getElementById('lcd-flavor'),
      lcdTimbre: document.getElementById('lcd-timbre'),
      lcdLoop: document.getElementById('lcd-loop'),
      lcdBpm: document.getElementById('lcd-bpm'),
      beatLed: document.getElementById('beat-led'),
      root: document.getElementById('root-select'),
      mode: document.getElementById('mode-toggle'),
      bpm: document.getElementById('bpm-range'),
      bpmValue: document.getElementById('bpm-value'),
      bars: document.getElementById('bars-select'),
      rec: document.getElementById('loop-rec'),
      play: document.getElementById('loop-play'),
      clear: document.getElementById('loop-clear'),
      drumGrid: document.getElementById('drum-grid'),
      patternList: document.getElementById('pattern-list'),
      playlist: document.getElementById('playlist'),
      songPlay: document.getElementById('song-play'),
    };
    this.degreeButtons = [];
    this.drumCells = [];
    this._drumStep = -1;
    this._playheadBar = -1;
    this._buildGrid();
    this._buildDrumGrid();
    this._wire();
  }

  _buildGrid() {
    for (let d = 0; d < 7; d++) {
      const btn = document.createElement('button');
      btn.className = 'chord-btn';
      btn.dataset.degree = d;
      btn.innerHTML = `
        <span class="roman"></span>
        <span class="chord-name"></span>
        <span class="key-hint">${KEY_HINTS[d]}</span>`;
      this.el.grid.appendChild(btn);
      this.degreeButtons.push(btn);

      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        this.h.degreeOn(d);
      });
      const off = () => this.h.degreeOff(d);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      // Keyboard accessibility: hold Space/Enter to hold the chord
      btn.addEventListener('keydown', (e) => {
        if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
          e.preventDefault();
          this.h.degreeOn(d);
        }
      });
      btn.addEventListener('keyup', (e) => {
        if (e.code === 'Space' || e.code === 'Enter') this.h.degreeOff(d);
      });
    }
  }

  _buildDrumGrid() {
    DRUM_ROWS.forEach((row, r) => {
      const label = document.createElement('span');
      label.className = 'drum-label';
      label.textContent = row.label;
      this.el.drumGrid.appendChild(label);

      const cells = [];
      for (let s = 0; s < STEPS; s++) {
        const cell = document.createElement('button');
        cell.className = `drum-cell${Math.floor(s / 4) % 2 ? ' alt' : ''}`;
        cell.setAttribute('aria-label', `${row.label} step ${s + 1}`);
        cell.addEventListener('click', () => this.h.drumToggle(r, s));
        this.el.drumGrid.appendChild(cell);
        cells.push(cell);
      }
      this.drumCells.push(cells);
    });
  }

  _wire() {
    const h = this.h;
    this.el.startBtn.addEventListener('click', () => h.start());

    document.getElementById('drum-clear').addEventListener('click', () => h.drumClear());
    document.getElementById('pat-save').addEventListener('click', () => h.patSave());
    this.el.songPlay.addEventListener('click', () => h.songPlayStop());
    document.getElementById('song-clear').addEventListener('click', () => h.songClear());

    this.el.root.addEventListener('change', (e) => h.setRoot(Number(e.target.value)));
    this.el.mode.addEventListener('click', () => h.setMode());

    document.querySelectorAll('[data-flavor]').forEach((btn) =>
      btn.addEventListener('click', () => h.setFlavor(btn.dataset.flavor)));
    document.querySelectorAll('[data-timbre]').forEach((btn) =>
      btn.addEventListener('click', () => h.setTimbre(btn.dataset.timbre)));

    this.el.bpm.addEventListener('input', (e) => h.setBpm(Number(e.target.value)));
    document.getElementById('fx-reverb').addEventListener('click', (e) =>
      h.toggleReverb(this._flip(e.currentTarget)));
    document.getElementById('fx-delay').addEventListener('click', (e) =>
      h.toggleDelay(this._flip(e.currentTarget)));
    document.getElementById('fx-metro').addEventListener('click', (e) =>
      h.toggleMetronome(this._flip(e.currentTarget)));

    this.el.rec.addEventListener('click', () => h.loopRecord());
    this.el.play.addEventListener('click', () => h.loopPlayStop());
    this.el.clear.addEventListener('click', () => h.loopClear());
    this.el.bars.addEventListener('change', (e) => h.setBars(Number(e.target.value)));

    // QWERTY: A S D F G H J → degrees, 1-4 → flavors
    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(SELECT|INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
      const deg = DEGREE_KEYS.indexOf(e.code);
      if (deg !== -1) { e.preventDefault(); h.degreeOn(deg); return; }
      if (FLAVOR_KEYS[e.code]) h.setFlavor(FLAVOR_KEYS[e.code]);
    });
    window.addEventListener('keyup', (e) => {
      const deg = DEGREE_KEYS.indexOf(e.code);
      if (deg !== -1) h.degreeOff(deg);
    });
    window.addEventListener('blur', () => {
      for (let d = 0; d < 7; d++) h.degreeOff(d);
    });
  }

  _flip(btn) {
    const on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(on));
    return on;
  }

  hideOverlay() {
    this.el.overlay.classList.add('hidden');
  }

  /** Refresh the 7 button labels for the current key + flavor. */
  setChordLabels(chords) {
    chords.forEach((c, d) => {
      const btn = this.degreeButtons[d];
      btn.querySelector('.roman').textContent = c.roman;
      btn.querySelector('.chord-name').textContent = c.label;
      btn.setAttribute('aria-label', `Chord ${c.roman}: ${c.label}`);
    });
  }

  chordActive(degree, on, label = '') {
    this.degreeButtons[degree].classList.toggle('active', on);
    if (on) this.el.lcdChord.textContent = label;
  }

  setSelected(groupAttr, value) {
    document.querySelectorAll(`[data-${groupAttr}]`).forEach((btn) => {
      const sel = btn.dataset[groupAttr] === value;
      btn.classList.toggle('selected', sel);
      btn.setAttribute('aria-pressed', String(sel));
    });
  }

  updateLCD({ keyName, mode, flavor, timbre, bpm }) {
    if (keyName !== undefined) this.el.lcdKey.textContent = `${keyName} ${mode.toUpperCase()}`;
    if (flavor !== undefined) this.el.lcdFlavor.textContent = flavor.toUpperCase();
    if (timbre !== undefined) this.el.lcdTimbre.textContent = timbre.toUpperCase();
    if (bpm !== undefined) {
      this.el.lcdBpm.textContent = `♩=${bpm}`;
      this.el.bpmValue.textContent = bpm;
      this.el.bpm.value = bpm;
    }
  }

  updateMode(mode) {
    this.el.mode.textContent = mode === 'major' ? 'MAJOR' : 'MINOR';
  }

  /* ---------- drum machine ---------- */

  setDrumCell(row, step, on) {
    this.drumCells[row][step].classList.toggle('on', on);
  }

  setDrumGrid(grid) {
    grid.forEach((row, r) => row.forEach((on, s) => this.setDrumCell(r, s, on)));
  }

  drumPlayhead(step) {
    if (step === this._drumStep) return;
    for (const cells of this.drumCells) {
      if (this._drumStep >= 0) cells[this._drumStep].classList.remove('ph');
      if (step >= 0) cells[step].classList.add('ph');
    }
    this._drumStep = step;
  }

  /* ---------- song view ---------- */

  /** Full re-render of pattern chips + playlist grid. */
  renderSong({ patterns, clips, selectedId }) {
    const list = this.el.patternList;
    list.innerHTML = '';
    if (patterns.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'pat-empty';
      empty.textContent = 'no patterns yet';
      list.appendChild(empty);
    }
    for (const p of patterns) {
      const chip = document.createElement('button');
      chip.className = `pat-chip pat-c${p.color}${p.id === selectedId ? ' selected' : ''}`;
      chip.innerHTML = `<span>${p.name}</span><span class="pat-len">${p.bars}b</span>` +
        '<span class="pat-del" aria-label="delete">✕</span>';
      chip.addEventListener('click', (e) => {
        if (e.target.classList.contains('pat-del')) this.h.patDelete(p.id);
        else this.h.patSelect(p.id);
      });
      list.appendChild(chip);
    }

    const pl = this.el.playlist;
    pl.innerHTML = '';
    pl.style.gridTemplateColumns = `44px repeat(${SONG_BARS}, minmax(24px, 1fr))`;

    // header row: bar numbers every 4 bars
    const corner = document.createElement('span');
    corner.className = 'pl-label pl-head';
    pl.appendChild(corner);
    for (let b = 0; b < SONG_BARS; b++) {
      const n = document.createElement('span');
      n.className = `pl-head${b % 4 === 0 ? ' q' : ''}`;
      n.dataset.bar = b;
      n.textContent = b % 4 === 0 ? b + 1 : '';
      pl.appendChild(n);
    }

    for (let t = 0; t < TRACKS; t++) {
      const label = document.createElement('span');
      label.className = 'pl-label';
      label.textContent = `TR ${t + 1}`;
      pl.appendChild(label);

      for (let b = 0; b < SONG_BARS; b++) {
        const cell = document.createElement('button');
        const clip = clipAt(clips, patterns, t, b);
        cell.className = `pl-cell${b % 4 === 0 ? ' q' : ''}`;
        cell.dataset.bar = b;
        if (clip) {
          const p = patternById(patterns, clip.patternId);
          cell.classList.add('clip', `pat-c${p.color}`);
          if (b === clip.startBar) {
            cell.classList.add('clip-start');
            cell.textContent = p.name;
          }
          if (b === clip.startBar + p.bars - 1) cell.classList.add('clip-end');
          cell.setAttribute('aria-label', `Track ${t + 1} bar ${b + 1}: ${p.name}`);
        } else {
          cell.setAttribute('aria-label', `Track ${t + 1} bar ${b + 1}: empty`);
        }
        cell.addEventListener('click', () => this.h.cellToggle(t, b));
        pl.appendChild(cell);
      }
    }
    this._playheadBar = -1;
  }

  /** Highlight the current bar column while the song plays (-1 clears). */
  setPlayhead(bar) {
    if (bar === this._playheadBar) return;
    this.el.playlist.querySelectorAll('[data-bar]').forEach((el) => {
      el.classList.toggle('ph', Number(el.dataset.bar) === bar);
    });
    this._playheadBar = bar;
  }

  updateSongMode(songMode, playing) {
    this.el.songPlay.textContent = songMode && playing ? '■ STOP' : '▶ SONG';
    this.el.songPlay.setAttribute('aria-pressed', String(songMode && playing));
  }

  updateLoop({ recording, playing, eventCount, beat, songMode, bars }) {
    if (bars !== undefined) this.el.bars.value = String(bars);
    if (recording !== undefined) {
      this.el.rec.classList.toggle('recording', recording);
      this.el.rec.setAttribute('aria-pressed', String(recording));
    }
    if (playing !== undefined) {
      this.el.play.textContent = playing ? '■ STOP' : '▶ PLAY';
      this.el.play.setAttribute('aria-pressed', String(playing));
    }
    const state = recording ? 'REC' : playing ? 'PLAY' : 'STOP';
    this.el.lcdLoop.textContent = songMode
      ? `SONG:${state}`
      : `LOOP:${state} ·${eventCount ?? 0}`;
    if (beat !== undefined) {
      this.el.beatLed.classList.toggle('on', beat >= 0);
      this.el.beatLed.classList.toggle('accent', beat === 0);
      if (beat >= 0) {
        // restart the blink animation
        this.el.beatLed.style.animation = 'none';
        void this.el.beatLed.offsetWidth;
        this.el.beatLed.style.animation = '';
      }
    }
  }
}
