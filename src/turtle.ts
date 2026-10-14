import { TURTLE_SURFACE_SECONDS, type Animal } from './simulation.ts';

// Set false later to reveal only the head after feeding. It stays visible for now.
export const SHOW_TURTLE_UNDERWATER = true;

export function turtleSurfaceAmount(animal: Animal): number {
  if (animal.surfaceLeft <= 0) return 0;
  const amount = Math.max(0, Math.min(1, (TURTLE_SURFACE_SECONDS - animal.surfaceLeft) / 0.35, animal.surfaceLeft / 0.75));
  return amount * amount * (3 - 2 * amount);
}
