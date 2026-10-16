import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPECIES, MUSK_TURTLE, POND, FLOAT_SECONDS, BIRD_TAKEOFF_SECONDS, BIRD_LANDING_SECONDS, BIRD_FLIGHT_CHANCE } from '../../src/simulation.ts';
import { THROW_MOTIONS, THROWER_FRAMES, LUCKY_CHANCE, LUCKY_BONUS_POINTS } from '../../src/throws.ts';
import { DOCK_POSITION, THROWER_HEIGHT, throwerHand } from '../../src/thrower-art.ts';
import { COIN_PRICE, THROWS_PER_COIN, MACHINE_CAPACITY, RESTOCK_THRESHOLD } from '../../src/vending.ts';
import { MACHINE_POSITION, EMPLOYEE_HEIGHT, EMPLOYEE_WORK_POSITION, RESTOCK_TIMING } from '../../src/restocking.ts';
import { OBSERVER_DESIGNS, OBSERVER_LOOKS } from '../../src/observer-looks.ts';
import { OBSERVER_PATH, WATCH_SPOTS, OBSERVER_INTEREST } from '../../src/observers.ts';
import { WALKING_GAIT } from '../../src/walking-gait.ts';
import { RECENT_MEAL_SECONDS, BOOST_DURATION_SECONDS, BOOST_SPEED_MULTIPLIER, BOOST_RECHARGE_SECONDS, HUNGRY_RECHARGE_MODIFIER, FED_RECHARGE_MODIFIER } from '../../src/animal-energy.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const data = {
  schema_version: 1,
  species: SPECIES,
  turtle: MUSK_TURTLE,
  pond: POND,
  throw_motions: THROW_MOTIONS,
  throw_hands: Object.fromEntries(THROWER_FRAMES.map(frame => [frame, { left: throwerHand(frame, -1), right: throwerHand(frame, 1) }])),
  dock_position: DOCK_POSITION,
  thrower_height: THROWER_HEIGHT,
  machine_position: MACHINE_POSITION,
  employee_height: EMPLOYEE_HEIGHT,
  employee_work_position: EMPLOYEE_WORK_POSITION,
  restock_timing: RESTOCK_TIMING,
  walking_gait: WALKING_GAIT,
  observer_designs: OBSERVER_DESIGNS,
  observer_looks: OBSERVER_LOOKS,
  observer_path: OBSERVER_PATH,
  watch_spots: WATCH_SPOTS,
  observer_interest: OBSERVER_INTEREST,
  vending: { coin_price: COIN_PRICE, throws_per_coin: THROWS_PER_COIN, machine_capacity: MACHINE_CAPACITY, restock_threshold: RESTOCK_THRESHOLD },
  energy: { recent_meal_seconds: RECENT_MEAL_SECONDS, boost_duration_seconds: BOOST_DURATION_SECONDS, boost_speed_multiplier: BOOST_SPEED_MULTIPLIER, boost_recharge_seconds: BOOST_RECHARGE_SECONDS, hungry_recharge_modifier: HUNGRY_RECHARGE_MODIFIER, fed_recharge_modifier: FED_RECHARGE_MODIFIER },
  flight: { takeoff_seconds: BIRD_TAKEOFF_SECONDS, landing_seconds: BIRD_LANDING_SECONDS, chance: BIRD_FLIGHT_CHANCE, float_seconds: FLOAT_SECONDS },
  lucky: { chance: LUCKY_CHANCE, bonus_points: LUCKY_BONUS_POINTS },
};
const target = path.join(root, 'godot/data/gameplay.json');
const serialized = JSON.stringify(data, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== serialized) {
    throw new Error('Godot gameplay data is stale. Run npm run godot:sync.');
  }
  console.log('Godot gameplay data matches the browser source.');
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, serialized);
  console.log('Synced browser gameplay settings to godot/data/gameplay.json.');
}
