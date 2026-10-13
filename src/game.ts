import Phaser from 'phaser';
import { PondSimulation, THROW_ORIGIN, inPond, type Point } from './simulation.ts';
import type { VendingPhase } from './vending.ts';

export interface PondState {
  handfuls: number; fish: number; fishFood: number; birdFood: number; share: number;
  paused: boolean; score: number; moneyUsed: number; coinsUsed: number; servings: number;
  machinePhase: VendingPhase;
}

export class PondScene extends Phaser.Scene {
  world = new PondSimulation();
  private creatures = new Map<number, Phaser.GameObjects.Sprite>();
  private pellets = new Map<number, Phaser.GameObjects.Rectangle>();
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
    this.load.atlas('animals', '/art/animals.png', '/art/animals.json');
    this.load.on('loaderror', () => {
      document.querySelector('#loading p')!.textContent = 'The artwork could not load. Please refresh to try again.';
    });
  }

  create(): void {
    this.add.image(600, 400, 'pond-art').setDisplaySize(1200, 800);
    for (const texture of ['koi', 'carp', 'duck', 'gull']) {
      this.anims.create({ key: texture + '-swim', frames: [0, 1, 2, 1].map(i => ({ key: 'animals', frame: texture + '-' + i })), frameRate: 4, repeat: -1 });
    }
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
    document.dispatchEvent(new CustomEvent('pond:ready'));
  }

  private spawnCreatures(): void {
    for (const animal of this.world.animals) {
      const profile = animal.profile;
      const sprite = this.add.sprite(animal.x, animal.y, 'animals', profile.texture + '-0')
        .setDisplaySize(profile.size, profile.size).setTint(profile.tint)
        .setDepth(profile.kind === 'fish' ? 10 : 30).setAlpha(profile.kind === 'fish' ? 0.78 : 1);
      sprite.play(profile.texture + '-swim');
      sprite.anims.timeScale = profile.kind === 'fish' ? profile.speed / 60 : 0.65;
      this.creatures.set(animal.id, sprite);
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
    this.creatures.clear(); this.pellets.clear();
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
    for (const animal of this.world.animals) {
      const sprite = this.creatures.get(animal.id)!;
      const hop = animal.profile.movement === 'hop' && !this.world.paused && animal.state !== 'chewing'
        ? Math.max(0, Math.sin(this.world.elapsed * 3 + animal.phase)) * 3 : 0;
      sprite.setPosition(animal.x, animal.y - hop).setFlipX(animal.facing < 0);
      if (this.world.paused) { sprite.anims.pause(); continue; }
      if (animal.state === 'chewing') {
        sprite.anims.pause();
        sprite.setFrame(animal.profile.texture + '-3');
        sprite.setAngle(Math.sin(time / 180 + animal.id) * 1.5);
      } else {
        sprite.anims.resume();
        const bank = animal.profile.movement === 'swoop' ? Math.sin(animal.heading) * 7 : 0;
        sprite.setAngle(bank);
      }
    }
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
