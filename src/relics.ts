import * as THREE from 'three';
import type { RewardKind } from './puzzle';

/** Small, lit sculptures shared by the puzzle core and the collection viewer. */
export function createRelic(kind: RewardKind): THREE.Group {
  const root = new THREE.Group();
  root.name = `relic-${kind}`;
  const material = (color: number, metalness = 0, roughness = 0.4, glow?: number) => new THREE.MeshStandardMaterial({
    color, metalness, roughness, ...(glow === undefined ? {} : { emissive: glow, emissiveIntensity: 0.25 }),
  });
  const jade = material(0x85b9a3, 0.2);
  const deep = material(0x356d66, 0.25);
  const gold = material(0xd6b572, 0.72, 0.26);
  const ivory = material(0xf4e8cf, 0.12);
  const blue = material(0x91bec9, 0.25, 0.25, 0x528caa);
  const rose = material(0xc78e83, 0.18);
  const light = material(0xd6eadb, 0.08, 0.28, 0x90c8b0);
  const glass = new THREE.MeshStandardMaterial({ color: 0xaed5d1, transparent: true, opacity: 0.35, roughness: 0.18, metalness: 0.1, depthWrite: false });
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Group = root) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const orb = (r: number, mat: THREE.Material, x = 0, y = 0, z = 0) => add(new THREE.SphereGeometry(r, 16, 12), mat, x, y, z);
  const jewel = (r: number, mat: THREE.Material, x = 0, y = 0, z = 0) => add(new THREE.OctahedronGeometry(r), mat, x, y, z);
  const ring = (r: number, tube: number, mat: THREE.Material, x = 0, y = 0, z = 0, arc = Math.PI * 2) => add(new THREE.TorusGeometry(r, tube, 6, 40, arc), mat, x, y, z);
  const rod = (a: THREE.Vector3, b: THREE.Vector3, radius: number, mat: THREE.Material) => {
    const mesh = add(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 8), mat);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return mesh;
  };
  const line = (points: number[][], radius: number, mat: THREE.Material) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return add(new THREE.TubeGeometry(curve, 20, radius, 6, false), mat);
  };
  const leaf = (x: number, y: number, z: number, size: number, angle: number, mat = jade) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(-0.55, 0.33, -0.42, 0.77, 0, 1);
    shape.bezierCurveTo(0.42, 0.77, 0.55, 0.33, 0, 0);
    const mesh = add(new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 2, curveSegments: 10 }), mat, x, y, z);
    mesh.scale.setScalar(size);
    mesh.rotation.z = angle;
    return mesh;
  };
  const starShape = (outer: number, inner: number, points: number) => {
    const shape = new THREE.Shape();
    for (let i = 0; i < points * 2; i++) {
      const angle = Math.PI / 2 + i * Math.PI / points;
      const r = i % 2 === 0 ? outer : inner;
      const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  };
  const coin = (r: number, depth: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = add(new THREE.CylinderGeometry(r, r, depth, 32), mat, x, y, z);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  };
  const sparkle = (x: number, y: number, z: number, size = 0.035) => jewel(size, gold, x, y, z);

  switch (kind) {
    case 'seed': {
      const seed = orb(0.18, rose, 0, -0.17); seed.scale.set(0.85, 1.15, 0.8);
      line([[0, -0.12, 0], [-0.025, 0.08, 0], [0.05, 0.22, 0]], 0.018, deep);
      leaf(0, 0.04, 0, 0.24, -0.85);
      leaf(0.025, 0.13, -0.01, 0.23, 0.65, light);
      line([[-0.09, -0.3, 0.03], [0.01, -0.23, 0.14], [0.1, -0.14, 0.03]], 0.008, gold);
      break;
    }
    case 'leaf': {
      leaf(0, -0.3, 0, 0.57, -0.13);
      line([[0, -0.3, 0.06], [0.035, -0.02, 0.06], [0.07, 0.25, 0.06]], 0.009, gold);
      for (const y of [-0.18, -0.05, 0.08]) {
        line([[0.025, y, 0.065], [-0.09, y + 0.07, 0.065]], 0.006, gold);
        line([[0.035, y, 0.065], [0.14, y + 0.09, 0.065]], 0.006, gold);
      }
      ring(0.046, 0.012, gold, 0, -0.34, 0.01);
      jewel(0.045, blue, 0, -0.41, 0);
      break;
    }
    case 'mushroom': {
      const stem = add(new THREE.CylinderGeometry(0.05, 0.075, 0.29, 12), ivory, 0, -0.11); stem.rotation.z = -0.1;
      const cap = add(new THREE.SphereGeometry(0.26, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), rose, 0, 0.02);
      cap.scale.y = 0.72;
      add(new THREE.CylinderGeometry(0.258, 0.258, 0.025, 24), ivory, 0, 0.018);
      for (const [x, y, z, r] of [[-0.1, 0.16, 0.07, 0.038], [0.08, 0.17, 0.08, 0.045], [0.19, 0.1, 0.07, 0.025], [-0.04, 0.14, 0.17, 0.027], [-0.17, 0.09, 0.12, 0.029]]) orb(r, light, x, y, z).scale.y = 0.4;
      leaf(-0.04, -0.26, 0, 0.11, 1.1);
      sparkle(0.18, -0.12, 0.02);
      break;
    }
    case 'talisman': {
      ring(0.245, 0.033, gold);
      coin(0.204, 0.07, deep);
      ring(0.17, 0.008, jade, 0, 0, 0.048);
      jewel(0.105, blue, 0, 0, 0.09).scale.set(0.8, 1.2, 0.55);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const tick = add(new THREE.BoxGeometry(0.013, 0.035, 0.012), gold, Math.sin(a) * 0.204, Math.cos(a) * 0.204, 0.047);
        tick.rotation.z = -a;
      }
      ring(0.045, 0.012, gold, 0, 0.3);
      jewel(0.05, rose, 0, -0.33);
      break;
    }
    case 'spirit': {
      const body = orb(0.2, light, 0, 0.025); body.scale.set(0.92, 1.15, 0.78);
      const tail = add(new THREE.ConeGeometry(0.14, 0.23, 16), light, 0.035, -0.19); tail.rotation.z = Math.PI + 0.4;
      orb(0.023, deep, -0.063, 0.055, 0.15); orb(0.023, deep, 0.063, 0.055, 0.15);
      const smile = ring(0.035, 0.008, deep, 0, 0.015, 0.16, Math.PI); smile.rotation.z = Math.PI;
      orb(0.025, rose, -0.105, 0.015, 0.135); orb(0.025, rose, 0.105, 0.015, 0.135);
      const halo = ring(0.13, 0.012, gold, 0, 0.3); halo.rotation.x = Math.PI * 0.39;
      sparkle(-0.26, 0.12, 0); sparkle(0.25, -0.06, 0, 0.025);
      break;
    }
    case 'compass': {
      coin(0.26, 0.06, gold); coin(0.225, 0.068, ivory);
      ring(0.208, 0.009, deep, 0, 0, 0.04);
      const face = add(new THREE.ExtrudeGeometry(starShape(0.175, 0.037, 4), { depth: 0.013, bevelEnabled: false }), jade, 0, 0, 0.041);
      face.rotation.z = Math.PI / 4;
      const north = add(new THREE.ConeGeometry(0.038, 0.18, 4), rose, 0, 0.065, 0.077); north.scale.z = 0.35;
      const south = add(new THREE.ConeGeometry(0.038, 0.18, 4), deep, 0, -0.065, 0.077); south.rotation.z = Math.PI; south.scale.z = 0.35;
      orb(0.026, gold, 0, 0, 0.09);
      ring(0.04, 0.012, gold, 0, 0.31);
      break;
    }
    case 'crystal': {
      for (const [x, y, z, r, tilt] of [[0, 0, 0, 0.15, 0.05], [-0.15, -0.09, 0.015, 0.105, 0.4], [0.15, -0.11, -0.015, 0.11, -0.4], [0.035, -0.12, 0.13, 0.085, -0.2]]) {
        const crystal = add(new THREE.CylinderGeometry(0, r, r * 2.7, 5, 1), x < 0 ? jade : blue, x, y, z); crystal.rotation.z = tilt;
        const base = jewel(r * 0.8, deep, x, y - r, z); base.scale.y = 0.7;
      }
      const band = ring(0.17, 0.016, gold, 0, -0.16); band.rotation.x = Math.PI / 2;
      sparkle(-0.22, 0.2, 0.02, 0.025);
      break;
    }
    case 'moon': {
      const shape = new THREE.Shape();
      shape.moveTo(0.12, 0.29);
      shape.bezierCurveTo(-0.31, 0.25, -0.32, -0.27, 0.12, -0.29);
      shape.bezierCurveTo(-0.1, -0.12, -0.1, 0.12, 0.12, 0.29);
      add(new THREE.ExtrudeGeometry(shape, { depth: 0.065, bevelEnabled: true, bevelSize: 0.018, bevelThickness: 0.018, bevelSegments: 2, curveSegments: 24 }), ivory, 0, 0, -0.035);
      line([[-0.13, 0.23, 0.065], [-0.23, 0, 0.065], [-0.13, -0.23, 0.065]], 0.008, gold);
      const star = add(new THREE.ExtrudeGeometry(starShape(0.095, 0.043, 5), { depth: 0.025, bevelEnabled: false }), gold, 0.18, 0.06);
      star.rotation.z = -0.15;
      rod(new THREE.Vector3(0.12, 0.27, 0), new THREE.Vector3(0.18, 0.16, 0), 0.005, gold);
      sparkle(0.18, -0.18, 0, 0.035);
      break;
    }
    case 'planet': {
      orb(0.205, jade);
      const belt = ring(0.29, 0.029, gold); belt.rotation.set(1.12, -0.23, 0.25);
      const inner = ring(0.26, 0.016, ivory); inner.rotation.copy(belt.rotation);
      const seam = ring(0.188, 0.012, light, 0, 0.05); seam.rotation.x = Math.PI / 2;
      orb(0.055, blue, 0.23, 0.22, 0.03);
      sparkle(-0.22, -0.22, 0.015, 0.03);
      break;
    }
    case 'astrolabe': {
      orb(0.087, blue);
      for (const [r, x, y] of [[0.18, 0.6, 0.6], [0.25, -0.45, 0.8], [0.31, 0.15, -0.25]]) {
        const band = ring(r, 0.013, gold); band.rotation.set(x, y, 0.25);
      }
      rod(new THREE.Vector3(0, -0.35, 0), new THREE.Vector3(0, 0.35, 0), 0.012, deep);
      jewel(0.035, rose, 0, 0.36); jewel(0.035, rose, 0, -0.36);
      orb(0.038, ivory, 0.26, 0.12, 0.025);
      break;
    }
    case 'key': {
      ring(0.115, 0.032, gold, 0, 0.19);
      ring(0.068, 0.015, jade, 0, 0.19);
      jewel(0.055, blue, 0, 0.19, 0.025);
      rod(new THREE.Vector3(0, 0.08, 0), new THREE.Vector3(0, -0.29, 0), 0.024, gold);
      add(new THREE.BoxGeometry(0.15, 0.038, 0.045), gold, 0.05, -0.25);
      add(new THREE.BoxGeometry(0.036, 0.07, 0.045), gold, 0.108, -0.22);
      add(new THREE.BoxGeometry(0.036, 0.052, 0.045), gold, 0.05, -0.23);
      ring(0.039, 0.012, rose, 0, -0.03).rotation.x = Math.PI / 2;
      root.rotation.z = -0.3;
      break;
    }
    case 'hourglass': {
      for (const y of [-0.25, 0.25]) {
        add(new THREE.CylinderGeometry(0.17, 0.17, 0.035, 24), gold, 0, y);
        add(new THREE.CylinderGeometry(0.14, 0.14, 0.022, 24), deep, 0, y + Math.sign(y) * 0.025);
      }
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3;
        rod(new THREE.Vector3(Math.sin(a) * 0.14, -0.23, Math.cos(a) * 0.14), new THREE.Vector3(Math.sin(a) * 0.14, 0.23, Math.cos(a) * 0.14), 0.012, gold);
      }
      const profile = [new THREE.Vector2(0.09, -0.22), new THREE.Vector2(0.115, -0.16), new THREE.Vector2(0.075, -0.08), new THREE.Vector2(0.016, 0), new THREE.Vector2(0.075, 0.08), new THREE.Vector2(0.115, 0.16), new THREE.Vector2(0.09, 0.22)];
      add(new THREE.LatheGeometry(profile, 20), glass);
      add(new THREE.ConeGeometry(0.09, 0.12, 20), rose, 0, -0.16);
      const sand = add(new THREE.ConeGeometry(0.083, 0.11, 20), ivory, 0, 0.16); sand.rotation.z = Math.PI;
      rod(new THREE.Vector3(0, -0.09, 0), new THREE.Vector3(0, 0.11, 0), 0.005, ivory);
      break;
    }
    case 'portal': {
      const arch = new THREE.Shape();
      arch.moveTo(-0.21, -0.28); arch.lineTo(-0.21, 0.08); arch.absarc(0, 0.08, 0.21, Math.PI, 0, true); arch.lineTo(0.21, -0.28); arch.lineTo(0.15, -0.28); arch.lineTo(0.15, 0.08); arch.absarc(0, 0.08, 0.15, 0, Math.PI, false); arch.lineTo(-0.15, -0.28); arch.closePath();
      add(new THREE.ExtrudeGeometry(arch, { depth: 0.085, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 16 }), deep, 0, 0, -0.04);
      line([[-0.18, -0.25, 0.065], [-0.18, 0.07, 0.065], [0, 0.26, 0.065], [0.18, 0.07, 0.065], [0.18, -0.25, 0.065]], 0.008, gold);
      add(new THREE.BoxGeometry(0.49, 0.04, 0.18), ivory, 0, -0.3);
      jewel(0.095, blue, 0, 0.025, 0.01).scale.y = 1.5;
      const halo = ring(0.11, 0.007, gold, 0, 0.025, 0.015); halo.rotation.y = 0.45;
      sparkle(0, 0.31, 0.01, 0.03);
      break;
    }
    case 'star': {
      const geometry = new THREE.ExtrudeGeometry(starShape(0.31, 0.145, 5), { depth: 0.07, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.025, bevelSegments: 2 });
      add(geometry, gold, 0, 0, -0.035);
      const center = jewel(0.12, blue, 0, 0, 0.075); center.scale.z = 0.65;
      for (let i = 0; i < 5; i++) {
        const a = Math.PI / 2 + i * Math.PI * 2 / 5;
        orb(0.018, ivory, Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0.063);
      }
      ring(0.045, 0.01, gold, 0, 0.35);
      break;
    }
    case 'world': {
      const island = jewel(0.225, deep, 0, -0.12); island.scale.set(1.1, 0.7, 0.8);
      add(new THREE.CylinderGeometry(0.21, 0.16, 0.045, 9), jade, 0, -0.055);
      rod(new THREE.Vector3(0.02, -0.03, 0), new THREE.Vector3(0.02, 0.18, 0), 0.02, gold);
      orb(0.095, jade, 0.02, 0.2); orb(0.075, light, -0.055, 0.16, 0.01); orb(0.075, deep, 0.09, 0.16, -0.01);
      for (const [x, y, z, r] of [[-0.23, 0.08, 0.01, 0.055], [-0.18, 0.09, 0, 0.065], [-0.13, 0.07, 0.01, 0.045], [0.18, 0.27, -0.06, 0.035], [0.22, 0.26, -0.06, 0.045]]) orb(r, ivory, x, y, z).scale.y = 0.6;
      line([[-0.06, -0.07, 0.16], [-0.08, -0.17, 0.13], [-0.04, -0.25, 0.1]], 0.022, blue);
      jewel(0.03, gold, 0.12, -0.3, 0);
      break;
    }
  }

  // Fit actual geometry, including the rotated rings, into a common core-cell sphere.
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  let radius = 0;
  const point = new THREE.Vector3();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const positions = object.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
      radius = Math.max(radius, point.distanceTo(center));
    }
  });
  const sculpture = new THREE.Group();
  sculpture.name = root.name;
  const scale = 0.44 / Math.max(radius, 0.01);
  root.position.copy(center).multiplyScalar(-scale);
  root.scale.setScalar(scale);
  sculpture.add(root);
  // Materials are per sculpture; release unused palette entries immediately.
  const used = new Set<THREE.Material>();
  root.traverse(object => { if (object instanceof THREE.Mesh) for (const mat of Array.isArray(object.material) ? object.material : [object.material]) used.add(mat); });
  for (const mat of [jade, deep, gold, ivory, blue, rose, light, glass]) if (!used.has(mat)) mat.dispose();
  return sculpture;
}

/** Relics own their geometry/materials and may be discarded independently. */
export function disposeRelic(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
}
