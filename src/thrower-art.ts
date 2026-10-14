import type { ThrowerFrame } from './throws.ts';
import { THROWER_HAND_OFFSETS } from './thrower-pins.ts';

export const DOCK_POSITION = { x: 600, y: 684 };
export const THROWER_HEIGHT = 145;

// Hand positions relative to the planted feet, calibrated to the full-body artwork.
export const THROWER_HANDS: Record<ThrowerFrame, { x: number; y: number }> = THROWER_HAND_OFFSETS;

export function throwerHand(frame: ThrowerFrame): { x: number; y: number } {
  const hand = THROWER_HANDS[frame];
  return { x: DOCK_POSITION.x + hand.x, y: DOCK_POSITION.y + hand.y };
}
