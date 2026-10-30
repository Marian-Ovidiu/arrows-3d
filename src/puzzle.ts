export type Vec3 = [number, number, number];

export interface Piece {
  id: string;
  position: Vec3;
  direction: Vec3;
  color: number;
}

export interface Level {
  id: number;
  name: string;
  subtitle: string;
  artifact: string;
  pieces: Piece[];
}

const AXES: Vec3[] = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0],
  [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

/** Positive center-to-center distance on an axis ray; Infinity means off-ray. */
function rayDistance(origin: Vec3, direction: Vec3, target: Vec3): number {
  const axis = direction.findIndex((component) => component !== 0);
  if (axis < 0) return Infinity;
  for (let index = 0; index < 3; index++) {
    if (index !== axis && origin[index] !== target[index]) return Infinity;
  }
  const distance = (target[axis] - origin[axis]) * direction[axis];
  return distance > 0 ? distance : Infinity;
}

/**
 * Test the complete infinite exit ray, including the permanent central core.
 * Distance is measured between cell centers (1 for adjacent cells), NOT the
 * available physical movement of a cube. A clear ray has Infinity.
 */
export function getExit(
  piece: Piece,
  remaining: readonly Piece[],
): { free: boolean; blockerId: string | null; distance: number } {
  let distance = rayDistance(piece.position, piece.direction, [0, 0, 0]);
  let blockerId: string | null = Number.isFinite(distance) ? 'core' : null;
  for (const other of remaining) {
    if (other.id === piece.id) continue;
    const candidate = rayDistance(piece.position, piece.direction, other.position);
    if (candidate < distance) {
      distance = candidate;
      blockerId = other.id;
    }
  }
  return { free: blockerId === null, blockerId, distance };
}

export function getAvailable(remaining: readonly Piece[]): Piece[] {
  return remaining.filter((piece) => getExit(piece, remaining).free);
}

/** Removal only clears rays, so any legal greedy order succeeds if solvable. */
export function solve(pieces: readonly Piece[]): string[] | null {
  let remaining = [...pieces];
  const order: string[] = [];
  while (remaining.length > 0) {
    const available = getAvailable(remaining);
    if (available.length === 0) return null;
    const removed = new Set(available.map((piece) => piece.id));
    order.push(...removed);
    remaining = remaining.filter((piece) => !removed.has(piece.id));
  }
  return order;
}

function positions(radius: number, include: (x: number, y: number, z: number) => boolean): Vec3[] {
  const cells: Vec3[] = [];
  for (let x = -radius; x <= radius; x++) {
    for (let y = -radius; y <= radius; y++) {
      for (let z = -radius; z <= radius; z++) {
        if ((x || y || z) && include(x, y, z)) cells.push([x, y, z]);
      }
    }
  }
  return cells;
}

/**
 * Assign arrows while peeling the shape. Each assigned arrow is clear at its
 * removal step, providing a construction proof of solvability. Prefer arrows
 * passing through already peeled cells to create interlocking initial rays.
 */
function buildLevel(id: number, name: string, subtitle: string, artifact: string, cells: Vec3[]): Level {
  const pieces: Piece[] = cells.map((position, index) => ({
    id: `${id}-${index}`,
    position,
    direction: [1, 0, 0],
    color: (index * 3 + id) % 5,
  }));
  const pending = new Set(pieces);
  let step = 0;
  while (pending.size) {
    let best: { piece: Piece; direction: Vec3; score: number } | null = null;
    for (const piece of pending) {
      for (let axis = 0; axis < AXES.length; axis++) {
        const direction = AXES[axis];
        if (Number.isFinite(rayDistance(piece.position, direction, [0, 0, 0]))) continue;
        if ([...pending].some((other) => other !== piece && Number.isFinite(rayDistance(piece.position, direction, other.position)))) continue;
        const blockers = pieces.filter((other) => other !== piece && Number.isFinite(rayDistance(piece.position, direction, other.position))).length;
        const index = pieces.indexOf(piece);
        // Stable integer tie-breaker changes the corridors across the levels.
        const tie = ((index * 73 + axis * 47 + step * 29 + id * 17) % 101) / 101;
        const score = blockers * 10 + tie;
        if (!best || score > best.score) best = { piece, direction, score };
      }
    }
    if (!best) throw new Error(`Cannot peel level ${id}`);
    best.piece.direction = [...best.direction];
    pending.delete(best.piece);
    step++;
  }
  return { id, name, subtitle, artifact, pieces };
}

export const LEVELS: Level[] = [
  buildLevel(1, 'Primo contatto', 'Libera il nucleo, una freccia alla volta.', 'Seme di luce',
    positions(1, () => true)),
  buildLevel(2, 'Orbita incrociata', 'Segui le direzioni tra bracci e incastri.', 'Cristallo orbitale',
    positions(2, (x, y, z) => Math.abs(x) + Math.abs(y) + Math.abs(z) <= 3)),
  buildLevel(3, 'Cuore della stella', 'Trova i varchi nella costellazione.', 'Stella prismatica',
    positions(2, (x, y, z) => x * x + y * y + z * z <= 6)),
  // Appended to preserve existing saved indexes and piece IDs. Shown first in UI.
  { id: 0, name: 'Primi passi', subtitle: 'Quattro cubi, una piccola scoperta.', artifact: 'La prima scintilla', pieces: [
    { id: 'intro-first', position: [0, -1, 1], direction: [1, 0, 0], color: 2 },
    { id: 'intro-blocked', position: [-1, 0, 1], direction: [1, 0, 0], color: 0 },
    { id: 'intro-blocker', position: [1, 0, 1], direction: [0, 1, 0], color: 1 },
    { id: 'intro-last', position: [0, 1, 0], direction: [0, 1, 0], color: 3 },
  ] },
];

export const TUTORIAL_INDEX = 3;
