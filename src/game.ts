import Phaser from 'phaser';
import { PondSimulation, POND, THROW_ORIGIN, inPond, type Point } from './simulation.ts';
import { animalAtlas, animalFrame, directionForHeading, type Direction } from './appearance.ts';
import { COIN_PRICE, type VendingPhase } from './vending.ts';
import { handPose, REST_HAND, THROW_MOTIONS, type ThrowEvent } from './throws.ts';
import { createObserverAtlas, observerFrame } from './observer-art.ts';

export interface PondState {
  handfuls: number; fish: number; fishFood: number; birdFood: number; share: number;
  paused: boolean; score: number; moneyUsed: number; coinsUsed: number; servings: number;
  machinePhase: VendingPhase;
  luckyBonus: number; luckyInHand: boolean;
}

export class PondScene extends Phaser.Scene {
  world = new PondSimulation();
  private creatures = new Map<number, Phaser.GameObjects.Sprite>();
  private observers = new Map<number, Phaser.GameObjects.Container>();
  private directions = new Map<number, Direction>();
  private pellets = new Map<number, Phaser.GameObjects.Container>();
  private waterMask!: Phaser.Display.Masks.GeometryMask;
  private fishLayer!: Phaser.GameObjects.Container;
  private birdWakes!: Phaser.GameObjects.Graphics;
  private waterShimmer!: Phaser.GameObjects.Graphics;
  private cursor!: Phaser.GameObjects.Arc;
  private throwHand!: Phaser.GameObjects.Container;
  private handArt!: Phaser.GameObjects.Image;
  private handPellets!: Phaser.GameObjects.Container;
  private luckyIndicator!: Phaser.GameObjects.Container;
  private luckyLabel!: Phaser.GameObjects.Text;
  private effects!: Phaser.GameObjects.Group;
  private lastRelease = -1;
  private lastPoint: Point = { x: 600, y: 389 };
  private lastHud = 0;
  private lastServings = 0;
  ready = false;

  constructor() { super('pond'); }

  preload(): void {
    this.load.image('pond-art', '/art/pond.png');
    this.load.multiatlas('throw-hand-art', '/art/right-arm-throws.json', '/art/');
    this.load.atlas('scene-machine', '/art/scene-machine.png', '/art/scene-machine.json');
    this.load.atlas('fish-swimmers', '/art/fish-swimmers.png', '/art/fish-swimmers.json');
    this.load.atlas('bird-swimmers', '/art/bird-swimmers.png', '/art/bird-swimmers.json');
    this.load.on('loaderror', () => {
      document.querySelector('#loading p')!.textContent = 'The artwork could not load. Please refresh to try again.';
    });
  }

  create(): void {
    this.add.image(600, 400, 'pond-art').setDisplaySize(1200, 800);
    this.effects = this.add.group();
    this.createWaterSurface();
    this.spawnCreatures();
    createObserverAtlas(this.textures);
    this.updateObservers();
    this.createPelletMachine();
    this.createThrowHand();
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

  private createPelletMachine(): void {
    const machine = this.add.container(410, 746).setName('garden-pellet-machine').setDepth(40 + 746 / 1000);
    const image = this.add.image(0, 0, 'scene-machine', 'machine').setName('machine-art').setOrigin(0.5, 1);
    image.setScale(154 / image.height);
    // Include the narrow pedestal in the touch target, with a little extra width.
    const touchWidth = 110 / image.scaleX;
    image.setInteractive(new Phaser.Geom.Rectangle((image.width - touchWidth) / 2, 0, touchWidth, image.height), Phaser.Geom.Rectangle.Contains);
    image.input!.cursor = 'pointer';
    image.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
    });
    image.on('pointerup', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      document.dispatchEvent(new CustomEvent('pond:machine'));
    });
    const plaque = this.add.rectangle(0, -68, 22, 11, 0xe5d8b4).setStrokeStyle(1, 0x746b50);
    const price = this.add.text(0, -68, `${COIN_PRICE} kr`, {
      fontFamily: 'monospace', fontSize: '8px', color: '#344a3d',
    }).setOrigin(0.5);
    machine.add([image, plaque, price]);
  }

  private createThrowHand(): void {
    this.throwHand = this.add.container(THROW_ORIGIN.x, THROW_ORIGIN.y).setName('throwing-hand').setDepth(55);
    this.handArt = this.add.image(0, 0, 'throw-hand-art', 'rest').setName('hand-art').setScale(0.18);
    this.handPellets = this.add.container(0, -4, [
      this.add.rectangle(-5, 1, 4, 3, 0xa97942), this.add.rectangle(3, 3, 4, 3, 0xb98b4c),
      this.add.rectangle(0, -3, 4, 3, 0x96663d),
    ]);
    this.luckyIndicator = this.add.container(0, -5, [
      this.add.ellipse(0, 0, 34, 24, 0xffdb77, 0.23),
      this.add.star(0, 0, 5, 2.4, 5.5, 0xffe494).setStrokeStyle(1, 0xd6a247),
    ]).setName('lucky-hand-indicator').setVisible(false);
    this.luckyLabel = this.add.text(0, -43, 'LUCKY PELLET', {
      fontFamily: 'monospace', fontSize: '8px', color: '#ffebae',
      backgroundColor: '#345a48', padding: { x: 5, y: 3 },
    }).setOrigin(0.5).setName('lucky-hand-label').setVisible(false);
    this.throwHand.add([this.handArt, this.handPellets, this.luckyIndicator, this.luckyLabel]);
    this.updateThrowHand();
  }

  private isLuckyInHand(): boolean {
    const action = this.world.currentThrow;
    if (action) return action.lucky && this.world.elapsed - action.startedAt < THROW_MOTIONS[action.animation].releaseDelay;
    return !this.world.machine.busy && this.world.handfuls > 0 && !!this.world.nextThrow?.lucky;
  }

  private updateThrowHand(): void {
    const action = this.world.currentThrow;
    const age = action ? this.world.elapsed - action.startedAt : 0;
    const pose = action ? handPose(action.animation, age) : { ...REST_HAND, frame: this.world.handfuls > 0 ? 'rest' as const : 'empty' as const };
    const holding = action ? age < THROW_MOTIONS[action.animation].releaseDelay : this.world.handfuls > 0 && !this.world.machine.busy;
    const lucky = this.isLuckyInHand();
    this.throwHand.setPosition(THROW_ORIGIN.x + pose.x, THROW_ORIGIN.y + pose.y);
    this.handArt.setFrame(pose.frame);
    this.handPellets.setVisible(holding);
    this.luckyIndicator.setVisible(lucky).setScale(1 + Math.sin(this.world.elapsed * 4) * 0.07);
    this.luckyLabel.setVisible(lucky || !!action?.lucky).setText(holding ? 'LUCKY PELLET' : 'LUCKY THROW');
    if (action && !holding && action.id !== this.lastRelease) {
      this.lastRelease = action.id;
      document.dispatchEvent(new CustomEvent<ThrowEvent>('pond:toss', { detail: action }));
    }
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

  private updateObservers(): void {
    const crowd = this.world.crowd;
    const present = new Set(crowd.people.map(person => person.id));
    for (const [id, visitor] of this.observers) {
      if (!present.has(id)) { visitor.destroy(); this.observers.delete(id); }
    }
    for (const person of crowd.people) {
      let visitor = this.observers.get(person.id);
      if (!visitor) {
        const shadow = this.add.ellipse(1, -1, 24, 7, 0x493f32, 0.2).setName('observer-shadow');
        const sprite = this.add.sprite(0, 0, 'garden-observers', observerFrame(person))
          .setName('observer-art').setOrigin(0.5, 1);
        visitor = this.add.container(person.x, person.y, [shadow, sprite]).setName('observer-' + person.id);
        this.observers.set(person.id, visitor);
      }
      const watching = person.state === 'watching';
      const sprite = visitor.getByName('observer-art') as Phaser.GameObjects.Sprite;
      const bob = watching ? Math.sin(crowd.elapsed * 1.3 + person.id) * 0.3 : 0;
      sprite.setFrame(observerFrame(person)).setFlipX(!watching && person.direction === -1).setY(bob);
      visitor.setPosition(person.x, person.y).setScale(1.75 * person.scale).setDepth(40 + person.y / 1000);
    }
  }

  scatter(point = this.lastPoint): void {
    if (!this.ready || this.world.paused) return;
    if (!inPond(point)) { this.message('A little further into the water. The fish are waiting.'); return; }
    if (!this.world.scatter(point)) {
      if (this.world.handfuls === 0 && !this.world.machine.busy) document.dispatchEvent(new CustomEvent('pond:needs-food'));
      return;
    }
    this.updateThrowHand();
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
    this.observers.forEach(visitor => visitor.destroy());
    this.observers.clear();
    this.creatures.clear(); this.directions.clear(); this.pellets.clear();
    this.tweens.killAll(); this.effects.clear(true, true);
    this.world = new PondSimulation();
    this.lastServings = 0;
    this.lastRelease = -1;
    this.spawnCreatures();
    this.updateObservers();
    this.updateThrowHand();
    this.publishHud();
    document.dispatchEvent(new CustomEvent('pond:needs-food'));
  }

  private ripple(x: number, y: number, color: number, alpha = 0.3, radius = 23): void {
    const ripple = this.add.ellipse(x, y, 8, 4).setStrokeStyle(1, color, alpha).setDepth(22);
    this.effects.add(ripple);
    this.tweens.add({ targets: ripple, displayWidth: radius * 2, displayHeight: radius, alpha: 0, duration: 1500, onComplete: () => ripple.destroy() });
  }

  private celebrateLucky(x: number, y: number, bonus: number): void {
    this.ripple(x, y, 0xffd575, 0.65, 44);
    this.ripple(x, y, 0xffefb9, 0.4, 62);
    const celebration = this.add.container(x, y).setName('lucky-celebration').setDepth(65);
    const label = this.add.text(0, -26, `+${bonus} lucky`, {
      fontFamily: 'Georgia', fontSize: '15px', color: '#fff0b0',
      stroke: '#527462', strokeThickness: 2,
    }).setOrigin(0.5);
    celebration.add(label);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const star = this.add.star(0, -5, 4, 1.8, 4, i % 2 ? 0xffd27a : 0xfff1bf);
      celebration.add(star);
      this.tweens.add({ targets: star, x: Math.cos(angle) * 32, y: Math.sin(angle) * 20 - 12, alpha: 0, duration: 1100, ease: 'Sine.easeOut' });
    }
    this.effects.add(celebration);
    this.tweens.add({ targets: celebration, y: y - 20, alpha: 0, duration: 1800, onComplete: () => celebration.destroy() });
    document.dispatchEvent(new CustomEvent('pond:lucky', { detail: bonus }));
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
      luckyBonus: this.world.luckyBonus, luckyInHand: this.isLuckyInHand(),
    };
    document.dispatchEvent(new CustomEvent('pond:state', { detail }));
  }

  update(time: number, delta: number): void {
    if (!this.ready) return;
    this.world.step(delta / 1000);
    this.updateObservers();
    this.updateThrowHand();
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
        const body = food.lucky
          ? this.add.star(0, 0, 5, 2.1, 4.5, 0xffdf83).setStrokeStyle(0.7, 0xba8d3e)
          : this.add.rectangle(0, 0, 4.5, 3.2, 0xbc8b53).setStrokeStyle(0.5, 0x845933).setRotation(food.id * 2.3);
        pellet = this.add.container(food.x, food.y).setName('pellet-' + food.id);
        if (food.lucky) pellet.add(this.add.ellipse(0, 0, 14, 10, 0xffd77c, 0.22));
        pellet.add(body);
        this.pellets.set(food.id, pellet);
      }
      const airborne = food.phase === 'air';
      const pulse = food.lucky ? 1 + Math.sin(this.world.elapsed * 5 + food.id) * 0.06 : 1;
      pellet.setPosition(food.x, food.y).setDepth(airborne ? 45 : 21).setVisible(this.world.elapsed >= food.releaseAt)
        .setScale((airborne ? 1.1 : Math.max(0.5, food.amount)) * pulse)
        .setAlpha(airborne || food.age <= 1.7 ? 1 : food.lucky ? 0.65 : 0.4);
    }
    for (const splash of this.world.splashes.splice(0)) this.ripple(splash.x, splash.y, 0xe4efcc, 0.45, 35);
    for (const bite of this.world.bites.splice(0)) {
      if (bite.phase === 'water') this.ripple(bite.x, bite.y, bite.kind === 'fish' ? 0xe4f5ba : 0xf7c187);
      if (bite.kind === 'fish') {
        if (bite.bonus > 0) this.celebrateLucky(bite.x, bite.y, bite.bonus);
        else {
          const heart = this.add.text(bite.x, bite.y - 15, '♥', { fontFamily: 'Georgia', fontSize: '10px', color: '#fff2b9' }).setDepth(60);
          this.effects.add(heart);
          this.tweens.add({ targets: heart, y: heart.y - 20, alpha: 0, duration: 1600, onComplete: () => heart.destroy() });
        }
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
