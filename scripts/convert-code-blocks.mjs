/**
 * 把手写的 <div class="code-block">…<pre><code>…</code></pre>…</div>
 * 转换成 Markdown 围栏代码块，并带上 `title="文件名"` 元信息。
 *
 * 为什么要转：
 *  1. Shiki 只处理「围栏代码块」。之前 24 个代码块全是手写 HTML，所以构建配置里
 *     虽配了语法高亮，实际一行都没生效——代码是纯黑等宽文本。
 *  2. 更严重的是，代码里的裸 `<` `>` 会被 Markdown 的 HTML 块当成标签解析。
 *     harness-07 里的 f"<untrusted_content origin=\"{...}\">" 就被吃成了
 *     origin="\&#x22;{self.origin}\&#x22;"，页面上的代码是错的。
 *     围栏代码块由 Markdown 负责转义，从根上避免这个问题。
 *  3. 转换时顺带把源码里为规避 HTML 解析而写的实体（&lt; &gt; &amp;）解码回真字符，
 *     否则围栏里会原样显示 &lt;。
 *
 * 用法：
 *   node scripts/convert-code-blocks.mjs --check   # 只报告
 *   node scripts/convert-code-blocks.mjs --fix     # 执行转换
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src', 'content', 'chapters');

const ENTITY_RE = /&(?:lt|gt|amp|quot|apos|#39|#x3C|#x3E|#x26|nbsp);/g;
const ENTITIES = {
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&#x3C;': '<',
  '&#x3E;': '>',
  '&#x26;': '&',
  '&nbsp;': '\u00a0',
};
/** 单趟替换：避免把 &amp;lt; 二次解码成 < */
const decode = (s) => s.replace(ENTITY_RE, (m) => ENTITIES[m] ?? m);

/** 从 start（指向 `<div`）起找到配对 `</div>` 的结束位置，考虑嵌套 */
function endOfDiv(s, start) {
  let depth = 0;
  const tag = /<(\/?)(div|pre|code|span)\b[^>]*>/gi;
  tag.lastIndex = start;
  let m;
  while ((m = tag.exec(s))) {
    if (m[1] === '/') {
      depth -= 1;
      if (depth === 0) return tag.lastIndex;
    } else {
      depth += 1;
    }
  }
  return -1;
}

/** 保证前后有空行：Markdown 要求围栏块与相邻段落之间留空行 */
function withBlankLines(text, at, fence) {
  const before = text.slice(0, at);
  const after = text.slice(at);
  const lead = before === '' || /\n\s*\n$/.test(before) ? '' : '\n\n';
  const tail = /^\s*\n/.test(after) ? '' : '\n\n';
  return lead + fence + tail;
}

const mode = process.argv.includes('--fix') ? 'fix' : 'check';
const files = readdirSync(SRC).filter((f) => f.endsWith('.md')).sort();

let converted = 0;
let preExisting = [];
let failures = [];

for (const file of files) {
  const path = join(SRC, file);
  let text = readFileSync(path, 'utf8');
  const original = text;

  // 先记下本来就写好的围栏块，避免重复处理
  const fenceCountBefore = (text.match(/^```/gm) || []).length;

  let searchFrom = 0;
  let changedHere = 0;

  for (;;) {
    const start = text.indexOf('<div class="code-block">', searchFrom);
    if (start === -1) break;
    const end = endOfDiv(text, start);
    if (end === -1) {
      failures.push(`${file}: <div class="code-block"> 未找到配对 </div>（位置 ${start}）`);
      break;
    }
    const block = text.slice(start, end);

    const headMatch = block.match(/<div class="code-head">([\s\S]*?)<\/div>/);
    const codeMatch = block.match(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/);
    if (!codeMatch) {
      failures.push(`${file}: code-block 内没找到 <pre><code>（位置 ${start}）`);
      searchFrom = end;
      continue;
    }

    // 文件名：code-head 里第一个 span 的文本；语言：.lang 的文本
    let filename = '';
    let lang = 'text';
    if (headMatch) {
      const spans = [...headMatch[1].matchAll(/<span([^>]*)>([\s\S]*?)<\/span>/g)];
      for (const sp of spans) {
        if (/class="lang"/.test(sp[1])) lang = sp[2].trim();
        else if (!filename) filename = sp[2].trim();
      }
    }

    let code = decode(codeMatch[1]);
    code = code.replace(/^\n/, '').replace(/\s+$/, '');

    // eval-04 的代码里含 ``` （匹配模型输出里的围栏），
    // 用比内容里最长反引号串更长的围栏包住它即可。
    const longestRun = (code.match(/`+/g) || []).reduce((a, b) => Math.max(a, b.length), 0);
    const ticks = '`'.repeat(Math.max(3, longestRun + 1));

    const info = filename ? `${lang} title="${filename}"` : lang;
    const fence = ticks + info + '\n' + code + '\n' + ticks;

    text = text.slice(0, start) + withBlankLines(text, start, fence) + text.slice(end);
    searchFrom = start + fence.length + 4;
    changedHere += 1;
    converted += 1;
  }

  if (changedHere || text !== original) {
    if (mode === 'fix') {
      writeFileSync(path, text, 'utf8');
      console.log(`  FIX  ${file}  转换 ${changedHere} 个代码块`);
    } else {
      console.log(`  TODO ${file}  待转换 ${changedHere} 个代码块`);
    }
  } else {
    console.log(`  ok   ${file}`);
  }

  if (fenceCountBefore) {
    preExisting.push(`${file}（原有围栏 ${fenceCountBefore} 个）`);
  }
}

console.log('\n' + '-'.repeat(62));
console.log(`文件 ${files.length} 个 | 转换代码块 ${converted} 个`);
if (preExisting.length) {
  console.log(`\n本来就有围栏代码的文件：\n  ${preExisting.join('\n  ')}`);
}
if (failures.length) {
  console.log(`\n需要手工处理：`);
  failures.forEach((f) => console.log('  · ' + f));
  process.exit(1);
}
if (mode === 'check' && converted) {
  console.log('\n还有手写代码块未转换，运行 `--fix` 执行。');
  process.exit(1);
}
console.log(mode === 'fix' ? '\n转换完成。' : '\n全部已转换。');
