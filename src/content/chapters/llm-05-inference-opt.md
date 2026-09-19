---
chapter: llm-05-inference-opt
lead: '把推理成本打下来有四把锤子：量化、分页注意力、投机解码、连续批处理。它们各自砸的是不同的钉子——有的是显存带宽，有的是显存容量，有的是串行依赖，有的是硬件利用率。搞混了就会在错误的地方使劲。'
note: '本章难度较高，建议在读完前四章后再读。重点是「每个手段针对哪个瓶颈」，而不是记名词。'
---

<p class="dropcap">前面四章建立了三个事实：注意力是平方的、KV Cache 是线性的但占显存、解码是逐步采样的。这一章回答工业界最关心的问题——在这些约束下，怎么把单位 token 的成本压下去。</p>

## 一、先分清两个阶段，再谈优化

推理分[[prefill-decode|Prefill 和 Decode 两个阶段]]，它们的瓶颈完全不同，因此优化手段也不同。这是本章最重要的一张表。Prefill 阶段的主要指标是 [[ttft|首 token 时延（TTFT）]]，它卡在算力上。

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

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 340" role="img" aria-label="Prefill 与 Decode 两个阶段瓶颈对照">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">Prefill 与 Decode：两个阶段的瓶颈不同</text>
      <text x="16" y="38" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">左：一次性算完、可并行　右：逐 token、强串行。优化要分别下手。</text>
      <!-- 左 Prefill -->
      <text x="40" y="64" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#2f6157">Prefill（处理输入）</text>
      <g>
        <rect x="40" y="80" width="40" height="34" fill="#eef4f1" stroke="#2f6157" stroke-width="1.1"/>
        <rect x="88" y="80" width="40" height="34" fill="#eef4f1" stroke="#2f6157" stroke-width="1.1"/>
        <rect x="136" y="80" width="40" height="34" fill="#eef4f1" stroke="#2f6157" stroke-width="1.1"/>
        <rect x="184" y="80" width="40" height="34" fill="#eef4f1" stroke="#2f6157" stroke-width="1.1"/>
        <rect x="232" y="80" width="40" height="34" fill="#eef4f1" stroke="#2f6157" stroke-width="1.1"/>
      </g>
      <text x="40" y="138" font-family="ui-monospace, monospace" font-size="9.5" fill="#6b6257">n 个位置同时算（高并行）</text>
      <text x="40" y="156" font-family="ui-monospace, monospace" font-size="9.5" font-weight="700" fill="#9b2c2c">瓶颈：算力 FLOPs</text>
      <text x="40" y="174" font-family="ui-monospace, monospace" font-size="9.5" fill="#6b6257">指标：TTFT 高</text>
      <!-- 右 Decode -->
      <text x="360" y="64" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#9b2c2c">Decode（逐 token）</text>
      <g>
        <rect x="360" y="80" width="34" height="30" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.1"/>
        <text x="377" y="100" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="#9b2c2c">t1</text>
        <rect x="410" y="80" width="34" height="30" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.1"/>
        <text x="427" y="100" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="#9b2c2c">t2</text>
        <rect x="460" y="80" width="34" height="30" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.1"/>
        <text x="477" y="100" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="#9b2c2c">t3</text>
        <rect x="510" y="80" width="34" height="30" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.1"/>
        <text x="527" y="100" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="#9b2c2c">t4</text>
      </g>
      <line x1="394" y1="95" x2="408" y2="95" stroke="#9b2c2c" stroke-width="1.1" marker-end="url(#ar1)"/>
      <line x1="444" y1="95" x2="458" y2="95" stroke="#9b2c2c" stroke-width="1.1" marker-end="url(#ar1)"/>
      <line x1="494" y1="95" x2="508" y2="95" stroke="#9b2c2c" stroke-width="1.1" marker-end="url(#ar1)"/>
      <text x="360" y="138" font-family="ui-monospace, monospace" font-size="9.5" fill="#6b6257">第 t 步必须等 t−1（强串行）</text>
      <text x="360" y="156" font-family="ui-monospace, monospace" font-size="9.5" font-weight="700" fill="#9b2c2c">瓶颈：显存带宽（搬权重）</text>
      <text x="360" y="174" font-family="ui-monospace, monospace" font-size="9.5" fill="#6b6257">指标：吞吐低、GPU 利用率个位数</text>
      <rect x="16" y="220" width="628" height="100" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="30" y="244" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">判据：问「这一步卡在算还是搬」</text>
      <text x="30" y="266" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">Prefill 卡在算力 → 用算子融合 / FlashAttention / 分块计算把一次前向算便宜。</text>
      <text x="30" y="286" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">Decode 卡在带宽 → 用量化（少搬）、连续批处理（一次搬服务多请求）、投机解码（一次搬产多 token）。</text>
      <text x="30" y="306" font-family="ui-monospace, monospace" font-size="10" fill="#9b2c2c">两者是不同瓶颈，不能用同一把锤子：给 prefill 上量化，对 TTFT 帮助有限；给 decode 上分块，治不了带宽。</text>
    </svg>
  </div>
  <figcaption><b>图 2</b>　Prefill 一次算完、n 个位置可并行，瓶颈是算力；Decode 逐 token、强串行，瓶颈是显存带宽。<b>把两个阶段混为一谈，是推理优化最常见的方向性错误。</b></figcaption>
</figure>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 380" role="img" aria-label="四种推理优化手段与四个瓶颈的配对矩阵">
      <defs>
        <marker id="ar1" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">手段 × 瓶颈：该用哪把锤子</text>
      <text x="16" y="38" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">✓ = 该手段针对此瓶颈；先定位瓶颈列，再找对应的 ✓</text>
      <!-- 列头 -->
      <rect x="196" y="56" width="108" height="30" fill="#fdf6e8" stroke="#b8944b" stroke-width="1"/>
      <text x="250" y="76" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" fill="#8a6a1e">显存容量</text>
      <rect x="308" y="56" width="108" height="30" fill="#eef4f1" stroke="#2f6157" stroke-width="1"/>
      <text x="362" y="76" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" fill="#2f6157">显存碎片</text>
      <rect x="420" y="56" width="108" height="30" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1"/>
      <text x="474" y="76" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" fill="#1f1b16">显存带宽</text>
      <rect x="532" y="56" width="108" height="30" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1"/>
      <text x="586" y="76" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" fill="#9b2c2c">串行/吞吐</text>
      <!-- 行 -->
      <g font-family="ui-monospace, monospace" font-size="9.5">
        <rect x="30" y="92" width="160" height="34" fill="#f0ebe1" stroke="#cfc6b6" stroke-width="1"/>
        <text x="38" y="113" fill="#1f1b16">量化</text>
        <text x="250" y="114" text-anchor="middle" fill="#2f6157" font-size="13" font-weight="700">✓</text>
        <text x="474" y="114" text-anchor="middle" fill="#2f6157" font-size="13" font-weight="700">✓</text>
        <rect x="30" y="130" width="160" height="34" fill="#f0ebe1" stroke="#cfc6b6" stroke-width="1"/>
        <text x="38" y="151" fill="#1f1b16">PagedAttention</text>
        <text x="362" y="152" text-anchor="middle" fill="#2f6157" font-size="13" font-weight="700">✓</text>
        <rect x="30" y="168" width="160" height="34" fill="#f0ebe1" stroke="#cfc6b6" stroke-width="1"/>
        <text x="38" y="189" fill="#1f1b16">连续批处理</text>
        <text x="586" y="190" text-anchor="middle" fill="#9b2c2c" font-size="13" font-weight="700">✓</text>
        <rect x="30" y="206" width="160" height="34" fill="#f0ebe1" stroke="#cfc6b6" stroke-width="1"/>
        <text x="38" y="227" fill="#1f1b16">投机解码</text>
        <text x="586" y="228" text-anchor="middle" fill="#9b2c2c" font-size="13" font-weight="700">✓</text>
        <rect x="30" y="244" width="160" height="34" fill="#f0ebe1" stroke="#cfc6b6" stroke-width="1"/>
        <text x="38" y="265" fill="#1f1b16">FlashAttn·融合</text>
        <text x="474" y="266" text-anchor="middle" fill="#2f6157" font-size="13" font-weight="700">✓</text>
      </g>
      <rect x="16" y="294" width="628" height="68" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="30" y="316" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">用法：先量瓶颈列，再读对应行的 ✓</text>
      <text x="30" y="338" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">显存装不下 → 量化；碎片严重 → PagedAttention；GPU 空转 → 连续批处理；串行依赖 → 投机解码；一次前向贵 → FlashAttn/融合。</text>
      <text x="30" y="356" font-family="ui-monospace, monospace" font-size="10" fill="#9b2c2c">这些手段可叠加：量化 + 连续批处理 + 投机解码，各自打不同的钉子。</text>
    </svg>
  </div>
  <figcaption><b>图 3</b>　把「手段」和「瓶颈」摆成矩阵，对应关系一目了然。<b>面试里被问「怎么优化成本」，先定位瓶颈列再给手段；直接列名词而不说针对什么，几乎一定会被追问到答不上来。</b></figcaption>
</figure>

### 2.1 量化：先砍显存与带宽

[[quantization|量化]]把权重从 fp16 降到 fp8 / int8 / int4，权重体积和 KV Cache 一起变小，于是「装得下」「搬得动」。它同时打两根钉子：显存容量（装下更大模型）和显存带宽（decode 时搬得少）。**什么时候该先上量化**：模型装不下、或 decode 带宽瓶颈时。**什么时候别指望它**：prefill 是算力瓶颈，量化对 TTFT 帮助有限；且低比特（W4）会带来精度损失，长链推理、大数运算、代码生成上更明显。安全的起点是 W8A8，W4 要配合分组量化 + 校准才能用。

### 2.2 PagedAttention：治显存碎片

[[paged-attention|PagedAttention]] 把 KV Cache 切成固定大小的块、按需分配、不要求连续，像操作系统分页管理内存那样。它打的是「显存碎片」这根钉子：传统连续分配会让显存里布满无法利用的空洞，能并发的请求数被碎片锁死。**附带收益是前缀共享**——多个请求共用相同前缀时，可以复用同一批块，这也是下一章 [[prefix-stability|前缀稳定性]] 在推理框架侧的落点。代价是实现复杂度上升、有寻址开销。

### 2.3 连续批处理：性价比最高的一刀

[[continuous-batching|连续批处理]] 不等整批做完，某个请求一结束就立刻补入新请求，让 GPU 始终有活干。它打的是「硬件空转」这根钉子——decode 阶段单请求的 GPU 利用率常是个位数，批处理把它拉高数倍，吞吐成倍提升，是性价比最高的一刀，现代推理框架（vLLM 等）已默认支持。**代价是单请求延迟可能变差**（被大 batch 拖累），所以对强延迟敏感的场景要控制 batch 上限。

### 2.4 投机解码：拿算力换串行

[[speculative-decoding|投机解码]] 让一个小模型（草稿模型）先一次性起草 k 个 token，大模型一次前向并行验证，验证通过的 token 直接采用。它打的是「串行依赖」这根钉子：decode 每步都要等上一步，投机解码让一次前向「搬运」产出多个 token。**代价是需要额外的小模型或额外计算，加速比取决于「接受率」**——小模型猜得越准，越划算；接受率低时可能反而更慢（净亏损）。它本质上是用「多算一点」换「少等一点」，适合输出长、延迟敏感的场景。

这四把锤子可以叠加（量化 + 连续批处理 + 投机解码，各打各的钉子），但**叠加前先量清瓶颈**——给 prefill 上量化治不了算力，给 decode 上分块治不了带宽。

## 三、MLA：结构层面的一次改写

除了上面四个「工程手段」，还有一条更彻底的路：改注意力本身的结构。

DeepSeek 提出的 [[mla|MLA]]（Multi-head Latent Attention）思路是：不直接缓存完整的 K/V，而是把它们压到一个低维的潜在向量里缓存，用的时候再投影回来。

顺带把四把锤子的发力点一次性说清：[[quantization|量化]] 同时压显存与搬运量，[[paged-attention|PagedAttention]] 消灭[[memory-fragmentation|显存碎片]]，[[continuous-batching|连续批处理]] 填平硬件空转，[[speculative-decoding|投机解码]] 绕开串行依赖——而后两者的提速分别受 [[acceptance-rate|接受率]] 与 [[memory-bandwidth|显存带宽]] 制约；此外还有 [[flash-attention|FlashAttention]] 与 [[operator-fusion|算子融合]] 这类「让单次计算更便宜」的手段。

用前面学过的语言描述：**它压的是 [[kv-cache|KV Cache]] 这张「线性增长的账单」的系数。**

- 常规 MHA：缓存量 ∝ `n_layers × n_heads × head_dim`
- GQA：把 `n_heads` 换成更小的 `n_kv_heads`，系数降到 1/8 左右
- MLA：缓存的是压缩后的潜在向量，维度远小于 `n_kv_heads × head_dim`，系数进一步下降

这解释了为什么在同样的显存预算下，采用 MLA 的模型能支撑显著更长的上下文与更高的并发。**这也是「结构创新本身就是成本创新」的最好例子。**

<p class="pull-quote">优化的第一步不是选手段，是量瓶颈。没有测量就上手段，等于在黑暗中拧螺丝。<cite>本刊编辑部</cite></p>

## 四、动手：测一次，而不是猜一次

下面这段代码用纯 Python 模拟三种 decode 策略的「搬运次数」，用来建立数量级直觉。真实基准请用专业压测工具，但模型足够说明问题。

```python title="decode_cost_model.py"
"""
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
```



<div class="box box-practice">
  <span class="box-title">实操任务</span>
  <ul>
    <li>把上面三个函数组合起来（量化 + 连续批处理 + 投机解码），算出叠加后的搬运量，理解为什么这几种手段可以叠加而不会互相抵消；</li>
    <li>把 <code>accept_rate</code> 从 0.9 降到 0.2，观察投机解码何时变成负优化；</li>
    <li>用一句话回答：<b>为什么连续批处理能提升吞吐但可能恶化单请求延迟？</b></li>
  </ul>
</div>

## 五、常见误区与追问

### 5.1 误区：Decode 慢是因为算力不够

错在哪：直觉上「生成慢 = 算得慢」。为什么自然：我们习惯用算力衡量深度学习瓶颈。正确做法：Decode 每步只生成一个 token，计算量极小，但**每步都要把整个模型权重和 KV Cache 从显存搬到计算单元一次**——时间花在搬运上，不是计算上。**判据：看 GPU 利用率，若只有个位数百分比却算力充足，说明瓶颈是显存带宽而非算力；优化方向是「少搬 / 一次搬服务多请求 / 一次搬产多 token」，而不是堆算力。**

### 5.2 误区：优化推理成本，先上量化最稳妥

错在哪：量化几乎人人会提，便当成默认第一步。为什么自然：它名字最熟、上手最容易。正确做法：应该**先测瓶颈**：GPU 利用率低、吞吐上不去 → 先看连续批处理（性价比最高的一刀）；显存装不下 → 才上量化；碎片严重 → PagedAttention。**判据：没量就上手段等于在黑暗中拧螺丝；被问「先优化哪个」时，先反问「你卡在显存、并发、吞吐还是延迟」，再给手段。**

### 5.3 误区：投机解码总是比朴素 decode 快

错在哪：把「并行验证多个 token」想成必然加速。为什么自然：一次前向验证 k 个草稿，听起来省了 k−1 次前向。正确做法：加速的前提是草稿被大模型**接受**；接受率低时，草稿白白计算，反而净亏损。**判据：设草稿数 k、接受率 r，等效前向次数 ≈ 步数 /(1 + k·r)；当 r 很低（如 0.2 配 k=4 时等效约 1/1.8≈0.56 步/ token 的节省并不稳），需实测；接受率掉到阈值以下就关掉投机解码。**

### 5.4 误区：PagedAttention 把注意力的平方复杂度降下来了

错在哪：看到「优化注意力」就联想到降复杂度。为什么自然：名字带 Attention，容易望文生义。正确做法：PagedAttention 只解决 **KV Cache 的显存碎片**——把缓存切成固定块、按需分配、物理不连续，从而提升可并发请求数；它**不改 O(n²) 的注意力计算复杂度**。**判据：被问「PagedAttention 改了哪个公式因子」时，答案必须是显存利用率，而不是 n²；降复杂度是稀疏/线性注意力与 FlashAttention 的事。**

### 5.5 误区：Prefill 和 Decode 用同一套优化手段

错在哪：把「推理优化」当成一张扁平清单随机挑。为什么自然：清单上都是「优化手段」，容易混用。正确做法：Prefill 瓶颈在**算力**（n 个位置可并行，卡在 FLOPs），Decode 瓶颈在**显存带宽**（强串行，卡在搬权重）。**判据：问「这一步卡在算还是搬」——Prefill 上量化对 TTFT 帮助有限，Decode 上分块计算治不了带宽；手段必须对准阶段。**

### 5.6 误区：FlashAttention 是推理专属或训练专属的优化

错在哪：按使用场景给它贴标签。为什么自然：常听人在「训练加速」语境下提到它。正确做法：FlashAttention 是**训练与推理通用的注意力 IO 优化**——通过分块与算子融合，减少中间结果的显存读写，不改变注意力语义。**判据：它改的是「注意力怎么算更省 IO」，不是「注意力算什么」；在任何受显存带宽制约的阶段（prefill 尤甚）都能用。**

## 六、自测

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

## 七、小结

| 手段 | 针对的瓶颈 | 主要收益 | 主要代价 |
| --- | --- | --- | --- |
| 量化 | 显存容量 + 搬运量 | 装得下、跑得快 | 精度损失 |
| PagedAttention | 显存碎片 | 并发数提升 | 实现复杂度、寻址开销 |
| 连续批处理 | 硬件空转 | 吞吐成倍提升 | 单请求延迟可能变差 |
| 投机解码 | 串行依赖 | 单请求延迟下降 | 低接受率时反而变慢 |
| MLA 类结构优化 | KV Cache 系数 | 长上下文 + 高并发 | 训练与实现复杂度 |

**这一章的最终落点是那个决定性的问题：当一个成本问题出现时，你的第一反应是「换个更强的模型」，还是「先量一下瓶颈在哪」？** 面试官几乎一定会用这个问题来区分这两类人——而这道题，正好是下一部分（Harness 工程）的入口。

## 八、参考与延伸

本章机制部分只讲到「够用」为止。想往下深挖，下面按「先看图、再看代码、最后读论文」的顺序排好了。全站不做原文转载，这里只登记链接与「为什么值得读」。

**先看图（建立直觉）**

- [vLLM：用 PagedAttention 把 LLM 服务做到又快又省](https://blog.vllm.ai/2023/06/20/vllm.html) —— 把 PagedAttention、连续批处理、KV 块管理讲得最直白，还有实测吞吐曲线。<strong>读本章第二节「四把锤子」卡住时，来这儿看工程落地最快。</strong>
- [Lilian Weng · Large Transformer Model Inference Optimization](https://lilianweng.github.io/posts/2023-01-10-inference-optimization/) —— 按「压模型」与「改推理系统」两条线把优化手段摊开，量化、剪枝、蒸馏、结构改造各占一节。<strong>想给本章那四把锤子补一个外部坐标系、看清哪些手段属于压缩模型、哪些属于改服务系统，读它最快。</strong>

**再看代码（动手实现）**

- [动手学深度学习（中文，zh.d2l.ai）](https://zh.d2l.ai/) —— 配套可跑代码，把注意力、量化、批处理都实现了一遍。<strong>把本章的 decode_cost_model 照着敲一遍，比看十遍都记得牢。</strong>

**最后读论文（对齐一手定义）**

- [Efficient Memory Management for LLM Serving with PagedAttention（arXiv:2309.06180）](https://arxiv.org/abs/2309.06180) —— PagedAttention 原论文，也是 vLLM 的基础。<strong>想搞清楚「碎片到底按什么粒度发生、连续批处理怎么和分页协同」，看它的系统设计那节。</strong>
- [DeepSeek-V2（MLA）arXiv:2405.04434](https://arxiv.org/abs/2405.04434) —— MLA 的一手来源。<strong>重点看它怎么把 K/V 压成低维潜在向量再投影，以及为什么同样显存能撑更长上下文。</strong>
- [Fast Inference from Transformers via Speculative Decoding（arXiv:2211.17192）](https://arxiv.org/abs/2211.17192) —— 投机解码的一手论文。<strong>重点看接受率（acceptance rate）怎么决定加速比，以及为什么接受率低会净亏损。</strong>
