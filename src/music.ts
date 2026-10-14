// "Lanterns on the Pond": an original, gentle chiptune in D Dorian and 6/8.
// Nordic folk phrasing and a storybook rise-and-return give the garden a little
// fairy-tale character. These are newly composed phrases, not a borrowed tune.
type Note = readonly [midi: number, eighths: number];
type Bar = readonly Note[];
type Chord = readonly [bass: number, third: number, fifth: number];
export interface MusicNote { voice: 'lead' | 'bell' | 'bass'; midi: number; start: number; duration: number; gain: number }
export const MUSIC_EIGHTH_SECONDS = 60 / 64 / 3;
export const MUSIC_DURATION = 48 * 6 * MUSIC_EIGHTH_SECONDS;
const A: readonly Bar[] = [
  [[74, 2], [69, 1], [74, 1], [77, 1], [76, 1]],
  [[74, 3], [72, 1], [69, 1], [0, 1]],
  [[77, 2], [76, 1], [74, 2], [69, 1]],
  [[72, 2], [74, 1], [76, 2], [0, 1]],
  [[79, 2], [77, 1], [76, 1], [71, 1], [74, 1]],
  [[77, 3], [81, 1], [79, 1], [77, 1]],
  [[76, 2], [72, 1], [69, 1], [72, 1], [76, 1]],
  [[74, 4], [0, 2]],
];
const A2: readonly Bar[] = [
  [[69, 1], [74, 2], [77, 1], [76, 1], [74, 1]],
  [[72, 2], [71, 1], [69, 2], [0, 1]],
  [[74, 1], [77, 2], [81, 1], [79, 1], [77, 1]],
  [[76, 3], [74, 1], [72, 1], [0, 1]],
  [[71, 1], [74, 1], [79, 1], [77, 2], [76, 1]],
  [[77, 2], [74, 1], [69, 2], [74, 1]],
  [[72, 2], [76, 1], [74, 1], [72, 1], [69, 1]],
  [[74, 3], [0, 3]],
];
const B: readonly Bar[] = [
  [[81, 2], [79, 1], [77, 2], [76, 1]],
  [[79, 3], [76, 1], [74, 1], [72, 1]],
  [[77, 2], [81, 1], [84, 2], [81, 1]],
  [[79, 2], [77, 1], [76, 2], [0, 1]],
  [[79, 1], [81, 1], [79, 1], [74, 2], [71, 1]],
  [[77, 3], [76, 1], [74, 1], [72, 1]],
  [[76, 2], [74, 1], [72, 1], [69, 1], [72, 1]],
  [[74, 3], [0, 3]],
];
const D: Chord = [50, 65, 69], C: Chord = [48, 64, 67], F: Chord = [53, 65, 69];
const G: Chord = [43, 62, 71], Am: Chord = [45, 60, 64];
const harmonyA = [D, C, F, C, G, D, Am, D];
const harmonyB = [F, C, F, Am, G, F, Am, D];

export function musicScore(): MusicNote[] {
  const score: MusicNote[] = [];
  const sections = [A, A2, B, B, A, A2];
  for (const [section, bars] of sections.entries()) for (const [bar, melody] of bars.entries()) {
    const start = (section * 8 + bar) * 6 * MUSIC_EIGHTH_SECONDS;
    const chord = (section === 2 || section === 3 ? harmonyB : harmonyA)[bar];
    const quiet = section === 3 || section === 5;
    let offset = 0;
    for (const [midi, eighths] of melody) {
      if (midi) score.push({ voice: 'lead', midi: midi - (section === 3 ? 12 : 0), start: start + offset * MUSIC_EIGHTH_SECONDS,
        duration: eighths * MUSIC_EIGHTH_SECONDS * .9, gain: quiet ? .055 : .07 });
      offset += eighths;
    }
    // Two dotted-quarter pulses, with space between the plucked accompaniment.
    for (const beat of [0, 3]) {
      if (bar === 7 && beat === 3) continue;
      score.push({ voice: 'bass', midi: beat === 0 ? chord[0] : chord[0] + 7,
        start: start + beat * MUSIC_EIGHTH_SECONDS, duration: 2.6 * MUSIC_EIGHTH_SECONDS, gain: .055 });
    }
    const pattern = section % 2 ? [1, 2, 1, 2] : [1, 2, 2, 1];
    for (const [index, beat] of [1, 2, 4, 5].entries()) {
      // Leave the last cadence open so the loop takes a breath before returning.
      if (bar === 7 && beat >= 3) continue;
      score.push({ voice: 'bell', midi: chord[pattern[index]] + 12, start: start + beat * MUSIC_EIGHTH_SECONDS,
        duration: .7 * MUSIC_EIGHTH_SECONDS, gain: quiet ? .015 : .022 });
    }
  }
  return score.sort((a, b) => a.start - b.start);
}

// Render once on the first sound gesture. A single looping buffer avoids timer
// drift, stacked music loops, background scheduling, and extra asset downloads.
export function renderMusic(sampleRate = 22050): Float32Array {
  const dry = new Float32Array(Math.ceil(MUSIC_DURATION * sampleRate));
  for (const note of musicScore()) {
    const start = Math.round(note.start * sampleRate), count = Math.ceil(note.duration * sampleRate);
    const frequency = 440 * 2 ** ((note.midi - 69) / 12);
    for (let index = 0; index < count && start + index < dry.length; index++) {
      const time = index / sampleRate, phase = time * frequency % 1;
      const wave = note.voice === 'bass' ? Math.round((1 - 4 * Math.abs(phase - .5)) * 15) / 15
        : note.voice === 'bell' ? (phase < .25 ? .75 : -.25) : (phase < .5 ? 1 : -1);
      const attack = Math.min(1, time / .012), release = Math.min(1, (note.duration - time) / .075);
      const decay = note.voice === 'bell' ? Math.exp(-time * 8) : .82 + .18 * Math.exp(-time * 5);
      dry[start + index] += wave * note.gain * attack * Math.max(0, release) * decay;
    }
  }
  const samples = new Float32Array(dry.length);
  const delay = Math.round(MUSIC_EIGHTH_SECONDS * 1.5 * sampleRate);
  const smoothing = 1 - Math.exp(-2 * Math.PI * 2200 / sampleRate);
  let filtered = 0;
  for (let i = 0; i < dry.length; i++) {
    const signal = dry[i] + (i >= delay ? dry[i - delay] * .12 : 0) + (i >= delay * 2 ? dry[i - delay * 2] * .04 : 0);
    filtered += smoothing * (signal - filtered);
    samples[i] = filtered;
  }
  return samples;
}

export class PondMusic {
  private buffer: AudioBuffer | undefined;
  private active: { source: AudioBufferSourceNode; volume: GainNode; startedAt: number } | undefined;
  private offset = 0;
  private readonly context: AudioContext;
  constructor(context: AudioContext) { this.context = context; }

  setPlaying(playing: boolean): void {
    if (playing === !!this.active) return;
    const now = this.context.currentTime;
    if (!playing) {
      const { source, volume, startedAt } = this.active!;
      this.offset = (this.offset + now - startedAt) % this.buffer!.duration;
      volume.gain.cancelScheduledValues(now);
      volume.gain.setValueAtTime(volume.gain.value, now);
      volume.gain.linearRampToValueAtTime(0, now + .05);
      source.stop(now + .055);
      this.active = undefined;
      return;
    }
    if (!this.buffer) {
      const samples = renderMusic();
      this.buffer = this.context.createBuffer(1, samples.length, 22050);
      this.buffer.getChannelData(0).set(samples);
    }
    const startedAt = this.context.currentTime;
    const source = this.context.createBufferSource(), volume = this.context.createGain();
    source.buffer = this.buffer; source.loop = true;
    volume.gain.setValueAtTime(0, startedAt); volume.gain.linearRampToValueAtTime(.25, startedAt + .15);
    source.connect(volume); volume.connect(this.context.destination);
    source.onended = () => { source.disconnect(); volume.disconnect(); };
    source.start(startedAt, this.offset);
    this.active = { source, volume, startedAt };
  }
}
