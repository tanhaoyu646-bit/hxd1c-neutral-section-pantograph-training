import * as THREE from '../lib/three/three.module.js';
import { MstsRouteScene } from './mstsRouteScene.js';
import { POWER_TRAINING_CONFIG } from './powerTrainingConfig.js';

const POWER_SIGN_ASSET_URLS = Object.freeze({
  duan: new URL('../assets/power-signs/duan.json', import.meta.url).href,
  he: new URL('../assets/power-signs/he.json', import.meta.url).href,
  'jinzhi-shuanggong': new URL('../assets/power-signs/jinzhi-shuanggong.json', import.meta.url).href,
  'k-jinzhi-shuanggong': new URL('../assets/power-signs/k-jinzhi-shuanggong.json', import.meta.url).href,
  jiang: new URL('../assets/power-signs/jiang.json', import.meta.url).href,
  sheng: new URL('../assets/power-signs/sheng.json', import.meta.url).href,
  'zhunbei-jianggong': new URL('../assets/power-signs/zhunbei-jianggong.json', import.meta.url).href,
  'k-zhunbei-jianggong': new URL('../assets/power-signs/k-zhunbei-jianggong.json', import.meta.url).href,
  'yugaobiao-1': new URL('../assets/power-signs/yugaobiao-1.json', import.meta.url).href,
  'yugaobiao-2': new URL('../assets/power-signs/yugaobiao-2.json', import.meta.url).href,
  'yugaobiao-3': new URL('../assets/power-signs/yugaobiao-3.json', import.meta.url).href,
});

async function loadPowerSignAssets() {
  return Object.fromEntries(await Promise.all(Object.entries(POWER_SIGN_ASSET_URLS).map(async ([id, url]) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`原游戏线路标志加载失败：${id}（HTTP ${response.status}）`);
    return [id, await response.json()];
  })));
}

function canvasTexture(text, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const context = canvas.getContext('2d');
  context.fillStyle = options.background || '#f7f4df';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.lineWidth = 18;
  context.strokeStyle = options.border || '#161616';
  context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  context.fillStyle = options.color || '#111';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `900 ${options.fontSize || 122}px "Microsoft YaHei", sans-serif`;
  const lines = String(text).split('\n');
  const lineHeight = options.lineHeight || 122;
  lines.forEach((line, index) => {
    context.fillText(line, canvas.width / 2, canvas.height / 2 + (index - (lines.length - 1) / 2) * lineHeight);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeBoard(frontText, backText = frontText, options = {}) {
  const root = new THREE.Group();
  const width = options.width || 1.45;
  const height = options.height || 0.9;
  const frontMaterial = new THREE.MeshStandardMaterial({
    map: canvasTexture(frontText, options),
    roughness: 0.8,
    side: THREE.FrontSide,
  });
  const backMaterial = new THREE.MeshStandardMaterial({
    map: canvasTexture(backText, options),
    roughness: 0.8,
    side: THREE.FrontSide,
  });
  const geometry = new THREE.PlaneGeometry(width, height);
  const front = new THREE.Mesh(geometry, frontMaterial);
  front.position.set(0, 2.75, -0.025);
  front.rotation.y = Math.PI;
  const back = new THREE.Mesh(geometry, backMaterial);
  back.position.set(0, 2.75, 0.025);
  root.add(front, back);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.065, 2.55, 10),
    new THREE.MeshStandardMaterial({ color: '#70777a', roughness: 0.7, metalness: 0.55 }),
  );
  pole.position.y = 1.3;
  root.add(pole);
  return root;
}

function makeDiamondBoard() {
  const root = new THREE.Group();
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, 512, 512);
  context.fillStyle = '#f4f4f2';
  context.strokeStyle = '#111';
  context.lineWidth = 22;
  context.beginPath();
  context.moveTo(256, 28);
  context.lineTo(484, 256);
  context.lineTo(256, 484);
  context.lineTo(28, 256);
  context.closePath();
  context.fill();
  context.stroke();
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '900 150px "Microsoft YaHei", sans-serif';
  context.fillStyle = '#bd1420';
  context.fillText('T', 198, 255);
  context.fillStyle = '#111';
  context.fillText('断', 322, 255);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.08,
    roughness: 0.82,
    side: THREE.DoubleSide,
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), material);
  board.position.y = 2.42;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.045, 2.12, 8),
    new THREE.MeshStandardMaterial({ color: '#777d80', roughness: 0.72, metalness: 0.42 }),
  );
  pole.position.y = 1.02;
  root.add(board, pole);
  return root;
}

function makeInsulatorBoundary() {
  const root = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({ color: '#e9ece7', roughness: 0.42, metalness: 0.05 });
  const metal = new THREE.MeshStandardMaterial({ color: '#646d72', roughness: 0.32, metalness: 0.8 });
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 4.2, 8), metal);
  wire.rotation.x = Math.PI / 2;
  wire.position.y = 5.72;
  root.add(wire);
  for (const z of [-1.05, -0.7, -0.35, 0.35, 0.7, 1.05]) {
    const bead = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.18, 14), ceramic);
    bead.rotation.x = Math.PI / 2;
    bead.position.set(0, 5.72, z);
    root.add(bead);
  }
  return root;
}

function makeSignalPerson() {
  const root = new THREE.Group();
  const uniform = new THREE.MeshStandardMaterial({ color: '#ffb11d', roughness: 0.75 });
  const dark = new THREE.MeshStandardMaterial({ color: '#202a32', roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: '#e4b28b', roughness: 0.8 });
  const red = new THREE.MeshStandardMaterial({ color: '#e21f2f', roughness: 0.72, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.05, 0.34), uniform);
  body.position.y = 1.35;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), skin);
  head.position.y = 2.08;
  root.add(body, head);
  for (const x of [-0.18, 0.18]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.92, 0.18), dark);
    leg.position.set(x, 0.48, 0);
    root.add(leg);
  }
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.18, 0.16), uniform);
  arm.position.set(-0.48, 1.65, 0);
  arm.rotation.z = -0.92;
  root.add(arm);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.62), red);
  flag.position.set(-1.05, 2.22, 0);
  flag.rotation.y = Math.PI / 2;
  root.add(flag);
  root.userData.flag = flag;
  return root;
}

function makeHazard(type) {
  const root = new THREE.Group();
  root.name = `POWER_HAZARD_${type.id}`;
  const red = new THREE.MeshStandardMaterial({ color: '#d8192b', roughness: 0.72, side: THREE.DoubleSide });
  const line = new THREE.LineBasicMaterial({ color: '#c4c7c8' });
  if (type.id === 'red-bag') {
    const bag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1, 5, 5), red);
    bag.position.y = 5.45;
    bag.rotation.y = 0.3;
    root.add(bag);
  } else if (type.id === 'red-sheet') {
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.25, 8, 5), red);
    sheet.position.set(0.15, 5.55, 0);
    sheet.rotation.y = 0.35;
    root.add(sheet);
  } else if (type.id === 'kite') {
    const kite = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.78, 0), new THREE.Vector3(-0.58, 0, 0), new THREE.Vector3(0, -0.78, 0),
      new THREE.Vector3(0, 0.78, 0), new THREE.Vector3(0.58, 0, 0), new THREE.Vector3(0, -0.78, 0),
    ]), red);
    kite.geometry.setIndex([0, 1, 2, 3, 4, 5]);
    kite.position.set(0.25, 5.8, 0);
    kite.rotation.y = 0.25;
    root.add(kite);
    const points = [new THREE.Vector3(0.25, 5.05, 0), new THREE.Vector3(0.75, 4.1, 0.15), new THREE.Vector3(1.3, 3.25, 0.2)];
    root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), line));
  } else {
    const branchMaterial = new THREE.MeshStandardMaterial({ color: '#59452d', roughness: 1 });
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 3.9, 9), branchMaterial);
    branch.position.set(0.8, 5.25, 0);
    branch.rotation.z = 1.1;
    root.add(branch);
    for (const [x, y, angle] of [[-.25, 5.65, .62], [.05, 5.1, -.72], [1.4, 5.8, .78]]) {
      const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.065, 1.25, 8), branchMaterial);
      twig.position.set(x, y, 0);
      twig.rotation.z = angle;
      root.add(twig);
    }
  }
  return root;
}

export class PowerTrainingScene extends MstsRouteScene {
  constructor(canvas, options = {}) {
    super(canvas, { profile: 'power-training' });
    this.hazardType = options.hazard || POWER_TRAINING_CONFIG.hazardTypes[0];
    this.powerVisuals = {};
    const baseLoad = this.loadPromise;
    this.loadPromise = Promise.all([baseLoad, loadPowerSignAssets()]).then(([, powerSignAssets]) => {
      this.powerSignAssets = powerSignAssets;
      this.buildPowerTrainingScenery();
      this.canvas.dispatchEvent(new CustomEvent('power-scene-ready', { detail: { hazard: this.hazardType } }));
      return this;
    });
  }

  addBoard(text, distance, lateral, backText = text, options = {}) {
    const board = makeBoard(text, backText, options);
    board.name = `POWER_SIGN_${text}_${distance}`;
    this.placeLookoutObject3D(board, distance, lateral);
    this.powerRoot.add(board);
    return board;
  }

  createSourcePowerSign(assetId, name) {
    const asset = this.powerSignAssets?.[assetId];
    if (!asset?.source?.fileName) throw new Error(`缺少原游戏线路标志：${assetId}`);
    const fileName = asset.source.fileName;
    return this.createSourceShapeObject({ shapes: { [fileName]: asset } }, fileName, name);
  }

  addSourceSign(frontAssetId, backAssetId, distance, lateral, id) {
    const root = new THREE.Group();
    root.name = `POWER_SIGN_${id}_${distance}`;
    root.userData.source = 'JINGGUANG original MSTS shape';
    root.userData.frontAsset = frontAssetId;
    root.userData.backAsset = backAssetId;
    const front = this.createSourcePowerSign(frontAssetId, `${root.name}_FRONT`);
    const back = this.createSourcePowerSign(backAssetId, `${root.name}_BACK`);
    front.position.z = -0.012;
    back.position.z = 0.012;
    back.rotation.y = Math.PI;
    root.add(front, back);
    this.placeLookoutObject3D(root, distance, lateral);
    this.powerRoot.add(root);
    return root;
  }

  addDiamondBoard(distance, lateral) {
    const board = makeDiamondBoard();
    board.name = `POWER_SIGN_T_BREAK_${distance}`;
    board.userData.source = 'source-style supplement; no standalone T-break shape exists in JINGGUANG';
    this.placeLookoutObject3D(board, distance, lateral);
    this.powerRoot.add(board);
    return board;
  }

  buildPowerTrainingScenery() {
    const { neutral: n, pantograph: p } = POWER_TRAINING_CONFIG;
    this.powerRoot = new THREE.Group();
    this.powerRoot.name = 'POWER_TRAINING_SCENERY';
    this.routeRoot.add(this.powerRoot);

    // 原游戏采用三、二、一道斜杠的预告牌，反方向牌面按相反接近顺序保留。
    this.addSourceSign('yugaobiao-3', 'yugaobiao-1', n.preview - 100, 4.2, 'NEUTRAL_PREVIEW_3');
    this.addSourceSign('yugaobiao-2', 'yugaobiao-2', n.preview - 50, 4.2, 'NEUTRAL_PREVIEW_2');
    this.addSourceSign('yugaobiao-1', 'yugaobiao-3', n.preview, 4.2, 'NEUTRAL_PREVIEW_1');
    this.addSourceSign('jinzhi-shuanggong', 'k-jinzhi-shuanggong', n.noDoublePantograph, 4.2, 'NO_DOUBLE_PANTOGRAPH');
    this.addDiamondBoard(n.tBreak, 4.2);
    this.addSourceSign('duan', 'he', n.breakSign, 4.2, 'POWER_OFF');
    this.addSourceSign('he', 'duan', n.closeSign, 4.2, 'POWER_ON');

    const startBoundary = makeInsulatorBoundary();
    startBoundary.name = 'POWER_NEUTRAL_SECTION_START';
    this.placeLookoutObject3D(startBoundary, n.sectionStart);
    this.powerRoot.add(startBoundary);
    const endBoundary = makeInsulatorBoundary();
    endBoundary.name = 'POWER_NEUTRAL_SECTION_END';
    this.placeLookoutObject3D(endBoundary, n.sectionEnd);
    this.powerRoot.add(endBoundary);

    this.addBoard('临时\n升降弓', p.preview, 4.2, '临时\n升降弓', { color: '#a21219', border: '#a21219', fontSize: 84, lineHeight: 98 });
    this.addSourceSign('zhunbei-jianggong', 'k-zhunbei-jianggong', p.prepare, 4.2, 'PREPARE_LOWER_PANTOGRAPH');
    this.addSourceSign('jiang', 'sheng', p.lowerSign, 4.2, 'LOWER_PANTOGRAPH');
    this.addSourceSign('sheng', 'jiang', p.raiseSign, 4.2, 'RAISE_PANTOGRAPH');

    const person = makeSignalPerson();
    person.name = 'POWER_ONSITE_HAND_SIGNAL_PERSON';
    this.placeLookoutObject3D(person, p.handSignal, 4.4);
    this.powerRoot.add(person);
    this.powerVisuals.person = person;

    const hazard = makeHazard(this.hazardType);
    this.placeLookoutObject3D(hazard, p.hazardObject, 0.35);
    hazard.userData.baseQuaternion = hazard.quaternion.clone();
    this.powerRoot.add(hazard);
    this.powerVisuals.hazard = hazard;
  }

  setHazardType(type) {
    this.hazardType = type;
    if (!this.powerRoot) return;
    if (this.powerVisuals.hazard) this.powerRoot.remove(this.powerVisuals.hazard);
    const hazard = makeHazard(type);
    this.placeLookoutObject3D(hazard, POWER_TRAINING_CONFIG.pantograph.hazardObject, 0.35);
    hazard.userData.baseQuaternion = hazard.quaternion.clone();
    this.powerRoot.add(hazard);
    this.powerVisuals.hazard = hazard;
  }

  update(distance, speed, view = this.view, signalVisible = false, wholeTrainStartFraction = 1) {
    super.update(distance, speed, view, signalVisible, wholeTrainStartFraction);
    const now = performance.now() / 1000;
    const hazard = this.powerVisuals.hazard;
    if (hazard) {
      const wobble = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        0,
        Math.sin(now * 1.35) * 0.18,
        Math.sin(now * 2.3) * 0.12,
      ));
      hazard.quaternion.copy(hazard.userData.baseQuaternion).multiply(wobble);
      hazard.position.y = hazard.userData.basePosition.y + Math.sin(now * 1.7) * 0.12;
    }
    const flag = this.powerVisuals.person?.userData.flag;
    if (flag) flag.rotation.z = Math.sin(now * 2.8) * 0.2;
  }
}

