import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildRailAlignedPath, cumulativePathDistances } from '../scripts/railAlignedPath.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
const writeJson = async (relativePath, value) => {
  const content = `${JSON.stringify(value)}\n`;
  await writeFile(path.join(root, relativePath), content, 'utf8');
  return Buffer.byteLength(content);
};

const SCENE_END_DISTANCE = 6500;
const RAIL_END_DISTANCE = 9300;
const MAX_LATERAL_DISTANCE = 450;
const SUPPRESSED_POWER_SHAPES = /^(?:duan|jinzhi-shuanggong|quxianbiao|qiaoliangbiao)\.s$/i;

const [scene, route, terrain] = await Promise.all([
  readJson('assets/msts-neiyi-corridor/neiyi-lookout-full-scene.json'),
  readJson('assets/msts-neiyi/neiyi-5635-trackdb-path.json'),
  readJson('assets/msts-neiyi-corridor/neiyi-lookout-terrain-native.json'),
]);

const alignedPoints = buildRailAlignedPath(route.positions, scene.instances, { spacing: 5 });
const distances = cumulativePathDistances(alignedPoints);

function projectToPath(position, maximumDistance = SCENE_END_DISTANCE) {
  let best = null;
  for (let index = 1; index < alignedPoints.length; index += 1) {
    if (distances[index - 1] > maximumDistance) break;
    const start = alignedPoints[index - 1];
    const end = alignedPoints[index];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const dz = end[2] - start[2];
    const lengthSquared = dx * dx + dy * dy + dz * dz;
    if (lengthSquared < 1e-7) continue;
    const ox = position[0] - start[0];
    const oy = position[1] - start[1];
    const oz = position[2] - start[2];
    const ratio = Math.max(0, Math.min(1, (ox * dx + oy * dy + oz * dz) / lengthSquared));
    const px = start[0] + dx * ratio;
    const py = start[1] + dy * ratio;
    const pz = start[2] + dz * ratio;
    const lateralDistance = Math.hypot(position[0] - px, position[1] - py, position[2] - pz);
    if (!best || lateralDistance < best.lateralDistance) {
      best = {
        alongDistance: distances[index - 1] + Math.sqrt(lengthSquared) * ratio,
        lateralDistance,
      };
    }
  }
  return best;
}

const keptInstances = [];
for (const instance of scene.instances) {
  const projection = projectToPath(instance.position);
  if (!projection || projection.alongDistance > SCENE_END_DISTANCE || projection.lateralDistance > MAX_LATERAL_DISTANCE) continue;
  if (instance.type === 'SignalObj' || SUPPRESSED_POWER_SHAPES.test(instance.shape || '')) continue;
  if (instance.type === 'TrackObj' && /^A\d+t/i.test(instance.shape || '') && projection.lateralDistance < 4.2) continue;
  keptInstances.push(instance);
}

const referencedShapes = new Set(keptInstances.map((instance) => instance.shape));
const keptShapes = Object.fromEntries(Object.entries(scene.shapes).filter(([, shape]) => referencedShapes.has(shape.fileName)));
const powerScene = {
  ...scene,
  format: `${scene.format || 'msts-scene'}-power-training`,
  source: { ...scene.source, derivedFrom: 'neiyi-lookout-full-scene.json', maximumDistance: SCENE_END_DISTANCE },
  summary: {
    ...scene.summary,
    sourceInstanceCount: scene.instances.length,
    instanceCount: keptInstances.length,
    sourceShapeCount: Object.keys(scene.shapes).length,
    shapeCount: Object.keys(keptShapes).length,
    maximumDistance: SCENE_END_DISTANCE,
  },
  shapes: keptShapes,
  instances: keptInstances,
};

let lastPathIndex = distances.findIndex((distance) => distance > RAIL_END_DISTANCE);
if (lastPathIndex < 0) lastPathIndex = alignedPoints.length - 1;
const powerPathPoints = alignedPoints.slice(0, Math.min(alignedPoints.length, lastPathIndex + 1));
const powerPathDistances = cumulativePathDistances(powerPathPoints);
const powerPath = {
  ...route,
  format: `${route.format || 'trackdb-path'}-power-training`,
  source: { ...route.source, preAligned: true, derivedFrom: 'neiyi-5635-trackdb-path.json' },
  summary: {
    ...route.summary,
    pointCount: powerPathPoints.length,
    pathLength: powerPathDistances.at(-1),
    maximumDistance: RAIL_END_DISTANCE,
  },
  positions: powerPathPoints.flat(),
};

function downsampleTile(tile) {
  const sourceResolution = Number(tile.resolution);
  const step = sourceResolution >= 257 ? 2 : 1;
  if (step === 1) return tile;
  const targetResolution = Math.floor((sourceResolution - 1) / step) + 1;
  const heights = [];
  for (let row = 0; row < targetResolution; row += 1) {
    const sourceRow = Math.min(sourceResolution - 1, row * step);
    for (let column = 0; column < targetResolution; column += 1) {
      const sourceColumn = Math.min(sourceResolution - 1, column * step);
      heights.push(tile.heights[sourceRow * sourceResolution + sourceColumn]);
    }
  }
  return { ...tile, resolution: targetResolution, heights };
}

const powerTerrainTiles = terrain.tiles.map(downsampleTile);
const powerTerrain = {
  ...terrain,
  format: `${terrain.format || 'msts-terrain'}-power-training`,
  source: { ...terrain.source, derivedFrom: 'neiyi-lookout-terrain-native.json', downsampleStep: 2 },
  summary: {
    ...terrain.summary,
    resolution: powerTerrainTiles[0]?.resolution || terrain.summary?.resolution,
    sourceResolution: terrain.tiles[0]?.resolution,
    heightSampleCount: powerTerrainTiles.reduce((sum, tile) => sum + tile.heights.length, 0),
  },
  tiles: powerTerrainTiles,
};

const outputs = await Promise.all([
  writeJson('assets/msts-neiyi-corridor/power-training-scene.json', powerScene),
  writeJson('assets/msts-neiyi/power-training-path.json', powerPath),
  writeJson('assets/msts-neiyi-corridor/power-training-terrain-129.json', powerTerrain),
]);

console.log(JSON.stringify({
  scene: { instances: keptInstances.length, shapes: Object.keys(keptShapes).length, bytes: outputs[0] },
  path: { points: powerPathPoints.length, length: powerPathDistances.at(-1), bytes: outputs[1] },
  terrain: { tiles: powerTerrainTiles.length, resolution: powerTerrainTiles[0]?.resolution, samples: powerTerrain.summary.heightSampleCount, bytes: outputs[2] },
}, null, 2));
