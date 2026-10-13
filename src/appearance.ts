import type { AnimalKind } from './simulation.ts';

// Screen coordinates: positive y points south. Frames follow this clockwise order.
export const DIRECTIONS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const;
export type Direction = typeof DIRECTIONS[number];
const OCTANT = Math.PI / 4;

export function directionForHeading(heading: number, previous?: Direction): Direction {
  if (previous) {
    const center = DIRECTIONS.indexOf(previous) * OCTANT;
    const difference = Math.atan2(Math.sin(heading - center), Math.cos(heading - center));
    // A little overlap prevents flickering between views during a gentle turn.
    if (Math.abs(difference) < OCTANT / 2 + 0.08) return previous;
  }
  return DIRECTIONS[((Math.round(heading / OCTANT) % 8) + 8) % 8];
}

export function animalAtlas(kind: AnimalKind): string {
  return kind === 'fish' ? 'fish-swimmers' : 'bird-swimmers';
}

export function animalFrame(texture: string, direction: Direction, stroke = 0): string {
  return `${texture}-${direction}-${stroke}`;
}
