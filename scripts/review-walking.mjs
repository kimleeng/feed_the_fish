import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { OBSERVER_DESIGNS } from '../src/observer-looks.ts';

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
  const sheets = await page.evaluate(visitors => {
    const scene = window.pondReview;
    scene.scene.pause();
    const designs = [...visitors, { design: 'employee', watchingInSheet: false }];
    return designs.map(({ design, watchingInSheet }) => {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = watchingInSheet ? 570 : 380;
      const context = canvas.getContext('2d'); context.imageSmoothingEnabled = false;
      context.fillStyle = '#dce6df'; context.fillRect(0, 0, canvas.width, canvas.height);
      for (let pose = 0; pose < (watchingInSheet ? 9 : 8); pose++) {
        const frame = scene.textures.getFrame('people-walking', `${design}-${pose === 8 ? 'watch' : `step-${pose}`}`);
        const scale = 150 / frame.customData.referenceHeight;
        const x = pose % 4 * 160 + 80, y = Math.floor(pose / 4) * 190 + 180;
        context.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
          x + (frame.x - frame.realWidth / 2) * scale, y + (frame.y - frame.realHeight) * scale,
          frame.cutWidth * scale, frame.cutHeight * scale);
        context.strokeStyle = '#849b8a'; context.beginPath(); context.moveTo(x - 80, y + .5); context.lineTo(x + 80, y + .5); context.stroke();
        context.fillStyle = '#4e6256'; context.font = '10px monospace'; context.fillText(String(pose), x - 76, y - 167);
      }
      return { design, png: canvas.toDataURL() };
    });
  }, OBSERVER_DESIGNS);
  for (const sheet of sheets) await fs.writeFile(path.join(output, sheet.design + '-cycle.png'), Buffer.from(sheet.png.split(',')[1], 'base64'));
  for (const autumn of [false, true]) {
    const cohort = OBSERVER_DESIGNS.filter(design => design.watchingInSheet === autumn);
    const label = autumn ? 'autumn' : 'original';
    await page.evaluate(designs => {
      const scene = window.pondReview, model = scene.world.crowd.people[0];
      scene.world.crowd.people = designs.map(({ age, look }, index) => ({
        ...model, id: 100 + index, age, look, scale: 1, x: 90 + index * 182,
        y: 776, lane: 776, state: 'walking', stop: null, hasWatched: true, direction: index % 2 ? -1 : 1,
        stride: look * 0.67, velocity: age === 'kid' ? 44 : 38, speed: age === 'kid' ? 44 : 38,
      }));
      scene.update(0, 0);
    }, cohort);
    await page.screenshot({ path: path.join(output, `${label}-walkers-in-garden.png`), fullPage: true });
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
          const origin = sample * 200 + (person.direction === 1 ? 50 : 150) + person.x - initial[row];
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
    await fs.writeFile(path.join(output, `${label}-walking-in-motion.png`), Buffer.from(motion.split(',')[1], 'base64'));
    await page.evaluate(() => {
      const scene = window.pondReview;
      scene.world.crowd.people.forEach(person => { person.state = 'watching'; person.watchRemaining = 30; });
      scene.update(0, 0);
    });
    await page.screenshot({ path: path.join(output, `${label}-watching-in-garden.png`), fullPage: true });
  }
  console.log('Complete walking drawings and movement review saved to ' + output);
} finally { await browser.close(); }
