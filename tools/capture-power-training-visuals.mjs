import { writeFile } from 'node:fs/promises';

const port = Number(process.env.CDP_PORT || 9228);
const outputBase = process.env.SCREENSHOT_PATH || `${process.env.TEMP || '.'}/power-training-qa.png`;
const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const page = pages.find((entry) => entry.type === 'page' && /power-training/.test(entry.url));
if (!page) throw new Error('未找到已加载的项目页面');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let id = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!pending.has(message.id)) return;
  const handler = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) handler.reject(new Error(message.error.message));
  else handler.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const callId = ++id;
  pending.set(callId, { resolve, reject });
  socket.send(JSON.stringify({ id: callId, method, params }));
});
const evaluate = async (expression, awaitPromise = false) => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
await Promise.all([send('Page.enable'), send('Runtime.enable')]);
await send('Page.reload', { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 250));
await evaluate(`new Promise((resolve,reject)=>{const start=Date.now();const timer=setInterval(()=>{if(window.__powerTraining?.scene?.powerRoot){clearInterval(timer);resolve(true)}else if(Date.now()-start>30000){clearInterval(timer);reject(new Error('项目初始化超时'))}},100)})`, true);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await evaluate(`document.querySelectorAll('.modal.open').forEach((item)=>item.classList.remove('open'));window.__powerTraining.setDistance(3960);true`);
await new Promise((resolve) => setTimeout(resolve, 250));
const hazard = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
const hazardPath = outputBase.replace(/\.png$/i, '-hazard.png');
await writeFile(hazardPath, Buffer.from(hazard.data, 'base64'));
await send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true, screenWidth: 844, screenHeight: 390 });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await evaluate(`window.dispatchEvent(new Event('resize'));true`);
await new Promise((resolve) => setTimeout(resolve, 160));
const layout = await evaluate(`(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return{width:Math.round(r.width),height:Math.round(r.height),overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}})()`);
const mobile = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
const mobilePath = outputBase.replace(/\.png$/i, '-mobile.png');
await writeFile(mobilePath, Buffer.from(mobile.data, 'base64'));
socket.close();
console.log(JSON.stringify({ hazardPath, mobilePath, layout }, null, 2));

