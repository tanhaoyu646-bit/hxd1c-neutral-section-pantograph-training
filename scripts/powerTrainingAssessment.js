import { POWER_SCORING, POWER_TRAINING_CONFIG } from './powerTrainingConfig.js';

const { neutral: N, pantograph: P } = POWER_TRAINING_CONFIG;
const crossed = (from, to, target) => from < target && to >= target;

function blankChecks() {
  return Object.fromEntries(
    [...POWER_SCORING.neutral, ...POWER_SCORING.pantograph].map((item) => [item.id, false]),
  );
}

export function createPowerAssessment() {
  return {
    checks: blankChecks(),
    invalidScenes: [],
    incidents: [],
    timeline: [],
    neutralEnteredSafely: false,
    neutralExitedSafely: false,
    hazardEnteredSafely: false,
    hazardExitedSafely: false,
    neutralTractionViolation: false,
    hazardPantoViolation: false,
    lastDistance: POWER_TRAINING_CONFIG.startDistance,
    finished: false,
  };
}

function log(assessment, state, type, message) {
  const item = {
    time: Number(state.elapsed.toFixed(1)),
    distance: Number(state.distance.toFixed(1)),
    speed: Number(state.speed.toFixed(1)),
    type,
    message,
  };
  assessment.timeline.push(item);
  if (assessment.timeline.length > 80) assessment.timeline.shift();
  return item;
}

function invalidate(assessment, state, scene, code, message) {
  if (assessment.incidents.some((item) => item.code === code)) return;
  assessment.incidents.push({ code, scene, message, distance: Number(state.distance.toFixed(1)) });
  if (!assessment.invalidScenes.includes(scene)) assessment.invalidScenes.push(scene);
  log(assessment, state, 'critical', `安全关键错误：${message}`);
}

export function powerSceneScores(assessment) {
  const score = (items, scene) => assessment.invalidScenes.includes(scene)
    ? 0
    : items.reduce((sum, item) => sum + (assessment.checks[item.id] ? item.points : 0), 0);
  const neutral = score(POWER_SCORING.neutral, 'neutral');
  const pantograph = score(POWER_SCORING.pantograph, 'pantograph');
  return { neutral, pantograph, total: neutral + pantograph };
}

export class PowerTrainingAssessment {
  constructor(state) {
    state.assessment ||= createPowerAssessment();
  }

  recordAction(action, value, state, context = {}) {
    const a = state.assessment;
    const d = state.distance;
    let message = '';

    if (action === 'callout') {
      if (d >= N.previewMarkers[0] - 80 && d < N.noDoublePantograph - 80 && !a.checks['neutral-preview']) {
        a.checks['neutral-preview'] = true;
        message = '司机：分相预告，注意。副司机：注意。';
      } else if (d >= N.noDoublePantograph - 55 && d < N.tBreak + 20 && !a.checks['rear-panto']) {
        a.checks['rear-panto'] = state.rearPantograph && !state.frontPantograph;
        message = a.checks['rear-panto']
          ? '司机：禁止双弓。副司机：后弓单弓好了。'
          : '司机：禁止双弓。副司机：受电弓状态不符合后弓单弓要求。';
      } else if (d >= P.preview - 100 && d < P.prepare + 100 && !a.checks['panto-signal']) {
        a.checks['panto-signal'] = true;
        message = '司机：前方临时升降弓区段，准备降弓。副司机：准备降弓。';
      } else if (d >= P.raiseSign - 35 && d <= P.restoreEnd) {
        message = '司机：越过升弓标。副司机：升弓标越过。';
      } else {
        message = '副司机：当前未进入规定呼唤确认窗口。';
      }
    }

    if (action === 'traction' && Number(value) === 0) {
      if (d >= N.preview && d <= N.tBreak) a.checks['neutral-traction-zero'] = true;
      if (d >= P.prepare && d <= P.lowerSign) a.checks['panto-traction-zero'] = true;
      message ||= '牵引手柄已退零。';
    }
    if (action === 'traction' && Number(value) > 0) {
      if (d >= N.sectionStart && d <= N.sectionEnd) {
        a.neutralTractionViolation = true;
        invalidate(a, state, 'neutral', 'neutral-load', '分相区内加载牵引');
      }
      if (d >= P.hazardStart && d <= P.hazardEnd) {
        invalidate(a, state, 'pantograph', 'hazard-load', '接触网异物区内加载牵引');
      }
      if (d > N.closeWindowStart && d < N.restoreEnd && state.mainBreaker && state.lineVoltage && Number(value) <= 3) {
        a.checks['neutral-restore'] = true;
      }
      if (d > P.raiseSign && d < P.restoreEnd && state.rearPantograph && state.mainBreaker && state.lineVoltage && Number(value) <= 3) {
        a.checks['panto-restore'] = true;
      } else if (d > P.raiseSign && d < P.restoreEnd && (!state.rearPantograph || !state.mainBreaker || !state.lineVoltage)) {
        invalidate(a, state, 'pantograph', 'force-restore', '受电弓、网压或主断条件未建立即恢复牵引');
      }
    }

    if (action === 'main-breaker' && value === 'open') {
      if (d >= N.tBreak && d < N.breakSign) a.checks['neutral-break-open'] = true;
      if (d >= P.prepare && d < P.lowerSign) a.checks['panto-break-open'] = true;
      message ||= '主断路器已分。';
    }
    if (action === 'main-breaker' && value === 'close') {
      if (d >= N.closeWindowStart && d <= N.closeWindowEnd) a.checks['neutral-break-close'] = true;
      if (d > N.sectionEnd && d < N.closeWindowStart) {
        invalidate(a, state, 'neutral', 'early-breaker-close', '未越过合标5m即合主断');
      }
      if (d > N.closeWindowEnd && d < N.restoreEnd) log(a, state, 'warning', '越过合标35m后才合主断。');
      if (d >= P.hazardStart && d <= P.hazardEnd) {
        invalidate(a, state, 'pantograph', 'hazard-breaker-close', '异物区内闭合主断路器');
      }
      message ||= '主断路器已合。';
    }

    if (action === 'rear-pantograph' && value === 'down') {
      if (context.previousMainBreaker && d >= P.prepare - 80 && d < P.lowerSign + 20) {
        invalidate(a, state, 'pantograph', 'lower-with-breaker-closed', '主断未手动分开即降弓');
      }
      if (d >= P.prepare && d < P.lowerSign) a.checks['panto-lower'] = true;
      message ||= '后受电弓已降。';
    }
    if (action === 'rear-pantograph' && value === 'up') {
      if (d < P.raiseSign && d >= P.hazardStart - 60) {
        invalidate(a, state, 'pantograph', 'early-raise', '未越过升弓标即升弓');
      }
      message ||= '后受电弓升弓命令已发出，等待网压建立。';
    }

    if (message) log(a, state, 'operation', message);
    return message;
  }

  update(state) {
    const a = state.assessment;
    const from = a.lastDistance;
    const to = state.distance;

    if (crossed(from, to, N.sectionStart)) {
      if (state.mainBreaker) invalidate(a, state, 'neutral', 'breaker-closed-entry', '主断未分即进入分相区');
      a.neutralEnteredSafely = !state.mainBreaker && state.traction === 0;
    }
    if (dWithin(to, N.sectionStart, N.sectionEnd) && (state.traction > 0 || state.mainBreaker)) {
      a.neutralTractionViolation ||= state.traction > 0;
      if (state.mainBreaker) invalidate(a, state, 'neutral', 'breaker-close-in-neutral', '分相区内主断处于合位');
    }
    if (crossed(from, to, N.sectionEnd)) {
      a.neutralExitedSafely = a.neutralEnteredSafely && !a.neutralTractionViolation && !state.mainBreaker;
      a.checks['neutral-coast'] = a.neutralExitedSafely;
    }

    if (crossed(from, to, P.hazardStart)) {
      if (state.rearPantograph) invalidate(a, state, 'pantograph', 'panto-up-entry', '受电弓未降即进入接触网异物区');
      a.hazardEnteredSafely = !state.rearPantograph && !state.mainBreaker && state.traction === 0;
    }
    if (dWithin(to, P.hazardStart, P.hazardEnd) && state.rearPantograph) {
      a.hazardPantoViolation = true;
      invalidate(a, state, 'pantograph', 'panto-up-in-zone', '接触网异物区内受电弓处于升位');
    }
    if (crossed(from, to, P.hazardEnd)) {
      a.hazardExitedSafely = a.hazardEnteredSafely && !a.hazardPantoViolation && !state.rearPantograph && !state.mainBreaker && state.traction === 0;
      a.checks['panto-coast'] = a.hazardExitedSafely;
    }
    if (state.distance >= P.raiseSign && state.distance <= P.restoreEnd
      && state.rearPantograph && state.lineVoltage && state.mainBreaker && state.traction > 0 && state.traction <= 3) {
      a.checks['panto-restore'] = true;
    }
    if (!a.finished && state.distance >= POWER_TRAINING_CONFIG.finishDistance) {
      a.finished = true;
      log(a, state, 'finish', '考核终点到达，成绩已封存。');
    }
    a.lastDistance = to;
  }
}

function dWithin(value, start, end) {
  return value >= start && value <= end;
}

