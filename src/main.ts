import './styles.css';
import { createPond, type PondScene, type PondState } from './game.ts';
import { SPECIES } from './simulation.ts';
import { animalAtlas, animalFrame } from './appearance.ts';
import { COIN_PRICE, THROWS_PER_COIN, type VendingPhase } from './vending.ts';
import { LUCKY_BONUS_POINTS } from './throws.ts';
import { pelletStockLevel } from './pellet-stock-art.ts';
import { HandIconDeck } from './hand-icon.ts';
import { PondMusic } from './music.ts';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const guide = element<HTMLDialogElement>('guide-dialog');
const machine = element<HTMLDialogElement>('machine-dialog');
let pond: PondScene;
let pausedForGuide = false;
let pausedForVisibility = false;
let assistMode = false;
let best = 0;
let soundOn = false;
let audio: AudioContext | undefined;
let music: PondMusic | undefined;
let soundRequest = 0;
let lastPhase: VendingPhase = 'ready';
let lastMachineFillLevel = -1;
const handIcons = new HandIconDeck();

try { assistMode = localStorage.getItem('feed-the-fish-assist') === 'on'; } catch { /* Storage is optional. */ }
function updateAssistMode(): void {
  document.body.dataset.assist = assistMode ? 'on' : 'off';
  element('assist-button').setAttribute('aria-pressed', String(assistMode));
  // Revealing the introduction moves the canvas without resizing the window.
  if (pond?.ready) pond.scale.updateBounds();
}
updateAssistMode();
element('assist-button').addEventListener('click', () => {
  assistMode = !assistMode;
  updateAssistMode();
  try { localStorage.setItem('feed-the-fish-assist', assistMode ? 'on' : 'off'); } catch { /* Storage is optional. */ }
});

function updateMachineFill(fillFraction: number, scene = pond): void {
  const canvas = element<HTMLCanvasElement>('machine-fill');
  const level = pelletStockLevel(fillFraction);
  canvas.hidden = level === 0;
  canvas.dataset.level = String(level);
  if (lastMachineFillLevel === level || !scene?.textures.exists('pellet-stock')) return;
  const frame = scene.textures.getFrame('pellet-stock', `stock-${level || 1}`)!;
  canvas.width = frame.realWidth;
  canvas.height = frame.realHeight;
  const context = canvas.getContext('2d')!;
  context.imageSmoothingEnabled = false;
  if (level > 0) {
    context.drawImage(frame.source.image as HTMLImageElement, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
      frame.x, frame.y, frame.cutWidth, frame.cutHeight);
  }
  lastMachineFillLevel = level;
}
try { best = Number(localStorage.getItem('feed-the-fish-best-score')) || 0; } catch { /* Storage is optional. */ }
const money = (amount: number) => amount + ' kr';
function updateBest(): void { element('best-score').textContent = best > 0 ? 'Most kindness: ' + best + ' points' : 'A lovely place to begin'; }
updateBest();

element('species-grid').innerHTML = SPECIES.map(profile =>
  '<article class="species-card"><img class="species-art" data-species="' + profile.id + '" alt=""><div class="species-kind">' +
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
document.addEventListener('pond:ready', event => {
  const scene = (event as CustomEvent<PondScene>).detail;
  updateMachineFill(scene.world.machine.fillFraction, scene);
  for (const profile of SPECIES) {
    const portrait = document.querySelector<HTMLImageElement>('[data-species="' + profile.id + '"]')!;
    portrait.src = scene.textures.getBase64(animalAtlas(profile.kind), animalFrame(profile.texture, 'e'));
  }
  const carpPortrait = scene.textures.getBase64('fish-swimmers', animalFrame('koi', 'e'));
  for (const icon of document.querySelectorAll<HTMLElement>('.brand-fish')) {
    icon.style.backgroundImage = `url(${carpPortrait})`;
    icon.style.backgroundSize = 'contain';
    icon.style.backgroundPosition = 'center';
    icon.style.backgroundRepeat = 'no-repeat';
  }
});
document.addEventListener('pond:machine', openMachine);
document.addEventListener('pond:needs-food', openMachine);
document.addEventListener('pond:dispensed', () => {
  machine.close();
  element('instruction-text').textContent = 'Click the water or press Space to throw.';
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
element('scatter-button').addEventListener('click', () => pond.scatter({ x: 600, y: 389 }));
element('restart-button').addEventListener('click', () => pond.restart());
document.addEventListener('keydown', event => {
  if (guide.open || machine.open || (event.target instanceof HTMLElement && event.target.closest('input,textarea'))) return;
  const control = event.target instanceof HTMLElement && event.target.closest('button,a');
  if (event.code === 'Space' && !control) { event.preventDefault(); pond.scatter(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) music?.setPlaying(false);
  if (!pond?.ready) return;
  if (document.hidden) {
    pausedForVisibility = !pond.world.paused;
    if (pausedForVisibility) pond.togglePause();
  } else if (pausedForVisibility) {
    if (pond.world.paused) pond.togglePause();
    pausedForVisibility = false;
  }
  syncMusic();
});

element('sound-button').addEventListener('click', async () => {
  soundOn = !soundOn;
  const request = ++soundRequest;
  updateSoundButton();
  if (!soundOn) { music?.setPlaying(false); return; }
  if (soundOn) {
    try {
      audio ??= new AudioContext(); await audio.resume();
      if (request !== soundRequest || !soundOn) return;
      music ??= new PondMusic(audio); syncMusic();
    } catch { if (request === soundRequest) { soundOn = false; updateSoundButton(); } }
  }
});
function syncMusic(): void { music?.setPlaying(soundOn && !document.hidden && !pond?.world.paused); }
window.addEventListener('pagehide', () => music?.setPlaying(false));
window.addEventListener('pageshow', syncMusic);
function updateSoundButton(): void {
  const button = element('sound-button');
  button.setAttribute('aria-pressed', String(soundOn));
  button.setAttribute('aria-label', soundOn ? 'Turn sound off' : 'Turn sound on');
  button.querySelector('span')!.textContent = soundOn ? 'Sound on' : 'Sound off';
  button.querySelector('path')!.setAttribute('d', soundOn ? 'M11 4 6 8H3v8h3l5 4zM16 8c3 2 3 6 0 8M19 5c5 4 5 10 0 14' : 'M11 4 6 8H3v8h3l5 4zM16 9l5 6m0-6-5 6');
}
function tone(frequency: number, duration = 0.12): void {
  if (!soundOn || !audio || document.hidden) return;
  const oscillator = audio.createOscillator();
  const volume = audio.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.8, audio.currentTime + duration);
  volume.gain.setValueAtTime(0.01, audio.currentTime);
  volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  oscillator.connect(volume); volume.connect(audio.destination);
  oscillator.onended = () => { oscillator.disconnect(); volume.disconnect(); };
  oscillator.start(); oscillator.stop(audio.currentTime + duration);
}
document.addEventListener('pond:toss', () => tone(480, 0.16));
document.addEventListener('pond:coin', () => tone(1000, 0.08));
document.addEventListener('pond:bite', event => tone((event as CustomEvent).detail === 'bird' ? 320 : 750, 0.08));
document.addEventListener('pond:lucky', () => tone(1046, 0.22));

const phaseText: Record<VendingPhase, string> = {
  ready: 'Insert a coin.',
  inserting: 'Inserting coin…',
  turning: 'Turning handle…',
  dispensing: 'Dispensing pellets…',
  collecting: 'Collecting pellets…',
};
document.addEventListener('pond:state', event => {
  const state = (event as CustomEvent<PondState>).detail;
  music?.setPlaying(soundOn && !state.paused && !document.hidden);
  element('food-count').textContent = String(state.handfuls);
  const hand = element('hand-icon');
  const handFrame = handIcons.update(state.handPreviewId, state.handfuls > 0, state.nextHandLucky);
  hand.dataset.frame = String(handFrame);
  hand.style.backgroundPosition = `${handFrame % 4 / 3 * 100}% ${Math.floor(handFrame / 4) / 3 * 100}%`;
  hand.classList.toggle('is-lucky', state.handfuls > 0 && state.nextHandLucky);
  element('food-bar').style.width = Math.min(100, state.handfuls / THROWS_PER_COIN * 100) + '%';
  element('fish-count').textContent = String(state.fish);
  element('score').textContent = String(state.score);
  element('lucky-bonus').hidden = state.luckyBonus === 0;
  element('lucky-bonus').textContent = '✦ Lucky kindness +' + state.luckyBonus;
  element('money-used').textContent = money(state.moneyUsed);
  element('machine-total').textContent = money(state.moneyUsed);
  element('machine-coins').textContent = String(state.coinsUsed);
  const hasMeals = state.fishFood + state.birdFood + state.turtleFood > 0;
  element('share-value').textContent = hasMeals ? Math.round(state.share * 100) + '%' : '—';
  element('share-fill').style.width = hasMeals ? state.share * 100 + '%' : '0%';
  element<HTMLButtonElement>('scatter-button').disabled = state.paused || state.machinePhase !== 'ready' || state.handfuls === 0;
  const busy = state.machinePhase !== 'ready';
  element<HTMLButtonElement>('insert-coin').disabled = busy || state.machineRestocking || state.machineStock === 0;
  for (const id of ['close-machine', 'machine-watch']) element<HTMLButtonElement>(id).disabled = busy;
  updateMachineFill(state.machineFill);
  const status = busy ? phaseText[state.machinePhase] : state.machineRestocking
    ? 'Refilling…' : state.machineStock === 0
    ? 'Sold out. More pellets are on the way.'
    : state.employeePhase === 'arriving' || state.employeePhase === 'waiting'
    ? 'More pellets are on the way.' : phaseText.ready;
  if (element('machine-status').textContent !== status) element('machine-status').textContent = status;
  element('vending-stage').setAttribute('aria-busy', String(busy || state.machineRestocking));
  if (lastPhase !== state.machinePhase) {
    element('vending-stage').dataset.phase = state.machinePhase;
    if (state.machinePhase === 'turning') tone(230, 0.2);
    lastPhase = state.machinePhase;
  }
  const visitNote = state.luckyInHand
    ? 'A golden pellet in your hand. A fish’s nibble brings +' + LUCKY_BONUS_POINTS + ' points.' : state.handfuls === 0
    ? 'Use the red pellet machine to fill your hand.'
    : 'Click the water or press Space to throw from the dock.';
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
