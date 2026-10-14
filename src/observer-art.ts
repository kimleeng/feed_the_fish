import type Phaser from 'phaser';
import type { Observer } from './observers.ts';

const PALETTES = [
  { skin: '#e3b58b', hair: '#553d2d', shirt: '#7b9b87', trousers: '#555b67' },
  { skin: '#c78e65', hair: '#302d2e', shirt: '#c77755', trousers: '#4f6569' },
  { skin: '#edc6a0', hair: '#b48a47', shirt: '#7193b0', trousers: '#58634e' },
  { skin: '#9c694c', hair: '#302c29', shirt: '#dfb464', trousers: '#5a5768' },
  { skin: '#e8bc95', hair: '#81502f', shirt: '#b6869b', trousers: '#566b71' },
  { skin: '#ba8761', hair: '#ded5bd', shirt: '#a5ad86', trousers: '#6e5d51' },
  { skin: '#754d3c', hair: '#27282d', shirt: '#c08d66', trousers: '#556d66' },
  { skin: '#edc8a5', hair: '#675648', shirt: '#8c9fac', trousers: '#6f615d' },
];
const WIDTH = 32;
const HEIGHT = 48;
const POSES = ['walk-0', 'walk-1', 'walk-2', 'walk-3', 'watch'];

function shade(color: string, amount: number): string {
  const value = parseInt(color.slice(1), 16);
  return '#' + [value >> 16, value >> 8 & 255, value & 255]
    .map(channel => Math.max(0, Math.min(255, channel + amount)).toString(16).padStart(2, '0')).join('');
}

// Original pixel sprites, baked once into an atlas for efficient rendering.
export function createObserverAtlas(textures: Phaser.Textures.TextureManager): void {
  if (textures.exists('garden-observers')) return;
  const texture = textures.createCanvas('garden-observers', WIDTH * POSES.length, HEIGHT * PALETTES.length * 2)!;
  const context = texture.context;
  for (const [ageIndex, age] of ['adult', 'kid'].entries()) {
    for (const [look, basePalette] of PALETTES.entries()) {
      const palette = age === 'kid' && look === 5 ? { ...basePalette, hair: '#795333' } : basePalette;
      const row = ageIndex * PALETTES.length + look;
      for (const [poseIndex, pose] of POSES.entries()) {
        context.save();
        context.translate(poseIndex * WIDTH, row * HEIGHT);
        const kid = age === 'kid';
        const headY = kid ? 16 : 3;
        const shoulderY = kid ? 29 : 16;
        const hipY = kid ? 37 : 30;
        const watching = pose === 'watch';
        const stride = [-2, 0, 2, 0][poseIndex] ?? 0;
        const kneeOffset = [0, 1, 0, -1][poseIndex] ?? 0;
        const kneeY = Math.round(hipY + (45 - hipY) / 2);
        const darkShirt = shade(palette.shirt, -28);
        const lightShirt = shade(palette.shirt, 22);
        const darkSkin = shade(palette.skin, -24);
        const pants = shade(palette.trousers, -22);
        const rect = (color: string, x: number, y: number, width: number, height: number) => {
          context.fillStyle = color; context.fillRect(x, y, width, height);
        };
        const limb = (color: string, x1: number, y1: number, x2: number, y2: number, width: number) => {
          const length = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
          for (let step = 0; step <= length; step++) {
            const t = length ? step / length : 0;
            rect(color, Math.round(x1 + (x2 - x1) * t), Math.round(y1 + (y2 - y1) * t), width, width);
          }
        };
        if (watching) {
          rect(pants, 11, hipY, 5, 45 - hipY);
          rect(palette.trousers, 18, hipY, 5, 45 - hipY);
          rect('#423c35', 10, 44, 7, 3); rect('#423c35', 18, 44, 7, 3);
          rect(darkShirt, 8, shoulderY + 2, 17, hipY - shoulderY - 1);
          rect(palette.shirt, 10, shoulderY, 13, hipY - shoulderY);
          rect(lightShirt, 11, shoulderY + 1, 2, hipY - shoulderY - 3);
          rect(lightShirt, 14, shoulderY, 6, 2);
          rect(darkShirt, 21, shoulderY + 4, 2, hipY - shoulderY - 5);
          rect(shade(palette.shirt, -12), 16, hipY - 4, 5, 1);
          rect(shade(palette.trousers, 15), 12, hipY + 2, 1, 42 - hipY);
          rect(darkSkin, 9, hipY - 2, 3, 4); rect(palette.skin, 22, hipY - 2, 3, 4);
          rect(darkSkin, 14, shoulderY - 2, 5, 3);
          rect(darkSkin, 9, headY + 6, 3, 4); rect(palette.skin, 22, headY + 6, 2, 4);
          rect(shade(palette.hair, -15), 11, headY + 2, 12, 11);
          rect(palette.hair, 10, headY + 2, 12, 9); rect(palette.hair, 12, headY, 8, 3);
          rect(shade(palette.hair, 20), 12, headY + 2, 3, 3);
          if (look === 1 || look === 4) rect(palette.hair, 12, headY + 9, 10, 7);
          if (look === 3) { rect(darkShirt, 10, headY, 12, 4); rect(lightShirt, 11, headY, 9, 2); }
          rect(darkShirt, 13, hipY - 1, 8, 1);
        } else {
          // Alternating arms and bent knees give four distinct walking poses.
          limb(darkShirt, 13, shoulderY + 2, 13 - stride, hipY - 4, 3);
          rect(darkSkin, 13 - stride, hipY - 3, 3, 3);
          limb(pants, 13, hipY - 1, 15 + stride - kneeOffset, kneeY, 4);
          limb(pants, 15 + stride - kneeOffset, kneeY, 15 + stride * 2, 43, 3);
          rect('#423c35', 14 + stride * 2, 44, 7, 3);
          limb(palette.trousers, 17, hipY - 1, 16 - stride + kneeOffset, kneeY, 4);
          limb(palette.trousers, 16 - stride + kneeOffset, kneeY, 15 - stride * 2, 43, 4);
          rect('#514338', 14 - stride * 2, 44, 8, 3);
          rect('#b9ad91', 15 - stride * 2, 46, 6, 1);
          rect(darkShirt, 12, shoulderY + 1, 10, hipY - shoulderY);
          rect(palette.shirt, 14, shoulderY, 8, hipY - shoulderY);
          rect(lightShirt, 20, shoulderY + 2, 2, hipY - shoulderY - 4);
          rect(darkShirt, 13, hipY - 1, 9, 2);
          limb(darkShirt, 16, shoulderY + 3, 16 + stride, hipY - 4, 4);
          limb(palette.shirt, 17, shoulderY + 3, 17 + stride, hipY - 5, 3);
          rect(palette.skin, 17 + stride, hipY - 3, 3, 4);
          rect(darkSkin, 15, shoulderY - 3, 4, 4);
          rect(darkSkin, 12, headY + 3, 10, 10);
          rect(palette.skin, 14, headY + 3, 8, 9);
          rect(palette.skin, 22, headY + 7, 2, 3);
          rect('#493d31', 21, headY + 6, 1, 1);
          rect(darkSkin, 20, headY + 11, 2, 1);
          rect(palette.hair, 11, headY + 2, 5, 10);
          rect(palette.hair, 13, headY, 8, 4);
          rect(shade(palette.hair, 20), 13, headY + 1, 4, 2);
          rect(palette.skin, 15, headY + 7, 2, 3);
          if (look === 1 || look === 4) rect(palette.hair, 11, headY + 8, 4, 9);
          if (look === 3) { rect(darkShirt, 11, headY, 11, 4); rect(lightShirt, 14, headY + 3, 11, 1); }
          rect(lightShirt, 19, shoulderY, 3, 2);
        }
        context.restore();
        texture.add(`observer-${age}-${look}-${pose}`, 0, poseIndex * WIDTH, row * HEIGHT, WIDTH, HEIGHT);
      }
    }
  }
  texture.refresh();
}

export function observerFrame(person: Observer): string {
  const pose = person.state === 'watching' ? 'watch' : 'walk-' + Math.floor(person.stride) % 4;
  return `observer-${person.age}-${person.look}-${pose}`;
}
