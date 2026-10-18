// 保持司机初始位置不变，将整套教学区累计后移1300 m（本轮再后移1000 m）。
// 55 km/h下，首块标牌进入420 m可视范围前约有94 s，可充分覆盖首屏加载。
const TRAINING_ROUTE_SHIFT = 1300;
const shifted = (distance) => distance + TRAINING_ROUTE_SHIFT;

export const POWER_TRAINING_CONFIG = Object.freeze({
  projectName: '途中过分相+升降弓',
  mode: 'assessment',
  routeShift: TRAINING_ROUTE_SHIFT,
  startDistance: 1250,
  initialSpeed: 55,
  finishDistance: shifted(5000),
  neutral: Object.freeze({
    preview: shifted(1500),
    noDoublePantograph: shifted(1800),
    tBreak: shifted(1950),
    breakSign: shifted(2100),
    sectionStart: shifted(2200),
    sectionEnd: shifted(2400),
    closeSign: shifted(2500),
    closeWindowStart: shifted(2505),
    closeWindowEnd: shifted(2520),
    restoreEnd: shifted(2700),
  }),
  pantograph: Object.freeze({
    preview: shifted(3300),
    prepare: shifted(3500),
    lowerSign: shifted(3800),
    hazardStart: shifted(3950),
    hazardObject: shifted(4100),
    hazardEnd: shifted(4250),
    raiseSign: shifted(4400),
    restoreEnd: shifted(4700),
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
    Object.freeze({ id: 'neutral-restore', label: '平稳恢复牵引', points: 4, instruction: `主断合、网压建立后，于${POWER_TRAINING_CONFIG.neutral.restoreEnd}m前将牵引恢复至1.0～3.0级` }),
  ]),
  pantograph: Object.freeze([
    Object.freeze({ id: 'panto-signal', label: '临时升降弓标识别与呼唤', points: 6, instruction: '临时升降弓预告点前100m至准备降弓标后100m，点击“呼唤确认”' }),
    Object.freeze({ id: 'panto-traction-zero', label: '降弓前牵引手柄退零', points: 6, instruction: '准备降弓标至降弓标之间，将牵引主手柄退至0位' }),
    Object.freeze({ id: 'panto-break-open', label: '降弓前分主断', points: 6, instruction: '准备降弓标至降弓标之间，先将主断路器开关置“分”' }),
    Object.freeze({ id: 'panto-lower', label: '降弓标前降下后弓', points: 8, instruction: '主断已分后、越过降弓标前，将受电弓开关置“降”' }),
    Object.freeze({ id: 'panto-coast', label: '异物区保持降弓惰行', points: 5, instruction: '后弓降下、主断分位、牵引0位，完整通过接触网异物区' }),
    Object.freeze({ id: 'panto-restore', label: '越过升弓标后升弓、确认网压、合主断并恢复', points: 9, instruction: `越过升弓标后升后弓，待网压≥19kV，合主断并于${POWER_TRAINING_CONFIG.pantograph.restoreEnd}m前恢复1.0～3.0级` }),
  ]),
});

export function chooseHazard(random = Math.random) {
  const index = Math.min(
    POWER_TRAINING_CONFIG.hazardTypes.length - 1,
    Math.floor(Math.max(0, Number(random()) || 0) * POWER_TRAINING_CONFIG.hazardTypes.length),
  );
  return POWER_TRAINING_CONFIG.hazardTypes[index];
}

