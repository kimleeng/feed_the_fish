import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { OBSERVER_DESIGNS } from '../src/observer-looks.ts';
import { walkingDistance, walkingFrames } from '../src/walking.ts';

const output = process.argv[3] || path.resolve('test-results/walking-review');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1340 } });
  page.on('pageerror', error => console.error(error));
  await page.addInitScript(() => document.addEventListener('pond:ready', event => window.pondReview = event.detail));
  await page.goto(process.argv[2] || 'http://127.0.0.1:5173');
  await page.locator('#loading').waitFor({ state: 'hidden' });
  if (await page.locator('#machine-dialog').isVisible()) await page.locator('#machine-watch').click();
  const sheets = await page.evaluate(visitors => {
    const scene = window.pondReview;
    scene.scene.pause();
    return visitors.map(({ design, watchingInSheet, count }) => {
      const total = count + (watchingInSheet ? 1 : 0);
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = Math.ceil(total / 4) * 190;
      const context = canvas.getContext('2d'); context.imageSmoothingEnabled = false;
      context.fillStyle = '#dce6df'; context.fillRect(0, 0, canvas.width, canvas.height);
      for (let pose = 0; pose < total; pose++) {
        const frame = scene.textures.getFrame('people-walking', `${design}-${pose === count ? 'watch' : `step-${pose}`}`);
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
  }, [...OBSERVER_DESIGNS, { design: 'employee', watchingInSheet: false }]
    .map(design => ({ ...design, count: walkingFrames(design.design) })));
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
  for (const age of ['adult', 'kid']) {
    const design = `observer-${age}-0`, height = age === 'adult' ? 158 : 109;
    const speed = age === 'adult' ? 38 : 44;
    const distance = walkingDistance(design, height), duration = distance / speed, count = Math.round(duration * 30);
    const images = await page.evaluate(({ age, distance, count, speed }) => {
      const scene = window.pondReview, model = scene.world.crowd.people[0];
      const person = { ...model, id: 9000, age, look: 0, scale: 1, x: 450, y: 776, lane: 776,
        state: 'walking', stop: null, hasWatched: true, speed, velocity: speed, stride: 0 };
      scene.world.crowd.people = [person];
      const c = document.createElement('canvas'); c.width = 480; c.height = age === 'adult' ? 240 : 190;
      const g = c.getContext('2d'), images = [], baseline = c.height - 23;
      for (let sample = 0; sample < count; sample++) {
        const phase = sample / count, travel = distance * phase;
        g.fillStyle = '#e3e9de'; g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = '#344d3a'; g.font = '12px sans-serif';
        g.fillText(`${age} · ${speed.toFixed(1)} px/s · game size · both directions`, 12, 17);
        for (let column = 0; column < 2; column++) {
          person.direction = column === 0 ? 1 : -1;
          person.x = 450 + person.direction * travel; person.stride = phase * 4;
          scene.update(0, 0);
          const sprite = scene.children.getByName('observer-9000').getByName('observer-art'), f = sprite.frame;
          g.save(); g.beginPath(); g.rect(column * 240, 24, 240, c.height - 24); g.clip();
          g.strokeStyle = '#a4b6a5'; g.beginPath(); g.moveTo(column * 240, baseline + .5); g.lineTo((column + 1) * 240, baseline + .5); g.stroke();
          const spacing = distance / 4, shift = -person.direction * travel % spacing;
          for (let x = column * 240 - spacing + shift; x < (column + 1) * 240; x += spacing) {
            g.beginPath(); g.moveTo(x, baseline); g.lineTo(x, baseline + 5); g.stroke();
          }
          g.translate(column * 240 + 120, baseline); g.scale(sprite.scaleX * (sprite.flipX ? -1 : 1), sprite.scaleY);
          g.drawImage(f.source.image, f.cutX, f.cutY, f.cutWidth, f.cutHeight,
            f.x - sprite.displayOriginX, f.y - sprite.displayOriginY, f.cutWidth, f.cutHeight);
          g.restore();
        }
        images.push(c.toDataURL().split(',')[1]);
      }
      return images;
    }, { age, distance, count, speed });
    const directory = path.join(output, `${age}-motion`); await fs.mkdir(directory, { recursive: true });
    for (const [i, png] of images.entries()) await fs.writeFile(path.join(directory, `frame-${String(i).padStart(3, '0')}.png`), Buffer.from(png, 'base64'));
    await promisify(execFile)('ffmpeg', ['-v', 'error', '-y', '-framerate', String(count / duration), '-i', path.join(directory, 'frame-%03d.png'),
      '-filter_complex', 'split[a][b];[a]palettegen[p];[b][p]paletteuse=dither=bayer:bayer_scale=3', '-loop', '0', path.join(output, `${age}-walking.gif`)]);
  }
  await page.evaluate(() => {
    const scene = window.pondReview, model = scene.world.crowd.people[0];
    scene.world.crowd.people = ['adult', 'kid'].map((age, i) => ({ ...model, id: 9500 + i, age, look: 0, scale: 1,
      direction: i === 0 ? 1 : -1, x: 450 + i * 200, y: 776, lane: 776, stride: i === 0 ? .78 : 2.66,
      state: 'walking', stop: null, hasWatched: true }));
    scene.update(0, 0);
  });
  await page.screenshot({ path: path.join(output, 'test-pair-in-garden.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(output, 'test-pair-on-phone.png'), fullPage: true });
  console.log('Complete walking drawings, loop previews, and movement review saved to ' + output);
} finally { await browser.close(); }
