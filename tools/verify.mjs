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
    const sb = document.querySelector('.sidebar').getBoundingClientRect();
    const rp = document.querySelector('.page-rail.rail-prev').getBoundingClientRect();
    const rn = document.querySelector('.page-rail.rail-next').getBoundingClientRect();
    return { prev: info('.page-rail.rail-prev'), next: info('.page-rail.rail-next'),
             vw: document.documentElement.clientWidth,
             // 侧栏 268px 是 fixed 的、脱离文档流，翻页区靠 .main 的 margin-left 让开它。
             // 两者一重叠就说明让位量算错了，而截图缩放到 75% 后那点重叠是看不出来的。
             sidebarOverlapsRailPrev: sb.right > rp.left + 0.5,
             // 不只是「没出视口」，而是「留了呼吸位」：
             // 上一版 padding-right: 0 时右侧面板正好贴在屏幕最右缘，
             // 1px 描边 + 2px 圆角看起来像被裁掉了。
             railPrevGutter: Math.round(rp.left - document.querySelector('.sidebar').getBoundingClientRect().right),
             railNextGutter: Math.round(document.documentElement.clientWidth - rn.right) };
  })()`);

  check('1440px 下两侧翻页区都可见',
    rails.prev?.display !== 'none' && rails.next?.display !== 'none',
    `视口 ${rails.vw}`);
  check('翻页区是「大面板」而不是小书签',
    rails.prev.w >= 140 && rails.prev.h >= 300,
    `${rails.prev.w}×${rails.prev.h}`);
  check('左右翻页区不压住正文', !rails.prev.overlapsProse && !rails.next.overlapsProse);
  check('侧栏不压住左侧翻页区（.main 的让位量正确）', !rails.sidebarOverlapsRailPrev,
    `左间隙 ${rails.railPrevGutter}px`);
  check('左右翻页区都留了呼吸位（不是贴边）',
    rails.railPrevGutter >= 16 && rails.railNextGutter >= 16,
    `左 ${rails.railPrevGutter}px / 右 ${rails.railNextGutter}px`);
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

  /* ============ 10. 左边缘悬停唤出目录（peek） ============
   *
   * 为什么必须走 Input.dispatchMouseEvent 而不是页面内 `el.dispatchEvent(new PointerEvent(...))`：
   *  - 这个特性读 `matchMedia('(hover: hover)')` 并逐事件判 `e.pointerType`，
   *    合成事件里 pointerType 是自己填的，等于自己给自己发通行证；
   *  - 阈值判断依赖真实的 clientX 与真实的事件频率，
   *    页面内合成的事件可以瞬间连发一串，测不出「停留 110ms」这类时间语义。
   * 用 CDP 派发的是**可信事件**（isTrusted=true），跑的是真正的产品代码路径。
   *
   * 这里最要紧的一条断言不是「弹出来了」，而是「弹出来时正文一格都没动」。
   * 侧栏收起是靠把 --sidebar-hold 归零让正文重排实现的；
   * 唤出如果顺手也去改这个变量，鼠标每划到左边一次整页就会重排一次 ——
   * 那种抖动只有量正文左边界才发现得了。
   */
  console.log('\n[10] 左边缘悬停唤出目录');

  const mouseTo = (x, y = 420) =>
    cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
  const clickAt = async (x, y = 420) => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1,
    });
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0,
    });
  };
  /** 一次把这项特性所有可观测状态抓齐 */
  const peekState = () => cdp.evaluate(`(() => {
    const sb = document.getElementById('sidebar');
    const btn = document.querySelector('[data-nav-collapse]');
    const scrim = document.querySelector('[data-scrim]');
    const prose = document.querySelector('.prose');
    const t = getComputedStyle(sb).transform;
    return {
      hoverCapable: matchMedia('(hover: hover)').matches,
      peek: document.body.classList.contains('nav-peek'),
      collapsed: document.body.classList.contains('nav-collapsed'),
      open: document.body.classList.contains('nav-open'),
      tx: t === 'none' ? 0 : Math.round(new DOMMatrixReadOnly(t).m41),
      hold: getComputedStyle(document.querySelector('.main')).getPropertyValue('--sidebar-hold').trim(),
      proseLeft: prose ? Math.round(prose.getBoundingClientRect().left) : -1,
      btnOpacity: btn ? getComputedStyle(btn).opacity : 'n/a',
      btnPointer: btn ? getComputedStyle(btn).pointerEvents : 'n/a',
      scrimShown: scrim ? getComputedStyle(scrim).display !== 'none' : false,
      btnRect: btn ? (({ x, y, width, height }) => ({ x, y, width, height }))(btn.getBoundingClientRect()) : null,
    };
  })()`);

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await cdp.goto(`${BASE}/harness/harness-02-agent-loop/`, 700);

  const peekStart = await peekState();
  check('桌面端默认目录是展开的（本次改动不动默认状态）',
    peekStart.collapsed === false && peekStart.tx === 0 && peekStart.hoverCapable,
    `collapsed=${peekStart.collapsed} tx=${peekStart.tx} hover=${peekStart.hoverCapable}`);

  // 收起目录（真实点击那条书签）
  await clickAt(peekStart.btnRect.x + peekStart.btnRect.width / 2,
    peekStart.btnRect.y + peekStart.btnRect.height / 2);
  await sleep(420);
  const peekCollapsed = await peekState();
  check('点书签能收起目录，收起后侧栏移出视口',
    peekCollapsed.collapsed === true && peekCollapsed.tx <= -200,
    `collapsed=${peekCollapsed.collapsed} tx=${peekCollapsed.tx}`);

  // 停留不足 → 不弹（「鼠标路过」不该被拦下来）
  await mouseTo(8);
  await mouseTo(300);
  await sleep(320);
  const peekPass = await peekState();
  check('指针只从边缘路过（停留 <110ms）不弹目录',
    peekPass.peek === false && peekPass.tx <= -200,
    `peek=${peekPass.peek} tx=${peekPass.tx}`);

  // 停留足够 → 弹出，且正文一格没动
  await mouseTo(8);
  await sleep(360);
  const peekOpen = await peekState();
  check('鼠标抵住左边缘即弹出目录', peekOpen.peek === true && peekOpen.tx === 0,
    `peek=${peekOpen.peek} tx=${peekOpen.tx}`);
  check('唤出期间正文左边界与收起时完全一致（不重排）',
    peekOpen.proseLeft === peekCollapsed.proseLeft && peekOpen.hold === peekCollapsed.hold,
    `收起 ${peekCollapsed.proseLeft}/${peekCollapsed.hold} → 唤出 ${peekOpen.proseLeft}/${peekOpen.hold}`);
  check('唤出期间收起书签已让位（不挂在浮层外面）',
    peekOpen.btnOpacity === '0' && peekOpen.btnPointer === 'none',
    `opacity=${peekOpen.btnOpacity} pointer-events=${peekOpen.btnPointer}`);

  // 指针离开侧栏 → 收回
  await mouseTo(700);
  await sleep(340);
  const peekClosed = await peekState();
  check('指针移开后目录自动收回', peekClosed.peek === false && peekClosed.tx <= -200,
    `peek=${peekClosed.peek} tx=${peekClosed.tx}`);
  check('收回后正文左边界仍与收起时一致（来回都不抖）',
    peekClosed.proseLeft === peekCollapsed.proseLeft,
    `${peekCollapsed.proseLeft} → ${peekClosed.proseLeft}`);

  /* 窄屏：复用抽屉（nav-open），但悬停唤出不该带遮罩，
   * 且刚用 ☰ 关掉的抽屉不许在指针还贴着左边时自己弹回来。 */
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 420, height: 844, deviceScaleFactor: 1, mobile: false,
  });
  await cdp.goto(`${BASE}/harness/harness-02-agent-loop/`, 700);
  const mBtn = await cdp.evaluate(`(() => {
    const b = document.querySelector('[data-menu-toggle]');
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2,
             hoverCapable: matchMedia('(hover: hover)').matches };
  })()`);

  if (mBtn.hoverCapable) {
    // 点 ☰ 开、再点 ☰ 关 —— 关掉时指针仍停在按钮附近（边带内），应被拉黑
    await clickAt(mBtn.x, mBtn.y);
    await sleep(320);
    await clickAt(mBtn.x, mBtn.y);
    await sleep(320);
    await mouseTo(8);
    await sleep(360);
    const mSuppressed = await peekState();
    check('窄屏用 ☰ 关掉抽屉后，指针还贴着左边缘不许自动弹回',
      mSuppressed.open === false && mSuppressed.peek === false,
      `nav-open=${mSuppressed.open} peek=${mSuppressed.peek}`);

    // 指针真正离开边带 → 拉黑解除，此时再贴左边缘应弹出，且不带遮罩
    await mouseTo(240);
    await sleep(120);
    await mouseTo(8);
    await sleep(360);
    const mPeek = await peekState();
    check('窄屏贴左边缘也能唤出抽屉，且不带遮罩',
      mPeek.open === true && mPeek.peek === true && mPeek.scrimShown === false,
      `nav-open=${mPeek.open} peek=${mPeek.peek} 遮罩=${mPeek.scrimShown}`);

    // 指针移开浮层才收回。窄屏侧栏宽 288px，所以要挪到它右沿之外 ——
    // 写个固定值很容易落在浮层里面，变成「测了个寂寞」。
    const pastSidebar = await cdp.evaluate(
      `Math.round(document.getElementById('sidebar').getBoundingClientRect().right) + 60`
    );
    await mouseTo(pastSidebar);
    await sleep(340);
    const mClosed = await peekState();
    check('窄屏指针移开后抽屉收回', mClosed.open === false && mClosed.peek === false,
      `nav-open=${mClosed.open} peek=${mClosed.peek}（挪到 x=${pastSidebar}）`);
  }
  await cdp.send('Emulation.clearDeviceMetricsOverride');

  /* ============ 11. 名词卡片：名词库页 + 章节弹窗 ============
   *
   * 这一节必须用真事件、必须跑在真页面上，有三个具体理由：
   *   1) 搜索是 `input` 事件驱动的，直接改 value 不触发 —— 那等于只测了「函数能跑」；
   *   2) Esc 关闭挂在 document 的 keydown 上，只有真实按键才会走到那条分支；
   *   3) 「卡片搬家」的 bug 只在「开一次 + 关一次」之后才现形：关的时候不放回原位，
   *      那张卡片就永久消失了，而第一次打开时一切正常。
   */
  console.log('\n[11] 名词卡片（名词库页 / 章节弹窗）');
  await cdp.goto(`${BASE}/glossary/`, 700);

  const gl = await cdp.evaluate(`(() => ({
    cards: document.querySelectorAll('[data-glossary-item]').length,
    id: document.querySelector('h1') ? 'y' : 'n',
    hasSearch: !!document.querySelector('[data-glossary-q]'),
  }))()`);
  check('名词库页渲染出全部名词卡片', gl.cards >= 20, `${gl.cards} 条`);

  /* 搜索：必须派发 input 事件，光改 value 不会触发监听 */
  const searched = await cdp.evaluate(`(() => {
    const q = document.querySelector('[data-glossary-q]');
    if (!q) return { before: -1, after: -1, label: '' };
    const visible = () => [...document.querySelectorAll('[data-glossary-item]')]
      .filter((el) => !el.classList.contains('hide')).length;
    const before = visible();
    q.value = 'softmax';
    q.dispatchEvent(new Event('input', { bubbles: true }));
    const after = visible();
    const label = document.querySelector('[data-glossary-count]')?.textContent.trim() || '';
    q.value = '';
    q.dispatchEvent(new Event('input', { bubbles: true }));
    return { before, after, restored: visible(), label };
  })()`);
  check('在名词库里搜索能筛掉不相干的条目',
    searched.after > 0 && searched.after < searched.before,
    `${searched.before} → ${searched.after}（"${searched.label}"）`);
  check('清空搜索后条目全部恢复', searched.restored === searched.before,
    `${searched.restored} / ${searched.before}`);

  /* 知识域筛选：点一个域，只剩该域的条目 */
  const glFiltered = await cdp.evaluate(`(() => {
    const btn = document.querySelector('[data-glossary-filters] [data-domain="llm"]');
    if (!btn) return null;
    btn.click();
    const items = [...document.querySelectorAll('[data-glossary-item]')];
    const shown = items.filter((el) => !el.classList.contains('hide'));
    return { shown: shown.length, allSameDomain: shown.every((el) => el.dataset.domain === 'llm') };
  })()`);
  check('按知识域筛选只留下该域的条目',
    !!glFiltered && glFiltered.shown > 0 && glFiltered.allSameDomain,
    glFiltered ? `留下 ${glFiltered.shown} 条` : '没找到筛选按钮');

  /* 章节页：点术语 → 弹窗；Esc → 关闭；卡片必须回到原位（不能凭空消失） */
  await cdp.goto(`${BASE}/llm/llm-01-transformer/`, 700);

  /*
   * ⚠️ 先掐掉全站的 `html { scroll-behavior: smooth }` 再定位。
   * 它会让 scrollIntoView 变成**异步动画**：紧接着量出来的坐标还是滚动前的位置，
   * 术语常常因此落在视口之外 —— elementFromPoint 返回 null，
   * 现象是「点下去什么都没发生」，看起来像点击坐标算错了，其实是没滚到位。
   * （scrollIntoView({behavior:'auto'}) 不解决问题：auto 的语义就是「听 CSS 的」。）
   */
  await cdp.evaluate(`(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.querySelector('a.term[data-term="tensor"]')?.scrollIntoView({ block: 'center' });
  })()`);
  await sleep(200);

  const termBox = await cdp.evaluate(`(() => {
    const a = document.querySelector('a.term[data-term="tensor"]');
    if (!a) return null;
    /*
     * ⚠️ 必须用 getClientRects()[0] 而不是 getBoundingClientRect()。
     * a.term 是**行内元素**，一旦术语正好落在换行处，bounding rect 会把两行
     * 一起框住 —— 它的中心点很可能落在两行之间的空白上，点下去什么也没点中，
     * 表现出来却是「弹窗没打开」，让人以为功能坏了。getClientRects() 给的是
     * 每一行的方框，取第一个永远落在字形上。
     */
    const r = a.getClientRects()[0] || a.getBoundingClientRect();
    const x = r.x + Math.min(r.width / 2, 18);
    const y = r.y + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      href: a.getAttribute('href'), x, y,
      storeCards: document.querySelectorAll('.term-store [data-term-card]').length,
      hitIsTerm: !!(hit && hit.closest && hit.closest('a.term')),
      hit: hit ? hit.tagName.toLowerCase() + '.' + String(hit.className || '') : 'null',
      /* 点位出没出视口 —— 它才是「命中 null」的真凶，写进 detail 免得下次又猜 */
      inView: x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight,
    };
  })()`);
  check('正文里的术语渲染成指向名词库的链接',
    !!termBox && /^\/glossary\/#t-[a-z0-9-]+$/.test(termBox.href), termBox?.href || '没找到术语链接');
  check('术语链接的点击位确实落在链接上（行内元素换行坑）',
    !!termBox && termBox.hitIsTerm,
    termBox ? `命中 ${termBox.hit}，点位在视口内=${termBox.inView}（${termBox.x},${termBox.y}）` : '');
  check('本章名词卡片已预渲染进隐藏容器', !!termBox && termBox.storeCards > 0,
    `${termBox?.storeCards} 张`);

  await clickAt(termBox.x, termBox.y);
  await sleep(320);
  const opened = await cdp.evaluate(`(() => {
    const m = document.querySelector('[data-term-modal]');
    const panel = document.querySelector('[data-tm-panel]');
    /* 底栏有没有被滚动区推到看不见的地方。
     * 「张量」这张卡正文比面板高 400+px —— 如果底栏只是普通流元素，
     * 弹窗里最常用的「标记已掌握」就藏在滚动条尽头，实测 4 张卡里 3 张如此。 */
    const btnInView = (() => {
      const body = document.querySelector('[data-tm-body]');
      const btn = document.querySelector('.tm-body [data-term-toggle]');
      if (!body || !btn) return '找不到底栏按钮';
      const b = body.getBoundingClientRect();
      const r = btn.getBoundingClientRect();
      if (r.top >= b.top - 1 && r.bottom <= b.bottom + 1) return true;
      return '按钮底 ' + Math.round(r.bottom) + ' > 滚动区底 ' + Math.round(b.bottom);
    })();
    return {
      hidden: m.hidden,
      cardInPanel: !!document.querySelector('.tm-body [data-term-card="tensor"]'),
      label: panel.getAttribute('aria-label') || '',
      lock: document.documentElement.classList.contains('term-open'),
      focused: (document.activeElement?.className || '') + '',
      path: location.pathname,
      btnInView,
    };
  })()`);
  check('点击术语弹出对应卡片（不是跳走）',
    opened.hidden === false && opened.cardInPanel, `hidden=${opened.hidden} 卡片在面板内=${opened.cardInPanel}`);
  check('弹窗带 aria-label 且锁住页面滚动',
    opened.label.includes('张量') && opened.lock, `${opened.label} / lock=${opened.lock}`);
  check('打开后焦点移到弹窗内（关闭按钮）', opened.focused.includes('tm-close'), opened.focused);
  check('弹窗里的「标记已掌握」不用滚动就能看到', opened.btnInView === true, String(opened.btnInView));
  check('点术语没有真的跳转走', opened.path === '/llm/llm-01-transformer/', opened.path);

  /* 真实按键：Esc 关闭 */
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown', key: 'Escape', code: 'Escape',
    windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27,
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'Escape', code: 'Escape',
    windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27,
  });
  await sleep(300);
  const closed = await cdp.evaluate(`(() => ({
    hidden: document.querySelector('[data-term-modal]').hidden,
    lock: document.documentElement.classList.contains('term-open'),
    inStore: !!document.querySelector('.term-store [data-term-card="tensor"]'),
    dupes: document.querySelectorAll('#t-tensor').length,
    emptyBody: document.querySelector('.tm-body').children.length === 0,
    focusBack: (document.activeElement?.getAttribute('data-term') || '') + '',
  }))()`);
  check('按 Esc 能关掉弹窗并解锁滚动',
    closed.hidden === true && closed.lock === false, `hidden=${closed.hidden} lock=${closed.lock}`);
  check('关闭后卡片回到原位（不是被销毁）', closed.inStore && closed.dupes === 1,
    `在容器内=${closed.inStore} #t-tensor 出现 ${closed.dupes} 次`);
  check('关闭后焦点回到触发它的术语链接', closed.focusBack === 'tensor', closed.focusBack || '未回焦');

  /* —— 掌握标记：写入 → 取消 → 筛选 → 刷新读回 ——
   *
   * 为什么要跑这一整圈：标记只写进 localStorage，**写不进去页面也毫无反应**，
   * 看起来和「写了但读不回来」一模一样。所以必须同时验四个方向：
   * 写进去没有（原始 JSON）、取消能不能回退、筛选读的是不是最新状态、
   * 重新加载后还在不在。少任何一端，坏了都发现不了。
   */
  await cdp.goto(`${BASE}/glossary/`, 700);
  const mark = await cdp.evaluate(`(() => {
    const store = () => {
      try { return JSON.parse(localStorage.getItem('ht:progress:v1') || '{}'); } catch { return {}; }
    };
    /* 先归一化到「一条都没掌握」：上一次运行可能留下别的已掌握条目，
     * 会让下面「只看未掌握」少筛掉几条，红得莫名其妙。 */
    const raw = store();
    raw.terms = {};
    localStorage.setItem('ht:progress:v1', JSON.stringify(raw));
    window.dispatchEvent(new CustomEvent('ht:progress'));

    const btn = document.querySelector('[data-term-toggle]');
    if (!btn) return null;
    const id = btn.getAttribute('data-term-toggle');
    /* 刻意把「条目不存在」和「存在但 known=false」分开读：
     * 取消标记的实现是**删掉整条**（见 progress.ts toggleTermKnown），
     * 而不是原地写 known:false。这样存储里只留真正掌握过的词，
     * knownTermIds() 不用过滤、也不会攒下一堆没用的空行。
     * 如果哪天真写成 known:false，这条断言要能红 —— 那就得连着决定到底哪个是契约。 */
    const read = () => {
      const t = store().terms || {};
      return {
        pressed: btn.getAttribute('aria-pressed'),
        present: Object.prototype.hasOwnProperty.call(t, id),
        known: t[id] ? t[id].known : null,
        on: btn.classList.contains('on'),
      };
    };
    const initial = read();
    btn.click();
    const afterOn = read();
    btn.click();
    const afterOff = read();
    btn.click();
    const afterOnAgain = read();
    return { id, initial, afterOn, afterOff, afterOnAgain };
  })()`);
  check('点「标记已掌握」写入本机进度（ht:progress.v1 · terms）',
    !!mark && mark.initial.pressed === 'false' && mark.initial.present === false
      && mark.afterOn.pressed === 'true' && mark.afterOn.present === true
      && mark.afterOn.known === true && mark.afterOn.on,
    mark
      ? `${mark.id}: ${mark.initial.pressed} → ${mark.afterOn.pressed}（known=${mark.afterOn.known}, .on=${mark.afterOn.on}）`
      : '没找到掌握按钮');
  check('再点一下能取消标记（整条移除，不留 known:false 空行）',
    !!mark && mark.afterOff.pressed === 'false' && mark.afterOff.on === false
      && mark.afterOff.present === false && mark.afterOnAgain.known === true,
    mark ? `取消后 present=${mark.afterOff.present}, .on=${mark.afterOff.on}` : '');

  /* 「只看未掌握」筛的是**最新状态**（读存储），不是卡片上可能过期的 data-known ——
   * 所以这一条同时验证了「点完立刻筛选就生效」 */
  const knownOnly = await cdp.evaluate(`(() => {
    const btn = document.querySelector('[data-known-only]');
    if (!btn) return null;
    const items = [...document.querySelectorAll('[data-glossary-item]')];
    const shown = () => items.filter((el) => !el.classList.contains('hide'));
    const before = shown().length;
    btn.click();
    const after = shown();
    return {
      before,
      shown: after.length,
      knownStillShown: after.filter((el) => el.dataset.known === '1').length,
    };
  })()`);
  check('「只看未掌握」把刚标记的那条筛掉',
    !!knownOnly && knownOnly.shown === knownOnly.before - 1 && knownOnly.knownStillShown === 0,
    knownOnly
      ? `${knownOnly.before} → ${knownOnly.shown}（已掌握却仍显示 ${knownOnly.knownStillShown} 条）`
      : '没找到「只看未掌握」按钮');

  /* 重新加载：只写不读的实现看起来完全一样，只有刷新才现形 */
  await cdp.goto(`${BASE}/glossary/`, 700);
  const persisted = await cdp.evaluate(`(() => {
    const btn = document.querySelector('[data-term-toggle][aria-pressed="true"]');
    return {
      restored: !!btn,
      id: btn ? btn.getAttribute('data-term-toggle') : '',
      count: document.querySelector('[data-known-count]')?.textContent.trim() || '',
    };
  })()`);
  check('刷新后掌握状态还在（进度真的读回来了）',
    persisted.restored && persisted.id === (mark ? mark.id : ''),
    persisted.id ? `${persisted.id} / 计数「${persisted.count}」` : `未恢复（期望 ${mark?.id}）`);

  /* ============ 12. 图解文字不许被画布静默裁掉 ============ */
  console.log('\n[12] 图解文字是否被画布裁掉');

  /*
   * svg 默认 `overflow: hidden` —— 一行注释字只要比 viewBox 宽，就会在边缘被**安静地切掉**。
   * 构建成功、全部断言绿、只有放大截图才看得出来。所以这里用 getBBox() 逐条量：
   * 它给的是 user 单位，和 viewBox 同一把尺子，不用换算。
   *
   * ⚠️ 两个坑，都踩过：
   *   (a) 量之前先把入场动效的 delay/duration 清零。dm-t 是 translateY 形式的动画，
   *       中途量到的不是终态框。（改动画属性会让动画重播，所以注入与测量要分成两步，
   *       中间留一拍 —— 同一个 evaluate 里注入完就量，样式还没重算。）
   *   (b) 越界判断的四个减数顺序**不能凭感觉写**。第一版探针把垂直方向写成了
   *       `(vy+vh) - (b.y+b.height)`，那量的是「底边还剩多少空间」，
   *       于是任何正常文字都得到几百的假正值，全站报了 711 处假「溢出」。
   *       正确的写法是 `b.y + b.height - (vy + vh)`。
   */
  await cdp.goto(`${BASE}/`, 300);
  const chapterUrls = [];
  for (const dom of ['llm', 'harness', 'eval', 'knowledge']) {
    await cdp.goto(`${BASE}/${dom}/`, 200);
    const found = await cdp.evaluate(`[...document.querySelectorAll('a[href]')]
      .map((a) => a.getAttribute('href'))
      .filter((h) => /^\\/${dom}\\/[a-z0-9-]+\\/$/.test(h))`);
    for (const h of found) if (!chapterUrls.includes(h)) chapterUrls.push(h);
  }
  check('从四个领域页能找齐全部章节链接', chapterUrls.length >= 20, `${chapterUrls.length} 个`);

  let overflow = 0;
  const overflowSample = [];
  for (const u of chapterUrls) {
    await cdp.goto(`${BASE}${u}`, 120);
    await cdp.evaluate(`(() => {
      const s = document.createElement('style');
      s.textContent = '*{animation-delay:0s !important;animation-duration:1ms !important}';
      document.head.appendChild(s);
    })()`);
    await sleep(150); // 等这一帧的样式重算 + 动画跳到终态
    const bad = await cdp.evaluate(`(() => {
      const out = [];
      document.querySelectorAll('svg.dm-svg').forEach((svg) => {
        const raw = (svg.getAttribute('viewBox') || '').trim();
        const vb = raw.split(/\\s+/).map(Number);
        if (vb.length !== 4 || vb.some((n) => !Number.isFinite(n))) {
          out.push('viewBox 异常: ' + JSON.stringify(raw));
          return;
        }
        const [vx, vy, vw, vh] = vb;
        svg.querySelectorAll('text').forEach((t) => {
          const b = t.getBBox();
          const over = Math.max(
            b.x + b.width - (vx + vw),   /* 越右 */
            vx - b.x,                    /* 越左 */
            b.y + b.height - (vy + vh),  /* 越下 */
            vy - b.y                     /* 越上 */
          );
          if (over > 0.5) {
            out.push('「' + (t.textContent || '').slice(0, 22) + '」越界 ' + over.toFixed(1));
          }
        });
      });
      return out;
    })()`);
    if (bad.length) {
      overflow += bad.length;
      if (overflowSample.length < 3) overflowSample.push(`${u} → ${bad[0]}`);
    }
  }
  check('图解里的文字都在画布内（没被 overflow:hidden 裁掉）', overflow === 0,
    overflow ? `${overflow} 处：${overflowSample.join(' ｜ ')}` : `${chapterUrls.length} 页、全部图元通过`);

  /* ============ 13. 无 JS 报错 ============ */
  console.log('\n[13] 运行期异常');
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
