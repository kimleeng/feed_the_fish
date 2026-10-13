import Phaser from 'phaser';
import { PondSimulation, POND, THROW_ORIGIN, inPond, type Point } from './simulation.ts';
import { animalAtlas, animalFrame, directionForHeading, type Direction } from './appearance.ts';
import type { VendingPhase } from './vending.ts';

export interface PondState {
  handfuls: number; fish: number; fishFood: number; birdFood: number; share: number;
  paused: boolean; score: number; moneyUsed: number; coinsUsed: number; servings: number;
  machinePhase: VendingPhase;
}

export class PondScene extends Phaser.Scene {
  world = new PondSimulation();
  private creatures = new Map<number, Phaser.GameObjects.Sprite>();
  private directions = new Map<number, Direction>();
  private pellets = new Map<number, Phaser.GameObjects.Rectangle>();
  private waterMask!: Phaser.Display.Masks.GeometryMask;
  private fishLayer!: Phaser.GameObjects.Container;
  private birdWakes!: Phaser.GameObjects.Graphics;
  private waterShimmer!: Phaser.GameObjects.Graphics;
  private cursor!: Phaser.GameObjects.Arc;
  private throwHand!: Phaser.GameObjects.Image;
  private lastPoint: Point = { x: 600, y: 389 };
  private lastHud = 0;
  private lastServings = 0;
  ready = false;

  constructor() { super('pond'); }

  preload(): void {
    this.load.image('pond-art', '/art/pond.png');
    this.load.image('hand-art', '/art/hand.png');
    this.load.atlas('fish-swimmers', '/art/fish-swimmers.png', '/art/fish-swimmers.json');
    this.load.atlas('bird-swimmers', '/art/bird-swimmers.png', '/art/bird-swimmers.json');
    this.load.on('loaderror', () => {
      document.querySelector('#loading p')!.textContent = 'The artwork could not load. Please refresh to try again.';
    });
  }

  create(): void {
    this.add.image(600, 400, 'pond-art').setDisplaySize(1200, 800);
    this.createWaterSurface();
    this.spawnCreatures();
    this.throwHand = this.add.image(THROW_ORIGIN.x, 806, 'hand-art').setOrigin(0.5, 1).setDisplaySize(100, 150).setDepth(55);
    this.cursor = this.add.circle(600, 390, 16).setStrokeStyle(1, 0xfff7d4, 0.6).setDepth(80).setVisible(false);
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.lastPoint = { x: pointer.x, y: pointer.y };
      this.cursor.setPosition(pointer.x, pointer.y).setVisible(inPond(this.lastPoint));
    });
    this.input.on('pointerout', () => this.cursor.setVisible(false));
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.scatter({ x: pointer.x, y: pointer.y }));
    this.ready = true;
    document.querySelector('#loading')!.setAttribute('hidden', '');
    this.publishHud();
    document.dispatchEvent(new CustomEvent('pond:ready', { detail: this }));
  }

  private createWaterSurface(): void {
    const bounds = this.add.graphics().setVisible(false);
    bounds.fillStyle(0xffffff).fillEllipse(POND.x, POND.y, POND.rx * 2, POND.ry * 2);
    this.waterMask = bounds.createGeometryMask();
    // Mask containers so Canvas clipping preserves the individual sprites' opacity.
    this.fishLayer = this.add.container(0, 0).setName('fish-layer').setDepth(10).setMask(this.waterMask);
    // Repaint the pond's own reflections over the fish, keeping the banks untouched.
    const reflections = this.add.image(600, 400, 'pond-art').setDisplaySize(1200, 800);
    this.add.container(0, 0, [reflections])
      .setName('water-surface').setDepth(20).setAlpha(0.33).setMask(this.waterMask);
    this.waterShimmer = this.add.graphics().setName('water-shimmer').setDepth(20.1).setMask(this.waterMask);
    this.birdWakes = this.add.graphics().setName('bird-wakes').setDepth(26).setMask(this.waterMask);
  }

  private spawnCreatures(): void {
    for (const animal of this.world.animals) {
      const profile = animal.profile;
      const direction = directionForHeading(animal.heading);
      const sprite = this.add.sprite(animal.x, animal.y, animalAtlas(profile.kind), animalFrame(profile.texture, direction))
        .setName('animal-' + animal.id)
        .setDisplaySize(profile.size, profile.size).setTint(profile.tint)
        .setDepth(profile.kind === 'fish' ? 10 : 30).setAlpha(profile.kind === 'fish' ? 0.83 + animal.id % 4 * 0.025 : 1);
      if (profile.kind === 'fish') this.fishLayer.add(sprite);
      this.creatures.set(animal.id, sprite);
      this.directions.set(animal.id, direction);
    }
  }

  scatter(point = this.lastPoint): void {
    if (!this.ready || this.world.paused) return;
    if (!inPond(point)) { this.message('A little further into the water. The fish are waiting.'); return; }
    if (!this.world.scatter(point)) {
      if (this.world.handfuls === 0 && !this.world.machine.busy) document.dispatchEvent(new CustomEvent('pond:needs-food'));
      return;
    }
    this.tweens.killTweensOf(this.throwHand);
    this.throwHand.setY(806).setAngle(0);
    this.tweens.add({ targets: this.throwHand, y: 796, angle: -5, duration: 140, yoyo: true, ease: 'Sine.easeInOut' });
    document.dispatchEvent(new CustomEvent('pond:toss'));
    this.publishHud();
  }

  buyPellets(): boolean {
    if (!this.ready || !this.world.buyPellets()) return false;
    this.publishHud();
    document.dispatchEvent(new CustomEvent('pond:coin'));
    return true;
  }

  togglePause(): void {
    this.world.paused = !this.world.paused;
    this.publishHud();
  }

  restart(): void {
    this.creatures.forEach(sprite => sprite.destroy());
    this.pellets.forEach(pellet => pellet.destroy());
    this.creatures.clear(); this.directions.clear(); this.pellets.clear();
    this.world = new PondSimulation();
    this.lastServings = 0;
    this.spawnCreatures();
    this.publishHud();
    document.dispatchEvent(new CustomEvent('pond:needs-food'));
  }

  private ripple(x: number, y: number, color: number, alpha = 0.3, radius = 23): void {
    const ripple = this.add.ellipse(x, y, 8, 4).setStrokeStyle(1, color, alpha).setDepth(22);
    this.tweens.add({ targets: ripple, displayWidth: radius * 2, displayHeight: radius, alpha: 0, duration: 1500, onComplete: () => ripple.destroy() });
  }

  private message(text: string): void {
    document.querySelector('#instruction-text')!.textContent = text;
    this.time.delayedCall(2500, () => { document.querySelector('#instruction-text')!.textContent = 'Pick a quiet spot in the water.'; });
  }

  private publishHud(): void {
    const detail: PondState = {
      handfuls: this.world.handfuls, fish: this.world.fedFish.size,
      fishFood: this.world.fishFood, birdFood: this.world.birdFood,
      share: this.world.fishShare, paused: this.world.paused, score: this.world.score,
      moneyUsed: this.world.machine.moneyUsed, coinsUsed: this.world.machine.coinsUsed,
      servings: this.world.machine.servings, machinePhase: this.world.machine.phase,
    };
    document.dispatchEvent(new CustomEvent('pond:state', { detail }));
  }

  update(time: number, delta: number): void {
    if (!this.ready) return;
    this.world.step(delta / 1000);
    this.birdWakes.clear();
    this.waterShimmer.clear();
    for (let i = 0; i < 18; i++) {
      const wave = this.world.elapsed * 0.6 + i * 2.4;
      const x = 210 + i * 137 % 790 + Math.sin(wave) * 4;
      const y = 220 + i * 67 % 330;
      this.waterShimmer.fillStyle(0xc0daba, 0.08 + Math.sin(wave) * 0.025);
      this.waterShimmer.fillRect(x, y, 13, 1.5).fillRect(x + 4, y + 4, 6, 1);
    }
    for (const animal of this.world.animals) {
      const sprite = this.creatures.get(animal.id)!;
      const bird = animal.profile.kind === 'bird';
      const direction = directionForHeading(animal.heading, this.directions.get(animal.id));
      this.directions.set(animal.id, direction);
      const rate = animal.state === 'chewing' ? 0.6 : bird ? 1.4 : animal.profile.speed / 24;
      const stroke = animal.moving || animal.state === 'chewing'
        ? Math.floor(this.world.elapsed * rate + animal.phase) % 2 : 0;
      sprite.setFrame(animalFrame(animal.profile.texture, direction, stroke));
      const bob = bird ? Math.sin(this.world.elapsed * 1.8 + animal.phase) * 0.65 : 0;
      sprite.setPosition(animal.x, animal.y + bob).setDepth((bird ? 30 : 10) + animal.y / 1000);
      if (bird) {
        const size = animal.profile.size;
        this.birdWakes.lineStyle(1, 0xc5ddc1, 0.2)
          .strokeEllipse(animal.x, animal.y + size * 0.2, size * 0.55, size * 0.13);
        if (animal.moving) {
          const dx = Math.cos(animal.heading); const dy = Math.sin(animal.heading);
          const tail = { x: animal.x - dx * size * 0.28, y: animal.y + size * 0.17 - dy * size * 0.2 };
          for (const side of [-1, 1]) {
            this.birdWakes.lineStyle(1.2, 0xb3d4bb, 0.17).lineBetween(tail.x, tail.y,
              tail.x - dx * 15 - dy * side * 7, tail.y - dy * 10 + dx * side * 5);
          }
        }
      }
    }
    this.fishLayer.sort('depth');
    const foodIds = new Set(this.world.food.map(food => food.id));
    this.pellets.forEach((pellet, id) => { if (!foodIds.has(id)) { pellet.destroy(); this.pellets.delete(id); } });
    for (const food of this.world.food) {
      let pellet = this.pellets.get(food.id);
      if (!pellet) {
        pellet = this.add.rectangle(food.x, food.y, 4.5, 3.2, 0xbc8b53).setStrokeStyle(0.5, 0x845933).setRotation(food.id * 2.3);
        this.pellets.set(food.id, pellet);
      }
      const airborne = food.phase === 'air';
      pellet.setPosition(food.x, food.y).setDepth(airborne ? 45 : 21)
        .setScale(airborne ? 1.1 : Math.max(0.5, food.amount))
        .setAlpha(airborne || food.age <= 1.7 ? 1 : 0.4);
    }
    for (const splash of this.world.splashes.splice(0)) this.ripple(splash.x, splash.y, 0xe4efcc, 0.45, 35);
    for (const bite of this.world.bites.splice(0)) {
      if (bite.phase === 'water') this.ripple(bite.x, bite.y, bite.kind === 'fish' ? 0xe4f5ba : 0xf7c187);
      if (bite.kind === 'fish') {
        const heart = this.add.text(bite.x, bite.y - 15, '♥', { fontFamily: 'Georgia', fontSize: '10px', color: '#fff2b9' }).setDepth(60);
        this.tweens.add({ targets: heart, y: heart.y - 20, alpha: 0, duration: 1600, onComplete: () => heart.destroy() });
      }
      document.dispatchEvent(new CustomEvent('pond:bite', { detail: bite.kind }));
    }
    if (time - this.lastHud > 80) { this.publishHud(); this.lastHud = time; }
    if (this.world.machine.servings > this.lastServings) {
      this.lastServings = this.world.machine.servings;
      this.publishHud();
      document.dispatchEvent(new CustomEvent('pond:dispensed'));
    }
  }
}
export function createPond(): PondScene {
  const scene = new PondScene();
  new Phaser.Game({
    type: Phaser.CANVAS, width: 1200, height: 800, parent: 'pond', scene: [scene],
    pixelArt: true, antialias: false, banner: false, audio: { noAudio: true },
    scale: { mode: Phaser.Scale.ENVELOP, autoCenter: Phaser.Scale.CENTER_BOTH },
    backgroundColor: '#316e65',
  });
  return scene;
}
