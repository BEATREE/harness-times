#!/usr/bin/env node
/**
 * 版面度量：把「正文是否真的居中、左右留白是否等宽」用数字量出来。
 *
 * 为什么不能靠眼睛看截图：
 *   截图缩放之后 5~10px 的偏差根本看不出来，而「左右留白等宽」这个要求
 *   恰恰就是几十个像素级别的对齐问题。这里直接读 getBoundingClientRect。
 *
 * 用法：
 *   node scripts/measure.mjs --base=http://127.0.0.1:4321
 *   node scripts/measure.mjs --base=... --w=1280
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;

const CHROME =
  process.env.HT_CHROME ||
  'C:\\Users\\BEATREE\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
const BASE = arg('base', 'http://127.0.0.1:4321').replace(/\/$/, '');
const PORT = Number(arg('port', 9346));

const PAGES = [
  { name: '章节页', path: '/harness/harness-02-agent-loop/', w: Number(arg('w', 1440)) || 1440 },
  { name: '章节页(1280)', path: '/harness/harness-02-agent-loop/', w: 1280 },
  { name: '章节页(1024)', path: '/harness/harness-02-agent-loop/', w: 1024 },
  { name: '章节页(768)', path: '/harness/harness-02-agent-loop/', w: 768 },
  { name: '章节页·侧栏收起', path: '/harness/harness-02-agent-loop/', w: 1440, js: 'document.body.classList.add("nav-collapsed")' },
  { name: '章节页·分组折叠', path: '/harness/harness-02-agent-loop/', w: 1440, js: 'document.querySelectorAll(".nav-group").forEach(function(g){g.classList.add("collapsed")})' },
  { name: '首页', path: '/', w: 1440 },
  { name: '关于页', path: '/about/', w: 1440 },
];

if (!existsSync(CHROME)) {
  console.error(`[measure] 找不到 Chromium：${CHROME}`);
  process.exit(1);
}

const profile = mkdtempSync(join(tmpdir(), 'ht-measure-'));
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((t) => t.type === 'page');
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch {
      /* 等端口 */
    }
    await sleep(200);
  }
  throw new Error('DevTools 端口未就绪');
}

const ws = new WebSocket(await wsUrl());
await new Promise((r, j) => {
  ws.addEventListener('open', r, { once: true });
  ws.addEventListener('error', j, { once: true });
});

let seq = 0;
const pending = new Map();
const events = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  } else if (m.method) events.push(m.method);
});
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, (x) => (x.error ? rej(new Error(x.error.message)) : res(x.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
});

const EXPR = `(() => {
  const R = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) };
  };
  const pre = document.querySelector('.code-block pre');
  const cb = document.querySelector('.code-block');
  return {
    vw: document.documentElement.clientWidth,
    sidebar: R('.sidebar'),
    main: R('.main'),
    sheet: R('.sheet'),
    prose: R('.prose'),
    head: R('.chapter-head'),
    foot: R('.chapter-foot'),
    codeBlock: cb ? R('.code-block') : null,
    preScroll: pre ? { client: pre.clientWidth, scroll: pre.scrollWidth } : null,
    docScrollW: document.documentElement.scrollWidth,
    // 侧栏各分组的实际底色（验证「按领域配色」真的生效，而不是只写了 CSS）
    navColors: Array.from(document.querySelectorAll('.nav-group[data-domain]')).map((g) => {
      const head = g.querySelector('.nav-label');
      return {
        domain: g.getAttribute('data-domain'),
        bg: head ? getComputedStyle(head).backgroundColor : '-',
        fg: head ? getComputedStyle(head).color : '-',
        collapsed: g.classList.contains('collapsed'),
        itemsHeight: Math.round(g.querySelector('.nav-group-body')?.getBoundingClientRect().height ?? -1),
      };
    }),
    // 正文左边界与右边界相对「可读区」的留白
    gap: (() => {
      const m = document.querySelector('.main')?.getBoundingClientRect();
      const p = document.querySelector('.prose')?.getBoundingClientRect();
      if (!m || !p) return null;
      return { left: Math.round(p.left - m.left), right: Math.round(m.right - p.right) };
    })(),
  };
})()`;

let bad = 0;
console.log(`[measure] ${BASE}\n`);

for (const page of PAGES) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: page.w,
    height: 900,
    deviceScaleFactor: 1,
    mobile: page.w < 700,
  });
  await send('Page.navigate', { url: BASE + page.path });
  const before = events.length;
  for (let i = 0; i < 100; i++) {
    if (events.slice(before).includes('Page.loadEventFired')) break;
    await sleep(100);
  }
  await sleep(250);

  if (page.js) {
    await send('Runtime.evaluate', { expression: page.js, awaitPromise: false });
    await sleep(450); // 等过渡动画结束再量，否则量到的是动画中间态
  }

  const { result } = await send('Runtime.evaluate', { expression: EXPR, returnByValue: true });
  const m = result.value;

  console.log(`── ${page.name}  @${page.w}px   视口 ${m.vw}  文档 scrollWidth ${m.docScrollW}`);
  if (m.sidebar) console.log(`   侧栏      ${m.sidebar.l} → ${m.sidebar.r}  (宽 ${m.sidebar.w})`);
  if (m.main) console.log(`   主区      ${m.main.l} → ${m.main.r}  (宽 ${m.main.w})`);
  if (m.sheet) console.log(`   纸面      ${m.sheet.l} → ${m.sheet.r}  (宽 ${m.sheet.w})`);
  if (m.prose) console.log(`   正文栏    ${m.prose.l} → ${m.prose.r}  (宽 ${m.prose.w})`);
  if (m.codeBlock) console.log(`   代码块    ${m.codeBlock.l} → ${m.codeBlock.r}  (宽 ${m.codeBlock.w})`);
  if (m.preScroll && m.preScroll.scroll > m.preScroll.client + 1)
    console.log(`     └ 代码内部横向滚动：${m.preScroll.scroll} / ${m.preScroll.client}`);

  if (m.gap) {
    const diff = Math.abs(m.gap.left - m.gap.right);
    const ok = diff <= 2;
    if (!ok) bad += 1;
    console.log(
      `   正文左右留白  左 ${m.gap.left} / 右 ${m.gap.right}   差 ${diff}px  ${ok ? 'ok' : '不对称 ×'}`
    );
  }

  if (m.prose && m.codeBlock && m.codeBlock.w > m.prose.w + 1) {
    bad += 1;
    console.log(`   代码块比正文栏宽：${m.codeBlock.w} > ${m.prose.w}  ×`);
  }

  if (m.docScrollW > m.vw + 1) {
    bad += 1;
    console.log(`   横向溢出：文档 ${m.docScrollW} > 视口 ${m.vw}  ×`);
  }

  if (m.navColors?.length) {
    for (const c of m.navColors) {
      console.log(
        `   分组 ${c.domain.padEnd(9)} 底色 ${c.bg.padEnd(24)} 文字 ${c.fg.padEnd(20)} ${
          c.collapsed ? `已折叠(高 ${c.itemsHeight})` : '展开'
        }`
      );
      if (c.bg === 'rgba(0, 0, 0, 0)' || c.bg === 'transparent') {
        bad += 1;
        console.log(`     └ 分组 ${c.domain} 没有底色 ×`);
      }
    }
  }

  console.log('');
}

ws.close();
chrome.kill();
await sleep(300);
rmSync(profile, { recursive: true, force: true });
console.log(`[measure] 完成，异常 ${bad} 项`);
process.exitCode = bad ? 1 : 0;
