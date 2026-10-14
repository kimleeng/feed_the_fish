import { WALKING_GAIT } from './walking-gait.ts';

export const WALK_ATLAS = 'people-walking';
export const WALK_FRAMES = 8;
export type WalkingDesign = keyof typeof WALKING_GAIT;

export function walkingFrame(cycles: number): number {
  return Math.min(WALK_FRAMES - 1, Math.floor((cycles - Math.floor(cycles)) * WALK_FRAMES + 1e-7));
}

export function walkingDistance(design: WalkingDesign, height: number): number {
  return WALKING_GAIT[design].distance * height;
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
