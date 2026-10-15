import { DOCK_POSITION, throwerHand } from './thrower-art.ts';

export type ThrowAnimation = 'toss' | 'overhand' | 'spread';
export type ThrowFacing = -1 | 1;
export interface ThrowPlan { animation: ThrowAnimation; lucky: boolean }
export interface ThrowEvent extends ThrowPlan { id: number; startedAt: number; facing: ThrowFacing }
export const THROWER_FRAMES = ['empty', 'rest', 'toss-windup', 'toss-release', 'toss-follow',
  'overhand-windup', 'overhand-release', 'overhand-follow', 'spread-windup', 'spread-release',
  'spread-follow', 'recover', 'toss-anticipate', 'toss-drive', 'toss-settle', 'toss-return',
  'overhand-anticipate', 'overhand-drive', 'overhand-settle', 'overhand-return',
  'spread-anticipate', 'spread-drive', 'spread-settle', 'spread-return'] as const;
export type ThrowerFrame = typeof THROWER_FRAMES[number];
export interface ThrowerPose { frame: ThrowerFrame; hand: { x: number; y: number } }
interface ThrowMotion {
  weight: number; releaseDelay: number; duration: number; flightScale: number; arcScale: number;
  frames: { at: number; frame: ThrowerFrame }[];
}

export const LUCKY_CHANCE = 0.02;
export const LUCKY_BONUS_POINTS = 50;
// Let players follow the pellet arc and give birds time to react before it lands.
export const PELLET_FLIGHT_TIME_SCALE = 2.5;
export const THROW_MOTIONS: Record<ThrowAnimation, ThrowMotion> = {
  toss: {
    weight: 0.6, releaseDelay: 0.26, duration: 0.84, flightScale: 0.82, arcScale: 0.85,
    frames: [{ at: 0, frame: 'rest' }, { at: 0.04, frame: 'toss-anticipate' },
      { at: 0.1, frame: 'toss-windup' }, { at: 0.18, frame: 'toss-drive' },
      { at: 0.26, frame: 'toss-release' }, { at: 0.38, frame: 'toss-follow' },
      { at: 0.48, frame: 'toss-settle' }, { at: 0.6, frame: 'recover' },
      { at: 0.72, frame: 'toss-return' }, { at: 0.84, frame: 'rest' }],
  },
  overhand: {
    weight: 0.3, releaseDelay: 0.44, duration: 1.08, flightScale: 1.08, arcScale: 1.35,
    frames: [{ at: 0, frame: 'rest' }, { at: 0.06, frame: 'overhand-anticipate' },
      { at: 0.12, frame: 'overhand-windup' }, { at: 0.32, frame: 'overhand-drive' },
      { at: 0.44, frame: 'overhand-release' }, { at: 0.54, frame: 'overhand-settle' },
      { at: 0.66, frame: 'overhand-follow' }, { at: 0.8, frame: 'recover' },
      { at: 0.94, frame: 'overhand-return' }, { at: 1.08, frame: 'rest' }],
  },
  spread: {
    weight: 0.1, releaseDelay: 0.32, duration: 0.96, flightScale: 0.9, arcScale: 0.65,
    frames: [{ at: 0, frame: 'rest' }, { at: 0.06, frame: 'spread-anticipate' },
      { at: 0.12, frame: 'spread-windup' }, { at: 0.22, frame: 'spread-drive' },
      { at: 0.32, frame: 'spread-release' }, { at: 0.46, frame: 'spread-follow' },
      { at: 0.58, frame: 'spread-settle' }, { at: 0.7, frame: 'recover' },
      { at: 0.84, frame: 'spread-return' }, { at: 0.96, frame: 'rest' }],
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

export function throwerPose(animation: ThrowAnimation, age: number, facing: ThrowFacing = -1): ThrowerPose {
  const frames = THROW_MOTIONS[animation].frames;
  let frame: ThrowerFrame = 'rest';
  for (const pose of frames) {
    if (Math.max(0, age) < pose.at) break;
    frame = pose.frame;
  }
  return { frame, hand: throwerHand(frame, facing) };
}

export function releaseOrigin(animation: ThrowAnimation, facing: ThrowFacing = -1): { x: number; y: number } {
  return throwerHand(`${animation}-release`, facing);
}

export function releaseHeight(animation: ThrowAnimation): number {
  return DOCK_POSITION.y - releaseOrigin(animation).y;
}
