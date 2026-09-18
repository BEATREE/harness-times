/**
 * 全站多视口横向溢出审计
 *
 * 一次性启一个浏览器，遍历所有页面 × 多个视口宽度，报告
 * document.scrollWidth 是否超出 clientWidth，并对其中的溢出页
 * 自动定位最深的溢出元素。
 *
 * 用法：node ht-audit.mjs
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME =
  process.env.HT_CHROME ||
  'C:\\Users\\BEATREE\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
/*
 * 用 localhost 而不是 127.0.0.1：
 * astro preview 在 Windows 上默认只绑 IPv6 回环（::1），写死 127.0.0.1 会连不上。
 * localhost 两个族都会试，对「绑 ::1」和「绑 127.0.0.1」两种起法都成立。
 */
const BASE = process.env.HT_BASE || 'http://localhost:4321';
const PORT = 9343;

const PATHS = [
  '/',
  '/about/',
  '/progress/',
  '/interview/',
  '/llm/',
  '/harness/',
  '/eval/',
  '/knowledge/',
  '/llm/llm-01-transformer/',
  '/llm/llm-02-kv-cache/',
  '/llm/llm-04-sampling/',
  '/harness/harness-02-agent-loop/',
  '/harness/harness-04-context-engineering/',
  '/harness/harness-06-multi-agent/',
  '/harness/harness-08-long-horizon/',
  '/eval/eval-04-insight-judge/',
  '/knowledge/knowledge-04-hybrid-trust/',
];

const VIEWPORTS = [
  { w: 360, h: 800, label: '手机 360' },
  { w: 390, h: 844, label: '手机 390' },
  { w: 768, h: 1024, label: '平板 768' },
  { w: 1280, h: 900, label: '桌面 1280' },
];

const OFFENDER = `(() => {
  const vw = document.documentElement.clientWidth;
  const desc = (el) => {
    const cls = typeof el.className === 'string'
      ? el.className.trim().split(/\\s+/).filter(Boolean).slice(0,3).join('.') : '';
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };
  const depth = (el) => { let d = 0; while ((el = el.parentElement)) d++; return d; };
  const list = [];
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > vw + 2) list.push({ d: desc(el), w: Math.round(r.width), dep: depth(el) });
  });
  list.sort((a, b) => b.dep - a.dep);
  return list.slice(0, 5);
})()`;

const profile = mkdtempSync(join(tmpdir(), 'ht-audit-'));
const chrome = spawn(
  CHROME,
  [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
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

let fails = 0;
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

  for (const vp of VIEWPORTS) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.w < 800,
    });
    console.log(`\n===== ${vp.label} (${vp.w}px) =====`);
    for (const p of PATHS) {
      const loaded = once('Page.loadEventFired');
      await send('Page.navigate', { url: BASE + p });
      await loaded;
      await sleep(320);
      const r = await send('Runtime.evaluate', {
        expression: `({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth })`,
        returnByValue: true,
      });
      const { s, c } = r.result.value;
      const over = s - c;
      const ok = over <= 2;
      if (!ok) {
        fails += 1;
        const o = await send('Runtime.evaluate', {
          expression: OFFENDER, returnByValue: true,
        });
        console.log(`  FAIL ${p}  scrollW=${s} clientW=${c} 溢出 ${over}px`);
        (o.result.value || []).forEach((x) =>
          console.log(`         最深溢出: <${x.d}> w=${x.w} depth=${x.dep}`));
      } else {
        console.log(`  ok   ${p}  (${s}px)`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(fails === 0 ? '全部视口无横向溢出。' : `共 ${fails} 处横向溢出待修。`);
  console.log('='.repeat(60));
  ws.close();
} catch (e) {
  console.error('审计异常：', e.message);
  process.exitCode = 1;
} finally {
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
