import type { Animal } from './simulation.ts';

// Set true to keep the underwater body visible between feeding peeks.
export const SHOW_TURTLE_UNDERWATER = false;

export function turtleSurfaceAmount(animal: Animal): number {
  if (animal.surfaceLeft <= 0) return 0;
  const amount = Math.max(0, Math.min(1, (animal.surfaceDuration - animal.surfaceLeft) / 0.35, animal.surfaceLeft / 0.75));
  return amount * amount * (3 - 2 * amount);
}
