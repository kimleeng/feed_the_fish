import { FLOAT_SECONDS, type PondSimulation, type AnimalKind, type Animal } from './simulation.ts';
import { hasEatenRecently } from './animal-energy.ts';

export interface AnimalDebugMetrics {
  id: number; name: string; kind: AnimalKind; state: Animal['state'];
  hungry: boolean; boostCharge: number | null; boosting: boolean;
  secondsSinceMeal: number | null; totalEaten: number; basePace: number;
}
export interface DebugMetrics {
  elapsed: number; hungry: number; recentlyFed: number; boosting: number; airborneBirds: number;
  pellets: { queued: number; air: number; floating: number; underwater: number };
  animals: AnimalDebugMetrics[];
}

/** A read-only snapshot; opening debug mode never advances the simulation. */
export function debugMetrics(world: PondSimulation): DebugMetrics {
  const animals = world.animals.map(animal => ({
    id: animal.id, name: animal.profile.name, kind: animal.profile.kind, state: animal.state,
    hungry: !hasEatenRecently(animal, world.elapsed),
    boostCharge: animal.profile.kind === 'turtle' ? null : animal.boostCharge,
    boosting: animal.boosting,
    secondsSinceMeal: animal.lastAteAt === null ? null : Math.max(0, world.elapsed - animal.lastAteAt),
    totalEaten: animal.totalEaten, basePace: animal.profile.speed,
  }));
  const pellets = { queued: 0, air: 0, floating: 0, underwater: 0 };
  for (const food of world.food) {
    if (food.amount <= 0.001) continue;
    if (world.elapsed < food.releaseAt) pellets.queued++;
    else if (food.phase === 'air') pellets.air++;
    else if (food.age <= FLOAT_SECONDS) pellets.floating++;
    else pellets.underwater++;
  }
  return {
    elapsed: world.elapsed,
    hungry: animals.filter(animal => animal.hungry).length,
    recentlyFed: animals.filter(animal => !animal.hungry).length,
    boosting: animals.filter(animal => animal.boosting).length,
    airborneBirds: world.animals.filter(animal => animal.flight).length,
    pellets, animals,
  };
}
