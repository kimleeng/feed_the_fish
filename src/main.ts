import './styles.css';
import { createPond, type PondScene } from './game.ts';
import { HANDFULS, SPECIES } from './simulation.ts';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const guide = element<HTMLDialogElement>('guide-dialog');
const results = element<HTMLDialogElement>('results-dialog');
let pond: PondScene;
let pausedForGuide = false;
let best = 0;
let soundOn = false;
let audio: AudioContext | undefined;
try { best = Number(localStorage.getItem('feed-the-fish-best')) || 0; } catch { /* Storage is optional. */ }

function updateBest(): void {
  element('best-score').textContent = best > 0 ? `Best afternoon: ${best} fish` : 'A fresh little adventure';
}
updateBest();

element('species-grid').innerHTML = SPECIES.map(profile => `
  <article class="species-card">
    <div class="species-art ${profile.texture}" style="--sprite-row:${['koi', 'carp', 'duck', 'gull'].indexOf(profile.texture)};${profile.id === 'minnow' ? 'opacity:.75;' : ''}"></div>
    <div class="species-kind">${profile.kind === 'fish' ? 'BENEATH THE SURFACE' : 'A SURFACE SNACKER'}</div>
    <h3>${profile.name}</h3><p>${profile.description}</p>
    <div class="species-traits"><span>PACE <strong>${profile.speed < 40 ? 'Unhurried' : profile.speed > 70 ? 'Very quick' : 'Steady'}</strong></span><span>CHEW <strong>${profile.chew}s</strong></span></div>
  </article>`).join('');

element('guide-button').addEventListener('click', () => {
  pausedForGuide = !pond.world.paused && !pond.world.finished;
  if (pausedForGuide) pond.togglePause();
  guide.showModal();
});
element('close-guide').addEventListener('click', () => guide.close());
guide.addEventListener('close', () => {
  if (pausedForGuide && pond.world.paused) pond.togglePause();
  pausedForGuide = false;
});
for (const id of ['pause-button', 'resume-button']) element(id).addEventListener('click', () => pond.togglePause());
element('scatter-button').addEventListener('click', () => pond.scatter({ x: 600, y: 389 }));
element('restart-button').addEventListener('click', () => pond.restart());
element('play-again').addEventListener('click', () => { results.close(); pond.restart(); });
element('close-results').addEventListener('click', () => results.close());

document.addEventListener('keydown', event => {
  if (guide.open || results.open || (event.target instanceof HTMLElement && event.target.closest('input,textarea'))) return;
  const focusedControl = event.target instanceof HTMLElement && event.target.closest('button,a');
  if (event.code === 'Space' && !focusedControl) { event.preventDefault(); pond.scatter(); }
  if (event.code === 'KeyP') pond.togglePause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && pond?.world.started && !pond.world.paused && !pond.world.finished) pond.togglePause();
});

element('sound-button').addEventListener('click', async () => {
  soundOn = !soundOn;
  if (soundOn) {
    try { audio ??= new AudioContext(); await audio.resume(); }
    catch { soundOn = false; }
  }
  const button = element('sound-button');
  button.setAttribute('aria-pressed', String(soundOn));
  button.setAttribute('aria-label', soundOn ? 'Turn sound off' : 'Turn sound on');
  button.querySelector('span')!.textContent = soundOn ? 'Sound on' : 'Sound off';
  button.querySelector('path')!.setAttribute('d', soundOn ? 'M11 4 6 8H3v8h3l5 4zM16 8c3 2 3 6 0 8M19 5c5 4 5 10 0 14' : 'M11 4 6 8H3v8h3l5 4zM16 9l5 6m0-6-5 6');
});
function tone(frequency: number, duration = 0.12): void {
  if (!soundOn || !audio) return;
  const oscillator = audio.createOscillator();
  const volume = audio.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.65, audio.currentTime + duration);
  volume.gain.setValueAtTime(0.025, audio.currentTime);
  volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  oscillator.connect(volume); volume.connect(audio.destination);
  oscillator.start(); oscillator.stop(audio.currentTime + duration);
}
document.addEventListener('pond:toss', () => tone(540));
document.addEventListener('pond:bite', event => tone((event as CustomEvent).detail === 'fish' ? 820 : 290, 0.07));

interface PondState {
  handfuls: number; fish: number; fishFood: number; birdFood: number; share: number;
  seconds: number; paused: boolean; started: boolean; finished: boolean;
}
let latest: PondState;
document.addEventListener('pond:state', event => {
  latest = (event as CustomEvent<PondState>).detail;
  element('food-count').textContent = String(latest.handfuls);
  element('food-bar').style.width = `${latest.handfuls / HANDFULS * 100}%`;
  element('fish-count').textContent = String(latest.fish);
  element('clock').textContent = `${Math.floor(latest.seconds / 60)}:${String(latest.seconds % 60).padStart(2, '0')}`;
  const hasMeals = latest.fishFood + latest.birdFood > 0;
  element('share-value').textContent = hasMeals ? `${Math.round(latest.share * 100)}%` : '—';
  element('share-fill').style.width = hasMeals ? `${latest.share * 100}%` : '0%';
  element('paused-overlay').hidden = !latest.paused;
  const pause = element('pause-button');
  pause.innerHTML = latest.paused ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 8 5-8 5z"/></svg>' : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10M11 3v10"/></svg>';
  pause.setAttribute('aria-pressed', String(latest.paused));
  pause.setAttribute('aria-label', latest.paused ? 'Resume game' : 'Pause game');
  element<HTMLButtonElement>('scatter-button').disabled = latest.paused || latest.finished || latest.handfuls === 0;
  element('round-note').textContent = latest.finished ? 'A good afternoon, well spent. Visit again whenever you like.' : !latest.started ? 'No rush. Your 90 seconds begin with the first handful.' : latest.paused ? 'The pond is paused. Your crumbs and your time are safe.' : latest.handfuls === 0 ? 'Every crumb is out there. Let the fish finish their meal.' : 'Try a few little handfuls, then give everyone a moment to chew.';
});

document.addEventListener('pond:finished', () => {
  if (latest.fish > best) {
    best = latest.fish;
    try { localStorage.setItem('feed-the-fish-best', String(best)); } catch { /* Storage is optional. */ }
    updateBest();
  }
  element('result-fish').textContent = String(latest.fish);
  element('result-share').textContent = `${Math.round(latest.share * 100)}%`;
  element('result-title').textContent = latest.fish > 0 ? 'The fish say thank you.' : 'The birds enjoyed that.';
  element('result-message').textContent = latest.share >= 0.7 ? 'A generous afternoon for the fish. Even the koi look pleased.' : latest.share > 0.35 ? 'A little for the fish, a little for the birds. Next time, try letting more crumbs sink.' : 'Those birds are cheeky. Try scattering near the fish, away from the surface snackers.';
  results.showModal();
});

pond = createPond();
