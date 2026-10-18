import type { Observer } from './observers.ts';
import { WALK_ATLAS, walkingDistance, walkingFrame, type WalkingDesign } from './walking.ts';
import { OBSERVER_LOOKS } from './observer-looks.ts';

export function observerAtlas(person: Observer): string {
  return person.state === 'watching' && !OBSERVER_LOOKS[person.age][person.look].watchingInSheet
    ? 'garden-observers' : WALK_ATLAS;
}

export function observerFrame(person: Observer): string {
  const design = `observer-${person.age}-${person.look}` as WalkingDesign;
  const cycles = person.stride / 4;
  const index = walkingFrame(cycles, design);
  const pose = person.state === 'watching' ? 'watch' : `step-${index}`;
  return `${design}-${pose}`;
}

export function observerHeight(person: Observer): number {
  const perspective = person.walkReview ? 1 : 1 + (person.y - 760) * 0.0008;
  // Heights in game pixels, measured against the existing foreground benches.
  return OBSERVER_LOOKS[person.age][person.look].height * person.scale * perspective;
}

export function walkingCycleDistance(person: Observer): number {
  return walkingDistance(`observer-${person.age}-${person.look}` as WalkingDesign, observerHeight(person));
}
