import type { Observer } from './observers.ts';
import { WALK_ATLAS, walkingDistance, walkingFrame, type WalkingDesign } from './walking.ts';
import { OBSERVER_LOOKS } from './observer-looks.ts';
import { ORIGINAL_WALK_ATLAS, ORIGINAL_WALKING_GAIT } from './original-walking.ts';

export function observerAtlas(person: Observer): string {
  return person.state === 'watching' && !OBSERVER_LOOKS[person.age][person.look].watchingInSheet
    ? 'garden-observers' : person.walkVersion === 'original' ? ORIGINAL_WALK_ATLAS : WALK_ATLAS;
}

export function observerFrame(person: Observer): string {
  const design = `observer-${person.age}-${person.look}` as WalkingDesign;
  const cycles = person.stride / 4;
  const index = person.walkVersion === 'original'
    ? Math.floor((cycles - Math.floor(cycles)) * ORIGINAL_WALKING_GAIT[person.age].frames)
    : walkingFrame(cycles, design);
  const pose = person.state === 'watching' ? 'watch' : `step-${index}`;
  return `${design}-${pose}`;
}

export function observerHeight(person: Observer): number {
  const perspective = person.walkVersion ? 1 : 1 + (person.y - 760) * 0.0008;
  // Heights in game pixels, measured against the existing foreground benches.
  return OBSERVER_LOOKS[person.age][person.look].height * person.scale * perspective;
}

export function walkingCycleDistance(person: Observer): number {
  if (person.walkVersion === 'original') return ORIGINAL_WALKING_GAIT[person.age].distance * observerHeight(person);
  return walkingDistance(`observer-${person.age}-${person.look}` as WalkingDesign, observerHeight(person));
}
