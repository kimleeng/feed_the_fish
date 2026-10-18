import { WALKING_GAIT } from './walking-gait.ts';

export const WALK_ATLAS = 'people-walking';
export type WalkingDesign = keyof typeof WALKING_GAIT;

export function walkingFrames(design: WalkingDesign): number {
  return WALKING_GAIT[design].frames;
}

export function walkingFrame(cycles: number, design: WalkingDesign): number {
  const phases: readonly number[] = WALKING_GAIT[design].phases;
  const progress = cycles - Math.floor(cycles);
  for (let index = phases.length - 1; index > 0; index--) {
    if (progress + 1e-7 >= phases[index]) return index;
  }
  return 0;
}

export function walkingDistance(design: WalkingDesign, height: number): number {
  // One complete pair of drawn steps must cover its measured ground distance.
  // Shorter illustrated steps give a quicker cadence at the same path speed.
  return WALKING_GAIT[design].distance * height;
}

export function walkingPace(design: WalkingDesign, height: number): number | undefined {
  const gait = WALKING_GAIT[design];
  return 'seconds' in gait ? walkingDistance(design, height) / gait.seconds : undefined;
}

export function walkingAdvance(velocity: number, speed: number, remaining: number,
  acceleration: number, seconds: number): { velocity: number; distance: number } {
  if (seconds <= 0 || remaining <= 0) return { velocity, distance: 0 };
  const target = Math.min(speed, Math.sqrt(2 * acceleration * remaining));
  const next = velocity + Math.max(-acceleration * seconds, Math.min(acceleration * seconds, target - velocity));
  const distance = Math.min(remaining, (velocity + next) * 0.5 * seconds);
  return { velocity: distance === remaining ? 0 : next, distance };
}

export function pathBlend(progress: number): number {
  const t = Math.max(0, Math.min(1, progress));
  return t * t * (3 - 2 * t);
}
