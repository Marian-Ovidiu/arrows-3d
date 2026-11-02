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
  const leaf = (x: number, y: number, z: number, size: number, angle: number, mat: THREE.Material = jade) => {
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
  const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  const lathe = (profile: number[][], mat: THREE.Material, y = 0) => add(new THREE.LatheGeometry(profile.map(([r, height]) => new THREE.Vector2(r, height)), 24), mat, 0, y);
  const silhouette = (points: number[][], mat: THREE.Material, depth = .055) => {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    shape.closePath();
    return add(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 1 }), mat, 0, 0, -depth / 2);
  };
  const wings = (mat: THREE.Material, y = .08) => {
    for (const direction of [-1, 1]) for (let i = 0; i < 4; i++) {
      leaf(direction * (.045 + i * .055), y - i * .035, -.04, .27 - i * .018, -direction * (.8 + i * .16), mat);
    }
  };

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
    case 'bell': {
      lathe([[.15,-.17],[.2,-.15],[.13,-.09],[.11,.12],[.05,.19],[0,.2]], gold);
      ring(.04,.014,deep,0,.24); orb(.035,rose,0,-.19);
      ring(.175,.013,ivory,0,-.15).rotation.x = Math.PI / 2;
      break;
    }
    case 'feather': {
      line([[-.12,-.3,0],[0,0,0],[.13,.3,0]],.012,gold);
      for (let i=0;i<7;i++) for(const d of [-1,1]) {
        const y=-.2+i*.062, taper=Math.sin((i+1)/8*Math.PI);
        leaf(y*.4,y,0,.18*taper,d*.95, i%2 ? blue : ivory);
      }
      break;
    }
    case 'flower': {
      rod(new THREE.Vector3(0,-.3,0),new THREE.Vector3(0,.06,0),.016,deep);
      leaf(0,-.22,0,.2,-1); leaf(0,-.12,0,.16,.9);
      for(let i=0;i<7;i++) { const a=i*Math.PI*2/7; const petal=orb(.095,rose,Math.cos(a)*.13,.13+Math.sin(a)*.13,0); petal.scale.set(.78,1,.4); petal.rotation.z=a-Math.PI/2; }
      orb(.065,gold,0,.13,.05); sparkle(0,.13,.11,.025);
      break;
    }
    case 'lantern': {
      for(const y of [-.2,.18]) add(new THREE.CylinderGeometry(.13,.16,.045,6),gold,0,y);
      const glow=jewel(.13,light); glow.scale.set(.65,1.25,.65);
      for(let i=0;i<6;i++){const a=i*Math.PI/3;rod(new THREE.Vector3(Math.cos(a)*.13,-.18,Math.sin(a)*.13),new THREE.Vector3(Math.cos(a)*.13,.16,Math.sin(a)*.13),.011,deep);}
      add(new THREE.ConeGeometry(.17,.1,6),jade,0,.24); ring(.065,.012,gold,0,.34);
      break;
    }
    case 'nest': {
      for(let i=0;i<6;i++){const r=ring(.18+i*.008,.018,i%2?gold:deep,0,-.12+i*.022);r.rotation.set(Math.PI/2,.08*i,.05*i);}
      for(const x of [-.075,.05]){const egg=orb(.075,ivory,x,-.025,.015);egg.scale.set(.8,1.25,.8);}
      leaf(-.2,-.15,0,.16,.8); leaf(.15,-.16,0,.14,-.9);
      break;
    }
    case 'ember': {
      silhouette([[-.16,-.18],[-.2,-.05],[-.08,.12],[-.02,.32],[.08,.17],[.08,.04],[.17,.15],[.21,-.07],[.12,-.22],[0,-.25]],rose,.12);
      silhouette([[-.07,-.18],[-.08,-.07],[.02,.1],[.1,-.08],[.055,-.2]],gold,.14);
      const coal=jewel(.13,deep,0,-.24);coal.scale.set(1.4,.45,.8); sparkle(-.19,.2,0,.02);
      break;
    }
    case 'hammer': {
      box(.045,.48,.055,deep,0,-.055); for(const y of [-.23,-.18,-.13])ring(.034,.008,gold,0,y).rotation.x=Math.PI/2;
      box(.34,.14,.15,gold,0,.2); box(.07,.18,.18,ivory,-.17,.2); jewel(.055,blue,.12,.2,.085);
      root.rotation.z=-.35; break;
    }
    case 'anvil': {
      silhouette([[-.22,.17],[.14,.17],[.28,.1],[.13,.05],[.08,-.1],[.17,-.19],[-.17,-.19],[-.08,-.1],[-.13,.04],[-.22,.04]],deep,.21);
      box(.35,.035,.23,gold,-.04,.19); box(.35,.04,.26,gold,0,-.22); jewel(.045,rose,-.04,.065,.12);
      break;
    }
    case 'gear': {
      ring(.19,.05,gold);ring(.09,.014,deep);for(let i=0;i<10;i++){const a=i*Math.PI/5;box(.065,.085,.07,gold,Math.sin(a)*.25,Math.cos(a)*.25).rotation.z=-a;}
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;rod(new THREE.Vector3(Math.cos(a)*.08,Math.sin(a)*.08,0),new THREE.Vector3(Math.cos(a)*.16,Math.sin(a)*.16,0),.013,deep);}
      jewel(.055,rose,0,0,.035); break;
    }
    case 'phoenix': {
      wings(rose); const body=orb(.09,gold,0,-.015);body.scale.set(.7,1.7,.7);
      orb(.065,ivory,0,.18,.025); silhouette([[.02,.18],[.115,.16],[.03,.13]],gold);
      for(const d of [-1,0,1])line([[0,-.1,0],[d*.07,-.22,.025],[d*.13,-.35,0]],.023,d===0?gold:rose);
      leaf(-.015,.22,0,.13,-.25,rose); break;
    }
    case 'mirror': {
      const frame=ring(.19,.027,gold,0,.09);frame.scale.set(.82,1.2,1);
      const face=coin(.17,.025,blue,0,.09);face.scale.set(.82,1.2,1);
      rod(new THREE.Vector3(0,-.13,0),new THREE.Vector3(0,-.32,0),.026,ivory);
      line([[-.07,.06,.025],[.02,.17,.025]],.008,light); jewel(.045,rose,0,-.34); break;
    }
    case 'mask': {
      const face=orb(.22,ivory,0,0);face.scale.set(.9,1.2,.36);
      for(const x of [-.085,.085]){const eye=orb(.043,deep,x,.05,.072);eye.scale.set(1.3,.6,.45);line([[x-.045,.115,.065],[x,.13,.08],[x+.04,.105,.065]],.009,gold);}
      jewel(.04,gold,0,-.015,.105).scale.set(.55,1.6,.6);
      line([[-.06,-.13,.065],[0,-.105,.085],[.06,-.13,.065]],.012,rose);
      for(const d of [-1,1])leaf(d*.15,.12,-.01,.18,-d*.6,jade); break;
    }
    case 'crown': {
      lathe([[.19,-.13],[.19,.03],[.17,.03],[.17,-.13]],gold);
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5; const tip=jewel(.07,gold,Math.sin(a)*.18,.1,Math.cos(a)*.18);tip.scale.y=1.7;orb(.027,rose,Math.sin(a)*.18,.2,Math.cos(a)*.18);}
      ring(.19,.014,ivory,0,-.1).rotation.x=Math.PI/2; jewel(.05,blue,0,-.025,.2);break;
    }
    case 'prism': {
      add(new THREE.CylinderGeometry(.18,.18,.42,3),blue).rotation.y=.3;
      for(const y of [-.21,.21])ring(.17,.012,gold,0,y).rotation.x=Math.PI/2;
      for(let i=0;i<3;i++){const beam=box(.2,.018,.02,[rose,gold,jade][i],.22,.08-i*.08,.02);beam.rotation.z=-.2+i*.2;}
      sparkle(-.2,.2,0,.03);break;
    }
    case 'castle': {
      box(.3,.25,.18,ivory,0,-.13);box(.09,.14,.025,deep,0,-.19,.1);
      for(const x of [-.19,.19]){add(new THREE.CylinderGeometry(.075,.085,.37,10),jade,x,-.025);add(new THREE.ConeGeometry(.11,.17,10),blue,x,.24);box(.025,.07,.015,gold,x,.075,.075);}
      for(const x of [-.1,0,.1])box(.05,.06,.18,gold,x,.025); jewel(.03,rose,0,.1);break;
    }
    case 'pearl': {
      const shell=orb(.22,rose,0,-.11);shell.scale.set(1,.35,.8);
      for(let i=0;i<7;i++){const a=(i-3)*.28;line([[0,-.12,.08],[Math.sin(a)*.16,-.05,.12],[Math.sin(a)*.22,-.09,0]],.008,gold);}
      orb(.12,ivory,0,.025,.015);ring(.15,.008,blue,0,-.1).rotation.x=Math.PI/2;sparkle(.18,.17,0,.035);break;
    }
    case 'coral': {
      const branches=[[[0,-.25,0],[-.02,.02,0],[-.13,.24,0]],[[0,-.1,0],[.12,.02,0],[.18,.2,.02]],[[-.04,.04,0],[-.2,.07,0],[-.24,.17,0]],[[.11,0,0],[.23,-.02,0],[.26,.06,0]],[[0,-.15,0],[-.16,-.09,.06],[-.2,.01,.06]]];
      branches.forEach((points,i)=>{line(points,.025,i%2?gold:rose);const [x,y,z]=points[2];orb(.033,ivory,x,y,z);});
      jewel(.1,blue,0,-.26).scale.set(1.6,.5,.8);break;
    }
    case 'shell': {
      const shape=new THREE.Shape();shape.moveTo(0,-.22);shape.bezierCurveTo(-.4,-.05,-.3,.27,0,.28);shape.bezierCurveTo(.3,.27,.4,-.05,0,-.22);
      add(new THREE.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:true,bevelSize:.018,bevelThickness:.018,bevelSegments:2,curveSegments:16}),ivory,0,0,-.03);
      for(let i=-2;i<=2;i++)line([[0,-.19,.06],[i*.07,.02,.065],[i*.09,.22-Math.abs(i)*.03,.06]],.009,rose);
      ring(.055,.012,gold,0,-.22);break;
    }
    case 'jellyfish': {
      add(new THREE.SphereGeometry(.21,20,10,0,Math.PI*2,0,Math.PI/2),blue,0,.06).scale.y=.8;
      ring(.2,.017,ivory,0,.06).rotation.x=Math.PI/2;
      for(let i=0;i<6;i++){const x=(i-2.5)*.058;line([[x,.06,0],[x+.035,-.09,.025],[x-.015,-.26-i%2*.05,0]],.012,i%2?light:gold);}
      jewel(.045,light,0,.18,.13);break;
    }
    case 'leviathan': {
      line([[-.21,-.22,0],[-.23,-.04,0],[-.02,.0,0],[.18,.13,0],[.1,.25,0]],.065,blue);
      const head=orb(.09,jade,.08,.22);head.scale.set(1.4,.8,.8);orb(.018,deep,.1,.245,.068);
      for(let i=0;i<5;i++)jewel(.035,gold,-.18+i*.08,-.025+i*.025,.025).scale.y=1.5;
      leaf(-.21,-.2,0,.16,2.4,light);leaf(.03,.13,-.01,.17,-1.4,light);break;
    }
    case 'anchor': {
      ring(.06,.018,gold,0,.25);rod(new THREE.Vector3(0,.19,0),new THREE.Vector3(0,-.22,0),.023,deep);
      box(.3,.035,.05,gold,0,.08);line([[-.23,-.08,0],[-.16,-.24,0],[0,-.28,0],[.16,-.24,0],[.23,-.08,0]],.026,deep);
      for(const d of [-1,1])silhouette([[d*.23,-.06],[d*.13,-.13],[d*.25,-.17]],gold);break;
    }
    case 'wave': {
      const shape=new THREE.Shape();shape.moveTo(-.3,-.18);shape.bezierCurveTo(-.05,-.16,-.17,.2,.07,.25);shape.bezierCurveTo(.29,.31,.34,.06,.13,.04);shape.bezierCurveTo(.22,.16,.08,.2,.06,.04);shape.bezierCurveTo(.03,-.08,.17,-.15,.3,-.18);shape.closePath();
      add(new THREE.ExtrudeGeometry(shape,{depth:.1,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:1,curveSegments:18}),blue);
      line([[-.22,-.17,.12],[-.08,-.11,.12],[-.02,.08,.12],[.08,.22,.12]],.013,ivory);for(const x of [.17,.24])orb(.027,ivory,x,.22-x*.3,.03);break;
    }
    case 'ship': {
      silhouette([[-.28,-.1],[.26,-.1],[.16,-.24],[-.17,-.24]],deep,.18);
      rod(new THREE.Vector3(0,-.1,0),new THREE.Vector3(0,.31,0),.014,gold);
      silhouette([[-.02,.26],[-.02,-.04],[-.22,-.04]],ivory);silhouette([[.025,.23],[.025,-.04],[.22,-.04]],jade);
      line([[-.27,-.12,.1],[0,-.16,.1],[.24,-.12,.1]],.009,gold);break;
    }
    case 'conch': {
      const points=[];for(let i=0;i<=36;i++){const a=i/36*Math.PI*4,r=.018+i/36*.17;points.push([Math.cos(a)*r,Math.sin(a)*r+.04,i/36*.035]);}
      line(points,.038,rose);add(new THREE.ConeGeometry(.1,.23,16),ivory,.1,-.16).rotation.z=.7;
      ring(.07,.015,gold,.14,-.2,.025).rotation.z=.7; sparkle(-.16,.21,.03,.025);break;
    }
    case 'trident': {
      rod(new THREE.Vector3(0,-.32,0),new THREE.Vector3(0,.29,0),.018,gold);
      line([[-.18,.26,0],[-.18,.03,0],[0,-.04,0],[.18,.03,0],[.18,.26,0]],.019,blue);
      for(const x of [-.18,0,.18])add(new THREE.ConeGeometry(.045,.12,4),gold,x,.3);
      jewel(.05,blue,0,-.12,.025);ring(.035,.009,ivory,0,-.25).rotation.x=Math.PI/2;break;
    }
    case 'flute': {
      add(new THREE.CylinderGeometry(.035,.035,.58,16),ivory);for(const y of [-.27,.2,.27])ring(.037,.009,gold,0,y).rotation.x=Math.PI/2;
      for(let i=0;i<5;i++)orb(.014,deep,0,-.15+i*.065,.033).scale.z=.3;
      box(.07,.03,.045,gold,.015,.28);root.rotation.z=-.5;break;
    }
    case 'kite': {
      silhouette([[0,.3],[-.19,.04],[0,-.19],[.19,.04]],jade,.025);
      rod(new THREE.Vector3(0,-.19,.028),new THREE.Vector3(0,.3,.028),.008,gold);rod(new THREE.Vector3(-.19,.04,.028),new THREE.Vector3(.19,.04,.028),.008,ivory);
      line([[0,-.19,0],[.08,-.28,0],[-.04,-.36,0]],.008,gold);
      for(const x of [-1,1])silhouette([[.08,-.27],[.08+x*.06,-.24],[.08+x*.06,-.3]],rose,.02);break;
    }
    case 'chime': {
      ring(.17,.02,gold,0,.19).rotation.x=Math.PI/2;
      for(let i=0;i<5;i++){const x=(i-2)*.075,y=-.08+Math.abs(i-2)*.025;rod(new THREE.Vector3(x,.19,0),new THREE.Vector3(x,.03,0),.004,deep);add(new THREE.CylinderGeometry(.017,.017,.23-Math.abs(i-2)*.035,8),i%2?blue:ivory,x,y);}
      rod(new THREE.Vector3(0,.2,0),new THREE.Vector3(0,.32,0),.009,gold);jewel(.04,rose,0,-.28);break;
    }
    case 'fanfare': {
      lathe([[.025,-.25],[.027,.0],[.05,.13],[.14,.24],[.15,.25]],gold);
      ring(.145,.012,ivory,0,.24).rotation.x=Math.PI/2;
      line([[.025,-.16,0],[.16,-.14,0],[.16,.04,0],[.045,.06,0]],.017,deep);
      silhouette([[-.025,.03],[-.19,.03],[-.19,-.2],[-.1,-.16],[-.025,-.2]],blue,.02);jewel(.03,gold,-.11,-.07,.025);root.rotation.z=-.4;break;
    }
    case 'griffin': {
      wings(ivory,.06);const body=orb(.12,jade,0,-.08);body.scale.set(.85,1,.7);
      orb(.07,ivory,0,.14);silhouette([[.02,.17],[.13,.12],[.02,.1]],gold);
      for(const d of [-1,1]){rod(new THREE.Vector3(d*.055,-.12,0),new THREE.Vector3(d*.09,-.25,.04),.02,gold);box(.09,.025,.08,gold,d*.09,-.25,.06);}
      line([[.04,-.14,-.05],[.23,-.19,-.07],[.25,-.04,0]],.015,deep);jewel(.035,gold,0,.23);break;
    }
    case 'rune': {
      const slab=jewel(.27,deep);slab.scale.set(.75,1.2,.4);
      const points=[[-.09,-.17,.1],[-.09,.17,.1],[.11,.06,.1],[-.09,-.025,.1],[.1,-.17,.1]];
      for(let i=1;i<points.length;i++)rod(new THREE.Vector3(...points[i-1]),new THREE.Vector3(...points[i]),.014,gold);
      sparkle(0,.27,.04,.035); break;
    }
    case 'eye': {
      const shape=new THREE.Shape();shape.moveTo(-.29,0);shape.quadraticCurveTo(0,.29,.29,0);shape.quadraticCurveTo(0,-.29,-.29,0);
      add(new THREE.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:2}),ivory);
      coin(.11,.065,blue,0,0,.035);coin(.047,.075,deep,0,0,.045);orb(.022,light,-.025,.035,.09);
      for(const x of [-.18,0,.18])rod(new THREE.Vector3(x,.14-Math.abs(x)*.35,0),new THREE.Vector3(x*1.2,.24-Math.abs(x)*.35,0),.009,gold);break;
    }
    case 'chalice': {
      lathe([[0,-.25],[.14,-.25],[.15,-.22],[.04,-.18],[.025,-.03],[.14,.05],[.18,.23],[.16,.23],[.12,.07],[.02,-.02]],gold);
      for(const d of [-1,1])line([[d*.14,.17,0],[d*.25,.15,0],[d*.22,-.01,0],[d*.08,-.04,0]],.017,ivory);
      jewel(.055,blue,0,.1,.15);ring(.14,.008,jade,0,-.23).rotation.x=Math.PI/2;break;
    }
    case 'infinity': {
      const points=[];for(let i=0;i<=80;i++){const t=i/80*Math.PI*2;points.push([.29*Math.cos(t),.16*Math.sin(2*t),.045*Math.sin(t)]);}
      line(points,.031,gold);jewel(.06,blue,-.25,0,0);jewel(.06,rose,.25,0,0);sparkle(0,.25,0,.03);sparkle(0,-.25,0,.03);break;
    }
    case 'heart': {
      const shape=new THREE.Shape();shape.moveTo(0,-.26);shape.bezierCurveTo(-.46,.02,-.19,.36,0,.17);shape.bezierCurveTo(.19,.36,.46,.02,0,-.26);
      add(new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:3,curveSegments:18}),rose,0,0,-.06);
      const orbit=ring(.31,.012,gold);orbit.rotation.set(.55,.3,-.3);jewel(.06,light,0,.01,.13);sparkle(.21,.23,0,.03);break;
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
  const bounds = new THREE.Box3().setFromObject(root);
  const center = bounds.getCenter(new THREE.Vector3());
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
