import { EMPLOYEE_HEIGHT, RESTOCK_TIMING, type MachineEmployee } from './restocking.ts';
import { EMPLOYEE_STRIDE_RATIO } from './employee-pins.ts';
import { WALK_CYCLE } from './animation-frames.ts';

export function employeeFrame(person: MachineEmployee): string {
  if (person.walking) return WALK_CYCLE[Math.floor(person.distanceWalked / (EMPLOYEE_HEIGHT * EMPLOYEE_STRIDE_RATIO) * WALK_CYCLE.length) % WALK_CYCLE.length];
  const progress = person.phaseTime / (RESTOCK_TIMING[person.phase as keyof typeof RESTOCK_TIMING] ?? 1);
  if (person.phase === 'opening') return progress < 0.25 ? 'open-reach' : progress < 0.75 ? 'open' : 'open-return';
  if (person.phase === 'lifting') return progress < 0.25 ? 'lift-half' : progress < 0.5 ? 'lift-ready' : progress < 0.75 ? 'lift-tip' : 'lift';
  if (person.phase === 'pouring') return 'pour';
  if (person.phase === 'closing') return progress < 0.3 ? 'close-lower' : progress < 0.5 ? 'close-reach' : progress < 0.85 ? 'close' : 'close-return';
  return 'walk-1';
}
