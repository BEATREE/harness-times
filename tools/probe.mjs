/**
 * 移动端横向溢出探针 —— 找出导致页面宽度失控的「真正源头」。
 *
 * 判定逻辑：
 *  1. 先找 scrollWidth > clientWidth 且 overflow-x 为 visible 的元素
 *     —— 这些是「内容撑破了盒子但没开滚动」的元素，是溢出的直接来源。
 *  2. 再取其中层级最深的若干项（最深者即根因，上层只是被它撑开）。
 *
 * 用法：node ht-probe.mjs [路径]
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
const PORT = 9341;

const profile = mkdtempSync(join(tmpdir(), 'ht-probe-'));
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-dev-shm-usage',
    '--disable-features=Vulkan',
    '--no-sandbox',
    'about:blank',
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

const PROBE = `(() => {
  const vw = document.documentElement.clientWidth;
  const desc = (el) => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\\s+/).slice(0,3).join('.') : '';
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '') +
      (el.id ? '#' + el.id : '');
  };
  const depthOf = (el) => { let d = 0; while ((el = el.parentElement)) d++; return d; };
  const cs = (el) => getComputedStyle(el);

  const overflowing = [];
  document.querySelectorAll('body *').forEach((el) => {
    const s = el.scrollWidth, c = el.clientWidth;
    if (s > c + 2 && cs(el).overflowX === 'visible') {
      overflowing.push({
        node: el, desc: desc(el), scrollW: s, clientW: c, depth: depthOf(el),
        w: Math.round(el.getBoundingClientRect().width),
      });
    }
  });

  // 真正的根因：其内部再无更深的溢出者
  const roots = overflowing.filter((o) =>
    !overflowing.some((x) => x.node !== o.node && o.node.contains(x.node))
  ).map((o) => {
    const s = cs(o.node);
    return {
      desc: o.desc, scrollW: o.scrollW, clientW: o.clientW, depth: o.depth, w: o.w,
      overflowX: s.overflowX, whiteSpace: s.whiteSpace, minWidth: s.minWidth,
      display: s.display, parent: o.node.parentElement ? desc(o.node.parentElement) : '',
      parentOverflowX: o.node.parentElement ? cs(o.node.parentElement).overflowX : '',
      // 最长的直接文本行有多宽
      longestLine: (() => {
        const t = o.node.textContent || '';
        const lines = t.split('\\n');
        return Math.max(0, ...lines.map((l) => l.length));
      })(),
      sample: (o.node.textContent || '').trim().slice(0, 70),
    };
  });

  // 也列出所有「宽于视口」的元素里最深的几个（用于判断链条）
  const wide = [];
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > vw + 2) wide.push({ desc: desc(el), w: Math.round(r.width), depth: depthOf(el) });
  });
  wide.sort((a, b) => b.depth - a.depth);

  return {
    vw,
    scrollW: document.documentElement.scrollWidth,
    docOverflow: document.documentElement.scrollWidth - vw,
    roots,
    deepestWide: wide.slice(0, 14),
  };
})()`;

let cdp;
try {
  const url = await wsUrl();
  const ws = new WebSocket(url);
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
  const goto = async (u) => {
    const p = once('Page.loadEventFired');
    await send('Page.navigate', { url: u });
    await p;
    await sleep(900);
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH, height: 844, deviceScaleFactor: 2, mobile: true,
  });
  await goto(BASE + PATH);

  const r = await send('Runtime.evaluate', {
    expression: PROBE, returnByValue: true, awaitPromise: true,
  });
  const v = r.result.value;

  console.log(`\n路径 ${PATH}  视口 ${v.vw}px  文档 scrollWidth ${v.scrollW}px  溢出 ${v.docOverflow}px\n`);
  console.log('=== 溢出根因（内部无更深溢出者）===');
  if (!v.roots.length) console.log('  无');
  v.roots.forEach((o) => {
    console.log(`  <${o.desc}>  scrollW=${o.scrollW} clientW=${o.clientW} rectW=${o.w}`);
    console.log(`     display=${o.display} overflowX=${o.overflowX} whiteSpace=${o.whiteSpace} minWidth=${o.minWidth}`);
    console.log(`     parent=<${o.parent}> parent.overflowX=${o.parentOverflowX} 最长文本行=${o.longestLine} 字符`);
    console.log(`     内容样本: ${JSON.stringify(o.sample)}`);
  });

  console.log('\n=== 宽于视口的元素（按层级由深到浅）===');
  v.deepestWide.forEach((o) => console.log(`  w=${String(o.w).padStart(5)}  depth=${o.depth}  <${o.desc}>`));
  console.log();

  ws.close();
} catch (e) {
  console.error('探针异常：', e.message);
  process.exitCode = 1;
} finally {
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
