// ui.js — DOM rendering, input wiring (pointer + QWERTY), visual feedback.

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
    };
    this.degreeButtons = [];
    this._buildGrid();
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

  _wire() {
    const h = this.h;
    this.el.startBtn.addEventListener('click', () => h.start());

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

  updateLoop({ recording, playing, eventCount, beat }) {
    if (recording !== undefined) {
      this.el.rec.classList.toggle('recording', recording);
      this.el.rec.setAttribute('aria-pressed', String(recording));
    }
    if (playing !== undefined) {
      this.el.play.textContent = playing ? '■ STOP' : '▶ PLAY';
      this.el.play.setAttribute('aria-pressed', String(playing));
    }
    const state = recording ? 'REC' : playing ? 'PLAY' : 'STOP';
    this.el.lcdLoop.textContent = `LOOP:${state} ·${eventCount ?? 0}`;
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
