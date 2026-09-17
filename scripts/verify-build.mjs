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
 *   中间任何一环失效都不会让构建报错——只是产出悄悄退化。
 *   这类「静默退化」只能靠断言拦住。
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
check('关于页有 28 个关联网站', count(about, 'class="rel-item"') === 28, `实际 ${count(about, 'class="rel-item"')}`);
check('关于页标题为「关于本站」', about.includes('关于本站'));
check('关于页声明不是每日报刊', about.includes('不是一份每天更新的报刊'));

/* ---------- 5. 字体：不再回落到 SimSun 宋体 ---------- */
const cssFiles = walk(dist).filter((f) => f.endsWith('.css'));
const css = cssFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
check('CSS 里已无 SimSun 回退', !/SimSun/i.test(css));
check('CSS 正文栈含 PingFang SC', /PingFang SC/.test(css));
check('CSS 正文栈含 Microsoft YaHei', /Microsoft YaHei/.test(css));
check('CSS 去掉了纸面深色底（旧灰屏成因）', !css.includes('#2c2824'));
check('CSS 含侧栏收起状态', css.includes('nav-collapsed'));

/* ---------- 输出 ---------- */
let failed = 0;
for (const r of results) {
  if (!r.pass) failed += 1;
  console.log(`${r.pass ? ' ok ' : 'FAIL'}  ${r.name}${r.pass || !r.detail ? '' : `   ← ${r.detail}`}`);
}
console.log(`\n[verify-build] ${results.length} 项断言，失败 ${failed} 项`);
process.exitCode = failed ? 1 : 0;
