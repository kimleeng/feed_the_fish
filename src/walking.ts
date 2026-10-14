import { WALK_CYCLE } from './animation-frames.ts';

// Brief heel contact, then weight transfer, passing, and toe-off, on each foot.
// Distance drives this clock so slowing down also slows the legs.
const POSE_STARTS = [0, 0.1, 0.25, 0.36, 0.5, 0.6, 0.75, 0.86];

export function walkingPose(cycles: number): typeof WALK_CYCLE[number] {
  const phase = cycles - Math.floor(cycles);
  let index = 0;
  while (index + 1 < POSE_STARTS.length && phase >= POSE_STARTS[index + 1]) index++;
  return WALK_CYCLE[index];
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
