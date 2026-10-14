import type { ThrowerFrame, ThrowFacing } from './throws.ts';
import { THROWER_HAND_OFFSETS } from './thrower-pins.ts';
import { THROWER_INTERMEDIATE_HANDS } from './thrower-inbetweens.ts';

export const DOCK_POSITION = { x: 600, y: 684 };
export const THROWER_HEIGHT = 145;

// Hand positions relative to the planted feet, calibrated to the full-body artwork.
export const THROWER_HANDS: Record<ThrowerFrame, { x: number; y: number }> = { ...THROWER_HAND_OFFSETS, ...THROWER_INTERMEDIATE_HANDS };

export function throwerHand(frame: ThrowerFrame, facing: ThrowFacing = -1): { x: number; y: number } {
  const hand = THROWER_HANDS[frame];
  return { x: DOCK_POSITION.x - hand.x * facing, y: DOCK_POSITION.y + hand.y };
}
