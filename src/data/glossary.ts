/**
 * 名词库：全站术语的<b>唯一来源</b>。
 *
 * 为什么要有这个文件：
 *   正文里用到的每个专业名词，都必须能被读者就地查到「它是什么、在哪出现、
 *   为什么会需要它」。如果解释写在正文里，同一个名词在 5 章出现就要维护 5 份，
 *   必然会漂；所以术语只在这里写一次，正文只写一个标记 [[id]]，
 *   由 src/lib/glossary-terms.mjs 在构建期展开成指向 /glossary/#t-<id> 的链接。
 *
 * 三个落点共用这一份数据：
 *   1. 正文行内的术语标记（可点，弹出卡片；无 JS 时跳转名词库锚点）
 *   2. /glossary/ 名词库页（可搜索、可滚动浏览）
 *   3. 章节末的「参考与延伸」区（引用的 refs 汇入外链台账）
 *
 * 字段约定（顺序即卡片上的展示顺序）：
 *   term        名词（中文主名，正文里也用这个写法）
 *   en          英文名（原名）。有它时，正文里**本章第一次**出现这个词会自动
 *               渲染成「中文（English）」，见 src/lib/glossary-terms.ts
 *   aliases     别名，正文里可能出现的其它写法（供名词库搜索命中）
 *   naming      命名辨析：这个中文译名是从哪个英文词来的、直译时丢掉了什么。
 *               中文技术词十有八九是直译，读者按字面理解就会跑偏（典型：
 *               前馈 feed-forward vs 前向 forward pass、隐藏维度 vs d_model、
 *               打分 vs attention score）。凡是「只看中文名会误解」的必须写。
 *   meaning     含义：一句话说清「它是什么」，不出现别的未解释名词
 *   scene       出现场景：读者会在什么地方撞见它
 *   domain      相关学科 / 知识域，见 TERM_DOMAINS
 *   explain     解释：可以展开讲，允许少量内联 HTML（<b> <code>）
 *   example     例子：一个具体的、能对上号的小例子
 *   figure      可选图例：内联 SVG 字符串（不走 markdown 管线，所以不会被
 *               diagram-motion 标注动效，需自带 viewBox 并由 CSS 控制宽度）
 *   refs        可选外部知识链接：每条必须写 why，说清「为什么值得读」。
 *              全站不做原文转载，外链只登记链接与理由（见 wiki/schema.md 第八节）。
 */

import type { DomainId } from './curriculum';

/**
 * 术语所属的知识域：站内四大领域 + 两块底座。
 *
 * `accent` 用于线条与底色，`text` 用于文字色 —— 两者分开是因为**同一个色不能两用**：
 * `--gold #b8944b` 在纸色底上只有 2.49:1，当线条没问题，当文字就看不见了
 * （见 design.md 第十一节的对比度实测与已知缺口）。
 * 所以评测域的 accent 保持品牌金，text 用它的深色版本 #8a6a1e（4.72:1）。
 */
export type TermDomain = 'math' | 'dl' | DomainId;

export const TERM_DOMAINS: Record<TermDomain, { label: string; accent: string; text: string }> = {
  math: { label: '数学基础', accent: '#6b4326', text: '#6b4326' },
  dl: { label: '深度学习基础', accent: '#345a75', text: '#345a75' },
  llm: { label: '大模型原理', accent: '#2c4a7c', text: '#2c4a7c' },
  harness: { label: 'Harness 工程', accent: '#9b2c2c', text: '#9b2c2c' },
  eval: { label: '评测工程', accent: '#b8944b', text: '#8a6a1e' },
  knowledge: { label: '知识引擎', accent: '#2f6157', text: '#2f6157' },
};

export interface TermRef {
  /** 链接显示名 */
  label: string;
  url: string;
  /** 为什么值得读：一句话，不用「点击查看」这类无信息量的话 */
  why: string;
}

export interface Term {
  id: string;
  term: string;
  en?: string;
  aliases?: string[];
  /** 命名辨析：中文译名的来源与直译会丢掉的语义（见文件头的字段约定） */
  naming?: string;
  meaning: string;
  scene: string;
  domain: TermDomain;
  explain: string;
  example?: string;
  figure?: string;
  refs?: TermRef[];
}

/* ------------------------------------------------------------------ *
 * 图例：三张小图，用来说明「形状」「投影」「注意力矩阵」
 * 配色沿用站内领域色，字号遵守 wiki/schema.md 的图解规范（≥8.2）
 * ------------------------------------------------------------------ */

const FIG_TENSOR = `<svg viewBox="0 0 560 190" role="img" aria-label="标量、向量、矩阵、三阶张量：都是同一类东西的不同阶数">
  <text x="12" y="20" font-family="Georgia, serif" font-size="12.5" font-weight="700" fill="#1f1b16">张量 = 一组被排成 N 维网格的数</text>
  <text x="12" y="38" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">阶数（rank）就是下标个数；深度学习里几乎只用 0–4 阶</text>
  <text x="40" y="62" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#345a75">标量 0 阶</text>
  <circle cx="40" cy="88" r="11" fill="#eef1f7" stroke="#2c4a7c" stroke-width="1.3"/>
  <text x="40" y="117" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">3.14</text>
  <text x="150" y="62" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#345a75">向量 1 阶</text>
  <rect x="112" y="77" width="76" height="22" fill="#eef1f7" stroke="#2c4a7c" stroke-width="1.3"/>
  <text x="150" y="117" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">[0.2, 0.7, 0.1]</text>
  <text x="272" y="62" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#345a75">矩阵 2 阶</text>
  <g stroke="#2c4a7c" stroke-width="1.3" fill="#eef1f7">
    <rect x="234" y="72" width="76" height="44"/>
  </g>
  <line x1="234" y1="94" x2="310" y2="94" stroke="#cfc6b6" stroke-width="0.8"/>
  <line x1="272" y1="72" x2="272" y2="116" stroke="#cfc6b6" stroke-width="0.8"/>
  <text x="272" y="133" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">[n, d] —— 几行几列</text>
  <text x="440" y="62" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#345a75">三阶张量</text>
  <g stroke="#2c4a7c" stroke-width="1.2" fill="#eef1f7">
    <rect x="372" y="72" width="70" height="44"/>
    <rect x="384" y="80" width="70" height="44" fill="#eef1f7" fill-opacity="0.55"/>
    <rect x="396" y="88" width="70" height="44" fill="#eef1f7" fill-opacity="0.25"/>
  </g>
  <text x="443" y="152" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">[h, n, d] —— 多头/批次就多一阶</text>
  <text x="12" y="176" font-family="ui-monospace, monospace" font-size="9.6" fill="#9b2c2c">读法：先看阶数（有几个下标），再看每一维多大 —— 这就是「形状」</text>
</svg>`;

const FIG_PROJECTION = `<svg viewBox="0 0 560 170" role="img" aria-label="投影就是用一组可学习的权重，把同一个向量表示成另一组坐标">
  <text x="12" y="20" font-family="Georgia, serif" font-size="12.5" font-weight="700" fill="#1f1b16">投影：换一组坐标去看同一个东西</text>
  <text x="12" y="38" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">不改变「它是什么」，只改变「用什么语言描述它」</text>
  <rect x="16" y="56" width="130" height="46" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.2"/>
  <text x="81" y="75" text-anchor="middle" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#1f1b16">同一个向量 x</text>
  <text x="81" y="92" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.8" fill="#6b6257">[d]</text>
  <line x1="150" y1="79" x2="196" y2="79" stroke="#1f1b16" stroke-width="1.2"/>
  <path d="M196,79 L188,75 L188,83 z" fill="#1f1b16"/>
  <text x="173" y="72" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">×W</text>
  <rect x="204" y="52" width="152" height="54" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
  <text x="280" y="71" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.6" font-weight="700" fill="#8a6a1e">可学习的权重矩阵 W</text>
  <text x="280" y="88" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.8" fill="#6b6257">[d, d']（训练出来的，不是人写的）</text>
  <text x="280" y="101" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" fill="#9b2c2c">「学」= 反向传播改的就是它</text>
  <line x1="360" y1="79" x2="406" y2="79" stroke="#1f1b16" stroke-width="1.2"/>
  <path d="M406,79 L398,75 L398,83 z" fill="#1f1b16"/>
  <rect x="414" y="52" width="132" height="54" fill="#eef1f7" stroke="#2c4a7c" stroke-width="1.3"/>
  <text x="480" y="71" text-anchor="middle" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#2c4a7c">同一个向量的新坐标</text>
  <text x="480" y="88" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.8" fill="#6b6257">[d']</text>
  <text x="16" y="136" font-family="ui-monospace, monospace" font-size="9.8" fill="#1f1b16">自注意力里 W_q / W_k / W_v 就是三组不同的 W：同一份输入，被翻译成三种问法。</text>
  <text x="16" y="154" font-family="ui-monospace, monospace" font-size="9.8" fill="#9b2c2c">「我要找什么」/「我能被什么找到」/「我实际携带什么」—— 三者视角不同，来源相同。</text>
</svg>`;

const FIG_ATTENTION_MATRIX = `<svg viewBox="0 0 560 200" role="img" aria-label="注意力矩阵是 n 乘 n 的方阵，格数随序列长度平方增长">
  <text x="12" y="20" font-family="Georgia, serif" font-size="12.5" font-weight="700" fill="#1f1b16">注意力矩阵：n 行 × n 列</text>
  <text x="12" y="38" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">每一格 = 「第 i 个位置该分多少注意力给第 j 个位置」，所以位置两两之间都要算一次</text>
  <rect x="24" y="54" width="150" height="150" fill="#fdf6e8" stroke="#1f1b16" stroke-width="1"/>
  <g stroke="#cfc6b6" stroke-width="0.7">
    <line x1="24" y1="84" x2="174" y2="84"/><line x1="24" y1="114" x2="174" y2="114"/><line x1="24" y1="144" x2="174" y2="144"/><line x1="24" y1="174" x2="174" y2="174"/>
    <line x1="54" y1="54" x2="54" y2="204"/><line x1="84" y1="54" x2="84" y2="204"/><line x1="114" y1="54" x2="114" y2="204"/><line x1="144" y1="54" x2="144" y2="204"/>
  </g>
  <text x="99" y="224" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">n = 6 时：36 格</text>
  <text x="212" y="105" font-family="ui-monospace, monospace" font-size="10.5" fill="#1f1b16">n = 6</text>
  <text x="212" y="124" font-family="ui-monospace, monospace" font-size="10.5" fill="#9b2c2c">格数 = 6² = 36</text>
  <text x="212" y="160" font-family="ui-monospace, monospace" font-size="10.5" fill="#1f1b16">n = 12</text>
  <text x="212" y="179" font-family="ui-monospace, monospace" font-size="10.5" fill="#9b2c2c">格数 = 12² = 144（n 翻倍，格数×4）</text>
  <text x="212" y="198" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">而输入本身的元素数只从 6d 涨到 12d（×2）</text>
  <text x="366" y="105" font-family="ui-monospace, monospace" font-size="9.8" fill="#1f1b16">这就是 n² 的全部来源：</text>
  <text x="366" y="124" font-family="ui-monospace, monospace" font-size="9.8" fill="#1f1b16">不是模型「笨」，而是</text>
  <text x="366" y="143" font-family="ui-monospace, monospace" font-size="9.8" fill="#9b2c2c">「任意两点都要互相看」</text>
  <text x="366" y="162" font-family="ui-monospace, monospace" font-size="9.8" fill="#1f1b16">这件事本身就是平方的。</text>
</svg>`;

/* ------------------------------------------------------------------ *
 * 术语表
 * ------------------------------------------------------------------ */

export const TERMS: Term[] = [
  /* ============ 底座：数学与深度学习 ============ */
  {
    id: 'tensor',
    term: '张量',
    en: 'Tensor',
    aliases: ['张量形状', 'tensor'],
    naming:
      '「张量」是 tensor 的音译（tensor 源自拉丁语 tendere，「拉伸」），今天这个名字里已经读不出任何含义了。英文它只是「多维数组」的统称，中文名反而容易让人以为它是个高深对象 —— 记住它等于「数 + 排列方式」就够了。',
    meaning: '一组被排成 N 维网格的数。它不是什么高深的对象，只是「数 + 排列方式」。',
    scene: '凡是讲模型计算的地方都会出现：输入是张量，权重是张量，中间结果也是张量。',
    domain: 'math',
    explain:
      '张量用一个<b>阶数</b>（rank，也叫维度数）来描述「要用几个下标才能定位到一个数」：<br>· 0 阶 = 标量，一个数，如 <code>3.14</code>；<br>· 1 阶 = 向量，一串数，如 <code>[0.2, 0.7, 0.1]</code>；<br>· 2 阶 = 矩阵，一张数表，要「第几行第几列」两个下标；<br>· 3 阶及以上 = 更高维的网格，要更多下标。<br>所以「张量」和「矩阵」「向量」不是并列关系，而是<b>同一类东西的不同阶数</b>。工程上我们几乎只关心两件事：<b>阶数（有几个下标）</b>和<b>每一维多大</b>——这两者合起来就叫<b>形状</b>（shape）。',
    example:
      '一句话记住：<code>[n, d]</code> 读作「n 行 d 列」，也就是「n 个位置，每个位置用一个 d 维向量表示」。看到它你马上知道：这里有 n 个 token，每个 token 被描述成 d 个数。',
    figure: FIG_TENSOR,
    refs: [
      {
        label: 'PyTorch · Tensors 官方教程',
        url: 'https://pytorch.org/tutorials/beginner/basics/tensorqs_tutorial.html',
        why: '想看「张量在代码里长什么样」直接读这一节：创建、形状、切片、运算，全是可运行的片段，比任何解释都直观。',
      },
      {
        label: '动手学深度学习 · 数据操作（中文）',
        url: 'https://zh.d2l.ai/chapter_preliminaries/ndarray.html',
        why: '中文、可离线读、代码可直接跑。想搞清楚数学上严格定义的「张量」（多重线性映射）与深度学习里口语说的张量差在哪时，先看它把工程用法讲透的这一节。',
      },
    ],
  },
  {
    id: 'shape',
    term: '形状',
    en: 'Shape',
    aliases: ['张量形状', '维度'],
    naming:
      '英文原文 shape 就是 NumPy 里的 .shape，指「每一维各有多长」。中文「形状」很容易被读成几何外形，而这里跟形状毫无关系 —— 读到时请在脑子里替换成「各维长度」。',
    meaning: '张量每一维的大小，写作 [n, d] 这样的列表。',
    scene: '读论文、调代码、排查报错时最先看的东西——绝大多数形状错误都会在训练时直接抛出。',
    domain: 'math',
    explain:
      '形状是工程上最省力的正确性检查：<b>推导形状比推导公式容易得多，也更容易发现错误。</b>本站在讲注意力时故意「先不碰公式，只跟踪形状」，就是因为形状对得上，说明数据流没走错；形状对不上，公式写得再漂亮也是错的。<br>常见记号：<code>[n]</code> 一维长度 n；<code>[n, d]</code> 两维；<code>[h, n, d]</code> 三维（h 个头或多批次）。',
    example:
      '注意力里最关键的一次形状变化：输入 <code>[n, d]</code> → 中间 <code>[n, n]</code> → 输出 <code>[n, d]</code>。中间那一跳为什么危险？因为 n 从一维里「跑到」了两个维度上。',
    refs: [
      {
        label: 'NumPy · ndarray.shape',
        url: 'https://numpy.org/doc/stable/reference/generated/numpy.ndarray.shape.html',
        why: '形状这套记号来自 NumPy，看官方定义能避免「维度」一词的歧义（它有时指阶数、有时指某一维大小）。',
      },
    ],
  },
  {
    id: 'vector',
    term: '向量',
    en: 'Vector',
    naming:
      '大陆译「向量」，「矢量」是同一个词的另一种译法（物理教材常用）。英文 vector 原义是「带方向的量」，但在模型里它常常只是一串普通的数，不必强行想象成箭头。',
    meaning: '一串有序的数。在模型里，它代表「某个东西被表示成的一条坐标」。',
    scene: '每个 token 被变成一个向量；每个词的 Embedding 也是一个向量。',
    domain: 'math',
    explain:
      '向量有两种读法，两种都要会用：<br>· <b>作为一串数</b>：<code>[0.2, 0.7, 0.1]</code>，方便做计算；<br>· <b>作为空间里的一个点/一支箭头</b>：方便建立直觉——两个向量「方向接近」就说明它们表示的东西相似。<br>模型内部所有的语义关系，最终都落实为向量之间的几何关系（夹角、距离、投影）。',
    example: '「猫」和「狗」的向量夹角很小，「猫」和「微分方程」的夹角很大——语义相似度就是这么被量化的。',
    refs: [
      {
        label: '3Blue1Brown · 线性代数的本质',
        url: 'https://www.3blue1brown.com/topics/linear-algebra',
        why: '如果你对「向量是一支箭头」「矩阵是一次变换」没有画面感，先看这个系列。看完再读注意力，Q/K/V 就不再是三个字母。',
      },
    ],
  },
  {
    id: 'dot-product',
    term: '点积',
    en: 'Dot product',
    aliases: ['内积', '点乘'],
    naming:
      '也译「内积」（inner product）、「点乘」。严格说两者不完全等价：inner product 是更一般的概念，dot product 是它的一种。注意力这里用的是 dot product。',
    meaning: '两个等长向量逐项相乘再求和，得到一个数：它衡量两个向量「方向有多一致」。',
    scene: '注意力里所有「谁该关注谁」的分数，都是点积算出来的。',
    domain: 'math',
    explain:
      '定义很朴素：<code>a·b = a₁b₁ + a₂b₂ + … + a_d b_d</code>。<br>它的两重含义：<br>· <b>几何上</b>：<code>a·b = |a||b|cosθ</code>，所以它和夹角余弦成正比——方向越一致，值越大；正交时为 0；相反时为负。<br>· <b>计算上</b>：它就是一行乘一列，是一次「乘加」。这也是为什么点积能被矩阵乘法批量执行——<b>整个注意力矩阵可以用一次矩阵乘法算完</b>，这是它能在 GPU 上高效运行的根本原因。',
    example:
      '<code>[1, 0] · [1, 0] = 1</code>（完全一致）<br><code>[1, 0] · [0, 1] = 0</code>（毫无关系）<br>注意力就是在问：<b>我这个位置的查询向量，和各个位置的键向量，点积各是多少？</b>大的那些，就是我要关注的对象。',
    refs: [
      {
        label: '动手学深度学习 · 线性代数（中文）',
        url: 'https://zh.d2l.ai/chapter_preliminaries/linear-algebra.html',
        why: '想确认「点积 = 夹角余弦」的几何推导时看它，中文且有 NumPy 实现可对照。理解到这一层，你就能解释为什么后面要除以 √d 做缩放。',
      },
    ],
  },
  {
    id: 'big-o',
    term: '大 O 记号',
    en: 'Big-O notation',
    aliases: ['复杂度', '时间复杂度', 'O(n)'],
    naming:
      '原文中的 O 是字母 O（order 的首字母），不是数字 0 —— 写成 O(n²) 而不是 0(n²)。中文「大 O 记号」算音义混译，没有丢信息，但要知道它读作 big-O。',
    meaning: '描述「输入变大时，计算量按什么速度增长」的记号，只看增长趋势、忽略常数。',
    scene: '凡是讨论「上下文变长会怎样」「这个方案能不能扛住」的地方，说的都是它。',
    domain: 'math',
    explain:
      '<code>O(n)</code> 读作「随 n 线性增长」——n 翻倍，计算量约翻倍。<code>O(n²)</code> 读作「平方增长」——n 翻倍，计算量约变 4 倍。<br>为什么工程上要关心趋势而不是具体数字？因为<b>常数因子可以被硬件和优化吃掉，而增长趋势不能</b>。n 小的时候两者差不多；n 大到某个程度，平方项就会压倒一切。这正是「长上下文很贵」的全部道理。',
    example:
      'n 从 8,000 涨到 32,000（4 倍）：线性项约变 4 倍，平方项约变 <b>16 倍</b>。所以在长上下文场景里，优化注意力比优化别的地方回报高得多。',
    refs: [
      {
        label: 'OI Wiki · 复杂度（中文）',
        url: 'https://oi-wiki.org/basic/complexity/',
        why: '需要严谨定义（上界、渐进、忽略常数）时读它。中文、例子密集。日常工程判断读前两节就够。',
      },
      {
        label: 'Big-O Cheat Sheet',
        url: 'https://www.bigocheatsheet.com/',
        why: '一张图看清各种复杂度在 n 增大时的相对位置。用来给「n² 有多可怕」找参照物很合适。',
      },
    ],
  },

  /* ============ 分词与表示 ============ */
  {
    id: 'token',
    term: 'Token',
    en: 'Token',
    aliases: ['token', '词元', '令牌'],
    naming:
      '中文有一个正式译名「词元」（国家标准里的译法），但论文和业界几乎不翻译，直接叫 token。它不是「词」也不是「字」，本站因此也不译 —— 叫「词元」反而容易让人以为模型是按词切分的。',
    meaning: '模型处理文本的最小单位。它既不是字也不是词，而是分词器切出来的一个片段。',
    scene: '上下文长度、计费、截断策略——所有这些「按 token 算」的东西。',
    domain: 'llm',
    explain:
      '模型不认识字符串，只认识整数编号。分词器把文本切成 token，再映射成整数。<br>常见切法介于「按字」和「按词」之间：高频词往往是完整一个 token，低频词会被切成几个片段。所以<b>一句中文大约 1 个汉字 ≈ 0.6–1 个 token，而一段代码的 token 数常常比字符数还多</b>（缩进、符号都很占）。<br>这解释了两件常让人困惑的事：为什么「同样的字数」在不同语言/内容上花的钱不一样；为什么截断不能按字符数算。',
    example:
      '序列长度 n 指的就是 token 数。n=8,000 大约相当于 5,000–8,000 个汉字，或 2,000–3,000 行普通代码——具体取决于分词器与代码风格。',
    refs: [
      {
        label: 'OpenAI · Tokenizer 在线工具',
        url: 'https://platform.openai.com/tokenizer',
        why: '最直观的办法：亲手贴一段中文和一段代码进去，看它们各被切成多少 token。比读十篇解释都快。',
      },
      {
        label: 'tiktoken（OpenAI 的开源分词器）',
        url: 'https://github.com/openai/tiktoken',
        why: '想弄清 BPE 这类分词算法到底怎么「切」的，直接读它的实现与 README——它解释了为什么常见词是整块、罕见词被拆碎，也是上面那个在线分词器背后的同一套代码。',
      },
    ],
  },
  {
    id: 'embedding',
    term: 'Embedding',
    en: 'Embedding',
    aliases: ['嵌入', '词嵌入', 'embedding'],
    naming:
      '中文常译「嵌入」或「词嵌入」。「嵌入」丢掉了原文的动词感：embed 是「把东西放进某个空间里」，指的是把离散的编号放进一个连续的语义空间，而不是「嵌在某个地方」。',
    meaning: '把离散的编号（如 token id）映射成一个稠密向量的过程或那张表。',
    scene: '模型最开头第一步：token 编号 → d 维向量。',
    domain: 'llm',
    explain:
      'token id 是个孤立的整数，整数本身没有语义——id 500 和 id 501 不代表任何「相似」。Embedding 给每个 id 配一个 d 维向量，<b>让「语义相近」变成「向量相近」</b>，从此相似度可以用几何来算。<br>这张表是<b>可学习的</b>：训练过程中这些向量会被不断调整，最终「猫」和「狗」的向量自然靠拢——没有人手工规定它们该像。<br>实现上它就是一次查表：拿 id 去表里取第 id 行。所以它虽然写作矩阵乘法，实际是 O(1) 的取行操作。',
    example:
      '输入 <code>[n]</code>（n 个整数）→ 输出 <code>[n, d]</code>（n 个 d 维向量）。这一跳是「文本」进入「数学」的门口：之后所有计算都在向量空间里进行。',
    refs: [
      {
        label: 'The Illustrated Word2vec',
        url: 'https://jalammar.github.io/illustrated-word2vec/',
        why: '想了解词向量的历史脉络（one-hot → word2vec → 上下文相关表示）时读它。图文并茂地解释了「为什么稠密向量比 one-hot 好」，是这条线上最好读的一篇。',
      },
    ],
  },
  {
    id: 'hidden-dim',
    term: '隐藏维度 d',
    en: 'd_model',
    aliases: ['d_model', '模型维度', 'hidden size'],
    naming:
      '⚠️ 这个中文名和论文对不上：Transformer 论文里这个量叫 <b>d_model</b>（model dimension，模型维度），中文的「隐藏维度」来自另一支传统（hidden size / 隐藏层）。叫它「隐藏维度」会让人误以为是某个隐藏层的宽度，其实它是<b>贯穿整个模型</b>的宽度。读论文时看到 d_model，就是这里的 d。',
    meaning: '每个位置用来表示信息的向量长度，例如 4096。',
    scene: '所有形状标注里的那个 d；显存估算、参数量估算都从它出发。',
    domain: 'llm',
    explain:
      'd 是模型的「宽度」。它决定了两件事：<b>每个位置能装多少信息</b>，以及<b>计算量</b>（投影与 FFN 都是 O(n·d²)，因为一个 d 维向量过一层 d×d 的权重是 d² 次乘加）。<br>注意 d 与 n 的角色完全不同：<b>n 是「有多少个位置」（长度，可变），d 是「每个位置多宽」（宽度，训练时定死）</b>。这也是为什么复杂度分析里会出现「n·d²」和「n²·d」两种项——前者是逐位置的计算（随 n 线性），后者是位置两两比较（随 n 平方）。',
    example: 'd=4096 时，一组 d×d 权重的参数量约 1,678 万；三组（Q/K/V）约 5,000 万。这就是「为什么模型参数这么多」的一部分答案。',
    refs: [
      {
        label: 'The Illustrated Transformer',
        url: 'https://jalammar.github.io/illustrated-transformer/',
        why: '全站最推荐的注意力入门图解。它把 d、n、头数画在图上，看完形状就不再是抽象记号。',
      },
    ],
  },
  {
    id: 'positional-encoding',
    term: '位置编码',
    en: 'Positional Encoding',
    aliases: ['RoPE', '相对位置', '位置嵌入'],
    naming:
      '「编码」这个词有点误导：这里的 encoding 不是压缩也不是加密，而是「把位置信息变成一串可以直接加到向量上的数」。英文强调的是「编成一个向量」，中文强调的是「编」，语感并不一样。',
    meaning: '把「这是第几个位置」的信息注入到表示里的机制。',
    scene: '不加它，模型无法区分语序；加了它，也带来「能不能外推到更长上下文」的问题。',
    domain: 'llm',
    explain:
      '注意力本身是<b>置换等变</b>的：把输入顺序打乱，输出只会跟着打乱，模型没有任何机制知道谁在前谁在后。所以「猫追狗」和「狗追猫」在纯注意力看来是同一件事。<br>位置编码就是把顺序信息补进去。演进路径大致是：可学习的绝对位置嵌入 → 正弦编码 → 现在主流的 <b>RoPE 这类相对位置方案</b>。<br>相对位置方案的好处是对超出训练长度的位置有一定外推能力，但<b>「把窗口调大」不等于「模型真能用好长窗口」</b>——这是长上下文必须单独评测的原因。',
    example: 'RoPE 的做法是把位置信息编码成向量旋转的角度，于是两个位置之间的相对距离直接体现为旋转差，天然适合「相对位置」这件事。',
    refs: [
      {
        label: '科学空间 · 旋转位置编码 RoPE',
        url: 'https://kexue.fm/archives/8265',
        why: '中文圈讲 RoPE 最清楚的一篇，从「为什么要相对位置」推到具体形式。想真正搞懂就别跳过推导部分。',
      },
      {
        label: 'The Illustrated Transformer',
        url: 'https://jalammar.github.io/illustrated-transformer/',
        why: '看正弦编码长什么样、怎么加进 Embedding，图比公式好懂。',
      },
    ],
  },

  /* ============ 自注意力三件套 ============ */
  {
    id: 'forward',
    term: '前向计算',
    en: 'Forward pass',
    aliases: ['前向', '前向传播', 'forward pass'],
    naming:
      '「前向」是 forward pass 的简称，完整说法是「前向传播 / 前向计算」，与之配对的是 backward pass（反向传播）。最容易混的是它与「前馈网络（feed-forward）」：forward pass 是<b>一次计算过程</b>，feed-forward 是<b>一种网络结构</b> —— 英文里是两个词，中文都写成了「前向 / 前馈」。',
    meaning: '把输入喂进模型、一路算到输出，这一次计算叫一次前向计算；它不更新任何参数。',
    scene: '算推理成本、算首 token 延迟、估显存占用时，量的都是「一次前向」。训练时则是前向与反向成对出现。',
    domain: 'llm',
    explain:
      '一次前向就是数据从输入走到输出的完整路径：切 token → 查 Embedding → 逐层做注意力与前馈 → 得到下一个 token 的概率分布。<br>工程上有三件事都挂在这一次计算上：<br>· <b>显存</b>：中间结果（激活值）在前向过程中产生并占显存；<br>· <b>延迟</b>：Prefill 是「对着长输入做一次前向」，Decode 是「每生成一个 token 做一次前向」，两者的开销结构完全不同；<br>· <b>成本</b>：算力与计费都按前向过程的规模算。<br>还要分清：<b>训练</b>要多跑一遍反向传播，<b>推理</b>只有前向。',
    example:
      '同一个模型，输入 10 个 token 和输入 10000 个 token，都是一次前向 —— 但后者中间那个 <code>[n, n]</code> 注意力矩阵大了 100 万倍。这就是「前向成本随输入长度怎么变」的全部意思。',
    refs: [
      {
        label: 'The Illustrated Transformer',
        url: 'https://jalammar.github.io/illustrated-transformer/',
        why: '它把一次前向画成了从输入到输出的数据流，是建立整体画面最快的一篇。读本站第三节卡住时对照着看。',
      },
    ],
  },
  {
    id: 'self-attention',
    term: '自注意力',
    en: 'Self-Attention',
    aliases: ['Self-Attention', '注意力机制'],
    naming:
      'self 指的是「Q、K、V 全都来自同一份输入」，也就是序列在和它自己做注意力；论文里也叫 intra-attention（内部注意力）。「自注意力」这个译名是准确的，只要别读成「自己的注意力」。',
    meaning: '序列里每个位置都去看一遍所有位置（包括自己），按相关度加权收集信息。',
    scene: 'Transformer 的主体。所有「上下文越长越贵」的结论都从这里长出来。',
    domain: 'llm',
    explain:
      '「自」的意思是：<b>查询的一方和被查的一方是同一份输入</b>（如果是「解码器去看编码器」那种跨序列的叫交叉注意力）。<br>它解决的问题是：<b>让每个位置在处理自己时，能直接拿到任意另一个位置的信息，且距离不成为障碍</b>。循环网络要一步步传递，距离越远信息越淡；自注意力一次就打通所有位置——代价就是两两都要算，于是有了 n²。',
    example: '句子「他把钥匙放在桌上，然后忘了<b>它</b>」——处理「它」时，模型要靠注意力指回「钥匙」。距离远近不影响能不能看到，只影响算得多贵。',
    refs: [
      {
        label: 'Attention Is All You Need（原论文）',
        url: 'https://arxiv.org/abs/1706.03762',
        why: '原始出处。第一节与第三节图 1 就够；不必逐段读完，但要亲手见过原文那张图。',
      },
      {
        label: 'Lilian Weng · Attention? Attention!',
        url: 'https://lilianweng.github.io/posts/2018-06-24-attention/',
        why: '把各种注意力变体（加性、点积、多头、自注意力）放在一张谱系里对比。想搞清「它们之间的关系」时读它。',
      },
    ],
  },
  {
    id: 'projection',
    term: '投影',
    en: 'Linear Projection',
    aliases: ['线性投影', '投影矩阵', '线性变换'],
    naming:
      '英文全称是 linear projection（线性投影），工程口语里干脆直接说「乘一个 W」。中文借了几何里的「投影」，容易让人以为有几何意义；在这里它只表示「换一组坐标去看同一个向量」。',
    meaning: '用一个可学习的权重矩阵做乘法，把向量从一组坐标换算到另一组坐标。',
    scene: '注意力里生成 Q/K/V 的那一步；FFN 里也有两处。',
    domain: 'dl',
    explain:
      '投影在几何上的意思很朴素：<b>不改变对象本身，只换一组坐标去看它</b>。比如一根杆子，你可以说「它朝东北」，也可以说「在 x 方向 3 米、y 方向 4 米」——描述变了，杆子没变。<br>在模型里，投影就是一次矩阵乘法 <code>y = xW</code>。关键在于：<b>W 不是人写的，是训练出来的</b>。反向传播调整的就是它。「学」这个字，学的就是这堆权重。<br>为什么需要它？因为同一份输入要回答三个不同的问题（我要找什么 / 我能被什么找到 / 我携带什么），<b>用同一组坐标同时表达三件事会互相干扰，所以各给一组专属坐标</b>。',
    example:
      '输入 <code>X</code> 形状 <code>[n, d]</code>，权重 <code>W_q</code> 形状 <code>[d, d]</code>，相乘得 <code>Q</code> 形状 <code>[n, d]</code>。<br>注意「形状不变」这一点很重要：投影只改内容，不改结构；真正改变形状（并制造出 n²）的是后面那一步打分。',
    figure: FIG_PROJECTION,
    refs: [
      {
        label: '3Blue1Brown · 线性代数的本质',
        url: 'https://www.3blue1brown.com/topics/linear-algebra',
        why: '「矩阵乘法 = 坐标变换」这个直觉是理解投影的前提。第 3–4 集最相关。',
      },
    ],
  },
  {
    id: 'query-key-value',
    term: 'Q / K / V',
    en: 'Query / Key / Value',
    aliases: ['QKV', 'Query', 'Key', 'Value', '查询向量', '键向量', '值向量'],
    naming:
      '中文常见译法是「查询 / 键 / 值」，但「键」很容易被读成键盘的键。它们本来就是检索系统的比喻：query 是我拿什么去查，key 是我能被什么查到，value 是我返回什么。',
    meaning: '同一份输入经三组不同投影得到的三种角色：我要找什么、我能被什么找到、我实际携带什么。',
    scene: '注意力的核心变量。K 与 V 也正是后续会被 KV Cache 缓存起来的对象。',
    domain: 'llm',
    explain:
      '用图书馆打个比方，这三者一次就分清了：<br>· <b>Q（Query，查询）</b>：你手上的问题——「我要找关于 X 的书」；<br>· <b>K（Key，键）</b>：每本书书脊上的标签——「我是关于什么的」，用来被别人匹配；<br>· <b>V（Value，值）</b>：书里真正的内容——匹配上之后你实际拿走的东西。<br>关键点：<b>匹配用 K，取内容用 V，两者是分开的</b>。为什么不直接用同一份表示匹配又取值？因为「该不该关注你」和「关注你能拿到什么」是两个不同的问题，混在一起会互相牵制。<br>三者的形状都是 <code>[n, d]</code>，且都由同一个 <code>X</code> 投影而来——所以叫「自」注意力。',
    example:
      '<code>Q = X·W_q</code>、<code>K = X·W_k</code>、<code>V = X·W_v</code>。三组权重的形状都是 <code>[d, d]</code>，三者的输出形状都是 <code>[n, d]</code>。',
    refs: [
      {
        label: 'The Illustrated Transformer',
        url: 'https://jalammar.github.io/illustrated-transformer/',
        why: 'Q/K/V 的图书馆比喻与图示，这篇讲得最直观，也解释了 K 和 V 分开的意义。',
      },
    ],
  },
  {
    id: 'scoring',
    term: '打分',
    en: 'Scoring',
    aliases: ['注意力分数', '相关度', 'similarity score'],
    naming:
      '论文里并没有「打分」这个词，用的是 attention score（注意力分数）或 compatibility function（相容性函数）。「打分」是中文社区的口语说法，好处是直观，代价是读论文时对不上号。',
    meaning: '用 Q 和 K 的点积算出「两个位置之间相关度」的那一步，结果是一张 [n, n] 的表。',
    scene: '注意力三步走的第二步，也是 n² 复杂度真正产生的地方。',
    domain: 'llm',
    explain:
      '打分要回答的问题是：<b>处理第 i 个位置时，第 j 个位置该分到多少注意力？</b><br>做法是把第 i 行的 Q（<code>[d]</code>）与所有位置的 K 逐个做点积，得到 n 个数——第 j 个位置一个。n 个位置都这么做，就得到一张 <code>[n, n]</code> 的表。<br>· <b>输入</b>：Q <code>[n, d]</code>、K <code>[n, d]</code>；<br>· <b>输出</b>：分数矩阵 <code>[n, n]</code>（写全：<code>S = Q·Kᵀ</code>，这里要把 K 转置才能对齐维度）；<br>· <b>为什么要这么做</b>：因为「相关」这件事要有可计算的度量，而点积正好度量方向一致性，且能被一次矩阵乘法批量算完。<br>打分之后还要缩放与 softmax，把分数变成「每行加起来等于 1」的权重。',
    example:
      'n=8,000 时这张表有 <b>6,400 万个</b>数。若按 16 位浮点存，光它自己就是约 128 MB——而它只是中间结果。这就是「长上下文吃显存」最直白的一笔账。',
    figure: FIG_ATTENTION_MATRIX,
    refs: [
      {
        label: 'The Annotated Transformer',
        url: 'https://nlp.seas.harvard.edu/annotated-transformer/',
        why: '边读论文边看可运行代码，能亲手打印出 [n, n] 的形状。想确认「打分到底算什么」时最可靠。',
      },
    ],
  },
  {
    id: 'softmax',
    term: 'Softmax',
    en: 'Softmax',
    aliases: ['归一化', 'softmax'],
    naming:
      '原文 soft + max，意思是「软化的最大值」：它不挑出最大的那个（那是 argmax），而是按大小给每个位置分配一个比例，且比例之和为 1。中文一般直接写 Softmax，不译。',
    meaning: '把任意一串数变成「都为正、且加起来等于 1」的一串数，可当作比例或概率来读。',
    scene: '打分之后必需的一步：把原始分数变成权重。也出现在采样、分类等很多地方。',
    domain: 'math',
    explain:
      '公式写作 <code>softmax(x_i) = e^{x_i} / Σ_j e^{x_j}</code>。它做了三件事：<br>· 取指数，保证结果恒为正；<br>· 除以总和，保证加起来等于 1；<br>· 放大差距——<b>大者更大，小者更小</b>，所以它其实是一种「软性的最大值」。<br>「软」在这里指：不把小的直接置零，而是按比例保留。<b>这很重要，因为置零会让梯度消失，模型就没法学习了。</b><br>注意力是<b>按行</b>做 softmax 的：每个位置分给所有位置的权重加起来是 1。',
    example:
      '分数 <code>[2, 1, 0]</code> → 约 <code>[0.665, 0.245, 0.090]</code>。差距被放大了，但三项都还在。<br>对比「硬最大值」会得到 <code>[1, 0, 0]</code>——信息全丢，梯度全断。',
    refs: [
      {
        label: '动手学深度学习 · softmax 回归（中文）',
        url: 'https://zh.d2l.ai/chapter_linear-networks/softmax-regression.html',
        why: '想看清楚它和交叉熵为什么配合得这么好时读它。中文推导完整，且带可运行的实现。',
      },
      {
        label: '科学空间 · 从最大熵角度看 Softmax',
        url: 'https://kexue.fm/archives/6394',
        why: '从最大熵推导 softmax 的一种思路，能解释「为什么偏偏是这个函数而不是别的」。',
      },
    ],
  },
  {
    id: 'scaling',
    term: '缩放因子 √d',
    en: 'Scaling factor',
    aliases: ['除以根号 d', 'scale', '缩放'],
    naming:
      '论文里没有独立名词，它就是 scaled dot-product attention 里的那个 scaled（缩放）。「缩放因子」是本站在解释 √d 时用的说法，指「乘上去的那个数」。',
    meaning: '打分结果除以 √d 再送进 softmax，防止数值过大导致 softmax 退化。',
    scene: '注意力公式里那个最容易被忽略、却又不能省的除法。',
    domain: 'math',
    explain:
      '为什么要除？因为点积是 d 个数相加。如果每个分量是均值 0、方差 1 的独立随机数，那么点积的方差约等于 <b>d</b>——<b>维度越高，点积的绝对值越大</b>。<br>分数一旦很大，softmax 就会进入饱和区：输出退化成接近 one-hot（只关注一个位置），<b>梯度几乎为零，模型学不动</b>。除以 √d 正好把方差拉回大约 1，让 softmax 工作在敏感的区间。<br>所以这个 √d <b>不是调出来的超参，而是由维度 d 决定的量纲修复</b>。',
    example: 'd=4096 时 √d=64。若某次点积是 320，除以 64 后变成 5——从「必然饱和」回到「还在工作区间」。',
    refs: [
      {
        label: 'Attention Is All You Need · 3.2.1 节',
        url: 'https://arxiv.org/abs/1706.03762',
        why: '原文给出这个缩放的动机与脚注。只有几行，读它比读转述可靠。',
      },
    ],
  },
  {
    id: 'weighted-sum',
    term: '加权求和',
    en: 'Weighted Sum',
    aliases: ['聚合', '加权平均', 'aggregate'],
    naming:
      '直译，没有丢信息：用一组权重去加权、再求和。要记住的是这里的「权重」特指 softmax 之后那组非负、且和恰好为 1 的数，而不是随便一组系数。',
    meaning: '用 softmax 得到的权重，把各个位置的 V 按比例混合起来，得到当前位置的输出。',
    scene: '注意力三步走的最后一步；输出形状回到 [n, d]。',
    domain: 'llm',
    explain:
      '这一步是<b>纯线性的、没有任何参数的</b>：<code>输出_i = Σ_j A_ij · V_j</code>。<br>读法：第 i 个位置的输出 = 它关注的各个位置的内容，按关注度加权平均。<br>· <b>输入</b>：权重矩阵 A <code>[n, n]</code>、内容 V <code>[n, d]</code>；<br>· <b>输出</b>：<code>[n, d]</code>——<b>和输入同形</b>。<br>「输出与输入同形」是所有注意力变体的共同特征，也是它能像积木一样层层堆叠的原因：插多少层，形状都不变。',
    example:
      '如果第 i 行权重是 <code>[0.7, 0.2, 0.1, 0, …]</code>，输出就是「70% 的第一处内容 + 20% 的第二处 + 10% 的第三处」——这就是「从别处收集信息」的实现方式。',
    refs: [
      {
        label: 'The Annotated Transformer',
        url: 'https://nlp.seas.harvard.edu/annotated-transformer/',
        why: '注意力那几行代码写得很短，注释完整。亲眼看一遍「A @ V」比读解释更能记住形状。',
      },
    ],
  },
  {
    id: 'attention-matrix',
    term: '注意力矩阵',
    en: 'Attention matrix',
    aliases: ['注意力权重矩阵', 'A 矩阵'],
    naming:
      '论文里更常叫 attention weights（注意力权重）。本站两个词都用，但语境不同：<b>强调形状</b>时说「矩阵」（它确实是 [n, n]），<b>强调行和为 1</b> 时说「权重」。指的是同一个东西。',
    meaning: '形状为 [n, n] 的权重表，每行加起来等于 1，表示「每个位置把注意力分给了谁」。',
    scene: '复杂度、显存、可解释性三条线索都指向它。',
    domain: 'llm',
    explain:
      '它有三个身份：<br>· <b>复杂度的来源</b>：n×n 个数，随 n 平方增长；<br>· <b>显存的开销</b>：n=8,000 时是 6,400 万个数，注意力优化的主要对象就是「能不能不显式存下它」（FlashAttention 的思路）；<br>· <b>可解释性的窗口</b>：可视化它能看到「模型在处理这个位置时看了哪里」——虽然这种解释要谨慎，但排查长任务里的「注意力涣散」很有用。',
    example: '首 token 延迟（prefill）要算完整个 [n, n]；而逐 token 生成时只走一行，但仍需读缓存——两阶段瓶颈不同的根源就在这。',
    figure: FIG_ATTENTION_MATRIX,
    refs: [
      {
        label: 'The Annotated Transformer',
        url: 'https://nlp.seas.harvard.edu/annotated-transformer/',
        why: '想确认各记号（A、S、softmax(QKᵀ/√d)）的标准写法时查它。它把论文逐段配上了 PyTorch 实现，记号与形状都能一行行对上。',
      },
    ],
  },
  {
    id: 'multi-head',
    term: '多头注意力',
    en: 'Multi-Head Attention',
    aliases: ['Multi-Head', '头数 h', '注意力头'],
    naming:
      'head（头）是纯粹的比喻，指「一套独立的 Q/K/V 和它自己的注意力计算」。中文照译成「头」，但「多头」绝不能理解成「多个模型」—— 它只是把同一层的 d 维切成 h 份并行处理。',
    meaning: '把表示空间切成若干子空间，并行做多组注意力，最后拼接——让模型同时维持多种关注方式。',
    scene: '所有现代 Transformer 的实际形态。看到「头数 h」就是指它。',
    domain: 'llm',
    explain:
      '单头只有一组 Q/K/V 投影，只能学到一种关注方式。多头把 d 维切成 h 份，每份各自做一次注意力，各自可以关注不同类型的关系（位置邻近、指代、句法结构……），最后拼接再投影回去。<br>工程上的两个要点：<br>· <b>算力不同比例增加</b>：头数 h 与每头维度 head_dim 的乘积大致等于 d，所以多加头并不等比例增加计算量；<br>· <b>不是越多越好</b>：头太多会稀释每个头的表达空间，反而不利。这属于「实验调出来的工程判断」，不是理论必然。',
    example: 'd=4096、h=32 时，每头 128 维。每个头独立算一张 [n, n] 的权重表——所以多头会成倍放大注意力的显存与算力开销。',
    refs: [
      {
        label: 'The Illustrated Transformer',
        url: 'https://jalammar.github.io/illustrated-transformer/',
        why: '它把「拆成多个头 → 各自算 → 拼回去」画成了并列的几条线，是理解多头最省力的一张图。',
      },
    ],
  },
  {
    id: 'causal-mask',
    term: '因果掩码',
    en: 'Causal Mask',
    aliases: ['掩码', 'mask', '下三角掩码'],
    naming:
      '英文里有两个名字：causal mask 与 look-ahead mask（前瞻掩码），后者更直白地说明了目的 —— 不许往前看。中文也译「因果掩蔽」「下三角掩码」（因为被遮住的位置正好是矩阵的上三角）。',
    meaning: '把注意力矩阵右上角置为无效，使位置 i 只能看到 i 及之前的位置。',
    scene: 'decoder-only 模型（也就是现在几乎所有大模型）的必备步骤。',
    domain: 'llm',
    explain:
      '训练时整个序列是一次性送进去的，但生成是逐 token 的——第 3 个位置不能「偷看」第 5 个位置，否则训练目标就没意义了。做法是把分数矩阵的右上三角填成 <code>-inf</code>，softmax 之后这些位置权重就变成 0。<br>它带来一个非常重要的工程后果：<b>每个位置的输出只依赖它左边的前缀</b>。这正是 KV Cache 能够成立的前提——前缀没变，那么算好的 K/V 就可以复用。',
    example: 'n=4 时的掩码是一个下三角为 1、上三角为 0 的 4×4 矩阵；被遮的位置在 softmax 后权重为 0，等于没看到。',
    refs: [
      {
        label: 'The Annotated Transformer',
        url: 'https://nlp.seas.harvard.edu/annotated-transformer/',
        why: '里面有一个叫 subsequent_mask 的函数，几行讲清掩码的形状与作用。',
      },
    ],
  },
  {
    id: 'ffn',
    term: '前馈网络',
    en: 'Feed-Forward Network',
    aliases: ['FFN', 'MLP', '多层感知机'],
    naming:
      '⚠️ 这是直译丢信息的重灾区。英文 feed-forward 是相对 recurrent（循环）说的，指「信息一路向前、不回头」；而 forward 在 forward pass 里指的是「一次向前计算」。中文把这两个不同的英文词都译成了「前向 / 前馈」，于是「前馈网络」和「前向计算」看起来像亲戚，其实一个是<b>结构</b>、一个是<b>过程</b>。论文里的正式名称是 position-wise feed-forward network（逐位置前馈网络）。',
    meaning: '接在注意力之后、对每个位置独立做一次的两层全连接变换。',
    scene: 'Transformer 每一层的第二个子层。它往往占模型参数的大头。',
    domain: 'dl',
    explain:
      '形态是「线性 → 激活 → 线性」，中间维度通常放大到 4d 再压回 d。关键在于它是<b>逐位置</b>的：<b>各个位置之间互不交流</b>。<br>于是责任分得很清楚：<b>注意力负责「位置之间传递信息」，FFN 负责「在单个位置内部做变换」</b>。这也是复杂度分析里 FFN 是 O(n·d²)（随 n 线性）而注意力是 O(n²·d)（随 n 平方）的原因——两者在 n 上的行为完全不同。',
    example: 'MoE 的本质就是把 FFN 换成一堆可选的 FFN，每次只激活其中几个，于是「总参数很大」但「单次激活很少」。这就是下一章之后的内容。',
    refs: [
      {
        label: 'Lilian Weng · The Transformer Family v2.0',
        url: 'https://lilianweng.github.io/posts/2023-01-27-the-transformer-family-v2/',
        why: '想看一整层的完整结构（注意力 + FFN + 残差 + LayerNorm 怎么串），以及 FFN 在各变体里被怎么改，读它开头的结构图最省事。',
      },
    ],
  },
  {
    id: 'quadratic',
    term: '平方复杂度 n²',
    en: 'Quadratic complexity',
    aliases: ['n²', 'n^2', '平方增长', '二次复杂度'],
    naming:
      '英文 quadratic 是「二次的」，比中文「平方」更贴原义。O(n²) 读作「n 的平方」或「n 的二次方」，两种说法都有人用。',
    meaning: '计算量随序列长度 n 的平方增长——n 翻倍，代价变 4 倍。',
    scene: '「上下文很贵」的唯一物理来源。第 1 章的主角。',
    domain: 'llm',
    explain:
      '它来自<b>「任意两个位置都要互相看一眼」</b>这件事本身：每个位置要和其他所有位置算一次相关度，n 个位置就得到 n×n 个分数。而输入本身只随 n 线性增长（n 个位置，每个 d 个数）。<br>所以「平方」不是实现的缺陷，而是这个设计目标的直接代价：<b>要换来「距离不再是障碍」这个能力，就必须付出两两比较的代价。</b><br>推论有三条：<br>· 上下文变长，成本不是线性上涨而是平方级上涨，所以长上下文 API 定价通常是阶梯式的；<br>· 「多塞点上下文」是一种高息负债；<br>· 裁剪、压缩、状态外置是 Harness 的基本功，不是优化技巧。',
    example:
      '把「凡是能用 n² 解释清楚的现象，都不该用『模型能力不够』来解释」当成一条判据：<br>模型在长文档里找不到关键信息 → 先算算是不是注意力被摊薄；<br>长任务越到后面越慢 → 先看看上下文是不是在平方级膨胀。<b>能算清的，就不要猜。</b>',
    refs: [
      {
        label: 'Lilian Weng · 注意力变体谱系',
        url: 'https://lilianweng.github.io/posts/2023-01-27-the-transformer-family-v2/',
        why: '想确认「哪些项是 O(n²·d)、哪些是 O(n·d²)」，以及后人用什么办法把平方项降下来时读它——它的目录本身就是一张「降复杂度路线图」。',
      },
      {
        label: 'OI Wiki · 复杂度（中文）',
        url: 'https://oi-wiki.org/basic/complexity/',
        why: '如果「O(n²) 和 O(2n) 有什么区别」这一层还不牢，先补这个再往下读。',
      },
    ],
  },

  /* ============ 推理阶段 ============ */
  {
    id: 'prefill-decode',
    term: 'Prefill / Decode',
    en: 'Prefill / Decode',
    aliases: ['预填充', '解码阶段', '首 token 延迟', 'prefill', 'decode'],
    naming:
      '这两个词没有通行译名 —— 译成「预填充 / 解码」会和「解码器 decoder」撞车，所以中文社区基本保留英文原词。看到「Prefill 慢」，指的是长输入那一次前向慢。',
    meaning: '推理的两个阶段：一次性处理整段输入（prefill）与逐个生成新 token（decode）。',
    scene: '分析延迟、成本、吞吐时的基本切分；「首 token 慢」和「吐字慢」是两件事。',
    domain: 'llm',
    explain:
      '· <b>Prefill（预填充）</b>：把整段输入一次性算完，要跑完整的 <code>[n, n]</code> 注意力。这一阶段<b>算力受限</b>，GPU 吃满，表现是「第一个字迟迟不出来」。<br>· <b>Decode（解码）</b>：每生成一个 token 只走一步，注意力只算一行，但必须把此前所有 K/V 读出来。这一阶段<b>显存带宽受限</b>，算力反而闲着，表现是「吐字速度上不去」。<br>两个阶段瓶颈不同，优化手段也完全不同（前者靠批处理与并行、后者靠 KV Cache 与量化）。<b>把它们混为一谈是性能分析里最常见的错误。</b>',
    example: '用户感知的「响应慢」可能有两种完全不同的原因：首 token 延迟高（prefill 慢）还是吐字慢（decode 慢）。优化前先分清是哪一个。',
    refs: [
      {
        label: 'vLLM · PagedAttention 与连续批处理',
        url: 'https://blog.vllm.ai/2023/06/20/vllm.html',
        why: '想知道这两个阶段在实际推理框架里怎么被区分与优化时读它。它用的正是「一段算力受限、一段带宽受限」这套说法，与本节的判断标准一致。',
      },
    ],
  },
  {
    id: 'kv-cache',
    term: 'KV Cache',
    en: 'KV Cache',
    aliases: ['KVCache', 'kv cache', '缓存'],
    naming:
      '中文常写「KV 缓存」或「键值缓存」，KV 保留字母不译（key / value 的首字母）。cache 本身有「缓存 / 高速缓存」两种译法，同一篇里保持一致即可。',
    meaning: '把已经算过的 K 和 V 存下来，生成下一个 token 时直接复用，不重算前缀。',
    scene: '第 2 章的主题；也是多轮对话成本与显存的主要变量。',
    domain: 'llm',
    explain:
      '自回归解码时，每生成一个 token 都要做一遍注意力，而每一层的 K、V 只依赖已经出现过的前缀。既然前缀没变，重算出来的 K/V 就是一样的——<b>于是把它们缓存起来，下一步只算新 token 的那一份</b>。<br>它成立的前提正是因果掩码：<b>每个位置只看左边，所以前缀的 K/V 永远不会被后面改变。</b><br>多轮对话能省钱，是因为第二轮 prompt 里绝大部分是第一轮已经算过的内容；而<b>命中与否取决于「前缀稳定性」</b>——前缀里任何一处变化，都会让从该点之后的缓存全部失效。',
    example: 'system prompt 里塞了当前时间戳、把工具列表按使用频率每次重排、检索结果按时间排序每次都变——这些写法看起来无害，实际每一轮都在让缓存重置。',
    refs: [
      {
        label: 'vLLM 论文 · PagedAttention（arXiv:2309.06180）',
        url: 'https://arxiv.org/abs/2309.06180',
        why: '想看清缓存实际占多少显存、为什么显存碎片会成为瓶颈、分页管理怎么解决它时读第二节。它把「KV Cache 的显存账」算得最明白。',
      },
    ],
  },
  {
    id: 'context-window',
    term: '上下文窗口',
    en: 'Context Window',
    aliases: ['上下文长度', 'context length', '窗口'],
    naming:
      '也叫 context length（上下文长度）。两个词常被混用，但含义不同：<b>窗口</b>是接口给你的上限（如 128k），<b>长度</b>是你这次实际用了多少 —— 分开说，才能听懂「窗口 128k，这次只用了 30k」。',
    meaning: '模型一次能接收的 token 总数上限；它同时是能力边界、成本边界和显存边界。',
    scene: '凡是「塞不塞得下」「要不要裁剪」的判断，说的都是它。',
    domain: 'llm',
    explain:
      '三个容易混淆的「长度」要分清：<br>· <b>训练长度</b>：模型训练时见过的长度；<br>· <b>窗口上限</b>：接口允许的最大 token 数；<br>· <b>有效长度</b>：模型真的能用好的长度——<b>它通常明显小于窗口上限</b>。<br>很多人把「窗口调大」等同于「能力变强」，这是个昂贵的误会。评测长上下文必须单独做，正是因为窗口上限与有效长度之间有一条不写在文档里的缝。',
    example: '把 200k 窗口塞满不一定是好事：注意力被摊薄、成本平方级上升、而且模型可能反而找不到中间部分的关键信息（「lost in the middle」现象）。',
    refs: [
      {
        label: 'Lost in the Middle（论文）',
        url: 'https://arxiv.org/abs/2307.03172',
        why: '用实验说明「关键信息放在长上下文的中间会被忽略」。它解释了为什么有效长度≠窗口上限。',
      },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * 查询辅助
 * ------------------------------------------------------------------ */

const byId = new Map(TERMS.map((t) => [t.id, t]));

export const termById = (id: string): Term | undefined => byId.get(id);

/** 术语库 CSS 锚点 id：/glossary/#t-<id> */
export const anchorOf = (id: string): string => `t-${id}`;

/** 按知识域分组，顺序沿用 TERM_DOMAINS 的声明顺序 */
export const termsByDomain = (): { domain: TermDomain; terms: Term[] }[] =>
  (Object.keys(TERM_DOMAINS) as TermDomain[])
    .map((domain) => ({ domain, terms: TERMS.filter((t) => t.domain === domain) }))
    .filter((g) => g.terms.length > 0);

/** 名词库搜索用的可检索文本（含别名、命名辨析与解释，方便「按内容找名词」） */
export const searchTextOf = (t: Term): string =>
  [
    t.term,
    t.en ?? '',
    ...(t.aliases ?? []),
    t.meaning,
    t.scene,
    t.naming ?? '',
    t.explain.replace(/<[^>]+>/g, ''),
  ]
    .join(' ')
    .toLowerCase();
