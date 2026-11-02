import * as THREE from 'three';

const MODEL_NAMES: Record<number, string> = { 1: 'bosco', 2: 'osservatorio', 3: 'archivio' };
/** Later chapters have native procedural scenery and never issue speculative GLB requests. */
export const hasChapterAsset = (chapter: number): boolean => Object.hasOwn(MODEL_NAMES, chapter);
export type ChapterAssetLoader = (chapter: number) => Promise<THREE.Group>;

/** Load only local, self-contained models; the loader itself is a lazy chunk. */
export const loadChapterAsset: ChapterAssetLoader = async chapter => {
  const name = MODEL_NAMES[chapter];
  if (!name) throw new Error('Unknown environment chapter');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const url = new URL(`models/environments/${name}.glb`, document.baseURI).href;
  return (await new GLTFLoader().loadAsync(url)).scene;
};

/** Independent materials, shared immutable geometry, and a predictable safe envelope. */
export function createAssetVignette(source: THREE.Object3D): THREE.Group {
  source.updateWorldMatrix(true, true);
  const content = new THREE.Group();
  const materialCopies = new Map<THREE.Material, THREE.Material>();
  const copyMaterial = (original: THREE.Material) => {
    if (!materialCopies.has(original)) {
      const copy = original.clone();
      copy.transparent = true;
      copy.opacity = .82;
      copy.depthWrite = false;
      materialCopies.set(original, copy);
    }
    return materialCopies.get(original)!;
  };
  source.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material.map(copyMaterial) : copyMaterial(object.material);
    const mesh = new THREE.Mesh(object.geometry, materials);
    object.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
    mesh.userData.sharedEnvironmentGeometry = true;
    content.add(mesh);
  });
  if (!content.children.length) throw new Error('Empty environment vignette');
  const box = new THREE.Box3().setFromObject(content);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = Math.min(1 / Math.max(size.y, .001), 1.1 / Math.max(size.x, .001));
  content.scale.setScalar(scale);
  content.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  const group = new THREE.Group();
  group.add(content);
  return group;
}

export function disposeChapterAsset(asset: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  asset.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
}
