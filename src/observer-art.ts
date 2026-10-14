import type { Observer } from './observers.ts';
import { WALK_DISTANCE, walkingFrame } from './walking.ts';

// Heights in game pixels, measured against the existing foreground benches.
const HEIGHTS = { adult: [158, 153, 149], kid: [109, 115, 96] };

export function observerFrame(person: Observer): string {
  const pose = person.state === 'watching' ? 'watch' : `gait-${walkingFrame(person.stride / 4)}`;
  return `observer-${person.age}-${person.look}-${pose}`;
}

export function observerHeight(person: Observer): number {
  const perspective = 1 + (person.y - 760) * 0.0008;
  return HEIGHTS[person.age][person.look] * person.scale * perspective;
}

export function walkingCycleDistance(person: Observer): number {
  return observerHeight(person) * WALK_DISTANCE[person.age];
}
