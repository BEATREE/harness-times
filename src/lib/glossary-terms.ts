/**
 * 正文术语标记 → 可点链接（构建期展开）。
 *
 * 为什么要有它：
 *   正文里出现的专业名词，读者必须能就地查到解释。如果把解释直接写在正文里，
 *   同一个名词在 5 章出现就要维护 5 份，必然漂。所以术语只在 src/data/glossary.ts
 *   里写一次，正文只写一个标记：[[id]] 或 [[id|显示文字]]，
 *   由本插件在构建期展开成 <a class="term" href="/glossary/#t-<id>">。
 *
 * 为什么展开成 <a> 而不是 <button>：
 *   <button> 只在有 JS 时才有意义，脚本一挂就是一个点了没反应的死按钮。
 *   展开成锚点之后：
 *     · 没有 JS（或被 CSP 拦）→ 点击直接跳到名词库对应卡片，功能完整；
 *     · 有 JS → 由 TermCard 组件的脚本拦下 click，改成弹出卡片。
 *   也就是说名词解释永远可达，弹窗只是增强。这是刻意的渐进增强。
 *
 * 本章第一次出现时自动补英文原名：
 *   中文技术词几乎全是直译，读到「前馈」「隐藏维度」这种名字很容易理解偏，
 *   而读者迟早要回去读英文论文。所以每个词在**本章第一次**出现时渲染成
 *   「中文（English）」：例如「自注意力（Self-Attention）」。
 *   由插件自动补，而不是让作者在正文里手写一遍 —— 手写必然漏，而且会漂；
 *   自动补的另一层好处是「首次」这件事有确定含义（每个页面恰好一次）。
 *   兜底：`en` 为空、或英文名已经出现在词条名里（Token、Softmax、KV Cache）
 *   就不补，免得出现「Token（Token）」。
 *
 * 为什么在 remark 阶段做，而不是字符串替换：
 *   正文是 markdown，`[[id]]` 出现在段落里。在 mdast 里它落在一个 text 节点里，
 *   改成 link 节点是结构化的、不会误伤代码块与 raw HTML；
 *   而字符串级替换分不清「正文里的术语标记」和「代码示例里的 [[x]]」。
 *
 * 失败策略：id 查不到 → 直接抛错，让构建失败。
 *   与 diagram-motion 的 fail-loud 守卫同一个理由：静默产出的东西没人会发现。
 */

import { TERMS, termById } from '../data/glossary';

/** 术语标记：[[id]] 或 [[id|显示文字]] */
const TERM_RE = /\[\[([a-z0-9][a-z0-9-]*)(?:\|([^\]]+))?\]\]/g;

interface MdNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
  data?: Record<string, unknown>;
}

const linkFor = (id: string, label: string) => {
  const t = termById(id)!;
  return {
    type: 'link',
    url: `/glossary/#t-${id}`,
    data: {
      hProperties: {
        class: 'term',
        'data-term': id,
        // title 用一句话含义：鼠标悬停就有收获，不点也不亏
        title: t.meaning,
      },
    },
    children: [{ type: 'text', value: label }],
  };
};

/**
 * 英文名值不值得补：没写英文、或英文已经出现在中文名里（Token / Softmax /
 * KV Cache / Prefill / Decode）就不补 —— 否则会出现「Token（Token）」。
 */
const englishGloss = (id: string, label: string): string => {
  const en = termById(id)?.en;
  if (!en) return '';
  return label.toLowerCase().includes(en.toLowerCase()) ? '' : `（${en}）`;
};

/** 一个只承载 class 的行内元素（mdast 用 data.hName 指定输出标签） */
const spanFor = (cls: string, value: string): MdNode => ({
  type: 'text',
  value,
  data: { hName: 'span', hProperties: { class: cls } },
});

/** 把一个 text 节点按术语标记拆成 [文本, 链接, 英文注解, 文本, …] */
function splitText(node: MdNode, where: string, seen: Set<string>): MdNode[] {
  const value = node.value ?? '';
  if (!value.includes('[[')) return [node];

  const out: MdNode[] = [];
  let last = 0;
  TERM_RE.lastIndex = 0;
  for (const m of value.matchAll(TERM_RE)) {
    const id = m[1];
    const label = (m[2] ?? '').trim();
    const t = termById(id);
    if (!t) {
      const known = TERMS.map((x) => x.id).join(', ');
      throw new Error(
        `[glossary] ${where} 引用了不存在的名词 id「${id}」。\n` +
          `  写法：[[id]] 或 [[id|显示文字]]\n` +
          `  已有的 id：${known}`
      );
    }
    const text = label || t.term;
    if (m.index! > last) out.push({ type: 'text', value: value.slice(last, m.index!) });
    out.push(linkFor(id, text));
    // 本章第一次出现才补英文；补在链接**外面**：可点的仍然只有中文，
    // 英文只是注解，不该跟着一起变红（读者点不点都行）
    if (!seen.has(id)) {
      seen.add(id);
      const gloss = englishGloss(id, text);
      if (gloss) out.push(spanFor('term-en', gloss));
    }
    last = m.index! + m[0].length;
  }
  if (last === 0) return [node];
  if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
  return out;
}

function walk(parent: MdNode, where: string, insideLink: boolean, seen: Set<string>): void {
  if (!Array.isArray(parent.children)) return;
  const next: MdNode[] = [];
  for (const child of parent.children) {
    if (child.type === 'text') {
      // 不往链接里再塞链接（HTML 不允许嵌套 <a>）
      next.push(...(insideLink ? [child] : splitText(child, where, seen)));
    } else {
      walk(child, where, insideLink || child.type === 'link', seen);
      next.push(child);
    }
  }
  parent.children = next;
}

/** remark 插件主体 */
export function remarkGlossaryTerms() {
  return (tree: MdNode, file: { path?: string } | undefined) => {
    // seen 是「本文件」的：每个页面各补一次英文，同一页里不重复补
    walk(tree, file?.path ? String(file.path) : '(未知文件)', false, new Set<string>());
  };
}

/**
 * 从原始 markdown 里收集本章用到的名词 id。
 * 供章节页只输出「本章真正用到的」术语数据，避免每页都塞进整个名词库。
 *
 * 注意这里不做 mdast 解析（页面组件不该为了收集 id 再跑一遍编译器），
 * 所以代码块里的字面 [[x]] 也会被收进来 —— 无害，多带一条数据而已；
 * 查不到的 id 会被过滤掉。
 */
export function collectTermIds(md: string): string[] {
  const ids = new Set<string>();
  for (const m of md.matchAll(TERM_RE)) {
    if (termById(m[1])) ids.add(m[1]);
  }
  return [...ids];
}
