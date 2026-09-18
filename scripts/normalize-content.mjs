/**
 * 内容规范化 / 校验
 *
 * 本脚本守两条规则，都是「不报错、只是静静渲染错」的那类问题：
 *
 * 1. **HTML 块内部不能有空行。**
 *    章节正文里的插图（<figure><svg>…）、信息盒、三线表都是内联 HTML。
 *    CommonMark 规定「HTML 块（type 6）遇到空行即终止」，因此 SVG 内部只要有
 *    空行，<figure> 就会被从空行处截断，后半段被当作缩进代码块渲染成 <pre>。
 *
 * 2. **中文标点会让 `**` 加粗失效**（详见 scripts/lib/emphasis.mjs 的长注释：
 *    闭合标记紧邻中文标点时不再是 right-flanking，于是这一对谁也不配谁，
 *    `**` 原样印在页面上；更糟的情况是配对错位，把一段无关的字错误加粗）。
 *    这里把坏掉的那几对改写成 `<strong>…</strong>`，一劳永逸。
 *
 * 用法：
 *   node scripts/normalize-content.mjs --fix
 *   node scripts/normalize-content.mjs --check
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixEmphasis } from './lib/emphasis.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(HERE, '..', 'src', 'content', 'chapters');

/** 自闭合 / 空元素：出现即不改变嵌套深度 */
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
  // SVG 常见的自绘元素（本项目里一律写成自闭合，这里再兜一层）
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'use',
  'stop', 'image',
]);

/**
 * 匹配一个标签。属性部分允许引号包裹、引号内可出现 > 或 <，
 * 避免把 d="M0,0 L9,9" 之类的属性值切断。
 */
const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;

/** 去掉注释与 CDATA，避免其中的尖括号干扰配对 */
const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');

/** 返回该行带来的嵌套深度变化量 */
function deltaOf(line) {
  const clean = stripComments(line);
  let delta = 0;
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(clean))) {
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const selfClosing = m[4] === '/';
    if (closing) delta -= 1;
    else if (!selfClosing && !VOID_TAGS.has(tag)) delta += 1;
  }
  return delta;
}

/**
 * CommonMark 的 HTML 块（type 6）只认这些块级标签。
 *
 * 为什么要列出来而不是「见到 `<xxx` 就算」：行内标签（`<strong>` `<b>` `<code>`
 * `<a>`）写在行首时**不是** HTML 块，后面的空行该留还是要留。
 * 以前没区分，于是刚把 `**粗体**` 改写成 `<strong>…</strong>` 之后，
 * 只要它正好落在行首且当行没闭合，整段就会被误判成 HTML 块，
 * 后面的空行被「顺手」删掉 —— 又是一次静默改内容。
 */
const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'base', 'basefont', 'blockquote', 'body',
  'caption', 'center', 'col', 'colgroup', 'dd', 'details', 'dialog', 'dir',
  'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
  'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header',
  'hr', 'html', 'iframe', 'legend', 'li', 'link', 'main', 'menu', 'menuitem',
  'nav', 'noframes', 'ol', 'optgroup', 'option', 'p', 'param', 'search',
  'section', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
  'title', 'tr', 'track', 'ul',
]);

/**
 * 判断这一行是不是「可能开启 HTML 块」的首行。
 * CommonMark type 6：行首（≤3 空格缩进）以已知**块级**标签开头。
 */
const BLOCK_START_RE = /^ {0,3}<([a-zA-Z][a-zA-Z0-9:-]*)(?:\s|\/|>|$)/;

function normalize(text) {
  const lines = text.split('\n');
  const out = [];
  let depth = 0;
  let dropped = 0;
  const unclosed = [];

  // frontmatter 原样跳过
  let i = 0;
  if (lines[0]?.trim() === '---') {
    out.push(lines[0]);
    i = 1;
    while (i < lines.length && lines[i].trim() !== '---') out.push(lines[i++]);
    if (i < lines.length) out.push(lines[i++]);
  }

  for (; i < lines.length; i++) {
    const line = lines[i];
    const isBlank = line.trim() === '';

    if (depth > 0 && isBlank) {
      dropped += 1;
      continue; // 删掉 HTML 块内部的空行
    }

    out.push(line);

    // 只有在「非 HTML 块内」遇到块级起始行，才进入 HTML 块
    if (depth <= 0) {
      const m = BLOCK_START_RE.exec(line);
      if (m && BLOCK_TAGS.has(m[1].toLowerCase())) {
        const d = deltaOf(line);
        if (d > 0) {
          depth = d;
          unclosed.push({ line: i + 1, tag: m[1], text: line.trim().slice(0, 60) });
        }
      }
    } else {
      depth += deltaOf(line);
      if (depth <= 0) {
        depth = 0;
        unclosed.length = 0; // 正常闭合，撤销记录
      }
    }
  }

  return { text: out.join('\n'), dropped, depth, unclosed };
}

const mode = process.argv.includes('--check') ? 'check' : 'fix';
const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md')).sort();

const countAll = (s, sub) => s.split(sub).length - 1;

let totalDropped = 0;
let totalRepaired = 0;
let problems = 0;

for (const f of files) {
  const p = join(CONTENT_DIR, f);
  const raw = readFileSync(p, 'utf8');

  // 先修加粗，再做空行规范化：改写后的 <strong> 会改变标签配对，顺序不能反
  const em = fixEmphasis(raw);
  const repaired = (countAll(raw, '**') - countAll(em.text, '**')) / 2;
  const { text, dropped, depth, unclosed } = normalize(em.text);

  const notes = [];
  if (repaired) notes.push(`修复中文加粗 ${repaired} 处`);
  if (dropped) notes.push(`删除 HTML 块内空行 ${dropped} 处`);
  if (em.leaks.length) {
    problems += 1;
    notes.push(`⚠ 仍有 ${em.leaks.length} 处加粗解析不了（自动改写没收住，需要手工换成 <strong>）`);
  }
  if (depth !== 0) {
    problems += 1;
    notes.push(`⚠ 文件结束时仍有 ${depth} 个未闭合标签（首个：${unclosed[0]?.tag} @L${unclosed[0]?.line}）`);
  }

  const dirty = text !== raw;
  if (mode === 'fix') {
    if (dirty) {
      writeFileSync(p, text, 'utf8');
      console.log(`  FIX  ${f}  ${notes.join(' / ')}`);
    } else {
      console.log(`  ok   ${f}`);
    }
  } else if (notes.length) {
    console.log(`  FAIL ${f}  ${notes.join(' / ')}`);
  } else {
    console.log(`  ok   ${f}`);
  }
  totalDropped += dropped;
  totalRepaired += repaired;
}

console.log('\n' + '-'.repeat(60));
console.log(
  `共 ${files.length} 个文件 | 空行处理 ${totalDropped} 处 | 中文加粗修复 ${totalRepaired} 处 | 有问题的文件 ${problems} 个`
);

if (mode === 'check' && (problems || totalRepaired)) {
  console.log('\n内容校验未通过：请运行 `npm run content:fix` 修复。');
  process.exit(1);
}
if (mode === 'fix' && problems) {
  console.log('\n仍有未闭合标签的文件需要手工修复（通常是漏写 </p>）。');
  process.exit(1);
}
console.log(mode === 'check' ? '\n内容校验通过。' : '\n规范化完成。');
