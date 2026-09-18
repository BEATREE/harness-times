/**
 * 中文标点会让 Markdown 的加粗静默失效 —— 检测与修复。
 *
 * ## 现象
 *
 * 正文里写：
 *
 *     关键在于：**这个矩阵不是人写的，是训练出来的。**训练时反向传播调整的就是这些数。
 *
 * 页面上 `**` 原样留在那里，一个字都没加粗。
 *
 * ## 原因（CommonMark 的强调定界符规则）
 *
 * 一个 `**` 想闭合前面的加粗，必须是 **right-flanking**：
 * 要求它左边不是空白，并且「左边不是标点 **或** 右边是空白/标点」。
 * 上例里的闭合标记左边是「。」（Unicode 标点 Po），右边是「训」
 * —— 汉字在 CommonMark 里既不是空白也不是标点，算 other。
 * 于是两个条件都不满足 → 它不能闭合 → 这对 `**` 谁也配不上谁，原样输出。
 *
 * 更隐蔽的是第二个后果：**中文标点会让「谁跟谁配」整体错位**。例如
 *
 *     其实只是**「数 + 排列方式」**。用一个叫**阶数**（rank）的东西描述它：
 *
 * 解析出来是
 *
 *     其实只是**「数 + 排列方式」<strong>。用一个叫</strong>阶数**（rank）…
 *
 * 不但漏了两个 `**`，还把「。用一个叫」这五个字**错误地加粗**了 ——
 * 页面看起来没有报错、没有空白，只是有一处加粗位置莫名其妙。
 *
 * ## 为什么这里不自己实现 flanking 规则
 *
 * 错位是**多个定界符互相作用**的结果（规则里还有 rule-of-three），
 * 照抄规则极容易和真正的解析器差一点点 —— 而差一点点就是又一次静默错误。
 * 所以换一种做法：
 *
 *   1. 用**项目自己用的那个解析器**解析源码，直接问它「哪些文本节点里还留着 `**`」。
 *      这就是「解析失败」的权威定义，不靠人去复述规则。
 *   2. 只有落在这些失败区内的 `**` 对，才改写成 `<strong>…</strong>`。
 *   3. 改完重新解析，直到不再有残留（实践上一轮就干净）。
 *
 * 好处是修复面精确到「真正坏掉的那几个段落」，其余正文一个字符都不动，
 * 补丁小到可以被逐行复核。
 *
 * ## 两种失效模式（都会被这里收拾）
 *
 * **模式一：中文标点让 `**` 谁也不配谁。** 见上面的现象与原因。
 *
 * **模式二：写在 HTML 块里的 `**` 根本不会被解析。**
 * CommonMark 规定 HTML 块（type 6/7）的内容**原样输出**，里面的 Markdown 不再解析。
 * 本项目大量用内联 HTML 写信息盒与三线表，于是
 *
 *     <tr><td>保持历史消息**字节级不变**，原始字符串原样回传</td></tr>
 *
 * 这种写法里的 `**` 会原样印在表格里。它和模式一的表现一样，原因却完全是两回事 ——
 * 所以「只在 markdown 文本节点里找残留」是不够的，`html` 节点也要一起找。
 *
 * ## 为什么改成 `<strong>` 而不是加个空格
 *
 * 中文排版里 `**粗体** 后面` 这种空格很丑，而且它依赖作者记得加。
 * `<strong>` 是行内 HTML，解析器不会再对它做定界符配对，两种模式一起消失。
 * 代价是源码里多了一种「加粗写法」，所以 `content:check` 守住入口：
 * 只要还有解析不了的 `**` 就让构建失败（见 scripts/normalize-content.mjs）。
 */
import { fromMarkdown } from 'mdast-util-from-markdown';

/** 一对 `**`：内容必须以非空白开头、以非空白结尾（正常写法都满足） */
const PAIR = /\*\*(\S[\s\S]*?\S|\S)\*\*/g;

function merge(spans) {
  if (!spans.length) return [];
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  const out = [sorted[0].slice()];
  for (const [s, e] of sorted.slice(1)) {
    const last = out[out.length - 1];
    if (s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

const intersects = (start, end, spans) =>
  spans.some(([s, e]) => start < e && end > s);

/**
 * 会把 `**` 原样印到页面上的区域，在源码里的偏移区间。空数组 = 这个文件的加粗全都正常。
 *
 * 两类节点都要看：
 *   · `text` —— 模式一：`**` 因为定界符规则没能配对，于是作为普通文本留了下来；
 *   · `html` —— 模式二：整块是原样输出的 HTML，里面的 `**` 压根没进过 Markdown 解析。
 *     （以前只查 `text`，于是 `<td>` 里的 `**` 一路漏到线上，`content:check` 还是绿的。）
 */
export function brokenRanges(md) {
  const tree = fromMarkdown(md, { position: true });
  const spans = [];
  const walk = (node) => {
    const leaking =
      (node.type === 'text' || node.type === 'html') &&
      typeof node.value === 'string' &&
      node.value.includes('**');
    if (leaking) {
      const s = node.position?.start?.offset;
      const e = node.position?.end?.offset;
      if (typeof s === 'number' && typeof e === 'number') spans.push([s, e]);
    }
    if (node.children) node.children.forEach(walk);
  };
  walk(tree);
  return merge(spans);
}

/** 偏移量是否落在某个区间里 */
const inSpans = (i, spans) => spans.some(([s, e]) => i >= s && i < e);

/** 找一段长度恰好为 n 的反引号 run（CommonMark：更长的 run 不能闭合） */
function findBacktickRun(src, from, n, fences) {
  for (let i = from; i < src.length; i += 1) {
    if (src[i] !== '`' || inSpans(i, fences)) continue;
    let len = 0;
    while (src[i + len] === '`') len += 1;
    if (len === n) {
      // 行内代码不能跨空行（跨了就不是同一个段落）
      if (/\n[ \t]*\n/.test(src.slice(from, i))) return -1;
      return i;
    }
    i += len - 1;
  }
  return -1;
}

/**
 * 源码里属于「代码」的偏移区间：围栏代码块与行内代码。
 * 这些地方出现 `**` 是合法的（指数运算、正则、文档里举例），一个都不许动。
 */
export function codeRanges(src) {
  const fences = [];
  const lines = src.split('\n');
  let offset = 0;
  let open = null;
  let openAt = 0;
  for (const line of lines) {
    const m = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (open) {
      if (m && m[1][0] === open[0] && m[1].length >= open.length) {
        fences.push([openAt, offset + line.length]);
        open = null;
      }
    } else if (m) {
      open = m[1];
      openAt = offset;
    }
    offset += line.length + 1;
  }
  if (open) fences.push([openAt, src.length]);

  const spans = [...fences];
  let i = 0;
  while (i < src.length) {
    if (src[i] !== '`' || inSpans(i, fences)) {
      i += 1;
      continue;
    }
    let n = 0;
    while (src[i + n] === '`') n += 1;
    const close = findBacktickRun(src, i + n, n, fences);
    if (close < 0) {
      i += n;
      continue;
    }
    spans.push([i, close + n]);
    i = close + n;
  }
  return merge(spans);
}

/**
 * 把「解析失败」的 `**…**` 改写成 `<strong>…</strong>`。
 *
 * @param {string} src 源码
 * @returns {{ text: string, leaks: number[][], rounds: number }}
 *   `leaks` 非空表示改完仍有残留（应当视为 bug，由调用方报错）
 */
export function fixEmphasis(src, maxRounds = 6) {
  let text = src;
  let rounds = 0;
  for (; rounds < maxRounds; rounds += 1) {
    const leaks = brokenRanges(text);
    if (!leaks.length) break;
    const code = codeRanges(text);
    let changed = 0;
    PAIR.lastIndex = 0;
    text = text.replace(PAIR, (match, inner, offset) => {
      const end = offset + match.length;
      // 只修真正坏掉的那几处；跨段落的原样放过
      if (!intersects(offset, end, leaks)) return match;
      if (/\n[ \t]*\n/.test(match)) return match;
      /*
       * 代码判断只看**两个定界符自己**在不在代码里，不看内容。
       *
       * 一开始写成「整段匹配跟代码区有交集就跳过」，结果是
       *   **整批数据的形状是 `[n, d]`。**看到 `[n, d]` 你就…
       * 这种「加粗里嵌了行内代码」的句子永远修不好 —— 而它恰恰是最常见的写法。
       */
      const openHit = intersects(offset, offset + 2, code);
      const closeHit = intersects(end - 2, end, code);
      if (openHit || closeHit) return match;
      changed += 1;
      return `<strong>${inner}</strong>`;
    });
    if (!changed) break;
  }
  return { text, leaks: brokenRanges(text), rounds };
}
