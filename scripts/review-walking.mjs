import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const output = process.argv[3] || path.resolve('test-results/walking-review');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1340 } });
  page.on('pageerror', error => console.error(error));
  await page.addInitScript(() => document.addEventListener('pond:ready', event => window.pondReview = event.detail));
  await page.goto(process.argv[2] || 'http://127.0.0.1:5173');
  await page.locator('#loading').waitFor({ state: 'hidden' });
  await page.locator('#machine-watch').click();
  const sheet = await page.evaluate(() => {
    const scene = window.pondReview;
    scene.scene.pause();
    const source = scene.textures.get('grounded-walkers').getSourceImage();
    const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 1134;
    const context = canvas.getContext('2d');
    context.fillStyle = '#dce6df'; context.fillRect(0, 0, canvas.width, canvas.height);
    for (let row = 0; row < 7; row++) for (let column = 0; column < 8; column++) {
      context.drawImage(source, column * 6 * 120, row * 162, 120, 162, column * 120, row * 162, 120, 162);
      context.strokeStyle = '#748e7a'; context.beginPath();
      context.moveTo(column * 120, (row + 1) * 162 - 0.5); context.lineTo((column + 1) * 120, (row + 1) * 162 - 0.5); context.stroke();
    }
    const model = scene.world.crowd.people[0];
    scene.world.crowd.people = ['adult', 'kid'].flatMap((age, group) => [0, 1, 2].map(look => ({
      ...model, id: 100 + group * 3 + look, age, look, scale: 1, x: 90 + (group * 3 + look) * 182,
      y: 776, lane: 784, state: 'walking', stop: null, hasWatched: true, direction: look === 1 ? -1 : 1,
      stride: look * 0.67, velocity: age === 'kid' ? 44 : 38, speed: age === 'kid' ? 44 : 38,
    })));
    scene.update(0, 0);
    return canvas.toDataURL();
  });
  await fs.writeFile(path.join(output, 'walking-poses.png'), Buffer.from(sheet.split(',')[1], 'base64'));
  await page.screenshot({ path: path.join(output, 'walkers-in-garden.png'), fullPage: true });
  const motion = await page.evaluate(() => {
    const scene = window.pondReview;
    const people = scene.world.crowd.people;
    Object.assign(scene.world.employee, { phase: 'leaving', x: 1140, y: 778, velocity: 52 });
    scene.update(0, 0);
    const initial = [...people.map(person => person.x), scene.world.employee.x];
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1260;
    const context = canvas.getContext('2d'); context.fillStyle = '#dce6df'; context.fillRect(0, 0, 1600, 1260);
    for (let sample = 0; sample < 8; sample++) {
      if (sample) for (let tick = 0; tick < 30; tick++) scene.update(sample * 1000 + tick * 1000 / 120, 1000 / 120);
      const walkers = [...people.map(person => ({ person, rig: scene.children.getByName('observer-' + person.id), name: 'observer-art' })),
        { person: scene.world.employee, rig: scene.children.getByName('machine-employee'), name: 'employee-art' }];
      walkers.forEach(({ person, rig, name }, row) => {
        const sprite = rig.getByName(name), frame = sprite.frame;
        const baseline = row * 180 + 172;
        const origin = sample * 200 + (person.direction === 1 ? 50 : 150) + person.x - initial[row] + sprite.x;
        context.save(); context.beginPath(); context.rect(sample * 200, row * 180, 200, 180); context.clip();
        context.strokeStyle = '#a3b5a6'; context.beginPath(); context.moveTo(sample * 200, baseline); context.lineTo((sample + 1) * 200, baseline); context.stroke();
        context.translate(origin, baseline); context.scale(sprite.scaleX * (sprite.flipX ? -1 : 1), sprite.scaleY);
        context.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
          frame.x - sprite.displayOriginX, frame.y - sprite.displayOriginY, frame.cutWidth, frame.cutHeight);
        context.restore(); context.fillStyle = '#4e6256'; context.font = '10px monospace';
        context.fillText((sample * .25).toFixed(2) + 's', sample * 200 + 3, row * 180 + 11);
      });
    }
    return canvas.toDataURL();
  });
  await fs.writeFile(path.join(output, 'walking-in-motion.png'), Buffer.from(motion.split(',')[1], 'base64'));

  console.log('Walking sheets and in-game view saved to ' + output);
} finally { await browser.close(); }
