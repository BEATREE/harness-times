/**
 * 内容规范化 / 校验
 *
 * 背景：章节正文是 Markdown，其中的插图（<figure><svg>…）、信息盒、三线表都是
 * 内联 HTML。CommonMark 规定「HTML 块（type 6）遇到空行即终止」，因此 SVG 内部
 * 只要有空行，<figure> 就会被从空行处截断，后半段被当作缩进代码块渲染成 <pre>。
 *
 * 本脚本做两件事：
 *   --fix    删除 raw HTML 块内部的空行（不改变缩进与换行结构，只删空行）
 *   --check  只校验，发现空行或标签不平衡则退出码 1（用于 CI / prebuild）
 *
 * 用法：
 *   node scripts/normalize-content.mjs --fix
 *   node scripts/normalize-content.mjs --check
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
 * 判断这一行是不是「可能开启 HTML 块」的首行。
 * CommonMark type 6：行首（≤3 空格缩进）以已知块级标签开头。
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
      if (m && !VOID_TAGS.has(m[1].toLowerCase())) {
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

let totalDropped = 0;
let problems = 0;

for (const f of files) {
  const p = join(CONTENT_DIR, f);
  const raw = readFileSync(p, 'utf8');
  const { text, dropped, depth, unclosed } = normalize(raw);

  const notes = [];
  if (dropped) notes.push(`删除 HTML 块内空行 ${dropped} 处`);
  if (depth !== 0) {
    problems += 1;
    notes.push(`⚠ 文件结束时仍有 ${depth} 个未闭合标签（首个：${unclosed[0]?.tag} @L${unclosed[0]?.line}）`);
  }

  if (mode === 'fix') {
    if (text !== raw) {
      writeFileSync(p, text, 'utf8');
      console.log(`  FIX  ${f}  ${notes.join(' / ')}`);
    } else {
      console.log(`  ok   ${f}`);
    }
  } else {
    if (dropped || depth !== 0) {
      console.log(`  FAIL ${f}  ${notes.join(' / ')}`);
    } else {
      console.log(`  ok   ${f}`);
    }
  }
  totalDropped += dropped;
}

console.log('\n' + '-'.repeat(60));
console.log(`共 ${files.length} 个文件 | 空行处理 ${totalDropped} 处 | 未闭合文件 ${problems} 个`);

if (mode === 'check' && (problems || totalDropped)) {
  console.log('\n内容校验未通过：请运行 `npm run content:fix` 修复。');
  process.exit(1);
}
if (mode === 'fix' && problems) {
  console.log('\n仍有未闭合标签的文件需要手工修复（通常是漏写 </p>）。');
  process.exit(1);
}
console.log(mode === 'check' ? '\n内容校验通过。' : '\n规范化完成。');
