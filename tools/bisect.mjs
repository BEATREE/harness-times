/**
 * 横向溢出「二分隐藏」定位器
 *
 * 思路：溢出根因并不总是自己 scrollWidth > clientWidth（它可能只是被自己的
 * min-content 撑大）。所以换一种确定性的做法：
 *   从 .app 开始，逐个把子元素 display:none，看 document.scrollWidth 是否
 *   回落到视口宽度；一旦回落，那个元素就是「罪魁」，再递归进去，直到叶子。
 *
 * 用法：node ht-bisect.mjs [路径] [宽度]
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME =
  process.env.HT_CHROME ||
  'C:\\Users\\BEATREE\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const BASE = 'http://127.0.0.1:4321';
const PATH = process.argv[2] || '/harness/harness-02-agent-loop/';
const WIDTH = Number(process.argv[3] || 390);
const PORT = 9342;

const profile = mkdtempSync(join(tmpdir(), 'ht-bisect-'));
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--disable-software-rasterizer', '--disable-dev-shm-usage',
    '--disable-features=Vulkan', '--no-sandbox', 'about:blank',
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((t) => t.type === 'page');
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('devtools 未就绪');
}

const BISECT = `(() => {
  const vw = document.documentElement.clientWidth;
  const limit = vw + 2;
  const sw = () => document.documentElement.scrollWidth;
  const name = (el) => {
    const cls = typeof el.className === 'string'
      ? el.className.trim().split(/\\s+/).filter(Boolean).slice(0, 3).join('.') : '';
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '') + (el.id ? '#' + el.id : '');
  };
  const path = [];
  let node = document.querySelector('.app') || document.body;
  let guard = 0;
  while (node && guard++ < 60) {
    const kids = [...node.children].filter((k) => {
      const cs = getComputedStyle(k);
      return cs.display !== 'none' && cs.position !== 'fixed';
    });
    let hit = null;
    for (const k of kids) {
      const prev = k.style.display;
      k.style.display = 'none';
      const after = sw();
      k.style.display = prev;
      if (after <= limit) { hit = k; break; }
    }
    if (!hit) break;
    const r = hit.getBoundingClientRect();
    const cs = getComputedStyle(hit);
    path.push({
      el: name(hit),
      rectW: Math.round(r.width),
      display: cs.display,
      overflowX: cs.overflowX,
      whiteSpace: cs.whiteSpace,
      columnCount: cs.columnCount,
      columnWidth: cs.columnWidth,
      tableLayout: cs.tableLayout,
      width: cs.width,
      minWidth: cs.minWidth,
      sample: (hit.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 90),
    });
    node = hit;
  }
  return { vw, scrollW: sw(), path };
})()`;

let cdp;
try {
  const ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const events = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    } else if (m.method && events.has(m.method)) {
      events.get(m.method).forEach((f) => f(m.params));
      events.delete(m.method);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const once = (method) => new Promise((r) => events.set(method, [r]));

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH, height: 844, deviceScaleFactor: 2, mobile: true,
  });
  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url: BASE + PATH });
  await loaded;
  await sleep(900);

  const r = await send('Runtime.evaluate', {
    expression: BISECT, returnByValue: true, awaitPromise: true,
  });
  const v = r.result.value;

  console.log(`\n${PATH}  视口=${v.vw}  文档 scrollWidth=${v.scrollW}`);
  console.log('\n=== 罪魁链条（每步隐藏后宽度即回落）===');
  v.path.forEach((p, i) => {
    console.log(`${'  '.repeat(i + 1)}${i + 1}. <${p.el}>  rectW=${p.rectW}`);
    console.log(`${'  '.repeat(i + 1)}   display=${p.display} overflowX=${p.overflowX} whiteSpace=${p.whiteSpace} width=${p.width} minWidth=${p.minWidth}`);
    if (p.columnCount !== 'auto' || p.columnWidth !== 'auto')
      console.log(`${'  '.repeat(i + 1)}   columns: count=${p.columnCount} width=${p.columnWidth}`);
    console.log(`${'  '.repeat(i + 1)}   样本: ${JSON.stringify(p.sample)}`);
  });
  if (!v.path.length) console.log('  （未能通过隐藏任一子元素使宽度回落，说明是多个元素共同造成）');
  console.log();

  ws.close();
} catch (e) {
  console.error('异常：', e.message);
  process.exitCode = 1;
} finally {
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
