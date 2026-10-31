// Headless Edge를 CDP로 띄워 index.html을 file://로 검사한다. 시나리오는 scenario.mjs에 있다.
// 실행: node tests/browser.mjs (스크린샷은 tests/shots/에 저장)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const INDEX = join(here, '..', 'index.html');
const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync);
if (!EDGE) { console.log('NO BROWSER FOUND'); process.exit(2); }

const PORT = 9333;
const profile = join(here, 'edge-profile');
const shots = join(here, 'shots');
mkdirSync(shots, { recursive: true });
const proc = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });

let targets;
for (let i = 0; i < 50 && !targets; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); }
  catch { await new Promise((r) => setTimeout(r, 200)); }
}
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));

let seq = 0;
const pending = new Map();
const problems = [];
const loads = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') problems.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') problems.push(m.params.args.map((a) => a.value).join(' '));
  if (m.method === 'Page.loadEventFired') loads.shift()?.();
});
const send = (method, params = {}) => new Promise((r) => {
  const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description);
  return r.result?.result?.value;
};
const loaded = () => new Promise((r) => loads.push(r));
const reload = async () => { const w = loaded(); await send('Page.reload'); await w; };
const open = async () => { const w = loaded(); await send('Page.navigate', { url: pathToFileURL(INDEX).href }); await w; };
const size = (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const file = join(shots, `${name}.png`);
  writeFileSync(file, Buffer.from(r.result.data, 'base64'));
  return file;
};

// 다음 페이지 로드부터 Date의 오늘을 고정한다. null이면 실제 날짜로 돌아간다.
let dateScript = null;
const setToday = async (dateKey) => {
  if (dateScript !== null) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: dateScript });
  dateScript = null;
  if (dateKey === null) return;
  const [y, m, d] = dateKey.split('-').map(Number);
  const r = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      const Real = Date;
      const fixed = new Real(${y}, ${m - 1}, ${d}, 12).getTime();
      globalThis.Date = class extends Real {
        constructor(...args) { if (args.length) super(...args); else super(fixed); }
        static now() { return fixed; }
      };
    })();`,
  });
  dateScript = r.result.identifier;
};

let failed = 0;
const check = (label, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail !== '' ? ` -> ${detail}` : ''}`); };

await send('Page.enable');
await send('Runtime.enable');
await size(1200, 800);
await open();
await evaluate('localStorage.clear()');
await reload();

const scenario = await import(pathToFileURL(join(here, 'scenario.mjs')).href);
try {
  await scenario.default({ evaluate, reload, size, shot, check, setToday });
  check('콘솔 오류 없음', problems.length === 0, problems.join(' | '));
} finally {
  ws.close();
  proc.kill();
  await new Promise((r) => setTimeout(r, 500));
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch {}
}
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
