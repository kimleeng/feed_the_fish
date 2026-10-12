import Phaser from 'phaser';
import { PondSimulation, SPECIES, inPond, type Point } from './simulation.ts';

export class PondScene extends Phaser.Scene {
  world = new PondSimulation();
  private creatures = new Map<number, Phaser.GameObjects.Sprite>();
  private pellets = new Map<number, Phaser.GameObjects.Arc>();
  private cursor!: Phaser.GameObjects.Arc;
  private lastPoint: Point = { x: 600, y: 389 };
  private lastHud = 0;
  private endReported = false;
  ready = false;

  constructor() { super('pond'); }

  preload(): void {
    this.load.image('pond-art', '/art/pond.png');
    this.load.atlas('animals', '/art/animals.png', '/art/animals.json');
    this.load.on('loaderror', () => {
      document.querySelector('#loading p')!.textContent = 'The artwork could not load. Please refresh to try again.';
    });
  }

  create(): void {
    this.add.image(600, 400, 'pond-art').setDisplaySize(1200, 800);
    for (const texture of ['koi', 'carp', 'duck', 'gull']) {
      this.anims.create({ key: `${texture}-swim`, frames: [0, 1, 2, 1].map(i => ({ key: 'animals', frame: `${texture}-${i}` })), frameRate: 5, repeat: -1 });
    }
    this.spawnCreatures();
    this.cursor = this.add.circle(600, 390, 16).setStrokeStyle(1.5, 0xfff7d4, 0.75).setDepth(80).setVisible(false);
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.lastPoint = { x: pointer.x, y: pointer.y };
      this.cursor.setPosition(pointer.x, pointer.y).setVisible(inPond(this.lastPoint));
    });
    this.input.on('pointerout', () => this.cursor.setVisible(false));
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.scatter({ x: pointer.x, y: pointer.y }));
    this.ready = true;
    document.querySelector('#loading')!.setAttribute('hidden', '');
    document.dispatchEvent(new CustomEvent('pond:ready'));
    this.publishHud();
  }

  private spawnCreatures(): void {
    for (const animal of this.world.animals) {
      const profile = animal.profile;
      const sprite = this.add.sprite(animal.x, animal.y, 'animals', `${profile.texture}-0`)
        .setDisplaySize(profile.size, profile.size).setTint(profile.tint)
        .setDepth(profile.kind === 'fish' ? 10 : 30).setAlpha(profile.kind === 'fish' ? 0.86 : 1);
      sprite.play(`${profile.texture}-swim`);
      sprite.anims.timeScale = profile.kind === 'fish' ? profile.speed / 45 : 0.8;
      this.creatures.set(animal.id, sprite);
    }
  }

  scatter(point = this.lastPoint): void {
    if (!this.ready) return;
    if (!inPond(point)) { this.message('Aim for the open water. The fish are waiting.'); return; }
    if (!this.world.scatter(point)) {
      if (this.world.handfuls === 0) this.message('Your bag is empty. Let the fish finish their meal.');
      return;
    }
    this.ripple(point.x, point.y, 0xffe8aa, 0.6, 44);
    document.dispatchEvent(new CustomEvent('pond:toss'));
    this.publishHud();
  }

  togglePause(): void {
    if (this.world.finished) return;
    this.world.paused = !this.world.paused;
    this.publishHud();
  }

  restart(): void {
    this.creatures.forEach(sprite => sprite.destroy());
    this.pellets.forEach(pellet => pellet.destroy());
    this.creatures.clear(); this.pellets.clear();
    this.world = new PondSimulation();
    this.endReported = false;
    this.spawnCreatures();
    this.publishHud();
  }

  private ripple(x: number, y: number, color: number, alpha = 0.45, radius = 23): void {
    const ripple = this.add.ellipse(x, y, 8, 4).setStrokeStyle(1, color, alpha).setDepth(22);
    this.tweens.add({ targets: ripple, displayWidth: radius * 2, displayHeight: radius, alpha: 0, duration: 900, onComplete: () => ripple.destroy() });
  }

  private message(text: string): void {
    document.querySelector('#instruction-text')!.textContent = text;
    this.time.delayedCall(2500, () => {
      document.querySelector('#instruction-text')!.textContent = 'Click the water to scatter some food';
    });
  }

  private publishHud(): void {
    document.dispatchEvent(new CustomEvent('pond:state', { detail: {
      handfuls: this.world.handfuls, fish: this.world.fedFish.size,
      fishFood: this.world.fishFood, birdFood: this.world.birdFood,
      share: this.world.fishShare, seconds: this.world.secondsLeft,
      paused: this.world.paused, started: this.world.started, finished: this.world.finished,
    } }));
  }

  update(time: number, delta: number): void {
    if (!this.ready) return;
    this.world.step(delta / 1000);
    for (const animal of this.world.animals) {
      const sprite = this.creatures.get(animal.id)!;
      sprite.setPosition(animal.x, animal.y + (animal.profile.kind === 'bird' ? Math.sin(time / 750 + animal.id) * 1.5 : 0)).setFlipX(animal.facing < 0);
      if (animal.state === 'chewing') {
        sprite.anims.pause();
        sprite.setFrame(`${animal.profile.texture}-3`);
        sprite.setAngle(Math.sin(time / 100 + animal.id) * 2);
      } else {
        if (!this.world.paused) sprite.anims.resume();
        else sprite.anims.pause();
        sprite.setAngle(0);
      }
    }
    const foodIds = new Set(this.world.food.map(food => food.id));
    this.pellets.forEach((pellet, id) => { if (!foodIds.has(id)) { pellet.destroy(); this.pellets.delete(id); } });
    for (const food of this.world.food) {
      let pellet = this.pellets.get(food.id);
      if (!pellet) {
        pellet = this.add.circle(food.x, food.y, 2.4, 0xffdda3).setStrokeStyle(0.5, 0x9f6941).setDepth(21);
        this.pellets.set(food.id, pellet);
      }
      pellet.setPosition(food.x, food.y).setScale(Math.max(0.5, food.amount)).setAlpha(food.age > 1.7 ? 0.45 : 1);
    }
    for (const bite of this.world.bites.splice(0)) {
      this.ripple(bite.x, bite.y, bite.kind === 'fish' ? 0xe4f5ba : 0xf7c187);
      if (bite.kind === 'fish') {
        const heart = this.add.text(bite.x, bite.y - 15, '♥', { fontFamily: 'Georgia', fontSize: '12px', color: '#fff2b9' }).setDepth(60);
        this.tweens.add({ targets: heart, y: heart.y - 24, alpha: 0, duration: 1200, onComplete: () => heart.destroy() });
      }
      document.dispatchEvent(new CustomEvent('pond:bite', { detail: bite.kind }));
    }
    if (time - this.lastHud > 150) { this.publishHud(); this.lastHud = time; }
    if (this.world.finished && !this.endReported) {
      this.endReported = true;
      this.publishHud();
      document.dispatchEvent(new CustomEvent('pond:finished'));
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
