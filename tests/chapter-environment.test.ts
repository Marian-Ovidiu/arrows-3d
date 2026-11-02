import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ChapterEnvironment } from '../src/chapter-environment.ts';
import { LEVELS, TUTORIAL_INDEX } from '../src/puzzle.ts';
import { readFile } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const chapterSamples = Array.from({ length: 10 }, (_, index) => ({ key: `scenery-chapter-${index + 1}`, chapter: index + 1, pieces: [] }));

test('actual scenery geometry stays outside the protected screen region on phones and wide screens', () => {
  const environment = new ChapterEnvironment();
  for (const level of [...LEVELS.filter(level => level.chapter > 0), ...chapterSamples]) {
    environment.setLevel(level);
    for (const aspect of [0.45, 0.66, 1, 1.2, 2.8]) {
      environment.resize(aspect * 1000, 1000);
      environment.scene.updateMatrixWorld(true);
      environment.camera.updateMatrixWorld(true);
      for (const group of environment.scene.children.filter(child => child instanceof THREE.Group)) {
        const box = new THREE.Box3().setFromObject(group);
        const points: THREE.Vector3[] = [];
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) points.push(new THREE.Vector3(x,y,z).project(environment.camera));
        const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
        const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
        assert.ok(maxX <= -.55 || minX >= .55 || maxY <= -.65 || minY >= .7, `${level.key}, aspect ${aspect}: scenery intrudes into central region`);
      }
    }
  }
  environment.dispose();
});

test('only the current chapter is allocated and scenery has a bounded mobile rendering cost', () => {
  const environment = new ChapterEnvironment();
  for (const level of [...chapterSamples, chapterSamples[0]]) {
    environment.setLevel(level);
    let meshes = 0, vertices = 0;
    environment.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      meshes++;
      vertices += object.geometry.getAttribute('position').count;
      const positions = object.geometry.getAttribute('position');
      for (let index = 0; index < positions.array.length; index++) assert.ok(Number.isFinite(positions.array[index]));
      assert.equal(object.castShadow, false);
      assert.equal(object.receiveShadow, false);
    });
    assert.ok(meshes >= 6 && meshes <= 10, `${level.key}: ${meshes} draw calls`);
    assert.ok(vertices > 0 && vertices <= 10_000);
    assert.equal(environment.scene.children.filter(child => child instanceof THREE.Group).length, 2);
  }
  environment.setLevel(LEVELS[TUTORIAL_INDEX]);
  assert.equal(environment.scene.children.filter(child => child instanceof THREE.Group).length, 0);
  environment.dispose();
});

test('expansion chapters use distinct procedural geometry without requesting absent models', async () => {
  const calls: number[] = [];
  const environment = new ChapterEnvironment({ loadAsset: async chapter => { calls.push(chapter); throw new Error('No model expected'); } });
  const compositions = new Set<string>();
  for (const level of chapterSamples.slice(3)) {
    environment.setLevel(level);
    await setImmediate();
    assert.equal(environment.scene.userData.source, 'procedural');
    assert.equal(environment.scene.userData.chapter, level.chapter);
    const signature: number[] = [];
    const outgoing: THREE.BufferGeometry[] = [];
    environment.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      signature.push(object.geometry.getAttribute('position').count);
      outgoing.push(object.geometry);
    });
    assert.ok(!compositions.has(signature.join(',')), `${level.key}: duplicated scenery`);
    compositions.add(signature.join(','));
    let disposed = 0;
    outgoing.forEach(geometry => geometry.addEventListener('dispose', () => disposed++));
    environment.setLevel({ key: 'empty', chapter: 0, pieces: [] });
    assert.equal(disposed, outgoing.length, `${level.key}: old scene geometry must be released`);
  }
  assert.deepEqual(calls, []);
  environment.dispose();
});

test('shipped Blender models remain self-contained, lightweight and within the safe margin envelope', async () => {
  const names = ['bosco','osservatorio','archivio'];
  const calls: number[] = [];
  const models: THREE.Group[] = [];
  for (const name of names) {
    const bytes = await readFile(new URL(`../public/models/environments/${name}.glb`, import.meta.url));
    assert.ok(bytes.length < 300_000);
    const jsonLength = bytes.readUInt32LE(12);
    const document = JSON.parse(bytes.subarray(20,20 + jsonLength).toString());
    assert.equal(document.images?.length ?? 0, 0);
    assert.equal(document.animations?.length ?? 0, 0);
    assert.ok(document.buffers.every((buffer: { uri?: string }) => !buffer.uri));
    models.push((await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene);
  }
  const environment = new ChapterEnvironment({ loadAsset: async chapter => { calls.push(chapter); return models[chapter - 1]; } });
  for (const index of [0,5,10,14,0]) {
    environment.setLevel(LEVELS[index]);
    await setImmediate();
    assert.equal(environment.scene.userData.source, 'blender');
    let meshCount = 0, vertices = 0;
    environment.scene.traverse(object => { if (object instanceof THREE.Mesh) { meshCount++; vertices += object.geometry.getAttribute('position').count; } });
    assert.ok(meshCount <= 14 && vertices < 18_000);
    for (const aspect of [.45,.66,1.2,2.8]) {
      environment.resize(aspect * 1000,1000);
      environment.scene.updateMatrixWorld(true); environment.camera.updateMatrixWorld(true);
      for (const group of environment.scene.children.filter(child => child instanceof THREE.Group)) {
        const box = new THREE.Box3().setFromObject(group);
        const corners: THREE.Vector3[] = [];
        for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) corners.push(new THREE.Vector3(x,y,z).project(environment.camera));
        assert.ok(Math.max(...corners.map(p => p.x)) <= -.55 || Math.min(...corners.map(p => p.x)) >= .55 || Math.max(...corners.map(p => p.y)) <= -.65);
      }
    }
  }
  assert.deepEqual(calls,[1,2,3]);
  environment.dispose();
});

test('a late model cannot restore scenery after leaving its chapter', async () => {
  let resolve!: (group: THREE.Group) => void;
  const loading = new Promise<THREE.Group>(done => { resolve = done; });
  const environment = new ChapterEnvironment({ loadAsset: () => loading });
  environment.setLevel(LEVELS[0]);
  environment.setLevel(LEVELS[TUTORIAL_INDEX]);
  const source = new THREE.Group();
  for (const side of ['left','right']) {
    const group = new THREE.Group(); group.name = side;
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial())); source.add(group);
  }
  resolve(source); await setImmediate();
  assert.equal(environment.scene.userData.source,'none');
  assert.equal(environment.scene.children.filter(child => child instanceof THREE.Group).length,0);
  environment.dispose();
});
