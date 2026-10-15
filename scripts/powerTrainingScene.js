import * as THREE from '../lib/three/three.module.js';
import { MstsRouteScene } from './mstsRouteScene.js';
import { POWER_TRAINING_CONFIG } from './powerTrainingConfig.js';

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

function makeInsulatorBoundary(label) {
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
  const tag = makeBoard(label, label === '分相始' ? '分相终' : '分相始', { width: 1.15, height: 0.7, fontSize: 100 });
  tag.position.x = 3.4;
  root.add(tag);
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
    this.loadPromise = baseLoad.then(() => {
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

  buildPowerTrainingScenery() {
    const { neutral: n, pantograph: p } = POWER_TRAINING_CONFIG;
    this.powerRoot = new THREE.Group();
    this.powerRoot.name = 'POWER_TRAINING_SCENERY';
    this.routeRoot.add(this.powerRoot);

    this.addBoard('分相\n预告', n.preview, 4.2, '分相\n预告', { fontSize: 94, lineHeight: 104 });
    this.addBoard('T断', n.tBreak, 4.2, 'T断', { color: '#111', border: '#d11722', fontSize: 142 });
    const startBoundary = makeInsulatorBoundary('分相始');
    this.placeLookoutObject3D(startBoundary, n.sectionStart);
    this.powerRoot.add(startBoundary);
    const endBoundary = makeInsulatorBoundary('分相终');
    this.placeLookoutObject3D(endBoundary, n.sectionEnd);
    this.powerRoot.add(endBoundary);

    this.addBoard('临时\n升降弓', p.preview, 4.2, '临时\n升降弓', { color: '#a21219', border: '#a21219', fontSize: 84, lineHeight: 98 });
    this.addBoard('准备\n降弓', p.prepare, 4.2, '准备\n升弓', { color: '#a21219', border: '#a21219', fontSize: 86, lineHeight: 100 });
    this.addBoard('降', p.lowerSign, 4.2, '升', { color: '#a21219', border: '#a21219', fontSize: 174 });
    this.addBoard('升', p.raiseSign, 4.2, '降', { color: '#a21219', border: '#a21219', fontSize: 174 });

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

