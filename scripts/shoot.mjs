#!/usr/bin/env node
/**
 * 页面截图（零依赖 CDP）。
 *
 * 为什么不用现成的截图服务：
 *   本项目刻意保持零运行时依赖，测试工具走 tools/ 那套「直接聊 CDP」的路子，
 *   这里沿用它——用 Node 自带的 fetch + WebSocket，不引入 puppeteer。
 *
 * 用法：
 *   # 先起一个本地静态服务（astro preview 或任意 serve dist 的服务）
 *   node scripts/shoot.mjs --base=http://127.0.0.1:4321
 *
 * 参数：
 *   --base=   站点根地址，默认 http://127.0.0.1:4321
 *   --w=      视口宽，默认 1440
 *   --h=      视口高，默认 900
 *   --only=   只截名字包含该子串的镜头
 *
 * 产物：.shots/<name>.png
 *
 * 截图前会模拟 prefers-reduced-motion: reduce：
 *   这样入场动画不会在截图那一帧糊在一起，也顺带验证了「减少动效」分支可用。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, '.shots');

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;

const CHROME =
  process.env.HT_CHROME ||
  'C:\\Users\\BEATREE\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
/*
 * 用 localhost 而不是 127.0.0.1：astro preview 在 Windows 上默认只绑 IPv6 回环（::1），
 * 写死 127.0.0.1 会截到空白页（Chrome 连不上，但不会报错）。localhost 两个族都会试。
 */
const BASE = arg('base', 'http://localhost:4321').replace(/\/$/, '');
const W = Number(arg('w', 1440));
const H = Number(arg('h', 900));
const ONLY = arg('only', '');
const PORT = Number(arg('port', 9344));

/** 镜头清单：name / path / 可选视口 / 可选截图前执行的 JS */
const SHOTS = [
  { name: '01-home', path: '/', full: true },
  { name: '02-chapter-top', path: '/harness/harness-02-agent-loop/' },
  { name: '03-chapter-codeblock', path: '/harness/harness-02-agent-loop/', js: 'document.querySelector(".code-block")?.scrollIntoView({block:"center"})' },
  { name: '04-chapter-table', path: '/harness/harness-01-what-is-harness/', js: 'document.querySelector("table")?.scrollIntoView({block:"center"})' },
  { name: '05-sidebar-collapsed', path: '/harness/harness-02-agent-loop/', js: 'document.body.classList.add("nav-collapsed")' },
  { name: '06-sidebar-group-collapsed', path: '/harness/harness-02-agent-loop/', js: '(function(){var g=document.querySelector(".nav-group[data-domain=\'llm\']");g&&g.classList.add("collapsed");})()' },
  { name: '07-about-top', path: '/about/' },
  { name: '08-about-maker', path: '/about/', js: 'document.querySelector(".maker")?.scrollIntoView({block:"start"})' },
  { name: '09-about-related', path: '/about/', js: 'document.querySelector(".rel-group")?.scrollIntoView({block:"start"})' },
  { name: '10-progress', path: '/progress/' },
  { name: '11-interview', path: '/interview/' },
  { name: '12-mobile-home', path: '/', w: 390, h: 844 },
  { name: '13-mobile-chapter', path: '/harness/harness-02-agent-loop/', w: 390, h: 844, js: 'document.querySelector(".code-block")?.scrollIntoView({block:"center"})' },
  // 离场动画进行到一半时抓一帧：用来验收「不再灰屏」。
  // 必须让动效照常播（reducedMotion:false），否则 CSS 里 reduced-motion 分支
  // 会把动画整个关掉，抓到的就只是静止画面，什么都验证不了。
  {
    name: '14-transition-mid-exit',
    path: '/harness/harness-02-agent-loop/',
    reducedMotion: false,
    js: 'document.body.classList.add("is-leaving")',
    wait: 95,
  },
  // 正文两侧的大翻页区：hover 态的底色/描边/位移变化只能靠真实鼠标移动触发
  // （CSS 里就是 :hover），所以走 CDP 的 Input.dispatchMouseEvent。
  // 面板本身够大（150×315），不需要滚动就整块在视口内。
  { name: '15-rail-prev', path: '/harness/harness-02-agent-loop/', hoverSel: '.page-rail.rail-prev' },
  { name: '16-rail-next', path: '/harness/harness-02-agent-loop/', hoverSel: '.page-rail.rail-next' },
  // 图解的流向动效：必须开着动效抓，否则只能看到静止的图。
  // wait 要足够长：入场动画是「按序号递增延迟」的，元素多的图要 1.3s 才走完，
  // 这时候抓到的图才是最后静止的样子（不然拍到的是一张半空的纸）。
  {
    name: '17-diagram-flow',
    path: '/harness/harness-08-long-horizon/',
    reducedMotion: false,
    js: 'document.querySelector("figure.fig")?.scrollIntoView({block:"center"})',
    wait: 2400,
  },
  {
    name: '18-mobile-diagram',
    path: '/harness/harness-08-long-horizon/',
    w: 390,
    h: 844,
    reducedMotion: false,
    js: 'document.querySelector("figure.fig")?.scrollIntoView({block:"center"})',
    wait: 2400,
  },
  // 故意在入场动画进行到一半时抓一帧，用来证明「逐个落版」真的在跑
  {
    name: '21-diagram-entrance-mid',
    path: '/harness/harness-08-long-horizon/',
    reducedMotion: false,
    js: 'document.querySelector("figure.fig")?.scrollIntoView({block:"center",behavior:"instant"})',
    wait: 420,
  },
  // 同一张图、关掉动效的对照帧：判断「图本身是不是空的」全靠它，
  // 否则很容易把「动画没跑完」误判成「图解被写坏了」。
  {
    name: '22-diagram-static',
    path: '/harness/harness-08-long-horizon/',
    js: 'document.querySelector("figure.fig")?.scrollIntoView({block:"center",behavior:"instant"})',
  },
  { name: '19-about-cta', path: '/about/', js: 'document.querySelector(".cta-row")?.scrollIntoView({block:"start"})' },
  { name: '20-chapter-1440', path: '/harness/harness-02-agent-loop/', w: 1440, h: 900 },
  // 1280px：翻页区整体退场，翻页能力交给章尾 .pager（滚到页尾才看得到）。
  // 和 20 号并排看，能一眼确认「断点确实在 1300 而不是别处」。
  { name: '23-chapter-1280-no-rail', path: '/harness/harness-02-agent-loop/', w: 1280, h: 900, js: 'window.scrollTo(0, document.body.scrollHeight)' },
  // 出口区的两个断点：1100px 应降成「主站独占一行 + 两块并排」，
  // 620px 应全部堆叠。三张并排时最容易出的问题是 cta-d 说明文案被压成「一列一个字」，
  // 只看 1440px 的广角图是发现不了的。
  { name: '24-about-cta-1100', path: '/about/', w: 1100, h: 720, js: 'document.querySelector(".cta-row")?.scrollIntoView({block:"start"})' },
  { name: '25-about-cta-620', path: '/about/', w: 620, h: 900, js: 'document.querySelector(".cta-row")?.scrollIntoView({block:"start"})' },
];

if (!existsSync(CHROME)) {
  console.error(`[shoot] 找不到 Chromium：${CHROME}\n设 HT_CHROME 环境变量指向可执行文件。`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const profile = mkdtempSync(join(tmpdir(), 'ht-shoot-'));
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
    '--dev-shm-usage',
    '--disable-features=Vulkan',
    '--no-sandbox',
    `--window-size=${W},${H}`,
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
      /* 还没起来 */
    }
    await sleep(200);
  }
  throw new Error('DevTools 端口未就绪');
}

const url = await wsUrl();
const ws = new WebSocket(url);
await new Promise((r, j) => {
  ws.addEventListener('open', r, { once: true });
  ws.addEventListener('error', j, { once: true });
});

let seq = 0;
const pending = new Map();
const events = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method) {
    events.push(msg.method);
  }
});

const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });

await send('Page.enable');
await send('Runtime.enable');

const shots = SHOTS.filter((s) => !ONLY || s.name.includes(ONLY));
console.log(`[shoot] ${BASE} -> .shots/  共 ${shots.length} 个镜头`);

for (const shot of shots) {
  const w = shot.w ?? W;
  const h = shot.h ?? H;

  if (shot.reducedMotion === false) {
    // 抓过渡中间帧时才放开动效
    await send('Emulation.setEmulatedMedia', { features: [] });
  } else {
    // 关掉动效：截图不会被入场动画糊住，顺便验证 reduced-motion 分支可用
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
  }

  await send('Emulation.setDeviceMetricsOverride', {
    width: w,
    height: h,
    deviceScaleFactor: 1,
    mobile: w < 700,
  });

  await send('Page.navigate', { url: BASE + shot.path });
  // 等 load 事件：轮询 events 里有没有新的 Page.loadEventFired
  const before = events.length;
  for (let i = 0; i < 100; i++) {
    if (events.slice(before).includes('Page.loadEventFired')) break;
    await sleep(100);
  }
  await sleep(350); // 让字体与 SVG 落位

  if (shot.js) {
    await send('Runtime.evaluate', { expression: shot.js, awaitPromise: false });
    await sleep(shot.wait ?? 420); // 留出折叠/收起的过渡时间
  }

  // 悬浮态：把鼠标真的移过去。CSS 的 :hover 没法用 JS 触发，
  // 只有真的发一次 mouseMoved 才会进入悬浮态。
  if (shot.hoverSel) {
    const box = await send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(shot.hoverSel)});
        if (!el) return '';
        const r = el.getBoundingClientRect();
        return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) });
      })()`,
      returnByValue: true,
    });
    if (box.result?.value) {
      const { x, y } = JSON.parse(box.result.value);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
      await sleep(shot.wait ?? 420);
    } else {
      console.warn(` warn ${shot.name}: 找不到 ${shot.hoverSel}（可能是视口太窄，按钮被隐藏）`);
    }
  }

  const res = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: Boolean(shot.full),
  });
  const file = join(outDir, `${shot.name}.png`);
  writeFileSync(file, Buffer.from(res.data, 'base64'));
  console.log(` ok  ${shot.name}  ${w}x${h}  ${shot.path}`);
}

ws.close();
chrome.kill();
await sleep(300);
rmSync(profile, { recursive: true, force: true });
console.log(`[shoot] 完成，产物在 ${outDir}`);
