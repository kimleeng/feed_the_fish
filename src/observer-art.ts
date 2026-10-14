import type { Observer } from './observers.ts';

const WALK_CYCLE = [0, 1, 2, 1];
// Heights in game pixels, measured against the existing foreground benches.
const HEIGHTS = { adult: [158, 153, 149], kid: [109, 115, 96] };

export function observerFrame(person: Observer): string {
  const pose = person.state === 'watching' ? 'watch' : 'walk-' + WALK_CYCLE[Math.floor(person.stride) % 4];
  return `observer-${person.age}-${person.look}-${pose}`;
}

export function observerHeight(person: Observer): number {
  const perspective = 1 + (person.y - 760) * 0.0008;
  return HEIGHTS[person.age][person.look] * person.scale * perspective;
}
