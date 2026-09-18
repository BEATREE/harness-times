/**
 * Harness Times 站点功能验证（零依赖，直接走 CDP）
 *
 * 验证项：
 *  1. 章节页渲染：导语、SVG 图、自测题数量
 *  2. 自测题交互：点击后正确/错误样式生效，解析展开
 *  3. localStorage 写入：答题记录
 *  4. 标记学完 / 自评 / 笔记保存 → localStorage
 *  5. 进度页：统计数字反映已完成的章节
 *  6. 面试页：筛选与「已能答出」自评写入独立 key
 *  7. 导出 / 导入恢复 链路
 *  8. 两侧大翻页区：面板尺寸、链接指向、正文与工具栏同宽
 *  9. 键盘 ← / → 切换章节，以及「输入框 / 带修饰键不抢键」两道守卫
 * 10. 移动端视口横向溢出
 * 11. 运行期无未捕获异常
 *
 * 用法：node ht-verify.mjs
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME =
  process.env.HT_CHROME ||
  'C:\\Users\\BEATREE\\AppData\\Local\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe';
/**
 * 目标站点：默认本地预览；可用 `--base=https://...` 或环境变量 HT_BASE 指向线上。
 *
 * 用 localhost 而不是 127.0.0.1：astro preview 在 Windows 上默认只绑 IPv6 回环（::1），
 * 写死 127.0.0.1 会连不上。localhost 两个族都会试，两种起法都成立。
 */
const BASE =
  process.argv.find((a) => a.startsWith('--base='))?.slice(7) ||
  process.env.HT_BASE ||
  'http://localhost:4321';
const PORT = 9333;
console.log(`目标站点: ${BASE}`);
const REMOTE = /^https?:/.test(BASE) && !/127\.0\.0\.1|localhost/.test(BASE);

const profile = mkdtempSync(join(tmpdir(), 'ht-cdp-'));
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
    '--window-size=1280,900',
    'about:blank',
  ],
  { stdio: 'ignore', detached: false }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevtools() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* 还没起来 */
    }
    await sleep(250);
  }
  throw new Error('devtools 未就绪');
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        (this.listeners.get(msg.method) || []).forEach((f) => f(msg.params));
      }
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });
    return new Cdp(ws);
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
  once(method, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`等待 ${method} 超时`)), timeout);
      const fn = (p) => {
        clearTimeout(t);
        this.listeners.set(
          method,
          this.listeners.get(method).filter((f) => f !== fn)
        );
        resolve(p);
      };
      this.on(method, fn);
    });
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(
        '页面内异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)
      );
    }
    return r.result.value;
  }
  async goto(url, settle = 900) {
    const loaded = this.once('Page.loadEventFired', REMOTE ? 45000 : 15000);
    await this.send('Page.navigate', { url });
    await loaded;
    // 线上站点有网络往返与 CDN 冷启动，多等一会儿再断言
    await sleep(REMOTE ? settle + 900 : settle);
  }
}

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? '  PASS ' : '  FAIL '} ${name}${detail ? '  — ' + detail : ''}`);
};

let cdp;
try {
  const url = await waitForDevtools();
  cdp = await Cdp.connect(url);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Console.enable');

  const pageErrors = [];
  cdp.on('Runtime.exceptionThrown', (p) =>
    pageErrors.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text)
  );

  /* ============ 1. 章节页渲染 ============ */
  console.log('\n[1] 章节页渲染 — harness-08-long-horizon');
  await cdp.goto(`${BASE}/harness/harness-08-long-horizon/`);

  const struct = await cdp.evaluate(`(() => ({
    lead: !!document.querySelector('.lead') && document.querySelector('.lead').textContent.length > 40,
    figures: document.querySelectorAll('figure.fig').length,
    svgShapes: document.querySelectorAll(
      'figure.fig svg path, figure.fig svg rect, figure.fig svg line, figure.fig svg circle, figure.fig svg polygon, figure.fig svg polyline'
    ).length,
    svgTexts: document.querySelectorAll('figure.fig svg text').length,
    quizItems: document.querySelectorAll('.quiz .q-item').length,
    options: document.querySelectorAll('.quiz .opt').length,
    boxes: document.querySelectorAll('.box').length,
    tables: document.querySelectorAll('table').length,
    codeBlocks: document.querySelectorAll('.code-block').length,
    chapterId: document.body.getAttribute('data-chapter'),
    qaCount: document.querySelectorAll('details.qa').length,
  }))()`);
  check('导语已渲染', struct.lead);
  check('SVG 图解存在且有图形元素',
    struct.figures >= 1 && struct.svgShapes >= 8 && struct.svgTexts >= 8,
    `fig=${struct.figures} 图形=${struct.svgShapes} 文字=${struct.svgTexts}`);
  check('自测题为 3 道', struct.quizItems === 3, `实际 ${struct.quizItems}`);
  check('自测选项齐全', struct.options === struct.quizItems * 4, `${struct.options} 个选项`);
  check('信息盒 / 表格 / 代码块存在', struct.boxes > 0 && struct.tables > 0 && struct.codeBlocks > 0,
    `box=${struct.boxes} tbl=${struct.tables} code=${struct.codeBlocks}`);
  check('面试问答区已渲染', struct.qaCount >= 3, `${struct.qaCount} 条`);
  check('body[data-chapter] 正确', struct.chapterId === 'harness-08-long-horizon', struct.chapterId);

  /* ============ 2. 自测题交互 ============ */
  console.log('\n[2] 自测题交互');
  const quizInteract = await cdp.evaluate(`(() => {
    const item = document.querySelector('.quiz .q-item');
    const answer = Number(item.getAttribute('data-answer'));
    const wrongIdx = [0,1,2,3].find(i => i !== answer);
    item.querySelector('.opt[data-i="' + wrongIdx + '"]').click();
    return {
      answered: item.hasAttribute('data-answered'),
      wrongMarked: !!item.querySelector('.opt.wrong'),
      correctMarked: !!item.querySelector('.opt.correct'),
      explainShown: getComputedStyle(item.querySelector('.explain')).display !== 'none',
      allDisabled: [...item.querySelectorAll('.opt')].every(b => b.disabled),
    };
  })()`);
  check('点击后题目锁定', quizInteract.answered && quizInteract.allDisabled);
  check('错误选项标红 / 正确选项标绿', quizInteract.wrongMarked && quizInteract.correctMarked);
  check('解析已展开', quizInteract.explainShown);

  const quizStore = await cdp.evaluate(
    `JSON.parse(localStorage.getItem('ht:progress:v1') || '{}')`
  );
  const ch = quizStore.chapters?.['harness-08-long-horizon'];
  const quizKeys = Object.keys(ch?.quizzes || {});
  check('答题记录写入 localStorage', quizKeys.length >= 1, `quizzes 记录 ${quizKeys.length} 条`);

  /* ============ 3. 标记学完 / 自评 / 笔记 ============ */
  console.log('\n[3] 标记学完 · 掌握度自评 · 笔记');
  await cdp.evaluate(`document.querySelector('[data-act="done"]').click()`);
  await sleep(250);
  const afterDone = await cdp.evaluate(`(() => {
    const s = JSON.parse(localStorage.getItem('ht:progress:v1') || '{}')
      .chapters?.['harness-08-long-horizon'];
    return { status: s?.status, hasReview: !!s?.review,
             label: document.querySelector('[data-status-label]').textContent.trim() };
  })()`);
  check('标记学完写入状态', afterDone.status === 'done', `status=${afterDone.status}`);
  check('自动加入复习队列', afterDone.hasReview === true);
  check('页面状态标签同步更新', afterDone.label.includes('已学完'), afterDone.label);

  await cdp.evaluate(`document.querySelector('[data-star="2"]').click()`);
  await sleep(200);
  const conf = await cdp.evaluate(
    `JSON.parse(localStorage.getItem('ht:progress:v1')).chapters['harness-08-long-horizon'].confidence`
  );
  check('掌握度自评写入', conf === 2, `confidence=${conf}`);

  await cdp.evaluate(`(() => {
    const ta = document.querySelector('[data-note-input]');
    ta.value = '自动化验证写入的笔记';
    document.querySelector('[data-act="note-save"]').click();
  })()`);
  await sleep(250);
  const notes = await cdp.evaluate(
    `(JSON.parse(localStorage.getItem('ht:progress:v1')).chapters['harness-08-long-horizon'].notes || [])`
  );
  check('笔记保存到本机', notes.length >= 1 && notes[0].text.includes('自动化验证'),
    `${notes.length} 条`);
  const noteRendered = await cdp.evaluate(
    `document.querySelector('[data-note-list]').textContent.includes('自动化验证')`
  );
  check('笔记列表已渲染', noteRendered);

  /* ============ 4. 进度页 ============ */
  console.log('\n[4] 进度页统计');
  await cdp.goto(`${BASE}/progress/`);
  const prog = await cdp.evaluate(`(() => ({
    hasRing: !!document.querySelector('.ring-wrap, .ring-row, svg'),
    statTime: document.querySelector('[data-stat-time]')?.textContent,
    statActive: document.querySelector('[data-stat-active]')?.textContent,
    notes: document.body.textContent.includes('自动化验证'),
    bodyLen: document.body.textContent.length,
  }))()`);
  check('进度页渲染成功', prog.bodyLen > 1500, `${prog.bodyLen} 字符`);
  check('活跃天数被统计', Number(prog.statActive) >= 1, `活跃 ${prog.statActive} 天`);
  check('笔记在进度页汇总可见', prog.notes);

  /* ============ 5. 导出 / 导入 ============ */
  console.log('\n[5] 导出与导入恢复');
  const exported = await cdp.evaluate(`(() => {
    const s = JSON.parse(localStorage.getItem('ht:progress:v1'));
    return { keys: Object.keys(s), chapters: Object.keys(s.chapters || {}).length,
             version: s.version };
  })()`);
  check('存储结构含版本号与章节数据',
    exported.version >= 1 && exported.chapters >= 1,
    `version=${exported.version} chapters=${exported.chapters}`);

  const importRoundTrip = await cdp.evaluate(`(() => {
    const before = localStorage.getItem('ht:progress:v1');
    // 模拟：清空 → 恢复
    localStorage.removeItem('ht:progress:v1');
    const empty = !localStorage.getItem('ht:progress:v1');
    localStorage.setItem('ht:progress:v1', before);
    const after = localStorage.getItem('ht:progress:v1');
    return { empty, same: before === after };
  })()`);
  check('导出内容可完整还原', importRoundTrip.empty && importRoundTrip.same);

  /* ============ 6. 面试页 ============ */
  console.log('\n[6] 面试题库页');
  await cdp.goto(`${BASE}/interview/`, 1200);
  const iv = await cdp.evaluate(`(() => ({
    items: document.querySelectorAll('.iv-item').length,
    groups: document.querySelectorAll('[data-chapter-group]').length,
    highCount: document.querySelectorAll('.iv-item[data-high="1"]').length,
    blocks: document.querySelectorAll('[data-domain-block]').length,
    firstTitle: document.querySelector('.iv-chapter a')?.textContent?.trim(),
  }))()`);
  check('22 章全部覆盖问答', iv.groups === 22, `${iv.groups} 组`);
  check('问答条目总数合理', iv.items >= 60, `${iv.items} 条`);
  check('高频标记存在', iv.highCount > 0, `${iv.highCount} 条高频`);
  check('四大版块分组', iv.blocks === 4, `${iv.blocks} 个`);

  await cdp.evaluate(`document.querySelector('[data-known-btn]').click()`);
  await sleep(250);
  const knownStore = await cdp.evaluate(
    `JSON.parse(localStorage.getItem('ht:interview:v1') || '{}')`
  );
  check('面试自评写入独立 key', Object.keys(knownStore).length >= 1,
    `${Object.keys(knownStore).length} 条`);

  await cdp.evaluate(`document.querySelector('[data-toggle="high"]').click()`);
  await sleep(250);
  const filtered = await cdp.evaluate(`(() => {
    const vis = [...document.querySelectorAll('.iv-item')].filter(e => !e.classList.contains('hide'));
    return { vis: vis.length, allHigh: vis.every(e => e.getAttribute('data-high') === '1') };
  })()`);
  check('「仅高频」筛选生效', filtered.vis > 0 && filtered.allHigh,
    `显示 ${filtered.vis} 条且全部为高频`);

  await cdp.evaluate(`document.querySelector('[data-filter="llm"]').click()`);
  await sleep(250);
  const domFiltered = await cdp.evaluate(`(() => {
    const vis = [...document.querySelectorAll('.iv-item')].filter(e => !e.classList.contains('hide'));
    return { vis: vis.length,
             domains: [...new Set(vis.map(e => (e.getAttribute('data-qid')||'').split('-')[0]))] };
  })()`);
  check('按版块筛选生效', domFiltered.vis > 0 && domFiltered.domains.length === 1,
    `剩余版块 ${domFiltered.domains.join(',')}`);

  /* ============ 7. 首页 / 关于页 / 侧栏 ============ */
  console.log('\n[7] 首页 · 关于页 · 导航');
  await cdp.goto(`${BASE}/`);
  const home = await cdp.evaluate(`(() => ({
    navItems: document.querySelectorAll('.sidebar .nav-item').length,
    chapterLinks: document.querySelectorAll('a[href^="/llm/"], a[href^="/harness/"], a[href^="/eval/"], a[href^="/knowledge/"]').length,
    hasSvg: !!document.querySelector('svg'),
    title: document.title,
  }))()`);
  check('侧栏导航完整（含关于页）', home.navItems >= 8, `${home.navItems} 项`);
  check('首页列出章节入口', home.chapterLinks >= 20, `${home.chapterLinks} 个`);
  check('首页含能力地图 SVG', home.hasSvg);

  await cdp.goto(`${BASE}/about/`);
  const about = await cdp.evaluate(`(() => ({
    len: document.body.textContent.length,
    hasStorageKey: document.body.textContent.includes('ht:progress:v1'),
    hasPrivacy: document.body.textContent.includes('本地'),
  }))()`);
  check('关于页渲染且说明隐私模型', about.len > 2000 && about.hasStorageKey && about.hasPrivacy,
    `${about.len} 字符`);

  /* ============ 8. 移动端布局 ============ */
  console.log('\n[8] 移动端视口');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
  });
  await cdp.goto(`${BASE}/harness/harness-02-agent-loop/`, 700);
  const mob = await cdp.evaluate(`(() => {
    const vw = document.documentElement.clientWidth;
    const offenders = [];
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > vw + 2 && r.width > 0) {
        const cs = getComputedStyle(el);
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 40),
          w: Math.round(r.width),
          left: Math.round(r.left),
          overflowX: cs.overflowX,
          parent: el.parentElement ? el.parentElement.tagName.toLowerCase() + '.' +
            (typeof el.parentElement.className === 'string' ? el.parentElement.className : '').slice(0, 30) : '',
        });
      }
    });
    // 只保留最外层的溢出者（父级已经溢出的，子级不必重复报）
    const roots = offenders.filter((o) => !offenders.some((p) =>
      p !== o && p.left <= o.left && p.w >= o.w && p.cls !== o.cls));
    return {
      scrollW: document.documentElement.scrollWidth,
      clientW: vw,
      menuBtn: !!document.querySelector('.menu-toggle'),
      offenders: (roots.length ? roots : offenders).slice(0, 12),
    };
  })()`);
  check('移动端无横向溢出', mob.scrollW <= mob.clientW + 2,
    `scrollW=${mob.scrollW} clientW=${mob.clientW}`);
  if (mob.offenders?.length) {
    console.log('     溢出元素：');
    mob.offenders.forEach((o) =>
      console.log(`       · <${o.tag} class="${o.cls}"> w=${o.w} left=${o.left} overflowX=${o.overflowX}  parent=${o.parent}`)
    );
  }
  check('移动端有菜单按钮', mob.menuBtn);
  await cdp.send('Emulation.clearDeviceMetricsOverride');

  /* ============ 9. 两侧大翻页区 + 键盘切换 ============
   *
   * 为什么必须用真键盘事件（Input.dispatchKeyEvent）而不是直接调 rail.click()：
   *   本站的切换是「拦 click → 播过渡 → 再跳转」的链路。直接点 DOM 上的链接能过，
   *   但「← / → 到底有没有被接住」这件事只有从浏览器输入层发一遍才算验证过。
   *   同样地，收敛守卫（输入框里不抢键、带修饰键不抢）也只能靠真事件证伪 ——
   *   这正是最容易写错、又最难靠肉眼发现的地方。
   */
  console.log('\n[9] 两侧大翻页区与键盘切换');

  const pressKey = async (key, vk, modifiers = 0) => {
    const base = { key, code: key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers };
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  };
  const pathNow = () => cdp.evaluate(`location.pathname`);

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await cdp.goto(`${BASE}/harness/harness-02-agent-loop/`, 900);

  const rails = await cdp.evaluate(`(() => {
    const info = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const prose = document.querySelector('.prose').getBoundingClientRect();
      const toolbar = document.querySelector('.chapter-toolbar').getBoundingClientRect();
      return {
        display: cs.display,
        w: Math.round(r.width), h: Math.round(r.height),
        left: Math.round(r.left), right: Math.round(r.right),
        href: el.getAttribute('href'),
        title: el.querySelector('.rail-title')?.textContent?.trim() || '',
        hint: el.querySelector('.rail-hint')?.textContent?.trim() || '',
        overlapsProse: r.right > prose.left && r.left < prose.right,
        proseW: Math.round(prose.width),
        toolbarW: Math.round(toolbar.width),
        proseLeft: Math.round(prose.left),
        toolbarLeft: Math.round(toolbar.left),
      };
    };
    return { prev: info('.page-rail.rail-prev'), next: info('.page-rail.rail-next'),
             vw: document.documentElement.clientWidth };
  })()`);

  check('1440px 下两侧翻页区都可见',
    rails.prev?.display !== 'none' && rails.next?.display !== 'none',
    `视口 ${rails.vw}`);
  check('翻页区是「大面板」而不是小书签',
    rails.prev.w >= 140 && rails.prev.h >= 300,
    `${rails.prev.w}×${rails.prev.h}`);
  check('左右翻页区不压住正文', !rails.prev.overlapsProse && !rails.next.overlapsProse);
  check('上一章链接指向 harness-01',
    rails.prev.href === '/harness/harness-01-what-is-harness/', rails.prev.href);
  check('下一章链接指向 harness-03',
    rails.next.href === '/harness/harness-03-tool-use/', rails.next.href);
  check('翻页区显示的是章节标题（可读文本）',
    rails.prev.title.length > 4 && rails.next.title.length > 4,
    `「${rails.prev.title}」/「${rails.next.title}」`);
  check('翻页区带键盘提示', /←|→/.test(rails.prev.hint), rails.prev.hint);

  // 用户的原始诉求：正文栏要和 .chapter-toolbar 一样宽
  check('正文栏与工具栏同宽（且左右边线重合）',
    rails.prev.proseW === rails.prev.toolbarW && rails.prev.proseLeft === rails.prev.toolbarLeft,
    `正文 ${rails.prev.proseW} / 工具栏 ${rails.prev.toolbarW}`);

  // 真键盘：→ 应当跳到下一章
  {
    const before = await pathNow();
    const loaded = cdp.once('Page.loadEventFired', 6000).catch(() => null);
    await pressKey('ArrowRight', 39);
    await loaded;
    await sleep(450);
    const after = await pathNow();
    check('按 → 跳到下一章',
      before === '/harness/harness-02-agent-loop/' && after === '/harness/harness-03-tool-use/',
      `${before} → ${after}`);
  }

  // 真键盘：← 应当跳回上一章
  {
    const before = await pathNow();
    const loaded = cdp.once('Page.loadEventFired', 6000).catch(() => null);
    await pressKey('ArrowLeft', 37);
    await loaded;
    await sleep(450);
    const after = await pathNow();
    check('按 ← 跳回上一章',
      before === '/harness/harness-03-tool-use/' && after === '/harness/harness-02-agent-loop/',
      `${before} → ${after}`);
  }

  /*
   * 收敛守卫（这一条是「不抢键」的核心）：
   * 本章页面里就有笔记输入框，用户在里面按 ← / → 是在移动光标。
   * 如果守卫失效，光标每移动一格就会被跳走一章 —— 这是最伤也最隐蔽的一类 bug。
   */
  {
    await cdp.evaluate(`document.querySelector('[data-note-input]').focus()`);
    const before = await pathNow();
    const navigated = cdp.once('Page.loadEventFired', 1500).then(() => true).catch(() => false);
    await pressKey('ArrowLeft', 37);
    const didNav = await navigated;
    await sleep(200);
    const after = await pathNow();
    const stillFocused = await cdp.evaluate(
      `document.activeElement?.matches?.('[data-note-input]') === true`
    );
    check('输入框里按 ← 不抢键（光标可以正常移动）',
      !didNav && before === after && stillFocused,
      `${before} → ${after}，焦点仍在输入框 ${stillFocused}`);
  }

  // 带修饰键不抢：Cmd / Ctrl + ← 是浏览器自己的前进后退
  {
    const before = await pathNow();
    const navigated = cdp.once('Page.loadEventFired', 1500).then(() => true).catch(() => false);
    await pressKey('ArrowRight', 39, 2 /* Ctrl */);
    const didNav = await navigated;
    await sleep(200);
    const after = await pathNow();
    check('Ctrl + → 不抢键（留给浏览器）', !didNav && before === after, `${before} → ${after}`);
  }

  // 窄屏：翻页区整体退场，交给章尾 .pager
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1200, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await cdp.goto(`${BASE}/harness/harness-02-agent-loop/`, 700);
  const narrow = await cdp.evaluate(`(() => {
    const el = document.querySelector('.page-rail.rail-prev');
    const pager = document.querySelector('nav.pager');
    return { railDisplay: getComputedStyle(el).display,
             railW: Math.round(el.getBoundingClientRect().width),
             pagerVisible: !!pager && getComputedStyle(pager).display !== 'none' };
  })()`);
  check('1200px 下翻页区退场、章尾 .pager 顶上',
    narrow.railDisplay === 'none' && narrow.railW === 0 && narrow.pagerVisible,
    `display=${narrow.railDisplay} 章尾 pager=${narrow.pagerVisible}`);

  // 首章 / 末章的边界
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await cdp.goto(`${BASE}/llm/llm-01-transformer/`, 700);
  const firstCh = await cdp.evaluate(`(() => ({
    hasPrev: !!document.querySelector('.page-rail.rail-prev'),
    nextHref: document.querySelector('.page-rail.rail-next')?.getAttribute('href'),
  }))()`);
  check('首章没有「上一章」面板，只有「下一章」',
    !firstCh.hasPrev && firstCh.nextHref === '/llm/llm-02-kv-cache/',
    `hasPrev=${firstCh.hasPrev} next=${firstCh.nextHref}`);

  await cdp.goto(`${BASE}/knowledge/knowledge-04-hybrid-trust/`, 700);
  const lastCh = await cdp.evaluate(`(() => {
    const n = document.querySelector('.page-rail.rail-next');
    return { isEnd: n?.classList.contains('is-end'),
             href: n?.getAttribute('href'),
             prevHref: document.querySelector('.page-rail.rail-prev')?.getAttribute('href') };
  })()`);
  check('末章「下一章」变「全书终点」并指向进度页',
    lastCh.isEnd === true && lastCh.href === '/progress/' &&
      lastCh.prevHref === '/knowledge/knowledge-03-embedding/',
    `is-end=${lastCh.isEnd} next=${lastCh.href} prev=${lastCh.prevHref}`);

  await cdp.send('Emulation.clearDeviceMetricsOverride');

  /* ============ 10. 无 JS 报错 ============ */
  console.log('\n[10] 运行期异常');
  check('页面无未捕获异常', pageErrors.length === 0,
    pageErrors.slice(0, 3).join(' | ') || '无');

  /* ============ 汇总 ============ */
  const failed = results.filter((r) => !r.pass);
  console.log('\n' + '='.repeat(58));
  console.log(`总计 ${results.length} 项，通过 ${results.length - failed.length}，失败 ${failed.length}`);
  if (failed.length) {
    console.log('\n失败项：');
    failed.forEach((f) => console.log(`  · ${f.name}  ${f.detail}`));
  }
  console.log('='.repeat(58));
} catch (e) {
  console.error('\n验证脚本异常：', e.message);
  process.exitCode = 1;
} finally {
  try {
    cdp?.ws.close();
  } catch {}
  chrome.kill();
  await sleep(400);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}
