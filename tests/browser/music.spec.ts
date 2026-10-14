import { test, expect } from '@playwright/test';

type AudioAudit = { contexts: number; buffers: number; sources: { node: AudioBufferSourceNode; active: boolean; offset: number }[]; analyser?: AnalyserNode };
type AudioWindow = Window & { audioAudit: AudioAudit };

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`music waits for sound consent, plays one quiet loop, and resumes correctly at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      const Original = window.AudioContext;
      const audit: AudioAudit = { contexts: 0, buffers: 0, sources: [] };
      (window as AudioWindow).audioAudit = audit;
      window.AudioContext = class extends Original {
        constructor() {
          super(); audit.contexts++;
          audit.analyser = this.createAnalyser(); audit.analyser.fftSize = 2048; audit.analyser.connect(this.destination);
        }
        createBuffer(channels: number, length: number, rate: number) { audit.buffers++; return super.createBuffer(channels, length, rate); }
        createGain() {
          const node = super.createGain(), connect = node.connect.bind(node), destination = this.destination;
          node.connect = ((target: AudioNode) => connect(target === destination ? audit.analyser! : target)) as typeof node.connect;
          return node;
        }
        createBufferSource() {
          const node = super.createBufferSource(), start = node.start.bind(node);
          const entry = { node, active: false, offset: 0 }; audit.sources.push(entry);
          node.start = (when = 0, offset = 0) => { entry.active = true; entry.offset = offset; start(when, offset); };
          node.addEventListener('ended', () => { entry.active = false; });
          return node;
        }
      };
    });
    await page.goto('/');
    await expect(page.locator('#loading')).toBeHidden();
    expect(await page.evaluate(() => (window as AudioWindow).audioAudit.contexts)).toBe(0);
    await page.getByRole('button', { name: 'Turn sound on', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Turn sound off', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const active = () => page.evaluate(() => (window as AudioWindow).audioAudit.sources.filter(source => source.active).length);
    const energy = () => page.evaluate(() => {
      const analyser = (window as AudioWindow).audioAudit.analyser!;
      const data = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(data);
      return Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
    });
    await expect.poll(active).toBe(1);
    await expect.poll(energy).toBeGreaterThan(.001);
    const track = await page.evaluate(() => {
      const audit = (window as AudioWindow).audioAudit, source = audit.sources[0].node;
      return { contexts: audit.contexts, buffers: audit.buffers, loop: source.loop, duration: source.buffer!.duration };
    });
    expect(track).toEqual({ contexts: 1, buffers: 1, loop: true, duration: 90 });
    await page.getByRole('button', { name: 'Assist mode', exact: true }).click();
    await page.getByRole('button', { name: 'Field guide', exact: true }).click();
    await expect.poll(active).toBe(0);
    await expect.poll(energy).toBeLessThan(.0001);
    await page.locator('#close-guide').click();
    await expect.poll(active).toBe(1);
    expect(await page.evaluate(() => (window as AudioWindow).audioAudit.sources.at(-1)!.offset)).toBeGreaterThan(.05);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect.poll(active).toBe(0);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect.poll(active).toBe(1);
    // Rapid toggles while resume() is pending must not leave a stale second loop.
    await page.evaluate(() => { for (let i = 0; i < 4; i++) document.getElementById('sound-button')!.click(); });
    await expect.poll(active).toBe(1);
    expect(await page.evaluate(() => (window as AudioWindow).audioAudit.buffers)).toBe(1);
    await page.getByRole('button', { name: 'Turn sound off', exact: true }).click();
    await expect.poll(active).toBe(0);
    await expect.poll(energy).toBeLessThan(.0001);
    await expect(page.getByRole('button', { name: 'Turn sound on', exact: true })).toHaveAttribute('aria-pressed', 'false');
  });
}

test('unavailable audio leaves sound off and the pond usable', async ({ page }) => {
  await page.addInitScript(() => { window.AudioContext = class { constructor() { throw new Error('Audio unavailable'); } } as unknown as typeof AudioContext; });
  await page.goto('/'); await expect(page.locator('#loading')).toBeHidden();
  await page.getByRole('button', { name: 'Turn sound on', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Turn sound on', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Pellet machine' }).click();
  await expect(page.locator('#machine-dialog')).toBeVisible();
});
