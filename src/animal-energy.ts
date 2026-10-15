/** Feeding history and energy belong to each animal, independently of its current meal. */
export interface AnimalEnergy {
  lastAteAt: number | null;
  totalEaten: number;
  boostCharge: number;
  boosting: boolean;
}

export const RECENT_MEAL_SECONDS = 20;
export const BOOST_DURATION_SECONDS = 2;
export const BOOST_SPEED_MULTIPLIER = 1.4;
export const BOOST_RECHARGE_SECONDS = 30;
export const HUNGRY_RECHARGE_MODIFIER = 2;
export const FED_RECHARGE_MODIFIER = 1;

export function createAnimalEnergy(): AnimalEnergy {
  return { lastAteAt: null, totalEaten: 0, boostCharge: 1, boosting: false };
}

export function hasEatenRecently(animal: AnimalEnergy, elapsed: number): boolean {
  return animal.lastAteAt !== null && elapsed - animal.lastAteAt < RECENT_MEAL_SECONDS;
}

export function recordFeeding(animal: AnimalEnergy, amount: number, elapsed: number): void {
  if (amount <= 0) return;
  animal.lastAteAt = elapsed;
  animal.totalEaten += amount;
  animal.boosting = false;
}

// Return the time spent charging, stopping at full. Split a frame at the hunger
// boundary so the recharge rate also stays correct when a recent meal expires.
function recharge(animal: AnimalEnergy, elapsed: number, seconds: number): number {
  const recentSeconds = animal.lastAteAt === null ? 0
    : Math.max(0, Math.min(seconds, animal.lastAteAt + RECENT_MEAL_SECONDS - (elapsed - seconds)));
  let used = 0;
  for (const [duration, modifier] of [[recentSeconds, FED_RECHARGE_MODIFIER],
    [seconds - recentSeconds, HUNGRY_RECHARGE_MODIFIER]]) {
    const charging = Math.min(duration, Math.max(0, 1 - animal.boostCharge) * BOOST_RECHARGE_SECONDS / modifier);
    animal.boostCharge = Math.min(1, animal.boostCharge + charging * modifier / BOOST_RECHARGE_SECONDS);
    used += charging;
  }
  return used;
}

/** Automatic swimming/paddling bursts; the returned multiplier covers this whole frame. */
export function stepAnimalBoost(animal: AnimalEnergy, elapsed: number, seconds: number, pursuing: boolean): number {
  if (seconds <= 0) return 1;
  if (!pursuing) {
    animal.boosting = false;
    recharge(animal, elapsed, seconds);
    return 1;
  }
  let remaining = seconds;
  if (!animal.boosting) {
    remaining -= recharge(animal, elapsed, seconds);
    if (animal.boostCharge < 1 - 1e-9) return 1;
    animal.boostCharge = 1;
    animal.boosting = true;
  }
  const boostedSeconds = Math.min(remaining, animal.boostCharge * BOOST_DURATION_SECONDS);
  animal.boostCharge = Math.max(0, animal.boostCharge - boostedSeconds / BOOST_DURATION_SECONDS);
  if (animal.boostCharge < 1e-9) {
    animal.boostCharge = 0;
    animal.boosting = false;
    recharge(animal, elapsed, remaining - boostedSeconds);
  }
  return 1 + (BOOST_SPEED_MULTIPLIER - 1) * boostedSeconds / seconds;
}
