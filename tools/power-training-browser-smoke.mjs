import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const port = Number(process.env.CDP_PORT || 9228);
const url = process.env.TRAINING_URL || 'http://127.0.0.1:4178/power-training/?debug=1';
const screenshotPath = process.env.SCREENSHOT_PATH || `${process.env.TEMP || '.'}/power-training-browser-smoke.png`;
const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const page = pages.find((entry) => entry.type === 'page' && /power-training/.test(entry.url)) || pages.find((entry) => entry.type === 'page');
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
await evaluate(`new Promise((resolve,reject)=>{const start=Date.now();const timer=setInterval(()=>{if(window.__powerTraining?.scene?.powerRoot&&document.querySelector('#route-scene.live')){clearInterval(timer);resolve(true)}else if(Date.now()-start>35000){clearInterval(timer);reject(new Error('项目初始化超时'))}},100)})`, true);

const summary = await evaluate(`(()=>{const names=[];window.__powerTraining.scene.routeRoot.traverse((object)=>{if(object.name)names.push(object.name)});return{
  title:document.title,
  app:document.body.dataset.trainingApp,
  mode:window.__powerTraining.sim.state.mode,
  speed:window.__powerTraining.sim.state.speed,
  rearPantograph:window.__powerTraining.sim.state.rearPantograph,
  frontPantograph:window.__powerTraining.sim.state.frontPantograph,
  compressor:window.__powerTraining.sim.state.compressorSwitch,
  pathLength:window.__powerTraining.scene.pathLength,
  corridorLimited:Boolean(window.__powerTraining.scene.routeRoot.getObjectByName('MSTS_SOURCE_TERRAIN')?.userData.railwayCorridorLimited),
  powerSigns:names.filter((name)=>name.startsWith('POWER_SIGN_')).length,
  powerRoot:names.includes('POWER_TRAINING_SCENERY'),
  handSignal:names.includes('POWER_ONSITE_HAND_SIGNAL_PERSON'),
  hazard:names.some((name)=>name.startsWith('POWER_HAZARD_')),
  startModal:document.querySelector('#start-modal').classList.contains('open'),
  selectors:document.querySelectorAll('.selector').length,
  overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
  stage:[Math.round(document.querySelector('#stage').getBoundingClientRect().width),Math.round(document.querySelector('#stage').getBoundingClientRect().height)]
}})()`);
assert.equal(summary.title, '途中过分相+升降弓');
assert.equal(summary.app, 'power-training');
assert.equal(summary.mode, 'assessment');
assert.equal(summary.speed, 55);
assert.equal(summary.rearPantograph, true);
assert.equal(summary.frontPantograph, false);
assert.equal(summary.compressor, 'auto');
assert(summary.pathLength > 4350);
assert.equal(summary.corridorLimited, true);
assert.equal(summary.powerSigns, 6);
assert.equal(summary.powerRoot, true);
assert.equal(summary.handSignal, true);
assert.equal(summary.hazard, true);
assert.equal(summary.startModal, true);
assert.equal(summary.selectors, 3);
assert.equal(summary.overflowX, false);

await evaluate(`document.querySelector('#start-button').click();document.querySelector('#switch-panel-open').click();true`);
await evaluate(`document.querySelector('[data-command="breaker"][data-value="open"]').click();true`);
const maintained = await evaluate(`(()=>{const s=window.__powerTraining.sim.state;return{switch:s.mainBreakerSwitch,actual:s.mainBreaker,modal:document.querySelector('#switch-modal').classList.contains('open'),active:document.querySelector('[data-command="breaker"][data-value="open"]').classList.contains('active')}})()`);
assert.deepEqual(maintained, { switch: 'open', actual: false, modal: true, active: true });
const switchShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
const switchScreenshotPath = screenshotPath.replace(/\.png$/i, '-switch-panel.png');
await writeFile(switchScreenshotPath, Buffer.from(switchShot.data, 'base64'));
await evaluate(`document.querySelector('[data-close="switch-modal"]').click();document.querySelector('#reference-open').click();true`);
await new Promise((resolve) => setTimeout(resolve, 120));
const referenceShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
const referenceScreenshotPath = screenshotPath.replace(/\.png$/i, '-reference.png');
await writeFile(referenceScreenshotPath, Buffer.from(referenceShot.data, 'base64'));
await evaluate(`document.querySelector('[data-close="reference-modal"]').click();window.__powerTraining.setDistance(1575);true`);
await new Promise((resolve) => setTimeout(resolve, 300));
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile(screenshotPath, Buffer.from(shot.data, 'base64'));
await evaluate(`window.__powerTraining.setDistance(3960);true`);
await new Promise((resolve) => setTimeout(resolve, 220));
const hazardShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
const hazardScreenshotPath = screenshotPath.replace(/\.png$/i, '-hazard.png');
await writeFile(hazardScreenshotPath, Buffer.from(hazardShot.data, 'base64'));

await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true, screenWidth: 844, screenHeight: 390 });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await evaluate(`window.dispatchEvent(new Event('resize'));true`);
await new Promise((resolve) => setTimeout(resolve, 180));
const mobileLayout = await evaluate(`(()=>{const rect=document.querySelector('#stage').getBoundingClientRect();return{stage:[Math.round(rect.width),Math.round(rect.height)],overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`);
assert.deepEqual(mobileLayout, { stage: [844, 390], overflowX: false });
const mobileShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
const mobileScreenshotPath = screenshotPath.replace(/\.png$/i, '-mobile.png');
await writeFile(mobileScreenshotPath, Buffer.from(mobileShot.data, 'base64'));

assert.deepEqual(errors, []);
assert.deepEqual(networkErrors, []);
socket.close();
console.log(JSON.stringify({ summary, maintained, mobileLayout, screenshotPath, switchScreenshotPath, referenceScreenshotPath, hazardScreenshotPath, mobileScreenshotPath }, null, 2));

