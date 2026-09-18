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

check('生成了 30 个 HTML 页面', pages.size === 30, `实际 ${pages.size}`);

/* ---------- 1. 代码块：文件名栏 ---------- */
let codeBlocks = 0;
let withHead = 0;
let withLang = 0;
const chapterPages = [...pages.entries()].filter(([p]) => /^[a-z]+\/[a-z0-9-]+\/index\.html$/.test(p));

for (const [, html] of chapterPages) {
  codeBlocks += count(html, 'class="code-block"');
  withHead += count(html, 'class="code-head"');
  withLang += count(html, '<span class="lang">');
}

check('代码块总数为 24（与内容里的围栏数一致）', codeBlocks === 24, `实际 ${codeBlocks}`);
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
const lastChapter = pages.get('knowledge/knowledge-04-hybrid-trust/index.html') ?? '';

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
check('21 章有「上一章」大翻页区', railPrevPages === 21, `实际 ${railPrevPages}`);
check('22 章都有「下一章」大翻页区', railNextPages === 22, `实际 ${railNextPages}`);
check('首章无「上一章」（确实是第一篇）', !RAIL_PREV_AT.test(firstChapter), '首章出现了上一章面板');
check(
  '末章「下一章」指向进度页并标 is-end',
  railEndPages === 1 && lastChapter.includes('class="page-rail rail-next is-end"') && lastChapter.includes('href="/progress/"'),
  `is-end 出现 ${railEndPages} 次`
);
check('翻页区是 .sheet 的兄弟节点且顺序正确', railStructureOk === 21, `结构正确 ${railStructureOk} / 21`);
check('翻页区标题是可读文本（.rail-title，非 aria-hidden）', railTitlePages === 22, `实际 ${railTitlePages}`);
check('翻页区按领域着色（data-domain）', railDomainPages === 22, `实际 ${railDomainPages}`);
check('翻页区带快捷键提示 .rail-hint', railHintPages === 22, `实际 ${railHintPages}`);
check(
  '翻页区带 aria-label 供读屏使用',
  /class="page-rail rail-next"[^>]*aria-label="[^"]+"/.test(firstChapter)
);
check('已移除旧的窄书签翻页（side-pager / sp-card）', !allHtml.includes('side-pager') && !allHtml.includes('sp-card'));

/* ---------- 7. 图解：构建期动效标注 ---------- */
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
check('图解均已标注 dm-svg', dmSvg === 22, `实际 ${dmSvg}`);
check('每个图解都带 --vbw 设计宽', vbwMissing === 0, `缺 ${vbwMissing}`);
check('箭头均有流向彗星层 dm-go', dmGo === 28, `实际 ${dmGo}`);
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

/* ---------- 输出 ---------- */
let failed = 0;
for (const r of results) {
  if (!r.pass) failed += 1;
  console.log(`${r.pass ? ' ok ' : 'FAIL'}  ${r.name}${r.pass || !r.detail ? '' : `   ← ${r.detail}`}`);
}
console.log(`\n[verify-build] ${results.length} 项断言，失败 ${failed} 项`);
process.exitCode = failed ? 1 : 0;
