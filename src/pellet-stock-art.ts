import { MACHINE_CAPACITY } from './vending.ts';

// Round the pouring animation to the same whole-pile drawings used by purchases.
export function pelletStockLevel(fillFraction: number): number {
  return fillFraction <= 0 ? 0 : Math.max(1, Math.min(MACHINE_CAPACITY, Math.round(fillFraction * MACHINE_CAPACITY)));
}
