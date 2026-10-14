import { EMPLOYEE_HEIGHT, type MachineEmployee } from './restocking.ts';
import { EMPLOYEE_STRIDE_RATIO } from './employee-pins.ts';

export function employeeFrame(person: MachineEmployee): string {
  if (person.walking) return 'walk-' + Math.floor(person.distanceWalked / (EMPLOYEE_HEIGHT * EMPLOYEE_STRIDE_RATIO) * 4) % 4;
  if (person.phase === 'opening') return 'open';
  if (person.phase === 'lifting') return 'lift';
  if (person.phase === 'pouring') return 'pour';
  if (person.phase === 'closing') return 'close';
  return 'walk-1';
}
