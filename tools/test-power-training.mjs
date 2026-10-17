import assert from 'node:assert/strict';
import { PowerTrainingSimulation } from '../scripts/powerTrainingSimulation.js';
import { powerSceneScores } from '../scripts/powerTrainingAssessment.js';
import { POWER_TRAINING_CONFIG } from '../scripts/powerTrainingConfig.js';

function advance(sim, distance) {
  sim.state.distance = distance;
  sim.assessment.update(sim.state);
}

function runCorrectAttempt() {
  const sim = new PowerTrainingSimulation({ random: () => 0 });
  const { neutral: n, pantograph: p } = POWER_TRAINING_CONFIG;
  sim.start();
  advance(sim, n.preview);
  sim.callout();
  advance(sim, n.noDoublePantograph - 5);
  sim.callout();
  sim.setTraction(0);
  advance(sim, n.tBreak + 5);
  sim.setMainBreaker('open');
  advance(sim, n.sectionStart + 1);
  advance(sim, n.sectionEnd + 1);
  advance(sim, n.closeWindowStart + 2);
  sim.state.lineVoltage = true;
  sim.setMainBreaker('close');
  advance(sim, n.closeWindowEnd + 8);
  sim.setTraction(2);

  advance(sim, p.preview);
  sim.callout();
  advance(sim, p.prepare + 10);
  sim.setTraction(0);
  sim.setMainBreaker('open');
  advance(sim, p.lowerSign - 5);
  sim.setPantograph('down');
  advance(sim, p.hazardStart + 1);
  advance(sim, p.hazardEnd + 1);
  advance(sim, p.raiseSign + 5);
  sim.setPantograph('up');
  for (let i = 0; i < 20; i += 1) sim.tick(0.1);
  sim.setMainBreaker('close');
  sim.setTraction(2);
  advance(sim, POWER_TRAINING_CONFIG.finishDistance);
  const scores = powerSceneScores(sim.state.assessment);
  assert.deepEqual(scores, { neutral: 60, pantograph: 40, total: 100 });
  assert.equal(sim.state.assessment.finished, true);
}

function runMaintainedSwitchChecks() {
  const sim = new PowerTrainingSimulation({ random: () => 0.3 });
  sim.setMainBreaker('open');
  assert.equal(sim.state.mainBreakerSwitch, 'open');
  assert.equal(sim.state.mainBreaker, false);
  sim.setMainBreaker('zero');
  assert.equal(sim.state.mainBreakerSwitch, 'zero');
  assert.equal(sim.state.mainBreaker, false, '0位不得改变主断实际状态');
  sim.setPantograph('down');
  assert.equal(sim.state.pantographSwitch, 'down');
  assert.equal(sim.state.rearPantograph, false);
  sim.setPantograph('zero');
  assert.equal(sim.state.pantographSwitch, 'zero');
  assert.equal(sim.state.rearPantograph, false, '0位不得改变受电弓实际状态');
  sim.setCompressor('auto');
  assert.equal(sim.state.compressorSwitch, 'auto');
}

function runCriticalFailureChecks() {
  const sim = new PowerTrainingSimulation({ random: () => 0.7 });
  advance(sim, POWER_TRAINING_CONFIG.neutral.sectionStart + 1);
  assert.ok(sim.state.assessment.invalidScenes.includes('neutral'));
  advance(sim, POWER_TRAINING_CONFIG.pantograph.hazardStart + 1);
  assert.ok(sim.state.assessment.invalidScenes.includes('pantograph'));
  const scores = powerSceneScores(sim.state.assessment);
  assert.equal(scores.neutral, 0);
  assert.equal(scores.pantograph, 0);
}

function runSafetyBoundaryChecks() {
  const { neutral: n, pantograph: p } = POWER_TRAINING_CONFIG;

  const earlyClose = new PowerTrainingSimulation({ random: () => 0 });
  earlyClose.setMainBreaker('open');
  advance(earlyClose, n.sectionEnd + 20);
  earlyClose.state.lineVoltage = true;
  earlyClose.setMainBreaker('close');
  assert(earlyClose.state.assessment.incidents.some((item) => item.code === 'early-breaker-close'));

  const breakerClosedLowering = new PowerTrainingSimulation({ random: () => 0 });
  advance(breakerClosedLowering, p.prepare + 20);
  breakerClosedLowering.setPantograph('down');
  assert(breakerClosedLowering.state.assessment.incidents.some((item) => item.code === 'lower-with-breaker-closed'));

  const earlyRaise = new PowerTrainingSimulation({ random: () => 0 });
  earlyRaise.setMainBreaker('open');
  earlyRaise.setPantograph('down');
  advance(earlyRaise, p.hazardEnd + 20);
  earlyRaise.setPantograph('up');
  assert(earlyRaise.state.assessment.incidents.some((item) => item.code === 'early-raise'));
}

function runLayoutTimingChecks() {
  const { neutral: n, pantograph: p, initialSpeed } = POWER_TRAINING_CONFIG;
  const metresPerSecond = initialSpeed / 3.6;
  const seconds = (distance) => distance / metresPerSecond;
  assert(n.preview < n.noDoublePantograph);
  assert(n.noDoublePantograph < n.tBreak);
  assert(n.tBreak < n.breakSign);
  assert(n.breakSign < n.sectionStart);
  assert(n.sectionStart < n.sectionEnd);
  assert(n.sectionEnd < n.closeSign);
  assert(seconds(n.tBreak - n.noDoublePantograph) >= 9);
  assert(seconds(n.breakSign - n.tBreak) >= 9);
  assert(seconds(n.sectionStart - n.breakSign) >= 6);
  assert(n.closeWindowEnd - n.closeWindowStart >= 30);
  assert(seconds(p.lowerSign - p.prepare) >= 18);
  assert(seconds(p.hazardStart - p.lowerSign) >= 9);
  assert(seconds(p.raiseSign - p.hazardEnd) >= 9);
  assert(seconds(p.restoreEnd - p.raiseSign) >= 18);
}

runCorrectAttempt();
runMaintainedSwitchChecks();
runCriticalFailureChecks();
runSafetyBoundaryChecks();
runLayoutTimingChecks();
console.log('power training state-machine tests passed');

