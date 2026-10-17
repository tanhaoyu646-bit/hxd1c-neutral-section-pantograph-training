import { chooseHazard, POWER_TRAINING_CONFIG } from './powerTrainingConfig.js';
import { createPowerAssessment, PowerTrainingAssessment } from './powerTrainingAssessment.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const approach = (value, target, amount) => value + clamp(target - value, -amount, amount);

export class PowerTrainingSimulation extends EventTarget {
  constructor(options = {}) {
    super();
    this.random = options.random || Math.random;
    this.reset();
  }

  reset() {
    const hazard = chooseHazard(this.random);
    this.state = {
      projectName: POWER_TRAINING_CONFIG.projectName,
      mode: 'assessment',
      running: false,
      completed: false,
      elapsed: 0,
      distance: POWER_TRAINING_CONFIG.startDistance,
      speed: POWER_TRAINING_CONFIG.initialSpeed,
      acceleration: 0,
      traction: 2,
      actualTraction: 2,
      frontPantograph: false,
      rearPantograph: true,
      pantographSwitch: 'up',
      mainBreaker: true,
      mainBreakerSwitch: 'close',
      compressorSwitch: 'auto',
      compressorRunning: true,
      lineVoltage: true,
      lineVoltageDelay: 0,
      hazard,
      lastMessage: '考核初始状态已就绪：55 km/h稳定运行、后弓单弓、主断合、空压机自动。',
      assessment: createPowerAssessment(),
    };
    this.assessment = new PowerTrainingAssessment(this.state);
    this.emit(this.state.lastMessage);
  }

  emit(message) {
    this.state.lastMessage = message;
    this.dispatchEvent(new CustomEvent('change', { detail: { message, state: this.state } }));
  }

  start() {
    if (this.state.completed) this.reset();
    this.state.running = true;
    this.emit(`考核开始。本次接触网异物：${this.state.hazard.label}。`);
  }

  setTraction(value) {
    const next = clamp(Math.round(Number(value) || 0), 0, 8);
    const message = this.assessment.recordAction('traction', next, this.state);
    this.state.traction = next;
    this.emit(message || `牵引手柄：${next === 0 ? '零位' : `${next}级`}。`);
  }

  setMainBreaker(position) {
    if (!['open', 'zero', 'close'].includes(position)) return;
    this.state.mainBreakerSwitch = position;
    if (position === 'open') this.state.mainBreaker = false;
    if (position === 'close') this.state.mainBreaker = true;
    const message = position === 'zero'
      ? '主断路器开关置0位；主断实际状态保持不变。'
      : this.assessment.recordAction('main-breaker', position, this.state);
    this.emit(message);
  }

  setPantograph(position) {
    if (!['down', 'zero', 'up'].includes(position)) return;
    const previousMainBreaker = this.state.mainBreaker;
    this.state.pantographSwitch = position;
    if (position === 'down') {
      this.state.rearPantograph = false;
      this.state.lineVoltage = false;
      this.state.lineVoltageDelay = 0;
    }
    if (position === 'up') {
      this.state.rearPantograph = true;
      this.state.lineVoltage = false;
      this.state.lineVoltageDelay = 1.8;
    }
    const message = position === 'zero'
      ? '受电弓开关置0位；受电弓实际状态保持不变。'
      : this.assessment.recordAction('rear-pantograph', position, this.state, { previousMainBreaker });
    this.emit(message);
  }

  setCompressor(position) {
    if (!['off', 'auto', 'force'].includes(position)) return;
    this.state.compressorSwitch = position;
    this.state.compressorRunning = position !== 'off';
    this.emit(`空压机开关：${position === 'auto' ? '自动' : position === 'force' ? '强泵' : '停止'}。本项不计核心分。`);
  }

  callout() {
    const message = this.assessment.recordAction('callout', true, this.state);
    this.emit(message);
    return message;
  }

  tick(rawDt) {
    const dt = clamp(Number(rawDt) || 0, 0, 0.1);
    const s = this.state;
    if (!s.running || s.completed || !dt) return;
    s.elapsed += dt;

    const inNeutral = s.distance >= POWER_TRAINING_CONFIG.neutral.sectionStart
      && s.distance <= POWER_TRAINING_CONFIG.neutral.sectionEnd;
    if (s.rearPantograph && !inNeutral && s.lineVoltageDelay > 0) {
      s.lineVoltageDelay = Math.max(0, s.lineVoltageDelay - dt);
      if (s.lineVoltageDelay === 0) s.lineVoltage = true;
    }
    if (inNeutral || !s.rearPantograph) s.lineVoltage = false;
    if (!inNeutral && s.rearPantograph && s.lineVoltageDelay === 0) s.lineVoltage = true;

    const electricalReady = s.rearPantograph && s.mainBreaker && s.lineVoltage;
    s.actualTraction = approach(s.actualTraction, electricalReady ? s.traction : 0, dt * 1.4);
    const accelerationTarget = s.actualTraction * 0.018 - 0.036 - Math.max(0, s.speed - 70) * 0.003;
    s.acceleration = approach(s.acceleration, accelerationTarget, dt * 0.08);
    const previousSpeed = s.speed;
    s.speed = clamp(s.speed + s.acceleration * 3.6 * dt, 0, 90);
    s.distance += ((previousSpeed + s.speed) / 7.2) * dt;

    this.assessment.update(s);
    if (s.assessment.finished) {
      s.completed = true;
      s.running = false;
      this.emit('考核完成，成绩已封存。');
    }
  }
}

