export type ThrowAnimation = 'toss' | 'sweep' | 'lob';
export interface ThrowPlan { animation: ThrowAnimation; lucky: boolean }
export interface ThrowEvent extends ThrowPlan { id: number; startedAt: number }
export interface HandPose { x: number; y: number; angle: number }
interface Keyframe extends HandPose { at: number }
interface ThrowMotion {
  weight: number; releaseDelay: number; duration: number; flightScale: number; arcScale: number;
  frames: Keyframe[];
}

export const LUCKY_CHANCE = 0.02;
export const LUCKY_BONUS_POINTS = 50;
export const THROW_MOTIONS: Record<ThrowAnimation, ThrowMotion> = {
  toss: {
    weight: 0.6, releaseDelay: 0.2, duration: 0.56, flightScale: 1, arcScale: 1,
    frames: [
      { at: 0, x: 0, y: 0, angle: 0 }, { at: 0.08, x: 0, y: 12, angle: 8 },
      { at: 0.2, x: 0, y: 0, angle: 0 }, { at: 0.32, x: 0, y: -12, angle: -5 },
      { at: 0.56, x: 0, y: 0, angle: 0 },
    ],
  },
  sweep: {
    weight: 0.3, releaseDelay: 0.3, duration: 0.84, flightScale: 0.84, arcScale: 0.8,
    frames: [
      { at: 0, x: 0, y: 0, angle: 0 }, { at: 0.13, x: -27, y: 12, angle: 14 },
      { at: 0.3, x: 0, y: 0, angle: 0 }, { at: 0.48, x: 24, y: -7, angle: -12 },
      { at: 0.84, x: 0, y: 0, angle: 0 },
    ],
  },
  lob: {
    weight: 0.1, releaseDelay: 0.4, duration: 1.05, flightScale: 1.2, arcScale: 1.3,
    frames: [
      { at: 0, x: 0, y: 0, angle: 0 }, { at: 0.2, x: 14, y: 26, angle: -10 },
      { at: 0.4, x: 0, y: 0, angle: 0 }, { at: 0.64, x: 0, y: -22, angle: 8 },
      { at: 1.05, x: 0, y: 0, angle: 0 },
    ],
  },
};

export function planThrow(random: () => number): ThrowPlan {
  const motion = random();
  let remaining = motion;
  let animation: ThrowAnimation = 'lob';
  for (const name of Object.keys(THROW_MOTIONS) as ThrowAnimation[]) {
    if (remaining < THROW_MOTIONS[name].weight) { animation = name; break; }
    remaining -= THROW_MOTIONS[name].weight;
  }
  return { animation, lucky: random() < LUCKY_CHANCE };
}

export function handPose(animation: ThrowAnimation, age: number): HandPose {
  const frames = THROW_MOTIONS[animation].frames;
  for (let i = 1; i < frames.length; i++) {
    const from = frames[i - 1]; const to = frames[i];
    if (age > to.at) continue;
    const progress = Math.max(0, (age - from.at) / (to.at - from.at));
    const eased = progress * progress * (3 - 2 * progress);
    return { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased, angle: from.angle + (to.angle - from.angle) * eased };
  }
  return { x: 0, y: 0, angle: 0 };
}
