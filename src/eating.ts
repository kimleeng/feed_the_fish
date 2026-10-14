import type { Animal, AnimalProfile } from './simulation.ts';
import type { Direction } from './appearance.ts';

export const EATING_ATLAS = 'animal-eating';
export type EatingStage = 'bite' | 'chew' | 'swallow' | 'rest';
export interface Meal { duration: number; amount: number }

// A small scrap still needs a bite and swallow, but less time working the food.
// Full bites retain each species' established feeding pace.
export function eatingDuration(profile: Pick<AnimalProfile, 'chew' | 'bite'>, amount: number): number {
  const portion = Math.max(0, Math.min(1, amount / profile.bite));
  return profile.chew * (0.55 + 0.45 * portion);
}

const BITE_CADENCE: Record<string, number> = {
  koi: 0.7, carp: 0.48, minnow: 0.24, duck: 0.6, gull: 0.3, coot: 0.55, 'musk-turtle': 0.9,
};

export function eatingStage(animal: Animal): EatingStage | null {
  if (animal.state !== 'chewing' || animal.chewLeft <= 0 || !animal.meal) return null;
  const duration = animal.meal.duration;
  const elapsed = Math.max(0, duration - animal.chewLeft);
  const settle = Math.min(0.14, duration * 0.12);
  const swallow = Math.min(0.38, duration * 0.24);
  const bite = Math.min(0.2, duration * 0.2);
  if (animal.chewLeft <= settle) return 'rest';
  if (animal.chewLeft <= swallow + settle) return 'swallow';
  if (elapsed < bite) return 'bite';
  const phase = (elapsed - bite) % (BITE_CADENCE[animal.profile.id] ?? 0.5);
  return phase < (BITE_CADENCE[animal.profile.id] ?? 0.5) * 0.58 ? 'chew' : 'bite';
}

export function eatingFrame(animal: Animal, direction: Direction): string | null {
  const stage = eatingStage(animal);
  if (!stage || stage === 'rest') return null;
  const pose = stage === 'swallow' && animal.profile.kind === 'fish' ? 'chew' : stage;
  return `${animal.profile.texture}-${direction}-${pose}`;
}
