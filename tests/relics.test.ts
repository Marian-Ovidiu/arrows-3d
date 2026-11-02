import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRelic, disposeRelic } from '../src/relics.ts';
import { chapterIcon, relicIcon } from '../src/ui-icons.ts';
import type { RewardKind } from '../src/puzzle.ts';

const NEW_RELICS: RewardKind[] = [
  'bell','feather','flower','lantern','nest',
  'ember','hammer','anvil','gear','phoenix',
  'mirror','mask','crown','prism','castle',
  'pearl','coral','shell','jellyfish','leviathan',
  'anchor','wave','ship','conch','trident',
  'flute','kite','chime','fanfare','griffin',
  'rune','eye','chalice','infinity','heart',
];

test('all expansion sculptures contain finite geometry inside the core envelope and release every owned resource', () => {
  const silhouettes = new Set<string>();
  for (const kind of NEW_RELICS) {
    const relic = createRelic(kind);
    relic.updateMatrixWorld(true);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    let vertices = 0, maxRadius = 0, geometryHash = 0;
    const point = new THREE.Vector3();
    relic.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      const positions = object.geometry.getAttribute('position');
      vertices += positions.count;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
        assert.ok([point.x, point.y, point.z].every(Number.isFinite), `${kind}: non-finite vertex`);
        maxRadius = Math.max(maxRadius, point.length());
        geometryHash = (Math.imul(geometryHash, 31) + Math.round(point.x * 1000) + Math.round(point.y * 1000) * 7 + Math.round(point.z * 1000) * 13) | 0;
      }
    });
    assert.ok(vertices > 100 && vertices < 20_000, `${kind}: ${vertices} vertices`);
    assert.ok(maxRadius <= .44001 && maxRadius > .4, `${kind}: ${maxRadius} radius`);
    assert.ok(!silhouettes.has(`${vertices}:${geometryHash}`), `${kind}: duplicates another sculpture's geometry`);
    silhouettes.add(`${vertices}:${geometryHash}`);
    let geometryDisposals = 0, materialDisposals = 0;
    for (const geometry of geometries) geometry.addEventListener('dispose', () => geometryDisposals++);
    for (const material of materials) material.addEventListener('dispose', () => materialDisposals++);
    disposeRelic(relic);
    assert.equal(geometryDisposals, geometries.size, `${kind}: geometry leak`);
    assert.equal(materialDisposals, materials.size, `${kind}: material leak`);
  }
});

test('all expansion relics and all ten chapters have distinct drawable SVG icons', () => {
  const relics = NEW_RELICS.map(relicIcon);
  assert.equal(new Set(relics).size, NEW_RELICS.length);
  for (const svg of relics) {
    assert.ok(!svg.includes('undefined'));
    assert.match(svg, /<path d="M/);
    assert.ok(svg.includes('aria-hidden="true"'));
  }
  assert.equal(new Set(Array.from({ length: 10 }, (_, i) => chapterIcon(i + 1))).size, 10);
});
