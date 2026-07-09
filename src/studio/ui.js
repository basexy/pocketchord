// ui.js (studio) — DOM rendering and input wiring for the tech house studio:
// drum grid, bass piano-roll, stab row, FX controls and the bottom song dock.

import { KIT_ROWS, STEPS } from './kit.js';
import { BASS_ROWS } from './bass.js';
import { CHORD_TYPES } from './stabs.js';
import { TRACKS, SONG_BARS, clipAt, patternById } from './arrange.js';

const BASS_ROW_LABELS = ['8', '♭7', '♭6', '5', '4', '♭3', '2', '1']; // top → bottom

export class StudioUI {
  constructor(handlers) {
    this.h = handlers;
    const $ = (id) => document.getElementById(id);
    this.el = {
      overlay: $('start-overlay'),
      startBtn: $('start-btn'),
      playBtn: $('play-btn'),
      bpm: $('bpm-range'),
      bpmValue: $('bpm-value'),
      swing: $('swing-range'),
      swingValue: $('swing-value'),
      key: $('key-select'),
      drumGrid: $('drum-grid'),
      bassRoll: $('bass-roll'),
      bassAcc: $('bass-acc'),
      bassSld: $('bass-sld'),
      cutoff: $('cutoff-range'),
      res: $('res-range'),
      stabRow: $('stab-row'),
      stabChord: $('stab-chord'),
      stabTone: $('tone-range'),
      sweep: $('sweep-range'),
      riser: $('riser-btn'),
      fxDelay: $('fx-delay'),
      fxReverb: $('fx-reverb'),
      dock: $('dock'),
      dockToggle: $('dock-toggle'),
      dockInfo: $('dock-info'),
      dockBody: $('dock-body'),
      patternList: $('pattern-list'),
      playlist: $('playlist'),
      songPlay: $('song-play'),
    };
    this.drumCells = [];
    this.bassCells = []; // [row(display 0=top)][step]
    this.accCells = [];
    this.sldCells = [];
    this.stabCells = [];
    this._step = -1;
    this._bar = -1;
    this._paint = null; // 'draw' | 'erase' while dragging on the playlist
    this._build();
    this._wire();
  }

  /* ---------- static grid construction ---------- */

  _build() {
    // drums: label + 16 cells per row
    KIT_ROWS.forEach((row, r) => {
      const label = document.createElement('span');
      label.className = 'cell-label';
      label.textContent = row.label;
      this.el.drumGrid.appendChild(label);
      const cells = [];
      for (let s = 0; s < STEPS; s++) {
        const cell = document.createElement('button');
        cell.className = `cell${Math.floor(s / 4) % 2 ? ' alt' : ''}`;
        cell.setAttribute('aria-label', `${row.label} step ${s + 1}`);
        cell.addEventListener('click', () => this.h.drumToggle(r, s));
        this.el.drumGrid.appendChild(cell);
        cells.push(cell);
      }
      this.drumCells.push(cells);
    });

    // bass piano-roll: display top row = highest degree
    for (let dr = 0; dr < BASS_ROWS; dr++) {
      const row = BASS_ROWS - 1 - dr; // data row
      const label = document.createElement('span');
      label.className = 'cell-label';
      label.textContent = BASS_ROW_LABELS[dr];
      this.el.bassRoll.appendChild(label);
      const cells = [];
      for (let s = 0; s < STEPS; s++) {
        const cell = document.createElement('button');
        cell.className = `cell bass${Math.floor(s / 4) % 2 ? ' alt' : ''}`;
        cell.setAttribute('aria-label', `Bass degree ${BASS_ROW_LABELS[dr]} step ${s + 1}`);
        cell.addEventListener('click', () => this.h.bassNote(row, s));
        this.el.bassRoll.appendChild(cell);
        cells.push(cell);
      }
      this.bassCells.push(cells);
    }

    // accent + slide rows
    const flagRow = (host, cls, label, cb, store) => {
      const l = document.createElement('span');
      l.className = 'cell-label';
      l.textContent = label;
      host.appendChild(l);
      for (let s = 0; s < STEPS; s++) {
        const cell = document.createElement('button');
        cell.className = `cell flag ${cls}${Math.floor(s / 4) % 2 ? ' alt' : ''}`;
        cell.setAttribute('aria-label', `${label} step ${s + 1}`);
        cell.addEventListener('click', () => cb(s));
        host.appendChild(cell);
        store.push(cell);
      }
    };
    flagRow(this.el.bassAcc, 'acc', 'ACC', (s) => this.h.bassAcc(s), this.accCells);
    flagRow(this.el.bassSld, 'sld', 'SLD', (s) => this.h.bassSld(s), this.sldCells);

    // stabs: one row of 16
    const stabLabel = document.createElement('span');
    stabLabel.className = 'cell-label';
    stabLabel.textContent = 'STAB';
    this.el.stabRow.appendChild(stabLabel);
    for (let s = 0; s < STEPS; s++) {
      const cell = document.createElement('button');
      cell.className = `cell stab${Math.floor(s / 4) % 2 ? ' alt' : ''}`;
      cell.setAttribute('aria-label', `Stab step ${s + 1}`);
      cell.addEventListener('click', () => this.h.stabToggle(s));
      this.el.stabRow.appendChild(cell);
      this.stabCells.push(cell);
    }

    // chord type options
    for (const type of Object.keys(CHORD_TYPES)) {
      const opt = document.createElement('option');
      opt.value = type;
      opt.textContent = type.toUpperCase();
      this.el.stabChord.appendChild(opt);
    }
  }

  _wire() {
    const h = this.h;
    this.el.startBtn.addEventListener('click', () => h.start());
    this.el.playBtn.addEventListener('click', () => h.playStop());
    this.el.bpm.addEventListener('input', (e) => h.setBpm(Number(e.target.value)));
    this.el.swing.addEventListener('input', (e) => h.setSwing(Number(e.target.value)));
    this.el.key.addEventListener('change', (e) => h.setKey(Number(e.target.value)));

    document.getElementById('drum-clear').addEventListener('click', () => h.drumClear());
    document.getElementById('bass-clear').addEventListener('click', () => h.bassClear());
    document.getElementById('stab-clear').addEventListener('click', () => h.stabClear());
    this.el.cutoff.addEventListener('input', (e) => h.setCutoff(Number(e.target.value)));
    this.el.res.addEventListener('input', (e) => h.setRes(Number(e.target.value)));
    this.el.stabTone.addEventListener('input', (e) => h.setTone(Number(e.target.value)));
    this.el.stabChord.addEventListener('change', (e) => h.stabChord(e.target.value));

    this.el.sweep.addEventListener('input', (e) => h.setSweep(Number(e.target.value) / 100));
    this.el.sweep.addEventListener('dblclick', () => {
      this.el.sweep.value = 0;
      h.setSweep(0);
    });
    this.el.riser.addEventListener('pointerdown', () => h.riserDown());
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) =>
      this.el.riser.addEventListener(ev, () => h.riserUp()));
    this.el.fxDelay.addEventListener('click', (e) => h.toggleDelay(this._flip(e.currentTarget)));
    this.el.fxReverb.addEventListener('click', (e) => h.toggleReverb(this._flip(e.currentTarget)));

    this.el.dockToggle.addEventListener('click', () => h.dockToggle());
    document.getElementById('pat-save').addEventListener('click', () => h.patSave());
    this.el.songPlay.addEventListener('click', () => h.songPlayStop());
    document.getElementById('song-clear').addEventListener('click', () => h.songClear());
    window.addEventListener('pointerup', () => { this._paint = null; });
  }

  _flip(btn) {
    const on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(on));
    return on;
  }

  hideOverlay() {
    this.el.overlay.classList.add('hidden');
  }

  /* ---------- sequencer state ---------- */

  setDrumCell(r, s, on) {
    this.drumCells[r][s].classList.toggle('on', on);
  }

  setDrumGrid(grid) {
    grid.forEach((row, r) => row.forEach((on, s) => this.setDrumCell(r, s, on)));
  }

  setBassSeq(seq) {
    seq.forEach((st, s) => {
      for (let row = 0; row < BASS_ROWS; row++) {
        this.bassCells[BASS_ROWS - 1 - row][s].classList.toggle('on', st.r === row);
      }
      this.accCells[s].classList.toggle('on', st.a);
      this.sldCells[s].classList.toggle('on', st.s);
    });
  }

  setStabState({ steps, chord }) {
    steps.forEach((on, s) => this.stabCells[s].classList.toggle('on', on));
    this.el.stabChord.value = chord;
  }

  /** Sync sliders/selects after restoring a saved project. */
  setControls({ bpm, swing, keyPc, cutoff, res, tone, delayOn, reverbOn }) {
    this.el.bpm.value = bpm;
    this.el.bpmValue.textContent = bpm;
    this.el.swing.value = swing;
    this.el.swingValue.textContent = `${swing}%`;
    this.el.key.value = String(keyPc);
    this.el.cutoff.value = cutoff;
    this.el.res.value = res;
    this.el.stabTone.value = tone;
    this.el.fxDelay.setAttribute('aria-pressed', String(delayOn));
    this.el.fxReverb.setAttribute('aria-pressed', String(reverbOn));
  }

  updateBpm(bpm) {
    this.el.bpmValue.textContent = bpm;
  }

  updateSwing(swing) {
    this.el.swingValue.textContent = `${swing}%`;
  }

  /* ---------- transport feedback ---------- */

  playhead(step) {
    if (step === this._step) return;
    const move = (cells) => {
      if (this._step >= 0) cells[this._step].classList.remove('ph');
      if (step >= 0) cells[step].classList.add('ph');
    };
    this.drumCells.forEach(move);
    this.bassCells.forEach(move);
    move(this.accCells);
    move(this.sldCells);
    move(this.stabCells);
    this._step = step;
  }

  updateTransport(playing, songMode) {
    this.el.playBtn.textContent = playing && !songMode ? '■ STOP' : '▶ PLAY';
    this.el.playBtn.setAttribute('aria-pressed', String(playing && !songMode));
    this.el.songPlay.textContent = playing && songMode ? '■ STOP' : '▶ SONG';
    this.el.songPlay.setAttribute('aria-pressed', String(playing && songMode));
  }

  /* ---------- song dock ---------- */

  setDockOpen(open) {
    this.el.dockBody.hidden = !open;
    this.el.dockToggle.textContent = open ? '▾ SONG' : '▸ SONG';
    document.body.classList.toggle('dock-open', open);
  }

  renderSong({ patterns, clips, selectedId, bars }) {
    this.el.dockInfo.textContent = `${patterns.length} PAT · ${bars} BARS`;

    const list = this.el.patternList;
    list.innerHTML = '';
    if (patterns.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'pat-empty';
      empty.textContent = 'save a pattern, then paint it on the grid below';
      list.appendChild(empty);
    }
    for (const p of patterns) {
      const chip = document.createElement('button');
      chip.className = `pat-chip pat-c${p.color}${p.id === selectedId ? ' selected' : ''}`;
      chip.innerHTML = `<span>${p.name}</span><span class="pat-del" aria-label="delete">✕</span>`;
      chip.addEventListener('click', (e) => {
        if (e.target.classList.contains('pat-del')) this.h.patDelete(p.id);
        else this.h.patSelect(p.id);
      });
      list.appendChild(chip);
    }

    const pl = this.el.playlist;
    pl.innerHTML = '';
    pl.style.gridTemplateColumns = `36px repeat(${SONG_BARS}, minmax(22px, 1fr))`;

    const corner = document.createElement('span');
    corner.className = 'pl-label pl-head';
    pl.appendChild(corner);
    for (let b = 0; b < SONG_BARS; b++) {
      const n = document.createElement('span');
      n.className = 'pl-head';
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
        const clip = clipAt(clips, t, b);
        cell.className = `pl-cell${b % 4 === 0 ? ' q' : ''}`;
        cell.dataset.bar = b;
        if (clip) {
          const p = patternById(patterns, clip.patternId);
          cell.classList.add('clip', `pat-c${p ? p.color : 0}`);
          cell.textContent = p ? p.name : '?';
          cell.setAttribute('aria-label', `Track ${t + 1} bar ${b + 1}: ${p ? p.name : ''}`);
        } else {
          cell.setAttribute('aria-label', `Track ${t + 1} bar ${b + 1}: empty`);
        }
        // click places/removes; press-and-drag paints across bars
        cell.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          this._paint = clip ? 'erase' : 'draw';
          this.h.cellPaint(t, b, this._paint);
        });
        cell.addEventListener('pointerenter', () => {
          if (this._paint) this.h.cellPaint(t, b, this._paint);
        });
        pl.appendChild(cell);
      }
    }
    this._bar = -1;
  }

  setPlayheadBar(bar) {
    if (bar === this._bar) return;
    this.el.playlist.querySelectorAll('[data-bar]').forEach((el) => {
      el.classList.toggle('ph', Number(el.dataset.bar) === bar);
    });
    this._bar = bar;
  }
}
