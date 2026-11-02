import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createAssetVignette, disposeChapterAsset, hasChapterAsset, loadChapterAsset, type ChapterAssetLoader } from './chapter-assets.ts';

type EnvironmentLevel = { key: string; chapter: number; pieces: readonly { position: readonly number[] }[] };
type Placement = { x: number; y: number; scale: number };

/** Camera-space anchors: compact viewports keep the entire vignette below the puzzle. */
export function chapterEnvironmentLayout(aspect: number): readonly Placement[] {
  const safeAspect = Math.max(0.2, aspect);
  const compact = safeAspect < 1.2;
  const scale = compact ? Math.min(0.30, safeAspect * 0.57) : 0.42;
  const x = compact ? safeAspect * 0.77 : safeAspect - 0.28;
  return [{ x: -x, y: -0.97, scale }, { x, y: -0.97, scale: scale * 0.86 }];
}

/** Static, independently lit scenery. Render before the puzzle, then clear depth. */
export class ChapterEnvironment {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  private readonly clusters: THREE.Group[] = [];
  private readonly geometries = {
    stone: new THREE.IcosahedronGeometry(1, 1),
    leaf: new THREE.SphereGeometry(1, 8, 4),
    stem: new THREE.CylinderGeometry(1, 1, 1, 6),
    cap: new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    block: new THREE.BoxGeometry(1, 1, 1),
    arch: new THREE.TorusGeometry(0.32, 0.065, 5, 20, Math.PI * 1.15),
    ring: new THREE.TorusGeometry(0.28, 0.008, 4, 32),
    shard: new THREE.OctahedronGeometry(1),
  };
  private readonly materials = [
    this.material(0x8eaa93), this.material(0xb6beb1), this.material(0xb6866d),
    this.material(0x9daebb), this.material(0xdbd6c4), this.material(0xc1ad7e),
    this.material(0x8eafab), this.material(0xe2dcc8),
    this.material(0xc69268), this.material(0xb2a9cc), this.material(0x78afc4), this.material(0xd3a5a1),
  ];
  private aspect = 1;
  private currentKey = '';
  private currentChapter = 0;
  private readonly assetLoader: ChapterAssetLoader | null;
  private readonly onChange: () => void;
  private readonly assets = new Map<number, THREE.Group>();
  private readonly requests = new Set<number>();
  private revealed = false;
  private disposed = false;

  constructor(options: { loadAsset?: ChapterAssetLoader; onChange?: () => void } = {}) {
    this.assetLoader = options.loadAsset ?? (typeof document === 'undefined' ? null : loadChapterAsset);
    this.onChange = options.onChange ?? (() => {});
    this.camera.position.set(0, 0, 6);
    this.scene.add(new THREE.HemisphereLight(0xfff8e9, 0xaab8b0, 2.2));
    const light = new THREE.DirectionalLight(0xfff2db, 2);
    light.position.set(-3, 5, 6);
    this.scene.add(light);
    this.scene.userData.decorative = true;
  }

  private material(color: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.08,
      transparent: true, opacity: 0.58, depthWrite: false });
  }

  setLevel(level: EnvironmentLevel): void {
    if (this.currentKey === level.key && this.currentChapter === level.chapter) return;
    this.clearClusters();
    this.currentKey = level.key;
    this.currentChapter = level.chapter;
    this.scene.userData.chapter = level.chapter;
    this.scene.userData.source = 'none';
    if (level.chapter < 1 || level.chapter > 10) { this.onChange(); return; }
    if (this.assets.has(level.chapter)) { this.installAsset(level.chapter); return; }
    let seed = 0;
    for (const character of level.key) seed = (Math.imul(seed, 31) + character.charCodeAt(0)) >>> 0;
    for (let side = 0; side < 2; side++) {
      const cluster = this.buildCluster(level.chapter, side, ((seed >>> (side * 8)) & 255) / 255);
      cluster.name = `chapter-${level.chapter}-${side === 0 ? 'left' : 'right'}`;
      this.clusters.push(cluster);
      this.scene.add(cluster);
    }
    this.scene.userData.source = 'procedural';
    this.resize(this.aspect, 1);
    this.onChange();
    this.requestAsset(level.chapter);
  }

  private requestAsset(chapter: number): void {
    if (!hasChapterAsset(chapter) || !this.assetLoader || this.requests.has(chapter)) return;
    this.requests.add(chapter);
    void this.assetLoader(chapter).then(asset => {
      if (this.disposed) { disposeChapterAsset(asset); return; }
      if (!asset.getObjectByName('left') || !asset.getObjectByName('right')) { disposeChapterAsset(asset); return; }
      this.assets.set(chapter, asset);
      if (this.currentChapter === chapter) this.installAsset(chapter);
    }).catch(() => { /* The procedural scenery remains usable if a model is unavailable. */ });
  }

  private installAsset(chapter: number): void {
    const asset = this.assets.get(chapter)!;
    // Prepare both sides before replacing the fallback, so a bad asset cannot blank the scene.
    const groups = ['left', 'right'].map(side => createAssetVignette(asset.getObjectByName(side)!));
    this.clearClusters();
    let seed = 0;
    for (const character of this.currentKey) seed = (Math.imul(seed, 31) + character.charCodeAt(0)) >>> 0;
    groups.forEach((group, index) => {
      group.name = `chapter-${chapter}-${index === 0 ? 'left' : 'right'}`;
      group.userData.chapter = chapter;
      group.rotation.y = (((seed >>> (index * 8)) & 255) / 255 - .5) * .12;
      this.clusters.push(group);
      this.scene.add(group);
    });
    this.scene.userData.source = 'blender';
    this.resize(this.aspect, 1);
    this.setRevealed(this.revealed);
    this.onChange();
  }

  resize(width: number, height: number): void {
    this.aspect = Math.max(0.2, width / Math.max(height, 0.001));
    this.camera.left = -this.aspect;
    this.camera.right = this.aspect;
    this.camera.updateProjectionMatrix();
    chapterEnvironmentLayout(this.aspect).forEach((placement, index) => {
      const cluster = this.clusters[index];
      if (!cluster) return;
      cluster.position.set(placement.x, placement.y, 0);
      cluster.scale.setScalar(placement.scale);
    });
  }

  setRevealed(revealed: boolean): void {
    this.revealed = revealed;
    for (const material of this.materials) material.opacity = revealed ? 0.3 : 0.58;
    for (const cluster of this.clusters) cluster.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !object.userData.sharedEnvironmentGeometry) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.opacity = revealed ? .38 : .82;
    });
  }

  private buildCluster(chapter: number, side: number, variation: number): THREE.Group {
    const group = new THREE.Group();
    const batches = new Map<number, THREE.BufferGeometry[]>();
    const transform = new THREE.Object3D();
    const add = (kind: keyof typeof this.geometries, material: number, x: number, y: number,
      sx: number, sy: number, sz: number, rz = 0, ry = 0, z = 0) => {
      transform.position.set(x, y, z);
      transform.rotation.set(-0.12, ry, rz);
      transform.scale.set(sx, sy, sz);
      transform.updateMatrix();
      const template = this.geometries[kind];
      const geometry = (template.index ? template.toNonIndexed() : template.clone()).applyMatrix4(transform.matrix);
      if (!batches.has(material)) batches.set(material, []);
      batches.get(material)!.push(geometry);
    };
    const stone = (x: number, y: number, scale: number, material = 1) =>
      add('stone', material, x, y, scale, scale * 0.58, scale * 0.8, x * 0.8, variation);
    if (chapter === 1) {
      stone(-0.16, 0.13, 0.22); stone(0.19, 0.08, 0.15); stone(0.34, 0.07, 0.08);
      // Alternating leaflets produce a fern silhouette without thin line primitives.
      for (let frond = 0; frond < 2; frond++) {
        const base = frond === 0 ? -0.19 : 0.12;
        const lean = frond === 0 ? -0.28 : 0.26;
        add('stem', 0, base + lean * 0.5, 0.46, 0.012, 0.66, 0.012, -lean);
        for (let row = 0; row < 5; row++) {
          const y = 0.28 + row * 0.105;
          const x = base + lean * (y - 0.13);
          const size = 0.11 - row * 0.012;
          for (const direction of [-1, 1])
            add('leaf', 0, x + direction * size * 0.65, y, size, 0.028, 0.032, direction * 0.48);
        }
      }
      const mushrooms = side === 0 ? 2 : 1;
      for (let index = 0; index < mushrooms; index++) {
        const x = 0.12 + index * 0.17;
        const height = 0.25 - index * 0.08;
        add('stem', 4, x, height * 0.5, 0.024, height, 0.024, -0.08);
        add('cap', 2, x, height, 0.105 - index * 0.02, 0.065, 0.105 - index * 0.02);
      }
    } else if (chapter === 2) {
      stone(-0.12, 0.1, 0.24, 4);
      add('block', 3, -0.28, 0.32, 0.14, 0.5, 0.17, -0.1, 0.2);
      add('arch', 4, -0.01, 0.49, 1, 1, 0.85, 0.04, 0.2);
      add('block', 3, 0.28, 0.15, 0.16, 0.23, 0.18, -0.22, 0.3);
      add('block', 4, 0.25, 0.33, 0.18, 0.08, 0.18, 0.27, 0.3);
      add('ring', 5, 0.07, 0.59, 0.67, 0.67, 0.67, -0.55, 0.65, 0.1);
      add('ring', 3, 0.07, 0.59, 0.83, 0.83, 0.83, 0.4, -0.65, 0.1);
      add('shard', 5, 0.07, 0.59, 0.025, 0.045, 0.025, 0.3, 0, 0.1);
      // Two shallow gold inlays read as carving in the fallen masonry.
      for (let line = 0; line < 2; line++)
        add('block', 5, -0.27, 0.27 + line * 0.09, 0.09, 0.009, 0.008, -0.1, 0, 0.1);
    } else if (chapter === 3) {
      stone(-0.13, 0.09, 0.21, 6); stone(0.23, 0.07, 0.12, 4);
      add('arch', 6, -0.01, 0.4, 0.94, 1.14, 0.68, 0.23, 0.25);
      add('block', 6, -0.29, 0.2, 0.115, 0.28, 0.13, 0.13, 0.2);
      add('block', 4, 0.26, 0.22, 0.09, 0.24, 0.12, -0.17, 0.3);
      add('shard', 6, 0.28, 0.48, 0.07, 0.12, 0.06, -0.35, 0.3);
      add('shard', 5, -0.1, 0.55, 0.032, 0.13, 0.025, -0.35, 0.4, 0.08);
      add('shard', 7, 0.07, 0.7, 0.04, 0.15, 0.026, 0.24, 0.3, 0.08);
      add('shard', 5, 0.18, 0.86, 0.025, 0.07, 0.022, -0.3);
      add('shard', 7, -0.28, 0.72, 0.023, 0.06, 0.02, 0.4);
    } else if (chapter === 4) {
      // Terraced floating gardens, with a hanging bridge and trailing greenery.
      for (const [x, y, size] of [[-.2,.24,.21],[.21,.59,.16]]) {
        stone(x,y,size,6); add('block',4,x,y+.09,size*1.8,.04,size*1.5);
        add('stem',0,x,y+.24,.018,.3,.018,.15);
        for (const d of [-1,1]) add('leaf',0,x+d*.07,y+.32,.12,.04,.07,-d*.4);
        for(let i=0;i<3;i++) add('leaf',0,x-size*.5+i*.055,y-.05-i*.045,.027,.09,.025,.3);
      }
      for(let i=0;i<5;i++) add('block',5,-.08+i*.048,.4+i*.028,.045,.018,.09,-.15);
      add('shard',11,-.2,.59,.035,.065,.035);
    } else if (chapter === 5) {
      // A squat furnace, a stepped chimney, bellows and a small anvil.
      stone(-.1,.08,.26,1);add('block',1,-.16,.29,.32,.4,.23);
      add('arch',8,-.16,.28,.39,.46,.5,0,0,.14);
      add('shard',8,-.16,.25,.07,.13,.03,0,0,.15);
      add('block',1,-.21,.6,.16,.28,.17); add('block',5,-.21,.77,.2,.045,.2);
      add('block',5,.22,.16,.21,.045,.18);add('stem',1,.22,.24,.055,.13,.06);
      add('block',5,.22,.32,.28,.055,.14);add('shard',8,.36,.32,.08,.035,.06,-Math.PI/2);
      for(let i=0;i<3;i++)add('leaf',4,-.2+i*.04,.86+i*.025,.035,.035,.025);
    } else if (chapter === 6) {
      // Mirrored turrets flank a reflecting gate; facets catch separate light.
      add('block',4,0,.08,.75,.1,.24);
      for(const x of [-.24,.24]){
        add('block',9,x,.36,.13,.52,.14);add('shard',4,x,.7,.115,.17,.1);
        for(const y of [.24,.4,.56])add('block',5,x,y,.06,.025,.012,0,0,.09);
      }
      add('arch',5,0,.37,.58,.8,.5);add('shard',10,0,.39,.12,.24,.035,0,0,.06);
      add('ring',9,0,.39,.47,.65,.47,0,.4,.08);
    } else if (chapter === 7) {
      // A reef of tall crystal blades with branching coral at its foot.
      stone(-.1,.1,.24,10);stone(.24,.08,.15,9);
      for(let i=0;i<5;i++){const x=(i-2)*.13,height=.24+(i%3)*.12;add('shard',i%2?9:10,x,.2+height*.5,.075,height,.07,(i-2)*-.13,variation);}
      for(const d of [-1,1]){
        add('stem',11,d*.28,.27,.015,.32,.015,d*.2,0,.12);
        add('stem',11,d*.32,.32,.012,.17,.012,-d*.7,0,.12);
        add('leaf',4,d*.34,.42,.03,.035,.03,0,0,.12);
      }
      add('leaf',4,.03,.12,.07,.06,.07,0,0,.19);
    } else if (chapter === 8) {
      // Broken tidal stairs, an upright sea arch, and shallow wave ribbons.
      for(let i=0;i<3;i++)add('block',6,-.2+i*.11,.1+i*.07,.25,.11,.3,-.04,0,-.04);
      add('arch',4,.09,.42,.77,.91,.65,.12,.25);
      add('block',4,-.17,.22,.09,.27,.13,-.1);add('block',6,.34,.17,.13,.24,.13,.15);
      for(let i=0;i<3;i++)add('arch',10,-.19+i*.17,.12,.4,.15,.35,-.12,0,.16+i*.025);
      add('shard',5,.05,.55,.04,.07,.04);
      add('stem',5,.31,.4,.013,.17,.013,.15);add('ring',5,.3,.5,.13,.13,.13);
    } else if (chapter === 9) {
      // A wind pavilion with a suspended chime and pennants.
      add('block',4,0,.1,.66,.08,.25);
      for(const x of [-.23,.23]){add('stem',4,x,.42,.035,.59,.035);add('block',5,x,.71,.11,.04,.12);}
      add('block',9,0,.75,.65,.055,.22);add('shard',9,0,.83,.32,.09,.16);
      for(let i=0;i<4;i++){
        const x=-.12+i*.08;add('stem',5,x,.59,.005,.23,.005);
        add('stem',10,x,.4+(i%2)*.04,.015,.2-i*.02,.015);
      }
      add('shard',5,0,.23,.035,.065,.025);
      for(const d of [-1,1])add('leaf',9,d*.3,.65,.13,.035,.025,d*.2);
    } else if (chapter === 10) {
      // The nexus: an elevated faceted heart inside crossing orbital arcs.
      stone(0,.1,.26,9);add('block',4,0,.21,.39,.055,.27);
      add('stem',5,0,.34,.04,.24,.04);add('shard',11,0,.59,.12,.19,.1);
      add('ring',5,0,.59,.94,.94,.94,.4,.6);add('ring',9,0,.59,1.07,1.07,1.07,-.45,-.6);
      for(let i=0;i<4;i++){const a=i*Math.PI/2+.3;add('shard',4,Math.cos(a)*.28,.59+Math.sin(a)*.28,.03,.045,.03,a,0,.04);}
      for(const d of [-1,1])add('shard',5,d*.27,.2,.045,.1,.035,-d*.3);
    }
    for (const [material, geometries] of batches) {
      const merged = mergeGeometries(geometries);
      geometries.forEach(geometry => geometry.dispose());
      if (merged) group.add(new THREE.Mesh(merged, this.materials[material]));
    }
    // A tiny deterministic turn changes the composition without expanding its bounds.
    group.rotation.y = (variation - 0.5) * 0.15;
    group.userData.chapter = chapter;
    return group;
  }

  private clearClusters(): void {
    const materials = new Set<THREE.Material>();
    for (const cluster of this.clusters) {
      cluster.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        if (object.userData.sharedEnvironmentGeometry) {
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
        } else object.geometry.dispose();
      });
      this.scene.remove(cluster);
    }
    this.clusters.length = 0;
    materials.forEach(material => material.dispose());
  }

  dispose(): void {
    this.disposed = true;
    this.clearClusters();
    Object.values(this.geometries).forEach(geometry => geometry.dispose());
    this.materials.forEach(material => material.dispose());
    this.assets.forEach(disposeChapterAsset);
    this.assets.clear();
    this.scene.clear();
  }
}
