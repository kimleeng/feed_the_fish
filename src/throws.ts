import { DOCK_POSITION, throwerHand } from './thrower-art.ts';

export type ThrowAnimation = 'toss' | 'overhand' | 'spread';
export interface ThrowPlan { animation: ThrowAnimation; lucky: boolean }
export interface ThrowEvent extends ThrowPlan { id: number; startedAt: number }
export const THROWER_FRAMES = ['empty', 'rest', 'toss-windup', 'toss-release', 'toss-follow',
  'overhand-windup', 'overhand-release', 'overhand-follow', 'spread-windup', 'spread-release',
  'spread-follow', 'recover'] as const;
export type ThrowerFrame = typeof THROWER_FRAMES[number];
export interface ThrowerPose { frame: ThrowerFrame; hand: { x: number; y: number } }
interface ThrowMotion {
  weight: number; releaseDelay: number; duration: number; flightScale: number; arcScale: number;
  frames: { at: number; frame: ThrowerFrame }[];
}

export const LUCKY_CHANCE = 0.02;
export const LUCKY_BONUS_POINTS = 50;
export const THROW_MOTIONS: Record<ThrowAnimation, ThrowMotion> = {
  toss: {
    weight: 0.6, releaseDelay: 0.26, duration: 0.84, flightScale: 0.82, arcScale: 0.85,
    frames: [{ at: 0, frame: 'rest' }, { at: 0.1, frame: 'toss-windup' },
      { at: 0.26, frame: 'toss-release' }, { at: 0.38, frame: 'toss-follow' },
      { at: 0.6, frame: 'recover' }, { at: 0.84, frame: 'rest' }],
  },
  overhand: {
    weight: 0.3, releaseDelay: 0.44, duration: 1.08, flightScale: 1.08, arcScale: 1.35,
    frames: [{ at: 0, frame: 'rest' }, { at: 0.12, frame: 'overhand-windup' },
      { at: 0.44, frame: 'overhand-release' }, { at: 0.56, frame: 'overhand-follow' },
      { at: 0.8, frame: 'recover' }, { at: 1.08, frame: 'rest' }],
  },
  spread: {
    weight: 0.1, releaseDelay: 0.32, duration: 0.96, flightScale: 0.9, arcScale: 0.65,
    frames: [{ at: 0, frame: 'rest' }, { at: 0.12, frame: 'spread-windup' },
      { at: 0.32, frame: 'spread-release' }, { at: 0.46, frame: 'spread-follow' },
      { at: 0.7, frame: 'recover' }, { at: 0.96, frame: 'rest' }],
  },
};

export function planThrow(random: () => number): ThrowPlan {
  let remaining = random();
  let animation: ThrowAnimation = 'spread';
  for (const name of Object.keys(THROW_MOTIONS) as ThrowAnimation[]) {
    if (remaining < THROW_MOTIONS[name].weight) { animation = name; break; }
    remaining -= THROW_MOTIONS[name].weight;
  }
  return { animation, lucky: random() < LUCKY_CHANCE };
}

export function throwerPose(animation: ThrowAnimation, age: number): ThrowerPose {
  const frames = THROW_MOTIONS[animation].frames;
  let frame: ThrowerFrame = 'rest';
  for (const pose of frames) {
    if (Math.max(0, age) < pose.at) break;
    frame = pose.frame;
  }
  return { frame, hand: throwerHand(frame) };
}

export function releaseOrigin(animation: ThrowAnimation): { x: number; y: number } {
  return throwerHand(`${animation}-release`);
}

export function releaseHeight(animation: ThrowAnimation): number {
  return DOCK_POSITION.y - releaseOrigin(animation).y;
}
