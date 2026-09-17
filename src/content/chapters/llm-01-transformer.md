---
chapter: llm-01-transformer
lead: 'Agent 的一切都跑在注意力机制之上。这一章只做一件事：让你能在白板上画出从 token 到注意力矩阵的形状变化，并说清复杂度里那个 n² 究竟从哪来——因为后面每一章的成本、延迟、上下文策略，都是这个 n² 的推论。'
note: '本章不推导公式，只走一遍数据形状。读完后请合上文章，自己在纸上画一遍 Q/K/V 的维度。'
---

<p class="dropcap">如果要给「Harness 工程师为什么要懂模型原理」找一个最实际的理由，那就是：你所有的取舍最后都会被这三个物理事实定死——注意力是平方复杂度的、KV Cache 是按前缀命中的、输出是采样出来的。这一章讲第一个。</p>

## 一、为什么一个做工程的人要关心注意力

面试里被问到「Transformer 原理」，很多人以为考官在考古。其实不是。考官真正想问的是：

- 你知不知道上下文变长，成本是怎么长的？
- 你知不知道「把整个代码库塞进上下文」这条路会在哪一步崩掉？
- 你知不知道长任务的瓶颈到底在算力、显存，还是在带宽？

这三个问题都从自注意力出发。**凡是能用 n² 解释清楚的现象，都不该用「模型能力不够」来解释。**

## 二、一次前向到底做了什么

先不碰公式，只跟踪张量的形状。设一批输入是 n 个 token，每个 token 进模型后被映射成一个 d 维向量（例如 d=4096）。

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

## 三、n² 究竟出在哪一步

把每一步的复杂度摊开看，问题一目了然。

<div class="tbl-wrap">
  <table class="news">
    <thead>
      <tr><th>阶段</th><th>做的事</th><th>张量形状</th><th>计算量级</th><th>随 n 的增长</th></tr>
    </thead>
    <tbody>
      <tr><td>投影</td><td><code>X·W_q/k/v</code></td><td>[n, d] → [n, d]</td><td>O(n · d²)</td><td>线性</td></tr>
      <tr><td>打分</td><td><code>Q·Kᵀ</code></td><td>[n, d] × [d, n] → <b>[n, n]</b></td><td>O(n² · d)</td><td><b>平方</b></td></tr>
      <tr><td>softmax</td><td>按行归一化</td><td>[n, n]</td><td>O(n²)</td><td><b>平方</b></td></tr>
      <tr><td>聚合</td><td><code>A·V</code></td><td>[n, n] × [n, d] → [n, d]</td><td>O(n² · d)</td><td><b>平方</b></td></tr>
      <tr><td>前馈网络</td><td>逐位置 MLP</td><td>[n, d] → [n, d]</td><td>O(n · d²)</td><td>线性</td></tr>
    </tbody>
  </table>
</div>

结论：**平方项只来自「任意两个位置都要互相看一眼」这件事**，也就是那两步 `QKᵀ` 和 `AV`。剩下的一切（嵌入、投影、FFN）都是逐位置的，随 n 线性增长。

<div class="box box-key">
  <span class="box-title">一个必须记住的数量级直觉</span>
  <p>设 d = 4096，n = 8,000（大约 3 万汉字或 6,000 行代码）：</p>
  <ul>
    <li>线性项的量级约 <code>n·d² ≈ 1.34×10¹¹</code>；</li>
    <li>平方项的量级约 <code>n²·d ≈ 2.6×10¹¹</code>。</li>
  </ul>
  <p>此时两者还在同一数量级——这就是「中等长度上下文时，注意力还不是绝对瓶颈」的原因。但只要 n 再翻一倍，平方项就翻四倍，线性项只翻两倍。<b>拐点大约出现在 n 与 d 可比的时候；一旦 n 远超 d，平方项就彻底主导成本。</b></p>
</div>

## 四、这对做 Agent 意味着什么

把上面的结论翻译成工程语言，会得到三条非常硬的推论：

**(1) 成本不是线性的，所以「多塞点上下文」是一种高息负债。** 往上下文里加一倍内容，注意力部分的代价接近四倍。这解释了为什么长上下文模型的 API 定价通常按阶梯上涨，而不是线性。

**(2) 裁剪与压缩不是优化，而是必备能力。** 如果你的 Harness 只会「一直追加消息」，那你实际上是在让成本做平方增长。上下文压缩、状态外置、历史摘要这三件事，是 Harness 的基本功而不是加分项。

**(3) 首 token 延迟与后续 token 延迟是两个不同的成本。** 处理输入（prefill）要跑完整个 `[n, n]`；生成每个 token（decode）只走一步，但需要读缓存。这两个阶段的瓶颈不同，优化手段也不同——这是下一章 KV Cache 的主题。

<p class="pull-quote">把 n² 记住，你就不需要背任何「长上下文为什么要小心」的结论了——那些结论全都是它的推论。<cite>本刊编辑部</cite></p>

## 五、动手：三十行手写一遍注意力

不写一遍就容易把形状记混。下面这段 NumPy 代码把图 1 完整实现了一遍，重点看注释里标注的形状。

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



<div class="box box-practice">
  <span class="box-title">实操任务（建议 20 分钟）</span>
  <ul>
    <li>把 <code>n</code> 从 5 改到 2000，测量 <code>S = Q @ K.T</code> 与 <code>X @ Wq</code> 的耗时，亲手看到平方项吃掉时间；</li>
    <li>把 <code>mask</code> 加进 <code>S</code>（被 mask 的位置填 <code>-inf</code>），再做 softmax，确认第一行只依赖第一个 token；</li>
    <li>回答自己一个问题：如果我想让「第 500 个 token 只关注最近 100 个 token」（滑窗注意力），代码要改哪一行？</li>
  </ul>
</div>

## 六、自测

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

## 七、小结与术语表

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>术语</th><th>一句话解释</th><th>工程含义</th></tr></thead>
    <tbody>
      <tr><td>Self-Attention</td><td>序列中每个位置对其他所有位置算权重并加权聚合</td><td>产生 [n, n] 中间矩阵，是平方复杂度的唯一来源</td></tr>
      <tr><td>Q / K / V</td><td>同一输入经三组权重投影出的查询、键、值</td><td>形状都是 [n, d]；K、V 正是后续会被缓存起来的对象</td></tr>
      <tr><td>缩放因子 √d</td><td>点积结果除以维度的平方根</td><td>防止 softmax 进入饱和区导致梯度消失与权重退化成 one-hot</td></tr>
      <tr><td>因果掩码</td><td>让位置 i 只能看到 i 及之前的位置</td><td>这是 decoder-only 模型可做 KV Cache 的前提</td></tr>
      <tr><td>Prefill / Decode</td><td>处理输入的阶段 / 逐个生成 token 的阶段</td><td>瓶颈不同：前者算力受限，后者显存带宽受限</td></tr>
    </tbody>
  </table>
</div>

下一章我们把这个 n² 换个角度再看一次：既然前缀会被反复重算，那能不能缓存？能，但缓存命中与否取决于一个你平时根本不会注意到的东西——前缀稳定性。
