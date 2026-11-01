import type { Observer, ObserverAge } from './observers.ts';
import { gestureFrame } from './idles.ts';

export const OBSERVER_IDLE_DURATIONS = {
  'look-around': [1.8, 2.6], 'weight-shift': [1.6, 2.4],
  'adjust-clothes': [2, 3], stretch: [2.4, 3.5], point: [2, 3.2], 'lean-watch': [2.2, 3.4],
} as const;
export type ObserverIdleHabit = keyof typeof OBSERVER_IDLE_DURATIONS;
export const OBSERVER_SIGNATURES: Record<ObserverAge, readonly ObserverIdleHabit[]> = {
  adult: ['adjust-clothes', 'stretch', 'point', 'adjust-clothes', 'adjust-clothes', 'lean-watch'],
  kid: ['lean-watch', 'point', 'stretch', 'adjust-clothes', 'adjust-clothes', 'lean-watch'],
};
export interface ObserverIdleState {
  favoriteHabit: ObserverIdleHabit; habitSide: number; habitTempo: number; nextIdleAt: number;
  idle: { habit: ObserverIdleHabit; elapsed: number; duration: number } | null;
}

export function observerHabits(age: ObserverAge, look: number, elapsed: number, random: () => number): ObserverIdleState {
  const signature = OBSERVER_SIGNATURES[age][look];
  const roll = random();
  return { favoriteHabit: roll < 0.8 ? signature : roll < 0.9 ? 'look-around' : 'weight-shift',
    habitSide: random() < 0.5 ? -1 : 1, habitTempo: 0.9 + random() * 0.2,
    nextIdleAt: elapsed + 2 + random() * 4, idle: null };
}

export function observerIdlePose(person: Observer, reducedMotion = false): { frame: string | null; x: number; angle: number } {
  const pose = { frame: null as string | null, x: 0, angle: 0 };
  if (reducedMotion || person.state !== 'watching' || !person.idle) return pose;
  const action = person.idle;
  const t = Math.max(0, Math.min(1, action.elapsed / action.duration));
  const envelope = Math.sin(Math.PI * t) ** 2;
  if (action.habit === 'look-around') pose.angle = person.habitSide * Math.sin(t * Math.PI * 2) * envelope * 1.8;
  else if (action.habit === 'weight-shift') pose.x = person.habitSide * envelope * 1.8;
  else if (t >= 0.16 && t < 0.9) pose.frame = `observer-${person.age}-${person.look}-idle-${gestureFrame(t)}`;
  return pose;
}
