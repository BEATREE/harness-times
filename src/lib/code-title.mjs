/**
 * 代码块的「文件名栏」实现，分两步：
 *
 *   1. shikiCodeTitle()        —— Shiki transformer
 *      读围栏的 meta（```python title="agent_loop.py"），把文件名挂到
 *      <pre data-title="..."> 上。Shiki 本身只认 language / 部分内建 meta，
 *      自定义 meta 不会写进 hast，所以需要这一步「接力」。
 *
 *      注意取 meta 的方式：Shiki 调 transformer 的 pre 钩子时是
 *      `transformer.pre.call(context, preNode)`——只传一个参数，meta 不在
 *      第二个入参上，而在 `this.options.meta` 里（Astro 会把它包成
 *      `{ __raw: 原始 meta 串 }` 传进 codeToHast）。
 *      用普通方法写法（非箭头函数）才能拿到 this，不要改成箭头函数。
 *
 *   2. rehypeCodeTitleWrapper() —— rehype plugin
 *      在最终 hast 上找到带 data-title 的 <pre>，用
 *      <div class="code-block"><div class="code-head">…</div><pre/></div> 包起来，
 *      复用站点已有的 .code-block / .code-head 样式。
 *
 * 为什么不在 Shiki 的 pre() 里直接把 header 塞进 <pre>：
 *   <pre> 的内容模型只允许 phrasing content，塞 <div> 是非法嵌套。虽然浏览器
 *   会照常渲染，但我们用 rehype 在树上做包装，产出的是干净合法的结构。
 *
 * 为什么不用 unist-util-visit：
 *   它是 Astro 的传递依赖，直接 import 属于依赖未声明。这里手写一个递归遍历，
 *   零新增依赖，也和 tools/ 那套「零依赖」的做法保持一致。
 */

const TITLE_RE = /title=(?:"([^"]*)"|'([^']*)')/;

/** Shiki transformer：把围栏 meta 里的 title 搬到 pre 上 */
export function shikiCodeTitle() {
  return {
    name: 'harness-times:code-title',
    // 注意：这里必须是普通方法（不是箭头函数），Shiki 用 .call(context, node)
    // 调用，meta 挂在 this.options.meta 上。改箭头函数会拿不到 meta。
    pre(node) {
      const meta = this?.options?.meta;
      const raw =
        typeof meta === 'string' ? meta : meta?.__raw != null ? String(meta.__raw) : '';
      const m = TITLE_RE.exec(raw);
      if (!m) return;
      const title = m[1] ?? m[2] ?? '';
      if (!title) return;
      node.properties = node.properties || {};
      node.properties['data-title'] = title;
    },
  };
}

/** 构造 <div class="code-head"><span>文件名</span><span class="lang">语言</span></div> */
function headNode(title, lang) {
  const children = [
    {
      type: 'element',
      tagName: 'span',
      properties: {},
      children: [{ type: 'text', value: title }],
    },
  ];
  if (lang) {
    children.push({
      type: 'element',
      tagName: 'span',
      properties: { className: ['lang'] },
      children: [{ type: 'text', value: lang }],
    });
  }
  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['code-head'] },
    children,
  };
}

/** rehype plugin：把带 data-title 的 pre 包进 .code-block */
export function rehypeCodeTitleWrapper() {
  return (tree) => {
    const walk = (node) => {
      if (!node || !Array.isArray(node.children)) return;
      node.children = node.children.map((child) => {
        if (
          child.type === 'element' &&
          child.tagName === 'pre' &&
          child.properties &&
          child.properties['data-title']
        ) {
          const title = String(child.properties['data-title']);
          // hast 里属性名是 camelCase 的 dataLanguage，序列化后才变 data-language
          const prop = child.properties;
          const lang = prop.dataLanguage ?? prop['data-language'] ?? '';
          delete prop['data-title'];
          return {
            type: 'element',
            tagName: 'div',
            properties: { className: ['code-block'] },
            children: [headNode(title, lang ? String(lang) : ''), child],
          };
        }
        walk(child);
        return child;
      });
    };
    walk(tree);
  };
}
