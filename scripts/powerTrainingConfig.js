export const POWER_TRAINING_CONFIG = Object.freeze({
  projectName: '途中过分相+升降弓',
  mode: 'assessment',
  startDistance: 1250,
  initialSpeed: 55,
  finishDistance: 5000,
  neutral: Object.freeze({
    preview: 1500,
    noDoublePantograph: 1800,
    tBreak: 1950,
    breakSign: 2100,
    sectionStart: 2200,
    sectionEnd: 2400,
    closeSign: 2500,
    closeWindowStart: 2505,
    closeWindowEnd: 2535,
    restoreEnd: 2700,
  }),
  pantograph: Object.freeze({
    preview: 3300,
    prepare: 3500,
    lowerSign: 3800,
    hazardStart: 3950,
    hazardObject: 4100,
    hazardEnd: 4250,
    raiseSign: 4400,
    restoreEnd: 4700,
  }),
  hazardTypes: Object.freeze([
    Object.freeze({ id: 'red-bag', label: '飘动的红色塑料袋' }),
    Object.freeze({ id: 'red-sheet', label: '飘动的红色塑料布' }),
    Object.freeze({ id: 'kite', label: '风筝' }),
    Object.freeze({ id: 'branch', label: '树枝侵入接触网' }),
  ]),
});

export const POWER_SCORING = Object.freeze({
  neutral: Object.freeze([
    Object.freeze({ id: 'neutral-preview', label: '分相前位置确认与呼唤', points: 8 }),
    Object.freeze({ id: 'rear-panto', label: '禁止双弓、后弓单弓确认', points: 6 }),
    Object.freeze({ id: 'neutral-traction-zero', label: '牵引手柄退零时机', points: 10 }),
    Object.freeze({ id: 'neutral-break-open', label: 'T断后、断标前分主断', points: 14 }),
    Object.freeze({ id: 'neutral-coast', label: '分相区断电惰行与监视', points: 10 }),
    Object.freeze({ id: 'neutral-break-close', label: '越过合标5–35m内合主断', points: 8 }),
    Object.freeze({ id: 'neutral-restore', label: '平稳恢复牵引', points: 4 }),
  ]),
  pantograph: Object.freeze([
    Object.freeze({ id: 'panto-signal', label: '临时升降弓标识别与呼唤', points: 6 }),
    Object.freeze({ id: 'panto-traction-zero', label: '降弓前牵引手柄退零', points: 6 }),
    Object.freeze({ id: 'panto-break-open', label: '降弓前分主断', points: 6 }),
    Object.freeze({ id: 'panto-lower', label: '降弓标前降下后弓', points: 8 }),
    Object.freeze({ id: 'panto-coast', label: '异物区保持降弓惰行', points: 5 }),
    Object.freeze({ id: 'panto-restore', label: '越过升弓标后升弓、确认网压、合主断并恢复', points: 9 }),
  ]),
});

export function chooseHazard(random = Math.random) {
  const index = Math.min(
    POWER_TRAINING_CONFIG.hazardTypes.length - 1,
    Math.floor(Math.max(0, Number(random()) || 0) * POWER_TRAINING_CONFIG.hazardTypes.length),
  );
  return POWER_TRAINING_CONFIG.hazardTypes[index];
}

