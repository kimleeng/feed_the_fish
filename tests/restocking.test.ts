import test from 'node:test';
import assert from 'node:assert/strict';
import { PelletMachine, MACHINE_CAPACITY, THROWS_PER_COIN } from '../src/vending.ts';
import { MachineEmployee, EMPLOYEE_WORK_POSITION, EMPLOYEE_SPEED } from '../src/restocking.ts';
import { employeeFrame } from '../src/employee-art.ts';
import { PondSimulation } from '../src/simulation.ts';

function advance(pond: PondSimulation, seconds: number): void {
  for (let tick = 0; tick < Math.round(seconds / 0.05); tick++) pond.step(0.05);
}

test('the globe holds exactly 25 paid servings and an empty machine never takes a coin', () => {
  const machine = new PelletMachine();
  let throws = 0;
  assert.equal(machine.stock, 25);
  for (let purchase = 0; purchase < 25; purchase++) {
    assert.equal(machine.insertCoin(), true);
    assert.equal(machine.insertCoin(), false);
    assert.equal(machine.stock, 25 - purchase, 'The globe waits for the actual dispensing stage');
    assert.equal(machine.step(1.4), 0);
    assert.equal(machine.stock, 24 - purchase);
    throws += machine.step(1.6);
    assert.equal(machine.stock, 24 - purchase, 'A serving is removed only once');
  }
  assert.equal(throws, 250);
  assert.equal(machine.servings, 25);
  assert.equal(machine.stock, 0); assert.equal(machine.fillFraction, 0);
  assert.equal(machine.insertCoin(), false);
  assert.equal(machine.coinsUsed, 25); assert.equal(machine.moneyUsed, 125);
  assert.equal(machine.step(100), 0);
});

test('the employee is dispatched below five servings, with purchases still possible during the walk', () => {
  const pond = new PondSimulation(7);
  pond.animals = [];
  for (let purchase = 0; purchase < 20; purchase++) {
    assert.equal(pond.buyPellets(), true);
    advance(pond, 3);
  }
  assert.equal(pond.machine.stock, 5);
  assert.equal(pond.employee.phase, 'away');
  assert.equal(pond.buyPellets(), true);
  advance(pond, 3);
  assert.equal(pond.machine.stock, 4);
  assert.equal(pond.employee.phase, 'arriving');
  const before = { x: pond.employee.x, y: pond.employee.y };
  const poses = new Set<string>();
  for (let tick = 0; tick < 20; tick++) {
    pond.step(0.05); poses.add(employeeFrame(pond.employee));
  }
  assert.ok(Math.abs(Math.hypot(pond.employee.x - before.x, pond.employee.y - before.y) - EMPLOYEE_SPEED) < 0.001);
  assert.ok(poses.size >= 3, 'Walking poses advance with the distance traveled');
  assert.equal(pond.buyPellets(), true);
  assert.equal(pond.machine.restocking, false);
});

test('the employee waits for the paid serving to finish before opening the machine', () => {
  const employee = new MachineEmployee();
  const machine = new PelletMachine();
  machine.stock = 4;
  for (let tick = 0; tick < 240 && employee.phase !== 'waiting'; tick++) employee.step(0.05, machine);
  assert.equal(employee.phase, 'waiting');
  assert.ok(Math.abs(employee.x - EMPLOYEE_WORK_POSITION.x) < 0.00001);
  assert.equal(machine.insertCoin(), true);
  employee.step(0.05, machine);
  assert.equal(employee.phase, 'waiting');
  assert.equal(machine.restocking, false);
  assert.equal(machine.step(3), THROWS_PER_COIN);
  employee.step(0.05, machine);
  assert.equal(employee.phase, 'opening');
  assert.equal(machine.restocking, true);
  assert.equal(machine.insertCoin(), false);
  assert.equal(machine.coinsUsed, 1);
});

test('restocking visibly pours to capacity once, leaves existing throws alone, and the employee walks away', () => {
  const pond = new PondSimulation(8);
  pond.animals = []; pond.machine.stock = 4; pond.handfuls = 37;
  const phases = new Set<string>();
  let duringPour = false;
  let lastFill = pond.machine.fillFraction;
  for (let tick = 0; tick < 600; tick++) {
    pond.step(0.05); phases.add(pond.employee.phase);
    assert.ok(pond.machine.fillFraction >= lastFill);
    lastFill = pond.machine.fillFraction;
    assert.equal(pond.handfuls, 37);
    assert.equal(pond.machine.coinsUsed, 0);
    if (pond.employee.phase === 'pouring' && pond.machine.fillFraction > 0.2 && pond.machine.fillFraction < 0.9) {
      duringPour = true;
      assert.equal(pond.machine.stock, 4, 'Stock becomes available after the lid is closed');
      assert.equal(pond.buyPellets(), false);
    }
  }
  assert.ok(duringPour);
  assert.deepEqual([...phases], ['arriving', 'waiting', 'opening', 'lifting', 'pouring', 'closing', 'leaving', 'away']);
  assert.equal(pond.employee.visible, false);
  assert.equal(pond.machine.stock, MACHINE_CAPACITY);
  assert.equal(pond.machine.fillFraction, 1);
  assert.equal(pond.machine.restocks, 1);
  assert.equal(pond.machine.restocking, false);
  assert.equal(pond.buyPellets(), true);
  advance(pond, 3);
  assert.equal(pond.handfuls, 47); assert.equal(pond.machine.stock, 24);
});

test('pause freezes the employee and pour, and another low-stock cycle brings them back', () => {
  const pond = new PondSimulation(9);
  pond.animals = []; pond.machine.stock = 4;
  for (let tick = 0; tick < 400 && pond.employee.phase !== 'pouring'; tick++) pond.step(0.05);
  assert.equal(pond.employee.phase, 'pouring');
  advance(pond, 1);
  const frozen = JSON.stringify([pond.employee, pond.machine]);
  pond.paused = true; advance(pond, 30);
  assert.equal(JSON.stringify([pond.employee, pond.machine]), frozen);
  pond.paused = false; advance(pond, 20);
  assert.equal(pond.employee.phase, 'away');
  pond.machine.stock = 4;
  advance(pond, 30);
  assert.equal(pond.machine.restocks, 2);
  assert.equal(pond.machine.stock, 25);
  assert.equal(pond.employee.phase, 'away');
});

test('the player can keep feeding during a restock, and a fresh visit resets the machine and employee', () => {
  const pond = new PondSimulation(10);
  pond.animals = []; pond.machine.stock = 0; pond.handfuls = 2;
  for (let tick = 0; tick < 400 && !pond.machine.restocking; tick++) pond.step(0.05);
  assert.equal(pond.machine.restocking, true);
  assert.equal(pond.scatter({ x: 600, y: 389 }), true);
  assert.equal(pond.handfuls, 1);
  assert.equal(pond.buyPellets(), false);
  const fresh = new PondSimulation(10);
  assert.equal(fresh.machine.stock, 25);
  assert.equal(fresh.employee.visible, false);
  assert.equal(fresh.employee.phase, 'away');
  assert.equal(fresh.machine.restocking, false);
});
