/**
 * Graphics quality.
 *
 * Android spans a decade of hardware. Rather than shipping one setting that
 * is wrong for half of it, the game guesses a tier from what the device
 * reports, then watches the actual frame rate and drops a tier if it cannot
 * keep up. The player can override it in Settings.
 */
import type Phaser from 'phaser';
import { profile } from './profile';

export type QualityTier = 'high' | 'low';
export type QualitySetting = 'auto' | QualityTier;

interface DeviceHints {
  memoryGb?: number;
  cores?: number;
}

function hints(): DeviceHints {
  const n = navigator as unknown as { deviceMemory?: number; hardwareConcurrency?: number };
  return { memoryGb: n.deviceMemory, cores: n.hardwareConcurrency };
}

/** First guess, before a single frame has been drawn. */
export function guessTier(): QualityTier {
  const { memoryGb, cores } = hints();
  if (memoryGb !== undefined && memoryGb <= 3) return 'low';
  if (cores !== undefined && cores <= 4) return 'low';
  return 'high';
}

class Quality {
  private tier: QualityTier = guessTier();
  private samples: number[] = [];
  private locked = false;

  get current(): QualityTier {
    const setting = profile.settings.quality ?? 'auto';
    return setting === 'auto' ? this.tier : setting;
  }

  /** 0..1 multiplier for decorative effects. */
  get effects(): number {
    return this.current === 'high' ? 1 : 0.35;
  }

  /** Particles per burst. */
  get particleScale(): number {
    return this.current === 'high' ? 1 : 0.45;
  }

  /**
   * Watches the frame rate for the first few seconds of a battle and drops to
   * the low tier if the device is clearly struggling. Only ever downgrades,
   * and only once, so the picture never oscillates mid-fight.
   */
  sample(game: Phaser.Game): void {
    if (this.locked || (profile.settings.quality ?? 'auto') !== 'auto') return;
    const fps = game.loop.actualFps;
    if (!Number.isFinite(fps) || fps <= 0) return;
    this.samples.push(fps);
    if (this.samples.length < 90) return;
    const median = [...this.samples].sort((a, b) => a - b)[Math.floor(this.samples.length / 2)]!;
    this.locked = true;
    this.samples = [];
    if (median < 45 && this.tier === 'high') this.tier = 'low';
  }

  /** Called when the player changes the setting by hand. */
  reset(): void {
    this.samples = [];
    this.locked = false;
    this.tier = guessTier();
  }

  describe(): string {
    const setting = profile.settings.quality ?? 'auto';
    return setting === 'auto' ? `AUTO (${this.current})` : setting.toUpperCase();
  }
}

export const quality = new Quality();
