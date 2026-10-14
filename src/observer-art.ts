import type { Observer } from './observers.ts';
import { WALK_ATLAS, walkingDistance, walkingFrame, type WalkingDesign } from './walking.ts';
import { OBSERVER_LOOKS } from './observer-looks.ts';

export function observerAtlas(person: Observer): string {
  return person.state === 'watching' && !OBSERVER_LOOKS[person.age][person.look].watchingInSheet
    ? 'garden-observers' : WALK_ATLAS;
}

export function observerFrame(person: Observer): string {
  const pose = person.state === 'watching' ? 'watch' : `step-${walkingFrame(person.stride / 4)}`;
  return `observer-${person.age}-${person.look}-${pose}`;
}

export function observerHeight(person: Observer): number {
  const perspective = 1 + (person.y - 760) * 0.0008;
  // Heights in game pixels, measured against the existing foreground benches.
  return OBSERVER_LOOKS[person.age][person.look].height * person.scale * perspective;
}

export function walkingCycleDistance(person: Observer): number {
  return walkingDistance(`observer-${person.age}-${person.look}` as WalkingDesign, observerHeight(person));
}
