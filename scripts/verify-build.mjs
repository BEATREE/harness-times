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

/* ---------- 6. 正文页：左右「上一节 / 下一节」 ---------- */
const firstChapter = pages.get('llm/llm-01-transformer/index.html') ?? '';
const lastChapterKey = [...pages.keys()]
  .filter((p) => /^[a-z]+\/[a-z0-9-]+\/index\.html$/.test(p))
  .sort()
  .pop();
const lastChapter = pages.get(lastChapterKey) ?? '';

let pagerPages = 0;
let prevPages = 0;
let nextPages = 0;
let pagerBeforeMasthead = 0;
for (const [, html] of chapterPages) {
  if (html.includes('class="side-pager"')) pagerPages += 1;
  if (html.includes('sp-prev')) prevPages += 1;
  if (html.includes('sp-next')) nextPages += 1;
  // 侧边翻页必须落在 <body> 之内（曾经因为插在 Masthead 前而跑到 <!doctype> 前面）
  const bodyAt = html.indexOf('<body');
  const pagerAt = html.indexOf('class="side-pager"');
  if (bodyAt === -1 || pagerAt === -1 || pagerAt < bodyAt) pagerBeforeMasthead += 1;
}
check('22 个正文页都有侧边翻页容器', pagerPages === 22, `实际 ${pagerPages}`);
check('侧边翻页都在 <body> 内', pagerBeforeMasthead === 0, `越界 ${pagerBeforeMasthead}`);
check('最后一章也有「下一节」（指向进度页）', lastChapter.includes('sp-next'));
check('首章无「上一节」（确实是第一篇）', !firstChapter.includes('sp-prev'));
check('除首章外的 21 章都有「上一节」', prevPages === 21, `实际 ${prevPages}`);
check('侧边翻页的标题是对可读文本（非 aria-hidden）', /class="sp-card"[\s\S]{0,2000}?<span class="sp-title">/.test(firstChapter));
check('侧边翻页带 aria-label 供读屏使用', firstChapter.includes('aria-label="章节切换"'));

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

/* ---------- 9. 正文「距屏幕边缘等距」的实现 ---------- */
check('CSS 引入 --sidebar-hold 占位变量', /--sidebar-hold/.test(css));
check('正文左右两侧镜像让位（margin-left + padding-right）', /margin-left:\s*var\(--sidebar-hold\)/.test(css));
check('窄屏自适应收窄让位（避免正文被压到不可读）', /padding-right:\s*min\(var\(--sidebar-hold\)/.test(css));

/* ---------- 10. 动效样式确实下发到浏览器 ---------- */
check('CSS 有图解入场动画', css.includes('dm-in'));
check('CSS 有描边扫读动画', css.includes('dm-sweep'));
check('CSS 有流向彗星动画', css.includes('dm-travel'));
check('CSS 有 prefers-reduced-motion 降级', /prefers-reduced-motion/.test(css));
check('CSS 有侧边翻页卡片样式', css.includes('sp-card'));

/* ---------- 输出 ---------- */
let failed = 0;
for (const r of results) {
  if (!r.pass) failed += 1;
  console.log(`${r.pass ? ' ok ' : 'FAIL'}  ${r.name}${r.pass || !r.detail ? '' : `   ← ${r.detail}`}`);
}
console.log(`\n[verify-build] ${results.length} 项断言，失败 ${failed} 项`);
process.exitCode = failed ? 1 : 0;
