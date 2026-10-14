import { POND, inPond } from './simulation.ts';
import type { WindState } from './wind.ts';

interface ShimmerParticle {
  x: number; y: number; age: number; lifetime: number; width: number;
}

/** A small reusable particle pool; only the renderer decides how to draw it. */
export class WaterShimmer {
  private readonly pool: ShimmerParticle[];
  private readonly random: () => number;

  constructor(seed: number, count = 128) {
    let value = seed ^ 0x39b4e721;
    this.random = () => {
      value += 0x6d2b79f5;
      let hash = Math.imul(value ^ value >>> 15, 1 | value);
      hash ^= hash + Math.imul(hash ^ hash >>> 7, 61 | hash);
      return ((hash ^ hash >>> 14) >>> 0) / 4294967296;
    };
    this.pool = Array.from({ length: count }, () => {
      const particle = this.spawn();
      particle.age = this.random() * particle.lifetime;
      return particle;
    });
  }

  get particles(): readonly Readonly<ShimmerParticle>[] { return this.pool; }

  private spawn(): ShimmerParticle {
    const angle = this.random() * Math.PI * 2;
    const radius = Math.sqrt(this.random()) * 0.94;
    return {
      x: POND.x + Math.cos(angle) * POND.rx * radius,
      y: POND.y + Math.sin(angle) * POND.ry * radius,
      age: 0, lifetime: 2.8 + this.random() * 3.2, width: 8 + this.random() * 11,
    };
  }

  step(seconds: number, wind: WindState): void {
    if (seconds <= 0) return;
    for (const particle of this.pool) {
      particle.age += seconds;
      particle.x += wind.x * seconds * (25 + particle.width * 0.4);
      particle.y += wind.y * seconds * 19;
      if (particle.age >= particle.lifetime || !inPond(particle)) Object.assign(particle, this.spawn());
    }
  }
}
