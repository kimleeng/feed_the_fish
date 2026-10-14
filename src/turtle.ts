import { TURTLE_SURFACE_SECONDS, type Animal } from './simulation.ts';

// Keep the turtle hidden underwater; a meal reveals only its raised head.
export const SHOW_TURTLE_UNDERWATER = false;

export function turtleSurfaceAmount(animal: Animal): number {
  if (animal.surfaceLeft <= 0) return 0;
  const amount = Math.max(0, Math.min(1, (TURTLE_SURFACE_SECONDS - animal.surfaceLeft) / 0.35, animal.surfaceLeft / 0.75));
  return amount * amount * (3 - 2 * amount);
}
