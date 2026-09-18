/**
 * 图解增强插件（rehype，构建期）：给 markdown 里手写的 <svg> 图解打上标注，
 * 让纯静态的图能动起来，并在小屏上保持可读。
 *
 * 三件事：
 *   1. 记录 viewBox 宽度 → `--vbw`，供 CSS 在窄屏上计算 svg 的最小宽度
 *      （否则 660 宽的图被压到 320 屏幕上，9.4px 的注释字会缩成 4.5px）；
 *   2. 给图元按文档顺序编号 `--i`，CSS 用递增的 animation-delay 做出
 *      「逐个落版」的入场效果；
 *   3. 给带箭头的连线补一条「流光」覆盖线，用 stroke-dashoffset 让一小段高亮
 *      沿连线方向反复流动，直接表达数据流向 / 控制流。
 *
 * 为什么在字符串层面做，而不是遍历 hast 节点：
 * Astro 的 markdown 管线里用户 rehype 插件跑在 rehype-raw 之前
 * （见 node_modules/@astrojs/markdown-remark/dist/index.js：用户插件在第 92 行，
 * rehypeRaw 在第 99 行）。所以此刻 raw HTML 还只是一个 raw 节点，并没有展开成
 * hast 元素，遍历是遍历不到的。
 *
 * 这里的输入是本项目自己手写、格式严格固定的图解 HTML（一个图元一行、
 * 属性值里不含裸 `>`），因此行级匹配是安全的。任何一行只要不符合预期写法，
 * 就原样放过 —— 宁可少加动效，也不猜着改内容。
 */

const SVG_OPEN = /<svg\b/;
const VIEWBOX = /viewBox="0 0 ([\d.]+)[\s"]/;

/** 找到一行中 opening tag 的 `>` 下标；跳过属性值引号内的字符 */
function tagEnd(line) {
  let inQuote = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    else if (ch === '>' && !inQuote) return i;
  }
  return -1;
}

/**
 * 把属性插到 opening tag 结束之前；失败返回 null（调用方原样保留该行）。
 *
 * 这里必须保住结尾的 `/`。
 *
 * 曾经写成 `line.slice(0, i).replace(/\s*\/$/, '')`，把 `/` 直接吃掉了，
 * 于是 `<rect .../>` 变成 `<rect ...>`。在 HTML 解析里这不是自闭合标签，
 * 而是一个「没关的 rect」，后面所有图元都成了它的子节点；rect 又不是容器元素，
 * 子节点一概不渲染 —— 整张图解从这一行开始静默消失，而构建一切正常。
 * 「构建成功」完全掩盖了这个错误，只有截图能看出来。
 */
function addAttrs(line, attrs) {
  const i = tagEnd(line);
  if (i < 0) return null;
  const before = line.slice(0, i);
  const after = line.slice(i + 1);
  const selfClose = before.endsWith('/');
  const head = selfClose ? before.slice(0, -1).replace(/\s+$/, '') : before;
  return `${head} ${attrs}${selfClose ? '/>' : '>'}${after}`;
}

/** 该行是否已经有 class 属性（有就只补 style，避免出现两个 class） */
function classAttr(line, cls) {
  return /class="/.test(line) ? '' : `class="${cls}" `;
}

/** 从 <line .../> 上读端点，算长度（流光动画的周期要用它） */
function readLineGeo(line) {
  const num = (name) => {
    const m = new RegExp(`\\b${name}="(-?[\\d.]+)"`).exec(line);
    return m ? Number(m[1]) : null;
  };
  const x1 = num('x1');
  const y1 = num('y1');
  const x2 = num('x2');
  const y2 = num('y2');
  if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
  const len = Math.round(Math.hypot(x2 - x1, y2 - y1) * 10) / 10;
  return { x1, y1, x2, y2, len };
}

function transform(html, stats) {
  const lines = html.split('\n');
  const out = [];
  let inSvg = false;
  let defsDepth = 0;
  let seq = 0;
  let spark = 0;

  for (const rawLine of lines) {
    let line = rawLine;

    if (!inSvg) {
      if (SVG_OPEN.test(line)) {
        const vb = VIEWBOX.exec(line);
        const width = vb ? Number(vb[1]) : 660;
        const patched = addAttrs(line, `${classAttr(line, 'dm-svg')}style="--vbw:${width}"`);
        if (patched) {
          line = patched;
          stats.svgs += 1;
        }
        inSvg = true;
      }
      out.push(line);
      continue;
    }

    if (/<\/svg>/.test(line)) {
      inSvg = false;
      out.push(line);
      continue;
    }

    // <defs> 里的 marker / path 是箭头图形本身，不能碰
    if (/<defs\b/.test(line)) defsDepth += 1;
    if (/<\/defs>/.test(line)) {
      defsDepth = Math.max(0, defsDepth - 1);
      out.push(line);
      continue;
    }
    if (defsDepth > 0) {
      out.push(line);
      continue;
    }

    const m = /^(\s*)<([a-z]+)\b/.exec(line);
    const tag = m ? m[2] : '';
    const indent = m ? m[1] : '';

    // 箭头连线：保留原线，紧跟一条流光覆盖线
    if (tag === 'line' && /marker-end=/.test(line)) {
      out.push(line);
      const geo = readLineGeo(line);
      if (geo) {
        out.push(
          `${indent}<line class="dm-go" x1="${geo.x1}" y1="${geo.y1}" x2="${geo.x2}" y2="${geo.y2}" ` +
            `style="--len:${geo.len};--d:${(spark * 0.3).toFixed(2)}"/>`
        );
        spark += 1;
        stats.sparks += 1;
      }
      continue;
    }

    // 节点（方框 / 圆）与文字：按文档顺序编号，做出逐个落版的效果。
    //
    // 节点再分两种：
    //   dm-n  —— 有描边的方块，参与「描边依次加粗」的扫描波，用来看出图里的推进顺序
    //   dm-plate —— 只有底色没有描边的底衬，只参与入场，不参与扫描
    // （扫描波要把描边加粗再还原，所以得把每个节点原本的 stroke-width 带出来，
    //   否则动画会把粗细统一成同一个值，把原设计的层次抹平。）
    const isNode = tag === 'rect' || tag === 'circle';
    const isText = tag === 'text';
    if (isNode || isText) {
      const stroked = isNode && /\bstroke="/.test(line);
      const cls = isText ? 'dm-t' : stroked ? 'dm-n' : 'dm-plate';
      let style = `--i:${seq}`;
      if (stroked) {
        const sw = /(?:^|\s)stroke-width="([\d.]+)"/.exec(line);
        style += `;--sw:${sw ? sw[1] : 1}`;
      }
      const patched = addAttrs(line, `${classAttr(line, cls)}style="${style}"`);
      if (patched) {
        line = patched;
        seq += 1;
        if (isNode) stats.nodes += 1;
        else stats.texts += 1;
      }
    }

    out.push(line);
  }

  /*
   * 收尾自检：SVG 的空元素必须自闭合。
   *
   * 漏掉结尾的 `/` 在 HTML 解析里就是「标签没关」，之后所有元素都会变成它的
   * 子节点；而 rect / line / circle 都不是容器，子节点一律不渲染 ——
   * 结果是整张图解从那一行起静默消失，构建却照常成功。
   * 这种错不该等到看截图才发现，所以在这里直接让构建失败。
   */
  const broken = out.filter(
    (l) => /^\s*<(rect|line|circle|path|ellipse|polygon|polyline)\b/.test(l) && !/\/>\s*$/.test(l)
  );
  if (broken.length) {
    throw new Error(
      `[diagram-motion] 有 ${broken.length} 个图元没有自闭合，会让它后面的图元全部不渲染：\n` +
        broken.slice(0, 3).join('\n')
    );
  }

  return out.join('\n');
}

const TOTALS = { svgs: 0, nodes: 0, texts: 0, sparks: 0 };
let logged = false;

const walk = (node) => {
  if (node && node.type === 'raw' && typeof node.value === 'string' && SVG_OPEN.test(node.value)) {
    node.value = transform(node.value, TOTALS);
  }
  const kids = node && node.children;
  if (Array.isArray(kids)) for (const kid of kids) walk(kid);
};

export function rehypeDiagramMotion() {
  return (tree) => {
    walk(tree);

    // 一个构建进程里只报一次：这是「插件确实改到了图解」的唯一可见证据，
    // 数字为 0 就说明 raw 节点没匹配上，动效其实没生效（不要只看构建成功）。
    if (!logged && TOTALS.svgs > 0) {
      logged = true;
      console.log(
        `[diagram-motion] svg ${TOTALS.svgs} · 节点 ${TOTALS.nodes} · 文字 ${TOTALS.texts} · 流光 ${TOTALS.sparks}`
      );
    }
    return tree;
  };
}
