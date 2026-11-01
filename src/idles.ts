// Durations include settling into and out of the gesture; no action holds an
// animal away from food for more than 4.5 seconds.
export const IDLE_DURATIONS = {
  linger: [2.2, 3.4], 'look-around': [2, 3], 'slow-turn': [2.5, 3.5],
  dip: [1.8, 2.6], bob: [1.5, 2.2], shimmy: [1.5, 2],
  'fin-fan': [2.6, 3.5], 'lazy-arc': [3.5, 4.5],
  'bottom-nose': [2.4, 3.4], 'tail-flick': [1.5, 2.1],
  'dart-pause': [1.6, 2.4], zigzag: [1.8, 2.6],
  preen: [2.8, 4.2], dabble: [2.2, 3.2],
  'wing-stretch': [2.5, 3.8], scratch: [1.7, 2.6],
  'double-nod': [1.5, 2.2], 'foot-paddle': [1.8, 2.7],
} as const;
export type IdleHabit = keyof typeof IDLE_DURATIONS;
export const IDLE_HABITS: Record<string, readonly IdleHabit[]> = {
  koi: ['linger', 'slow-turn', 'dip', 'fin-fan', 'lazy-arc'],
  carp: ['linger', 'dip', 'slow-turn', 'bottom-nose', 'tail-flick'],
  minnow: ['linger', 'shimmy', 'slow-turn', 'dart-pause', 'zigzag'],
  duck: ['look-around', 'dip', 'bob', 'preen', 'dabble'],
  gull: ['look-around', 'slow-turn', 'shimmy', 'wing-stretch', 'scratch'],
  coot: ['look-around', 'bob', 'dip', 'double-nod', 'foot-paddle'],
};
export const BIRD_IDLE_STRIPS = ['preen', 'dabble', 'wing-stretch', 'scratch', 'double-nod', 'foot-paddle'] as const;
export interface IdleAction { habit: IdleHabit; elapsed: number; duration: number; heading: number }
export interface IdlePose {
  turn: number; pace: number; y: number; scaleX: number; scaleY: number;
  alpha: number; roll: number; stroke: number; birdFrame: string | null;
}
const smooth = (t: number): number => t * t * (3 - 2 * t);

// Playback returns to the resting pose at both ends. More time is spent at the
// readable peak than in the anticipation, with a second nod/scratch when needed.
export function gestureFrame(progress: number, repeat = false): number {
  const t = Math.max(0, Math.min(1, progress));
  if (t < 0.16 || t >= 0.9) return 0;
  if (t < 0.32) return 1;
  if (repeat && t > 0.49 && t < 0.61) return 1;
  if (t < 0.72) return 2;
  return 3;
}

export function idlePose(action: IdleAction | null, side = 1, intensity = 1): IdlePose {
  const pose: IdlePose = { turn: 0, pace: 0, y: 0, scaleX: 1, scaleY: 1, alpha: 1, roll: 0, stroke: 0, birdFrame: null };
  if (!action) return pose;
  const t = Math.max(0, Math.min(1, action.elapsed / action.duration));
  const envelope = Math.sin(Math.PI * t) ** 2;
  const wave = (cycles: number): number => Math.sin(t * Math.PI * 2 * cycles) * envelope * intensity;
  switch (action.habit) {
    case 'linger': pose.y = -envelope * 0.8; pose.scaleX += envelope * 0.015; break;
    case 'look-around': pose.turn = side * wave(1.5) * 0.8; break;
    case 'slow-turn': pose.turn = side * Math.PI * 0.8 * smooth(t); break;
    case 'dip': pose.y = envelope * 3; pose.scaleY -= envelope * 0.12; pose.alpha -= envelope * 0.15; break;
    case 'bob': pose.y = wave(2) * 2.5; break;
    case 'shimmy': pose.turn = side * wave(3) * 0.16; pose.roll = wave(3) * 0.04; break;
    case 'fin-fan':
      pose.scaleY += Math.abs(wave(2)) * 0.08;
      pose.stroke = Math.floor(t * 6) % 2; pose.y = -envelope * 1.5; break;
    case 'lazy-arc': pose.turn = side * Math.PI * 0.85 * smooth(t); pose.pace = envelope * 0.5; break;
    case 'bottom-nose':
      pose.scaleY -= envelope * 0.18; pose.alpha -= envelope * 0.35;
      pose.y = envelope * 5; pose.roll = side * envelope * 0.08; break;
    case 'tail-flick':
      pose.turn = side * wave(2) * 0.4; pose.stroke = Math.floor(t * 10) % 2;
      pose.pace = envelope * 0.16; break;
    case 'dart-pause':
      pose.pace = t > 0.28 && t < 0.58 ? Math.sin((t - 0.28) / 0.3 * Math.PI) * 0.8 : 0;
      pose.turn = side * envelope * 0.25; pose.stroke = pose.pace > 0.1 ? Math.floor(t * 12) % 2 : 0; break;
    case 'zigzag': pose.turn = side * wave(1.5) * 0.75; pose.pace = envelope * 0.45; pose.stroke = Math.floor(t * 10) % 2; break;
    default:
      pose.birdFrame = `${action.habit}-${gestureFrame(t, action.habit === 'scratch' || action.habit === 'double-nod')}`;
  }
  return pose;
}

export function usesBirdStrip(habit: IdleHabit): boolean {
  return (BIRD_IDLE_STRIPS as readonly string[]).includes(habit);
}
