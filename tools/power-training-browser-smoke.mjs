import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { POWER_TRAINING_CONFIG } from '../scripts/powerTrainingConfig.js';

const { neutral: n, pantograph: p } = POWER_TRAINING_CONFIG;

const port = Number(process.env.CDP_PORT || 9228);
const url = process.env.TRAINING_URL || 'http://127.0.0.1:4178/power-training/?debug=1';
const screenshotPath = process.env.SCREENSHOT_PATH || `${process.env.TEMP || '.'}/power-training-browser-smoke.png`;
const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const page = pages.find((entry) => entry.type === 'page') || pages[0];
assert(page, '没有可用浏览器页面');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let nextId = 0;
const pending = new Map();
const errors = [];
const networkErrors = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const handler = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
  } else if (message.method === 'Runtime.exceptionThrown') {
    errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    errors.push(message.params.args.map((arg) => arg.value || arg.description || '').join(' '));
  } else if (message.method === 'Network.loadingFailed' && !message.params.canceled && message.params.errorText !== 'net::ERR_ABORTED') {
    networkErrors.push(message.params.errorText);
  }
});
function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression, awaitPromise = false) {
  const response = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result.value;
}

await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable')]);
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await evaluate(`new Promise((resolve,reject)=>{const start=Date.now();const timer=setInterval(()=>{if(window.__routeScene?.powerRoot&&document.querySelector('#route-scene.live')&&document.querySelector('.sprite.traction')){clearInterval(timer);resolve(true)}else if(Date.now()-start>35000){clearInterval(timer);reject(new Error('完整驾驶台项目初始化超时'))}},100)})`, true);

const nearbyMastDistances = await evaluate(`fetch('../assets/msts-neiyi-corridor/neiyi-lookout-full-scene.json',{cache:'no-store'}).then((response)=>response.json()).then((data)=>data.instances.filter((instance)=>/^SweGantry1\\.s$/i.test(instance.shape||'')).map((instance)=>window.__routeScene.projectPointToPath(instance.position,6500)?.alongDistance).filter((distance)=>Number.isFinite(distance)&&distance>${n.noDoublePantograph - 100}&&distance<${n.noDoublePantograph + 100}).map((distance)=>Math.round(distance*10)/10).sort((a,b)=>a-b))`, true);
const firstMastAfterNoDouble = nearbyMastDistances.find((distance) => distance > n.noDoublePantograph);
assert(firstMastAfterNoDouble - n.noDoublePantograph >= 12, '禁止双弓标必须位于邻近接触网支柱前方，且纵向间隔不少于12米');

const summary = await evaluate(`(()=>{const names=[];let correctlyOrientedSourceSigns=0;let scaledSourceSigns=0;window.__routeScene.routeRoot.traverse((object)=>{if(object.name)names.push(object.name);if(object.userData?.backAsset&&object.children.some((child)=>child.name.endsWith('_FRONT')&&Math.abs(child.rotation.y)<.001)&&object.children.some((child)=>child.name.endsWith('_BACK')&&Math.abs(child.rotation.y-Math.PI)<.001))correctlyOrientedSourceSigns+=1;if(object.userData?.backAsset&&object.scale.x>=1.9&&object.scale.y>=1.6)scaledSourceSigns+=1});const s=window.__trainingSim.state;const prematurelyVisiblePowerSigns=window.__routeScene.powerRoot.children.filter((object)=>Number.isFinite(Number(object.userData?.powerDistance))&&object.visible&&Number(object.userData.powerDistance)-s.distance>420).map((object)=>object.name);return{
  title:document.title,app:document.body.dataset.trainingApp,mode:s.trainingMode,scope:s.trainingScope,
  speed:Math.round(s.speed),rearPantograph:s.rearPantograph,frontPantograph:s.frontPantograph,compressor:s.compressorSwitch,
  handles:['auto-brake','independent-brake','traction','direction'].every((name)=>document.querySelector('.sprite.'+name)),
  needles:document.querySelectorAll('.original-game-needle').length,
  lkj:Boolean(document.querySelector('.lkj-trigger')),cir:Boolean(document.querySelector('.cir-hotspot')),
  parking:Boolean(document.querySelector('.parking-apply')&&document.querySelector('.parking-release')),
  pathLength:window.__routeScene.pathLength,
  railLodSegments:names.filter((name)=>name.startsWith('MAINLINE_RAIL_VISIBILITY_')).length,
  railTopLayer:window.__routeScene.railVisibilityMaterials.some((material)=>material.name==='LOOKOUT_DISTANT_RAIL_TOP_MATERIAL'),
  railSideLayer:window.__routeScene.railVisibilityMaterials.some((material)=>material.name==='LOOKOUT_DISTANT_RAIL_SIDE_MATERIAL'),
  railFadeRanges:window.__routeScene.railVisibilityMaterials.map((material)=>[material.uniforms.nearFadeStart.value,material.uniforms.nearFadeEnd.value]),
  powerSigns:names.filter((name)=>name.startsWith('POWER_SIGN_')).length,
  sourceSignRoots:names.filter((name)=>name.startsWith('POWER_SIGN_')&&name.endsWith('_FRONT')).length,
  correctlyOrientedSourceSigns,
  prematurelyVisiblePowerSigns,
  scaledSourceSigns,
  incorrectPreviewSigns:names.some((name)=>name.startsWith('POWER_SIGN_NEUTRAL_PREVIEW_')),
  tBreakFaces:['T_BREAK_FRONT','T_BREAK_BACK'].every((name)=>names.includes(name)),
  sourceRouteClutter:window.__routeScene.routeRoot.children.filter((object)=>/^(?:duan|jinzhi-shuanggong|quxianbiao|qiaoliangbiao)\.s:/i.test(object.name)||/^SOURCE_(?:DWARF|ROUTE_SIGNAL)/.test(object.name)).map((object)=>object.name),
  requiredSigns:['POWER_SIGN_NO_DOUBLE_PANTOGRAPH_${n.noDoublePantograph}','POWER_SIGN_POWER_OFF_${n.breakSign}','POWER_SIGN_POWER_ON_${n.closeSign}','POWER_SIGN_LOWER_PANTOGRAPH_${p.lowerSign}','POWER_SIGN_RAISE_PANTOGRAPH_${p.raiseSign}'].every((name)=>names.includes(name)),
  neutralBoundaries:names.includes('POWER_NEUTRAL_SECTION_START')&&names.includes('POWER_NEUTRAL_SECTION_END'),
  powerRoot:names.includes('POWER_TRAINING_SCENERY'),onsitePerson:names.includes('POWER_ONSITE_HAND_SIGNAL_PERSON'),
  handSignalCard:Boolean(document.querySelector('.hand-signal-card')),
  hazard:names.some((name)=>name.startsWith('POWER_HAZARD_')),
  scoreGuideItems:document.querySelectorAll('.power-score-group li').length,
  overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
}})()`);
assert.equal(summary.title, '途中过分相+升降弓');
assert.equal(summary.app, 'power-training');
assert.equal(summary.mode, 'assessment');
assert.equal(summary.scope, 'power-training');
assert.equal(summary.speed, 55);
assert.equal(summary.rearPantograph, true);
assert.equal(summary.frontPantograph, false);
assert.equal(summary.compressor, 'auto');
assert.equal(summary.handles, true);
assert(summary.needles >= 9);
assert.equal(summary.lkj, true);
assert.equal(summary.cir, true);
assert.equal(summary.parking, true);
assert(summary.pathLength > POWER_TRAINING_CONFIG.finishDistance);
assert.equal(summary.railLodSegments, 8);
assert.equal(summary.railTopLayer, true);
assert.equal(summary.railSideLayer, true);
assert(summary.railFadeRanges.every(([start,end])=>start>=40&&start<=90&&end>=110&&end<=180));
assert.equal(summary.powerSigns, 20);
assert.equal(summary.sourceSignRoots, 6);
assert.equal(summary.correctlyOrientedSourceSigns, 6);
assert.deepEqual(summary.prematurelyVisiblePowerSigns, []);
assert.equal(summary.scaledSourceSigns, 6);
assert.equal(summary.incorrectPreviewSigns, false);
assert.equal(summary.tBreakFaces, true);
assert.deepEqual(summary.sourceRouteClutter, []);
assert.equal(summary.requiredSigns, true);
assert.equal(summary.neutralBoundaries, true);
assert.equal(summary.powerRoot, true);
assert.equal(summary.onsitePerson, false);
assert.equal(summary.handSignalCard, false);
assert.equal(summary.hazard, true);
assert.equal(summary.scoreGuideItems, 13);
assert.equal(summary.overflowX, false);

await evaluate(`(()=>{const s=window.__trainingSim.state;s.running=false;s.distance=${n.noDoublePantograph - 50};window.__routeScene.update(s.distance,s.speed,'front',false,s.wholeTrainStartFraction);return true})()`);
await new Promise((resolve) => setTimeout(resolve, 180));
const signShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
const signScreenshotPath = screenshotPath.replace(/\.png$/i, '-no-double-sign.png');
await writeFile(signScreenshotPath, Buffer.from(signShot.data, 'base64'));

await evaluate(`document.querySelector('.switch-panel-trigger').click();true`);
await new Promise((resolve) => setTimeout(resolve, 120));
const docked = await evaluate(`(()=>{const stage=document.querySelector('#stage').getBoundingClientRect();const panel=document.querySelector('.power-switch-docked .switch-panel-shell').getBoundingClientRect();return{open:document.querySelector('.power-switch-docked').classList.contains('open'),inside:panel.left>=stage.left&&panel.right<=stage.right+1&&panel.bottom<=stage.bottom+1,upperViewClear:panel.top>=stage.top+stage.height*.45}})()`);
assert.deepEqual(docked, { open: true, inside: true, upperViewClear: true });
await evaluate(`window.__trainingCommand('main-breaker','open');true`);
const maintained = await evaluate(`(()=>{const s=window.__trainingSim.state;const b=document.querySelector('[data-switch-id="main-breaker"]');return{switch:s.mainBreakerSwitch,actual:s.mainBreaker,down:b.classList.contains('state-down'),panelOpen:document.querySelector('.power-switch-docked').classList.contains('open')}})()`);
assert.deepEqual(maintained, { switch: 'open', actual: false, down: true, panelOpen: true });
const threePosition = await evaluate(`(()=>{const b=document.querySelector('[data-switch-id="main-breaker"]');const r=b.getBoundingClientRect();const click=(ratio)=>b.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height*ratio}));click(.5);const middle={switch:window.__trainingSim.state.mainBreakerSwitch,actual:window.__trainingSim.state.mainBreaker,css:b.classList.contains('state-mid')};click(.1);const upper={switch:window.__trainingSim.state.mainBreakerSwitch,actual:window.__trainingSim.state.mainBreaker,css:b.classList.contains('state-up')};click(.9);const lower={switch:window.__trainingSim.state.mainBreakerSwitch,actual:window.__trainingSim.state.mainBreaker,css:b.classList.contains('state-down')};return{middle,upper,lower}})()`);
assert.deepEqual(threePosition, {
  middle: { switch: 'zero', actual: false, css: true },
  upper: { switch: 'close', actual: true, css: true },
  lower: { switch: 'open', actual: false, css: true },
});
const switchShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
const switchScreenshotPath = screenshotPath.replace(/\.png$/i, '-switch-panel.png');
await writeFile(switchScreenshotPath, Buffer.from(switchShot.data, 'base64'));
await evaluate(`document.querySelector('.switch-panel-close').click();document.querySelector('.lkj-trigger').click();true`);
await new Promise((resolve) => setTimeout(resolve, 120));
assert.equal(await evaluate(`document.querySelector('.lkj-modal').classList.contains('open')`), true);
await evaluate(`document.querySelector('.lkj-modal .device-close').click();document.querySelector('.cir-hotspot').click();true`);
await new Promise((resolve) => setTimeout(resolve, 180));
assert.equal(await evaluate(`document.querySelector('.cir-modal').classList.contains('open')`), true);
await evaluate(`document.querySelector('.cir-modal .device-close').click();true`);
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile(screenshotPath, Buffer.from(shot.data, 'base64'));

await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true, screenWidth: 844, screenHeight: 390 });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await evaluate(`window.dispatchEvent(new Event('resize'));document.querySelector('.switch-panel-trigger').click();true`);
await new Promise((resolve) => setTimeout(resolve, 160));
const mobileLayout = await evaluate(`(()=>{const stage=document.querySelector('#stage').getBoundingClientRect();const panel=document.querySelector('.power-switch-docked .switch-panel-shell').getBoundingClientRect();return{overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,panelInside:panel.left>=stage.left&&panel.right<=stage.right+1,upperViewClear:panel.top>=stage.top+stage.height*.4}})()`);
assert.deepEqual(mobileLayout, { overflowX: false, panelInside: true, upperViewClear: true });

const safetyBoundary = await evaluate(`(()=>{const s=window.__trainingSim.state;
  s.distance=${p.prepare + 20};s.panto=true;s.mainBreaker=true;s.mainBreakerSwitch='close';s.netVoltage=25;const lowerAccepted=window.__trainingCommand('panto','down');
  s.distance=${p.hazardEnd + 50};s.panto=false;s.mainBreaker=false;s.netVoltage=0;const raiseAccepted=window.__trainingCommand('panto','up');
  s.distance=${n.sectionEnd + 20};s.panto=true;s.mainBreaker=false;s.mainBreakerSwitch='open';s.netVoltage=25;const closeAccepted=window.__trainingCommand('main-breaker','close');
  return {lowerAccepted,raiseAccepted,closeAccepted,incidents:s.assessment.incidents.map((incident)=>incident.code)}
})()`);
console.log(JSON.stringify({ safetyBoundary }));
assert.equal(safetyBoundary.lowerAccepted, true);
assert.equal(safetyBoundary.raiseAccepted, true);
assert.equal(safetyBoundary.closeAccepted, true);
assert(safetyBoundary.incidents.includes('lower-with-breaker-closed'));
assert(safetyBoundary.incidents.includes('early-raise'));
assert(safetyBoundary.incidents.includes('early-breaker-close'));

await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setTouchEmulationEnabled', { enabled: false });
await send('Page.navigate', { url });
await evaluate(`new Promise((resolve,reject)=>{const start=Date.now();const timer=setInterval(()=>{if(window.__routeScene?.powerRoot&&document.querySelector('#route-scene.live')&&window.__powerAssessment){clearInterval(timer);resolve(true)}else if(Date.now()-start>35000){clearInterval(timer);reject(new Error('满分流程复测初始化超时'))}},100)})`, true);
const perfectAttempt = await evaluate(`(()=>{const s=window.__trainingSim.state;const a=window.__powerAssessment;const move=(distance)=>{s.distance=distance;a.update(s)};const callout=()=>a.recordAction('callout',true,s);
  move(${n.preview});callout();
  move(${n.noDoublePantograph - 54});callout();window.__trainingCommand('traction',0);
  move(${n.tBreak + 1});window.__trainingCommand('main-breaker','open');
  move(${n.sectionStart + 1});move(${n.sectionEnd + 1});
  move(${n.closeWindowStart + 1});s.netVoltage=25;s.lineVoltage=true;window.__trainingCommand('main-breaker','close');
  move(${n.closeWindowEnd + 1});window.__trainingCommand('traction',2);
  move(${p.preview});callout();
  move(${p.prepare + 10});window.__trainingCommand('traction',0);window.__trainingCommand('main-breaker','open');
  move(${p.lowerSign - 5});window.__trainingCommand('panto','down');
  move(${p.hazardStart + 1});move(${p.hazardEnd + 1});
  move(${p.raiseSign + 5});window.__trainingCommand('panto','up');s.netVoltage=25;s.lineVoltage=true;window.__trainingCommand('main-breaker','close');window.__trainingCommand('traction',2);
  move(${POWER_TRAINING_CONFIG.finishDistance});window.__trainingSim.emit('满分流程复测');
  return {checks:Object.values(s.assessment.checks).filter(Boolean).length,totalChecks:Object.keys(s.assessment.checks).length,invalidScenes:s.assessment.invalidScenes,incidents:s.assessment.incidents.map((item)=>item.code)}
})()`);
await new Promise((resolve) => setTimeout(resolve, 100));
perfectAttempt.liveScore = await evaluate(`document.querySelector('#power-live-score').textContent`);
perfectAttempt.completedRows = await evaluate(`document.querySelectorAll('#procedure li.done').length`);
assert.deepEqual(perfectAttempt, { checks: 13, totalChecks: 13, invalidScenes: [], incidents: [], liveScore: '100/100分', completedRows: 13 });

assert.deepEqual(errors, []);
assert.deepEqual(networkErrors, []);
socket.close();
console.log(JSON.stringify({ summary, nearbyMastDistances, firstMastAfterNoDouble, docked, maintained, threePosition, mobileLayout, safetyBoundary, perfectAttempt, screenshotPath, switchScreenshotPath, signScreenshotPath }, null, 2));
