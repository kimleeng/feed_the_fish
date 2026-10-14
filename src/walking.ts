export const WALK_FRAMES = 48;
export const WALK_DISTANCE = { adult: 0.46, kid: 0.4, employee: 0.5 };
export const WALK_STANCE = 0.58;

export function walkingFrame(cycles: number): number {
  return Math.min(WALK_FRAMES - 1, Math.floor((cycles - Math.floor(cycles)) * WALK_FRAMES + 1e-7));
}

// Hold the supporting shoe still between the small, baked gait samples.
export function walkingOffset(cycles: number, distance: number): number {
  const phase = cycles - Math.floor(cycles);
  return -(phase - walkingFrame(cycles) / WALK_FRAMES) * distance;
}

export function walkingFoot(cycles: number, leg: number, distance: number, lift: number) {
  const phase = (cycles + leg * 0.5) - Math.floor(cycles + leg * 0.5);
  const reach = distance * WALK_STANCE / 2;
  if (phase <= WALK_STANCE) return { x: reach - phase * distance, y: 0, planted: true };
  const swing = (phase - WALK_STANCE) / (1 - WALK_STANCE);
  return { x: -reach + 2 * reach * pathBlend(swing), y: -(Math.sin(Math.PI * swing) ** 2) * lift, planted: false };
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
