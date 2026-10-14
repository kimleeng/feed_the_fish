// In-betweens double the sampling of each cycle without speeding up the motion.
export const WALK_CYCLE = ['walk-0', 'walk-0-between', 'walk-1', 'walk-1-between',
  'walk-2', 'walk-2-between', 'walk-3', 'walk-3-between'] as const;
export const SWIM_CYCLE = [0, 2, 1, 3] as const;
export const ANIMATED_ATLASES = ['dock-thrower', 'garden-observers', 'garden-employee',
  'fish-swimmers', 'bird-swimmers', 'turtle-swimmer'] as const;

export interface AnimationFrameData {
  referenceHeight: number;
  hand?: { x: number; y: number };
  pour?: { x: number; y: number };
  feet?: { x: number; y: number }[];
}

export function animationFrameData(frame: { customData: object }): AnimationFrameData {
  return frame.customData as AnimationFrameData;
}
