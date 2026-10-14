import test from 'node:test';
import assert from 'node:assert/strict';
import { MUSIC_DURATION, musicScore, renderMusic } from '../src/music.ts';

test('the complete chiptune renders at a gentle level with no clipping, missing sections, or loop click', () => {
  const rate = 22050, samples = renderMusic(rate);
  assert.equal(samples.length / rate, MUSIC_DURATION);
  let peak = 0, biggestStep = 0;
  for (let i = 0; i < samples.length; i++) {
    assert.ok(Number.isFinite(samples[i]));
    peak = Math.max(peak, Math.abs(samples[i]));
    if (i) biggestStep = Math.max(biggestStep, Math.abs(samples[i] - samples[i - 1]));
  }
  assert.ok(peak > .05 && peak < .2, 'The unamplified mix leaves ample headroom for sound effects');
  assert.ok(biggestStep < .1, 'Envelopes and filtering soften the square-wave edges');
  assert.ok(Math.abs(samples[0] - samples.at(-1)!) < .00001, 'The loop joins at silence');
  for (let second = 0; second < MUSIC_DURATION; second++) {
    let energy = 0;
    for (let i = second * rate; i < (second + 1) * rate; i++) energy += samples[i] ** 2;
    assert.ok(Math.sqrt(energy / rate) > .001, `Missing musical bar near ${second}s`);
  }
});

test('all three chiptune voices fit the loop and the melody develops across its quieter middle section', () => {
  const score = musicScore();
  assert.deepEqual([...new Set(score.map(note => note.voice))].sort(), ['bass', 'bell', 'lead']);
  assert.ok(score.every(note => note.start >= 0 && note.duration > 0 && note.start + note.duration <= MUSIC_DURATION));
  const lead = score.filter(note => note.voice === 'lead');
  assert.ok(new Set(lead.map(note => note.midi)).size >= 8);
  assert.ok(lead.some(note => note.start > 45 && note.start < 60 && note.midi < 69));
  assert.ok(lead.every(note => note.midi >= 57 && note.midi <= 84));
});
