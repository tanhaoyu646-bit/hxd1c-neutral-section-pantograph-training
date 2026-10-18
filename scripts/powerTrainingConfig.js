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
    closeWindowEnd: 2520,
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
    Object.freeze({ id: 'neutral-preview', label: '分相前位置确认与呼唤', points: 8, instruction: '分相预告标前100m至禁止双弓标前80m，点击“呼唤确认”' }),
    Object.freeze({ id: 'rear-panto', label: '禁止双弓、后弓单弓确认', points: 6, instruction: '禁止双弓标前55m至T断标后20m，再次呼唤并确认后弓单弓' }),
    Object.freeze({ id: 'neutral-traction-zero', label: '牵引手柄退零时机', points: 10, instruction: '越过分相预告标后、到达T断标前，将牵引主手柄退至0位' }),
    Object.freeze({ id: 'neutral-break-open', label: 'T断后、断标前分主断', points: 14, instruction: '越过T断标后、越过断标前，将主断路器开关置“分”' }),
    Object.freeze({ id: 'neutral-coast', label: '分相区断电惰行与监视', points: 10, instruction: '牵引0位、主断分位，完整越过分相起点和终点' }),
    Object.freeze({ id: 'neutral-break-close', label: '越过合标5–20m内合主断', points: 8, instruction: '越过合标5～20m内，将主断路器开关置“合”' }),
    Object.freeze({ id: 'neutral-restore', label: '平稳恢复牵引', points: 4, instruction: '主断合、网压建立后，于2700m前将牵引恢复至1.0～3.0级' }),
  ]),
  pantograph: Object.freeze([
    Object.freeze({ id: 'panto-signal', label: '临时升降弓标识别与呼唤', points: 6, instruction: '临时升降弓预告点前100m至准备降弓标后100m，点击“呼唤确认”' }),
    Object.freeze({ id: 'panto-traction-zero', label: '降弓前牵引手柄退零', points: 6, instruction: '准备降弓标至降弓标之间，将牵引主手柄退至0位' }),
    Object.freeze({ id: 'panto-break-open', label: '降弓前分主断', points: 6, instruction: '准备降弓标至降弓标之间，先将主断路器开关置“分”' }),
    Object.freeze({ id: 'panto-lower', label: '降弓标前降下后弓', points: 8, instruction: '主断已分后、越过降弓标前，将受电弓开关置“降”' }),
    Object.freeze({ id: 'panto-coast', label: '异物区保持降弓惰行', points: 5, instruction: '后弓降下、主断分位、牵引0位，完整通过接触网异物区' }),
    Object.freeze({ id: 'panto-restore', label: '越过升弓标后升弓、确认网压、合主断并恢复', points: 9, instruction: '越过升弓标后升后弓，待网压≥19kV，合主断并于4700m前恢复1.0～3.0级' }),
  ]),
});

export function chooseHazard(random = Math.random) {
  const index = Math.min(
    POWER_TRAINING_CONFIG.hazardTypes.length - 1,
    Math.floor(Math.max(0, Number(random()) || 0) * POWER_TRAINING_CONFIG.hazardTypes.length),
  );
  return POWER_TRAINING_CONFIG.hazardTypes[index];
}

