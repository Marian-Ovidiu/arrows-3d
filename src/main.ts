import './style.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { loadSave, saveGame } from './persistence';
import { onAccountSaveChange, accountState, subscribeAccount } from './account';
import { initAccountUi } from './account-ui';
import { createSaveState } from './save-state';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PointerGestureTracker } from './pointer-gesture';
import { getTutorialStep } from './tutorial';
import { initPwa } from './pwa';
import { playSound, soundEnabled, toggleSound } from './sound';
import { LEVELS, CHAPTERS, CAMPAIGN_INDEXES, JOURNEY_INDEXES, TUTORIAL_INDEX, getExit, getAvailable, type Piece, type Level } from './puzzle';
import { createRelic } from './relics';
import { initMetagame, RARITIES } from './metagame-ui';
import { TimeTrial, formatTime } from './time-trial';
import { submitDiscovery, startTimedRun, finishTimedRun } from './leaderboard';
import { ChapterEnvironment } from './chapter-environment';
import { icon, relicIcon, chapterIcon, pips, RARITY_PIPS } from './ui-icons';

const NODE_GAP = 104;
/** A winding trail: nodes sway left and right, joined by soft curves. */
function mapTrack(indexes: readonly number[], chapter: number) {
  const points = indexes.map((index, order) => ({ index, x: 50 + Math.sin(order * 1.3 + chapter * 2) * 24, y: 62 + order * NODE_GAP }));
  const height = points.at(-1)!.y + 62;
  const curve = (from: typeof points[number], to: typeof points[number]) => `M${from.x} ${from.y}C${from.x} ${from.y + NODE_GAP / 2} ${to.x} ${to.y - NODE_GAP / 2} ${to.x} ${to.y}`;
  const segments = points.slice(1).map((point, order) => `<path data-segment="${points[order].index}" d="${curve(points[order], point)}"/>`).join('');
  return `<div class="map-track" style="height:${height}px"><svg class="map-path" viewBox="0 0 100 ${height}" preserveAspectRatio="none" aria-hidden="true"><g class="path-base">${segments}</g><g class="path-top">${segments}</g></svg>${points.map(({ index, x, y }, order) => `<button class="journey-node${x > 55 ? ' label-left' : ''}" data-level="${index}" data-tone="${LEVELS[index].rarity}" aria-pressed="false" style="left:${x.toFixed(1)}%;top:${y}px;--i:${order}"><span class="node-art">${index === TUTORIAL_INDEX ? icon('sparkle') : `<span class="node-number">${index + 1}</span>`}<span class="tab-check" aria-label=""></span></span><span class="node-copy"><strong>${LEVELS[index].name}</strong><span class="node-progress"></span></span></button>`).join('')}</div>`;
}
function journeyMap() {
  const intro = `<section class="map-chapter map-intro" data-chapter="0">${mapTrack([TUTORIAL_INDEX], 0)}</section>`;
  return intro + CHAPTERS.map(chapter => {
    const indexes = CAMPAIGN_INDEXES.filter(index => LEVELS[index].chapter === chapter.id);
    return `<section class="map-chapter" data-chapter="${chapter.id}"><div class="journey-chapter chapter-banner"><span class="banner-icon">${chapterIcon(chapter.id)}</span><div class="banner-copy"><h3>${chapter.name}</h3><div class="relic-slots">${indexes.map(index => `<span class="relic-slot" data-slot="${index}" data-tone="${LEVELS[index].rarity}">${relicIcon(LEVELS[index].reward)}</span>`).join('')}</div></div></div>${mapTrack(indexes, chapter.id)}</section>`;
  }).join('');
}
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <section class="screen home-screen is-active" id="home-screen" aria-label="Svela, menu principale">
    <h1 class="home-logo rise">svela<span class="logo-sparkle">${icon('sparkle')}</span></h1>
    <div class="home-actions rise" style="--i:3">
      <div class="chapter-strip" id="chapter-strip"></div>
      <button id="play-game" class="play-button">${icon('play')}Gioca</button>
      <button id="install-game" class="install-button" hidden>${icon('download')}Installa</button>
    </div>
  </section>
  <main class="game">
    <section class="play-area" aria-label="Puzzle tridimensionale">
      <div class="scene" id="scene"></div>
      <div class="game-hud" id="game-hud">
        <button id="pause-game" class="round-button" aria-label="Pausa">${icon('pause')}</button>
        <div class="level-chip" id="level-brief" hidden><span class="level-chip-icon" id="level-chapter-icon"></span><span id="level-number"></span><span class="sr-only" id="level-title"></span></div>
        <span class="progress-badge" id="progress-label"></span>
        <span class="hud-meter" aria-hidden="true"><span id="progress-fill"></span></span>
      </div>
      <p class="level-toast" id="level-focus" role="status" hidden></p>
      <div class="trial-status" id="trial-status" hidden>${icon('clock')}<span id="trial-label" role="status">PROVA A TEMPO</span><span id="trial-clock" aria-label="Tempo della prova">00:00.000</span></div>
      <div class="tutorial-card" id="tutorial-card" hidden>
        <div class="tutorial-heading"><span class="tutorial-steps" id="tutorial-step"></span><button id="skip-tutorial">Salta ${icon('next')}</button></div>
        <div role="status" aria-live="polite"><strong id="tutorial-title"></strong><p id="tutorial-description"></p></div>
      </div>
      <p class="graphics-warning" id="graphics-warning" role="status" hidden>La grafica è in pausa. La partita è salvata.</p>
      <div class="tool-rail" id="game-tools">
        <button id="undo" class="round-button" title="Annulla" aria-label="Annulla l’ultima estrazione" disabled>${icon('undo')}</button>
        <button id="hint" class="round-button hint-button" title="Suggerimento" aria-label="Suggerimento: trova una freccia libera">${icon('hint')}</button>
        <button id="view" class="round-button" title="Ripristina la vista" aria-label="Ripristina la vista">${icon('view')}</button>
      </div>
    </section>
  </main>
  <section class="screen journey-screen" id="journey-screen" aria-label="Mappa">
    <header class="screen-header rise"><h2>Mappa</h2><span class="header-counter" id="journey-summary"></span></header>
    <nav class="journey-path" aria-label="Livelli">${journeyMap()}</nav>
  </section>
  <header class="top-bar" id="top-bar">
    <div class="top-bar-start" id="top-bar-start"></div>
    <div class="top-bar-end">
      <button id="top-relics" class="counter-pill" aria-label="Reliquie">${icon('gem')}<span id="relic-counter">0</span><small>/${CAMPAIGN_INDEXES.length}</small></button>
      <button id="home-settings" class="round-button" aria-label="Impostazioni">${icon('settings')}</button>
    </div>
  </header>
  <nav class="tab-bar" id="tab-bar" aria-label="Navigazione principale">
    <button id="tab-home" data-tab="home" aria-current="page">${icon('play')}<span>Gioca</span></button>
    <button id="tab-journey" data-tab="journey">${icon('map')}<span>Mappa</span></button>
    <button id="tab-collection" data-tab="collection">${icon('gem')}<span>Reliquie</span></button>
    <button id="tab-rankings" data-tab="rankings">${icon('trophy')}<span>Classifica</span></button>
  </nav>
  <dialog id="pause-dialog" class="sheet" aria-labelledby="pause-title">
    <span class="sheet-handle" aria-hidden="true"></span>
    <h2 class="sheet-title" id="pause-title">Pausa</h2>
    <button id="resume-game" class="play-button">${icon('play')}Riprendi</button>
    <div class="tile-grid">
      <button id="restart" class="tile">${icon('restart')}<span>Da capo</span></button>
      <button id="pause-journey" class="tile">${icon('map')}<span>Mappa</span></button>
      <button id="pause-collection" class="tile">${icon('gem')}<span>Reliquie</span></button>
      <button id="pause-trial" class="tile" hidden>${icon('clock')}<span>Sfida</span></button>
      <button id="pause-settings" class="tile">${icon('settings')}<span>Opzioni</span></button>
      <button id="pause-home" class="tile">${icon('home')}<span>Home</span></button>
    </div>
  </dialog>
  <dialog id="settings-dialog" class="sheet" aria-labelledby="settings-title">
    <button id="close-settings" class="dialog-close round-button" aria-label="Chiudi impostazioni">${icon('close')}</button>
    <h2 class="sheet-title" id="settings-title">Opzioni</h2>
    <button id="sound-toggle" class="setting-row" aria-pressed="true">${icon('sound')}<span>Suoni</span><span class="toggle-track" aria-hidden="true"></span></button>
    <button id="help" class="setting-row">${icon('help')}<span>Come si gioca</span>${icon('forward')}</button>
    <p class="local-save-note">I progressi sono salvati su questo dispositivo.</p>
  </dialog>
  <div id="announcement" class="sr-only" role="status" aria-live="polite"></div>
  <p id="save-warning" class="save-warning" role="status" hidden>Salvataggio non disponibile. Tieni aperto il gioco per conservare questa partita.</p>
  <dialog id="help-dialog" class="sheet" aria-labelledby="help-title"><button class="dialog-close round-button" aria-label="Chiudi istruzioni">${icon('close')}</button><h2 class="sheet-title" id="help-title">Come si gioca</h2><ol class="help-steps"><li>${icon('restart')}<strong>Ruota</strong><span>Trascina la figura in ogni direzione.</span></li><li>${icon('hint')}<strong>Tocca un cubo</strong><span>La luce segue la sua freccia.</span></li><li>${icon('next')}<strong>Tocca ancora</strong><span>Esce solo se la strada è libera.</span></li><li>${icon('gem')}<strong>Svela</strong><span>Libera tutto e trova la reliquia.</span></li></ol><details><summary>Tastiera</summary><p>Frecce per ruotare, + e − per lo zoom, N per selezionare, Invio per estrarre, Esc per deselezionare.</p></details><button id="start" class="play-button">Ho capito</button></dialog>
  <dialog id="win-dialog" class="win-dialog" aria-labelledby="win-title">
    <div class="win-rays" aria-hidden="true"></div>
    <p class="win-heading" aria-hidden="true">Svelato!</p>
    <div class="win-card">
      <span class="win-rarity-line"><span id="win-pips"></span><span id="win-rarity"></span></span>
      <h2 id="win-title"></h2>
      <p id="win-description" hidden></p>
      <div class="win-chips"><span class="chip" id="win-count"></span><span id="win-record" class="chip" hidden></span></div>
      <p id="win-online" role="status" hidden></p>
    </div>
    <div class="win-actions">
      <button id="next-level" class="play-button">Avanti ${icon('next')}</button>
      <div class="win-secondary">
        <button id="win-trial" class="round-button" aria-label="Sfida a tempo">${icon('clock')}</button>
        <button id="win-collection" class="round-button" aria-label="Vedi la reliquia">${icon('gem')}</button>
        <button id="admire" class="round-button" aria-label="Resta a guardare">${icon('eye')}</button>
      </div>
    </div>
  </dialog>
  <dialog id="trial-ready-dialog" class="sheet" aria-labelledby="trial-ready-title"><span class="sheet-badge">${icon('clock')}</span><h2 class="sheet-title" id="trial-ready-title"></h2><p class="sheet-note">Niente aiuti, annullamenti o pause.</p><p id="trial-ready-status" class="sheet-small" role="status"></p><button id="begin-trial" class="play-button">${icon('play')}Inizia</button><button id="cancel-trial" class="text-button">Non ora</button></dialog>
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
let completed = new Set<string>();
let trial: TimeTrial | null = null;
let onlineRun: { id: string; owner: string } | null = null;
let trialInterval: ReturnType<typeof setInterval> | undefined;
let trialStarting = false;
let ready = false;
let appActive = true;
let rendering = false;
let idleFrames = 0;
let lastFrameTime = 0;
$('app').inert = true;
type Screen = 'home' | 'journey' | 'game' | 'collection' | 'rankings';
let screen = 'home' as Screen;
$('app').dataset.screen = screen;

function persistGame() {
  if (!ready) return Promise.resolve();
  savedGame.activeLevel = LEVELS[levelIndex].key;
  savedGame.completed = [...completed];
  const key = LEVELS[levelIndex].key;
  const removedIds = history.map(piece => piece.id);
  const solutionIds = removedIds.length === LEVELS[levelIndex].pieces.length ? [...removedIds] : savedGame.levels[key]?.solutionIds;
  savedGame.levels[key] = { removedIds, ...(solutionIds ? { solutionIds } : {}) };
  return saveGame(savedGame).then(() => { $('save-warning').hidden = true; }).catch(() => {
    $('save-warning').hidden = false;
  });
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
const chapterEnvironment = new ChapterEnvironment({ onChange: () => {
  $('app').dataset.environmentSource = chapterEnvironment.scene.userData.source ?? 'none';
  wakeRenderer();
} });
let environmentEnabled = false;
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
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.22 }));
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
const gallery = new THREE.Group();
gallery.visible = false;
scene.add(gallery);
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
  const pieces: Piece[] = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    if (!x && !y && !z) continue;
    pieces.push({ id: `home-${x}-${y}-${z}`, position: [x, y, z], direction: y ? [0, y, 0] : x ? [x, 0, 0] : [0, 0, z], color: pieces.length % 5 });
  }
  for (const piece of pieces) {
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
function showScreen(next: Screen) {
  if (screen === 'game' && next !== 'game') interruptTrial('Hai lasciato il livello.');
  if (ready && screen === 'game') { settleAnimations(); void persistGame(); }
  clearTimeout(completionTimer);
  closeDialogs();
  const previous = screen;
  screen = next;
  $('app').dataset.screen = next;
  updateAtmosphere();
  $('app').classList.toggle('is-tutorial', next === 'game' && levelIndex === TUTORIAL_INDEX);
  // Screens cross-fade: the leaving one stays painted until its transition ends.
  for (const [name, id] of Object.entries(SCREEN_IDS)) {
    const section = $(id), active = name === next;
    section.classList.toggle('is-active', active);
    section.inert = !active;
  }
  const tabIndex = Object.keys(SCREEN_IDS).indexOf(next);
  if (tabIndex >= 0) $('tab-bar').style.setProperty('--tab', String(tabIndex));
  document.querySelectorAll<HTMLElement>('[data-tab]').forEach(tab => {
    if (tab.dataset.tab === next) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
  });
  if (next !== 'collection') metagame.closeDetail();
  if (next !== 'game') hideToast();
  const canvasParent = next === 'collection' ? $('relic-stage') : $('scene');
  clearTimeout(canvasMove);
  if (!reducedMotion && previous !== next && COVERED.has(next) && !COVERED.has(previous)) {
    // The incoming screen fades over a frozen last frame; the canvas moves once it is covered.
    freezeUntil = performance.now() + COVER_MS;
    canvasMove = setTimeout(() => {
      if (screen !== next) return;
      if (renderer.domElement.parentElement !== canvasParent) { canvasParent.append(renderer.domElement); revealCanvas(); }
      resize(); wakeRenderer();
    }, COVER_MS);
  } else {
    freezeUntil = 0;
    if (renderer.domElement.parentElement !== canvasParent) canvasParent.append(renderer.domElement);
    if (previous !== next) revealCanvas();
  }
  controls.enabled = next === 'game' || next === 'collection';
  renderer.domElement.tabIndex = next === 'game' || next === 'collection' ? 0 : -1;
  renderer.domElement.setAttribute('aria-hidden', String(next !== 'game' && next !== 'collection'));
  renderer.domElement.setAttribute('aria-label', next === 'collection' ? 'Reperto 3D. Trascina per osservare, usa la rotella o pizzica per avvicinarti.' : 'Figura 3D. Trascina per ruotare. Tastiera: frecce per ruotare, N per selezionare, Invio per estrarre.');
  puzzleGroup.visible = departingGroup.visible = reward.visible = beam.visible = next === 'game';
  homeSculpture.visible = next === 'home';
  gallery.visible = next === 'collection';
  ground.visible = next === 'home' || next === 'game';
  ground.position.y = next === 'home' ? -2.1 : groundHeight();
  controls.minDistance = next === 'collection' ? 1.2 : 4;
  $('level-brief').hidden = next !== 'game' || levelIndex === TUTORIAL_INDEX;
  $('trial-status').hidden = next !== 'game' || !trial;
  cameraTween = null;
  gestures.reset(); orbitStart = null;
  updateProgress();
  if (next === 'home') {
    const begun = history.length > 0 || completed.size > 0 || savedGame.tutorial.rotated || Object.values(savedGame.levels).some(level => level.removedIds.length);
    $('play-game').innerHTML = `${icon('play')}${begun ? 'Continua' : 'Gioca'}`;
    if (previous !== 'home' && !reducedMotion) animations.push({ start: performance.now(), duration: 700, update: t => homeSculpture.scale.setScalar(0.82 + smooth(t) * 0.18) });
  }
  resize();
  if (next === 'home') setHomeCamera();
  if (next === 'journey') {
    // Bring the current stop into view, gliding unless motion is reduced.
    const current = document.querySelector<HTMLElement>('.journey-node[aria-pressed=true]');
    requestAnimationFrame(() => current?.scrollIntoView({ block: 'center', behavior: reducedMotion || previous === 'journey' ? 'auto' : 'smooth' }));
    $('tab-journey').focus({ preventScroll: true });
  }
  wakeRenderer();
}
const SCREEN_IDS = { home: 'home-screen', journey: 'journey-screen', collection: 'collection-screen', rankings: 'rankings-screen' } as const;
const COVERED = new Set<Screen>(['journey', 'collection', 'rankings']);
const COVER_MS = 260;
const EASE_OUT = 'cubic-bezier(.22,1,.36,1)';
let freezeUntil = 0;
let canvasMove: ReturnType<typeof setTimeout> | undefined;
function revealCanvas() {
  if (!reducedMotion) renderer.domElement.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: EASE_OUT });
}
let toastTimer: ReturnType<typeof setTimeout> | undefined;
/** A short, self-dismissing tip. It fades instead of popping in and out. */
function showToast(text: string) {
  const toast = $('level-focus');
  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.classList.remove('is-leaving');
  toast.hidden = false;
  toastTimer = setTimeout(() => {
    toast.classList.add('is-leaving');
    toastTimer = setTimeout(() => { toast.hidden = true; }, reducedMotion ? 0 : 450);
  }, 3600);
}
function hideToast() {
  clearTimeout(toastTimer);
  $('level-focus').hidden = true;
}
/** The level the Gioca button opens: the board in progress, else the next undiscovered one. */
function nextPlayable(): number | undefined {
  if (remaining.length) return levelIndex;
  const journey = JOURNEY_INDEXES;
  const current = journey.indexOf(levelIndex);
  const candidates = [...journey.slice(current + 1), ...journey.slice(0, current)];
  return candidates.find(index => !completed.has(LEVELS[index].key));
}
function setHomeCamera() {
  controls.target.set(0, 0, 0);
  camera.position.copy(new THREE.Vector3(1.05, .8, 1.3).normalize().multiplyScalar(10.6 * Math.max(1, 1 / camera.aspect)));
  camera.lookAt(0, 0, 0);
}
function enterGame(index = levelIndex, restart = false) {
  showScreen('game');
  loadLevel(index, restart);
  renderer.domElement.focus({ preventScroll: true });
}
function continueGame() {
  if (remaining.length) { enterGame(); return; }
  const next = nextPlayable();
  if (next === undefined) { metagame.openCollection(levelIndex); return; }
  enterGame(next);
}
function openPause() {
  if (screen !== 'game') return;
  interruptTrial('La prova è stata messa in pausa.');
  $('pause-trial').hidden = levelIndex === TUTORIAL_INDEX || !completed.has(LEVELS[levelIndex].key);
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
  reward.scale.setScalar(1);
  if (!remaining.length) reward.add(createRelic(LEVELS[levelIndex].reward));
  else {
    // An open early puzzle still keeps the actual collectible a surprise.
    const seal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.33, 1), new THREE.MeshStandardMaterial({ color: 0x95a48b, roughness: 0.72, metalness: 0.08 }));
    reward.add(seal);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.012, 6, 40), new THREE.MeshStandardMaterial({ color: 0xbca36e, roughness: 0.4, metalness: 0.45 }));
    band.rotation.set(0.7, 0.4, 0.2); reward.add(band);
  }
}

function previewRelic(level: Level, discovered: boolean) {
  disposeGroup(gallery);
  gallery.rotation.set(0, 0, 0);
  if (discovered) gallery.add(createRelic(level.reward));
  else {
    const mystery = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), new THREE.MeshStandardMaterial({ color: 0x98a793, roughness: 0.8, metalness: 0.08 }));
    gallery.add(mystery);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.008, 6, 48), new THREE.MeshStandardMaterial({ color: 0xb7bd9d, roughness: 0.6 }));
    ring.rotation.set(0.7, 0.3, 0.2); gallery.add(ring);
  }
  const chapter = CAMPAIGN_INDEXES.filter(index => LEVELS[index].chapter === level.chapter);
  if (chapter.every(index => completed.has(LEVELS[index].key))) {
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 0.62, 0.1, 40), new THREE.MeshStandardMaterial({ color: level.chapter === 1 ? 0x8eae91 : level.chapter === 2 ? 0x94afb8 : 0xb7a0ba, roughness: 0.8 }));
    pedestal.position.y = -0.56; gallery.add(pedestal);
    chapter.forEach((index, order) => {
      const miniature = createRelic(LEVELS[index].reward);
      miniature.scale.setScalar(0.22);
      const angle = order * Math.PI * 2 / chapter.length;
      miniature.position.set(Math.cos(angle) * 0.48, -0.43, Math.sin(angle) * 0.48);
      gallery.add(miniature);
    });
  }
  controls.target.set(0, 0, 0);
  const bounds = $('relic-stage').getBoundingClientRect();
  camera.aspect = bounds.width / Math.max(1, bounds.height); camera.updateProjectionMatrix();
  camera.position.copy(new THREE.Vector3(0.6, 0.35, 1.4).normalize().multiplyScalar(2.8 * Math.max(1, 1 / camera.aspect)));
  camera.lookAt(0, 0, 0); controls.update();
  wakeRenderer();
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
  if ($('tutorial-step').dataset.number !== String(step.number)) {
    $('tutorial-step').dataset.number = String(step.number);
    $('tutorial-step').innerHTML = `<span class="sr-only">Primi passi, ${step.number} di 4</span>${[1, 2, 3, 4].map(n => `<i class="${n < step.number ? 'is-done' : n === step.number ? 'is-current' : ''}"></i>`).join('')}`;
  }
  const skipLabel = step.id === 'done' ? 'Comincia' : 'Salta';
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
  chapterEnvironment.setRevealed(remaining.length === 0);
  const removed = level.pieces.length - remaining.length;
  $('progress-label').textContent = `${removed} / ${level.pieces.length}`;
  $('progress-label').setAttribute('aria-label', `${removed} di ${level.pieces.length} pezzi liberati`);
  $('progress-fill').style.transform = `scaleX(${removed / level.pieces.length})`;
  $<HTMLButtonElement>('undo').disabled = history.length === 0;
  $<HTMLButtonElement>('hint').disabled = remaining.length === 0;
  $('level-brief').hidden = screen !== 'game' || levelIndex === TUTORIAL_INDEX;
  $('level-brief').setAttribute('aria-label', `Livello ${levelIndex + 1}, ${CHAPTERS.find(chapter => chapter.id === level.chapter)?.name ?? ''}`);
  $('level-number').textContent = String(levelIndex + 1);
  $('level-chapter-icon').innerHTML = chapterIcon(level.chapter);
  $('level-title').textContent = level.name;
  const discoveryCount = CAMPAIGN_INDEXES.filter(index => completed.has(LEVELS[index].key)).length;
  const total = CAMPAIGN_INDEXES.length;
  $('journey-summary').innerHTML = `${icon('gem')}<span>${discoveryCount}</span><small>/${total}</small>`;
  $('journey-summary').setAttribute('aria-label', `${discoveryCount} scoperte su ${total}`);
  $('relic-counter').textContent = String(discoveryCount);
  $('top-relics').setAttribute('aria-label', `Reliquie: ${discoveryCount} su ${total}`);
  document.querySelectorAll<HTMLButtonElement>('[data-level]').forEach(button => {
    const i = Number(button.dataset.level);
    button.setAttribute('aria-pressed', String(i === levelIndex));
    const key = LEVELS[i].key;
    button.classList.toggle('is-done', completed.has(key));
    const check = button.querySelector('.tab-check')!;
    if (completed.has(key) !== !!check.firstChild) check.innerHTML = completed.has(key) ? icon('check') : '';
    check.setAttribute('aria-label', completed.has(key) ? 'completato' : '');
    const count = i === levelIndex ? history.length : (savedGame.levels[key]?.removedIds.length ?? 0);
    button.querySelector('.node-progress')!.textContent = completed.has(key) ? `Svelato${savedGame.bestTimes[key] ? ` · ${formatTime(savedGame.bestTimes[key])}` : ''}` : count ? `${count} / ${LEVELS[i].pieces.length}` : `${LEVELS[i].pieces.length} pezzi`;
  });
  document.querySelectorAll<SVGPathElement>('.path-top [data-segment]').forEach(path => {
    path.classList.toggle('is-done', completed.has(LEVELS[Number(path.dataset.segment)].key));
  });
  document.querySelectorAll<HTMLElement>('[data-slot]').forEach(slot => slot.classList.toggle('is-found', completed.has(LEVELS[Number(slot.dataset.slot)].key)));
  updateHomeActions();
  updateTutorial();
}
/** Home shows only what the next tap does: the level badge and its chapter's progress. */
function updateHomeActions() {
  const next = nextPlayable();
  const target = next ?? levelIndex;
  const button = $('play-game');
  if (next === undefined || next === TUTORIAL_INDEX) delete button.dataset.badge; else button.dataset.badge = String(next + 1);
  const chapter = LEVELS[target].chapter || 1;
  const indexes = CAMPAIGN_INDEXES.filter(index => LEVELS[index].chapter === chapter);
  const done = indexes.filter(index => completed.has(LEVELS[index].key)).length;
  const strip = $('chapter-strip');
  const signature = `${chapter}:${target}:${indexes.map(index => +completed.has(LEVELS[index].key)).join('')}`;
  if (strip.dataset.signature === signature) return;
  strip.dataset.signature = signature;
  strip.setAttribute('aria-label', `${CHAPTERS.find(item => item.id === chapter)!.name}: ${done} di ${indexes.length}`);
  strip.innerHTML = `${chapterIcon(chapter)}<span class="strip-steps">${indexes.map(index => `<i class="${completed.has(LEVELS[index].key) ? 'is-done' : index === target ? 'is-current' : ''}"></i>`).join('')}</span>`;
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
  if (!selected || screen !== 'game' || document.querySelector('dialog[open]')) return;
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
function groundHeight() { return Math.min(...LEVELS[levelIndex].pieces.map(piece => piece.position[1])) - 0.65; }
function defaultDistance() {
  if (screen === 'collection') return 2.8 * Math.max(1, 1 / camera.aspect);
  const radius = Math.max(...LEVELS[levelIndex].pieces.map(piece => Math.hypot(...piece.position))) + 0.65;
  return (levelIndex === TUTORIAL_INDEX ? 8.8 : Math.max(8.8, radius / Math.sin(THREE.MathUtils.degToRad(17)) * 1.08)) * Math.max(1, 1 / camera.aspect);
}
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
  interruptTrial('È iniziata una nuova partita.');
  trial = null; onlineRun = null; trialStarting = false;
  $('trial-status').hidden = true;
  generation++; clearTimeout(completionTimer); animations = []; cameraTween = null;
  $<HTMLDialogElement>('win-dialog').close();
  selected = null; clearBeam(); disposeGroup(puzzleGroup); meshes.clear();
  levelIndex = index;
  gestures.reset();
  if (index === TUTORIAL_INDEX && restart) savedGame.tutorial = { rotated: false, blockedSeen: false };
  $('app').classList.toggle('is-tutorial', index === TUTORIAL_INDEX);
  const removedIds = restart ? [] : (savedGame.levels[LEVELS[index].key]?.removedIds ?? []);
  history = removedIds.map(id => LEVELS[index].pieces.find(piece => piece.id === id)!);
  const removed = new Set(removedIds);
  remaining = LEVELS[index].pieces.filter(piece => !removed.has(piece.id));
  chapterEnvironment.setLevel(LEVELS[index]);
  updateAtmosphere();
  remaining.forEach(createPiece); createReward();
  ground.position.y = groundHeight();
  resize(); resetView(false); selectPiece(null); updateProgress();
  if (!remaining.length) moveCamera(camera.position.clone().normalize().multiplyScalar(4));
  else if (!reducedMotion && screen === 'game') {
    // The figure settles in: a slow dolly and a gentle scale, never a cut.
    const settled = camera.position.clone();
    camera.position.multiplyScalar(1.22); controls.update();
    moveCamera(settled);
    animations.push({ start: performance.now(), duration: 620, update: t => puzzleGroup.scale.setScalar(0.88 + smooth(t) * 0.12), end: () => puzzleGroup.scale.setScalar(1) });
  }
  if (screen === 'game' && index !== TUTORIAL_INDEX && !completed.has(LEVELS[index].key) && !history.length) showToast(LEVELS[index].focus);
  else hideToast();
  announce(`${index === TUTORIAL_INDEX ? 'Introduzione' : `Livello ${index + 1}`}: ${LEVELS[index].name}. ${remaining.length} pezzi rimasti.${history.length ? ' Partita ripristinata.' : ''}`);
  void persistGame();
}
function win() {
  playSound('win');
  const level = LEVELS[levelIndex];
  const firstDiscovery = !completed.has(level.key);
  completed.add(level.key);
  selectPiece(null); updateProgress();
  createReward();
  if (!reducedMotion) animations.push({ start: performance.now(), duration: 800, update: t => reward.scale.setScalar(0.4 + smooth(t) * 0.6) });
  const currentGeneration = generation;
  moveCamera(camera.position.clone().normalize().multiplyScalar(4));
  $('win-title').textContent = level.artifact;
  const tutorial = levelIndex === TUTORIAL_INDEX;
  $('win-rarity').textContent = tutorial ? 'PRIMI PASSI' : RARITIES[level.rarity].toUpperCase();
  $('win-pips').innerHTML = tutorial ? '' : pips(RARITY_PIPS[level.rarity]);
  $('win-dialog').dataset.tone = tutorial ? 'common' : level.rarity;
  const discoveries = CAMPAIGN_INDEXES.filter(index => completed.has(LEVELS[index].key)).length;
  $('win-count').innerHTML = `${icon('gem')}${firstDiscovery && !tutorial ? '+1 · ' : ''}${discoveries}/${CAMPAIGN_INDEXES.length}`;
  $('win-count').hidden = tutorial;
  const chapterComplete = CAMPAIGN_INDEXES.filter(index => LEVELS[index].chapter === level.chapter).every(index => completed.has(LEVELS[index].key));
  $('win-description').textContent = !tutorial && chapterComplete ? `${CHAPTERS.find(chapter => chapter.id === level.chapter)!.name}: collezione completa!` : '';
  $('win-description').hidden = !$('win-description').textContent;
  $('next-level').innerHTML = `${tutorial ? 'Comincia' : levelIndex === CAMPAIGN_INDEXES.at(-1) ? 'Reliquie' : 'Avanti'} ${icon('next')}`;
  $('win-collection').hidden = $('win-trial').hidden = tutorial;
  $('win-record').hidden = true;
  $('win-online').hidden = true;
  const elapsed = trial?.finish(performance.now());
  clearInterval(trialInterval);
  if (elapsed) {
    const previous = savedGame.bestTimes[level.key];
    savedGame.bestTimes[level.key] = Math.min(previous ?? Infinity, elapsed);
    $('win-record').innerHTML = `${icon('clock')}${!previous || elapsed < previous ? 'Nuovo record · ' : ''}${formatTime(elapsed)}`;
    $('win-record').hidden = false;
    $('trial-clock').textContent = formatTime(elapsed);
    $('trial-label').textContent = 'PROVA COMPLETATA';
  }
  const proof = history.map(piece => piece.id);
  if (levelIndex !== TUTORIAL_INDEX && accountState().user) {
    const owner = accountState().user!.id;
    const run = onlineRun;
    $('win-online').hidden = false;
    $('win-online').textContent = elapsed && run ? 'Verifica del tempo online…' : 'Registrazione della scoperta…';
    void (elapsed && run && run.owner === owner ? finishTimedRun(run.id, proof).then(result => `Tempo online verificato · ${formatTime(result.elapsedMs)} · record ${formatTime(result.bestMs)}`) : submitDiscovery(level.key, proof).then(() => 'Scoperta registrata nella classifica degli esploratori.'))
      .then(message => { if (generation === currentGeneration && accountState().user?.id === owner) $('win-online').textContent = message; })
      .catch(error => { if (generation === currentGeneration && accountState().user?.id === owner) $('win-online').textContent = error instanceof Error ? error.message : 'Risultato salvato sul dispositivo. Classifica non disponibile.'; });
  }
  onlineRun = null;
  completionTimer = setTimeout(() => { if (currentGeneration === generation && !remaining.length) $<HTMLDialogElement>('win-dialog').showModal(); }, 1050);
}

function interruptTrial(reason: string) {
  if (!trial?.running) return;
  trial.invalidate(reason);
  onlineRun = null;
  clearInterval(trialInterval);
  $('trial-label').textContent = 'PROVA INTERROTTA · GIOCO LIBERO';
  $('trial-clock').textContent = '';
  $('trial-status').classList.add('trial-interrupted');
  announce(`${reason} Puoi continuare liberamente; questo tentativo non registra un tempo.`);
}

function prepareTimeTrial(index = levelIndex) {
  if (index === TUTORIAL_INDEX || !completed.has(LEVELS[index].key)) return;
  enterGame(index, true);
  $('trial-ready-title').textContent = LEVELS[index].name;
  $('trial-ready-status').textContent = accountState().user ? 'Prova online: resta connesso.' : 'Vale per il tuo record. Accedi per la classifica.';
  $<HTMLButtonElement>('begin-trial').disabled = false;
  $<HTMLDialogElement>('trial-ready-dialog').showModal();
  controls.enabled = false;
}

async function beginTimeTrial() {
  if (trialStarting) return;
  trialStarting = true;
  const currentGeneration = generation;
  const owner = accountState().user?.id;
  $<HTMLButtonElement>('begin-trial').disabled = true;
  let run: { id: string; owner: string } | null = null;
  let notice = '';
  if (owner) {
    $('trial-ready-status').textContent = 'Preparazione della prova online…';
    try { const result = await startTimedRun(LEVELS[levelIndex].key); run = { ...result, owner }; }
    catch (error) { notice = `${error instanceof Error ? error.message : 'Classifica non disponibile.'} Prova valida solo per il record personale.`; }
  }
  if (generation !== currentGeneration || owner !== accountState().user?.id || !$<HTMLDialogElement>('trial-ready-dialog').open || document.hidden) {
    trialStarting = false;
    if (generation === currentGeneration) {
      $<HTMLButtonElement>('begin-trial').disabled = false;
      $('trial-ready-status').textContent = 'La partenza è stata interrotta. Premi Inizia quando sei pronto.';
    }
    return;
  }
  trialStarting = false;
  onlineRun = run;
  trial = new TimeTrial(); trial.start(performance.now());
  $('trial-label').textContent = run ? 'PROVA ONLINE' : 'RECORD PERSONALE';
  $('trial-clock').textContent = '00:00.000';
  $('trial-status').hidden = false;
  $('trial-status').classList.remove('trial-interrupted');
  if (notice) showToast(notice);
  $<HTMLDialogElement>('trial-ready-dialog').close();
  renderer.domElement.focus({ preventScroll: true });
  clearInterval(trialInterval);
  trialInterval = setInterval(() => { if (trial?.running) $('trial-clock').textContent = formatTime(trial.elapsed(performance.now())); }, 67);
  wakeRenderer();
}

const metagame = initMetagame({
  getSave: () => savedGame,
  screen: showScreen,
  preview: previewRelic,
  play: index => enterGame(index),
  trial: prepareTimeTrial,
  account: () => $('home-account').click(),
});

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
window.addEventListener('blur', () => { gestures.reset(); orbitStart = null; interruptTrial('La finestra ha perso il fuoco.'); });
renderer.domElement.addEventListener('keydown', event => {
  if ((screen !== 'game' && screen !== 'collection') || document.querySelector('dialog[open]')) return;
  if (event.key === 'Enter' && screen === 'game') { event.preventDefault(); extract(); }
  if (event.key.toLowerCase() === 'n' && screen === 'game') { event.preventDefault(); cyclePiece(); }
  if (event.key === 'Escape') { event.preventDefault(); if (screen === 'collection') metagame.closeDetail(); else if (selected) selectPiece(null); else openPause(); }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '='].includes(event.key)) {
    event.preventDefault(); cameraTween = null;
    const spherical = new THREE.Spherical().setFromVector3(camera.position);
    if (event.key === 'ArrowLeft') spherical.theta -= 0.18;
    if (event.key === 'ArrowRight') spherical.theta += 0.18;
    if (event.key === 'ArrowUp') spherical.phi = Math.max(0.06, spherical.phi - 0.18);
    if (event.key === 'ArrowDown') spherical.phi = Math.min(Math.PI - 0.06, spherical.phi + 0.18);
    if (event.key === '+' || event.key === '=') spherical.radius = Math.max(controls.minDistance, spherical.radius * 0.9);
    if (event.key === '-') spherical.radius = Math.min(controls.maxDistance, spherical.radius * 1.1);
    camera.position.setFromSpherical(spherical); controls.update();
    if (event.key.startsWith('Arrow') && screen === 'game') learnedRotation();
  }
});
$('play-game').addEventListener('click', continueGame);
$('tab-home').addEventListener('click', () => showScreen('home'));
$('tab-journey').addEventListener('click', () => showScreen('journey'));
$('tab-collection').addEventListener('click', () => metagame.openCollection());
$('tab-rankings').addEventListener('click', () => metagame.openRankings(levelIndex));
$('top-relics').addEventListener('click', () => metagame.openCollection());
$('pause-game').addEventListener('click', openPause);
$('resume-game').addEventListener('click', () => {
  closeDialogs();
  renderer.domElement.focus({ preventScroll: true });
  if (!remaining.length) win();
});
$('pause-journey').addEventListener('click', () => showScreen('journey'));
$('pause-collection').addEventListener('click', () => metagame.openCollection(levelIndex));
$('pause-trial').addEventListener('click', () => prepareTimeTrial());
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
  controls.enabled = (screen === 'game' || screen === 'collection') && !document.querySelector('dialog[open]');
  wakeRenderer();
}));
$('hint').addEventListener('click', () => {
  interruptTrial('Hai usato un suggerimento.');
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
  interruptTrial('Hai annullato una mossa.');
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
$('next-level').addEventListener('click', () => {
  if (levelIndex === CAMPAIGN_INDEXES.at(-1)) metagame.openCollection(levelIndex);
  else loadLevel(levelIndex === TUTORIAL_INDEX ? 0 : levelIndex + 1);
});
$('win-collection').addEventListener('click', () => metagame.openCollection(levelIndex));
$('win-trial').addEventListener('click', () => prepareTimeTrial());
$('begin-trial').addEventListener('click', () => void beginTimeTrial());
$('cancel-trial').addEventListener('click', () => $<HTMLDialogElement>('trial-ready-dialog').close());
function resize() {
  const bounds = renderer.domElement.parentElement!.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
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
  // Re-assigning the same size would clear the canvas and break a frozen frame.
  if (renderer.domElement.width !== Math.floor(bounds.width * renderer.getPixelRatio()) || renderer.domElement.height !== Math.floor(bounds.height * renderer.getPixelRatio())) renderer.setSize(bounds.width, bounds.height);
  chapterEnvironment.resize(bounds.width, bounds.height);
  wakeRenderer();
}
new ResizeObserver(resize).observe($('scene'));
new ResizeObserver(resize).observe($('relic-stage'));

function wakeRenderer() {
  idleFrames = 0;
  if (!ready || !appActive || document.hidden || rendering) return;
  rendering = true;
  lastFrameTime = 0;
  renderer.setAnimationLoop(renderFrame);
}

function updateAtmosphere() {
  const chapter = screen === 'game' ? LEVELS[levelIndex].chapter : 0;
  $('app').dataset.chapter = String(chapter);
  environmentEnabled = chapter > 0;
}

function renderFrame(time: number) {
  const delta = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.05) : 0;
  lastFrameTime = time;
  if (time < freezeUntil) return;
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
  // The victory card is see-through: the relic keeps turning behind it.
  const modalOpen = !!document.querySelector('dialog[open]:not(#win-dialog)');
  const spinning = !reducedMotion && !modalOpen && (screen === 'home' || (screen === 'game' && !remaining.length) || (screen === 'collection' && metagame.detailOpen()));
  if (spinning && screen === 'home') {
    homeSculpture.rotation.y += delta * 0.16;
    homeSculpture.position.y = Math.sin(time * 0.0006) * 0.09;
  }
  if (spinning && screen === 'game') reward.rotation.y += delta * 0.32;
  if (spinning && screen === 'collection') gallery.rotation.y += delta * 0.28;
  controls.update();
  if (environmentEnabled) {
    // Scenery is a background pass: it never covers a cube or enters hit testing.
    renderer.autoClear = false;
    renderer.clear();
    renderer.render(chapterEnvironment.scene, chapterEnvironment.camera);
    renderer.clearDepth();
    renderer.render(scene, camera);
    renderer.autoClear = true;
  } else renderer.render(scene, camera);
  idleFrames++;
  if (idleFrames > 12 && animations.length === 0 && !cameraTween && !spinning) {
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
  interruptTrial('La partita è passata in background.');
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
  resize(); loadLevel(Math.max(0, LEVELS.findIndex(level => level.key === savedGame.activeLevel)));
  ready = true; $('app').inert = false;
  createHomeSculpture(); showScreen('home'); initPwa();
  if (!reducedMotion) animations.push({ start: performance.now(), duration: 900, update: t => homeSculpture.scale.setScalar(0.7 + smooth(t) * 0.3) });
  initAccountUi(async () => { interruptTrial('È cambiata la sessione account.'); settleAnimations(); await persistGame(); });
  onAccountSaveChange(save => {
    // A replacement belongs to the new account: never persist the previous board.
    ready = false;
    settleAnimations();
    savedGame = save;
    completed = new Set(save.completed);
    loadLevel(Math.max(0, LEVELS.findIndex(level => level.key === save.activeLevel)));
    showScreen('home');
    ready = true;
    wakeRenderer();
  });
  subscribeAccount(() => { if (screen === 'collection' || screen === 'rankings') metagame.refresh(); });
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
      if (screen === 'collection' && metagame.detailOpen()) { metagame.closeDetail(); return; }
      if (screen === 'journey' || screen === 'collection' || screen === 'rankings') { showScreen('home'); return; }
      if (screen === 'game') { openPause(); return; }
      suspendGame();
      await persistGame();
      await App.minimizeApp();
    });
  }
}
void startGame();
