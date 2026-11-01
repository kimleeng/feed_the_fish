import Phaser from 'phaser';
import { VISITOR_PLACES, visitorPose, type GardenVisitors } from './visitors.ts';

export class VisitorView {
  private sprites: Phaser.GameObjects.Sprite[];
  constructor(scene: Phaser.Scene) {
    const layer = scene.add.container(0, 0).setName('garden-visitors').setDepth(4);
    this.sprites = VISITOR_PLACES.map((place, id) => {
      const sprite = scene.add.sprite(place.x, place.y, 'visitor-idles', `visitor-${id}-0`)
        .setName(`visitor-${id}`).setOrigin(0.5, 208 / 224).setFlipX(place.facingLeft).setDisplaySize(place.size, place.size);
      layer.add(sprite);
      return sprite;
    });
    // Reuse the original railing pixels as a foreground layer. No new scenery
    // is painted over the path and the people have no input hit areas.
    const fence = scene.add.graphics().setVisible(false).fillStyle(0xffffff);
    for (const place of VISITOR_PLACES) fence.fillRect(place.x - 30, place.y - 16, 60, 22);
    const foreground = scene.add.image(600, 400, 'pond-art').setDisplaySize(1200, 800);
    scene.add.container(0, 0, [foreground]).setName('visitor-railing').setDepth(5).setMask(fence.createGeometryMask());
  }

  update(visitors: GardenVisitors, reducedMotion: boolean): void {
    for (const person of visitors.people) {
      const pose = visitorPose(person, reducedMotion);
      this.sprites[person.id].setFrame(pose.frame).setPosition(person.x + pose.x, person.y)
        .setAngle(pose.angle).setDisplaySize(person.size, person.size * pose.scaleY);
    }
  }
}
