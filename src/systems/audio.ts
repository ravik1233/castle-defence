/**
 * Sound.
 *
 * Every effect is synthesised with the WebAudio API at runtime - no audio
 * files, so the download stays tiny and nothing has to be licensed. The music
 * bed is a slow generative chord progression in D minor that reacts to how
 * badly the battle is going.
 */
import { profile } from './profile';

type Wave = OscillatorType;

class Audio {
  private ctx?: AudioContext;
  private master?: GainNode;
  private musicGain?: GainNode;
  private sfxGain?: GainNode;
  private musicTimer?: number;
  private step = 0;
  private tension = 0;

  /** Must be called from a user gesture on mobile browsers. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor =
      (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = profile.settings.music ? 0.18 : 0;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = profile.settings.sfx ? 0.7 : 0;
      this.sfxGain.connect(this.master);
    } catch {
      /* audio is optional */
    }
  }

  applySettings(): void {
    if (this.musicGain) this.musicGain.gain.value = profile.settings.music ? 0.18 : 0;
    if (this.sfxGain) this.sfxGain.gain.value = profile.settings.sfx ? 0.7 : 0;
  }

  private tone(
    freq: number,
    duration: number,
    type: Wave,
    gain: number,
    when = 0,
    sweepTo?: number,
  ): void {
    const ctx = this.ctx;
    const dest = this.sfxGain;
    if (!ctx || !dest) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (sweepTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  private noise(duration: number, gain: number, filterHz: number, when = 0): void {
    const ctx = this.ctx;
    const dest = this.sfxGain;
    if (!ctx || !dest) return;
    const t = ctx.currentTime + when;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterHz;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(t);
  }

  play(id: SfxId): void {
    if (!this.ctx || !profile.settings.sfx) return;
    switch (id) {
      case 'tap':
        this.tone(660, 0.07, 'triangle', 0.16);
        break;
      case 'place':
        this.tone(320, 0.1, 'triangle', 0.2);
        this.tone(480, 0.12, 'sine', 0.14, 0.05);
        break;
      case 'deny':
        this.tone(180, 0.14, 'sawtooth', 0.14, 0, 110);
        break;
      case 'coin':
        this.tone(880, 0.07, 'square', 0.1);
        this.tone(1320, 0.1, 'square', 0.08, 0.06);
        break;
      case 'melee':
        this.noise(0.09, 0.22, 2400);
        this.tone(220, 0.07, 'square', 0.1);
        break;
      case 'arrow':
        this.noise(0.06, 0.12, 5200);
        this.tone(1200, 0.05, 'sine', 0.06, 0, 700);
        break;
      case 'magic':
        this.tone(520, 0.22, 'sine', 0.14, 0, 980);
        this.tone(780, 0.18, 'triangle', 0.08, 0.04);
        break;
      case 'cannon':
        this.noise(0.3, 0.4, 900);
        this.tone(90, 0.28, 'sawtooth', 0.22, 0, 45);
        break;
      case 'explode':
        this.noise(0.45, 0.45, 1400);
        this.tone(70, 0.4, 'sawtooth', 0.24, 0, 35);
        break;
      case 'hurt':
        this.tone(200, 0.1, 'sawtooth', 0.1, 0, 130);
        break;
      case 'die':
        this.tone(300, 0.22, 'triangle', 0.12, 0, 90);
        this.noise(0.18, 0.16, 1800, 0.02);
        break;
      case 'wave':
        this.tone(140, 0.5, 'sawtooth', 0.16, 0, 200);
        this.tone(210, 0.5, 'sawtooth', 0.12, 0.08, 300);
        break;
      case 'victory':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.34, 'triangle', 0.2, i * 0.13));
        break;
      case 'defeat':
        [392, 349, 294, 220].forEach((f, i) => this.tone(f, 0.5, 'sawtooth', 0.18, i * 0.19));
        break;
      case 'smite':
        this.tone(1400, 0.4, 'sine', 0.2, 0, 300);
        this.noise(0.35, 0.3, 3200, 0.05);
        break;
      case 'freeze':
        this.tone(1800, 0.5, 'sine', 0.14, 0, 600);
        this.tone(2400, 0.4, 'triangle', 0.08, 0.06, 900);
        break;
      case 'upgrade':
        [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.22, 'square', 0.12, i * 0.07));
        break;
      case 'gate':
        this.noise(0.6, 0.5, 600);
        this.tone(60, 0.6, 'square', 0.26, 0, 30);
        break;
      default:
        break;
    }
  }

  /* --------------------------------------------------------------- music - */

  /** 0 = calm, 1 = the wall is about to fall. Shapes the music bed. */
  setTension(v: number): void {
    this.tension = Math.max(0, Math.min(1, v));
  }

  startMusic(): void {
    if (!this.ctx || this.musicTimer !== undefined) return;
    const beat = (): void => {
      this.musicStep();
      this.musicTimer = globalThis.setTimeout(beat, 2000 - this.tension * 700);
    };
    beat();
  }

  stopMusic(): void {
    if (this.musicTimer !== undefined) {
      clearTimeout(this.musicTimer);
      this.musicTimer = undefined;
    }
  }

  private musicStep(): void {
    const ctx = this.ctx;
    const dest = this.musicGain;
    if (!ctx || !dest || !profile.settings.music) return;
    // D minor: i - VI - III - VII, the classic "hold the line" progression.
    const roots = [146.83, 116.54, 174.61, 130.81];
    const root = roots[this.step % roots.length]!;
    this.step += 1;
    const chord = [root, root * 1.19, root * 1.5, root * 2];
    const t = ctx.currentTime;
    const dur = 2.4;
    for (const [i, f] of chord.entries()) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09 - i * 0.015 + this.tension * 0.04, t + 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(dest);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    }
    if (this.tension > 0.4) {
      // war drum under the chords when things get bad
      const g = ctx.createGain();
      g.gain.value = this.tension * 0.4;
      g.connect(dest);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(70, t);
      osc.frequency.exponentialRampToValueAtTime(35, t + 0.25);
      const eg = ctx.createGain();
      eg.gain.setValueAtTime(0.5, t);
      eg.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(eg);
      eg.connect(g);
      osc.start(t);
      osc.stop(t + 0.35);
    }
  }
}

export type SfxId =
  | 'tap'
  | 'place'
  | 'deny'
  | 'coin'
  | 'melee'
  | 'arrow'
  | 'magic'
  | 'cannon'
  | 'explode'
  | 'hurt'
  | 'die'
  | 'wave'
  | 'victory'
  | 'defeat'
  | 'smite'
  | 'freeze'
  | 'upgrade'
  | 'gate';

export const audio = new Audio();

/** Short haptic pulse where the platform supports it. */
export function haptic(ms = 12): void {
  if (!profile.settings.haptics) return;
  try {
    (navigator as unknown as { vibrate?: (p: number) => void }).vibrate?.(ms);
  } catch {
    /* not supported */
  }
}
