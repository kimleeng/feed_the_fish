const TAU = Math.PI * 2;
export const WIND_SAMPLE_INTERVAL = 1;

export interface WindState {
  /** Seconds of unpaused simulation time. */
  readonly time: number;
  /** Radians clockwise from screen-right; positive y points down. */
  readonly direction: number;
  /** Normalized breeze strength, from 0 to 1. */
  readonly strength: number;
  /** Direction vector multiplied by strength, for other wind-driven effects. */
  readonly x: number;
  readonly y: number;
}

/** Shared weather with its own seed, independent of animal and throw randomness. */
export class WindSimulation {
  readonly seed: number;
  private readonly phases: number[];
  private state: WindState;
  private readonly samples: WindState[];
  private nextSample = 1;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    let value = this.seed ^ 0x7a5b39d1;
    this.phases = Array.from({ length: 5 }, () => {
      value += 0x6d2b79f5;
      let hash = Math.imul(value ^ value >>> 15, 1 | value);
      hash ^= hash + Math.imul(hash ^ hash >>> 7, 61 | hash);
      return ((hash ^ hash >>> 14) >>> 0) / 4294967296 * TAU;
    });
    this.state = this.sampleAt(0);
    this.samples = [this.state];
  }

  get current(): WindState { return this.state; }
  /** One sample per second for the current visit; nothing is persisted. */
  get history(): readonly WindState[] { return this.samples; }

  /** Reproduce any earlier instant from the seed without advancing the weather. */
  sampleAt(time: number): WindState {
    if (!Number.isFinite(time) || time < 0) throw new RangeError('Wind time must be finite and non-negative.');
    const [bearing, sway, turn, breeze, gust] = this.phases;
    const angle = bearing + Math.sin(time * 0.031 + sway) * 0.38 + Math.sin(time * 0.079 + turn) * 0.18;
    const direction = (angle % TAU + TAU) % TAU;
    const strength = 0.14 + (0.5 + Math.sin(time * 0.13 + breeze) * 0.5) * 0.29
      + (0.5 + Math.sin(time * 0.47 + gust) * 0.5) ** 4 * 0.25;
    return { time, direction, strength, x: Math.cos(direction) * strength, y: Math.sin(direction) * strength };
  }

  advanceTo(time: number): void {
    if (time < this.state.time) throw new RangeError('Wind time cannot move backwards.');
    this.state = this.sampleAt(time);
    const lastSample = Math.floor((time + 1e-9) / WIND_SAMPLE_INTERVAL);
    while (this.nextSample <= lastSample) {
      this.samples.push(this.sampleAt(this.nextSample * WIND_SAMPLE_INTERVAL));
      this.nextSample++;
    }
  }
}
