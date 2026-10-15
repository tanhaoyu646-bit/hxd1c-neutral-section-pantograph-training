import { PowerTrainingSimulation } from './powerTrainingSimulation.js';
import { powerSceneScores } from './powerTrainingAssessment.js';
import { POWER_SCORING, POWER_TRAINING_CONFIG } from './powerTrainingConfig.js';
import { PowerTrainingScene } from './powerTrainingScene.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const sim = new PowerTrainingSimulation();
const canvas = $('#route-scene');
const scene = new PowerTrainingScene(canvas, { hazard: sim.state.hazard });
let selectedView = 'front';
let previousTime = performance.now();
let resultShown = false;

const viewImages = {
  front: 'HXD1C_front.png',
  left: 'HXD1C_left_full.png',
  right: 'HXD1C_right_full.png',
};

function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

function zoneLabel(distance) {
  const { neutral: n, pantograph: p } = POWER_TRAINING_CONFIG;
  if (distance < n.preview) return '接近分相预告';
  if (distance < n.tBreak) return '分相预告区';
  if (distance < n.breakSign) return 'T断—断标操作区';
  if (distance < n.sectionStart) return '接近分相起点';
  if (distance <= n.sectionEnd) return '分相区';
  if (distance < n.closeSign) return '驶离分相区';
  if (distance <= n.closeWindowEnd) return '合标后允许合闸区';
  if (distance < p.preview) return '正常运行区';
  if (distance < p.prepare) return '临时升降弓预告区';
  if (distance < p.lowerSign) return '准备降弓与手信号区';
  if (distance < p.hazardStart) return '降弓确认区';
  if (distance <= p.hazardEnd) return '接触网异物区';
  if (distance < p.raiseSign) return '驶离异物区';
  if (distance < POWER_TRAINING_CONFIG.finishDistance) return '升弓恢复区';
  return '考核终点';
}

function switchClass(selector, position) {
  const root = document.querySelector(`[data-selector="${selector}"]`);
  if (!root) return;
  const normalized = position === 'up' || position === 'close' || position === 'force'
    ? 'up'
    : position === 'down' || position === 'open' || position === 'off' ? 'down' : 'mid';
  root.classList.remove('pos-up', 'pos-mid', 'pos-down');
  root.classList.add(`pos-${normalized}`);
  root.querySelectorAll('[data-value]').forEach((button) => button.classList.toggle('active', button.dataset.value === position));
}

function renderIncidents(state) {
  const list = $('#incident-list');
  const timeline = state.assessment.timeline.slice(-8).reverse();
  $('#incident-count').textContent = `${state.assessment.incidents.length}项关键错误`;
  if (!timeline.length) {
    list.innerHTML = '<li>尚无记录</li>';
    return;
  }
  list.innerHTML = timeline.map((item) => `<li class="${item.type === 'critical' ? 'critical' : ''}">K${(item.distance / 1000).toFixed(3)} · ${item.message}</li>`).join('');
}

function render(state) {
  const scores = powerSceneScores(state.assessment);
  $('#hud-speed').textContent = state.speed.toFixed(1);
  $('#hud-distance').textContent = (state.distance / 1000).toFixed(3);
  $('#hud-zone').textContent = zoneLabel(state.distance);
  $('#traction-value').textContent = state.traction ? `${state.traction}级` : '零位';
  $('#route-progress').style.width = `${Math.max(0, Math.min(100, (state.distance - POWER_TRAINING_CONFIG.startDistance) / (POWER_TRAINING_CONFIG.finishDistance - POWER_TRAINING_CONFIG.startDistance) * 100))}%`;
  $('#score-total').textContent = scores.total;
  $('#score-neutral').textContent = `${scores.neutral} / 60`;
  $('#score-panto').textContent = `${scores.pantograph} / 40`;
  $('#run-status').textContent = state.completed ? '已完成' : state.running ? '进行中' : '待开始';
  $('#state-panto').textContent = state.rearPantograph ? '后弓升（前弓降）' : '前、后弓均降';
  $('#state-breaker').textContent = state.mainBreaker ? '合' : '分';
  $('#state-voltage').textContent = state.lineVoltage ? '25 kV' : '0 kV';
  $('#state-traction').textContent = state.traction ? `${state.traction}级` : '零位';
  $('#state-compressor').textContent = state.compressorSwitch === 'auto' ? '自动' : state.compressorSwitch === 'force' ? '强泵' : '停止';
  $('#state-hazard').textContent = state.hazard.label;
  $('#operation-message').textContent = state.lastMessage;
  $('#operation-message').classList.toggle('critical', state.lastMessage.startsWith('安全关键错误'));
  $('#switch-panto-value').textContent = { up: '升', zero: '0', down: '降' }[state.pantographSwitch];
  $('#switch-breaker-value').textContent = { close: '合', zero: '0', open: '分' }[state.mainBreakerSwitch];
  $('#switch-compressor-value').textContent = { force: '强泵', auto: '自动', off: '停止' }[state.compressorSwitch];
  $('#actual-panto').textContent = state.rearPantograph ? '后弓升' : '后弓降';
  $('#actual-breaker').textContent = state.mainBreaker ? '合' : '分';
  $('#actual-voltage').textContent = state.lineVoltage ? '25 kV' : '0 kV';
  switchClass('pantograph', state.pantographSwitch);
  switchClass('breaker', state.mainBreakerSwitch);
  switchClass('compressor', state.compressorSwitch);
  renderIncidents(state);
}

function resultMarkup(state) {
  const scores = powerSceneScores(state.assessment);
  $('#result-score').textContent = scores.total;
  $('#result-scenes').innerHTML = `
    <div class="${state.assessment.invalidScenes.includes('neutral') ? 'invalid' : ''}"><span>手动过分相</span><b>${scores.neutral} / 60</b></div>
    <div class="${state.assessment.invalidScenes.includes('pantograph') ? 'invalid' : ''}"><span>升降弓处置</span><b>${scores.pantograph} / 40</b></div>`;
  const rows = [...POWER_SCORING.neutral, ...POWER_SCORING.pantograph].map((item) => {
    const passed = state.assessment.checks[item.id];
    return `<div class="${passed ? 'pass' : 'fail'}"><span>${item.label}</span><b>${passed ? `+${item.points}` : '+0'}</b></div>`;
  }).join('');
  const timeline = state.assessment.timeline.map((item) => `<li>K${(item.distance / 1000).toFixed(3)} / ${item.speed.toFixed(1)} km/h — ${item.message}</li>`).join('');
  $('#result-detail').innerHTML = `<div class="result-detail-grid">${rows}<ol class="timeline">${timeline}</ol></div>`;
}

function speakAssistant(message) {
  if (!('speechSynthesis' in window)) return;
  const assistant = message.includes('副司机：') ? message.split('副司机：').pop() : '';
  if (!assistant) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(assistant);
  utterance.lang = 'zh-CN';
  utterance.rate = 1.03;
  speechSynthesis.speak(utterance);
}

function resetAttempt() {
  sim.reset();
  resultShown = false;
  $('#brief-hazard').textContent = sim.state.hazard.label;
  scene.setHazardType(sim.state.hazard);
  closeModal('result-modal');
  openModal('start-modal');
  render(sim.state);
}

$('#start-button').addEventListener('click', () => {
  closeModal('start-modal');
  sim.start();
});
$('#switch-panel-open').addEventListener('click', () => openModal('switch-modal'));
$('#reference-open').addEventListener('click', () => openModal('reference-modal'));
$('#restart-button').addEventListener('click', resetAttempt);
$$('[data-close]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.close)));
$$('[data-command]').forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.command === 'panto') sim.setPantograph(button.dataset.value);
  if (button.dataset.command === 'breaker') sim.setMainBreaker(button.dataset.value);
  if (button.dataset.command === 'compressor') sim.setCompressor(button.dataset.value);
}));
$('#traction-up').addEventListener('click', () => sim.setTraction(sim.state.traction + 1));
$('#traction-down').addEventListener('click', () => sim.setTraction(sim.state.traction - 1));
$('#callout-button').addEventListener('click', () => speakAssistant(sim.callout()));
$$('[data-view]').forEach((button) => button.addEventListener('click', () => {
  selectedView = button.dataset.view;
  scene.setView(selectedView);
  $('.cab-layer').src = `./assets/archive-cabview/${viewImages[selectedView]}`;
  $$('[data-view]').forEach((item) => item.classList.toggle('active', item === button));
}));

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowUp') sim.setTraction(sim.state.traction + 1);
  if (event.key === 'ArrowDown') sim.setTraction(sim.state.traction - 1);
  if (event.key.toLowerCase() === 'b') openModal('switch-modal');
  if (event.key.toLowerCase() === 'c') speakAssistant(sim.callout());
});

canvas.addEventListener('route-ready', () => canvas.classList.add('live'));
canvas.addEventListener('route-error', (event) => {
  $('#operation-message').textContent = `三维线路加载失败：${event.detail?.message || '请刷新重试'}`;
  $('#operation-message').classList.add('critical');
});
sim.addEventListener('change', () => render(sim.state));

function animate(now) {
  const dt = Math.min(0.1, Math.max(0, (now - previousTime) / 1000));
  previousTime = now;
  sim.tick(dt);
  scene.update(sim.state.distance, sim.state.speed, selectedView, true, 1);
  scene.render();
  render(sim.state);
  if (sim.state.completed && !resultShown) {
    resultShown = true;
    resultMarkup(sim.state);
    openModal('result-modal');
  }
  requestAnimationFrame(animate);
}

$('#brief-hazard').textContent = sim.state.hazard.label;
render(sim.state);
scene.loadPromise.catch(() => {});
requestAnimationFrame(animate);

const params = new URLSearchParams(location.search);
if (params.get('debug') === '1') {
  window.__powerTraining = {
    sim,
    scene,
    setDistance(distance) {
      sim.state.distance = Number(distance);
      sim.state.assessment.lastDistance = sim.state.distance;
      render(sim.state);
    },
    scores: () => powerSceneScores(sim.state.assessment),
  };
}

