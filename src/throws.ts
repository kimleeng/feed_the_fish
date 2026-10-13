export type ThrowAnimation = 'toss' | 'overhand' | 'spread';
export interface ThrowPlan { animation: ThrowAnimation; lucky: boolean }
export interface ThrowEvent extends ThrowPlan { id: number; startedAt: number }
export const HAND_FRAMES = ['rest', 'toss-windup', 'toss-release', 'overhand-windup', 'overhand-release',
  'overhand-follow', 'spread-ready', 'spread-windup', 'spread-release', 'spread-follow', 'recover', 'empty'] as const;
export type HandFrame = typeof HAND_FRAMES[number];
export interface HandPose { x: number; y: number; frame: HandFrame }
export const REST_HAND: HandPose = { x: 26, y: 18, frame: 'rest' };
interface Keyframe extends HandPose { at: number }
interface ThrowMotion {
  weight: number; releaseDelay: number; duration: number; flightScale: number; arcScale: number;
  frames: Keyframe[];
}

export const LUCKY_CHANCE = 0.02;
export const LUCKY_BONUS_POINTS = 50;
export const THROW_MOTIONS: Record<ThrowAnimation, ThrowMotion> = {
  toss: {
    weight: 0.6, releaseDelay: 0.11, duration: 0.4, flightScale: 0.82, arcScale: 0.85,
    frames: [
      { at: 0, ...REST_HAND }, { at: 0.045, x: 30, y: 26, frame: 'toss-windup' },
      { at: 0.11, x: 0, y: 0, frame: 'toss-release' }, { at: 0.185, x: -10, y: -12, frame: 'toss-release' },
      { at: 0.27, x: 5, y: 7, frame: 'recover' }, { at: 0.4, ...REST_HAND },
    ],
  },
  overhand: {
    weight: 0.3, releaseDelay: 0.3, duration: 0.72, flightScale: 1.08, arcScale: 1.35,
    frames: [
      { at: 0, ...REST_HAND }, { at: 0.09, x: 54, y: -12, frame: 'overhand-windup' },
      { at: 0.19, x: 46, y: -64, frame: 'overhand-windup' }, { at: 0.3, x: 0, y: 0, frame: 'overhand-release' },
      { at: 0.4, x: -14, y: -24, frame: 'overhand-follow' },
      { at: 0.54, x: 10, y: 2, frame: 'recover' }, { at: 0.72, ...REST_HAND },
    ],
  },
  spread: {
    weight: 0.1, releaseDelay: 0.19, duration: 0.56, flightScale: 0.9, arcScale: 0.65,
    frames: [
      { at: 0, ...REST_HAND, frame: 'spread-ready' }, { at: 0.07, x: 50, y: 20, frame: 'spread-windup' },
      { at: 0.19, x: 0, y: 0, frame: 'spread-release' }, { at: 0.29, x: -30, y: -8, frame: 'spread-follow' },
      { at: 0.41, x: 3, y: 10, frame: 'recover' }, { at: 0.56, ...REST_HAND },
    ],
  },
};

export function planThrow(random: () => number): ThrowPlan {
  const motion = random();
  let remaining = motion;
  let animation: ThrowAnimation = 'spread';
  for (const name of Object.keys(THROW_MOTIONS) as ThrowAnimation[]) {
    if (remaining < THROW_MOTIONS[name].weight) { animation = name; break; }
    remaining -= THROW_MOTIONS[name].weight;
  }
  return { animation, lucky: random() < LUCKY_CHANCE };
}

export function handPose(animation: ThrowAnimation, age: number): HandPose {
  const frames = THROW_MOTIONS[animation].frames;
  const elapsed = Math.max(0, age);
  for (let i = 1; i < frames.length; i++) {
    const from = frames[i - 1]; const to = frames[i];
    if (elapsed >= to.at) continue;
    const progress = Math.max(0, (elapsed - from.at) / (to.at - from.at));
    const eased = progress * progress * (3 - 2 * progress);
    return { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased, frame: from.frame };
  }
  return { ...REST_HAND };
}
