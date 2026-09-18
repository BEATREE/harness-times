#!/usr/bin/env node
/**
 * 版面度量：把「正文是否真的居中、左右留白是否等宽」用数字量出来。
 *
 * 为什么不能靠眼睛看截图：
 *   截图缩放之后 5~10px 的偏差根本看不出来，而「左右留白等宽」这个要求
 *   恰恰就是几十个像素级别的对齐问题。这里直接读 getBoundingClientRect。
 *
 * 用法：
 *   node scripts/measure.mjs --base=http://localhost:4321
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
/*
 * 用 localhost 而不是 127.0.0.1：astro preview 在 Windows 上默认只绑 IPv6 回环（::1），
 * 写死 127.0.0.1 会拿不到页面（curl 直接 000）。localhost 两个族都试，两种起法都成立。
 */
const BASE = arg('base', 'http://localhost:4321').replace(/\/$/, '');
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
  { name: '图解移动端', path: '/harness/harness-08-long-horizon/', w: 390 },
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
    // 侧栏收起时 --sidebar-hold 归零，.main 占满视口，正文会重新落回视口中线。
    // 居中 / 留白预期因此分「展开」「收起」两套，需要把这个状态量出来。
    navCollapsed: document.body.classList.contains('nav-collapsed'),
    sidebar: R('.sidebar'),
    main: R('.main'),
    sheet: R('.sheet'),
    prose: R('.prose'),
    head: R('.chapter-head'),
    foot: R('.chapter-foot'),
    // 用户诉求「正文要和 .chapter-toolbar 一样宽」，所以工具栏宽度必须量出来，
    // 否则「一样宽」就只能靠肉眼比对截图 —— 那正是本脚本存在的理由。
    toolbar: R('.chapter-toolbar'),
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
    // 正文左边界 / 右边界到「屏幕边缘」的留白。
    //
    // 基准刻意是视口而不是 .main：本站的排版要求是「正文在屏幕视野里居中」，
    // 侧栏在左侧占掉一块之后，相对 .main 去量必然一头宽一头窄 ——
    // 那是拿错了尺子（早期版本就是这么量的，于是「对称」这个结论本身是假的）。
    gap: (() => {
      const p = document.querySelector('.prose')?.getBoundingClientRect();
      if (!p) return null;
      const vw = document.documentElement.clientWidth;
      return { left: Math.round(p.left), right: Math.round(vw - p.right) };
    })(),
    // 正文栏中点，用来直接验收「正文是否落在视口中线上」
    proseCenter: (() => {
      const p = document.querySelector('.prose')?.getBoundingClientRect();
      if (!p) return null;
      return Math.round((p.left + p.right) / 2);
    })(),
    // 正文两侧的大翻页区（上一章 / 下一章）。
    // 这一版是整块可点的大面板，所以除了 display 还要量宽高 ——
    // 只断言「显示」的话，退化成 34px 小书签也能过，那就失去意义了。
    pager: (() => {
      const read = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          display: cs.display,
          l: Math.round(r.left),
          r: Math.round(r.right),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      };
      return { prev: read('.page-rail.rail-prev'), next: read('.page-rail.rail-next') };
    })(),
    // 图解：小屏可读性靠「svg 有最小宽度 + 外框横向滚动」实现
    fig: (() => {
      const f = document.querySelector('figure.fig');
      if (!f) return null;
      const svg = f.querySelector('svg');
      const frame = f.querySelector('.fig-frame');
      return {
        svgW: svg ? Math.round(svg.getBoundingClientRect().width) : null,
        minW: svg ? getComputedStyle(svg).minWidth : null,
        frameClient: frame ? frame.clientWidth : null,
        frameScroll: frame ? frame.scrollWidth : null,
        nodes: f.querySelectorAll('.dm-n').length,
        texts: f.querySelectorAll('.dm-t').length,
        sparks: f.querySelectorAll('.dm-go').length,
      };
    })(),
  };
})()`;

let bad = 0;
const proseLefts = [];
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
  if (m.toolbar) console.log(`   工具栏    ${m.toolbar.l} → ${m.toolbar.r}  (宽 ${m.toolbar.w})`);
  if (m.codeBlock) console.log(`   代码块    ${m.codeBlock.l} → ${m.codeBlock.r}  (宽 ${m.codeBlock.w})`);
  if (m.preScroll && m.preScroll.scroll > m.preScroll.client + 1)
    console.log(`     └ 代码内部横向滚动：${m.preScroll.scroll} / ${m.preScroll.client}`);

  /*
   * 用户诉求：「正文栏过窄，宽度要和 .chapter-toolbar 一致」。
   * 只在有翻页区的宽度（≥1300px）上要求一致：那时正文用负 margin 吃掉 .sheet 的内边距，
   * 与工具栏共用同一个 --sheet-pad，两条边线应当重合。
   * 窄屏没有翻页区兜着，正文必须保留左右内边距，所以只要求「不比工具栏宽」。
   */
  if (m.prose && m.toolbar) {
    const d = Math.abs(m.prose.w - m.toolbar.w);
    if (m.vw >= 1300) {
      const ok = d <= 1 && m.prose.l === m.toolbar.l && m.prose.r === m.toolbar.r;
      if (!ok) bad += 1;
      console.log(
        `   正文栏 vs 工具栏宽度  ${m.prose.w} / ${m.toolbar.w}  差 ${d}px  ${
          ok ? '同宽且左右边线重合 ok' : '未对齐 ×'
        }`
      );
    } else {
      const ok = m.prose.w <= m.toolbar.w + 1;
      console.log(
        `   正文栏 vs 工具栏宽度  ${m.prose.w} / ${m.toolbar.w}  差 ${d}px  ${
          ok ? '窄屏保留内边距（不比工具栏宽）ok' : '正文溢出工具栏 ×'
        }`
      );
      if (!ok) bad += 1;
    }
  }

  if (m.gap) {
    /*
     * 左右留白分三个区间（见 global.css「正文两侧的大翻页区」一节顶部的取舍说明）：
     *   ≥1300px  三栏 flex，镜像留白**被取消** → 正文整组相对屏幕偏右「半个侧栏宽」，
     *            因为左侧有固定侧栏，正文居中基准从「视口」换成「.main 的内容区」。
     *            这是为「正文更宽 + 翻页区更大」主动付出的代价，所以这里断言的是
     *            「差值 ≈ 侧栏宽」，而不是「差值 ≈ 0」。
     *   1128~1299px  镜像留白留得满，正文仍严格落在视口中线上 → 左右等宽。
     *   <1128px  镜像留白为保住可读宽度而收缩，允许不对称（宁可不居中也不能压字）。
     */
    const diff = Math.abs(m.gap.left - m.gap.right);
    const sideW = m.navCollapsed ? 0 : (m.sidebar?.w ?? 0);
    let ok;
    let why;
    if (m.vw >= 1300) {
      ok = Math.abs(diff - sideW) <= 4;
      why = ok
        ? m.navCollapsed
          ? '侧栏已收起，.main 占满视口，左右等宽 ok'
          : `取消镜像留白 ok（差 ${diff} ≈ 侧栏宽 ${sideW}）`
        : '偏离预期 ×';
    } else if (m.vw >= 1128) {
      ok = diff <= 2;
      why = ok ? '镜像留白留满，左右对称 ok' : '不对称 ×';
    } else {
      ok = true;
      why = '窄屏按可读性收缩，允许不对称 ok';
    }
    if (!ok) bad += 1;
    console.log(`   正文到屏幕两侧  左 ${m.gap.left} / 右 ${m.gap.right}   差 ${diff}px  ${why}`);
  }

  if (m.proseCenter != null) {
    const off = m.proseCenter - m.vw / 2;
    /*
     * 正文栏中点的三个区间，与上面 .gap 一一对应：
     *   ≥1300px  基准是 .main 内容区，比视口中线右偏「半个侧栏宽」；
     *   1128~1299px  严格落在视口中线上；
     *   <1128px  为保可读宽度最多右漂半个侧栏宽（134px），是取舍不是 bug。
     */
    const sideW = m.navCollapsed ? 0 : (m.sidebar?.w ?? 0);
    let ok;
    let why;
    if (m.vw >= 1300) {
      ok = Math.abs(off - sideW / 2) <= 4;
      why = ok
        ? m.navCollapsed
          ? '侧栏已收起，正文回到视口中线 ok'
          : `三栏居中基准为 .main 内容区（右偏 侧栏/2 = ${Math.round(sideW / 2)}px）ok`
        : '偏离预期 ×';
    } else if (m.vw >= 1128) {
      ok = Math.abs(off) <= 2;
      why = ok ? '居中 ok' : '偏离 ×';
    } else {
      ok = off >= 0 && off <= 140;
      why = ok ? '窄屏容差内 ok' : '偏离 ×';
    }
    if (!ok) bad += 1;
    console.log(
      `   正文中点 vs 视口中线  ${m.proseCenter} / ${m.vw / 2}   偏移 ${off > 0 ? '+' : ''}${off}px  ${why}`
    );
    proseLefts.push({ name: page.name, left: m.prose?.l, w: m.prose?.w });
  }

  // 正文栏不能窄到没法读。
  // 420px ≈ 24 个汉字一行，是「还能舒服读下去」的下限；
  // 桌面端最紧的一档（768px 平板）是 435px，就是从这条线守下来的。
  if (m.prose && m.prose.w < (page.w <= 760 ? 300 : 420)) {
    bad += 1;
    console.log(`   正文栏过窄：${m.prose.w}px（要求 ≥ ${page.w <= 760 ? 300 : 420}px）×`);
  }

  if (m.pager && page.w) {
    const { prev, next } = m.pager;
    // 预期：≥1300px 显示（和 global.css 的断点一致），更窄则整体隐藏（走章尾翻页条）
    const wantVisible = page.w >= 1300 && page.path.startsWith('/harness/');
    const shown = prev && prev.display !== 'none' && prev.w > 0;
    if (wantVisible) {
      const overlaps = prev && m.prose && prev.r > m.prose.l;
      /*
       * 「大面板」是这个版本的诉求本体：宽 ≥140px、高 ≥300px。
       * 只断言 display 是不够的 —— 上一版 34px 宽的小书签同样会 display:flex，
       * 那样断言照样绿，等于没测。这里把尺寸一起锁住。
       */
      const bigEnough = prev.w >= 140 && prev.h >= 300;
      const ok = shown && !overlaps && bigEnough;
      if (!ok) bad += 1;
      console.log(
        `   两侧翻页区  显示 ${shown}  上一章 ${prev?.l}→${prev?.r}（${prev?.w}×${prev?.h}）  ` +
          `下一章 ${next?.l}→${next?.r}（${next?.w}×${next?.h}）${
            overlaps ? '  与正文重叠 ×' : ''
          }${bigEnough ? '  尺寸达标 ok' : '  面板过小 ×'}`
      );
    } else if (shown) {
      bad += 1;
      console.log(`   两侧翻页区在 ${page.w}px 下仍然显示 ×`);
    } else {
      console.log(`   两侧翻页区  @${page.w}px 按预期隐藏 ok`);
    }
  }

  if (m.fig) {
    const f = m.fig;
    const scrolls = f.frameScroll > f.frameClient + 1;
    console.log(
      `   图解  svg ${f.svgW}px（min-width ${f.minW}）  外框 ${f.frameClient}${
        scrolls ? ` → 可滚动 ${f.frameScroll}` : ' 不需滚动'
      }  动效 节点 ${f.nodes} / 文字 ${f.texts} / 流光 ${f.sparks}`
    );
    if (f.nodes + f.texts === 0) {
      // 只有走 markdown 管线的章节页才归 diagram-motion 管；
      // 首页那张能力地图写在 index.astro 里，靠 CSS 的 nth-of-type 落版。
      if (/^\/(llm|harness|eval|knowledge)\//.test(page.path)) {
        bad += 1;
        console.log('     └ 图解没有被 diagram-motion 标注 ×');
      } else {
        console.log('     └ 非 markdown 图解（首页能力地图），走 CSS 落版，豁免');
      }
    }
    // 小屏：图不能被压小，必须靠横向滚动保住字号
    if (page.w < 900 && !scrolls) {
      bad += 1;
      console.log('     └ 小屏下图解没有横向滚动，字会被压小 ×');
    }
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

/*
 * 跨状态不变性：侧栏展开与收起时，正文的绝对位置必须一致。
 * 这是「无论左侧导航栏折叠还是展开，正文都距屏幕边缘相同距离」的可验证形式 ——
 * 单看某一帧的左右留白等宽，是证明不了这一条的（旧版就是左右等宽但整体偏右）。
 */
/*
 * 跨状态变化：侧栏折叠 / 展开时正文怎么动。
 *
 * ⚠️ 这一条相对上一版**放宽了**，是有意的：
 *   上一版靠「镜像留白」把正文钉在视口中线上，所以收起侧栏时正文一格不动
 *   （当时断言 |位移| ≤ 1px）。但镜像留白要白送 268px，加上两侧翻页区之后
 *   正文栏会被压到 604px —— 与「正文栏过窄」的诉求正面冲突，因此这一版取消了它。
 *   取消之后，收起侧栏腾出的空间会被正文和翻页区吃掉，正文左边界会往左移。
 *   这不是回归，而是「收起侧栏 = 给内容更多空间」这个更直觉的语义。
 *   所以现在断言的是两件真正该成立的事：
 *     1) 收起后正文不会更窄（空间确实被内容拿走了，而不是白扔）；
 *     2) 收起后正文没有跑到屏幕外（左边界 ≥ 0）。
 */
{
  const open = proseLefts.find((p) => p.name === '章节页');
  const shut = proseLefts.find((p) => p.name === '章节页·侧栏收起');
  if (open?.left != null && shut?.left != null) {
    const shift = open.left - shut.left;
    const notNarrower = (shut.w ?? 0) >= (open.w ?? 0) - 1;
    const onScreen = shut.left >= 0;
    const ok = notNarrower && onScreen;
    if (!ok) bad += 1;
    console.log(
      `[不变性] 侧栏展开 / 收起：正文左边界 ${open.left} / ${shut.left}（左移 ${shift}px），` +
        `宽度 ${open.w} / ${shut.w}  ` +
        `${ok ? '腾出的空间被内容吸收 ok' : '×'}\n`
    );
  }
}

ws.close();
chrome.kill();
await sleep(300);
rmSync(profile, { recursive: true, force: true });
console.log(`[measure] 完成，异常 ${bad} 项`);
process.exitCode = bad ? 1 : 0;
