import './styles.css';
import { createPond, type PondScene, type PondState } from './game.ts';
import { SPECIES } from './simulation.ts';
import { COIN_PRICE, THROWS_PER_COIN, type VendingPhase } from './vending.ts';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const guide = element<HTMLDialogElement>('guide-dialog');
const machine = element<HTMLDialogElement>('machine-dialog');
let pond: PondScene;
let pausedForGuide = false;
let best = 0;
let soundOn = false;
let audio: AudioContext | undefined;
let lastPhase: VendingPhase = 'ready';
try { best = Number(localStorage.getItem('feed-the-fish-best-score')) || 0; } catch { /* Storage is optional. */ }
const money = (amount: number) => amount + ' kr';
function updateBest(): void { element('best-score').textContent = best > 0 ? 'Most kindness: ' + best + ' points' : 'A lovely place to begin'; }
updateBest();

element('species-grid').innerHTML = SPECIES.map(profile =>
  '<article class="species-card"><div class="species-art ' + profile.texture + '" style="--sprite-row:' +
  ['koi', 'carp', 'duck', 'gull'].indexOf(profile.texture) + '"></div><div class="species-kind">' +
  (profile.kind === 'fish' ? 'LISTENS FOR THE SPLASH' : 'WATCHES THE THROW') +
  '</div><h3>' + profile.name + '</h3><p>' + profile.description +
  '</p><div class="species-traits"><span>PACE <strong>' +
  (profile.speed < 40 ? 'Unhurried' : profile.speed > 70 ? 'Very quick' : 'Steady') +
  '</strong></span><span>CHEW <strong>' + profile.chew + 's</strong></span></div></article>'
).join('');

function openMachine(): void {
  if (!pond?.ready || machine.open) return;
  if (guide.open) guide.close();
  machine.showModal();
  element('insert-coin').focus({ preventScroll: true });
}
function closeMachine(): void {
  if (pond.world.machine.busy) return;
  machine.close();
}
for (const id of ['refill-button', 'machine-watch']) {
  element(id).addEventListener('click', id === 'refill-button' ? openMachine : closeMachine);
}
element('close-machine').addEventListener('click', closeMachine);
element('insert-coin').addEventListener('click', () => { pond.buyPellets(); });
machine.addEventListener('cancel', event => { if (pond.world.machine.busy) event.preventDefault(); });
document.addEventListener('pond:ready', openMachine);
document.addEventListener('pond:needs-food', openMachine);
document.addEventListener('pond:dispensed', () => {
  machine.close();
  element('instruction-text').textContent = 'Pick a quiet spot in the water.';
  element('pond').focus({ preventScroll: true });
  tone(660, 0.2);
});

element('guide-button').addEventListener('click', () => {
  pausedForGuide = !pond.world.paused;
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
document.addEventListener('keydown', event => {
  if (guide.open || machine.open || (event.target instanceof HTMLElement && event.target.closest('input,textarea'))) return;
  const control = event.target instanceof HTMLElement && event.target.closest('button,a');
  if (event.code === 'Space' && !control) { event.preventDefault(); pond.scatter(); }
  if (event.code === 'KeyP') pond.togglePause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && pond?.ready && !pond.world.paused && !machine.open && !guide.open) pond.togglePause();
});

element('sound-button').addEventListener('click', async () => {
  soundOn = !soundOn;
  if (soundOn) {
    try { audio ??= new AudioContext(); await audio.resume(); } catch { soundOn = false; }
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
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.8, audio.currentTime + duration);
  volume.gain.setValueAtTime(0.01, audio.currentTime);
  volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  oscillator.connect(volume); volume.connect(audio.destination);
  oscillator.start(); oscillator.stop(audio.currentTime + duration);
}
document.addEventListener('pond:toss', () => tone(480, 0.16));
document.addEventListener('pond:coin', () => tone(1000, 0.08));
document.addEventListener('pond:bite', event => tone((event as CustomEvent).detail === 'fish' ? 750 : 320, 0.08));

const phaseText: Record<VendingPhase, string> = {
  ready: 'Click the coin to begin.',
  inserting: 'A little coin goes in…',
  turning: 'A turn of the handle…',
  dispensing: 'Here come the pellets…',
  collecting: 'Hold out your hand. A little kindness awaits.',
};
document.addEventListener('pond:state', event => {
  const state = (event as CustomEvent<PondState>).detail;
  element('food-count').textContent = String(state.handfuls);
  element('food-bar').style.width = Math.min(100, state.handfuls / THROWS_PER_COIN * 100) + '%';
  element('fish-count').textContent = String(state.fish);
  element('score').textContent = String(state.score);
  element('money-used').textContent = money(state.moneyUsed);
  element('machine-total').textContent = money(state.moneyUsed);
  element('machine-coins').textContent = String(state.coinsUsed);
  const hasMeals = state.fishFood + state.birdFood > 0;
  element('share-value').textContent = hasMeals ? Math.round(state.share * 100) + '%' : '—';
  element('share-fill').style.width = hasMeals ? state.share * 100 + '%' : '0%';
  element('paused-overlay').hidden = !state.paused;
  const pause = element('pause-button');
  pause.innerHTML = state.paused ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 8 5-8 5z"/></svg>' : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10M11 3v10"/></svg>';
  pause.setAttribute('aria-pressed', String(state.paused));
  pause.setAttribute('aria-label', state.paused ? 'Resume game' : 'Pause game');
  element<HTMLButtonElement>('scatter-button').disabled = state.paused || state.machinePhase !== 'ready' || state.handfuls === 0;
  const busy = state.machinePhase !== 'ready';
  for (const id of ['insert-coin', 'close-machine', 'machine-watch']) element<HTMLButtonElement>(id).disabled = busy;
  element('vending-stage').setAttribute('aria-busy', String(busy));
  if (lastPhase !== state.machinePhase) {
    element('machine-status').textContent = phaseText[state.machinePhase];
    element('vending-stage').dataset.phase = state.machinePhase;
    if (state.machinePhase === 'turning') tone(230, 0.2);
    lastPhase = state.machinePhase;
  }
  const visitNote = state.paused ? 'Take a breather. The pond will wait.' : state.handfuls === 0
    ? state.coinsUsed === 0 ? 'First, a coin and a little ritual at the pellet machine.' : 'Your hand is empty. Enjoy the ripples, or visit the machine for a little more.'
    : 'Every throw leaves the dock. Aim where you like; there is no hurry.';
  if (element('visit-note').textContent !== visitNote) element('visit-note').textContent = visitNote;
  if (state.score > best) {
    best = state.score;
    try { localStorage.setItem('feed-the-fish-best-score', String(best)); } catch { /* Storage is optional. */ }
    updateBest();
  }
});
element('coin-price').textContent = money(COIN_PRICE);
element('serving-count').textContent = String(THROWS_PER_COIN);
element('insert-coin').querySelector('span')!.textContent = String(COIN_PRICE);
element('insert-coin').setAttribute('aria-label', 'Insert ' + money(COIN_PRICE) + ' coin');
element('refill-button').querySelector('span')!.textContent = money(COIN_PRICE);
pond = createPond();
