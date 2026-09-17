---
chapter: llm-05-inference-opt
lead: '把推理成本打下来有四把锤子：量化、分页注意力、投机解码、连续批处理。它们各自砸的是不同的钉子——有的是显存带宽，有的是显存容量，有的是串行依赖，有的是硬件利用率。搞混了就会在错误的地方使劲。'
note: '本章难度较高，建议在读完前四章后再读。重点是「每个手段针对哪个瓶颈」，而不是记名词。'
---

<p class="dropcap">前面四章建立了三个事实：注意力是平方的、KV Cache 是线性的但占显存、解码是逐步采样的。这一章回答工业界最关心的问题——在这些约束下，怎么把单位 token 的成本压下去。</p>

## 一、先分清两个阶段，再谈优化

推理分两个阶段，它们的瓶颈完全不同，因此优化手段也不同。这是本章最重要的一张表。

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th></th><th>Prefill（处理输入）</th><th>Decode（逐 token 生成）</th></tr></thead>
    <tbody>
      <tr><td>做什么</td><td>把整段输入一次算完，建立 KV Cache</td><td>每步生成一个 token，读取已有缓存</td></tr>
      <tr><td>并行度</td><td>高（n 个位置可并行）</td><td>低（第 t 步必须等第 t−1 步）</td></tr>
      <tr><td>主要瓶颈</td><td><b>算力（FLOPs）</b></td><td><b>显存带宽（Memory Bandwidth）</b></td></tr>
      <tr><td>典型表现</td><td>首 token 延迟（TTFT）高</td><td>吞吐（tokens/s）受限，GPU 利用率低</td></tr>
      <tr><td>对应手段</td><td>算子融合、FlashAttention、分块计算</td><td>量化、连续批处理、投机解码</td></tr>
    </tbody>
  </table>
</div>

<div class="box box-key">
  <span class="box-title">一个反直觉的事实</span>
  <p>Decode 阶段的 GPU 利用率通常只有个位数百分比。原因不是算力不够，而是<b>每生成一个 token，都要把整个模型权重和 KV Cache 从显存搬到计算单元一次</b>。数据搬运的时间远超计算时间——这就是为什么 decode 阶段是「显存带宽受限」而非「算力受限」。</p>
  <p>结论：<b>针对 decode 的优化，本质上都是在减少搬运量或增加搬运的并行度。</b>量化减少搬运量，连续批处理让一次搬运服务更多请求，投机解码让一次搬运产出更多 token。</p>
</div>

## 二、四把锤子

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 400" role="img" aria-label="四种推理优化手段分别针对的瓶颈">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">四把锤子，四个钉子</text>
      <!-- 量化 -->
      <rect x="16" y="38" width="308" height="100" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="32" y="58" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#8a6a1e">① 量化 Quantization</text>
      <text x="32" y="76" font-family="ui-monospace, monospace" font-size="9.8" fill="#6b6257">把 fp16 → fp8 / int8 / int4，权重与缓存都变小</text>
      <text x="32" y="93" font-family="ui-monospace, monospace" font-size="9.8" fill="#2f6157">钉子：显存容量 + 搬运量　　→ TTFT 与吞吐同时改善</text>
      <text x="32" y="110" font-family="ui-monospace, monospace" font-size="9.8" fill="#9b2c2c">代价：精度损失，长链推理与大数运算上更明显</text>
      <text x="32" y="127" font-family="ui-monospace, monospace" font-size="9.8" fill="#a49a8c">常见档位：W8A8 较安全，W4 需配合分组量化与校准</text>
      <!-- 分页注意力 -->
      <rect x="336" y="38" width="308" height="100" fill="#eef4f1" stroke="#2f6157" stroke-width="1.2"/>
      <text x="352" y="58" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#2f6157">② PagedAttention</text>
      <text x="352" y="76" font-family="ui-monospace, monospace" font-size="9.8" fill="#6b6257">把 KV Cache 切成固定大小的块，按需分配、不要求连续</text>
      <text x="352" y="93" font-family="ui-monospace, monospace" font-size="9.8" fill="#2f6157">钉子：显存碎片　　→ 可并发请求数显著提升</text>
      <text x="352" y="110" font-family="ui-monospace, monospace" font-size="9.8" fill="#9b2c2c">代价：寻址开销、实现复杂度上升</text>
      <text x="352" y="127" font-family="ui-monospace, monospace" font-size="9.8" fill="#a49a8c">附带收益：支持前缀共享（多个请求共用相同前缀的块）</text>
      <!-- 连续批处理 -->
      <rect x="16" y="152" width="308" height="100" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="32" y="172" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#1f1b16">③ 连续批处理 Continuous Batching</text>
      <text x="32" y="190" font-family="ui-monospace, monospace" font-size="9.8" fill="#6b6257">不等整批做完，某个请求一结束就立刻补入新请求</text>
      <text x="32" y="207" font-family="ui-monospace, monospace" font-size="9.8" fill="#2f6157">钉子：硬件空转　　→ 吞吐成倍提升，是性价比最高的一刀</text>
      <text x="32" y="224" font-family="ui-monospace, monospace" font-size="9.8" fill="#9b2c2c">代价：单请求延迟可能变差（被大 batch 拖累）</text>
      <text x="32" y="241" font-family="ui-monospace, monospace" font-size="9.8" fill="#a49a8c">这是现代推理框架（vLLM 等）的默认能力</text>
      <!-- 投机解码 -->
      <rect x="336" y="152" width="308" height="100" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.2"/>
      <text x="352" y="172" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#9b2c2c">④ 投机解码 Speculative Decoding</text>
      <text x="352" y="190" font-family="ui-monospace, monospace" font-size="9.8" fill="#6b6257">小模型先一次性起草 k 个 token，大模型一次前向并行验证</text>
      <text x="352" y="207" font-family="ui-monospace, monospace" font-size="9.8" fill="#2f6157">钉子：串行依赖　　→ 一次搬运产出多个 token</text>
      <text x="352" y="224" font-family="ui-monospace, monospace" font-size="9.8" fill="#9b2c2c">代价：需额外模型或额外计算；加速比取决于接受率</text>
      <text x="352" y="241" font-family="ui-monospace, monospace" font-size="9.8" fill="#a49a8c">接受率低时可能反而更慢（净亏损）</text>
      <!-- 决策树 -->
      <rect x="16" y="272" width="628" height="112" fill="#fbf8f2" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="30" y="292" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#1f1b16">选型决策：从你实际卡住的地方出发</text>
      <text x="30" y="312" font-family="ui-monospace, monospace" font-size="9.8" fill="#6b6257">模型装不下 / 显存不够　　　　→ 量化（优先 W8A8，再考虑 W4）</text>
      <text x="30" y="330" font-family="ui-monospace, monospace" font-size="9.8" fill="#6b6257">并发上不去、显存碎片严重　　→ PagedAttention</text>
      <text x="30" y="348" font-family="ui-monospace, monospace" font-size="9.8" fill="#6b6257">吞吐不够、GPU 利用率低　　　→ 连续批处理（先查这一项）</text>
      <text x="30" y="366" font-family="ui-monospace, monospace" font-size="9.8" fill="#6b6257">单请求延迟高、输出长　　　　→ 投机解码 / MLA 类结构优化</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　四种手段针对的瓶颈完全不同。面试中被问到「怎么优化推理成本」时，<b>先问清瓶颈在哪（显存、并发、吞吐、还是延迟），再给手段</b>——不问瓶颈直接列表，是最容易被追问到答不上来的答法。</figcaption>
</figure>

## 三、MLA：结构层面的一次改写

除了上面四个「工程手段」，还有一条更彻底的路：**改注意力本身的结构**。

DeepSeek 提出的 MLA（Multi-head Latent Attention）思路是：不直接缓存完整的 K/V，而是把它们压到一个低维的潜在向量里缓存，用的时候再投影回来。

用前面学过的语言描述：**它压的是 KV Cache 这张「线性增长的账单」的系数。**

- 常规 MHA：缓存量 ∝ `n_layers × n_heads × head_dim`
- GQA：把 `n_heads` 换成更小的 `n_kv_heads`，系数降到 1/8 左右
- MLA：缓存的是压缩后的潜在向量，维度远小于 `n_kv_heads × head_dim`，系数进一步下降

这解释了为什么在同样的显存预算下，采用 MLA 的模型能支撑显著更长的上下文与更高的并发。**这也是「结构创新本身就是成本创新」的最好例子。**

<p class="pull-quote">优化的第一步不是选手段，是量瓶颈。没有测量就上手段，等于在黑暗中拧螺丝。<cite>本刊编辑部</cite></p>

## 四、动手：测一次，而不是猜一次

下面这段代码用纯 Python 模拟三种 decode 策略的「搬运次数」，用来建立数量级直觉。真实基准请用专业压测工具，但模型足够说明问题。

<div class="code-block">
  <div class="code-head"><span>decode_cost_model.py</span><span class="lang">python</span></div>
  <pre><code>"""
用「显存搬运次数」估算 decode 成本。
核心假设：decode 每步都要把权重搬运一遍（带宽受限），
所以「总搬运量 = 步数 × 权重体积」，优化就是减少这两个因子。
"""
def weight_gb(n_params_b: float, bytes_per: int = 2) -> float:
    """权重体积：参数量 × 每参数字节数"""
    return n_params_b * 1e9 * bytes_per / 1024**3
def naive_decode(n_params_b, out_tokens, bytes_per=2):
    """朴素逐 token：每一步搬一次全量权重"""
    w = weight_gb(n_params_b, bytes_per)
    return out_tokens * w, out_tokens     # (总搬运 GiB, 前向次数)
def continuous_batching(n_params_b, out_tokens, concurrent, bytes_per=2):
    """连续批处理：一次搬运服务 concurrent 个请求（假设长度对齐）"""
    w = weight_gb(n_params_b, bytes_per)
    steps = out_tokens                          # 步数不变
    # 但每一步服务 concurrent 个请求，等于摊薄了单位 token 的搬运量
    return steps * w, steps * concurrent
def speculative(n_params_b, out_tokens, accept_rate, draft_tokens=4, bytes_per=2):
    """投机解码：小模型起草 k 个，大模型一次前向验证"""
    calls = out_tokens / (1 + draft_tokens * accept_rate)
    return calls * weight_gb(n_params_b, bytes_per), calls
def quantized(n_params_b, out_tokens, bytes_per, baseline_bytes=2):
    """量化：直接按字节比例缩小搬运量"""
    return naive_decode(n_params_b, out_tokens, bytes_per)
print('=== 同一个 70B 模型，输出 512 token，fp16 ===')
base, calls = naive_decode(70, 512)
print(f'朴素 decode          搬运 {base:8.1f} GiB　前向 {calls:.0f} 次')
b, c = continuous_batching(70, 512, concurrent=16)
print(f'连续批处理 ×16       搬运 {b:8.1f} GiB　有效产出 {c:.0f} token')
b, c = speculative(70, 512, accept_rate=0.7)
print(f'投机解码 接受率 0.7  搬运 {b:8.1f} GiB　前向 {c:.0f} 次  ← 少了一半以上的搬运')
b, _ = quantized(70, 512, bytes_per=1)
print(f'fp8 量化             搬运 {b:8.1f} GiB  ← 直接减半')
</code></pre>
</div>

<div class="box box-practice">
  <span class="box-title">实操任务</span>
  <ul>
    <li>把上面三个函数组合起来（量化 + 连续批处理 + 投机解码），算出叠加后的搬运量，理解为什么这几种手段可以叠加而不会互相抵消；</li>
    <li>把 <code>accept_rate</code> 从 0.9 降到 0.2，观察投机解码何时变成负优化；</li>
    <li>用一句话回答：<b>为什么连续批处理能提升吞吐但可能恶化单请求延迟？</b></li>
  </ul>
</div>

## 五、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>本章为深入级别，答对 2/3 即可</span></div>
  <div class="q-item" data-qid="llm05-q1" data-answer="1">
    <div class="q-text"><span class="idx">Q1</span>Decode 阶段的 GPU 利用率通常很低，根本原因是什么？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>单个 token 的计算量太小，达不到计算单元的启动阈值</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>每步都要把权重与 KV Cache 从显存搬到计算单元，受显存带宽限制而非算力限制</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>因为注意力是 O(n²)，decode 时需要重复计算</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>因为框架调度有 bug</span></button>
    <div class="explain"><b>B。</b>这是理解所有 decode 优化的钥匙：<b>瓶颈是搬运，不是计算。</b>由此推出——量化（少搬）、连续批处理（一次搬服务多个请求）、投机解码（一次搬产出多个 token），三条路都在减少「单位 token 的搬运量」。</div>
  </div>
  <div class="q-item" data-qid="llm05-q2" data-answer="3">
    <div class="q-text"><span class="idx">Q2</span>PagedAttention 主要解决什么问题？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>把注意力的计算复杂度从 O(n²) 降到 O(n)</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>减少模型权重体积</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>提高单请求的生成速度上限</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>消除 KV Cache 的内存碎片，让同样显存能容纳更多并发请求</span></button>
    <div class="explain"><b>D。</b>传统实现要求每个请求的 KV Cache 占一段连续显存，长度不确定时只能按最大长度预留，浪费严重。分页方案把缓存切成固定块、按需分配、物理上不要求连续，碎片问题随之消失，可并发数大幅上升。<b>它不改复杂度，改的是显存利用率。</b></div>
  </div>
  <div class="q-item" data-qid="llm05-q3" data-answer="2">
    <div class="q-text"><span class="idx">Q3</span>MLA 这类结构优化的核心收益是什么？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>降低模型训练所需的算力</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>提升模型推理的准确率</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>压缩 KV Cache 的维度，从而在同样显存下支撑更长上下文与更高并发</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>彻底消除注意力的平方复杂度</span></button>
    <div class="explain"><b>C。</b>MLA 缓存的是压缩后的潜在向量而非完整 K/V，等于把 KV Cache 这条线性账单的系数改小了。<b>注意它同样不解决 n² 的算力问题</b>——算力问题是另一条技术线（稀疏注意力 / 线性注意力）要处理的。</div>
  </div>
</div>

## 六、小结

| 手段 | 针对的瓶颈 | 主要收益 | 主要代价 |
| --- | --- | --- | --- |
| 量化 | 显存容量 + 搬运量 | 装得下、跑得快 | 精度损失 |
| PagedAttention | 显存碎片 | 并发数提升 | 实现复杂度、寻址开销 |
| 连续批处理 | 硬件空转 | 吞吐成倍提升 | 单请求延迟可能变差 |
| 投机解码 | 串行依赖 | 单请求延迟下降 | 低接受率时反而变慢 |
| MLA 类结构优化 | KV Cache 系数 | 长上下文 + 高并发 | 训练与实现复杂度 |

**这一章的最终落点是那个决定性的问题：当一个成本问题出现时，你的第一反应是「换个更强的模型」，还是「先量一下瓶颈在哪」？** 面试官几乎一定会用这个问题来区分这两类人——而这道题，正好是下一部分（Harness 工程）的入口。
