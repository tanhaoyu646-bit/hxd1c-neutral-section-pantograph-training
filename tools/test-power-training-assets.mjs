import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createCandidateAttempt, normalizeCandidate, validateCandidate } from '../scripts/powerTrainingCandidate.js';

const scenePath = new URL('../assets/msts-neiyi-corridor/power-training-scene.json', import.meta.url);
const pathPath = new URL('../assets/msts-neiyi/power-training-path.json', import.meta.url);
const terrainPath = new URL('../assets/msts-neiyi-corridor/power-training-terrain-129.json', import.meta.url);
const [scene, route, terrain] = await Promise.all([
  readFile(scenePath, 'utf8').then(JSON.parse),
  readFile(pathPath, 'utf8').then(JSON.parse),
  readFile(terrainPath, 'utf8').then(JSON.parse),
]);

assert(scene.instances.length > 100);
assert(scene.instances.length < Number(scene.summary.sourceInstanceCount));
assert(Object.keys(scene.shapes).length < Number(scene.summary.sourceShapeCount));
assert.equal(route.source.preAligned, true);
assert(Number(route.summary.pathLength) > 9000 && Number(route.summary.pathLength) < 9400);
assert.equal(terrain.tiles.length, 8);
assert(terrain.tiles.every((tile) => tile.resolution === 129 && tile.heights.length === 129 * 129));

const [sceneSize, terrainSize] = await Promise.all([stat(scenePath), stat(terrainPath)]);
assert(sceneSize.size < 2_500_000);
assert(terrainSize.size < 1_500_000);

assert.deepEqual(normalizeCandidate({ name: '  张   三 ', studentId: ' 2026-001 ' }), { name: '张 三', studentId: '2026-001' });
assert.equal(validateCandidate({ name: '张三', studentId: '20260001' }).valid, true);
assert.equal(validateCandidate({ name: '<script>', studentId: '1' }).valid, false);
const attempt = createCandidateAttempt({ name: '李四', studentId: 'ABCD-1234' }, new Date('2026-10-26T00:00:00.000Z'));
assert.equal(attempt.name, '李四');
assert.equal(attempt.startedAt, '2026-10-26T00:00:00.000Z');

console.log('power training candidate and optimized asset tests passed');
