export const THROWS_PER_COIN = 10;
export const COIN_PRICE = 5;
export const MACHINE_CAPACITY = 25;
export const RESTOCK_THRESHOLD = 5;
export type VendingPhase = 'ready' | 'inserting' | 'turning' | 'dispensing' | 'collecting';

const CYCLE: ReadonlyArray<{ phase: Exclude<VendingPhase, 'ready'>; seconds: number }> = [
  { phase: 'inserting', seconds: 0.45 },
  { phase: 'turning', seconds: 0.9 },
  { phase: 'dispensing', seconds: 0.55 },
  { phase: 'collecting', seconds: 1.05 },
];

export class PelletMachine {
  phase: VendingPhase = 'ready';
  coinsUsed = 0;
  servings = 0;
  stock = MACHINE_CAPACITY;
  restocking = false;
  restocks = 0;
  private refillProgress = 0;
  private stage = 0;
  private stageTime = 0;

  get busy(): boolean { return this.phase !== 'ready'; }
  get moneyUsed(): number { return this.coinsUsed * COIN_PRICE; }
  get available(): boolean { return !this.busy && !this.restocking && this.stock > 0; }
  get fillFraction(): number { return (this.stock + (MACHINE_CAPACITY - this.stock) * this.refillProgress) / MACHINE_CAPACITY; }

  insertCoin(): boolean {
    if (!this.available) return false;
    this.coinsUsed += 1;
    this.stage = 0;
    this.stageTime = 0;
    this.phase = CYCLE[0].phase;
    return true;
  }

  beginRestock(): boolean {
    if (this.busy || this.restocking || this.stock >= MACHINE_CAPACITY) return false;
    this.restocking = true;
    this.refillProgress = 0;
    return true;
  }

  pour(progress: number): void {
    if (this.restocking) this.refillProgress = Math.max(this.refillProgress, Math.min(1, progress));
  }

  finishRestock(): boolean {
    if (!this.restocking || this.refillProgress < 1) return false;
    this.stock = MACHINE_CAPACITY;
    this.restocking = false;
    this.refillProgress = 0;
    this.restocks += 1;
    return true;
  }

  // Credit the refill once, after the collection animation has finished.
  step(seconds: number): number {
    if (!this.busy || seconds <= 0) return 0;
    this.stageTime += seconds;
    while (this.stageTime >= CYCLE[this.stage].seconds) {
      this.stageTime -= CYCLE[this.stage].seconds;
      this.stage += 1;
      if (this.stage === CYCLE.length) {
        this.phase = 'ready';
        this.stageTime = 0;
        this.servings += 1;
        return THROWS_PER_COIN;
      }
      this.phase = CYCLE[this.stage].phase;
      // One paid serving leaves the globe when the dispenser actually opens.
      if (this.phase === 'dispensing') this.stock -= 1;
    }
    return 0;
  }
}
