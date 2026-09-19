---
chapter: llm-03-moe
lead: '一个 671B 总参数的模型，为什么在成本上能和几十 B 的稠密模型打平？答案藏在两个数字之间的那条缝里：总参数量与激活参数量。理解这条缝，你就能解释模型选型里最反直觉的那些现象。'
note: '本章最容易答错的是一道看似简单的推理题：稀疏激活省的是算力还是显存？请务必读到最后一节。'
---

<p class="dropcap">模型参数有两个口径，混用会让人得出完全相反的结论。</p>

第一个是 [[total-params|总参数量]]——模型文件有多大，要占多少显存去装。第二个是 [[active-params|激活参数量]]——每生成一个 token，实际参与计算的有多少。[[dense-model|稠密模型]]里这两个数字相等；[[moe]]把它们拆开了。

## 一、两个数字之间的缝

设一个 MoE 模型有 256 个[[expert|专家]]，每个专家约 2.6B 参数，每层路由[[sparse-activation|稀疏激活]]其中 8 个。

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>口径</th><th>稠密模型</th><th>MoE 模型</th><th>工程后果</th></tr></thead>
    <tbody>
      <tr><td>总参数量</td><td>与激活量相同</td><td>所有专家之和，例如 671B</td><td><b>决定显存下限</b>：权重得装得下</td></tr>
      <tr><td>激活参数量</td><td>同上</td><td>每 token 只走 top-k 个专家，例如 37B</td><td><b>决定单 token 算力</b>：接近一个 37B 稠密模型</td></tr>
      <tr><td>每 token FLOPs</td><td>与总参数成正比</td><td>与激活参数成正比</td><td>吞吐高、单价低</td></tr>
      <tr><td>跨设备通信</td><td>少（同层并行即可）</td><td>多（专家分布在不同设备，需 All-to-All）</td><td>延迟与实现复杂度上升</td></tr>
      <tr><td>训练稳定性</td><td>较稳</td><td>路由易坍缩，需负载均衡损失</td><td>训练工程难度更高</td></tr>
    </tbody>
  </table>
</div>

一句话概括 MoE 的交易：**用显存和通信换算力效率**。参数总量上去了（容量变大），但每个 token 的计算量没跟着上去——由[[gating-network|门控网络]]在运行时挑出少数专家来算。

<p class="pull-quote">MoE 不是让模型变小，而是让「不参与计算的参数」变得便宜。<cite>本刊编辑部</cite></p>

## 二、路由是怎么工作的

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 380" role="img" aria-label="MoE 层的路由：token 经门控网络选择 top-k 个专家">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">MoE 层内部：先选路，再计算</text>
      <!-- token -->
      <rect x="16" y="96" width="86" height="42" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="59" y="114" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#1f1b16">token x</text>
      <text x="59" y="129" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" fill="#6b6257">[d]</text>
      <line x1="102" y1="117" x2="134" y2="117" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar3)"/>
      <defs>
        <marker id="ar3" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <!-- router -->
      <rect x="134" y="88" width="118" height="58" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.4"/>
      <text x="193" y="108" text-anchor="middle" font-family="Georgia, serif" font-size="10.5" font-weight="700" fill="#8a6a1e">门控 / 路由</text>
      <text x="193" y="124" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" fill="#6b6257">softmax(x·W_g)</text>
      <text x="193" y="138" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" fill="#6b6257">取 top-k</text>
      <!-- 分支到专家 -->
      <line x1="252" y1="104" x2="300" y2="72" stroke="#1f1b16" stroke-width="1.1"/>
      <line x1="252" y1="117" x2="300" y2="117" stroke="#1f1b16" stroke-width="1.1"/>
      <line x1="252" y1="130" x2="300" y2="162" stroke="#1f1b16" stroke-width="1.1"/>
      <line x1="252" y1="130" x2="300" y2="240" stroke="#cfc6b6" stroke-width="1" stroke-dasharray="3 3"/>
      <line x1="252" y1="130" x2="300" y2="318" stroke="#cfc6b6" stroke-width="1" stroke-dasharray="3 3"/>
      <!-- 选中的专家 -->
      <rect x="302" y="54" width="150" height="36" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="377" y="70" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" fill="#2f6157">专家 17　权重 0.61</text>
      <text x="377" y="83" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">激活</text>
      <rect x="302" y="99" width="150" height="36" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="377" y="115" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" fill="#2f6157">专家 03　权重 0.39</text>
      <text x="377" y="128" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">激活</text>
      <!-- 未选中的专家 -->
      <rect x="302" y="144" width="150" height="36" fill="#f5f2ec" stroke="#cfc6b6" stroke-width="1"/>
      <text x="377" y="166" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" fill="#a49a8c">专家 88　权重 0</text>
      <rect x="302" y="222" width="150" height="36" fill="#f5f2ec" stroke="#cfc6b6" stroke-width="1"/>
      <text x="377" y="244" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" fill="#a49a8c">专家 129　权重 0</text>
      <text x="302" y="200" font-family="ui-monospace, monospace" font-size="9.5" fill="#a49a8c">⋮ 其余 252 个专家不参与本 token 计算</text>
      <!-- 加权求和 -->
      <line x1="452" y1="72" x2="500" y2="72" stroke="#1f1b16" stroke-width="1.1"/>
      <line x1="452" y1="117" x2="500" y2="117" stroke="#1f1b16" stroke-width="1.1"/>
      <line x1="500" y1="72" x2="500" y2="117" stroke="#1f1b16" stroke-width="1.1"/>
      <line x1="500" y1="94" x2="522" y2="94" stroke="#9b2c2c" stroke-width="1.5" marker-end="url(#ar3)"/>
      <rect x="524" y="66" width="120" height="58" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.4"/>
      <text x="584" y="86" text-anchor="middle" font-family="Georgia, serif" font-size="10.5" font-weight="700" fill="#9b2c2c">加权求和</text>
      <text x="584" y="103" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" fill="#6b6257">0.61·E17(x)</text>
      <text x="584" y="116" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" fill="#6b6257">+ 0.39·E03(x)</text>
      <rect x="16" y="280" width="628" height="86" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="30" y="300" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">为什么 MoE 的成本结构这么特殊</text>
      <text x="30" y="320" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">容量看总数：256 个专家 = 671B 参数的知识容量 → 需要显存装下全部权重。</text>
      <text x="30" y="338" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">算力看激活：每 token 只跑 2 个专家 ≈ 37B 的算力 → 单 token 成本接近 37B 稠密模型。</text>
      <text x="30" y="356" font-family="ui-monospace, monospace" font-size="10" fill="#9b2c2c">代价：专家分散在多卡上，每次路由都要跨设备搬运 token（All-to-All 通信）。</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　MoE 层用一个小门控网络给每个 token 选 top-k 个专家，只跑选中的那几个，最后按权重加权。<b>注意「权重 0」的专家并非从显存里消失——它们仍占着地方，只是不参与这一 token 的计算。</b></figcaption>
</figure>

## 三、省的是算力，不是显存

这是本章最重要的一句话，也是最容易答错的地方：

<div class="box box-warn">
  <span class="box-title">常见错误答案</span>
  <p><b>错误说法：</b>「MoE 因为只激活部分专家，所以显存需求也降低了，能在小显存上部署大模型。」</p>
  <p><b>为什么错：</b>路由是<b>运行时</b>根据输入动态决定的。你无法预知下一个 token 会选哪两个专家，所以<b>所有专家的权重都必须常驻显存</b>（或在需要时快速换入，代价极高）。MoE 压缩的是<b>每 token 的 FLOPs</b>，不是权重的存储体积。</p>
  <p><b>正确说法：</b>MoE 让「参数容量」和「单 token 算力」解耦——你可以拥有 671B 的知识容量，却只付 37B 的算力账单；但显存下限仍然由 671B 决定。</p>
</div>

由此衍生出几个工程结论：

- **MoE 的部署门槛是显存，不是算力。** 这就是为什么 MoE 模型通常只在云端大规模集群上跑，很难本地化。
- **MoE 的延迟优势不如吞吐优势明显。** 单请求延迟受 [[all-to-all|All-to-All 通信]] 影响，可能反而比同激活量的稠密模型更慢；但吞吐（单位时间处理 token 数）会好很多。
- **MoE 对 batch 敏感。** batch 越大，专家利用率越高，单位成本越低。这解释了为什么小 batch 场景下 MoE 的性价比优势会缩水（也更容易出现[[routing-collapse|路由坍缩]]，需要[[load-balancing-loss|负载均衡损失]]来对抗）。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 340" role="img" aria-label="总参数量与激活参数量之间的缝">
      <defs>
        <marker id="ar1" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">总参数与激活参数之间，那道缝</text>
      <text x="16" y="38" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">条宽 ∝ 参数量（同一比例）；缝 = 没被激活的参数</text>
      <!-- 总参数条 -->
      <rect x="60" y="80" width="380" height="44" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.4"/>
      <text x="70" y="107" font-family="ui-monospace, monospace" font-size="11" font-weight="700" fill="#9b2c2c">总参数量 671B（容量）→ 决定显存下限</text>
      <!-- 激活参数条 -->
      <rect x="60" y="150" width="21" height="44" fill="#eef4f1" stroke="#2f6157" stroke-width="1.4"/>
      <text x="92" y="164" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#2f6157">激活 37B</text>
      <text x="92" y="180" font-family="ui-monospace, monospace" font-size="9.5" fill="#6b6257">每 token 算力 ≈ 37B 稠密模型（仅 5.5%）</text>
      <!-- 箭头：路由只激活 top-k -->
      <line x1="250" y1="124" x2="250" y2="150" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar1)"/>
      <text x="262" y="140" font-family="ui-monospace, monospace" font-size="9.5" fill="#8a6a1e">路由只激活 top-8 / 256</text>
      <!-- 缝标注 -->
      <text x="100" y="135" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">↑ 这道缝就是 MoE 的性价比来源</text>
      <!-- 底部说明 -->
      <rect x="16" y="220" width="628" height="100" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="30" y="244" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">一句话：容量看总数，算力看激活，显存看总数</text>
      <text x="30" y="266" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">总参数量（671B）决定「模型文件多大、显存下限多少」——权重必须全部装下。</text>
      <text x="30" y="286" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">激活参数量（37B）决定「每生成一个 token 要算多少」——这是单 token 成本与吞吐的来源。</text>
      <text x="30" y="306" font-family="ui-monospace, monospace" font-size="10" fill="#9b2c2c">所以 MoE 让「参数容量」和「单 token 算力」解耦：你能拥有 671B 的容量，却只付 37B 的算力账。</text>
    </svg>
  </div>
  <figcaption><b>图 2</b>　同是 671B 的 MoE，每 token 实际只跑约 37B 的算力。<b>这道「缝」就是 MoE 的全部性价比：容量上去了，单 token 账单没上去——但显存下限仍由 671B 决定。</b></figcaption>
</figure>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 360" role="img" aria-label="理想均匀路由与路由坍缩的对照">
      <defs>
        <marker id="ar2" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">路由坍缩：容量是怎么被浪费的</text>
      <text x="16" y="38" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">左：理想均匀　右：少数专家占满、其余闲置</text>
      <!-- 左：均匀 -->
      <text x="40" y="64" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#2f6157">理想：均匀使用</text>
      <rect x="40" y="80" width="260" height="36" fill="#eef4f1" stroke="#2f6157" stroke-width="1.2"/>
      <text x="170" y="103" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="#2f6157">256 个专家，使用率接近均匀（各 ≈ 1/256）</text>
      <rect x="40" y="124" width="260" height="14" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <text x="170" y="151" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" fill="#6b6257">每个专家都被训练到 → 671B 容量全用上</text>
      <!-- 右：坍缩 -->
      <text x="360" y="64" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#9b2c2c">坍缩：少数占满</text>
      <rect x="360" y="80" width="60" height="120" fill="#f3c9c9" stroke="#9b2c2c" stroke-width="1.2"/>
      <text x="390" y="74" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" font-weight="700" fill="#9b2c2c">E1 高</text>
      <rect x="430" y="100" width="60" height="100" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <text x="460" y="94" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" fill="#9b2c2c">E2</text>
      <rect x="500" y="120" width="60" height="80" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <text x="530" y="114" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" fill="#9b2c2c">E3</text>
      <rect x="570" y="196" width="14" height="4" fill="#f5f2ec" stroke="#cfc6b6" stroke-width="1"/>
      <rect x="588" y="196" width="14" height="4" fill="#f5f2ec" stroke="#cfc6b6" stroke-width="1"/>
      <rect x="606" y="196" width="14" height="4" fill="#f5f2ec" stroke="#cfc6b6" stroke-width="1"/>
      <text x="360" y="214" font-family="ui-monospace, monospace" font-size="9.5" fill="#a49a8c">其余 253 个专家使用率 ≈ 0</text>
      <!-- 底部说明 -->
      <rect x="16" y="250" width="628" height="94" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="30" y="274" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">门控正反馈是坍缩的根因</text>
      <text x="30" y="296" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">某些专家偶然表现更好 → 门控更偏向它们 → 它们被训练得更好 → 进一步被偏向。</text>
      <text x="30" y="316" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">结果：花 671B 显存，只用上约 37B 有效容量。解法：加负载均衡损失强制使用率均匀。</text>
      <text x="30" y="336" font-family="ui-monospace, monospace" font-size="10" fill="#9b2c2c">判据：看每个专家的使用次数分布，若少数专家占比极高即已坍缩。</text>
    </svg>
  </div>
  <figcaption><b>图 3</b>　左图每个专家都参与训练，容量不浪费；右图少数专家承担绝大多数 token，其余形同虚设。<b>坍缩不是网络崩溃，而是容量被白白浪费——这是 MoE 训练里最该监控的指标。</b></figcaption>
</figure>

## 四、专家怎么分布与并行

前面讲的是「单个 MoE 层里发生了什么」，这一节把镜头拉到**整个集群**——671B 的权重，物理上到底放在哪、怎么分工。这决定了一个 MoE 模型能不能上线、以及它为什么难本地化。

**第一个事实：总参数太大，单卡根本装不下。** 671B 参数按 fp16 算约 1.3 TB，远超单张 GPU 的显存（80GB 或更小）。所以专家必须被**切开放到多张卡**上——这就是[[expert-parallelism|专家并行]]（EP）：不同专家住在不同设备，门控网络选出专家后，token 要被送到对应设备上算。

**第二个事实：把专家分开，就引出了通信这个新代价。** 一个 token 被选中的两个专家可能分布在两张不同的卡上，于是每层都要做一次 [[all-to-all|All-to-All 通信]]：把各卡的 token 按「目标专家」重新分发，算完再送回原卡。这张图就是这一节要讲的「分布 + 通信」：

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 400" role="img" aria-label="专家并行：专家分布在不同设备，路由引发 All-to-All 通信">
      <defs>
        <marker id="arEP" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#2c4a7c"/>
        </marker>
      </defs>
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">专家并行：把专家摊到多张卡，换来 All-to-All</text>
      <text x="16" y="38" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">GPU 0/1/2/3 各装一部分专家；一个 token 被选中的专家可能不在本卡 → 必须跨卡搬运</text>
      <!-- 四张卡 -->
      <rect x="40" y="70" width="130" height="150" fill="#eef1f7" stroke="#2c4a7c" stroke-width="1.3"/>
      <text x="105" y="90" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#2c4a7c">GPU 0</text>
      <text x="105" y="108" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">专家 0–63</text>
      <rect x="200" y="70" width="130" height="150" fill="#eef1f7" stroke="#2c4a7c" stroke-width="1.3"/>
      <text x="265" y="90" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#2c4a7c">GPU 1</text>
      <text x="265" y="108" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">专家 64–127</text>
      <rect x="360" y="70" width="130" height="150" fill="#eef1f7" stroke="#2c4a7c" stroke-width="1.3"/>
      <text x="425" y="90" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#2c4a7c">GPU 2</text>
      <text x="425" y="108" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">专家 128–191</text>
      <rect x="520" y="70" width="130" height="150" fill="#eef1f7" stroke="#2c4a7c" stroke-width="1.3"/>
      <text x="585" y="90" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#2c4a7c">GPU 3</text>
      <text x="585" y="108" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">专家 192–255</text>
      <!-- token 在 GPU 0，被选中专家在 GPU 1 和 GPU 3 -->
      <rect x="76" y="140" width="58" height="28" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.2"/>
      <text x="105" y="158" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" font-weight="700" fill="#9b2c2c">token</text>
      <!-- 箭头到 GPU 1 和 GPU 3 -->
      <path d="M134 154 C 170 154, 180 100, 200 96" fill="none" stroke="#2c4a7c" stroke-width="1.2" marker-end="url(#arEP)"/>
      <path d="M134 154 C 300 170, 440 140, 520 100" fill="none" stroke="#2c4a7c" stroke-width="1.2" stroke-dasharray="4 3" marker-end="url(#arEP)"/>
      <text x="150" y="128" font-family="ui-monospace, monospace" font-size="9" fill="#2c4a7c">选到专家 88（GPU 1）</text>
      <text x="300" y="130" font-family="ui-monospace, monospace" font-size="9" fill="#2c4a7c">选到专家 200（GPU 3）→ 跨卡搬运</text>
      <!-- 底部说明 -->
      <rect x="16" y="240" width="628" height="86" fill="#eef1f7" stroke="#2c4a7c" stroke-width="1.2"/>
      <text x="30" y="264" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#2c4a7c">「专家并行」是一组取舍</text>
      <text x="30" y="286" font-family="ui-monospace, monospace" font-size="9.8" fill="#6b6257">并行度越高（专家分得越散）→ 单卡显存压力越小，但 All-to-All 通信越频繁、延迟越高。</text>
      <text x="30" y="304" font-family="ui-monospace, monospace" font-size="9.8" fill="#6b6257">稠密模型只需同层数据并行，没有这种跨设备点对点搬运——这是 MoE 难本地化的根因。</text>
      <text x="30" y="320" font-family="ui-monospace, monospace" font-size="9.8" fill="#9b2c2c">判据：小 batch 时每个专家分到的 token 极少，GPU 算力空转，通信固定开销照付 → 性价比缩水。</text>
    </svg>
  </div>
  <figcaption><b>图 4</b>　专家分散在多卡上，token 被选中的专家若不在本卡，就要跨卡搬运（All-to-All）。<b>「专家并行度」就是在「显存压力」和「通信开销」之间拉的那根尺子——这也是 MoE 只适合云端大集群、难以下沉本地的物理原因。</b></figcaption>
</figure>

由此引出三个可直接用于选型与面试的结论：

- **专家并行度和通信开销成正比。** 专家分得越散（并行度越高），单卡显存越省，但每层 All-to-All 的固定开销越高。部署时要在「显存装得下」和「通信扛得住」之间找平衡点，不是越高越好。
- **这解释了「MoE 延迟不如吞吐」的深层原因。** 单请求延迟被跨卡搬运拖累，但高并发下大量 token 可以「凑成一批」一起分发，通信被摊薄，吞吐反而高。所以 MoE 适合高并发、可批量的云端，不适合低并发、强延迟敏感的本地。
- **「未激活的专家」不是可以卸载的。** 有人会问：能不能把没选到的专家换出显存、省显存？答案是否定的——路由是运行时动态决定的，你无法预知下一个 token 会选谁；换入换出的代价远高于常驻。所以显存下限始终由**总参数量**决定，专家并行只是把这份「必须常驻」的总量**分摊**到多张卡，而不是削减它。

这一节补上了 MoE 成本结构的最后一块拼图：**容量看总数、算力看激活、显存看总数、通信看并行度**。记住这四句，MoE 相关的面试题基本都能兜住。

## 五、动手：三十行感受一次路由

```python title="moe_router.py"
import numpy as np
def softmax(x, axis=-1):
    m = x.max(axis=axis, keepdims=True)
    e = np.exp(x - m)
    return e / e.sum(axis=axis, keepdims=True)
class MoELayer:
    def __init__(self, d_model=16, n_experts=8, top_k=2, seed=0):
        rng = np.random.default_rng(seed)
        self.top_k = top_k
        # 门控权重 [d_model, n_experts]
        self.Wg = rng.normal(size=(d_model, n_experts)) / np.sqrt(d_model)
        # 每个专家的权重 [n_experts, d_model, d_model]
        self.experts = rng.normal(size=(n_experts, d_model, d_model)) / np.sqrt(d_model)
    def forward(self, x):
        """x: [n_tokens, d_model]"""
        gates = softmax(x @ self.Wg)                  # [n, n_experts]
        idx = np.argsort(-gates, axis=1)[:, :self.top_k]   # [n, top_k]
        out = np.zeros_like(x)
        for t in range(x.shape[0]):
            acc = np.zeros(x.shape[1])
            w_sum = gates[t, idx[t]].sum()             # 重归一化，保证权重和为 1
            for e in idx[t]:
                acc += (gates[t, e] / w_sum) * (x[t] @ self.experts[e])
            out[t] = acc
        # 专家利用率统计 —— 这是训练稳定性的关键观察指标
        used, counts = np.unique(idx, return_counts=True)
        self.last_usage = dict(zip(used.tolist(), counts.tolist()))
        return out
layer = MoELayer()
x = np.random.default_rng(1).normal(size=(64, 16))
y = layer.forward(x)
print('输出形状:', y.shape)          # (64, 16)，与输入一致
print('专家使用次数:', layer.last_usage)   # 观察是否集中在少数专家身上
```



<div class="box box-practice">
  <span class="box-title">实操任务</span>
  <ul>
    <li>把 <code>n_experts</code> 从 8 调到 64，观察 <code>last_usage</code> 的长尾分布——你会看到少数专家被反复选中，这就是「路由坍缩」；</li>
    <li>加上一个负载均衡项：统计每个专家的使用次数，对过度使用的专家施加惩罚，再跑一次；</li>
    <li>计算「激活参数量占比」：<code>top_k / n_experts</code>，并说明它与「每 token 算力」和「显存占用」分别是什么关系。</li>
  </ul>
</div>

## 六、常见误区与追问

### 6.1 误区：MoE 因为只激活部分专家，所以显存也省了

错在哪：把「不计算」等同于「不占显存」。为什么自然：直觉上「没用到的东西就不用准备」，符合常识。正确做法：路由是运行时按输入动态决定的，你无法预知下一个 token 会走哪个专家，所以**所有专家权重必须常驻显存**。MoE 压的是每 token 的 FLOPs，不是权重的存储体积。**判据：被问「未激活专家能不能卸载到磁盘省显存」时，答案是否定的——除非你能接受极慢的换入换出，否则显存下限仍由总参数量（671B）决定。**

### 6.2 误区：拿总参数量去和稠密模型比成本

错在哪：用 671B 的总参数去断言「这个模型比 70B 稠密贵一个量级」。为什么自然：总参数确实大一个量级，直觉成立。正确做法：比单 token 成本要看**激活参数量（37B）**，比容量/显存才看总参数（671B）。**判据：比成本比激活，比容量比总参；一句话说清「这模型单 token 算力≈一个 37B 稠密，但显存门槛≈一个 671B 稠密」。混用两个口径必然得出相反结论。**

### 6.3 误区：稀疏激活 ≈ 稀疏注意力

错在哪：把「稀疏」两个字当成同一种技术。为什么自然：中文都叫稀疏，容易并类。正确做法：MoE 的稀疏是**参数/专家层面的稀疏激活**（每个 token 只走少数专家），稀疏注意力是**注意力矩阵层面的稀疏**（只算部分位置对）。两者解决不同瓶颈、属于不同技术线，不能互相替代。**判据：问「它改的是哪一步」——MoE 改的是 FFN/专家选择，稀疏注意力改的是 QKᵀ 的 [n,n] 计算。**

### 6.4 误区：路由坍缩只是训练不稳，不影响上线

错在哪：认为坍缩只是训练期现象，推理时无所谓。为什么自然：推理时路由照常工作，输出看起来正常。正确做法：坍缩意味着少数专家承担了绝大多数 token，**其余专家形同虚设——等于你付了 671B 显存，只用了约 37B 的有效容量**。这是纯粹的成本浪费，且会让容量上限被悄悄锁死。**判据：上线前统计各专家在真实流量上的使用次数分布；若基尼系数高（少数专家占比超 80%），说明已坍缩，需要回炉训练加负载均衡损失。**

### 6.5 误区：MoE 延迟一定比同激活量稠密模型更低

错在哪：把「吞吐高」等同于「延迟低」。为什么自然：单位时间处理更多 token，听起来更快。正确做法：单请求延迟受 **All-to-All 跨设备通信** 拖累，往往比同激活量的稠密模型更慢；MoE 的优势在**吞吐**（高并发下单位成本更低），不在单请求延迟。**判据：高并发、可批量 → 用 MoE 划算；低并发、强延迟敏感、要本地化 → 稠密模型反而更合适。**

### 6.6 误区：每个专家是一个「领域专家」

错在哪：按字面把 expert 理解成「懂金融的专家」「懂代码的专家」。为什么自然：中文「专家」自带领域含义。正确做法：专家只是层内的一个**前馈子网络**，门控网络按 token 的表示动态选 top-k，并不按主题分工；同一个专家在不同 token 上可能扮演不同角色。<strong>判据：想验证，就看消融实验——打乱专家分配标签，模型表现基本不变，说明专家没有稳定的「主题身份」。</strong>

## 七、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>第 1 题是高频陷阱题</span></div>
  <div class="q-item" data-qid="llm03-q1" data-answer="2">
    <div class="q-text"><span class="idx">Q1</span>MoE 通过稀疏激活省下了什么？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>显存占用，因为未激活的专家可以卸载到磁盘</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>训练数据量，因为每个专家只学一部分知识</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>每 token 的计算量；显存下限仍由总参数量决定</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>注意力部分的平方复杂度</span></button>
    <div class="explain"><b>C。</b>路由是运行时决定的，无法预知下一个 token 会走哪个专家，所以全部权重必须常驻。<b>MoE 解耦的是「容量」与「算力」，不是「容量」与「显存」。</b>另外它完全不改变注意力的平方复杂度——那是另一条独立的技术路线（稀疏注意力 / 线性注意力）要解决的问题。</div>
  </div>
  <div class="q-item" data-qid="llm03-q2" data-answer="1">
    <div class="q-text"><span class="idx">Q2</span>为什么 MoE 模型在 batch 很小的时候性价比优势会缩水？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>因为小 batch 时专家权重无法加载到显存</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>因为 token 太少，被激活的专家集合稀疏且不重叠，硬件利用率低、通信开销占比高</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>因为门控网络在小 batch 下会失效</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>小 batch 时 MoE 会退化成稠密模型</span></button>
    <div class="explain"><b>B。</b>MoE 的效率来自「把大量 token 一次性分发到各专家，让每个专家都有活干」。batch 小的时候，每个专家分到的 token 可能只有一两个，算力利用率大幅下降，而 All-to-All 通信的固定开销不会等比例减少。<b>这是「MoE 适合高吞吐、不适合低并发」的物理原因。</b></div>
  </div>
  <div class="q-item" data-qid="llm03-q3" data-answer="3">
    <div class="q-text"><span class="idx">Q3</span>路由坍缩（routing collapse）指的是什么现象？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>模型对长输入的注意力权重全部趋近于 0</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>专家数量在训练中自动减少</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>门控网络的输出分布逐渐变成均匀分布</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>门控网络倾向于反复选择少数几个专家，其余专家几乎不被训练，容量被浪费</span></button>
    <div class="explain"><b>D。</b>训练早期若某些专家偶然表现更好，门控会更偏向它们，形成正反馈，最终少数专家承担绝大部分 token，其余专家形同虚设——等于花了 671B 的显存，只用了 37B 的有效容量。<b>标准解法是加负载均衡损失（auxiliary load balancing loss）强制使用率均匀。</b></div>
  </div>
</div>

## 八、小结

| 你要能回答的问题 | 一句话答案 |
| --- | --- |
| MoE 省什么 | 省每 token 的计算量（FLOPs），不省显存 |
| MoE 贵在哪 | 显存下限高、跨设备 All-to-All 通信、训练需要负载均衡 |
| 什么时候 MoE 划算 | 高并发、高吞吐的云端推理场景 |
| 什么时候不划算 | 低并发、强延迟敏感、本地化部署 |
| 专家并行（EP）是什么 | 把专家摊到多张卡，用 All-to-All 通信换单卡显存——并行度越高，通信越贵 |
| 与 KV Cache 的关系 | 完全独立：KV Cache 管的是历史复用，MoE 管的是参数复用 |

一句话记住成本结构：**容量看总数、算力看激活、显存看总数、通信看并行度**。

下一章换个更贴近日常的问题：既然输出是采样出来的，那「同一个问题问两次答案不同」到底该不该修，以及怎么修。

## 九、参考与延伸

本章机制部分只讲到「够用」为止。想往下深挖，下面按「先看图、再看代码、最后读论文」的顺序排好了。全站不做原文转载，这里只登记链接与「为什么值得读」。

<strong>先看图（建立直觉）</strong>

- [Switch Transformers（arXiv:2101.03961）](https://arxiv.org/abs/2101.03961) —— 先只看它的 Figure 1：token → 门控 → top-k 专家 → 加权，MoE 层最经典的那张结构图就在这里。<strong>对着它再看本章第二节的图 1，「未选中的专家仍然占着显存、只是不参与计算」会立刻变具体；负载均衡损失与专家容量这两个概念也出自这篇，想深挖再读正文。</strong>

<strong>再看代码（动手实现）</strong>

- [动手学深度学习（中文，zh.d2l.ai）](https://zh.d2l.ai/) —— 配套可跑代码，把注意力、路由、专家选择都实现了一遍。<strong>把本章的 MoE 路由脚本照着敲一遍，比看十遍都记得牢。</strong>

<strong>最后读论文（对齐一手定义）</strong>

- [Mixtral of Experts（arXiv:2401.04088）](https://arxiv.org/abs/2401.04088) —— 开源 MoE 模型的一手技术报告。<strong>重点看它怎么设置每 token 激活的专家数（top-k），以及稀疏激活比例怎么影响成本；本章「激活参数量只占总量一小部分」在它身上有具体数字。</strong>
- [DeepSeek-V3 Technical Report（arXiv:2412.19437）](https://arxiv.org/abs/2412.19437) —— 本章那组「671B 总参 / 37B 激活」的数字就出自这里。它用的是 DeepSeekMoE + MLA，并提出 <strong>auxiliary-loss-free 的负载均衡策略</strong>——不加辅助损失也能压住坍缩。<strong>想知道工业界怎么在保住吞吐的前提下平衡专家负载，看它第 4 节。</strong>
