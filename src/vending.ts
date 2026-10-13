export const THROWS_PER_COIN = 20;
export const COIN_PRICE = 5;
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
  private stage = 0;
  private stageTime = 0;

  get busy(): boolean { return this.phase !== 'ready'; }
  get moneyUsed(): number { return this.coinsUsed * COIN_PRICE; }

  insertCoin(): boolean {
    if (this.busy) return false;
    this.coinsUsed += 1;
    this.stage = 0;
    this.stageTime = 0;
    this.phase = CYCLE[0].phase;
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
    }
    return 0;
  }
}
