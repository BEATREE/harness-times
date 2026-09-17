---
chapter: llm-04-sampling
lead: '同一个问题问两遍得到不同答案，这不是缺陷，是解码策略的必然结果。但在 Agent 里，这种不确定性会以最讨厌的方式暴露出来：工具参数填错、JSON 少一个大括号、同一个任务两次跑出不同的步骤数。这一章讲清每个采样参数到底在动什么，以及哪些地方必须确定、哪些地方必须不确定。'
note: '读完请务必记住一条工程纪律：需要结构化输出的地方，temperature 应该是 0（或极低），而不是「调低一点」。'
---

<p class="dropcap">模型输出不是一个答案，而是一个概率分布。每一步它给出词表上每个 token 的概率，然后由解码策略从中挑一个出来。所谓「温度」「top-p」，都是在改这个挑选过程。理解这一点，你就能判断哪些不确定性是可修的、哪些是不可修的。</p>

## 一、模型实际吐出的是什么

在最后一层之后，模型给出的是 logits——词表大小（通常 10 万量级）的一个向量，每个位置一个分数。经过 softmax 变成概率分布。

一个必须建立的直觉：**模型从来没有「想好了一个答案」，它只是不断地在每一步给出一个分布，然后从里面抽一个。** 所谓「生成」，是抽样的累加。

<div class="tbl-wrap">
  <table class="news">
    <caption>解码参数：各自在动什么</caption>
    <thead><tr><th>参数</th><th>作用位置</th><th>在做什么</th><th>调高 / 调低的后果</th></tr></thead>
    <tbody>
      <tr><td><code>temperature</code></td><td>softmax 之前</td><td>给 logits 除以 T：T&lt;1 让分布更尖锐，T&gt;1 让分布更平坦</td><td>调低 → 更确定、更保守、也更容易陷入重复；调高 → 更发散、更有创意，也更容易跑偏</td></tr>
      <tr><td><code>top_p</code>（核采样）</td><td>softmax 之后</td><td>按概率从高到低累加，只保留累计到 p 的那批候选，其余丢弃</td><td>调低 → 候选集变小，输出收敛；调高 → 保留更多长尾可能</td></tr>
      <tr><td><code>top_k</code></td><td>softmax 之后</td><td>固定只保留概率最高的 k 个候选</td><td>与 top_p 作用类似；但 k 固定，遇到分布极尖或极平时表现不一致</td></tr>
      <tr><td><code>repetition_penalty</code></td><td>logits 修正</td><td>对已出现过的 token 降低其分数</td><td>轻微使用可缓解复读；过强会破坏专有名词与代码标识符的重复出现</td></tr>
      <tr><td><code>seed</code></td><td>随机数源</td><td>固定采样用的随机序列</td><td>同一 seed + 同一请求 + 同一后端版本 → 可复现；换后端可能失效</td></tr>
    </tbody>
  </table>
</div>

## 二、temperature 与 top_p 的区别

这两个参数经常被混着用，但它们动的是分布的两个不同阶段。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 340" role="img" aria-label="temperature 改变分布形状，top_p 截断分布尾部">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">温度改「形状」，top-p 改「范围」</text>
      <!-- 原始分布 -->
      <text x="30" y="46" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">原始 logits 经 softmax（T=1）</text>
      <g>
        <rect x="30" y="140" width="26" height="70"  fill="#1f1b16"/>
        <rect x="62" y="152" width="26" height="58"  fill="#1f1b16"/>
        <rect x="94" y="170" width="26" height="40"  fill="#1f1b16"/>
        <rect x="126" y="182" width="26" height="28" fill="#1f1b16"/>
        <rect x="158" y="192" width="26" height="18" fill="#1f1b16"/>
        <rect x="190" y="198" width="26" height="12" fill="#1f1b16"/>
        <rect x="222" y="203" width="26" height="7"  fill="#1f1b16"/>
        <rect x="254" y="206" width="26" height="4"  fill="#1f1b16"/>
      </g>
      <line x1="26" y1="210" x2="286" y2="210" stroke="#1f1b16" stroke-width="1"/>
      <text x="30" y="226" font-family="ui-monospace, monospace" font-size="9" fill="#a49a8c">候选 token（按概率降序）→</text>
      <!-- T 小 -->
      <text x="330" y="46" font-family="ui-monospace, monospace" font-size="10" fill="#2f6157">T = 0.2　分布更尖</text>
      <g>
        <rect x="330" y="96" width="26" height="114" fill="#2f6157"/>
        <rect x="362" y="188" width="26" height="22" fill="#2f6157"/>
        <rect x="394" y="202" width="26" height="8"  fill="#2f6157"/>
        <rect x="426" y="207" width="26" height="3"  fill="#2f6157"/>
        <rect x="458" y="208" width="26" height="2"  fill="#2f6157"/>
        <rect x="490" y="209" width="26" height="1"  fill="#2f6157"/>
      </g>
      <line x1="326" y1="210" x2="586" y2="210" stroke="#1f1b16" stroke-width="1"/>
      <text x="330" y="226" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">几乎总选第一个 → 确定性高，但可能复读</text>
      <!-- T 大 -->
      <text x="30" y="256" font-family="ui-monospace, monospace" font-size="10" fill="#9b2c2c">T = 1.5　分布更平</text>
      <g>
        <rect x="30" y="286" width="26" height="38" fill="#9b2c2c"/>
        <rect x="62" y="290" width="26" height="34" fill="#9b2c2c"/>
        <rect x="94" y="296" width="26" height="28" fill="#9b2c2c"/>
        <rect x="126" y="299" width="26" height="25" fill="#9b2c2c"/>
        <rect x="158" y="302" width="26" height="22" fill="#9b2c2c"/>
        <rect x="190" y="305" width="26" height="19" fill="#9b2c2c"/>
        <rect x="222" y="307" width="26" height="17" fill="#9b2c2c"/>
        <rect x="254" y="309" width="26" height="15" fill="#9b2c2c"/>
      </g>
      <line x1="26" y1="324" x2="286" y2="324" stroke="#1f1b16" stroke-width="1"/>
      <text x="30" y="338" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">长尾也被抬起来 → 发散，但容易胡言</text>
      <!-- top_p 示意 -->
      <text x="330" y="256" font-family="ui-monospace, monospace" font-size="10" fill="#8a6a1e">top_p = 0.9　截断尾部</text>
      <rect x="330" y="266" width="230" height="26" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <text x="445" y="283" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="#8a6a1e">保留：累计概率到 0.9 为止</text>
      <rect x="330" y="296" width="76" height="26" fill="#f5f2ec" stroke="#cfc6b6" stroke-width="1" stroke-dasharray="3 2"/>
      <text x="368" y="313" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" fill="#a49a8c">丢弃 10%</text>
      <text x="416" y="313" font-family="ui-monospace, monospace" font-size="9.5" fill="#6b6257">← 这些低概率 token 不再可能被选中</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　温度在 softmax 之前缩放 logits，改变整条分布曲线的<b>陡峭程度</b>；top-p 在 softmax 之后按累计概率切一刀，改变的是<b>可被选中的候选范围</b>。两者可以叠加使用，但叠加时要注意：高温 + 高 top-p 会让输出非常不稳。</figcaption>
</figure>

## 三、Agent 场景下的确定性纪律

这是本章最有工程价值的一节。把 Agent 里所有调用模型的地方按「要不要确定性」分两类：

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>调用类型</th><th>推荐设置</th><th>原因</th></tr></thead>
    <tbody>
      <tr><td>工具调用 / 参数生成</td><td>temperature 0，top_p 尽可能低</td><td>参数写错就执行失败，没有「创意」的余地</td></tr>
      <tr><td>结构化输出（JSON / YAML）</td><td>temperature 0 + 强制 schema</td><td>格式错误直接导致解析异常，会引发重试与成本翻倍</td></tr>
      <tr><td>意图分类 / 路由</td><td>temperature 0</td><td>同一句话应该稳定路由到同一条链路，便于复现问题</td></tr>
      <tr><td>代码生成</td><td>temperature 0 ~ 0.2</td><td>可验证（能跑通），不需要多样性；低温度减少无意义的变体</td></tr>
      <tr><td>方案探索 / 头脑风暴</td><td>temperature 0.7 ~ 1.0</td><td>此时多样性本身就是产出，需要多个不同的候选</td></tr>
      <tr><td>文案润色</td><td>temperature 0.5 左右</td><td>既要稳定风格，又要避免套话</td></tr>
    </tbody>
  </table>
</div>

<div class="box box-warn">
  <span class="box-title">temperature = 0 并不等于完全确定</span>
  <p>即使温度设为 0（即每步都取概率最高的 token，greedy 解码），同一请求在不同条件下仍可能得到不同结果：</p>
  <ul>
    <li><b>浮点非确定性</b>：批处理中不同 token 与其他请求拼在同一次前向里，累加顺序变化会导致极小的数值差异，在分布接近的两个 token 之间翻转；</li>
    <li><b>后端版本变化</b>：推理框架升级、量化版本更换，都会改变 logits 的微小差异；</li>
    <li><b>前缀缓存命中与否</b>：不同计算路径同样可能带来微小数值差异。</li>
  </ul>
  <p><b>所以正确的表述是：temperature=0 让结果「几乎确定」，但工程上必须假设它可能变化——不能把正确性建立在「它一定一样」上面。</b></p>
</div>

## 四、让输出可控的三种手段

既然模型输出本质是概率性的，工程上就要用「约束」而不是「祈祷」。按强度从弱到强：

**第一层：低温度。** 最简单，但只是降低概率，不提供任何保证。

**第二层：JSON Schema / 结构化输出约束。** 在解码时限制每个位置只能取合法 token（例如进入字符串状态就只能取字符串字符）。这是真正意义上的强制，失败率极低。大多数现代 API 都支持 `response_format` 或 `tool_calls` 这类约束通道。

**第三层：后置校验 + 有限重试。** 无论前面怎么做，都要在拿到结果后做一次校验（能否解析、字段是否齐全、取值范围是否合法）。校验失败时的重试必须带「上一次错在哪」的信息，否则只是重复同样的错误。

<div class="code-block">
  <div class="code-head"><span>constrained_tool_call.py</span><span class="lang">python</span></div>
  <pre><code>import json
from typing import Any
TOOL_SCHEMA = {
    "type": "object",
    "properties": {
        "city":   {"type": "string"},
        "unit":   {"type": "string", "enum": ["celsius", "fahrenheit"]},
        "days":   {"type": "integer", "minimum": 1, "maximum": 7},
    },
    "required": ["city", "unit", "days"],
    "additionalProperties": False,
}
def call_model(messages, temperature: float):
    """占位：真实调用里把 temperature 和 response_format 一起传下去"""
    raise NotImplementedError
def validated_tool_call(messages, retries: int = 2) -> dict[str, Any] | None:
    """
    三层防线的落地：
      1. temperature=0 + 结构化输出约束（由 API 保证格式）
      2. 本地 schema 校验（参数完整性、取值范围）
      3. 带错误信息的有限重试（而不是盲目重试）
    """
    local = list(messages)
    for attempt in range(retries + 1):
        raw = call_model(local, temperature=0)
        try:
            args = json.loads(raw) if isinstance(raw, str) else raw
        except json.JSONDecodeError as e:
            local.append({"role": "user",
                          "content": f"上一次输出不是合法 JSON（{e}），请只输出 JSON 对象。"})
            continue
        err = validate(args, TOOL_SCHEMA)
        if err is None:
            return args
        # 关键：把具体错在哪回喂，模型才能真正修正
        local.append({"role": "user",
                      "content": f"参数校验失败：{err}。请修正后重新输出完整参数。"})
    return None      # 明确失败，交由上层决定是降级还是转人工
def validate(obj: dict, schema: dict) -> str | None:
    """极简校验：只示意逻辑，生产环境请用 pydantic / jsonschema"""
    for key in schema.get("required", []):
        if key not in obj:
            return f"缺少必填字段 {key}"
    if obj.get("unit") not in schema["properties"]["unit"]["enum"]:
        return f"unit 取值非法：{obj.get('unit')}"
    if not isinstance(obj.get("days"), int) or not 1 &lt;= obj["days"] &lt;= 7:
        return f"days 必须是 1-7 的整数，当前为 {obj.get('days')}"
    return None
</code></pre>
</div>

<div class="box box-practice">
  <span class="box-title">实操任务</span>
  <ul>
    <li>拿一个真实的任务，把 temperature 设成 0、0.7、1.2 各跑 10 次，记录<b>参数完全一致的次数</b>；</li>
    <li>统计「重试时把错误信息回喂」与「不带信息重试」的成功率差异——通常会差 20 个百分点以上；</li>
    <li>写一句话说明：为什么在 Agent 里，<code>temperature=0</code> 之外还必须做校验？</li>
  </ul>
</div>

## 五、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>答错的题请回看第三节的表格</span></div>
  <div class="q-item" data-qid="llm04-q1" data-answer="1">
    <div class="q-text"><span class="idx">Q1</span>temperature 与 top-p 分别作用在什么位置？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>两者都作用在 softmax 之后，效果等价</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>temperature 在 softmax 之前缩放 logits，改变分布形状；top-p 在 softmax 之后按累计概率截断候选集</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>temperature 在 softmax 之后，top-p 在之前</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>两者都作用在 softmax 之前，共同决定 logits</span></button>
    <div class="explain"><b>B。</b>顺序很重要：温度先改分布形状，top-p 再在改过的分布上切一刀。这个顺序解释了一个常见现象——<b>高温度会让原本概率很低的 token 被抬到 top-p 的保留范围内</b>，所以「高温 + 高 top-p」是最不稳定的组合。</div>
  </div>
  <div class="q-item" data-qid="llm04-q2" data-answer="2">
    <div class="q-text"><span class="idx">Q2</span>为什么把 temperature 设为 0 仍不能保证输出完全一致？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>因为 API 会忽略这个参数</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>因为温度 0 时模型会随机挑一个并列最高的 token</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>因为批处理中浮点累加顺序、后端版本、缓存命中路径等因素会带来微小数值差异，可能在两个接近的候选之间翻转</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>因为模型权重每次加载都会重新随机初始化</span></button>
    <div class="explain"><b>C。</b>这是非常实用的一条知识：即使 greedy 解码，工程上仍必须假设结果可能变化。由此推出的纪律是——<b>不要把系统的正确性建立在「模型每次输出一样」上，而要建立在校验与幂等之上。</b></div>
  </div>
  <div class="q-item" data-qid="llm04-q3" data-answer="0">
    <div class="q-text"><span class="idx">Q3</span>工具调用参数解析失败后，哪种重试方式最有效？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>把具体的校验错误信息追加到对话里，要求模型修正后重新输出完整参数</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>用完全相同的请求重试三次</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>直接把 temperature 调高以增加多样性</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>跳过参数校验，让下游自己容错</span></button>
    <div class="explain"><b>A。</b>无信息重试等于重复同一件事，成功率提升极小。<b>错误信息回喂把「一次采样」变成了「一次带反馈的修正」</b>，这是 Agent 重试逻辑里性价比最高的改动。注意 C 是反向操作：参数生成场景应该保持低温。</div>
  </div>
</div>

## 六、小结

- 模型输出的是分布，不是答案；解码策略决定怎么从分布里挑。
- 温度改「多平」，top-p 改「多宽」；两者叠加时要注意极端组合。
- Agent 里凡是需要结构化结果的地方，一律低温 + 强约束 + 校验 + 带反馈的有限重试。
- temperature=0 只是「几乎确定」，工程上不能依赖「一定一致」。

<p class="pull-quote">不确定性本身不是问题，把不确定性当成确定性来用才是问题。<cite>本刊编辑部</cite></p>

到这里，模型原理部分还差最后一块拼图：既然算力与显存都这么贵，工业界到底用什么手段把成本打下来？
