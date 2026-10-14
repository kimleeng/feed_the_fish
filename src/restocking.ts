import { RESTOCK_THRESHOLD, type PelletMachine } from './vending.ts';
import { EMPLOYEE_POUR_OFFSET } from './employee-pins.ts';
import { walkingAdvance } from './walking.ts';

export const MACHINE_POSITION = { x: 410, y: 746 };
export const EMPLOYEE_HEIGHT = 153;
export const EMPLOYEE_SPEED = 52;
// Place the drawn sack opening directly above the hopper, with the shoes on paving.
export const EMPLOYEE_WORK_POSITION = {
  x: MACHINE_POSITION.x - EMPLOYEE_POUR_OFFSET.x * EMPLOYEE_HEIGHT,
  y: MACHINE_POSITION.y - 152 - EMPLOYEE_POUR_OFFSET.y * EMPLOYEE_HEIGHT,
};
const ENTRANCE = { x: -85, y: 778 };
export type EmployeePhase = 'away' | 'arriving' | 'waiting' | 'opening' | 'lifting' | 'pouring' | 'closing' | 'leaving';
export const RESTOCK_TIMING = { opening: 0.9, lifting: 0.8, pouring: 3, closing: 0.9 };

export class MachineEmployee {
  phase: EmployeePhase = 'away';
  x = ENTRANCE.x;
  y = ENTRANCE.y;
  distanceWalked = 0;
  velocity = 0;
  phaseTime = 0;
  get visible(): boolean { return this.phase !== 'away'; }
  get walking(): boolean { return this.phase === 'arriving' || this.phase === 'leaving'; }
  get direction(): 1 | -1 { return this.phase === 'leaving' ? -1 : 1; }
  get pouring(): boolean { return this.phase === 'pouring'; }
  get lidOpen(): number {
    if (this.phase === 'opening') return Math.min(1, this.phaseTime / RESTOCK_TIMING.opening);
    if (this.phase === 'lifting' || this.phase === 'pouring') return 1;
    if (this.phase === 'closing') return Math.max(0, 1 - this.phaseTime / RESTOCK_TIMING.closing);
    return 0;
  }

  private enter(phase: EmployeePhase): void {
    this.phase = phase; this.phaseTime = 0;
    this.velocity = 0;
    if (this.walking) this.distanceWalked = 0;
  }

  step(seconds: number, machine: PelletMachine): void {
    if (seconds <= 0) return;
    if (this.phase === 'away') {
      if (machine.stock >= RESTOCK_THRESHOLD) return;
      this.x = ENTRANCE.x; this.y = ENTRANCE.y; this.distanceWalked = 0;
      this.enter('arriving');
    }
    if (this.walking) {
      const target = this.phase === 'arriving' ? EMPLOYEE_WORK_POSITION : ENTRANCE;
      const dx = target.x - this.x, dy = target.y - this.y;
      const remaining = Math.hypot(dx, dy);
      const walk = walkingAdvance(this.velocity, EMPLOYEE_SPEED, remaining, 100, seconds);
      const travel = walk.distance;
      this.velocity = walk.velocity;
      if (remaining > 0) {
        this.x += dx / remaining * travel; this.y += dy / remaining * travel;
        this.distanceWalked += travel;
      }
      if (remaining <= travel) this.enter(this.phase === 'arriving' ? 'waiting' : 'away');
      return;
    }
    if (this.phase === 'waiting') {
      // Finish any paid serving before lifting the lid; purchases remain possible en route.
      if (machine.beginRestock()) this.enter('opening');
      return;
    }
    this.phaseTime += seconds;
    if (this.phase === 'opening' && this.phaseTime >= RESTOCK_TIMING.opening) this.enter('lifting');
    else if (this.phase === 'lifting' && this.phaseTime >= RESTOCK_TIMING.lifting) this.enter('pouring');
    else if (this.phase === 'pouring') {
      machine.pour(this.phaseTime / RESTOCK_TIMING.pouring);
      if (this.phaseTime >= RESTOCK_TIMING.pouring) this.enter('closing');
    } else if (this.phase === 'closing' && this.phaseTime >= RESTOCK_TIMING.closing) {
      machine.finishRestock();
      this.enter('leaving');
    }
  }
}
