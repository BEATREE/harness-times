#!/usr/bin/env node
/**
 * 构建产物结构体检。
 *
 * 和 tools/verify.mjs 的分工：
 *   · tools/verify.mjs  跑的是「活页面」——用 CDP 起浏览器点按钮、查 localStorage，
 *     验证的是交互行为。
 *   · 本脚本只看 dist/ 里的静态 HTML，验证的是「该出现的结构确实出现了」。
 *     好处是不需要浏览器、几毫秒跑完，适合挂在构建后立刻自查。
 *
 * 为什么需要它：
 *   代码块的文件名栏是靠 Shiki transformer + rehype 插件「接力」做出来的，
 *   图解动效是靠构建期改写裸 SVG 字符串做出来的——中间任何一环失效都不会让构建报错，
 *   只是产出悄悄退化（最惨的一次是整张 SVG 静默消失）。这类「静默退化」只能靠断言拦住。
 *
 * 用法：node scripts/verify-build.mjs
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

if (!existsSync(dist)) {
  console.error('[verify-build] 没找到 dist/，先跑一次构建。');
  process.exit(1);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const count = (haystack, needle) => haystack.split(needle).length - 1;

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
};

const htmlFiles = walk(dist).filter((f) => f.endsWith('.html'));
const pages = new Map(
  htmlFiles.map((f) => [f.slice(dist.length + 1).replace(/\\/g, '/'), readFileSync(f, 'utf8')])
);

// 章节数从内容源数出来（不是写死 22 / 31）——加/删章节只让源与产物同步变。
const _chapterFiles = readdirSync(join(root, 'src', 'content', 'chapters'))
  .filter((f) => f.endsWith('.md'));
const chapterCount = _chapterFiles.length;
// 固定页：首页 / 4 领域页 / 名词库 / 题库 / 进度 / 关于 = 9 页，加每章 1 页
const expectPageCount = 9 + chapterCount;

check(`生成了 ${expectPageCount} 个 HTML 页面`, pages.size === expectPageCount, `实际 ${pages.size}`);

/* ---------- 1. 代码块：文件名栏 ---------- */
let codeBlocks = 0;
let withHead = 0;
let withLang = 0;
const chapterPages = [...pages.entries()].filter(([p]) => /^[a-z]+\/[a-z0-9-]+\/index\.html$/.test(p));

// 代码块总数：从内容源数围栏（``` 出现次数 / 2，与 wiki-facts 同口径），
// 不写死常量 —— 加/删代码块只让源与产物同步变，不会误红。
// 这里提前读一次章节源（后面第 11 节还会复用 readText/chapterSrcDir，但先在此定义避免 TDZ）。
{
  const _srcDir = join(root, 'src', 'content', 'chapters');
  const _all = readdirSync(_srcDir).filter((f) => f.endsWith('.md'))
    .map((f) => readFileSync(join(_srcDir, f), 'utf8').replace(/\r\n/g, '\n')).join('\n');
  var expectCodeBlocks = Math.floor((_all.match(/^```/gm) || []).length / 2);
}

for (const [, html] of chapterPages) {
  codeBlocks += count(html, 'class="code-block"');
  withHead += count(html, 'class="code-head"');
  withLang += count(html, '<span class="lang">');
}

check('代码块总数与内容源围栏数一致（不写死常量，加代码块不会红）', codeBlocks === expectCodeBlocks, `实际 ${codeBlocks}，源里围栏 ${expectCodeBlocks}`);
check('每个代码块都有文件名栏', withHead === codeBlocks, `code-head ${withHead} / code-block ${codeBlocks}`);
check('每个文件名栏都带语言标签', withLang === codeBlocks, `lang ${withLang} / code-block ${codeBlocks}`);

const shikiHighlighted = chapterPages.reduce((n, [, html]) => n + count(html, 'class="line"'), 0);
check('Shiki 高亮生效（存在 .line 行容器）', shikiHighlighted > 200, `.line 共 ${shikiHighlighted}`);

/* ---------- 2. 不该再出现的「日报」表述 ---------- */
const allHtml = [...pages.values()].join('\n');
check('不再有 data-issue（期号）', !allHtml.includes('data-issue'));
check('不再出现「第 N 期」', !/第\s*\d+\s*期/.test(allHtml));
check('不再出现「本报」', !allHtml.includes('本报'));

/*
 * 不再出现 CSV。
 * 首页能力地图曾挂过一个 `harness-layers.csv` 下载入口，后来确认那是早期表述失误：
 * 本站不提供数据附件，图解的结论由图注与正文承载。文件与入口都已删除。
 * 这条断言防的是「有人顺手又把下载链接加回来」——静态资源删了但 HTML 里还留链接，
 * 构建不会报错，用户点下去才发现 404。
 */
check('不再出现 CSV 下载入口', !/\.csv/i.test(allHtml));
const publicData = join(root, 'public', 'data');
check('public/data 目录已移除', !existsSync(publicData));

/* ---------- 2b. canonical 必须指向自定义域名 ----------
 *
 * 自定义域名 harness.beatree.cn 是「对外主张的地址」，Pages 默认域名只是分发通道。
 * 两个域名都能访问，所以 canonical 一旦退回 pages.dev，站是好的、页面也不报错，
 * 但搜索引擎会把同一份内容按两个域名各收一份 —— 这类退化只有断言拦得住。
 */
const canonicals = [...pages.values()]
  .flatMap((h) => [...h.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map((m) => m[1]));
check('每个页面都有 canonical', canonicals.length === pages.size, `实际 ${canonicals.length} / ${pages.size}`);
check(
  'canonical 全部指向 harness.beatree.cn',
  canonicals.length > 0 && canonicals.every((u) => u.startsWith('https://harness.beatree.cn/')),
  canonicals.find((u) => !u.startsWith('https://harness.beatree.cn/')) ?? ''
);
check('canonical 里不再出现 pages.dev', !canonicals.some((u) => u.includes('pages.dev')));

/* ---------- 3. 侧栏：领域配色 / 分组折叠 / 整体收起 ---------- */
const sample = pages.get('index.html') ?? '';
for (const d of ['llm', 'harness', 'eval', 'knowledge']) {
  check(`侧栏有 ${d} 分组标记`, sample.includes(`data-domain="${d}"`));
}
check('侧栏有 4 个分组折叠按钮', count(sample, 'data-group-toggle=') === 4, `实际 ${count(sample, 'data-group-toggle=')}`);
check('侧栏有整体收起按钮', sample.includes('nav-collapse-btn'));
check('分组内容有折叠容器', count(sample, 'nav-group-inner') === 4, `实际 ${count(sample, 'nav-group-inner')}`);

/* ---------- 4. 关于页 ---------- */
const about = pages.get('about/index.html') ?? '';
check('关于页有公众号二维码图', about.includes('beatree.cn/gzh/gzh-qr-card.jpg'));
check('关于页指向 beatree.cn 主站', about.includes('https://beatree.cn'));
check('关于页有 27 个关联网站', count(about, 'class="rel-item"') === 27, `实际 ${count(about, 'class="rel-item"')}`);
check('关于页已移除 宝玉 / baoyu.io', !/baoyu\.io|宝玉/.test(about));
check('关于页标题为「关于本站」', about.includes('关于本站'));
check('关于页声明不是每日报刊', about.includes('不是一份每天更新的报刊'));
check('关于页有主站 CTA 区块', about.includes('class="cta cta-main"') && about.includes('class="cta-row"'));
check('主站 CTA 是外链且带 rel=noopener', /class="cta cta-main"[^>]*target="_blank"[^>]*rel="noopener"/.test(about));
/* 源码入口：这是「本站有公开作品」这条叙事在页面上的落点，
 * 链接失效或 rel 掉了都不报错，所以必须断言。 */
check(
  '关于页有「本站源码」GitHub 入口',
  about.includes('class="cta cta-slim cta-src"') &&
    about.includes('https://github.com/BEATREE/harness-times')
);
check(
  '源码入口是外链且带 rel=noopener',
  /class="cta cta-slim cta-src"[^>]*target="_blank"[^>]*rel="noopener"/.test(about)
);

/* ---------- 5. 主站入口的另外两处（不只是关于页） ---------- */
check('报头有 beatree.cn 主站入口', sample.includes('class="site-link"') && sample.includes('https://beatree.cn'));
check('侧栏有 beatree.cn 外链项', sample.includes('nav-item nav-ext'));

/* ---------- 6. 正文页：两侧大翻页区（上一章 / 下一章） ----------
 *
 * 这一版把「34px 宽的小书签」换成了整块可点的大面板 .page-rail。
 * 断言的重点因此从「有没有侧边容器」变成三件事：
 *   1) 面板确实渲染出来了、内容是可读文本而不是 aria-hidden 的装饰；
 *   2) 面板是 .sheet 的**兄弟**节点（三栏 flex 的硬前提，写成子节点版式会静默塌掉）；
 *   3) 旧的窄书签（side-pager / sp-card）确实清干净了，没有半旧半新的残留。
 */
const firstChapter = pages.get('llm/llm-01-transformer/index.html') ?? '';
/* 末章不写死文件名：哪一页的「下一章」带 is-end 就是末章（新增章节时不用改这里） */
const lastChapter = chapterPages.map(([, h]) => h).find((h) =>
  h.includes('class="page-rail rail-next is-end"')
) ?? '';

let railPrevPages = 0;
let railNextPages = 0;
let railEndPages = 0;
let railHintPages = 0;
let railTitlePages = 0;
let railDomainPages = 0;
let railStructureOk = 0;
/* 末章的翻页区是 rail-next is-end，所以匹配到 "rail-next 为止" 而不是整个 class 值 */
const RAIL_PREV_AT = /class="page-rail rail-prev"/;
const RAIL_NEXT_AT = /class="page-rail rail-next/;
for (const [, html] of chapterPages) {
  if (RAIL_PREV_AT.test(html)) railPrevPages += 1;
  if (RAIL_NEXT_AT.test(html)) railNextPages += 1;
  if (html.includes('class="page-rail rail-next is-end"')) railEndPages += 1;
  if (html.includes('class="rail-hint"')) railHintPages += 1;
  if (html.includes('class="rail-title"')) railTitlePages += 1;
  if (/class="page-rail rail-(prev|next)"[^>]*data-domain="(llm|harness|eval|knowledge)"/.test(html)) {
    railDomainPages += 1;
  }
  // 结构不变量：<body> … rail-prev … <div class="sheet"> … rail-next（同级、且顺序正确）
  const bodyAt = html.indexOf('<body');
  const prevAt = html.search(RAIL_PREV_AT);
  const sheetAt = html.indexOf('<div class="sheet">');
  const nextAt = html.search(RAIL_NEXT_AT);
  if (bodyAt !== -1 && prevAt > bodyAt && prevAt < sheetAt && nextAt > sheetAt) railStructureOk += 1;
}
check(`除首章外 ${chapterCount - 1} 章有「上一章」大翻页区`, railPrevPages === chapterCount - 1, `实际 ${railPrevPages}`);
check(`${chapterCount} 章都有「下一章」大翻页区`, railNextPages === chapterCount, `实际 ${railNextPages}`);
check('首章无「上一章」（确实是第一篇）', !RAIL_PREV_AT.test(firstChapter), '首章出现了上一章面板');
check(
  '末章「下一章」指向进度页并标 is-end',
  railEndPages === 1 && lastChapter.includes('class="page-rail rail-next is-end"') && lastChapter.includes('href="/progress/"'),
  `is-end 出现 ${railEndPages} 次`
);
check('翻页区是 .sheet 的兄弟节点且顺序正确', railStructureOk === chapterCount - 1, `结构正确 ${railStructureOk} / ${chapterCount - 1}`);
check('翻页区标题是可读文本（.rail-title，非 aria-hidden）', railTitlePages === chapterCount, `实际 ${railTitlePages}`);
check('翻页区按领域着色（data-domain）', railDomainPages === chapterCount, `实际 ${railDomainPages}`);
check('翻页区带快捷键提示 .rail-hint', railHintPages === chapterCount, `实际 ${railHintPages}`);
check(
  '翻页区带 aria-label 供读屏使用',
  /class="page-rail rail-next"[^>]*aria-label="[^"]+"/.test(firstChapter)
);
check('已移除旧的窄书签翻页（side-pager / sp-card）', !allHtml.includes('side-pager') && !allHtml.includes('sp-card'));

/* ---------- 7. 图解：构建期动效标注 ---------- */
// 期望值从内容源里数出来，而不是写死一个数字。
// 原因：这两个数字每加一张图就变，写死的结果是「断言一红就被人改成当前实际值」，
// 断言沦为记账。从源里数则仍然拦得住真正的退化 —— 插件一旦停止标注，
// dmSvg 就会掉到源里的 svg 数以下，dmGo 同理。
//
// 读源文件一律走 readText()：Windows 上 core.autocrlf=true 会把内容文件签出成 CRLF，
// 而带 m 标志的 JS 正则里 `$` 不认 \r\n，会让逐行匹配静默失配。
const chapterSrcDir = join(root, 'src', 'content', 'chapters');
const readText = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const allChapterSrc = readdirSync(chapterSrcDir)
  .filter((f) => f.endsWith('.md'))
  .map((f) => readText(join(chapterSrcDir, f)))
  .join('\n');
const expectSvg = count(allChapterSrc, '<svg viewBox');
// 插件只给「能读出两端坐标」的箭头线补流光层，所以这里也照同样的条件数：
// 非 <defs> 内（defs 里的 marker/path 不参与）+ 带 marker-end + 坐标齐全。
const expectGo = allChapterSrc
  .split('\n')
  .filter((l) => /^\s*<line\b/.test(l) && /marker-end=/.test(l) && /x1="[\d.-]+"/.test(l) && /y1="[\d.-]+"/.test(l) && /x2="[\d.-]+"/.test(l) && /y2="[\d.-]+"/.test(l)).length;

let dmSvg = 0;
let dmGo = 0;
let dmT = 0;
let dmN = 0;
let vbwMissing = 0;
for (const [, html] of chapterPages) {
  dmSvg += count(html, 'dm-svg');
  dmGo += count(html, 'dm-go');
  dmT += count(html, 'dm-t');
  dmN += count(html, 'dm-n');
  // 每个被标注的 svg 都要带 --vbw（否则动效层算不出尺寸）
  vbwMissing += count(html, 'class="dm-svg"') - count(html, 'dm-svg" style="--vbw:');
}
check('图解均已标注 dm-svg（与内容源里的 svg 数一致）', dmSvg === expectSvg, `产物 ${dmSvg} / 源 ${expectSvg}`);
check('每个图解都带 --vbw 设计宽', vbwMissing === 0, `缺 ${vbwMissing}`);
check('箭头均有流向彗星层 dm-go（与内容源里的箭头数一致）', dmGo === expectGo, `产物 ${dmGo} / 源 ${expectGo}`);
check('图示文字均参与入场（dm-t）', dmT >= 400, `实际 ${dmT}`);
check('图示节点参与描边扫读（dm-n）', dmN >= 80, `实际 ${dmN}`);

/* ---------- 8. 字体与配色 ---------- */
const cssFiles = walk(dist).filter((f) => f.endsWith('.css'));
const css = cssFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
check('CSS 里已无 SimSun 回退', !/SimSun/i.test(css));
check('CSS 正文栈含 PingFang SC', /PingFang SC/.test(css));
check('CSS 正文栈含 Microsoft YaHei', /Microsoft YaHei/.test(css));
check('CSS 去掉了纸面深色底（旧灰屏成因）', !css.includes('#2c2824'));
check('CSS 含侧栏收起状态', css.includes('nav-collapsed'));

/* ---------- 9. 三栏阅读布局：正文与 .chapter-toolbar 同宽 ----------
 *
 * 用户诉求：「正文栏过窄，要和 .chapter-toolbar 一样宽」。
 * 实现方式是让两者共用同一个变量 --sheet-pad（纸面内边距）：
 *   工具栏用负 margin 撑满整张纸；正文用等量负 margin 跟着一起撑满 ⇒ 两条边线重合。
 * 所以这里断言的是「同一个变量在两个地方都被用到」，而不是写死某个像素值——
 * 只要将来有人改了 --sheet-pad 却漏改其中一处，断言就会红。
 */
check('CSS 引入纸面内边距变量 --sheet-pad（正文与工具栏同宽的唯一来源）', /--sheet-pad:\s*\d+px/.test(css));
check('CSS 引入翻页区宽度变量 --rail-w', /--rail-w:\s*\d+px/.test(css));
check(
  '正文按 --sheet-pad 撑满（width: calc(100% + 2 * var(--sheet-pad))）',
  /width:\s*calc\(100% \+ 2 \* var\(--sheet-pad\)\)/.test(css)
);
check('正文负 margin 与工具栏同量（calc(-1 * var(--sheet-pad))）', /margin-left:\s*calc\(-1 \* var\(--sheet-pad\)\)/.test(css));
/*
 * 断言的 css 是 dist 里的**压缩产物**，所以正则要能容忍压缩器的改写：
 *   `@media (min-width: 1300px)` → `@media(min-width:1300px)`（@media 后、冒号后的空格都被吃掉）
 *   `display: none !important`   → `display:none!important`（!important 前空格也被吃掉）
 * 这里一律用 `\s*`，免得断言因为压缩器换了个版本就误报。
 */
check(
  '≥1300px 时 .main 变三栏 flex',
  /@media\s*\(min-width:\s*1300px\)[\s\S]{0,900}\.main\s*\{[\s\S]{0,200}display:\s*flex/.test(css)
);
check(
  '翻页区默认隐藏，只在 ≥1300px 显示（窄屏回落到章尾 .pager）',
  /\.page-rail\s*\{\s*display:\s*none/.test(css) &&
    /@media\s*\(min-width:\s*1300px\)[\s\S]{0,900}\.page-rail\s*\{[\s\S]{0,200}display:\s*flex/.test(css)
);
check('翻页区随阅读位置吸顶（position: sticky）', /\.page-rail\s*\{[\s\S]{0,700}position:\s*sticky/.test(css));
check('翻页区有 prefers-reduced-motion 降级', /prefers-reduced-motion[\s\S]{0,300}\.page-rail/.test(css));
check(
  '打印时隐藏翻页区并回到单栏',
  /@media print[\s\S]{0,600}?\.page-rail,[\s\S]{0,200}?display:\s*none\s*!important/.test(css)
);

/*
 * 侧栏让位：窄屏（<1300px）没有翻页区兜着，正文必须靠 --sidebar-hold 让开固定侧栏，
 * 否则会贴到屏幕边上。≥1300px 那份「镜像留白」已被取消（空间让给正文和翻页区），
 * 所以这里只断言窄屏那套仍然成立。
 */
check('CSS 保留 --sidebar-hold 占位变量（窄屏让开固定侧栏）', /--sidebar-hold/.test(css));
check('窄屏正文让开侧栏（margin-left: var(--sidebar-hold)）', /margin-left:\s*var\(--sidebar-hold\)/.test(css));
check('窄屏镜像留白会随空间收缩（避免正文被压到不可读）', /padding-right:\s*min\(var\(--sidebar-hold\)/.test(css));

/* ---------- 10. 动效样式确实下发到浏览器 ---------- */
check('CSS 有图解入场动画', css.includes('dm-in'));
check('CSS 有描边扫读动画', css.includes('dm-sweep'));
check('CSS 有流向彗星动画', css.includes('dm-travel'));
check('CSS 有 prefers-reduced-motion 降级', /prefers-reduced-motion/.test(css));
check('CSS 有大翻页区样式', css.includes('page-rail'));

/* 关于页出口区：两块主推大卡 + 一条整宽源码横条。
 *
 * 注意：Astro 会把组件里的 <style> 抽成单独的 CSS 包，所以「样式断言」必须读 css，
 * 读 about/index.html 是一定读不到的 —— 这类断言写错位置不会报错，只会永远失败，
 * 容易被后来的人当噪声忽略掉。
 *
 * 这里刻意**不**断言「源码做成第三张竖卡」：试过，纸面只有 600～700px 时三栏会把
 * 说明文案压成「一列一个字」。横条对纸面宽度不敏感，是这版能稳的原因。 */
check('关于页出口区是两块主推卡（主站最宽）', /grid-template-columns:\s*1\.4fr 1fr/.test(css));
check('出口区窄屏降单栏', /max-width:\s*620px\)[\s\S]{0,600}\.cta-row[\s\S]{0,140}grid-template-columns:\s*1fr/.test(css));
check('源码入口是整宽横条（.cta-slim 走 flex 而非 block）', /\.cta-slim[\s\S]{0,200}?display:\s*flex/.test(css));

/* 左边缘悬停唤出目录（peek）—— 这几条是「实现方式」的锁，不是「功能存在」的锁。
 *
 * 功能本身由 tools/verify.mjs 用真实鼠标事件验（含「弹出来时正文不许位移」）；
 * 这里锁的是三件静态的事，它们错了页面照样能跑，只是会变得难用或违反自家规范：
 *   1) 唤出必须只做 transform —— 一旦改成动 `--sidebar-hold`，整页会随鼠标重排；
 *   2) 唤出期间收起书签必须让位（它 z-index 45 压在侧栏 40 之上，不藏就是个挡路的「›」）；
 *   3) 必须有 prefers-reduced-motion 分支（「不要做」清单第 10 条）。
 */
check('CSS 有左边缘唤出规则（只做 transform 复位）',
  /body\.nav-collapsed\.nav-peek\s+\.sidebar\s*\{[\s\S]{0,160}?transform:\s*none/.test(css));
check('唤出期间收起书签让位（opacity:0 + pointer-events:none）',
  /body\.nav-collapsed\.nav-peek\s+\.nav-collapse-btn\s*\{[\s\S]{0,160}?opacity:\s*0[\s\S]{0,80}?pointer-events:\s*none/.test(css));
check('唤出态有 prefers-reduced-motion 降级',
  /prefers-reduced-motion[\s\S]{0,200}?\.nav-collapse-btn[\s\S]{0,120}?transition:\s*none/.test(css));
check('窄屏悬停唤出不带遮罩',
  /body\.nav-open\.nav-peek\s+\.scrim\s*\{\s*display:\s*none/.test(css));

/* 交互逻辑在打包出来的 JS 里，只能读产物。
 * 断言用「行为标志」而不是变量名：压缩器会重命名变量，但字符串字面量不会变。 */
const jsFiles = walk(dist).filter((f) => f.endsWith('.js'));
const js = jsFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
check('JS 里挂了悬停唤出（nav-peek + 真实指针事件）',
  js.includes('nav-peek') && js.includes('pointermove'));
check('JS 里只用 hover-capable 设备启用（不吃触屏的 pointermove）',
  /\(hover:\s*hover\)/.test(js));
check('JS 里有停留判定与「离开边带才解除拉黑」的阈值', js.includes('clientX'));

/* ---------- 10. 名词卡片基础设施 ----------
 *
 * 这一组是 2026-09 新增的。它守的是三件「坏了也不报错」的事：
 *   1) 正文里的 [[id]] 有没有真的被展开成指向名词库的链接
 *      —— 展开逻辑一失效，页面上就原样显示 `[[tensor]]`，构建照样成功；
 *   2) 名词数据本身是否自洽（id 不重复、必填字段不为空、每条 refs 都写了 why）
 *      —— 数据错了只会让某张卡片缺一块，页面看起来「只是有点简陋」；
 *   3) 弹窗的无障碍与动效降级是否还在
 *      —— 焦点陷阱、Esc 关闭、prefers-reduced-motion 少了任何一个，
 *         鼠标用户完全无感，键盘与晕动症用户直接不能用。
 *
 * 卡片本体渲染在章节页的隐藏容器里（.term-store），所以下面的计数用的是
 * 章节页 + 名词库页两边的总和：只查一边会漏掉另一半。
 */
const glossaryPage = pages.get('glossary/index.html') ?? '';
check('生成了 /glossary/ 名词库页', glossaryPage.length > 0);

/* —— 10.1 正文里的术语链接确实展开了 —— */
let termLinks = 0;
let termBadHref = 0;
let rawMarkerPages = 0;
/* 未展开的标记会以 `[[xxx]]` 原样出现在 HTML 里；构建期不做断言，只能在这里抓 */
const RAW_MARKER = /\[\[[a-z0-9][a-z0-9-]*(\|[^\]]+)?\]\]/;
for (const [, html] of chapterPages) {
  /* 注意属性顺序：rehype 输出的是 `<a href="…" class="term" …>`，
   * 所以不能写成 `<a class="term"`，否则永远匹配 0 个（踩过）。 */
  const links = html.match(/<a [^>]*class="term"[^>]*>/g) ?? [];
  termLinks += links.length;
  for (const a of links) {
    if (!/href="\/glossary\/#t-[a-z0-9-]+"/.test(a)) termBadHref += 1;
    if (!/data-term="[a-z0-9-]+"/.test(a)) termBadHref += 1;
  }
  if (RAW_MARKER.test(html)) rawMarkerPages += 1;
}
check('章节页里有行内术语链接（至少第 1 章已接入）', termLinks >= 20, `实际 ${termLinks}`);
check('所有术语链接都指向 /glossary/#t-<id> 且带 data-term', termBadHref === 0, `异常 ${termBadHref} 个`);
check('没有未展开的 [[id]] 标记漏进产物', rawMarkerPages === 0, `${rawMarkerPages} 个页面有残留标记`);

/* —— 10.2 名词数据自洽 —— */
/* 读源文件一律折成 LF：Windows 上 core.autocrlf=true 会把源文件签出成 CRLF，
 * 而带 m 标志的 `$` 不认 `\r\n` —— 下面 `id: '...',$` 这类行尾锚定的正则
 * 会静默数成 0，断言红得莫名其妙。（同一约定见 scripts/wiki-lint.mjs） */
const glossarySrc = readFileSync(join(root, 'src/data/glossary.ts'), 'utf8').replace(/\r\n/g, '\n');
const termIds = [...glossarySrc.matchAll(/^\s{4}id: '([a-z0-9-]+)',$/gm)].map((m) => m[1]);
check('名词库 id 不重复', new Set(termIds).size === termIds.length,
  `${termIds.length} 个 id，去重后 ${new Set(termIds).size} 个`);
for (const field of ['meaning', 'scene', 'explain']) {
  const n = (glossarySrc.match(new RegExp(`^\\s{4}${field}:`, 'gm')) ?? []).length;
  check(`每个名词都有 ${field}（${termIds.length} 条）`, n === termIds.length, `实际 ${n}`);
  /* 内联 HTML 字段里写 markdown 加粗 → 页面上会原样显示两个星号。
   * JSDoc 注释不在这些字段里，所以直接按行首 `    xxx:` 抓即可。 */
  const mdBold = (glossarySrc.match(/^\s{4}(meaning|scene|explain|example):[^\n]*\*\*/gm) ?? []).length;
  check(`${field} 所在字段没有误用 markdown 加粗`, mdBold === 0, `发现 ${mdBold} 处 **`);
}
{
  /* refs 的每条都必须有 why —— 「只贴链接不写理由」是这个项目明确禁止的 */
  const labelN = (glossarySrc.match(/^\s{8}label:/gm) ?? []).length;
  const whyN = (glossarySrc.match(/^\s{8}why:/gm) ?? []).length;
  check('每条延伸阅读都写了 why（为什么值得读）', labelN > 0 && labelN === whyN,
    `label ${labelN} / why ${whyN}`);
}

/* —— 10.3 名词库页渲染完整 —— */
const cardOnGlossary = count(glossaryPage, 'class="term-card"');
check('名词库页每条名词一张卡片', cardOnGlossary === termIds.length,
  `卡片 ${cardOnGlossary} / 名词 ${termIds.length}`);
check('名词库页卡片都有锚点 id（#t-<id>）',
  (glossaryPage.match(/class="term-card" id="t-[a-z0-9-]+"/g) ?? []).length === termIds.length);
check('名词库页有搜索入口', glossaryPage.includes('data-glossary-q'));
check('名词库页有知识域筛选', glossaryPage.includes('data-glossary-filters'));
check('名词库页有可跳转的快速索引', glossaryPage.includes('data-glossary-jump='));
check('名词库页默认是可读的全部内容（不靠 JS 才渲染）',
  count(glossaryPage, 'data-glossary-item=') === termIds.length);

/* —— 10.4 章节页的弹窗（含无障碍与降级） —— */
const firstChapterPage = pages.get('llm/llm-01-transformer/index.html') ?? '';
check('章节页渲染了名词卡片弹窗', firstChapterPage.includes('data-term-modal'));
check('弹窗是 role=dialog + aria-modal', /role="dialog"[^>]*aria-modal="true"/.test(firstChapterPage));
check('弹窗有「在名词库中查看」兜底出口', firstChapterPage.includes('data-tm-href'));
check('弹窗默认隐藏（hidden）', /data-term-modal[^>]*hidden/.test(firstChapterPage));
/* 注意：弹窗脚本**不在 dist 的 .js 文件里** —— 它太小了，Astro 会直接内联进
 * 页面 HTML 的 `<script type="module">`。所以这里要连 HTML 一起搜，
 * 只搜 js 文件会永远为 false（踩过）。 */
const jsAndInline = js + '\n' + allHtml;
check('JS 里有关闭键（Esc）与焦点陷阱（Tab）',
  jsAndInline.includes('Escape') && jsAndInline.includes('Tab') && jsAndInline.includes('term-open'));
check('弹窗打开时锁页面滚动', /term-open/.test(css) && /overflow:\s*hidden/.test(css));
check('内联术语有可辨识的下划线与悬停态', /a\.term\s*\{[\s\S]{0,200}?border-bottom:\s*1px dashed/.test(css));
check('术语与弹窗都有 prefers-reduced-motion 降级',
  /prefers-reduced-motion[\s\S]{0,300}?\.tm-panel[\s\S]{0,80}?animation:\s*none/.test(css));
check('弹窗有 .term-store[hidden] 兜底（避免卡片铺满页面）',
  /\.term-store\[hidden\]\s*\{\s*display:\s*none/.test(css));

/* —— 10.5 术语的双语原名 · 命名辨析 · 掌握标记（2026-09-18 新增） ——
 *
 * 这一组守的是「坏了也看不出来」的那半边：
 *   · 英文原名（term-en）由构建期按「本章首次出现」注入。注错位置（每次都注、
 *     或者注进链接**里面**）页面看起来一样正常，只有逐字读源码才发现；
 *   · 单词卡里的「命名」一行来自 glossary.ts 的 naming 字段 —— 漏一条只是那张卡
 *     少半块，25 张卡没人逐张核对；
 *   · 「标记已掌握」按钮的**静态结构**在这里查，点下去的**行为**在 tools/verify.mjs
 *     里用真事件查（这里跑不起浏览器）。
 *
 * 另外把「术语红」的对比度实算一遍：用户提的是「更容易看到」，
 * 那就不能只写个 var(--red) 就算数 —— 颜色值随时可能被调，
 * 调暗一点就从「醒目」变成「看不清」。数字算出来才拦得住。
 */
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const relLum = (h) => {
  const [r, g, b] = hex2rgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [relLum(a), relLum(b)].sort((m, n) => n - m);
  return (hi + 0.05) / (lo + 0.05);
};
const cssVar = (name) => (new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css) ?? [])[1];

let termEn = 0;
let glossInsideLink = 0;
let glossDuplicated = 0;
for (const [, html] of chapterPages) {
  const n = count(html, 'class="term-en"');
  termEn += n;
  /* 只认「紧跟在 </a> 之后」的那种 —— 用户点得动的只有中文那一段，
   * 英文注解不该跟着变成链接（否则点它也会弹卡片、也会被下划线连起来） */
  const adjacent = count(html, '</a><span class="term-en">');
  if (adjacent !== n) glossInsideLink += 1;
  /* 同一页里同一个术语只该注一次（「首次」）。重复注 = 首次判断失效 */
  const ids = new Set();
  for (const a of html.match(/<a [^>]*class="term"[^>]*>/g) ?? []) {
    const m = /href="\/glossary\/#t-([a-z0-9-]+)"/.exec(a);
    if (m) ids.add(m[1]);
  }
  if (n > ids.size) glossDuplicated += 1;
}
check('正文术语给出了英文原名（term-en）', termEn >= 8, `实际 ${termEn} 处`);
check('英文原名挂在术语链接之外（点了不跳转、不连下划线）', glossInsideLink === 0,
  `${glossInsideLink} 个页面把注解塞进了链接里`);
check('同一页同一术语只注一次英文原名（「首次」判断生效）', glossDuplicated === 0,
  `${glossDuplicated} 个页面重复注解`);
check('英文原名确实说的是那个术语本身（例：自注意力 → Self-Attention）',
  /自注意力<\/a><span class="term-en">（Self-Attention）<\/span>/.test(firstChapterPage));

const namingSrc = (glossarySrc.match(/^\s{4}naming:/gm) ?? []).length;
const namingCards = count(glossaryPage, 'class="tc-naming"');
check('名词库登记了「命名辨析」（译名丢了什么）', namingSrc >= 20, `${namingSrc} 条`);
check('每张单词卡都渲染出「命名」行', namingCards === namingSrc,
  `卡片 ${namingCards} / 数据 ${namingSrc}`);

check('单词卡都带「标记已掌握」按钮',
  count(glossaryPage, 'data-term-toggle=') === termIds.length,
  `${count(glossaryPage, 'data-term-toggle=')} / ${termIds.length}`);
check('掌握按钮带 aria-pressed（读屏能念出当前状态）',
  /data-term-toggle="[a-z0-9-]+"[^>]*aria-pressed="false"/.test(glossaryPage));
check('名词库有「只看未掌握」入口', glossaryPage.includes('data-known-only'));

check('正文术语用套色红标出（不是跟正文同色）',
  /a\.term\s*\{[^}]*color:\s*var\(--red\)/.test(css));
check('术语红与纸色的对比度达到 AA（≥ 4.5:1）',
  !!cssVar('red') && !!cssVar('paper') && contrast(cssVar('red'), cssVar('paper')) >= 4.5,
  cssVar('red') && cssVar('paper')
    ? `${cssVar('red')} on ${cssVar('paper')} = ${contrast(cssVar('red'), cssVar('paper')).toFixed(2)}:1`
    : '取不到 --red / --paper');

/* ---------- 11. 中文标点不许吃掉加粗 ----------
 *
 * 用户报的现象：正文里写 `关键在于：**这个矩阵不是人写的，是训练出来的。**训练时…`，
 * 页面上 `**` 原样印了出来，一个字都没加粗。
 *
 * 原因是 CommonMark 的强调定界符规则：闭合标记紧邻中文标点时不再是 right-flanking，
 * 于是这一对谁也配不上谁。更糟的是多个中文标点会让配对**整体错位** ——
 * `其实只是**「数 + 排列方式」**。用一个叫**阶数**（rank）…`
 * 会渲染成 `<strong>。用一个叫</strong>`，把五个毫不相干的字加粗了。
 *
 * 修复见 `scripts/lib/emphasis.mjs`（把坏掉的那几对改写成 `<strong>`），
 * 源头由 `content:check` 守着。这里守的是**产物**这一端：
 * 万一哪天改写逻辑没跑、或者有人手工把源码改回去，也必须有人喊。
 *
 * ⚠️ 检查前要剥掉三类东西，它们里面的 `**` 都是**故意的**：
 *   · HTML 注释 —— 布局文件的设计说明里就写着 `.sheet 的**兄弟节点**`
 *     （第一版没剥，31 个页面全红，纯属自找）；
 *   · `<script>` / `<style>` —— 不是读者可见文字；
 *   · `<pre>` / `<code>` —— 代码块里的 `**` 是代码（Python 的 `1024**3` 幂运算、
 *     `**kwargs`），展示提示词模板时那对 `**` 也是要原样给读者看的。
 * 剥完之后再出现 `**`，就只可能是「markdown 没解析掉」这一个原因了。
 */
const visibleOf = (html) =>
  html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<pre[\s\S]*?<\/pre>/g, '')
    .replace(/<code[\s\S]*?<\/code>/g, '');

let leakPages = 0;
for (const [, html] of chapterPages) {
  if (visibleOf(html).includes('**')) leakPages += 1;
}
check('正文里没有漏出的星号加粗（中文标点会吃掉它）', leakPages === 0, `${leakPages} 个页面仍有`);

const ch1Visible = visibleOf(firstChapterPage);
check('报过的那句加粗已正常渲染',
  ch1Visible.includes('<strong>这个矩阵不是人写的，是训练出来的。</strong>训练时'));
check('配对错位已修好（不再把无关的字加粗）',
  !ch1Visible.includes('<strong>。用一个叫</strong>') &&
    ch1Visible.includes('<strong>「数 + 排列方式」</strong>'));

/* ---------- 12. 每章的两节结构 + 词条质量（2026-09-19 全站铺开时新增） ----------
 *
 * 这一轮把第 1 章的样板做法铺到了其余 21 章，统一补了两节：
 *   「常见误区与追问」—— 把最容易理解偏、面试最容易追问的点讲透；
 *   「参考与延伸」  —— 给出真正值得读的深挖路径。
 * 这两节都是**增量**内容：缺了页面照样正常渲染，正是那种
 * 「只有人逐章翻才会发现」的问题，所以必须有断言盯着。
 *
 * 下半组守的是新建的 212 条术语词条的质量。按行数或条数都查不出问题 ——
 * 数据少一条只是某张卡片缺一块，而「命名辨析写成套话」看着还挺完整。
 * 所以这里量化三件事：命名辨析够不够长（套话一定短）、含义是不是一句话、
 * 解释里有没有加粗强调（那是术语卡上唯一的速度锚点）。
 */
const chapterSrcFiles = readdirSync(chapterSrcDir).filter((f) => f.endsWith('.md')).sort();
const noMistakes = [];
const noRefs = [];
for (const f of chapterSrcFiles) {
  const src = readText(join(chapterSrcDir, f));
  const id = f.replace(/\.md$/, '');
  /* 「常见误区与追问」在自测之前，所以要从它的标题切到下一个小节标题为止 */
  const h2 = /^## [^#\n]*常见误区与追问[^\n]*$/m.exec(src);
  if (!h2) noMistakes.push(id);
  else {
    const rest = src.slice(h2.index + h2[0].length);
    const next = rest.search(/^## /m);
    const body = next < 0 ? rest : rest.slice(0, next);
    const subs = (body.match(/^### /gm) ?? []).length;
    if (subs < 4) noMistakes.push(`${id}(仅 ${subs} 条)`);
  }
  /* 「参考与延伸」在末尾 */
  const r2 = /^## [^#\n]*参考与延伸[^\n]*$/m.exec(src);
  if (!r2) noRefs.push(id);
  else {
    const urls = (src.slice(r2.index).match(/\]\(https?:\/\/[^)\s]+\)/g) ?? []).length;
    if (urls < 3) noRefs.push(`${id}(仅 ${urls} 链接)`);
  }
}
check('每章都有「常见误区与追问」节且至少 4 条', noMistakes.length === 0, noMistakes.slice(0, 6).join('、'));
check('每章都有「参考与延伸」节且至少 3 条外链', noRefs.length === 0, noRefs.slice(0, 6).join('、'));

/* 词条的 naming / meaning / explain：两种写法都要抓到 ——
 * 早期 25 条把值写在字段名的下一行（`naming:` 单独一行 + 6 空格缩进的值），
 * 后来批量新增的 212 条写成单行。只按单行式抓会漏掉整整 25 条，而且不报错。
 *
 * ⚠️ 单行式那条必须用 `[ \t]*` 而不是 `\s*`：`\s` 会把换行也吃掉，
 * 于是它也匹配上「字段名单独一行」的那种，与第二条正则重复计数
 * （第一次跑出来 262 = 237 + 25，正好多算 25 条）。 */
const fieldOf = (name) => [
  ...glossarySrc.matchAll(new RegExp(`^ {4}${name}:[ \\t]*'([^']*)',$`, 'gm')),
  ...glossarySrc.matchAll(new RegExp(`^ {4}${name}:\\n {6}'([^']*)',$`, 'gm')),
].map((m) => m[1]);

const namings = fieldOf('naming');
check('每个名词都写了「命名辨析」', namings.length === termIds.length,
  `${namings.length} / ${termIds.length}`);
const thinNaming = namings.filter((v) => v.length < 40);
check('「命名辨析」不是套话（每条 ≥40 字）', thinNaming.length === 0,
  `${thinNaming.length} 条过短，例如「${thinNaming[0] ?? ''}」`);

const meanings = fieldOf('meaning');
const longMeaning = meanings.filter((v) => v.length > 50);
check('名词的「含义」都控制在一句话内（≤50 字）', longMeaning.length === 0,
  `${longMeaning.length} 条过长，例如「${(longMeaning[0] ?? '').slice(0, 30)}…」`);

const explains = fieldOf('explain');
const noBold = explains.filter((v) => !v.includes('<b>'));
const tooShort = explains.filter((v) => v.length < 100);
check('每条解释都带加粗强调（卡片靠它做速读锚点）', noBold.length === 0,
  `${noBold.length} 条没有 <b>，例如 ${noBold.length ? termIds[explains.indexOf(noBold[0])] : ''}`);
check('每条解释都不少于 100 字（不是一行敷衍）', tooShort.length === 0,
  `${tooShort.length} 条过短`);

/* ---------- 输出 ---------- */
let failed = 0;
for (const r of results) {
  if (!r.pass) failed += 1;
  console.log(`${r.pass ? ' ok ' : 'FAIL'}  ${r.name}${r.pass || !r.detail ? '' : `   ← ${r.detail}`}`);
}
console.log(`\n[verify-build] ${results.length} 项断言，失败 ${failed} 项`);
process.exitCode = failed ? 1 : 0;
