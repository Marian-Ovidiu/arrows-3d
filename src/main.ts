import './style.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { loadSave, saveGame } from './persistence';
import { onAccountSaveChange } from './account';
import { initAccountUi } from './account-ui';
import { createSaveState } from './save-state';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PointerGestureTracker } from './pointer-gesture';
import { getTutorialStep } from './tutorial';
import { initPwa } from './pwa';
import { playSound, soundEnabled, toggleSound } from './sound';
import { LEVELS, TUTORIAL_INDEX, getExit, getAvailable, type Piece } from './puzzle';

const icons = {
  pause: '<path d="M8 5v14M16 5v14"/>',
  back: '<path d="m14 6-6 6 6 6"/>',
  settings: '<path d="M4 7h16M4 17h16M9 4v6M16 14v6"/>',
  seed: '<path d="M12 21V10M12 15C3 15 3 8 3 5c7 0 9 4 9 10ZM12 11c0-6 4-9 9-9 0 5-2 9-9 9Z"/>',
  planet: '<circle cx="12" cy="12" r="6"/><ellipse cx="12" cy="12" rx="11" ry="3.5" transform="rotate(-35 12 12)"/>',
  star: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
  arrow: '<path d="M5 19 19 5M5 5h14v14"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  view: '<path d="m12 3 9 5v8l-9 5-9-5V8l9-5ZM3 8l9 5 9-5M12 13v8"/>',
  hint: '<path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2ZM12 1v1M3 5l1 1M21 5l-1 1"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  next: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  undo: '<path d="m9 5-6 6 6 6M3 11h11a6 6 0 0 1 6 6v3"/>',
};
const icon = (name: keyof typeof icons) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <section class="home-screen" id="home-screen" aria-label="Svela, menu principale">
    <button id="home-settings" class="icon-button home-settings" aria-label="Impostazioni">${icon('settings')}</button>
    <div class="home-title"><span class="home-kicker">UN PICCOLO MONDO DA LIBERARE</span><h1>svela<span>✧</span></h1><p>La meraviglia è dentro.</p></div>
    <div class="home-actions"><button id="play-game" class="play-button">Gioca ${icon('next')}</button><button id="open-journey" class="menu-link">Le tue scoperte</button><button id="install-game" class="install-button" hidden>Installa Svela ${icon('arrow')}</button></div>
    <div class="home-orbit" aria-hidden="true"></div>
  </section>
  <main class="game">
    <section class="play-area" aria-label="Puzzle tridimensionale">
      <div class="scene" id="scene"></div>
      <div class="game-hud" id="game-hud" hidden><button id="pause-game" class="icon-button pause-button" aria-label="Pausa">${icon('pause')}</button><span class="progress-badge" id="progress-label"></span></div>
      <div class="tutorial-card" id="tutorial-card" hidden>
        <div class="tutorial-heading"><span class="eyebrow" id="tutorial-step"></span><button id="skip-tutorial">Salta ${icon('next')}</button></div>
        <div role="status" aria-live="polite"><strong id="tutorial-title"></strong><p id="tutorial-description"></p></div>
      </div>
      <p class="graphics-warning" id="graphics-warning" role="status" hidden>La grafica è in pausa. La partita è salvata: attendi il ripristino.</p>
      <div class="tool-rail" id="game-tools" hidden>
        <button id="hint" class="icon-button" title="Trova una freccia libera" aria-label="Suggerimento: trova una freccia libera">${icon('hint')}</button>
        <button id="view" class="icon-button" title="Ripristina la vista" aria-label="Ripristina la vista">${icon('view')}</button>
        <button id="undo" class="icon-button" title="Annulla l’ultima estrazione" aria-label="Annulla l’ultima estrazione" disabled>${icon('undo')}</button>
      </div>
    </section>
  </main>
  <section class="journey-screen" id="journey-screen" aria-label="Le tue scoperte" hidden>
    <button id="back-home" class="icon-button screen-back" aria-label="Torna al menu">${icon('back')}</button>
    <div class="journey-title"><span class="eyebrow">IL TUO PICCOLO VIAGGIO</span><h2>Le scoperte</h2></div>
    <nav class="journey-path" aria-label="Livelli">${[TUTORIAL_INDEX, 0, 1, 2].map((i, order) => `<button class="journey-node" data-level="${i}" aria-pressed="false"><span class="node-art node-art-${order}">${icon((['arrow','seed','planet','star'] as const)[order])}<span class="tab-check" aria-label="completato"></span></span><span class="node-copy"><small>${i === TUTORIAL_INDEX ? 'INIZIA QUI' : `SCOPERTA 0${i + 1}`}</small><strong>${LEVELS[i].name}</strong><span class="node-progress"></span></span></button>`).join('')}</nav>
  </section>
  <dialog id="pause-dialog" class="menu-dialog"><span class="eyebrow">PRENDITI IL TUO TEMPO</span><h2>Un momento.</h2><button id="resume-game" class="play-button">Riprendi ${icon('next')}</button><button id="pause-journey" class="menu-option">Le tue scoperte</button><button id="restart" class="menu-option">Ricomincia il livello</button><button id="pause-settings" class="menu-option">Impostazioni</button><button id="pause-home" class="menu-option muted">Menu principale</button></dialog>
  <dialog id="settings-dialog" class="menu-dialog"><button id="close-settings" class="dialog-close icon-button" aria-label="Chiudi impostazioni">${icon('close')}</button><span class="eyebrow">COME PIACE A TE</span><h2>Il tuo spazio.</h2><button id="sound-toggle" class="setting-toggle" aria-pressed="true"><span>Suoni</span><span class="toggle-track" aria-hidden="true"></span></button><button id="help" class="menu-option">Come si gioca</button><p class="local-save-note">I progressi sono salvati su questo dispositivo.</p></dialog>
  <div id="announcement" class="sr-only" role="status" aria-live="polite"></div>
  <p id="save-warning" class="save-warning" role="status" hidden>Salvataggio non disponibile. Tieni aperto il gioco per conservare questa partita.</p>
  <dialog id="help-dialog"><button class="dialog-close icon-button" aria-label="Chiudi istruzioni">${icon('close')}</button><span class="eyebrow">BASTA CAMBIARE PROSPETTIVA</span><h2>Fai spazio alla scoperta.</h2><ol><li><strong>Ruota la figura.</strong> Trascina con un dito o con il mouse. Puoi guardarla anche da sotto.</li><li><strong>Accendi un percorso.</strong> Tocca un cubo: la luce segue la freccia. Se incontra un ostacolo, si ferma.</li><li><strong>Libera un pezzo.</strong> Tocca di nuovo lo stesso cubo. Esce solo se tutto il percorso è libero.</li><li><strong>Scopri il centro.</strong> Libera tutti i cubi e porta alla luce il piccolo oggetto nascosto.</li></ol><p class="help-note">Un solo fascio alla volta. Puoi ruotare la figura anche con una freccia selezionata. La lampadina ti aiuta quando serve.</p><details><summary>Comandi da tastiera</summary><p>Metti a fuoco la scena: frecce direzionali per ruotare, + e − per lo zoom, N per selezionare un pezzo, Invio per estrarlo, Esc per deselezionare.</p></details><button id="start" class="primary-button">Ho capito, esploriamo ${icon('next')}</button></dialog>
  <dialog id="win-dialog"><span class="win-symbol">✧</span><span class="eyebrow">HAI FATTO SPAZIO ALLA MERAVIGLIA</span><h2 id="win-title"></h2><p id="win-description"></p><div class="win-actions"><button id="next-level" class="primary-button">La prossima scoperta ${icon('next')}</button><button id="admire" class="text-button">Resta a guardare</button></div></dialog>
`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const palette = [0xc77659, 0x8baba1, 0xe5c892, 0x9caebb, 0xdccfba];
let levelIndex = 0;
let remaining: Piece[] = [];
let selected: Piece | null = null;
let history: Piece[] = [];
let generation = 0;
let completionTimer: ReturnType<typeof setTimeout> | undefined;
let savedGame = createSaveState();
let completed = new Set<number>();
let ready = false;
let appActive = true;
let rendering = false;
let idleFrames = 0;
let lastFrameTime = 0;
$('app').inert = true;
let screen: 'home' | 'journey' | 'game' = 'home';
$('app').dataset.screen = screen;

function persistGame() {
  if (!ready) return Promise.resolve();
  savedGame.activeLevel = levelIndex;
  savedGame.completed = [...completed];
  savedGame.levels[String(levelIndex)] = { removedIds: history.map(piece => piece.id) };
  return saveGame(savedGame).then(() => { $('save-warning').hidden = true; }).catch(() => {
    $('save-warning').hidden = false;
  });
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
const mobileGraphics = matchMedia('(pointer: coarse)').matches || Capacitor.isNativePlatform();
renderer.setPixelRatio(Math.min(devicePixelRatio, mobileGraphics ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0xf5f3ec, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
$('scene').append(renderer.domElement);
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute('aria-label', 'Figura 3D. Trascina per ruotare. Tastiera: frecce per ruotare, N per selezionare, Invio per estrarre.');
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.rotateSpeed = 0.7;
controls.minDistance = 4;
controls.maxDistance = 24;
controls.minPolarAngle = 0.05;
controls.maxPolarAngle = Math.PI - 0.05;
controls.target.set(0, 0, 0);
scene.add(new THREE.HemisphereLight(0xfffaf0, 0xa6aa9a, 3));
const sunlight = new THREE.DirectionalLight(0xfff1d8, 4.2);
sunlight.position.set(-5, 8, 6);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(mobileGraphics ? 1024 : 2048, mobileGraphics ? 1024 : 2048);
sunlight.shadow.camera.left = -6; sunlight.shadow.camera.right = 6;
sunlight.shadow.camera.top = 6; sunlight.shadow.camera.bottom = -6;
sunlight.shadow.normalBias = 0.025;
sunlight.shadow.bias = -0.0002;
scene.add(sunlight);
const fillLight = new THREE.DirectionalLight(0xdce9f1, 1.8);
fillLight.position.set(4, 1, -3);
scene.add(fillLight);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.115 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2.6;
ground.receiveShadow = true;
scene.add(ground);
const homeSculpture = new THREE.Group();
scene.add(homeSculpture);
const puzzleGroup = new THREE.Group();
scene.add(puzzleGroup);
// Departing cubes remain visible but no longer intercept taps or block exits.
const departingGroup = new THREE.Group();
scene.add(departingGroup);
const beam = new THREE.Group();
scene.add(beam);
const reward = new THREE.Group();
scene.add(reward);
const meshes = new Map<string, THREE.Group>();
const cubeGeometry = new RoundedBoxGeometry(0.88, 0.88, 0.88, 4, 0.065);
const arrowShape = new THREE.Shape();
arrowShape.moveTo(-0.055, -0.24); arrowShape.lineTo(0.055, -0.24); arrowShape.lineTo(0.055, 0.065);
arrowShape.lineTo(0.18, 0.065); arrowShape.lineTo(0, 0.26); arrowShape.lineTo(-0.18, 0.065); arrowShape.lineTo(-0.055, 0.065); arrowShape.closePath();
const arrowGeometry = new THREE.ShapeGeometry(arrowShape);
const arrowMaterial = new THREE.MeshStandardMaterial({ color: 0x35413c, roughness: 0.8, side: THREE.DoubleSide });
const tutorialOutline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.96, 0.96, 0.96)), new THREE.LineBasicMaterial({ color: 0xad4d34, transparent: true, opacity: 0.8 }));
tutorialOutline.visible = false;
scene.add(tutorialOutline);
const contactRay = new THREE.Raycaster();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
type Animation = { pieceId?: string; start: number; duration: number; update: (t: number) => void; end?: () => void };
let animations: Animation[] = [];
let cameraTween: { start: number; from: THREE.Vector3; to: THREE.Vector3 } | null = null;
const smooth = (t: number) => 1 - Math.pow(1 - t, 3);
const vec = (v: number[]) => new THREE.Vector3(...v);

function disposeGroup(group: THREE.Group) {
  group.traverse(object => {
    if (object instanceof THREE.Mesh) {
      if (object.geometry !== cubeGeometry && object.geometry !== arrowGeometry) object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => { if (material !== arrowMaterial) material.dispose(); });
    }
  });
  group.clear();
}

function makePiece(piece: Piece) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: palette[piece.color], roughness: 0.48, metalness: 0.04 });
  const body = new THREE.Mesh(cubeGeometry, material);
  body.castShadow = true; body.receiveShadow = true;
  group.add(body);
  for (let i = 0; i < 4; i++) {
    const mark = new THREE.Mesh(arrowGeometry, arrowMaterial);
    mark.rotation.y = i * Math.PI / 2;
    mark.position.set(Math.sin(i * Math.PI / 2) * 0.442, 0, Math.cos(i * Math.PI / 2) * 0.442);
    group.add(mark);
  }
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.045, 4), arrowMaterial);
  tip.position.y = 0.455; group.add(tip);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vec(piece.direction));
  group.position.copy(vec(piece.position));
  group.userData.pieceId = piece.id;
  group.traverse(object => { object.userData.pieceId = piece.id; });
  return group;
}

function createPiece(piece: Piece) {
  const group = makePiece(piece);
  puzzleGroup.add(group); meshes.set(piece.id, group);
}

function createHomeSculpture() {
  for (const piece of LEVELS[0].pieces) {
    const cube = makePiece(piece);
    cube.position.multiplyScalar(1.12);
    if (piece.position.every(value => value === 1)) cube.position.add(new THREE.Vector3(.22, .3, .2));
    homeSculpture.add(cube);
  }
  homeSculpture.rotation.set(-.08, .16, -.06);
}

function closeDialogs() {
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(dialog => dialog.close());
}
function showScreen(next: 'home' | 'journey' | 'game') {
  if (ready && screen === 'game') { settleAnimations(); void persistGame(); }
  clearTimeout(completionTimer);
  closeDialogs();
  screen = next;
  $('app').dataset.screen = next;
  $('app').classList.toggle('is-tutorial', next === 'game' && levelIndex === TUTORIAL_INDEX);
  $('home-screen').hidden = next !== 'home';
  $('journey-screen').hidden = next !== 'journey';
  $('game-hud').hidden = next !== 'game';
  $('game-tools').hidden = next !== 'game';
  controls.enabled = next === 'game';
  renderer.domElement.tabIndex = next === 'game' ? 0 : -1;
  renderer.domElement.setAttribute('aria-hidden', String(next !== 'game'));
  puzzleGroup.visible = departingGroup.visible = reward.visible = beam.visible = next === 'game';
  homeSculpture.visible = next === 'home';
  ground.visible = next !== 'journey';
  ground.position.y = next === 'home' ? -2.1 : levelIndex === 0 || levelIndex === TUTORIAL_INDEX ? -1.65 : -2.65;
  cameraTween = null;
  gestures.reset(); orbitStart = null;
  updateProgress();
  if (next === 'home') {
    const begun = history.length > 0 || completed.size > 0 || savedGame.tutorial.rotated;
    $('play-game').innerHTML = `${begun ? 'Continua' : 'Gioca'} ${icon('next')}`;
  }
  resize();
  if (next === 'home') setHomeCamera();
  if (next === 'journey') $('back-home').focus({ preventScroll: true });
  wakeRenderer();
}
function setHomeCamera() {
  controls.target.set(0, 0, 0);
  camera.position.copy(new THREE.Vector3(1.05, .8, 1.3).normalize().multiplyScalar(9.4 * Math.max(1, 1 / camera.aspect)));
  camera.lookAt(0, 0, 0);
}
function enterGame(index = levelIndex, restart = false) {
  showScreen('game');
  loadLevel(index, restart);
  renderer.domElement.focus({ preventScroll: true });
}
function continueGame() {
  if (remaining.length) { enterGame(); return; }
  const journey = [TUTORIAL_INDEX, 0, 1, 2];
  const current = journey.indexOf(levelIndex);
  const candidates = [...journey.slice(current + 1), ...journey.slice(0, current)];
  const next = candidates.find(index => (savedGame.levels[String(index)]?.removedIds.length ?? 0) < LEVELS[index].pieces.length);
  enterGame(next ?? 0, next === undefined);
}
function openPause() {
  if (screen !== 'game') return;
  settleAnimations(); clearTimeout(completionTimer); void persistGame();
  controls.enabled = false;
  $<HTMLDialogElement>('pause-dialog').showModal();
  renderer.setAnimationLoop(null); rendering = false;
}
function openSettings() {
  $<HTMLDialogElement>('settings-dialog').showModal();
  controls.enabled = false;
  renderer.setAnimationLoop(null); rendering = false;
}

function createReward() {
  disposeGroup(reward);
  reward.rotation.set(0, 0, 0);
  const gold = new THREE.MeshStandardMaterial({ color: 0xe4b85b, metalness: 0.45, roughness: 0.25 });
  const jade = new THREE.MeshStandardMaterial({ color: 0x6f9e8a, roughness: 0.4, metalness: 0.05 });
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, position = new THREE.Vector3()) => {
    const item = new THREE.Mesh(geometry, material); item.position.copy(position); item.castShadow = true; reward.add(item); return item;
  };
  if (levelIndex === 0 || levelIndex === TUTORIAL_INDEX) {
    mesh(new THREE.SphereGeometry(0.21, 24, 16), gold, new THREE.Vector3(0, -0.17, 0));
    mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 10), jade, new THREE.Vector3(0, 0.08, 0));
    const leaf1 = mesh(new THREE.SphereGeometry(0.16, 16, 12), jade, new THREE.Vector3(-0.115, 0.2, 0));
    leaf1.scale.set(1, 0.46, 0.6); leaf1.rotation.z = -0.55;
    const leaf2 = mesh(new THREE.SphereGeometry(0.18, 16, 12), jade, new THREE.Vector3(0.13, 0.29, 0));
    leaf2.scale.set(1, 0.43, 0.6); leaf2.rotation.z = 0.5;
  } else if (levelIndex === 1) {
    mesh(new THREE.IcosahedronGeometry(0.24, 0), new THREE.MeshStandardMaterial({ color: 0x8caebc, metalness: 0.38, roughness: 0.18 }));
    const ring = mesh(new THREE.TorusGeometry(0.37, 0.025, 12, 56), gold);
    ring.rotation.set(1.05, 0.3, -0.4);
    mesh(new THREE.SphereGeometry(0.065, 12, 12), gold, new THREE.Vector3(0.34, 0.1, 0));
  } else {
    mesh(new THREE.OctahedronGeometry(0.27), gold);
    for (const direction of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
      const point = mesh(new THREE.ConeGeometry(0.14, 0.22, 4), gold, vec(direction).multiplyScalar(0.28));
      point.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), vec(direction));
    }
  }
}

function announce(message: string) { $('announcement').textContent = message; }
function tutorialStep() {
  return getTutorialStep(remaining.map(piece => piece.id), selected?.id ?? null, savedGame.tutorial);
}
function tutorialTarget() { return remaining.find(piece => piece.id === tutorialStep().targetId); }
function updateTutorial() {
  const active = screen === 'game' && levelIndex === TUTORIAL_INDEX;
  $('hint').setAttribute('aria-label', active ? 'Mostra il cubo da provare' : 'Suggerimento: trova una freccia libera');
  $('hint').title = active ? 'Mostra il cubo da provare' : 'Trova una freccia libera';
  $('tutorial-card').hidden = !active;
  tutorialOutline.visible = false;
  if (!active) return;
  const step = tutorialStep();
  $('tutorial-card').dataset.step = step.id;
  $('tutorial-step').textContent = `PRIMI PASSI · ${step.number} DI 4`;
  const skipLabel = step.id === 'done' ? 'Comincia il viaggio' : 'Salta';
  if ($('skip-tutorial').textContent?.trim() !== skipLabel) $('skip-tutorial').innerHTML = `${skipLabel} ${icon('next')}`;
  // Avoid repeating live-region announcements during every scene update.
  if ($('tutorial-title').textContent !== step.title) $('tutorial-title').textContent = step.title;
  if ($('tutorial-description').textContent !== step.description) $('tutorial-description').textContent = step.description;
  const target = tutorialTarget();
  tutorialOutline.visible = !!target;
  if (target) tutorialOutline.position.copy(vec(target.position));
  $<HTMLButtonElement>('hint').disabled = step.id === 'rotate' || step.id === 'done';
}
function learnedRotation() {
  if (levelIndex !== TUTORIAL_INDEX || savedGame.tutorial.rotated) return;
  savedGame.tutorial.rotated = true;
  updateTutorial(); wakeRenderer(); void persistGame();
}
function updateProgress() {
  wakeRenderer();
  const level = LEVELS[levelIndex];
  const removed = level.pieces.length - remaining.length;
  $('progress-label').textContent = `${removed} / ${level.pieces.length}`;
  $('progress-label').setAttribute('aria-label', `${removed} di ${level.pieces.length} pezzi liberati`);
  $<HTMLButtonElement>('undo').disabled = history.length === 0;
  $<HTMLButtonElement>('hint').disabled = remaining.length === 0;
  document.querySelectorAll<HTMLButtonElement>('[data-level]').forEach(button => {
    const i = Number(button.dataset.level);
    button.setAttribute('aria-pressed', String(i === levelIndex));
    button.querySelector('.tab-check')!.textContent = completed.has(i) ? '✓' : '';
    button.querySelector('.tab-check')!.setAttribute('aria-label', completed.has(i) ? 'completato' : '');
    const count = i === levelIndex ? history.length : (savedGame.levels[String(i)]?.removedIds.length ?? 0);
    button.querySelector('.node-progress')!.textContent = completed.has(i) ? 'Scoperta' : count ? `${count} / ${LEVELS[i].pieces.length}` : i === TUTORIAL_INDEX ? 'Quattro piccoli passi' : `${LEVELS[i].pieces.length} pezzi`;
  });
  updateTutorial();
}

function clearBeam() {
  disposeGroup(beam);
  meshes.forEach(group => {
    const body = group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    body.material.emissive.setHex(0x000000);
  });
}

function selectPiece(piece: Piece | null) {
  if (piece && (screen !== 'game' || !meshes.has(piece.id))) return;
  if (piece && levelIndex === TUTORIAL_INDEX && piece.id !== tutorialStep().targetId && piece.id !== selected?.id) {
    announce(tutorialStep().id === 'rotate' ? 'Trascina prima la figura per guardarla da un altro lato.' : 'Iniziamo dal cubo con il bordo evidenziato.');
    return;
  }
  wakeRenderer();
  selected = piece; clearBeam();
  if (!piece) {
    updateTutorial();
    return;
  }
  const exit = getExit(piece, remaining);
  const group = meshes.get(piece.id)!;
  const body = group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  body.material.emissive.setHex(0x504129); body.material.emissiveIntensity = 0.35;
  const start = vec(piece.position).addScaledVector(vec(piece.direction), 0.46);
  let length = 3.6;
  if (!exit.free) {
    const obstacle = exit.blockerId === 'core' ? reward : meshes.get(exit.blockerId!);
    obstacle?.updateWorldMatrix(true, true);
    contactRay.set(start, vec(piece.direction));
    const contact = obstacle && contactRay.intersectObject(obstacle, true)[0];
    length = Math.max(0.02, contact ? contact.distance : exit.distance - 0.46);
  }
  const beamColor = new THREE.Color(palette[piece.color]);
  // The tunnel shows the cube's path; the center line meets the visible blocker.
  const light = new THREE.Mesh(new THREE.BoxGeometry(0.82, length, 0.82), new THREE.ShaderMaterial({
    uniforms: { tint: { value: beamColor }, fade: { value: exit.free ? 1 : 0 }, beamLength: { value: length } },
    vertexShader: 'uniform float beamLength; varying float along; void main(){ along = position.y / beamLength + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 tint; uniform float fade; varying float along; void main(){ gl_FragColor = vec4(tint, 0.12 * mix(1.0, 1.0 - along, fade)); }',
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  light.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vec(piece.direction));
  light.position.copy(start).addScaledVector(vec(piece.direction), length / 2); beam.add(light);
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, length, 8), new THREE.MeshBasicMaterial({ color: beamColor, transparent: true, opacity: 0.75, depthWrite: false }));
  line.quaternion.copy(light.quaternion); line.position.copy(light.position); beam.add(line);
  if (!exit.free) {
    const contact = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), new THREE.MeshBasicMaterial({ color: 0xb9563c }));
    contact.position.copy(start).addScaledVector(vec(piece.direction), length); beam.add(contact);
    const blocker = exit.blockerId && meshes.get(exit.blockerId);
    if (blocker) (blocker.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material.emissive.setHex(0x3c170c);
  }
  playSound('select');
  announce(exit.free ? 'Freccia selezionata. Uscita libera.' : 'Freccia selezionata. Percorso bloccato.');
  if (levelIndex === TUTORIAL_INDEX && piece.id === 'intro-blocked' && !exit.free) {
    savedGame.tutorial.blockedSeen = true;
    void persistGame();
  }
  updateTutorial();
}

/** Finish just this piece's visual effect, without touching the board/history. */
function finishPieceAnimation(pieceId: string) {
  const pending = animations.filter(animation => animation.pieceId === pieceId);
  animations = animations.filter(animation => animation.pieceId !== pieceId);
  pending.forEach(animation => { animation.update(1); animation.end?.(); });
}

function extract() {
  if (!selected || screen !== 'game') return;
  const piece = selected, group = meshes.get(piece.id);
  if (!group) return;
  wakeRenderer();
  const exit = getExit(piece, remaining);
  if (!exit.free) {
    // Repeated taps must not stack nudges on the same cube. Other cubes stay live.
    if (animations.some(animation => animation.pieceId === piece.id)) return;
    playSound('blocked');
    const initial = vec(piece.position);
    const travel = Math.min(0.06, exit.distance - 0.46 * 2);
    animations.push({ pieceId: piece.id, start: performance.now(), duration: reducedMotion ? 60 : 320,
      update: t => group.position.copy(initial).addScaledVector(vec(piece.direction), Math.sin(t * Math.PI) * travel),
      end: () => { group.position.copy(initial); },
    });
    announce('Questa freccia è bloccata. Libera prima il percorso.');
    return;
  }
  // A blocked cube can become free while its nudge is still playing.
  finishPieceAnimation(piece.id);
  const initial = vec(piece.position);
  playSound('release');
  selectPiece(null);
  // Commit once, at acceptance. Rendering is cosmetic and cannot delay a move.
  remaining = remaining.filter(p => p.id !== piece.id);
  history.push(piece);
  meshes.delete(piece.id);
  puzzleGroup.remove(group); departingGroup.add(group);
  animations.push({ pieceId: piece.id, start: performance.now(), duration: reducedMotion ? 70 : 560,
    update: t => {
      group.position.copy(initial).addScaledVector(vec(piece.direction), smooth(t) * 10);
      group.scale.setScalar(1 - Math.max(0, (t - 0.55) / 0.45));
    },
    end: () => { departingGroup.remove(group); disposeGroup(group); },
  });
  updateProgress(); announce(`Freccia liberata. Restano ${remaining.length} pezzi.`);
  if (!remaining.length) win();
  void persistGame();
}

function focusPiece(piece: Piece) {
  const direction = vec(piece.position).normalize().add(vec(piece.direction).multiplyScalar(0.35)).normalize();
  if (direction.lengthSq() < 0.01) direction.set(1, 1, 1).normalize();
  moveCamera(direction.multiplyScalar(defaultDistance()));
  selectPiece(piece);
}
function cyclePiece() {
  if (!remaining.length) return;
  if (levelIndex === TUTORIAL_INDEX) {
    const target = tutorialTarget();
    if (target) focusPiece(target);
    return;
  }
  const index = selected ? remaining.findIndex(p => p.id === selected!.id) : -1;
  focusPiece(remaining[(index + 1) % remaining.length]);
}
function defaultDistance() { return (levelIndex === TUTORIAL_INDEX ? 8.8 : levelIndex === 0 ? 9 : 13.6) * Math.max(1, 1 / camera.aspect); }
function moveCamera(to: THREE.Vector3) {
  wakeRenderer();
  if (reducedMotion) { camera.position.copy(to); controls.update(); }
  else cameraTween = { start: performance.now(), from: camera.position.clone(), to };
}
function resetView(animate = true) {
  const to = new THREE.Vector3(1.05, 0.8, 1.3).normalize().multiplyScalar(defaultDistance());
  controls.target.set(0, 0, 0);
  if (animate) moveCamera(to); else { camera.position.copy(to); controls.update(); }
}
function loadLevel(index: number, restart = false) {
  if (ready) { settleAnimations(); void persistGame(); }
  generation++; clearTimeout(completionTimer); animations = []; cameraTween = null;
  $<HTMLDialogElement>('win-dialog').close();
  selected = null; clearBeam(); disposeGroup(puzzleGroup); meshes.clear();
  levelIndex = index;
  gestures.reset();
  if (index === TUTORIAL_INDEX && restart) savedGame.tutorial = { rotated: false, blockedSeen: false };
  $('app').classList.toggle('is-tutorial', index === TUTORIAL_INDEX);
  const removedIds = restart ? [] : (savedGame.levels[String(index)]?.removedIds ?? []);
  history = removedIds.map(id => LEVELS[index].pieces.find(piece => piece.id === id)!);
  const removed = new Set(removedIds);
  remaining = LEVELS[index].pieces.filter(piece => !removed.has(piece.id));
  remaining.forEach(createPiece); createReward();
  ground.position.y = index === 0 || index === TUTORIAL_INDEX ? -1.65 : -2.65;
  resize(); resetView(false); selectPiece(null); updateProgress();
  if (!remaining.length) moveCamera(camera.position.clone().normalize().multiplyScalar(4));
  announce(`Livello ${index + 1}: ${LEVELS[index].name}. ${remaining.length} pezzi rimasti.${history.length ? ' Partita ripristinata.' : ''}`);
  void persistGame();
}
function win() {
  playSound('win');
  completed.add(levelIndex);
  selectPiece(null); updateProgress();
  const currentGeneration = generation;
  moveCamera(camera.position.clone().normalize().multiplyScalar(4));
  $('win-title').textContent = LEVELS[levelIndex].artifact;
  $('win-description').textContent = ['Da un intreccio di frecce, un piccolo germoglio. Le cose belle avevano solo bisogno di spazio.', 'Hai seguito ogni orbita e trovato il tuo piccolo universo.', 'Anche l’incastro più fitto nascondeva un po’ di luce. Hai completato tutte e tre le scoperte.', 'Hai imparato a ruotare, leggere la luce e sciogliere un incastro. Il tuo viaggio può cominciare.'][levelIndex];
  $('next-level').innerHTML = `${levelIndex === TUTORIAL_INDEX ? 'Comincia il viaggio' : levelIndex === 2 ? 'Ricomincia il viaggio' : 'La prossima scoperta'} ${icon('next')}`;
  completionTimer = setTimeout(() => { if (currentGeneration === generation && !remaining.length) $<HTMLDialogElement>('win-dialog').showModal(); }, 1050);
}

const gestures = new PointerGestureTracker();
let orbitStart: THREE.Vector3 | null = null;
renderer.domElement.addEventListener('pointerdown', event => {
  if (event.button !== 0 || screen !== 'game') return;
  wakeRenderer();
  gestures.down(event);
  orbitStart = camera.position.clone();
  cameraTween = null;
});
// Window listeners also clean up releases outside the canvas. OrbitControls
// keeps its own pointer capture; this tracker never steals it.
window.addEventListener('pointermove', event => {
  for (const sample of event.getCoalescedEvents?.() ?? []) gestures.move(sample);
  gestures.move(event);
});
window.addEventListener('pointerup', event => {
  const gesture = gestures.up(event);
  if (gesture === 'drag' && orbitStart && camera.position.distanceToSquared(orbitStart) > 0.001) learnedRotation();
  orbitStart = null;
  if (gesture !== 'tap') return;
  const bounds = renderer.domElement.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
  if (document.elementFromPoint(event.clientX, event.clientY) !== renderer.domElement) return;
  pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects([...puzzleGroup.children, ...reward.children], true)[0];
  const piece = hit && remaining.find(p => p.id === hit.object.userData.pieceId);
  if (!piece) selectPiece(null);
  else if (selected?.id === piece.id) extract();
  else selectPiece(piece);
}, { capture: true });
window.addEventListener('pointercancel', event => { gestures.cancel(event.pointerId); orbitStart = null; });
renderer.domElement.addEventListener('lostpointercapture', event => gestures.cancel(event.pointerId));
window.addEventListener('blur', () => { gestures.reset(); orbitStart = null; });
renderer.domElement.addEventListener('keydown', event => {
  if (screen !== 'game') return;
  if (event.key === 'Enter') { event.preventDefault(); extract(); }
  if (event.key.toLowerCase() === 'n') { event.preventDefault(); cyclePiece(); }
  if (event.key === 'Escape') { event.preventDefault(); if (selected) selectPiece(null); else openPause(); }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '='].includes(event.key)) {
    event.preventDefault(); cameraTween = null;
    const spherical = new THREE.Spherical().setFromVector3(camera.position);
    if (event.key === 'ArrowLeft') spherical.theta -= 0.18;
    if (event.key === 'ArrowRight') spherical.theta += 0.18;
    if (event.key === 'ArrowUp') spherical.phi = Math.max(0.06, spherical.phi - 0.18);
    if (event.key === 'ArrowDown') spherical.phi = Math.min(Math.PI - 0.06, spherical.phi + 0.18);
    if (event.key === '+' || event.key === '=') spherical.radius = Math.max(4, spherical.radius * 0.9);
    if (event.key === '-') spherical.radius = Math.min(24, spherical.radius * 1.1);
    camera.position.setFromSpherical(spherical); controls.update();
    if (event.key.startsWith('Arrow')) learnedRotation();
  }
});
$('play-game').addEventListener('click', continueGame);
$('open-journey').addEventListener('click', () => showScreen('journey'));
$('back-home').addEventListener('click', () => showScreen('home'));
$('pause-game').addEventListener('click', openPause);
$('resume-game').addEventListener('click', () => {
  closeDialogs();
  renderer.domElement.focus({ preventScroll: true });
  if (!remaining.length) win();
});
$('pause-journey').addEventListener('click', () => showScreen('journey'));
$('pause-home').addEventListener('click', () => showScreen('home'));
$('home-settings').addEventListener('click', openSettings);
$('pause-settings').addEventListener('click', openSettings);
$('close-settings').addEventListener('click', () => $<HTMLDialogElement>('settings-dialog').close());
$('sound-toggle').setAttribute('aria-pressed', String(soundEnabled()));
$('sound-toggle').addEventListener('click', () => {
  $('sound-toggle').setAttribute('aria-pressed', String(toggleSound()));
  if (soundEnabled()) playSound('select');
});
document.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog => dialog.addEventListener('close', () => {
  controls.enabled = screen === 'game' && !document.querySelector('dialog[open]');
  wakeRenderer();
}));
$('hint').addEventListener('click', () => {
  if (levelIndex === TUTORIAL_INDEX) { cyclePiece(); return; }
  const available = getAvailable(remaining);
  // Prefer a free piece nearest the current viewing angle.
  available.sort((a, b) => vec(b.position).normalize().dot(camera.position.clone().normalize()) - vec(a.position).normalize().dot(camera.position.clone().normalize()));
  if (available[0]) focusPiece(available[0]);
});
$('view').addEventListener('click', () => resetView());
$('restart').addEventListener('click', () => { closeDialogs(); loadLevel(levelIndex, true); renderer.domElement.focus({ preventScroll: true }); });
$('undo').addEventListener('click', () => {
  if (!history.length) return;
  clearTimeout(completionTimer);
  const piece = history.pop()!;
  finishPieceAnimation(piece.id);
  remaining.push(piece); createPiece(piece);
  selectPiece(null); updateProgress(); resetView(); announce('Ultima estrazione annullata.');
  void persistGame();
});
document.querySelectorAll<HTMLButtonElement>('[data-level]').forEach(button => button.addEventListener('click', () => enterGame(Number(button.dataset.level))));
$('help').addEventListener('click', () => $<HTMLDialogElement>('help-dialog').showModal());
document.querySelector('#help-dialog .dialog-close')!.addEventListener('click', () => $<HTMLDialogElement>('help-dialog').close());
$('start').addEventListener('click', () => $<HTMLDialogElement>('help-dialog').close());
$('skip-tutorial').addEventListener('click', () => loadLevel(0));
$('admire').addEventListener('click', () => $<HTMLDialogElement>('win-dialog').close());
$('next-level').addEventListener('click', () => loadLevel(levelIndex === TUTORIAL_INDEX ? 0 : (levelIndex + 1) % 3, levelIndex === 2));
function resize() {
  const bounds = $('scene').getBoundingClientRect();
  const previousFit = Math.max(1, 1 / camera.aspect);
  camera.aspect = bounds.width / Math.max(bounds.height, 1); camera.updateProjectionMatrix();
  const fitRatio = Math.max(1, 1 / camera.aspect) / previousFit;
  if (ready) {
    camera.position.multiplyScalar(fitRatio);
    cameraTween?.from.multiplyScalar(fitRatio);
    cameraTween?.to.multiplyScalar(fitRatio);
  }
  controls.maxDistance = Math.max(24, defaultDistance() * 1.6);
  if (screen === 'home' && ready) setHomeCamera();
  renderer.setSize(bounds.width, bounds.height);
  wakeRenderer();
}
new ResizeObserver(resize).observe($('scene'));

function wakeRenderer() {
  idleFrames = 0;
  if (!ready || !appActive || document.hidden || rendering) return;
  rendering = true;
  lastFrameTime = 0;
  renderer.setAnimationLoop(renderFrame);
}

function renderFrame(time: number) {
  const delta = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.05) : 0;
  lastFrameTime = time;
  if (cameraTween) {
    const t = Math.min(1, (time - cameraTween.start) / 650);
    camera.position.lerpVectors(cameraTween.from, cameraTween.to, smooth(t));
    if (t === 1) cameraTween = null;
  }
  const frameAnimations = animations; animations = [];
  for (const animation of frameAnimations) {
    const t = Math.min(1, (time - animation.start) / animation.duration);
    animation.update(t);
    if (t === 1) animation.end?.(); else animations.push(animation);
  }
  const modalOpen = !!document.querySelector('dialog[open]');
  if (screen === 'home' && !reducedMotion && !modalOpen) {
    homeSculpture.rotation.y += delta * 0.12;
    homeSculpture.position.y = Math.sin(time * 0.0006) * 0.09;
  }
  if (screen === 'game' && !remaining.length && !reducedMotion && !modalOpen) reward.rotation.y += delta * 0.24;
  controls.update(); renderer.render(scene, camera);
  idleFrames++;
  if (idleFrames > 12 && animations.length === 0 && !cameraTween && (screen !== 'home' || reducedMotion || modalOpen) && (remaining.length > 0 || screen !== 'game' || reducedMotion || modalOpen)) {
    renderer.setAnimationLoop(null);
    rendering = false;
  }
}

function settleAnimations() {
  const pending = animations;
  animations = [];
  pending.forEach(animation => { animation.update(1); animation.end?.(); });
  if (cameraTween) { camera.position.copy(cameraTween.to); cameraTween = null; }
}

function suspendGame() {
  settleAnimations();
  void persistGame();
  renderer.setAnimationLoop(null);
  rendering = false;
  gestures.reset(); orbitStart = null;
}

controls.addEventListener('change', wakeRenderer);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) suspendGame(); else wakeRenderer();
});
window.addEventListener('pagehide', suspendGame);
window.addEventListener('pageshow', wakeRenderer);
renderer.domElement.addEventListener('webglcontextlost', event => {
  event.preventDefault(); suspendGame();
  $('graphics-warning').hidden = false;
});
renderer.domElement.addEventListener('webglcontextrestored', () => { $('graphics-warning').hidden = true; selectPiece(null); wakeRenderer(); });

async function startGame() {
  savedGame = await loadSave();
  completed = new Set(savedGame.completed);
  resize(); loadLevel(savedGame.activeLevel);
  ready = true; $('app').inert = false;
  createHomeSculpture(); showScreen('home'); initPwa();
  initAccountUi(async () => { settleAnimations(); await persistGame(); });
  onAccountSaveChange(save => {
    // A replacement belongs to the new account: never persist the previous board.
    ready = false;
    settleAnimations();
    savedGame = save;
    completed = new Set(save.completed);
    loadLevel(save.activeLevel);
    showScreen('home');
    ready = true;
    wakeRenderer();
  });
  if (Capacitor.isNativePlatform()) {
    await App.addListener('appStateChange', ({ isActive }) => {
      appActive = isActive;
      if (isActive) wakeRenderer(); else suspendGame();
    });
    await App.addListener('pause', () => { appActive = false; suspendGame(); });
    await App.addListener('resume', () => { appActive = true; wakeRenderer(); });
    await App.addListener('backButton', async () => {
      const dialog = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1);
      if (dialog) { dialog.close(); return; }
      if (screen === 'journey') { showScreen('home'); return; }
      if (screen === 'game') { openPause(); return; }
      suspendGame();
      await persistGame();
      await App.minimizeApp();
    });
  }
}
void startGame();
