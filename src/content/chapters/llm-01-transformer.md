---
chapter: llm-01-transformer
lead: 'Agent 的一切都跑在注意力机制之上。这一章只做三件事：把「token 怎么变成一组数、这组数怎么流过注意力、n² 究竟出在哪一步」按顺序讲清楚——因为后面每一章的成本、延迟、上下文策略，都是这个 n² 的推论。'
note: '本版重排了讲解顺序：先用一整节把名词说清楚，再看形状与公式。凡是加了虚线底的名词都可以点开——弹出来的卡片里有含义、出现场景、例子与延伸阅读，不必离开本页。'
---

<p class="dropcap">如果要给「Harness 工程师为什么要懂模型原理」找一个最实际的理由，那就是：你所有的取舍最后都会被三个物理事实定死——注意力是平方复杂度的、KV Cache 是按前缀命中的、输出是采样出来的。这一章讲第一个，而且要从头讲起：先解释清楚 token、张量、形状、投影、打分这些名词，再去看它们怎么拼成一次前向。跳过名词直接看公式，是绝大多数人读不懂 Transformer 的真正原因。</p>

## 一、为什么做工程的人要关心注意力

### 1.1 面试官其实在问什么

面试里被问到「Transformer 原理」，很多人以为考官在考古。其实不是。考官真正想问的是：

- 你知不知道上下文变长，成本是怎么长的？
- 你知不知道「把整个代码库塞进上下文」这条路会在哪一步崩掉？
- 你知不知道长任务的瓶颈到底在算力、显存，还是在带宽？

这三个问题都从 [[self-attention]] 出发——它是 Transformer 里唯一一个「让任意两个位置互相看一眼」的机制。而「互相看」有个直接的后果：位置有 n 个，两两配对就是 n² 对，所以它的开销是 [[quadratic|平方复杂度]]。

**凡是能用 n² 解释清楚的现象，都不该用「模型能力不够」来解释。**

### 1.2 这一章你只需要带走一件事

如果读完只记住一句话，请记住这句：

> 注意力里的平方项，只来自「任意两个位置都要互相比较」这件事；剩下的一切（嵌入、投影、前馈网络）都是逐位置做的，随长度线性增长。

记住它，你就能判断任何一项「长上下文优化技术」到底在优化什么：<strong>它要么减少需要比较的位置对数（滑窗、稀疏、检索），要么让比较这一步更省内存（FlashAttention），要么干脆不让模型自己回顾历史（状态外置、摘要）。</strong>三条路，没有第四条。

### 1.3 怎么读这一章

本章刻意分成两半：

- **上半（第二、三节）**：只讲「是什么」。第二节把名词逐个说清，第三节跟着数据走一遍形状变化。这一半不需要任何数学。
- **下半（第四、五节）**：只讲「代价」。把复杂度摊开，看 n² 出在哪，再翻译成工程推论。

凡是加了虚线底的名词——比如 [[self-attention|自注意力]]——点一下就会弹出卡片，里面有它的含义、出现场景、相关学科、例子和延伸阅读。这些卡片的内容全站统一维护，所以你在任何一章点同一个词，看到的都是同一份解释。

## 二、先把名词说清楚：一段文字怎么变成一组数

很多人读不懂注意力，不是因为数学难，而是因为**名词没对齐**。所以这一节不出现任何公式，只把后面要用的七个名词逐个说清楚。已经熟的读者可以直接跳到第三节。

### 2.1 Token：模型眼里的最小单位

一段文字交给模型之前，先被切成一串 [[token]]。token 不一定是「字」，也不一定是「词」，而是分词器按统计规律切出来的最小单位。同一个词在不同上下文里可能被切成不同的 token 组合。

一条够用的换算经验是：**1 个中文字符约需 0.6 个 token，1 个英文字符约需 0.3 个 token**，反过来粗略地说，**1 个 token 约等于 0.67 个英文单词或 1.67 个汉字**，因此 **8000 token 大约对应 5000 多个英文单词或 1.3 万到 1.4 万个汉字**，而代码行数因语言和写法差异很大，不能简单换算，实际 token 数请以模型返回的 `usage` 为准。

记住 token 的另一个理由更现实：<strong>它是计费单位，也是上下文窗口的计量单位。</strong>你说的「上下文 128k」指的是 128k 个 token，不是 128k 个字。

### 2.2 Embedding：把 token 编号变成一串数

token 本身只是个编号（比如第 12345 号）。编号是离散的，编号之间没有远近关系——12345 和 12346 不代表意思接近。

[[embedding]] 解决的就是这件事：它是一张巨大的查找表，每个 token 编号对应一串数。这串数不是人写的，是训练出来的——训练的结果是**语义相近的 token，对应的数串在空间里也彼此接近**。这就是「Embedding 之后可以算相似度」的全部原理。

那串数本身叫 [[vector|向量]]：一维排列的一组数。至于「一组数为什么能表示意思」——因为方向比大小更重要：两个向量的方向越接近，表示的意思越接近。

### 2.3 张量与形状：一组被排成网格的数

现在我们有 n 个 token，每个 token 用一串 d 个数字表示。把这些数摆在一起，就得到一个 [[tensor|张量]]。

「张量」这个词听起来吓人，其实只是<strong>「数 + 排列方式」</strong>。用一个叫<strong>阶数</strong>（rank）的东西描述它：

<div class="tbl-wrap">
  <table class="news">
    <thead>
      <tr><th>阶数</th><th>名字</th><th>例子</th><th>要几个下标才能定位一个数</th></tr>
    </thead>
    <tbody>
      <tr><td>0 阶</td><td>标量</td><td><code>3.14</code></td><td>0 个</td></tr>
      <tr><td>1 阶</td><td>向量</td><td><code>[0.2, 0.7, 0.1]</code></td><td>1 个</td></tr>
      <tr><td>2 阶</td><td>矩阵</td><td>一张数表</td><td>2 个（第几行、第几列）</td></tr>
      <tr><td>3 阶及以上</td><td>更高维网格</td><td>多份二维表叠起来</td><td>3 个及以上</td></tr>
    </tbody>
  </table>
</div>

所以「张量」和「矩阵」「向量」不是并列关系，而是**同一类东西的不同阶数**——就像「立方体」和「正方形」都是方的一样。

工程上我们几乎只关心两件事：**阶数（有几个下标）**和**每一维多大**。这两者合起来就叫 [[shape|形状]]，写作方括号里的列表。

于是前面那批数据可以一句话说清：<strong>n 个 token、每个 token 一个 d 维向量，整批数据的形状是 `[n, d]`。</strong>看到 `[n, d]` 你就该读出：「这里有 n 个位置，每个位置用 d 个数描述」。

形状不是学术概念，它是**最省力的正确性检查**：推导形状比推导公式容易得多，也更容易发现错误。本站讲注意力时故意「先不碰公式，只跟踪形状」，就是这个原因——形状对得上，说明数据流没走错；形状对不上，公式写得再漂亮也是错的。

### 2.4 隐藏维度 d：4096 这个数从哪来

上一步说的「每个 token 用一串数表示」，那串数到底多长？这个长度就叫 [[hidden-dim|隐藏维度]]，记作 d，现代模型里常见的是 4096、8192 这类数字。

它有两个来源：一是**模型出厂就固定了**，你改不了；二是**它决定了模型内部能装多少信息**。d 太小，表示能力不够；d 太大，参数和显存都爆炸。

为什么 Harness 工程师要关心一个自己改不了的数？因为成本公式里有两个变量，性质完全不同：

- **n（序列长度）是你直接控制的**——你决定往上下文里塞多少历史、多少工具返回、多少检索片段；
- **d 是出厂固定的**——你只能通过选模型来间接影响它。

所以工程上的优化空间，几乎全部落在 n 上。**凡是讨论「怎么把成本降下来」而不谈 n 的，基本可以跳过。**

### 2.5 位置编码：注意力天生不认语序

最后一个名词，也是最容易被忽略的一个。

自注意力有一个反直觉的性质：<strong>它不认语序。</strong>如果你把输入序列打乱，注意力给出的结果只会跟着一起打乱，模型没有任何机制知道「谁在前谁在后」。对「猫追狗」和「狗追猫」这两句话，纯注意力的输出完全相同。

[[positional-encoding|位置编码]] 就是把顺序信息注入表示的手段：在 token 的向量上，叠加一个由位置决定的向量。这样「第 3 个位置」和「第 7 个位置」在数值上就区分开了。

现在主流方案是**相对位置**思路（RoPE 是代表），它编码的是「两者相距多远」而不是「各自排第几」。这带来一个附带好处：模型对超出训练长度的位置有一定外推能力。但请注意一个容易搞混的推论——**「把窗口调大」不等于「模型真的能用好长窗口」**。窗口是接口能力，用好是能力问题，两者必须分开评测。

## 三、一次前向到底做了什么

名词说清楚了，现在跟着数据走一遍。这一节依然尽量不碰公式，只跟踪形状——**看懂形状变化，就看懂了注意力。**

设一批输入是 n 个 token，每个 token 被映射成一个 d 维向量。下面这条链路从头到尾走一遍，就叫一次 [[forward|前向]]——注意它指的是**方向**（数据从输入推向输出，与反向传播相反），不是某一层；真正的那一层叫「前馈」。下面的图把整条链路画成一条流水线。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 400" role="img" aria-label="自注意力的数据流：从输入序列到输出，并标注每一级的张量形状">
      <defs>
        <marker id="ar1" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">自注意力：只看形状</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">n = 序列长度（token 数）　d = 隐藏维度（如 4096）　h = 头数</text>
      <!-- 输入序列 -->
      <rect x="16" y="58" width="184" height="44" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="108" y="76" text-anchor="middle" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#1f1b16">输入 token 序列</text>
      <text x="108" y="92" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">形状 [n]</text>
      <line x1="108" y1="102" x2="108" y2="124" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar1)"/>
      <!-- 嵌入 -->
      <rect x="16" y="124" width="184" height="44" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="108" y="142" text-anchor="middle" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#1f1b16">Embedding + 位置编码</text>
      <text x="108" y="158" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">形状 [n, d]</text>
      <line x1="200" y1="146" x2="232" y2="146" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="232" y1="146" x2="232" y2="92" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="232" y1="92" x2="252" y2="92" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar1)"/>
      <line x1="232" y1="146" x2="232" y2="200" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="232" y1="200" x2="252" y2="200" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar1)"/>
      <line x1="232" y1="146" x2="232" y2="308" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="232" y1="308" x2="252" y2="308" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar1)"/>
      <!-- 三个投影 -->
      <rect x="254" y="70" width="150" height="44" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="329" y="88" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" font-weight="700" fill="#8a6a1e">Q = X · W_q</text>
      <text x="329" y="104" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">[n, d]</text>
      <rect x="254" y="178" width="150" height="44" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="329" y="196" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" font-weight="700" fill="#8a6a1e">K = X · W_k</text>
      <text x="329" y="212" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">[n, d]</text>
      <rect x="254" y="286" width="150" height="44" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="329" y="304" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" font-weight="700" fill="#8a6a1e">V = X · W_v</text>
      <text x="329" y="320" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">[n, d]</text>
      <!-- 注意力分数 -->
      <line x1="404" y1="92" x2="440" y2="92" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="404" y1="200" x2="440" y2="200" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="440" y1="92" x2="440" y2="132" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="440" y1="200" x2="440" y2="132" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="440" y1="132" x2="466" y2="132" stroke="#9b2c2c" stroke-width="1.6" marker-end="url(#ar1)"/>
      <rect x="468" y="104" width="176" height="58" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.4"/>
      <text x="556" y="124" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" font-weight="700" fill="#9b2c2c">A = softmax(QKᵀ / √d)</text>
      <text x="556" y="146" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" fill="#1f1b16">形状 [n, n] ← 平方复杂度的源头</text>
      <!-- n×n 网格示意 -->
      <text x="468" y="184" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">注意力矩阵（每格是一次 token 间权重）</text>
      <g stroke="#cfc6b6" stroke-width="0.8">
        <rect x="468" y="194" width="176" height="96" fill="#fdf6e8" stroke="#1f1b16" stroke-width="1"/>
        <line x1="468" y1="218" x2="644" y2="218"/><line x1="468" y1="242" x2="644" y2="242"/>
        <line x1="468" y1="266" x2="644" y2="266"/>
        <line x1="512" y1="194" x2="512" y2="290"/><line x1="556" y1="194" x2="556" y2="290"/>
        <line x1="600" y1="194" x2="600" y2="290"/>
      </g>
      <text x="644" y="306" text-anchor="end" font-family="ui-monospace, monospace" font-size="9.5" fill="#9b2c2c">n 列 × n 行 = n² 个数</text>
      <!-- 加权求和 -->
      <line x1="404" y1="308" x2="440" y2="308" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="440" y1="308" x2="440" y2="348" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="556" y1="290" x2="556" y2="330" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="556" y1="330" x2="440" y2="330" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="440" y1="348" x2="440" y2="360" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar1)"/>
      <rect x="360" y="360" width="284" height="32" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="502" y="381" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" font-weight="700" fill="#2f6157">输出 = A · V　形状 [n, d]（回到原尺寸）</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　注意力的核心只有一步：把 <code>[n, d]</code> 的输入先压成 <code>[n, n]</code> 的权重矩阵，再用它加权聚合 V。所有关于「上下文很贵」的直觉，都来自中间那个 <code>[n, n]</code>：<b>它随 n 平方增长，而输入本身只随 n 线性增长。</b></figcaption>
</figure>

三步走，记住这三步就够用了：

1. **投影**：同一份输入 X，用三组不同的权重矩阵投影出 Q（我想找什么）、K（我能被什么找到）、V（我实际携带的内容）。
2. **打分**：用 `Q · Kᵀ` 算出任意两个位置之间的相关度，得到一个 `[n, n]` 的矩阵，除以 `√d` 做缩放，再 softmax 成权重。
3. **聚合**：用这组权重对 V 做加权求和，输出形状回到 `[n, d]`。

下面把这三步拆开讲，每一步都回答同一个问题：**输入是什么、输出是什么、为什么非得这么做。**

### 3.1 投影：同一份输入，三种问法

先说清楚「[[projection|投影]]」这个词。它在数学上的意思是「换一组坐标去看同一个东西」——不改变「它是什么」，只改变「用什么语言描述它」。实现上就是乘一个矩阵。

关键在于：<strong>这个矩阵不是人写的，是训练出来的。</strong>训练时反向传播调整的就是这些矩阵里的数。所谓「模型学到了什么」，很大一部分就存在这些矩阵里。

现在看自注意力的入场动作：同一份输入 X（形状 `[n, d]`），乘三个不同的权重矩阵 W_q、W_k、W_v（形状都是 `[d, d]`），得到三个形状同为 `[n, d]` 的张量。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 250" role="img" aria-label="投影：X 的同一行分别乘以 W_q、W_k、W_v，得到 q、k、v 三个用途不同的向量">
      <defs>
        <marker id="ar2" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">投影：同一份输入，三种问法</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">X 的同一行 → 乘三套不同的权重 → 三个用途不同的向量（小方格 = 一个数，颜色深浅 = 数值大小）</text>
      <text x="16" y="66" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">X 的每一行 = 一个 token</text>
      <rect x="18" y="76" width="11" height="11" fill="#e8e0d4"/>
      <rect x="29" y="76" width="11" height="11" fill="#f2ebdf"/>
      <rect x="40" y="76" width="11" height="11" fill="#ded4c4"/>
      <rect x="51" y="76" width="11" height="11" fill="#f2ebdf"/>
      <rect x="62" y="76" width="11" height="11" fill="#e8e0d4"/>
      <rect x="73" y="76" width="11" height="11" fill="#ded4c4"/>
      <rect x="18" y="87" width="11" height="11" fill="#f2ebdf"/>
      <rect x="29" y="87" width="11" height="11" fill="#ded4c4"/>
      <rect x="40" y="87" width="11" height="11" fill="#e8e0d4"/>
      <rect x="51" y="87" width="11" height="11" fill="#e8e0d4"/>
      <rect x="62" y="87" width="11" height="11" fill="#ded4c4"/>
      <rect x="73" y="87" width="11" height="11" fill="#f2ebdf"/>
      <rect x="18" y="98" width="11" height="11" fill="#ded4c4"/>
      <rect x="29" y="98" width="11" height="11" fill="#e8e0d4"/>
      <rect x="40" y="98" width="11" height="11" fill="#f2ebdf"/>
      <rect x="51" y="98" width="11" height="11" fill="#ded4c4"/>
      <rect x="62" y="98" width="11" height="11" fill="#f2ebdf"/>
      <rect x="73" y="98" width="11" height="11" fill="#e8e0d4"/>
      <rect x="18" y="109" width="11" height="11" fill="#f2ebdf"/>
      <rect x="29" y="109" width="11" height="11" fill="#ded4c4"/>
      <rect x="40" y="109" width="11" height="11" fill="#e8e0d4"/>
      <rect x="51" y="109" width="11" height="11" fill="#f2ebdf"/>
      <rect x="62" y="109" width="11" height="11" fill="#ded4c4"/>
      <rect x="73" y="109" width="11" height="11" fill="#f2ebdf"/>
      <text x="51" y="136" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#1f1b16">X　[n, d]</text>
      <line x1="88" y1="98" x2="104" y2="98" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="104" y1="74" x2="104" y2="190" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="104" y1="74" x2="122" y2="74" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar2)"/>
      <line x1="104" y1="132" x2="122" y2="132" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar2)"/>
      <line x1="104" y1="190" x2="122" y2="190" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar2)"/>
      <rect x="124" y="59" width="122" height="30" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="185" y="78" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#8a6a1e">W_q　[d, d]</text>
      <rect x="124" y="117" width="122" height="30" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="185" y="136" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#8a6a1e">W_k　[d, d]</text>
      <rect x="124" y="175" width="122" height="30" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="185" y="194" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#8a6a1e">W_v　[d, d]</text>
      <line x1="246" y1="74" x2="272" y2="74" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar2)"/>
      <line x1="246" y1="132" x2="272" y2="132" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar2)"/>
      <line x1="246" y1="190" x2="272" y2="190" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar2)"/>
      <rect x="274" y="68" width="12" height="12" fill="#dce7f5"/>
      <rect x="286" y="68" width="12" height="12" fill="#b9cde8"/>
      <rect x="298" y="68" width="12" height="12" fill="#dce7f5"/>
      <rect x="310" y="68" width="12" height="12" fill="#eaf1fa"/>
      <rect x="322" y="68" width="12" height="12" fill="#b9cde8"/>
      <text x="342" y="78" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#2c4a7c">q = X·W_q</text>
      <rect x="274" y="126" width="12" height="12" fill="#f7e6c8"/>
      <rect x="286" y="126" width="12" height="12" fill="#e8cf9e"/>
      <rect x="298" y="126" width="12" height="12" fill="#f7e6c8"/>
      <rect x="310" y="126" width="12" height="12" fill="#fbf3e4"/>
      <rect x="322" y="126" width="12" height="12" fill="#e8cf9e"/>
      <text x="342" y="136" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#8a6a1e">k = X·W_k</text>
      <rect x="274" y="184" width="12" height="12" fill="#d9ebe6"/>
      <rect x="286" y="184" width="12" height="12" fill="#b3d6cc"/>
      <rect x="298" y="184" width="12" height="12" fill="#d9ebe6"/>
      <rect x="310" y="184" width="12" height="12" fill="#eaf4f1"/>
      <rect x="322" y="184" width="12" height="12" fill="#b3d6cc"/>
      <text x="342" y="194" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#2f6157">v = X·W_v</text>
      <text x="440" y="72" font-family="ui-monospace, monospace" font-size="9.6" fill="#2c4a7c">q：我在这里「要找什么」</text>
      <text x="440" y="88" font-family="ui-monospace, monospace" font-size="9.6" fill="#8a6a1e">k：我「能被什么找到」</text>
      <text x="440" y="104" font-family="ui-monospace, monospace" font-size="9.6" fill="#2f6157">v：我实际「交出去的内容」</text>
      <text x="440" y="126" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">W 里的数是训练出来的，</text>
      <text x="440" y="142" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">不是人写进去的</text>
      <text x="440" y="196" font-family="ui-monospace, monospace" font-size="9.6" font-weight="700" fill="#9b2c2c">形状不变：进去 [n, d]，出来还是 [n, d]</text>
      <text x="16" y="232" font-family="ui-monospace, monospace" font-size="9.6" fill="#9b2c2c">整批一起做：X [n, d] × W [d, d] → Q / K / V，三者形状都是 [n, d] —— 只换了坐标，没换「有几个位置」</text>
    </svg>
  </div>
  <figcaption><b>图 2</b>　投影不是把数据「变成别的东西」，而是<b>换一组坐标去看同一个东西</b>。同一行输入乘三套管不同问题的权重矩阵，就得到 q（我要找什么）、k（我能被什么找到）、v（我交出去什么）。注意三者的形状都是 <code>[n, d]</code>——<b>投影只改内容、不改革制</b>。</figcaption>
</figure>

- **输入**：`X`，形状 `[n, d]`——n 个位置，每个位置一个 d 维向量；
- **输出**：`Q`、`K`、`V`，形状都是 `[n, d]`——同样是 n 个位置、每个位置 d 维，但已经换了一套坐标；
- **为什么要这么做**：因为「找东西」和「被找到」和「实际内容」是三件不同的事，用同一套表示会互相干扰。用一个比喻：`Q` 是「我要找什么」，`K` 是「我能被什么找到」，`V` 是我实际要交出去的内容。

这三者的正式名字是 [[query-key-value|Q / K / V]]。它们来自同一份输入，所以叫「自」注意力——**每个位置在向包括自己在内的所有位置提问**。

顺带记住一个后面会反复用到的推论：**K 和 V 只由输入决定**。这正是下一章 KV Cache 成立的前提——只要前缀没变，K、V 就可以重用。

### 3.2 打分：让每个位置和所有位置互相看一眼

「打分」这个词指的是 [[scoring]]：给每一对位置算一个相关度分数。用什么算？用点积（[[dot-product]]）——两个向量方向越接近，点积越大。

实现上，把 Q 和 K 的转置相乘：`Q · Kᵀ`。形状上发生了第一次也是唯一一次危险的变化：

- **输入**：`Q` 是 `[n, d]`，`Kᵀ` 是 `[d, n]`；
- **输出**：`[n, n]`；
- **为什么是 n²**：结果矩阵的第 i 行第 j 列 = 「第 i 个位置该给第 j 个位置打多少分」。n 个位置两两配对，就是 n × n 个格子。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 216" role="img" aria-label="打分：Q 的第 i 行与 K 转置的第 j 列做点积，得到分数矩阵的一格">
      <defs>
        <marker id="ar3" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">打分：每一格都是一次「谁该关注谁」的判断</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">Q 的第 i 行 · Kᵀ 的第 j 列 → 一个数 → 放进分数矩阵的第 i 行第 j 列</text>
      <text x="20" y="76" font-family="ui-monospace, monospace" font-size="9.4" fill="#9b2c2c">第 i 行</text>
      <rect x="20" y="82" width="11" height="11" fill="#dce7f5"/>
      <rect x="31" y="82" width="11" height="11" fill="#b9cde8"/>
      <rect x="42" y="82" width="11" height="11" fill="#dce7f5"/>
      <rect x="53" y="82" width="11" height="11" fill="#eaf1fa"/>
      <rect x="64" y="82" width="11" height="11" fill="#b9cde8"/>
      <rect x="20" y="93" width="11" height="11" fill="#b9cde8"/>
      <rect x="31" y="93" width="11" height="11" fill="#dce7f5"/>
      <rect x="42" y="93" width="11" height="11" fill="#eaf1fa"/>
      <rect x="53" y="93" width="11" height="11" fill="#b9cde8"/>
      <rect x="64" y="93" width="11" height="11" fill="#dce7f5"/>
      <rect x="20" y="104" width="11" height="11" fill="#eaf1fa"/>
      <rect x="31" y="104" width="11" height="11" fill="#b9cde8"/>
      <rect x="42" y="104" width="11" height="11" fill="#dce7f5"/>
      <rect x="53" y="104" width="11" height="11" fill="#dce7f5"/>
      <rect x="64" y="104" width="11" height="11" fill="#eaf1fa"/>
      <rect x="20" y="115" width="11" height="11" fill="#dce7f5"/>
      <rect x="31" y="115" width="11" height="11" fill="#eaf1fa"/>
      <rect x="42" y="115" width="11" height="11" fill="#b9cde8"/>
      <rect x="53" y="115" width="11" height="11" fill="#dce7f5"/>
      <rect x="64" y="115" width="11" height="11" fill="#b9cde8"/>
      <rect x="20" y="93" width="55" height="11" fill="none" stroke="#9b2c2c" stroke-width="1.4"/>
      <text x="47" y="146" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#2c4a7c">Q　[n, d]</text>
      <text x="82" y="110" font-family="Georgia, serif" font-size="15" font-weight="700" fill="#1f1b16">·</text>
      <text x="126" y="64" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" fill="#9b2c2c">第 j 列</text>
      <rect x="104" y="71" width="11" height="11" fill="#f7e6c8"/>
      <rect x="115" y="71" width="11" height="11" fill="#e8cf9e"/>
      <rect x="126" y="71" width="11" height="11" fill="#f7e6c8"/>
      <rect x="137" y="71" width="11" height="11" fill="#fbf3e4"/>
      <rect x="104" y="82" width="11" height="11" fill="#e8cf9e"/>
      <rect x="115" y="82" width="11" height="11" fill="#f7e6c8"/>
      <rect x="126" y="82" width="11" height="11" fill="#e8cf9e"/>
      <rect x="137" y="82" width="11" height="11" fill="#f7e6c8"/>
      <rect x="104" y="93" width="11" height="11" fill="#f7e6c8"/>
      <rect x="115" y="93" width="11" height="11" fill="#fbf3e4"/>
      <rect x="126" y="93" width="11" height="11" fill="#f7e6c8"/>
      <rect x="137" y="93" width="11" height="11" fill="#e8cf9e"/>
      <rect x="104" y="104" width="11" height="11" fill="#fbf3e4"/>
      <rect x="115" y="104" width="11" height="11" fill="#e8cf9e"/>
      <rect x="126" y="104" width="11" height="11" fill="#fbf3e4"/>
      <rect x="137" y="104" width="11" height="11" fill="#f7e6c8"/>
      <rect x="104" y="115" width="11" height="11" fill="#e8cf9e"/>
      <rect x="115" y="115" width="11" height="11" fill="#f7e6c8"/>
      <rect x="126" y="115" width="11" height="11" fill="#e8cf9e"/>
      <rect x="137" y="115" width="11" height="11" fill="#fbf3e4"/>
      <rect x="126" y="71" width="11" height="55" fill="none" stroke="#9b2c2c" stroke-width="1.4"/>
      <text x="126" y="146" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#8a6a1e">Kᵀ　[d, n]</text>
      <line x1="160" y1="98" x2="286" y2="98" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar3)"/>
      <text x="223" y="92" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">一次点积</text>
      <rect x="300" y="76" width="13" height="13" fill="#f6e7e7"/>
      <rect x="313" y="76" width="13" height="13" fill="#e7c3c3"/>
      <rect x="326" y="76" width="13" height="13" fill="#f6e7e7"/>
      <rect x="339" y="76" width="13" height="13" fill="#cf9a9a"/>
      <rect x="300" y="89" width="13" height="13" fill="#e7c3c3"/>
      <rect x="313" y="89" width="13" height="13" fill="#cf9a9a"/>
      <rect x="326" y="89" width="13" height="13" fill="#e7c3c3"/>
      <rect x="339" y="89" width="13" height="13" fill="#f6e7e7"/>
      <rect x="300" y="102" width="13" height="13" fill="#cf9a9a"/>
      <rect x="313" y="102" width="13" height="13" fill="#f6e7e7"/>
      <rect x="326" y="102" width="13" height="13" fill="#cf9a9a"/>
      <rect x="339" y="102" width="13" height="13" fill="#e7c3c3"/>
      <rect x="300" y="115" width="13" height="13" fill="#f6e7e7"/>
      <rect x="313" y="115" width="13" height="13" fill="#e7c3c3"/>
      <rect x="326" y="115" width="13" height="13" fill="#f6e7e7"/>
      <rect x="339" y="115" width="13" height="13" fill="#cf9a9a"/>
      <rect x="313" y="89" width="13" height="13" fill="none" stroke="#9b2c2c" stroke-width="1.6"/>
      <text x="326" y="148" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#9b2c2c">分数矩阵　[n, n]</text>
      <text x="374" y="86" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">每一格 = 一个位置给另一个位置的分</text>
      <text x="374" y="104" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">颜色越深 = 分数越大</text>
      <text x="374" y="128" font-family="ui-monospace, monospace" font-size="9.6" font-weight="700" fill="#9b2c2c">两个维度都长成 n</text>
      <text x="374" y="146" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">输入只有一维是 n，这里是两维</text>
      <text x="16" y="188" font-family="ui-monospace, monospace" font-size="9.6" fill="#9b2c2c">n 个位置两两配对 → n × n 格。n² 不是「模型算得慢」，而是「两两比较」这件事本身的规模</text>
      <text x="16" y="206" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">这正是下面 KV Cache 与长上下文优化的全部前提：省不掉 n²，就只能少算、少存</text>
    </svg>
  </div>
  <figcaption><b>图 3</b>　一次点积就是一次「第 i 个位置问、第 j 个位置答」，所以分数的个数 <b>= 位置对的数量 = n²</b>。注意左边的 Q 和 Kᵀ 各自只有一维是 n，右边这张表却是两维都为 n——<b>平方项就是在这一步被制造出来的</b>。</figcaption>
</figure>


这个 `[n, n]` 的矩阵叫 [[attention-matrix|注意力矩阵]]。它是全章唯一一个**同时被两个维度 n 撑大**的东西——输入 `[n, d]` 只有一维是 n，而它是两维都是 n。

这就是 n² 的全部来源。请把这句话记牢：**不是模型「算得慢」，是「两两比较」这件事本身就要 n² 次计算。**

### 3.3 缩放：为什么必须除以 √d

`Q · Kᵀ` 出来的是原始的分数，直接送进 softmax 会有问题，所以要除以 `√d`。这一步叫 [[scaling|缩放]]。

为什么是 `√d` 而不是别的？直觉版的解释：点积是 d 个数相乘再相加。如果每个数都是均值为 0、方差为 1 的随机数，那么 d 项相加的结果方差会变成 d，标准差变成 `√d`。除以 `√d` 正好把它拉回单位量级。

- **输入**：`[n, n]` 的原始分数；
- **输出**：`[n, n]` 的缩放后分数，量级回到 1 附近；
- **不这么做会怎样**：分数太大时，softmax 会被最大的那个数「吃掉」，输出接近 one-hot（极端情况下梯度会消失）。模型会变得难以训练，注意力权重也会退化——**它不再是在做「综合考虑几个位置」，而是硬挑一个位置。**

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 296" role="img" aria-label="缩放的作用：不除以根号 d 时 softmax 会退化成几乎只挑一个位置，除以根号 d 后权重才是平缓的综合">
      <defs>
        <marker id="ar4" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">缩放：差一个 √d，行为差一个物种</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">同一组「谁更相关」的判断，只因为分数被放大，softmax 的结果就从「综合看几处」变成「只挑一处」</text>
      <line x1="330" y1="56" x2="330" y2="256" stroke="#e4dcd0" stroke-width="1"/>
      <text x="22" y="66" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#9b2c2c">不缩放　d = 64，分数被放大 ≈ 8 倍</text>
      <rect x="60" y="132" width="30" height="18" fill="#e8cf9e"/>
      <rect x="110" y="78" width="30" height="72" fill="#e8cf9e"/>
      <rect x="160" y="138" width="30" height="12" fill="#e8cf9e"/>
      <rect x="210" y="96" width="30" height="54" fill="#e8cf9e"/>
      <line x1="50" y1="150" x2="250" y2="150" stroke="#a89e8d" stroke-width="1"/>
      <text x="155" y="166" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">原始分数：18 · 72 · 12 · 54（差距被拉得很开）</text>
      <line x1="155" y1="172" x2="155" y2="180" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar4)"/>
      <rect x="60" y="182" width="30" height="68" fill="#cf9a9a"/>
      <rect x="110" y="248" width="30" height="2" fill="#cf9a9a"/>
      <rect x="160" y="248" width="30" height="2" fill="#cf9a9a"/>
      <rect x="210" y="248" width="30" height="2" fill="#cf9a9a"/>
      <line x1="50" y1="250" x2="250" y2="250" stroke="#a89e8d" stroke-width="1"/>
      <text x="155" y="266" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" font-weight="700" fill="#9b2c2c">softmax 后 ≈ 0.99 / 0 / 0 / 0　→ 退化成 one-hot</text>
      <text x="155" y="282" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">不但不再「综合考虑」，梯度也趋近于 0</text>
      <text x="356" y="66" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#2f6157">除以 √d　分数回到 1 附近</text>
      <rect x="394" y="136" width="30" height="14" fill="#e8cf9e"/>
      <rect x="444" y="128" width="30" height="22" fill="#e8cf9e"/>
      <rect x="494" y="138" width="30" height="12" fill="#e8cf9e"/>
      <rect x="544" y="132" width="30" height="18" fill="#e8cf9e"/>
      <line x1="384" y1="150" x2="584" y2="150" stroke="#a89e8d" stroke-width="1"/>
      <text x="489" y="166" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">缩放后分数：2.2 · 3.4 · 1.8 · 2.8（量级可比）</text>
      <line x1="489" y1="172" x2="489" y2="180" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar4)"/>
      <rect x="394" y="228" width="30" height="22" fill="#b3d6cc"/>
      <rect x="444" y="214" width="30" height="36" fill="#b3d6cc"/>
      <rect x="494" y="232" width="30" height="18" fill="#b3d6cc"/>
      <rect x="544" y="220" width="30" height="30" fill="#b3d6cc"/>
      <line x1="384" y1="250" x2="584" y2="250" stroke="#a89e8d" stroke-width="1"/>
      <text x="489" y="266" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" font-weight="700" fill="#2f6157">softmax 后 ≈ 0.17 / 0.38 / 0.14 / 0.31　→ 真的在加权</text>
      <text x="489" y="282" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">每行权重之和仍然等于 1 —— 变的是「怎么分」</text>
    </svg>
  </div>
  <figcaption><b>图 4</b>　这两张柱子用的是<b>同一组相关性判断</b>，唯一的区别是分数有没有被放大。左图那个 0.99 不是「模型很确定」，而是<b> softmax 被大数吃掉了</b>：一旦变成这样，注意力就不再是「把几处信息综合起来」，而退化成「硬挑一处」，同时梯度趋近 0。所以 <code>√d</code> 不是可选的调参，是让它别退化的必要条件。</figcaption>
</figure>


### 3.4 Softmax 与加权求和：从分数回到向量

接下来两步，把 `[n, n]` 的分数变成 `[n, d]` 的输出。

**第一步是 [[softmax]]**：按行归一化，让每一行的 n 个数都变成非负数且加起来等于 1。做完之后，每一行就是一组「分配比例」——第 i 行说的是「第 i 个位置把注意力按什么比例分给所有位置」。

- 输入 `[n, n]` 原始分数 → 输出 `[n, n]` 权重，每行和为 1。

**第二步是加权求和（[[weighted-sum]]）**：用每一行的权重，把 V 里对应的向量按比例加起来，得到一个 d 维向量。n 行各做一次，就得到 n 个 d 维向量。

- 输入 `[n, n]` 权重 × `[n, d]` 的 V → 输出 `[n, d]`。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 268" role="img" aria-label="加权求和：一行的权重乘以 V 的每一行再相加，得到输出的一行">
      <defs>
        <marker id="ar5" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#2f6157"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">从分数回到向量：按比例混合 V 的每一行</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">这一行说得是「第 i 个位置把注意力按什么比例分给各个位置」，比例就写在权重那一列里</text>
      <text x="45" y="62" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#9b2c2c">权重（和 = 1）</text>
      <rect x="28" y="70" width="34" height="22" fill="#f0d8d8"/>
      <text x="45" y="85" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">0.04</text>
      <rect x="28" y="96" width="34" height="22" fill="#c98a8a"/>
      <text x="45" y="111" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" font-weight="700" fill="#fbf7f2">0.72</text>
      <rect x="28" y="122" width="34" height="22" fill="#f6e7e7"/>
      <text x="45" y="137" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">0.01</text>
      <rect x="28" y="148" width="34" height="22" fill="#e0b6b6"/>
      <text x="45" y="163" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">0.23</text>
      <text x="150" y="62" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#2f6157">V　[n, d]（每行一个位置的内容）</text>
      <rect x="140" y="70" width="24" height="22" fill="#d9ebe6"/>
      <rect x="164" y="70" width="24" height="22" fill="#b3d6cc"/>
      <rect x="188" y="70" width="24" height="22" fill="#d9ebe6"/>
      <rect x="212" y="70" width="24" height="22" fill="#eaf4f1"/>
      <rect x="236" y="70" width="24" height="22" fill="#b3d6cc"/>
      <rect x="140" y="96" width="24" height="22" fill="#b3d6cc"/>
      <rect x="164" y="96" width="24" height="22" fill="#d9ebe6"/>
      <rect x="188" y="96" width="24" height="22" fill="#eaf4f1"/>
      <rect x="212" y="96" width="24" height="22" fill="#b3d6cc"/>
      <rect x="236" y="96" width="24" height="22" fill="#d9ebe6"/>
      <rect x="140" y="122" width="24" height="22" fill="#eaf4f1"/>
      <rect x="164" y="122" width="24" height="22" fill="#b3d6cc"/>
      <rect x="188" y="122" width="24" height="22" fill="#d9ebe6"/>
      <rect x="212" y="122" width="24" height="22" fill="#d9ebe6"/>
      <rect x="236" y="122" width="24" height="22" fill="#eaf4f1"/>
      <rect x="140" y="148" width="24" height="22" fill="#d9ebe6"/>
      <rect x="164" y="148" width="24" height="22" fill="#eaf4f1"/>
      <rect x="188" y="148" width="24" height="22" fill="#b3d6cc"/>
      <rect x="212" y="148" width="24" height="22" fill="#d9ebe6"/>
      <rect x="236" y="148" width="24" height="22" fill="#b3d6cc"/>
      <line x1="64" y1="81" x2="134" y2="81" stroke="#2f6157" stroke-width="1.1" marker-end="url(#ar5)"/>
      <line x1="64" y1="107" x2="134" y2="107" stroke="#2f6157" stroke-width="1.4" marker-end="url(#ar5)"/>
      <line x1="64" y1="133" x2="134" y2="133" stroke="#2f6157" stroke-width="1.1" marker-end="url(#ar5)"/>
      <line x1="64" y1="159" x2="134" y2="159" stroke="#2f6157" stroke-width="1.2" marker-end="url(#ar5)"/>
      <text x="99" y="182" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">每行乘自己的权重</text>
      <text x="290" y="116" font-family="Georgia, serif" font-size="15" font-weight="700" fill="#1f1b16">=</text>
      <text x="196" y="196" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#9b2c2c">四行相加（权重大的行贡献大，权重≈0 的行几乎不参与）</text>
      <rect x="314" y="96" width="24" height="22" fill="#c3ddd6"/>
      <rect x="338" y="96" width="24" height="22" fill="#a9ccc3"/>
      <rect x="362" y="96" width="24" height="22" fill="#dcece8"/>
      <rect x="386" y="96" width="24" height="22" fill="#c3ddd6"/>
      <rect x="410" y="96" width="24" height="22" fill="#a9ccc3"/>
      <text x="374" y="134" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#2f6157">输出的一行</text>
      <text x="456" y="80" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">输出的一行 = V 各行的「加权平均」</text>
      <text x="456" y="98" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">权重非负、和为 1</text>
      <text x="456" y="116" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">所以结果一定落在 V 各行的</text>
      <text x="456" y="132" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">「包围范围」之内，不会跑飞</text>
      <text x="456" y="156" font-family="ui-monospace, monospace" font-size="9.6" font-weight="700" fill="#9b2c2c">n 行各做一次 → [n, d]</text>
      <text x="16" y="228" font-family="ui-monospace, monospace" font-size="9.6" fill="#2f6157">进去 [n, d]（V 的形状），出来还是 [n, d] —— 注意力是一个「保持形状」的信息交换层</text>
      <text x="16" y="250" font-family="ui-monospace, monospace" font-size="9.6" fill="#9b2c2c">正因为形状不变，它才能一层一层堆上去；也正因为中间那张 [n, n] 表要留下来算，显存才吃紧</text>
    </svg>
  </div>
  <figcaption><b>图 5</b>　「加权求和」不是新机制，就是<b>把 V 的几行按比例混成一行</b>。softmax 保证权重非负且和为 1，所以输出永远落在这些行的「包围范围」里——这既让它稳定，也解释了一件事：<b>如果权重全被一个位置吃掉（图 4 左），输出就等于直接抄那一行。</b></figcaption>
</figure>


形状回到了和输入完全一样的 `[n, d]`。这不是巧合，而是刻意设计：**注意力是一个「信息交换」层，它必须保持形状不变**，这样才能一层层叠下去。你可以在图 1 里看到这个「进去 `[n, d]`、出来 `[n, d]`」的闭环。

### 3.5 多头：把一次注意力拆成 h 次并行

只做一套 Q/K/V 是不够的。现实中一句话里同时存在好几种关系——语法上的主谓、指代上的照应、语义上的远近。一套注意力只能表达一种「关注方式」。

[[multi-head|多头注意力]] 的做法是把 d 维切成 h 份，每份长度 `d/h`，各自独立跑一遍上面的流程，最后把 h 份结果拼回 `[n, d]`。

- **形状变化**：`[n, d]` → `[h, n, d/h]`（多了「头」这一阶）→ 各头独立算注意力 → 拼回 `[n, d]`；
- **代价不变**：总计算量和不分头基本一样，因为每个头处理的维度只有 `1/h`；
- **换来了什么**：h 套不同的 W_q/W_k/W_v，等于让模型同时用 h 种「提问方式」看同一段文本。

这就是为什么本站在讲形状时会强调阶数——**多头只是多了一阶，机制一步都没变。**

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 400" role="img" aria-label="多头注意力：输入按维度切成四份，每份各有自己的权重矩阵和注意力表，最后再拼接回原形状">
      <defs>
        <marker id="ar6t" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#2f6157"/>
        </marker>
        <marker id="ar6r" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#9b2c2c"/>
        </marker>
        <marker id="ar6g" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#8a6a1e"/>
        </marker>
        <marker id="ar6b" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#2c4a7c"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">多头：把 d 切成 h 份，让 h 种「提问方式」同时上场</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">机制一步没变 —— 同一行输入按维度切片，每片独立跑一遍 3.1–3.4，跑完再拼回来</text>
      <text x="44" y="62" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#1f1b16">输入的一行　[1, d]　d 维被切成 h = 4 份</text>
      <rect x="44" y="70" width="34" height="18" fill="#b3d6cc"/>
      <rect x="78" y="70" width="34" height="18" fill="#d9ebe6"/>
      <rect x="112" y="70" width="34" height="18" fill="#eaf4f1"/>
      <rect x="146" y="70" width="34" height="18" fill="#b3d6cc"/>
      <rect x="190" y="70" width="34" height="18" fill="#cf9a9a"/>
      <rect x="224" y="70" width="34" height="18" fill="#f6e7e7"/>
      <rect x="258" y="70" width="34" height="18" fill="#e7c3c3"/>
      <rect x="292" y="70" width="34" height="18" fill="#f6e7e7"/>
      <rect x="336" y="70" width="34" height="18" fill="#e8cf9e"/>
      <rect x="370" y="70" width="34" height="18" fill="#f7e6c8"/>
      <rect x="404" y="70" width="34" height="18" fill="#fbf3e4"/>
      <rect x="438" y="70" width="34" height="18" fill="#f7e6c8"/>
      <rect x="482" y="70" width="34" height="18" fill="#b9cde8"/>
      <rect x="516" y="70" width="34" height="18" fill="#eaf1fa"/>
      <rect x="550" y="70" width="34" height="18" fill="#dce7f5"/>
      <rect x="584" y="70" width="34" height="18" fill="#eaf1fa"/>
      <line x1="112" y1="92" x2="112" y2="112" stroke="#2f6157" stroke-width="1.2" marker-end="url(#ar6t)"/>
      <line x1="258" y1="92" x2="258" y2="112" stroke="#9b2c2c" stroke-width="1.2" marker-end="url(#ar6r)"/>
      <line x1="404" y1="92" x2="404" y2="112" stroke="#8a6a1e" stroke-width="1.2" marker-end="url(#ar6g)"/>
      <line x1="550" y1="92" x2="550" y2="112" stroke="#2c4a7c" stroke-width="1.2" marker-end="url(#ar6b)"/>
      <rect x="44" y="116" width="136" height="132" fill="#fbf8f2" stroke="#2f6157" stroke-width="1.1"/>
      <text x="54" y="134" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#2f6157">头 1</text>
      <rect x="52" y="142" width="36" height="14" fill="#eef4f1" stroke="#b3d6cc" stroke-width="0.8"/>
      <text x="70" y="152" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.4" fill="#2f6157">Wq</text>
      <rect x="94" y="142" width="36" height="14" fill="#eef4f1" stroke="#b3d6cc" stroke-width="0.8"/>
      <text x="112" y="152" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.4" fill="#2f6157">Wk</text>
      <rect x="136" y="142" width="36" height="14" fill="#eef4f1" stroke="#b3d6cc" stroke-width="0.8"/>
      <text x="154" y="152" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.4" fill="#2f6157">Wv</text>
      <rect x="88" y="168" width="12" height="12" fill="#eef4f1"/>
      <rect x="100" y="168" width="12" height="12" fill="#eef4f1"/>
      <rect x="112" y="168" width="12" height="12" fill="#eef4f1"/>
      <rect x="124" y="168" width="12" height="12" fill="#eef4f1"/>
      <rect x="88" y="180" width="12" height="12" fill="#7fae9f"/>
      <rect x="100" y="180" width="12" height="12" fill="#eef4f1"/>
      <rect x="112" y="180" width="12" height="12" fill="#eef4f1"/>
      <rect x="124" y="180" width="12" height="12" fill="#eef4f1"/>
      <rect x="88" y="192" width="12" height="12" fill="#eef4f1"/>
      <rect x="100" y="192" width="12" height="12" fill="#7fae9f"/>
      <rect x="112" y="192" width="12" height="12" fill="#eef4f1"/>
      <rect x="124" y="192" width="12" height="12" fill="#eef4f1"/>
      <rect x="88" y="204" width="12" height="12" fill="#eef4f1"/>
      <rect x="100" y="204" width="12" height="12" fill="#eef4f1"/>
      <rect x="112" y="204" width="12" height="12" fill="#7fae9f"/>
      <rect x="124" y="204" width="12" height="12" fill="#eef4f1"/>
      <text x="112" y="230" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#2f6157">学出「看前一个」</text>
      <rect x="190" y="116" width="136" height="132" fill="#fbf8f2" stroke="#9b2c2c" stroke-width="1.1"/>
      <text x="200" y="134" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#9b2c2c">头 2</text>
      <rect x="198" y="142" width="36" height="14" fill="#fbf1f1" stroke="#cf9a9a" stroke-width="0.8"/>
      <text x="216" y="152" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.4" fill="#9b2c2c">Wq</text>
      <rect x="240" y="142" width="36" height="14" fill="#fbf1f1" stroke="#cf9a9a" stroke-width="0.8"/>
      <text x="258" y="152" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.4" fill="#9b2c2c">Wk</text>
      <rect x="282" y="142" width="36" height="14" fill="#fbf1f1" stroke="#cf9a9a" stroke-width="0.8"/>
      <text x="300" y="152" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.4" fill="#9b2c2c">Wv</text>
      <rect x="234" y="168" width="12" height="12" fill="#b06a6a"/>
      <rect x="246" y="168" width="12" height="12" fill="#fbf1f1"/>
      <rect x="258" y="168" width="12" height="12" fill="#fbf1f1"/>
      <rect x="270" y="168" width="12" height="12" fill="#fbf1f1"/>
      <rect x="234" y="180" width="12" height="12" fill="#fbf1f1"/>
      <rect x="246" y="180" width="12" height="12" fill="#b06a6a"/>
      <rect x="258" y="180" width="12" height="12" fill="#fbf1f1"/>
      <rect x="270" y="180" width="12" height="12" fill="#fbf1f1"/>
      <rect x="234" y="192" width="12" height="12" fill="#fbf1f1"/>
      <rect x="246" y="192" width="12" height="12" fill="#fbf1f1"/>
      <rect x="258" y="192" width="12" height="12" fill="#b06a6a"/>
      <rect x="270" y="192" width="12" height="12" fill="#fbf1f1"/>
      <rect x="234" y="204" width="12" height="12" fill="#fbf1f1"/>
      <rect x="246" y="204" width="12" height="12" fill="#fbf1f1"/>
      <rect x="258" y="204" width="12" height="12" fill="#fbf1f1"/>
      <rect x="270" y="204" width="12" height="12" fill="#b06a6a"/>
      <text x="258" y="230" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#9b2c2c">学出「看自己」</text>
      <rect x="336" y="116" width="136" height="132" fill="#fbf8f2" stroke="#8a6a1e" stroke-width="1.1"/>
      <text x="346" y="134" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#8a6a1e">头 3</text>
      <rect x="344" y="142" width="36" height="14" fill="#fdf6e8" stroke="#e8cf9e" stroke-width="0.8"/>
      <text x="362" y="152" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.4" fill="#8a6a1e">Wq</text>
      <rect x="386" y="142" width="36" height="14" fill="#fdf6e8" stroke="#e8cf9e" stroke-width="0.8"/>
      <text x="404" y="152" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.4" fill="#8a6a1e">Wk</text>
      <rect x="428" y="142" width="36" height="14" fill="#fdf6e8" stroke="#e8cf9e" stroke-width="0.8"/>
      <text x="446" y="152" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.4" fill="#8a6a1e">Wv</text>
      <rect x="380" y="168" width="12" height="12" fill="#c9a961"/>
      <rect x="392" y="168" width="12" height="12" fill="#fdf6e8"/>
      <rect x="404" y="168" width="12" height="12" fill="#fdf6e8"/>
      <rect x="416" y="168" width="12" height="12" fill="#fdf6e8"/>
      <rect x="380" y="180" width="12" height="12" fill="#c9a961"/>
      <rect x="392" y="180" width="12" height="12" fill="#fdf6e8"/>
      <rect x="404" y="180" width="12" height="12" fill="#fdf6e8"/>
      <rect x="416" y="180" width="12" height="12" fill="#fdf6e8"/>
      <rect x="380" y="192" width="12" height="12" fill="#c9a961"/>
      <rect x="392" y="192" width="12" height="12" fill="#fdf6e8"/>
      <rect x="404" y="192" width="12" height="12" fill="#fdf6e8"/>
      <rect x="416" y="192" width="12" height="12" fill="#fdf6e8"/>
      <rect x="380" y="204" width="12" height="12" fill="#c9a961"/>
      <rect x="392" y="204" width="12" height="12" fill="#fdf6e8"/>
      <rect x="404" y="204" width="12" height="12" fill="#fdf6e8"/>
      <rect x="416" y="204" width="12" height="12" fill="#fdf6e8"/>
      <text x="404" y="230" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#8a6a1e">学出「盯开头」</text>
      <rect x="482" y="116" width="136" height="132" fill="#fbf8f2" stroke="#2c4a7c" stroke-width="1.1"/>
      <text x="492" y="134" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#2c4a7c">头 4</text>
      <rect x="490" y="142" width="36" height="14" fill="#eaf1fa" stroke="#b9cde8" stroke-width="0.8"/>
      <text x="508" y="152" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.4" fill="#2c4a7c">Wq</text>
      <rect x="532" y="142" width="36" height="14" fill="#eaf1fa" stroke="#b9cde8" stroke-width="0.8"/>
      <text x="550" y="152" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.4" fill="#2c4a7c">Wk</text>
      <rect x="574" y="142" width="36" height="14" fill="#eaf1fa" stroke="#b9cde8" stroke-width="0.8"/>
      <text x="592" y="152" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.4" fill="#2c4a7c">Wv</text>
      <rect x="526" y="168" width="12" height="12" fill="#8aa8cc"/>
      <rect x="538" y="168" width="12" height="12" fill="#b9cde8"/>
      <rect x="550" y="168" width="12" height="12" fill="#b9cde8"/>
      <rect x="562" y="168" width="12" height="12" fill="#b9cde8"/>
      <rect x="526" y="180" width="12" height="12" fill="#b9cde8"/>
      <rect x="538" y="180" width="12" height="12" fill="#8aa8cc"/>
      <rect x="550" y="180" width="12" height="12" fill="#b9cde8"/>
      <rect x="562" y="180" width="12" height="12" fill="#b9cde8"/>
      <rect x="526" y="192" width="12" height="12" fill="#b9cde8"/>
      <rect x="538" y="192" width="12" height="12" fill="#b9cde8"/>
      <rect x="550" y="192" width="12" height="12" fill="#8aa8cc"/>
      <rect x="562" y="192" width="12" height="12" fill="#b9cde8"/>
      <rect x="526" y="204" width="12" height="12" fill="#b9cde8"/>
      <rect x="538" y="204" width="12" height="12" fill="#b9cde8"/>
      <rect x="550" y="204" width="12" height="12" fill="#b9cde8"/>
      <rect x="562" y="204" width="12" height="12" fill="#8aa8cc"/>
      <text x="550" y="230" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#2c4a7c">学出「看全体」</text>
      <line x1="112" y1="250" x2="112" y2="268" stroke="#2f6157" stroke-width="1.2" marker-end="url(#ar6t)"/>
      <line x1="258" y1="250" x2="258" y2="268" stroke="#9b2c2c" stroke-width="1.2" marker-end="url(#ar6r)"/>
      <line x1="404" y1="250" x2="404" y2="268" stroke="#8a6a1e" stroke-width="1.2" marker-end="url(#ar6g)"/>
      <line x1="550" y1="250" x2="550" y2="268" stroke="#2c4a7c" stroke-width="1.2" marker-end="url(#ar6b)"/>
      <rect x="44" y="272" width="34" height="18" fill="#b3d6cc"/>
      <rect x="78" y="272" width="34" height="18" fill="#d9ebe6"/>
      <rect x="112" y="272" width="34" height="18" fill="#eaf4f1"/>
      <rect x="146" y="272" width="34" height="18" fill="#b3d6cc"/>
      <rect x="190" y="272" width="34" height="18" fill="#cf9a9a"/>
      <rect x="224" y="272" width="34" height="18" fill="#f6e7e7"/>
      <rect x="258" y="272" width="34" height="18" fill="#e7c3c3"/>
      <rect x="292" y="272" width="34" height="18" fill="#f6e7e7"/>
      <rect x="336" y="272" width="34" height="18" fill="#e8cf9e"/>
      <rect x="370" y="272" width="34" height="18" fill="#f7e6c8"/>
      <rect x="404" y="272" width="34" height="18" fill="#fbf3e4"/>
      <rect x="438" y="272" width="34" height="18" fill="#f7e6c8"/>
      <rect x="482" y="272" width="34" height="18" fill="#b9cde8"/>
      <rect x="516" y="272" width="34" height="18" fill="#eaf1fa"/>
      <rect x="550" y="272" width="34" height="18" fill="#dce7f5"/>
      <rect x="584" y="272" width="34" height="18" fill="#eaf1fa"/>
      <text x="44" y="308" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">沿维度拼接回 [n, d]，再过一次输出投影 W_O —— 各头的信息到这里才真正混到一起</text>
      <text x="16" y="336" font-family="ui-monospace, monospace" font-size="9.6" fill="#2f6157">① 算力几乎不变：每个头只管 d/h 维，h 个头加起来仍是 O(n²d)</text>
      <text x="16" y="356" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">② 形状只多一阶：[n, d] → [h, n, d/h] → [n, d]（实现上常写成一次大矩阵乘再 reshape）</text>
      <text x="16" y="376" font-family="ui-monospace, monospace" font-size="9.6" fill="#9b2c2c">③ 代价：每个头只看得到 d/h 维，视野更窄 —— 所以最后要用 W_O 把各头重新融合</text>
    </svg>
  </div>
  <figcaption><b>图 6</b>　四张注意力表<b>都画成同样大小的方格</b>，但深色格子的位置完全不同——这就是「多头」真正花力气的地方。同一个词，头 1 在找出现在它前面的词，头 2 主要看它自己，头 3 一直盯着句首，头 4 则把注意力摊开给全体。<b>一套注意力只能表达一种「关注方式」，h 个头就是 h 种。注意最上面和最下面那两行红蓝黄绿的格子仍然一模一样：输入没被复制，只是被切开了。</b></figcaption>
</figure>

### 3.6 因果掩码：为什么 decoder 只能看左边

生成式模型有一个硬约束：**预测第 i 个 token 时，不能看到第 i+1 个及以后的内容**，否则等于抄答案。

[[causal-mask|因果掩码]] 就是实现这个约束的手段：在送进 softmax 之前，把注意力矩阵里「未来位置」那些格子填成负无穷。负无穷过 softmax 之后变成 0，权重就落不到未来位置上了。

- **输入**：`[n, n]` 缩放后分数；
- **输出**：`[n, n]`，其中上三角（未来部分）全被压成 0。

这一步看着简单，但它是一个**大前提**：有了它，每个位置的计算只依赖它左边的历史。下一章要讲的 KV Cache，整个立足点就在这里——**前缀算过一次就不用再算**。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 330" role="img" aria-label="因果掩码：分数矩阵的上三角被填成负无穷，softmax 之后这些格子变成 0，每行只剩左侧若干个有权重的格子">
      <defs>
        <marker id="ar7" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#2f6157"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">因果掩码：把「未来」的格子先填成 −∞，softmax 之后自然变成 0</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">第 i 个位置只能看 j ≤ i 的格子 —— 这一步是「增量推理 / KV Cache」能成立的前提</text>
      <text x="44" y="66" font-family="ui-monospace, monospace" font-size="9.8" font-weight="700" fill="#1f1b16">① 送进 softmax 前的分数　[n, n]</text>
      <text x="298" y="66" font-family="ui-monospace, monospace" font-size="9.8" font-weight="700" fill="#1f1b16">② softmax 之后的权重　[n, n]</text>
      <rect x="44" y="74" width="26" height="26" fill="#e8cf9e"/>
      <text x="57" y="91" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#6b6257">1.4</text>
      <rect x="70" y="74" width="26" height="26" fill="#ded4c4"/>
      <text x="83" y="91" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#5b6472">−∞</text>
      <rect x="96" y="74" width="26" height="26" fill="#ded4c4"/>
      <text x="109" y="91" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#5b6472">−∞</text>
      <rect x="122" y="74" width="26" height="26" fill="#ded4c4"/>
      <text x="135" y="91" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#5b6472">−∞</text>
      <rect x="148" y="74" width="26" height="26" fill="#ded4c4"/>
      <text x="161" y="91" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#5b6472">−∞</text>
      <rect x="44" y="100" width="26" height="26" fill="#fbf3e4"/>
      <text x="57" y="117" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#6b6257">0.9</text>
      <rect x="70" y="100" width="26" height="26" fill="#e8cf9e"/>
      <text x="83" y="117" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#6b6257">1.1</text>
      <rect x="96" y="100" width="26" height="26" fill="#ded4c4"/>
      <text x="109" y="117" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#5b6472">−∞</text>
      <rect x="122" y="100" width="26" height="26" fill="#ded4c4"/>
      <text x="135" y="117" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#5b6472">−∞</text>
      <rect x="148" y="100" width="26" height="26" fill="#ded4c4"/>
      <text x="161" y="117" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#5b6472">−∞</text>
      <rect x="44" y="126" width="26" height="26" fill="#fbf3e4"/>
      <text x="57" y="143" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#6b6257">0.6</text>
      <rect x="70" y="126" width="26" height="26" fill="#fbf3e4"/>
      <text x="83" y="143" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#6b6257">1.7</text>
      <rect x="96" y="126" width="26" height="26" fill="#e8cf9e"/>
      <text x="109" y="143" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#6b6257">1.3</text>
      <rect x="122" y="126" width="26" height="26" fill="#ded4c4"/>
      <text x="135" y="143" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#5b6472">−∞</text>
      <rect x="148" y="126" width="26" height="26" fill="#ded4c4"/>
      <text x="161" y="143" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#5b6472">−∞</text>
      <rect x="44" y="152" width="26" height="26" fill="#fbf3e4"/>
      <text x="57" y="169" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#6b6257">1.1</text>
      <rect x="70" y="152" width="26" height="26" fill="#fbf3e4"/>
      <text x="83" y="169" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#6b6257">0.4</text>
      <rect x="96" y="152" width="26" height="26" fill="#fbf3e4"/>
      <text x="109" y="169" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#6b6257">0.8</text>
      <rect x="122" y="152" width="26" height="26" fill="#e8cf9e"/>
      <text x="135" y="169" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#6b6257">1.5</text>
      <rect x="148" y="152" width="26" height="26" fill="#ded4c4"/>
      <text x="161" y="169" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#5b6472">−∞</text>
      <rect x="44" y="178" width="26" height="26" fill="#fbf3e4"/>
      <text x="57" y="195" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#6b6257">0.7</text>
      <rect x="70" y="178" width="26" height="26" fill="#fbf3e4"/>
      <text x="83" y="195" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#6b6257">1.2</text>
      <rect x="96" y="178" width="26" height="26" fill="#fbf3e4"/>
      <text x="109" y="195" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#6b6257">0.9</text>
      <rect x="122" y="178" width="26" height="26" fill="#fbf3e4"/>
      <text x="135" y="195" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#6b6257">1.6</text>
      <rect x="148" y="178" width="26" height="26" fill="#e8cf9e"/>
      <text x="161" y="195" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.8" fill="#6b6257">1.0</text>
      <line x1="184" y1="139" x2="292" y2="139" stroke="#2f6157" stroke-width="1.4" marker-end="url(#ar7)"/>
      <text x="238" y="126" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" font-weight="700" fill="#9b2c2c">＋ 掩码 M</text>
      <text x="238" y="160" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">上三角全填 −∞</text>
      <rect x="298" y="74" width="26" height="26" fill="#a9ccc3"/>
      <text x="311" y="91" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#2f6157">1.00</text>
      <rect x="324" y="74" width="26" height="26" fill="#f2ebdf"/>
      <text x="337" y="91" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#a49a8c">0</text>
      <rect x="350" y="74" width="26" height="26" fill="#f2ebdf"/>
      <text x="363" y="91" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#a49a8c">0</text>
      <rect x="376" y="74" width="26" height="26" fill="#f2ebdf"/>
      <text x="389" y="91" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#a49a8c">0</text>
      <rect x="402" y="74" width="26" height="26" fill="#f2ebdf"/>
      <text x="415" y="91" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#a49a8c">0</text>
      <rect x="298" y="100" width="26" height="26" fill="#eaf4f1"/>
      <text x="311" y="117" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#2f6157">0.45</text>
      <rect x="324" y="100" width="26" height="26" fill="#a9ccc3"/>
      <text x="337" y="117" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#2f6157">0.55</text>
      <rect x="350" y="100" width="26" height="26" fill="#f2ebdf"/>
      <text x="363" y="117" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#a49a8c">0</text>
      <rect x="376" y="100" width="26" height="26" fill="#f2ebdf"/>
      <text x="389" y="117" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#a49a8c">0</text>
      <rect x="402" y="100" width="26" height="26" fill="#f2ebdf"/>
      <text x="415" y="117" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#a49a8c">0</text>
      <rect x="298" y="126" width="26" height="26" fill="#eaf4f1"/>
      <text x="311" y="143" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#2f6157">0.20</text>
      <rect x="324" y="126" width="26" height="26" fill="#c3ddd6"/>
      <text x="337" y="143" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#2f6157">0.55</text>
      <rect x="350" y="126" width="26" height="26" fill="#a9ccc3"/>
      <text x="363" y="143" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#2f6157">0.25</text>
      <rect x="376" y="126" width="26" height="26" fill="#f2ebdf"/>
      <text x="389" y="143" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#a49a8c">0</text>
      <rect x="402" y="126" width="26" height="26" fill="#f2ebdf"/>
      <text x="415" y="143" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#a49a8c">0</text>
      <rect x="298" y="152" width="26" height="26" fill="#eaf4f1"/>
      <text x="311" y="169" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#2f6157">0.30</text>
      <rect x="324" y="152" width="26" height="26" fill="#eaf4f1"/>
      <text x="337" y="169" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#2f6157">0.10</text>
      <rect x="350" y="152" width="26" height="26" fill="#c3ddd6"/>
      <text x="363" y="169" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#2f6157">0.20</text>
      <rect x="376" y="152" width="26" height="26" fill="#a9ccc3"/>
      <text x="389" y="169" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#2f6157">0.40</text>
      <rect x="402" y="152" width="26" height="26" fill="#f2ebdf"/>
      <text x="415" y="169" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#a49a8c">0</text>
      <rect x="298" y="178" width="26" height="26" fill="#eaf4f1"/>
      <text x="311" y="195" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#2f6157">0.15</text>
      <rect x="324" y="178" width="26" height="26" fill="#eaf4f1"/>
      <text x="337" y="195" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#2f6157">0.25</text>
      <rect x="350" y="178" width="26" height="26" fill="#eaf4f1"/>
      <text x="363" y="195" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#2f6157">0.20</text>
      <rect x="376" y="178" width="26" height="26" fill="#c3ddd6"/>
      <text x="389" y="195" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#2f6157">0.30</text>
      <rect x="402" y="178" width="26" height="26" fill="#a9ccc3"/>
      <text x="415" y="195" text-anchor="middle" font-family="ui-monospace, monospace" font-size="7.4" fill="#2f6157">0.10</text>
      <text x="444" y="92" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">每行只有左侧 i+1 格有值，</text>
      <text x="444" y="110" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">其余格是 0，权重分不过去。</text>
      <text x="444" y="134" font-family="ui-monospace, monospace" font-size="9.2" fill="#2f6157">→ 第 i 个位置只看得到 1…i</text>
      <text x="444" y="152" font-family="ui-monospace, monospace" font-size="9.2" fill="#2f6157">→ 未来位置永远不会被看到</text>
      <text x="444" y="180" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">顺带的好处：训练时 n 个位置</text>
      <text x="444" y="198" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">可以并行算完，不用排队</text>
      <text x="16" y="228" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">金色格子的深浅只是「自己看自己」的标记，阴影格子就是「未来」：先填 −∞ 再做 softmax，指数化后直接变 0 —— 不用写 if</text>
      <text x="16" y="248" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">注意右边每行的和都恰好是 1：被掩掉的位置不是「跳过」，而是以 0 权重的身份参与，所以输出的形状一步都没变</text>
      <text x="16" y="274" font-family="ui-monospace, monospace" font-size="9.6" fill="#9b2c2c">⚠ 顺序不能反：掩码必须加在 softmax 之前 —— 先掩码再归一化，被掩位置才恰好占 0 权重；若先 softmax 再抹零，</text>
      <text x="16" y="292" font-family="ui-monospace, monospace" font-size="9.6" fill="#9b2c2c">　每行的和就不再是 1，等于把注意力凭空丢掉了。</text>
      <text x="16" y="316" font-family="ui-monospace, monospace" font-size="9.6" fill="#2f6157">▸ 因果掩码是「只能看左边」的实现手段；而「左边算过就不用重算」，正是下一章 KV Cache 的立足点。</text>
    </svg>
  </div>
  <figcaption><b>图 7</b>　这张图值得记住的地方有两个。<b>第一</b>：掩码加在 softmax <b>之前</b>，所以未来位置是「−∞ → 权重 0」，而不是「事后删掉」——右边矩阵每行的和照样是 1，形状和流程一个字都没改。<b>第二</b>：右边矩阵的<b>上三角整块是 0</b>，这个「下三角」形状就是因果性的形状；下一章的 KV Cache，全部的道理就是这张下三角矩阵里「同一列被反复用到」。</figcaption>
</figure>

## 四、n² 究竟出在哪一步

### 4.1 把每一步的形状与复杂度摊开

把每一步的复杂度列出来，问题就一目了然了。这里用到大 O 记号（[[big-o]]）——它只关心「随 n 增长的量级」，不关心常数。

<div class="tbl-wrap">
  <table class="news">
    <thead>
      <tr><th>阶段</th><th>做的事</th><th>张量形状</th><th>计算量级</th><th>随 n 的增长</th></tr>
    </thead>
    <tbody>
      <tr><td>投影</td><td><code>X·W_q/k/v</code></td><td>[n, d] → [n, d]</td><td>O(n · d²)</td><td>线性</td></tr>
      <tr><td>打分</td><td><code>Q·Kᵀ</code></td><td>[n, d] × [d, n] → <b>[n, n]</b></td><td>O(n² · d)</td><td><b>平方</b></td></tr>
      <tr><td>缩放</td><td>除以 √d</td><td>[n, n]</td><td>O(n²)</td><td><b>平方</b></td></tr>
      <tr><td>softmax</td><td>按行归一化</td><td>[n, n]</td><td>O(n²)</td><td><b>平方</b></td></tr>
      <tr><td>聚合</td><td><code>A·V</code></td><td>[n, n] × [n, d] → [n, d]</td><td>O(n² · d)</td><td><b>平方</b></td></tr>
      <tr><td>前馈网络</td><td>逐位置 MLP</td><td>[n, d] → [n, d]</td><td>O(n · d²)</td><td>线性</td></tr>
    </tbody>
  </table>
</div>

结论就一句话：**平方项只来自「任意两个位置都要互相看一眼」这件事**，也就是打分、缩放、softmax、聚合这四步。剩下的一切都是逐位置做的：

- **投影**：每个位置各自乘自己的矩阵，位置之间互不影响，线性；
- **前馈网络（[[ffn]]）**：同样是逐位置的一小段 MLP，线性。

这也解释了为什么 FFN 明明占了模型大部分参数，却从来不是长上下文的主要瓶颈——<strong>它的开销随 n 线性增长，而注意力是平方。</strong>n 小的时候感觉不出来，n 一大就彻底颠倒。

### 4.2 一个必须记住的数量级直觉

<div class="box box-key">
  <span class="box-title">一个必须记住的数量级直觉</span>
  <p>设 d = 4096，n = 8,000（大约 3 万汉字或 6,000 行代码）：</p>
  <ul>
    <li>线性项的量级约 <code>n·d² ≈ 1.34×10¹¹</code>；</li>
    <li>平方项的量级约 <code>n²·d ≈ 2.6×10¹¹</code>。</li>
  </ul>
  <p>此时两者还在同一数量级——这就是「中等长度上下文时，注意力还不是绝对瓶颈」的原因。但只要 n 再翻一倍，平方项就翻四倍，线性项只翻两倍。<b>拐点大约出现在 n 与 d 可比的时候；一旦 n 远超 d，平方项就彻底主导成本。</b></p>
  <p>反过来读这条结论也成立：<b>当 n 还小于 d 时，花大力气优化注意力收益有限，先把上下文塞满反而是划算的。</b>判断「该不该优化」比「怎么优化」更重要。</p>
</div>

## 五、这对做 Agent 意味着什么

把上面的结论翻译成工程语言，会得到三条非常硬的推论。

### 5.1 成本不是线性的，「多塞点上下文」是高息负债

往上下文里加一倍内容，注意力部分的代价接近四倍。这解释了为什么长上下文模型的 API 定价通常按阶梯上涨，而不是线性——**定价模型跟着物理规律走**。

反过来说，这也给了一个判断标准：如果你发现某次调用的成本远超预期，先去看输入 token 数（n），而不是去怀疑模型供应商乱收费。

### 5.2 裁剪与压缩不是优化，而是必备能力

如果你的 Harness 只会「一直追加消息」，那你实际上是在让成本按平方增长。上下文压缩、状态外置、历史摘要这三件事，是 Harness 的基本功而不是加分项。

它们各自对应一条减少 n 的路径：

- **摘要**：把旧的多轮内容压成一段，直接减少 n；
- **状态外置**：把不必要的内容移到外部存储，需要时再取，让 n 保持小而稳定；
- **检索**：只把相关内容塞进 [[context-window|上下文窗口]]，而不是全塞。

注意这三条路线都在动 n——没有一条在动 d。这与第二节点出的结论一致：**d 出厂固定，n 才是你的操作杆。**

### 5.3 首 token 延迟与后续 token 延迟是两笔账

处理输入（[[prefill-decode|Prefill]]）要跑完整个 `[n, n]`；生成每个 token（Decode）只走一步，但需要读缓存（[[kv-cache|KV Cache]]）。

这两个阶段的瓶颈不同：<strong>前者是算力受限，后者是显存带宽受限。</strong>所以「优化延迟」这句话是不完整的——你必须先问清是哪一段延迟。这直接决定了优化手段：加算力对 Prefill 有效，对 Decode 基本没用；而 Decode 的优化要靠减少每步要读的数据量。

这是下一章的主题。这里先记住结论的形式：**当你听到一个优化方案时，先问它优化的是 Prefill 还是 Decode——分不清这两者的方案，通常两边都不讨好。**

<p class="pull-quote">把 n² 记住，你就不需要背任何「长上下文为什么要小心」的结论了——那些结论全都是它的推论。<cite>本刊编辑部</cite></p>

## 六、动手：三十行手写一遍注意力

### 6.1 把图 1 写成代码

不写一遍就容易把形状记混。下面这段 NumPy 代码把图 1 完整实现了一遍——重点不是算法，而是**每一行注释里标注的形状**。请对照着代码读一遍，确认每一步的形状变化和第三节讲的一致。

```python title="scaled_dot_product_attention.py"
import numpy as np
def softmax(x, axis=-1):
    m = x.max(axis=axis, keepdims=True)      # 数值稳定：先减去最大值
    e = np.exp(x - m)
    return e / e.sum(axis=axis, keepdims=True)
def attention(X, Wq, Wk, Wv):
    """X: [n, d]  三个权重: [d, d]"""
    Q = X @ Wq          # [n, d]  我想找什么
    K = X @ Wk          # [n, d]  我能被什么找到
    V = X @ Wv          # [n, d]  我携带什么
    d = Q.shape[-1]
    S = Q @ K.T         # [n, n]  ← 平方复杂度的来源
    S = S / np.sqrt(d)  # 缩放，防止 softmax 进入饱和区
    A = softmax(S)      # [n, n]  每行和为 1
    return A @ V        # [n, d]  回到原形状
n, d = 5, 8
rng = np.random.default_rng(0)
X  = rng.normal(size=(n, d))
Wq = rng.normal(size=(d, d)) / np.sqrt(d)
Wk = rng.normal(size=(d, d)) / np.sqrt(d)
Wv = rng.normal(size=(d, d)) / np.sqrt(d)
out = attention(X, Wq, Wk, Wv)
print(out.shape)          # (5, 8) —— 形状与输入一致，这是所有注意力变体的共同特征
# 顺手验证因果掩码（decoder 只能看左边）
mask = np.triu(np.ones((n, n)), k=1).astype(bool)
print(mask.astype(int))
```

### 6.2 实操任务（建议 20 分钟）

<div class="box box-practice">
  <span class="box-title">动手三件事</span>
  <ul>
    <li>把 <code>n</code> 从 5 改到 2000，测量 <code>S = Q @ K.T</code> 与 <code>X @ Wq</code> 的耗时比例，亲手看到平方项吃掉时间；</li>
    <li>把 <code>mask</code> 加进 <code>S</code>（被 mask 的位置填 <code>-inf</code>），再做 softmax，确认第一行只依赖第一个 token；</li>
    <li>回答自己一个问题：如果我想让「第 500 个 token 只关注最近 100 个 token」（滑窗注意力），代码要改哪一行？改完之后，中间那个矩阵还是 <code>[n, n]</code> 吗？</li>
  </ul>
</div>

## 七、常见误区与追问

这一节收的是「看起来懂了、一被追问就露馅」的几个地方。它们的共同点不是难，而是**中文技术叙述里长期流传的错误类比**。

### 7.1 把「参数量」和「序列长度」当成同一条轴上的两件事

错在哪：说「这个模型很大所以很贵」，或者反过来，用参数量去解释「为什么上下文变长会变贵」。为什么自然：日常经验里「东西大就贵」几乎总成立，而大模型的「大」字被滥用了。正确做法：这是**两条正交的轴**。<b>参数量 d 决定显存下限与单 token 的算力</b>，出厂固定、你改不了；<b>序列长度 n 决定算力与显存的增长速度</b>，是你唯一能直接控制的变量。判据：一个 7B 模型喂 128k 上下文的注意力开销，可以远超一个 70B 模型喂 2k 的开销 —— 因为前者是 O(n²·d)，n 在平方项里，后者只是使 d 变大。

### 7.2 以为注意力矩阵的显存和 KV Cache 是同一个量级

错在哪：把「长上下文吃显存」笼统归给注意力矩阵。为什么自然：都是「长上下文变贵」，很容易当成一件事。正确做法：分清两个不同的东西。<b>注意力矩阵是 [n, n]，是算力侧的中间结果</b>，FlashAttention 的思路就是「算完即弃、不显式存下来」；<b>KV Cache 是 [n, d] 每层两份，是推理必留的状态</b>，随 n 线性增长，省不掉。判据：n=8,000 时注意力矩阵单精度约 256 MB（可优化掉），而 80 层的 KV Cache 是 GiB 量级（必须预算）。面试里把这两笔账分开算，是分水岭。

### 7.3 以为「投影会改变形状」

错在哪：把 Q/K/V 三步当成「把输入变换成三种不同形状」。为什么自然：符号上 X → Q 看着就像变了个东西。正确做法：<b>投影只换坐标，不改形状</b>。X 是 [n, d]，W_q 是 [d, d]，Q 还是 [n, d] —— 三个都是 [n, d]，差别只在「用什么坐标系描述」。真正**改变形状、并制造出 n²** 的是下一步打分：Q·Kᵀ 把 [n, d] 变成了 [n, n]。判据：如果哪天你看到一个注意力变体把形状写错了，八成是把「投影」和「打分」混在一起了。

### 7.4 以为「头数越多越好」

错在哪：把多头理解成「多几个模型一起投票」。为什么自然：「多个视角」听起来总是更强。正确做法：头的本质是**把 d 维切成 h 份并行**，d = h × head_dim。<b>好处是可以同时维持多种关注方式（位置邻近、指代、句法）</b>；<b>代价是每个头的表达能力被稀释，而且注意力矩阵的数量随头数成倍增加</b>。判据：现代模型头数多在 32–128 之间，是实验调出来的，不是越大越好；同时要记住所有头共享同一层的输入，它们不是独立模型。

### 7.5 把注意力权重视为「模型给出的解释」

错在哪：看到某次注意力把 0.7 分给了某个词，就说「模型这样判断是因为它注意到了这个词」。为什么自然：权重看起来就是一张「谁重要」的名单，很像解释。正确做法：注意力权重是**线索，不是证明**。它只说明这一层、这个头、这个样本上的分配；不同层不同头的权重往往互相矛盾，而后续的 FFN 完全可以在权重之外改变结论。<b>把它当作排查工具（找注意力涣散、找异常聚焦）是合理的，当作因果解释就不成立。</b>

## 八、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>答错的题建议加入复习队列</span></div>
  <div class="q-item" data-qid="llm01-q1" data-answer="1">
    <div class="q-text"><span class="idx">Q1</span>注意力里随序列长度平方增长的是哪一部分？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>Q、K、V 的线性投影</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>每两个位置之间的相关度打分，以及用权重聚合 V</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>前馈网络（FFN）</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>词嵌入查表</span></button>
    <div class="explain"><b>B。</b>投影与 FFN 都是逐位置计算的，复杂度 O(n·d²)，随 n 线性。只有当两个位置必须互相比较时（<code>QKᵀ</code> 产生 <code>[n, n]</code>），才出现平方项。记住这个区分，就能判断任何「优化长上下文」的技术到底在优化什么。</div>
  </div>
  <div class="q-item" data-qid="llm01-q2" data-answer="2">
    <div class="q-text"><span class="idx">Q2</span>如果把上下文长度从 8k 提到 32k，注意力部分的算力大约变成原来的几倍？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>4 倍</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>8 倍</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>16 倍</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>不到 2 倍，主要是显存变多</span></button>
    <div class="explain"><b>C。</b>n 变成 4 倍，n² 变成 16 倍。这正是「长上下文很贵」的物理来源，也是阶梯定价的合理性所在。注意这是注意力部分的量级，端到端延迟还受 KV Cache 读写带宽影响，实际倍率不一定正好是 16 倍，但量级关系成立。</div>
  </div>
  <div class="q-item" data-qid="llm01-q3" data-answer="1">
    <div class="q-text"><span class="idx">Q3</span>位置编码如果不加，模型会出什么问题？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>显存占用会翻倍</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>注意力是置换等变的，模型无法区分语序，「猫追狗」和「狗追猫」表示相同</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>softmax 会数值溢出</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>无法处理超过 512 个 token 的输入</span></button>
    <div class="explain"><b>B。</b>注意力本身对输入顺序不敏感——打乱输入，输出只会跟着打乱，模型没有任何机制知道谁在前谁在后。位置编码（现在主流是 RoPE 这类相对位置方案）把顺序信息注入表示。<b>顺带的推论是：相对位置方案让模型对超出训练长度的位置有一定外推能力，但「把窗口调大」不等于「模型真的能用好长窗口」</b>——这是长上下文必须单独评测的原因。</div>
  </div>
</div>

## 九、小结：把这一章压成四句话

1. **数据是张量，形状是 `[n, d]`。** [[tensor|张量]]只是「数 + 排列方式」，[[shape|形状]]是它最省力的正确性检查。n 是 token 数，d 是出厂固定的隐藏维度——**你能控制的是 n。**
2. **注意力的三步是投影、打分、聚合。** [[projection|投影]]把同一份输入翻译成 [[query-key-value|Q / K / V]] 三种问法；[[scoring|打分]]让每个位置和所有位置互相看一眼；[[weighted-sum|加权求和]]把结果聚合回 `[n, d]`。
3. **平方项只出在「两两比较」上。** 中间那个 [[attention-matrix|注意力矩阵]]是 `[n, n]`，它是唯一一个两维都被 n 撑大的东西。[[ffn|前馈网络]]和投影都是逐位置的，线性。
4. **两条工程推论**：n 越大成本越贵，所以压缩、外置、检索是基本功；[[prefill-decode|Prefill 和 Decode]] 瓶颈不同，所以「优化延迟」必须说清是哪一段——这是下一章 [[kv-cache|KV Cache]] 的起点。

下一章我们把这个 n² 换个角度再看一次：既然前缀会被反复重算，那能不能缓存？能，但缓存命中与否取决于一个你平时根本不会注意到的东西——前缀稳定性。

## 十、参考与延伸

本章的机制部分只讲到「够用」为止。想往下深挖，下面这几份材料按「先看图、再看代码、最后读论文」的顺序排好了。全站不做原文转载，这里只登记链接与「为什么值得读」。

**先看图（建立直觉）**

- [The Illustrated Transformer](https://jalammar.github.io/illustrated-transformer/) —— 用动画式的静态图把 Q/K/V、多头、位置编码全画了一遍。<strong>读本章第三节卡住时，来这儿看图解最快。</strong>它的图比任何公式都更容易建立「形状在流动」的感觉。
- [3Blue1Brown · Attention in transformers, visually explained](https://www.3blue1brown.com/lessons/attention) —— 把注意力讲成「向量之间互相传递信息」的几何过程。**如果你对「点积为什么表示相关度」没有直觉，看这一集，它是目前最好的可视化解释。**

**再看代码（动手实现）**

- [Andrej Karpathy · Let's build GPT: from scratch](https://karpathy.ai/zero-to-hero.html) —— 从零手写一个小 GPT，视频 + 代码逐行对照。**本章第六节那三十行 NumPy 是它的极简版**；想真正把形状记牢，就跟着把这一课敲完。
- [PyTorch · `scaled_dot_product_attention` 文档](https://pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html) —— 生产实现长什么样，一眼就能看到 attn_mask、is_causal 这些参数。**想确认「工业实现和教科书版本差在哪」，看它的参数表最快。**

**最后读论文（对齐一手定义）**

- [Attention Is All You Need（arXiv:1706.03762）](https://arxiv.org/abs/1706.03762) —— 一切的一手来源。**建议只精读第 3.2 节（Scaled Dot-Product Attention）与 3.5 节（Positional Encoding）**，其余部分与本岗位关系不大。
- [Lilian Weng · The Transformer Family v2.0](https://lilianweng.github.io/posts/2023-01-27-the-transformer-family-v2/) —— 把注意力的各种变体（稀疏、线性、FlashAttention）按「改了什么」整理成了一张谱系图。**想理解「长上下文优化都有哪几条路」，读这一篇的目录结构就够了。**
- [RoFormer / RoPE（arXiv:2104.09864）](https://arxiv.org/abs/2104.09864) —— 现在主流的位置编码方案。<strong>只需要看它怎么把「绝对位置」换成「相对旋转」那一段。</strong>理解这一点，才能听懂「为什么扩窗口需要额外训练」。
