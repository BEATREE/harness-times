---
chapter: llm-03-moe
lead: '一个 671B 总参数的模型，为什么在成本上能和几十 B 的稠密模型打平？答案藏在两个数字之间的那条缝里：总参数量与激活参数量。理解这条缝，你就能解释模型选型里最反直觉的那些现象。'
note: '本章最容易答错的是一道看似简单的推理题：稀疏激活省的是算力还是显存？请务必读到最后一节。'
---

<p class="dropcap">模型参数有两个口径，混用会让人得出完全相反的结论。第一个是总参数量——模型文件有多大，要占多少显存去装。第二个是激活参数量——每生成一个 token，实际参与计算的有多少。稠密模型里这两个数字相等；MoE（混合专家）把它们拆开了。</p>

## 一、两个数字之间的缝

设一个 MoE 模型有 256 个专家，每个专家约 2.6B 参数，每层路由激活其中 8 个。

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

一句话概括 MoE 的交易：**用显存和通信换算力效率**。参数总量上去了（容量变大），但每个 token 的计算量没跟着上去。

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
- **MoE 的延迟优势不如吞吐优势明显。** 单请求延迟受 All-to-All 通信影响，可能反而比同激活量的稠密模型更慢；但吞吐（单位时间处理 token 数）会好很多。
- **MoE 对 batch 敏感。** batch 越大，专家利用率越高，单位成本越低。这解释了为什么小 batch 场景下 MoE 的性价比优势会缩水。

## 四、动手：三十行感受一次路由

<div class="code-block">
  <div class="code-head"><span>moe_router.py</span><span class="lang">python</span></div>
  <pre><code>import numpy as np
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
</code></pre>
</div>

<div class="box box-practice">
  <span class="box-title">实操任务</span>
  <ul>
    <li>把 <code>n_experts</code> 从 8 调到 64，观察 <code>last_usage</code> 的长尾分布——你会看到少数专家被反复选中，这就是「路由坍缩」；</li>
    <li>加上一个负载均衡项：统计每个专家的使用次数，对过度使用的专家施加惩罚，再跑一次；</li>
    <li>计算「激活参数量占比」：<code>top_k / n_experts</code>，并说明它与「每 token 算力」和「显存占用」分别是什么关系。</li>
  </ul>
</div>

## 五、自测

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

## 六、小结

| 你要能回答的问题 | 一句话答案 |
| --- | --- |
| MoE 省什么 | 省每 token 的计算量（FLOPs），不省显存 |
| MoE 贵在哪 | 显存下限高、跨设备 All-to-All 通信、训练需要负载均衡 |
| 什么时候 MoE 划算 | 高并发、高吞吐的云端推理场景 |
| 什么时候不划算 | 低并发、强延迟敏感、本地化部署 |
| 与 KV Cache 的关系 | 完全独立：KV Cache 管的是历史复用，MoE 管的是参数复用 |

下一章换个更贴近日常的问题：既然输出是采样出来的，那「同一个问题问两次答案不同」到底该不该修，以及怎么修。
