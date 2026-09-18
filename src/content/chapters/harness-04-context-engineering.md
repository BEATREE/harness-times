---
chapter: harness-04-context-engineering
lead: 'Prompt Engineering 关心「话怎么说」，Context Engineering 关心「给它看什么」。前者影响措辞，后者决定判断依据是否齐全。而在有成本约束的系统里，上下文还是一项必须做预算的资源——什么常驻、什么按需、什么必须压缩，这三件事构成效果与成本的分水岭。'
note: '本章是全站篇幅最长的一章，因为它同时影响效果上限与成本下限。建议读完后来回看两遍图 1。'
---

<p class="dropcap">一个被反复验证的现象：把提示词从「请仔细分析」改成更花哨的措辞，效果几乎不动；而把该给的数据补齐、把无关的噪音删掉，效果会明显变化。原因很朴素——<b>模型只能基于看到的信息做判断，你不知道的信息它也不知道。</b></p>

## 一、上下文的四种成分

把一次请求的上下文拆开，实际上只有四类内容。分清这四类，[[context-engineering|上下文工程]] 的 [[context-budget|上下文预算]] 该给谁就有答案了——而真实判断依据的占比，就是 [[signal-to-noise|信噪比]]：

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>成分</th><th>内容</th><th>变化频率</th><th>建议策略</th></tr></thead>
    <tbody>
      <tr><td><b>指令</b></td><td>角色设定、行为约束、输出格式要求</td><td>几乎不变</td><td>常驻头部，保持字节稳定（前缀缓存友好）</td></tr>
      <tr><td><b>能力声明</b></td><td>工具定义、可用数据源说明</td><td>很少变</td><td>常驻，但要精简——工具描述本身占掉的 token 常被低估</td></tr>
      <tr><td><b>知识</b></td><td>检索到的资料、知识库片段、历史结论</td><td>每轮可能变</td><td>按需注入，<b>必须带来源与相关性标注</b></td></tr>
      <tr><td><b>状态</b></td><td>已完成的步骤、当前进度、中间产物、错误记录</td><td>每轮都变</td><td>外部化 + 摘要，不要全量堆在上下文里</td></tr>
    </tbody>
  </table>
</div>

**一个反直觉的观察**：真正吃掉上下文的大头通常是「状态」而不是「知识」。检索来的资料一般几千 token，而十几轮之后的对话历史 + 工具返回结果可以轻松到几十万 token。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 430" role="img" aria-label="上下文预算分配与三种压缩策略的对比">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">上下文预算：一张必须画的图</text>
      <text x="16" y="38" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">以 128k 窗口为例。关键不是「能装多少」，而是「装的东西有多少真正被用上」。</text>
      <!-- 分工条 -->
      <text x="16" y="62" font-family="ui-monospace, monospace" font-size="10" fill="#1f1b16">理想分工（按需增长）</text>
      <g>
        <rect x="16" y="70" width="120" height="34" fill="#1f1b16" stroke="#1f1b16"/>
        <text x="76" y="91" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" fill="#ffffff">指令 5%</text>
        <rect x="136" y="70" width="150" height="34" fill="#2f6157" stroke="#2f6157"/>
        <text x="211" y="91" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" fill="#ffffff">能力声明 6%</text>
        <rect x="286" y="70" width="230" height="34" fill="#b8944b" stroke="#b8944b"/>
        <text x="401" y="91" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" fill="#ffffff">按需注入的知识 18%</text>
        <rect x="516" y="70" width="128" height="34" fill="#eef4f1" stroke="#2f6157" stroke-width="1"/>
        <text x="580" y="91" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" fill="#2f6157">余量 71%</text>
      </g>
      <text x="16" y="122" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">余量不是浪费，它是留给「长任务跑得比预期久」的空间，也是留给模型推理的余量。</text>
      <!-- 现实条 -->
      <text x="16" y="152" font-family="ui-monospace, monospace" font-size="10" fill="#9b2c2c">没有治理时的现实（第 15 轮）</text>
      <g>
        <rect x="16" y="160" width="120" height="34" fill="#1f1b16"/>
        <text x="76" y="181" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" fill="#ffffff">指令 2%</text>
        <rect x="136" y="160" width="150" height="34" fill="#2f6157"/>
        <text x="211" y="181" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" fill="#ffffff">能力声明 3%</text>
        <rect x="286" y="160" width="120" height="34" fill="#b8944b"/>
        <text x="346" y="181" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" fill="#ffffff">知识 10%</text>
        <rect x="406" y="160" width="238" height="34" fill="#9b2c2c"/>
        <text x="525" y="181" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" fill="#ffffff">全量历史 + 工具返回值 85%</text>
      </g>
      <text x="16" y="212" font-family="ui-monospace, monospace" font-size="9.4" fill="#9b2c2c">→ 真实判断依据被噪音稀释到 10%，成本却已经涨了十几倍。这就是「越跑越笨」的机制。</text>
      <!-- 三种策略 -->
      <rect x="16" y="230" width="204" height="188" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <text x="30" y="250" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#8a6a1e">策略 ①　滚动窗口</text>
      <text x="30" y="270" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">只保留最近 N 轮，更早的直接丢</text>
      <text x="30" y="292" font-family="ui-monospace, monospace" font-size="9.2" fill="#2f6157">优点：实现最简单，成本可预测</text>
      <text x="30" y="312" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">缺点：早期关键约束被丢掉，</text>
      <text x="30" y="326" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">任务中段开始跑偏</text>
      <text x="30" y="350" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">适合：短任务、步骤间弱依赖</text>
      <text x="30" y="374" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">修补：把丢弃前的「结论」固化进</text>
      <text x="30" y="388" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">头部指令区，只丢过程不丢结论</text>
      <text x="30" y="410" font-family="ui-monospace, monospace" font-size="9.2" fill="#8a6a1e">推荐度：★★☆</text>
      <rect x="228" y="230" width="204" height="188" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="242" y="250" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#2f6157">策略 ②　阶段摘要</text>
      <text x="242" y="270" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">把已完成的段落压缩成结构化摘要</text>
      <text x="242" y="292" font-family="ui-monospace, monospace" font-size="9.2" fill="#2f6157">优点：保住关键结论，成本可控</text>
      <text x="242" y="312" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">缺点：摘要本身要花钱、要设计，</text>
      <text x="242" y="326" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">且摘要有信息损失</text>
      <text x="242" y="350" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">适合：中长任务、阶段性明显</text>
      <text x="242" y="374" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">要求：摘要必须有固定字段</text>
      <text x="242" y="388" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">（目标 / 已完成 / 结论 / 待办）</text>
      <text x="242" y="410" font-family="ui-monospace, monospace" font-size="9.2" fill="#2f6157">推荐度：★★★（最常用）</text>
      <rect x="440" y="230" width="204" height="188" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="454" y="250" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#9b2c2c">策略 ③　状态外置</text>
      <text x="454" y="270" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">中间产物写入文件，上下文只留指针</text>
      <text x="454" y="292" font-family="ui-monospace, monospace" font-size="9.2" fill="#2f6157">优点：上下文几乎不随轮次增长</text>
      <text x="454" y="312" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">缺点：需要文件系统与读写工具，</text>
      <text x="454" y="326" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">且模型要愿意去读</text>
      <text x="454" y="350" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">适合：长任务、大产出物</text>
      <text x="454" y="374" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">关键：文件名要能被模型读懂，</text>
      <text x="454" y="388" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">并在上下文里保留目录清单</text>
      <text x="454" y="410" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">推荐度：★★★（长任务必选）</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　上下文的「越跑越笨」不是模型退化，而是<b>信噪比下降</b>：真实判断依据的占比从 18% 被稀释到 10%，同时成本涨了十几倍。三种压缩策略要组合使用——短任务用滚动窗口，中长任务用阶段摘要，长任务必须叠加状态外置。</figcaption>
</figure>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 360" role="img" aria-label="上下文按稳定度递减排列，最大化前缀缓存命中">
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">稳定度递减排序，同时最大化前缀缓存命中</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">变化越少越靠前——前面不变，每轮共享同一个缓存前缀。</text>
      <rect x="70" y="60" width="520" height="38" fill="#1f1b16" stroke="#1f1b16"/>
      <text x="84" y="84" font-family="ui-monospace, monospace" font-size="9.6" fill="#ffffff">① 系统指令、行为约束（最稳定）</text>
      <rect x="70" y="102" width="520" height="38" fill="#2f6157" stroke="#2f6157"/>
      <text x="84" y="126" font-family="ui-monospace, monospace" font-size="9.6" fill="#ffffff">② 工具定义（顺序固定、字节稳定）</text>
      <rect x="70" y="144" width="520" height="38" fill="#3b6f63" stroke="#3b6f63"/>
      <text x="84" y="168" font-family="ui-monospace, monospace" font-size="9.6" fill="#ffffff">③ 长期知识 / 知识库摘要</text>
      <rect x="70" y="186" width="520" height="38" fill="#b8944b" stroke="#b8944b"/>
      <text x="84" y="210" font-family="ui-monospace, monospace" font-size="9.6" fill="#ffffff">④ 本任务目标与约束</text>
      <rect x="70" y="228" width="520" height="38" fill="#c9a85a" stroke="#c9a85a"/>
      <text x="84" y="252" font-family="ui-monospace, monospace" font-size="9.6" fill="#1f1b16">⑤ 已完成步骤的结构化摘要</text>
      <rect x="70" y="270" width="520" height="38" fill="#eef4f1" stroke="#2f6157" stroke-width="1"/>
      <text x="84" y="294" font-family="ui-monospace, monospace" font-size="9.6" fill="#2f6157">⑥ 本轮新信息（变化最频繁，放最后）</text>
      <line x1="50" y1="60" x2="50" y2="266" stroke="#9b2c2c" stroke-width="1.4"/>
      <text x="46" y="164" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" font-weight="700" fill="#9b2c2c" transform="rotate(-90 46 164)">每轮共享的前缀（命中缓存）</text>
    </svg>
  </div>
  <figcaption><b>图 2</b>　同样的上下文，换一下顺序，每轮的 KV Cache 命中率可以从近乎为零变成几乎全中。<b>把动态内容放前面，等于每轮都废掉前缀</b>——这是「上下文很贵」最容易被忽略的来源。</figcaption>
</figure>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 320" role="img" aria-label="知识三层级 fact/inference/opinion 的处理规则与信任度">
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">给知识标层级：fact / inference / opinion 处理不同</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">同一条检索内容，层级不同，模型该不该采信完全不同。</text>
      <rect x="16" y="58" width="628" height="70" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="30" y="80" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#2f6157">fact（事实）</text>
      <text x="30" y="100" font-family="ui-monospace, monospace" font-size="9.4" fill="#1f1b16">可溯源：可直接作为结论依据，附来源链接</text>
      <text x="560" y="80" font-family="ui-monospace, monospace" font-size="9.4" font-weight="700" fill="#2f6157">信任度 高</text>
      <rect x="16" y="134" width="628" height="70" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <text x="30" y="156" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#8a6a1e">inference（推断）</text>
      <text x="30" y="176" font-family="ui-monospace, monospace" font-size="9.4" fill="#1f1b16">带依据链：只能提供视角，不能当事实结论</text>
      <text x="560" y="156" font-family="ui-monospace, monospace" font-size="9.4" font-weight="700" fill="#8a6a1e">信任度 中</text>
      <rect x="16" y="210" width="628" height="70" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="30" y="232" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#9b2c2c">opinion（观点）</text>
      <text x="30" y="252" font-family="ui-monospace, monospace" font-size="9.4" fill="#1f1b16">用户/第三方说法：标注立场，降低权重</text>
      <text x="560" y="232" font-family="ui-monospace, monospace" font-size="9.4" font-weight="700" fill="#9b2c2c">信任度 低</text>
    </svg>
  </div>
  <figcaption><b>图 3</b>　不标层级，模型会把「某人随口说的观点」和「系统记录的事实」同等采信。<b>标注层级是把「可信度判断」所需的输入补给模型</b>，也是治理幻觉最有效的手段之一。</figcaption>
</figure>

## 二、顺序会影响成本：前缀稳定性

在第 5 章（KV Cache）里我们已经知道了规则，这里给出它在 Harness 里的落地版排序原则——排序的核心目的之一是让 [[prefix-cache|前缀缓存]] 命中率最大化：

<div class="tbl-wrap">
  <table class="news">
    <caption>上下文排列顺序（从上到下，稳定度递减）</caption>
    <thead><tr><th>位置</th><th>放什么</th><th>为什么放这里</th></tr></thead>
    <tbody>
      <tr><td>① 最前</td><td>系统指令、行为约束</td><td>最稳定，几乎永不变化，缓存命中率最高</td></tr>
      <tr><td>②</td><td>工具定义（顺序固定）</td><td>变化少；必须保证序列化后字节稳定</td></tr>
      <tr><td>③</td><td>长期知识 / 知识库摘要</td><td>更新频率低（天级即可）</td></tr>
      <tr><td>④</td><td>本任务的目标与约束</td><td>一轮内不变</td></tr>
      <tr><td>⑤</td><td>已完成步骤的结构化摘要</td><td>每轮会变，但内容被压缩，增长可控</td></tr>
      <tr><td>⑥ 最后</td><td>本轮新信息（用户输入、最新工具结果）</td><td>变化最频繁，放尾部让前面全部命中</td></tr>
    </tbody>
  </table>
</div>

<div class="box box-key">
  <span class="box-title">一条简洁的纪律</span>
  <p><b>把变化频率当成排序键：变化越少越靠前，变化越多越靠后。</b></p>
  <p>这条规则同时满足两个目标——前缀缓存命中率最大化（省成本），以及「离问题近的信息更被关注」（提效果）。当你不确定某段内容该放哪时，问自己是「每轮都变」还是「几乎不变」就够了。</p>
</div>

## 三、给知识加来源标注

检索到的内容如果不带来源，模型无从判断可信度，也无法在回答里给出可验证的引用。最小可行的做法是给每段知识打三个标签，也就是按 [[knowledge-tier|知识层级]] 标注它是事实、推断还是观点：

```python title="context_builder.py"
from dataclasses import dataclass
import json, time
@dataclass
class KnowledgeChunk:
    source: str          # 来源标识（可点开的链接或文件路径）
    updated_at: str      # 更新时间：模型据此判断时效
    tier: str            # fact（可溯源事实）| inference（推断）| opinion（观点）
    text: str
    score: float = 0.0   # 相关性得分，用于排序与截断
def render_knowledge(chunks: list[KnowledgeChunk], budget_chars: int = 6000) -> str:
    """
    按相关性排序、按预算截断，并且**每一条都带来源与层级**。
    来源不是装饰，它是模型判断「该不该相信」的依据。
    """
    if not chunks:
        return "（本次未检索到相关资料。若信息不足，请明确说明而不是猜测。）"
    ordered = sorted(chunks, key=lambda c: -c.score)
    lines, used = [], 0
    for c in ordered:
        block = (f"[{c.tier}] {c.text.strip()}\n"
                 f"    来源：{c.source}　更新时间：{c.updated_at}")
        if used + len(block) > budget_chars:
            break                      # 硬性截断，防单条超长资料挤爆预算
        lines.append(block)
        used += len(block)
    dropped = len(ordered) - len(lines)
    tail = f"\n（另有 {dropped} 条相关资料因预算限制未纳入。）" if dropped else ""
    return "\n\n".join(lines) + tail
def build_messages(
    instructions: str,
    tool_defs: list[dict],
    task: str,
    progress_summary: str,
    knowledge: list[KnowledgeChunk],
    new_input: str,
) -> list[dict]:
    """
    严格按「稳定度递减」排列，保证前缀缓存命中率最大化。
    注意：instructions 与 tool_defs 里绝对不能出现时间戳等动态内容。
    """
    stable_head = json.dumps(tool_defs, ensure_ascii=False, sort_keys=True)
    return [
        {"role": "system", "content": instructions},                     # ① 最稳定
        {"role": "system", "content": f"可用工具：\n{stable_head}"},      # ② 顺序固定
        {"role": "user", "content": f"任务目标：{task}"},                 # ④ 一轮内不变
        {"role": "user", "content": f"已完成步骤：\n{progress_summary}"},  # ⑤ 压缩后
        {"role": "user", "content": f"参考资料：\n{render_knowledge(knowledge)}"},  # ③/⑤
        {"role": "user", "content": new_input},                          # ⑥ 变化最频繁，放最后
    ]
def summarize_progress(steps: list[dict]) -> str:
    """
    阶段摘要必须结构化。自由文本摘要会越摘越糊。
    固定四段：目标 / 已完成 / 关键结论 / 待办
    """
    done = [s for s in steps if s.get("status") == "ok"]
    failed = [s for s in steps if s.get("status") not in ("ok", None)]
    return (
        f"· 已完成（{len(done)} 步）："
        + "；".join(f"{s['tool']}({s.get('brief','')})" for s in done[-8:])
        + f"\n· 失败/放弃（{len(failed)} 步）："
        + "；".join(f"{s['tool']}→{s.get('status')}" for s in failed[-5:])
        + "\n· 待办：见任务目标未覆盖的部分"
    )
```



## 四、什么时候该压缩：三个触发信号

不要等上下文满了才压——那时候往往已经来不及（压缩本身要花一次模型调用，而你已经没有余量了）。三个提前量信号对应三种策略：短任务用 [[rolling-window|滚动窗口]]，中长任务用 [[phase-summary|阶段摘要]]，长任务还要叠加 [[state-externalization|状态外置]]；单条超长结果则做 [[head-tail-truncation|头尾保留裁剪]]。这些都属于 [[compression-trigger|压缩触发信号]]：

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>信号</th><th>阈值建议</th><th>动作</th></tr></thead>
    <tbody>
      <tr><td>用量占比</td><td>达到窗口的 <b>60%</b></td><td>触发阶段摘要，把最早的一批步骤压成结构化条目</td></tr>
      <tr><td>单条超长</td><td>任一工具返回超过窗口的 <b>10%</b></td><td>立即做「头尾保留 + 中间省略」的裁剪，并标注省略了多少字符</td></tr>
      <tr><td>阶段边界</td><td>一个子任务完成时</td><td>主动固化结论、清理过程性内容（如中间试错的输出）</td></tr>
    </tbody>
  </table>
</div>

<div class="box box-practice">
  <span class="box-title">实操任务</span>
  <ul>
    <li>给你的 Harness 加一个「上下文占用监控」：每轮记录 <code>tokens_used / window</code>，跑一个长任务画出曲线；</li>
    <li>对比「60% 触发压缩」与「90% 触发压缩」两种策略下的任务完成率与总成本；</li>
    <li>写一段脚本验证前缀稳定性：连续两轮请求的字节前缀，第一个不同的位置应该出现在 90% 之后。</li>
  </ul>
  <p style="margin-top:10px"><b>验收标准：</b>能说出你的系统在 128k 窗口下、第 20 轮时的上下文构成（四类成分各占多少），并说明压缩在什么位置触发。</p>
</div>

## 五、常见误区与追问

### 5.1 误区：等上下文快满了再压缩也来得及

错在哪：把压缩当成一个不花成本的本地操作。为什么自然：压缩就是删内容，删东西怎么会来不及。判据：压缩本身要发起一次模型调用，而它要读的恰恰是那段已经很满的上下文——压缩的输入就是那个逼近上限的输入。<strong>数字：128k 窗口下，60% 触发时还有约 51k 余量，从容；90% 触发时只剩 12.8k，而摘要必须把 115k 读一遍，一旦按总长校验就直接失败。</strong>所以取值依据不是「还能塞多少」，而是「压缩动作本身要花掉多少」——按 60% 触发，并为摘要预留一次完整调用。

### 5.2 误区：窗口到 1M 了，上下文越长效果越好

错在哪：把「模型收得下」当成「模型用得上」。为什么自然：上下文越多，可用信息看起来越多，何况现在真有一百万的窗口。判据：效果变量是真实判断依据的占比，不是总长度——把十万 token 里真正被引用的那部分数出来，占比从约 18% 被稀释到 10% 时，任务从第 15 轮前后开始跑偏。**可操作的验证：同一个任务跑两组，A 组带全量历史，B 组只带结构化结论摘要；如果完成率没有下降，说明你原来塞的那些过程性内容本来就没被用到——直接砍掉，既提效果又降成本。**

### 5.3 误区：上下文治理的重点是「知识」，所以先去优化检索

错在哪：把注意力放在检索片段上，放过了真正的大头。为什么自然：检索结果看起来才是「内容」，历史消息只是聊天记录，不像能吃预算的东西。判据：先量再说，按四类成分逐个数 token 占比。<strong>典型分布是：一次检索 3–8k token，而十几轮之后的历史消息加工具返回值可以到 20 万 token 量级，指令与工具定义合计往往不到 10%。</strong>所以第一刀应该砍向状态：中间产物外置、历史压成结构化摘要、单条超长结果做头尾保留裁剪——先优化检索是小马拉大车。

### 5.4 误区：压缩就是把内容变短

错在哪：把压缩当成一次自由发挥的改写。为什么自然：摘要嘛，写短一点就算完成了任务。判据：自由文本摘要会「越摘越糊」——每压一次丢一部分细节，压上三次往往连任务目标都变形了。正确做法是让摘要结构化，固定四段：目标 / 已完成 / 关键结论 / 待办；并且必须保留可回查的指针（文件路径、轮次号、来源链接），需要细节时能按指针回读。**判据：压完之后拿摘要做一次「无原历史」的任务续跑，如果模型还能说清任务目标与已完成的步骤，这次压缩合格；如果说不出，说明它压掉的不是过程而是结论。**

### 5.5 误区：状态外置就是把中间产物写进文件

错在哪：只做了「写文件」，没做「让模型知道文件在哪、要不要读」。为什么自然：外置听起来就是找个地方存起来。判据：外置的验收标准有两条——上下文里只剩指针，且指针是可读、可发现的。文件名如果叫 tmp_001.json，模型既不知道里面是什么，也没理由去读，等于没外置；叫 orders-2025-删除影响分析.md，模型看一眼就知道该不该打开。<strong>数字：20 万 token 的中间产物外置之后，上下文里应该只剩一份三五行的目录清单（约 200 token）。</strong>

### 5.6 误区：标了来源就不会有引用幻觉

错在哪：把「给了判断依据」当成「已经校验过」。为什么自然：每条知识都带了来源与层级，看起来已经足够严谨。判据：来源只让幻觉变得可被发现，并不阻止它发生——模型完全可能标注一个证据清单里根本不存在的来源，或者把 opinion 层的内容当成 fact 用。所以要补一步后置校验：生成完成后，把回答里每一条引用回查一遍，看它在证据清单里是否真实存在、层级有没有被升格；对不上就降级或删掉引用。**判据：随机抽 20 条带引用的回答逐条点开核对，如果存在对不上的编号，说明你的引用体系目前只是装饰。**

## 六、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>第 3 题为面试高频题</span></div>
  <div class="q-item" data-qid="harness04-q1" data-answer="1">
    <div class="q-text"><span class="idx">Q1</span>上下文里通常吃掉最多 token 的是哪一类？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>检索到的知识资料</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>多轮累积的历史消息与工具返回结果（状态）</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>系统指令</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>工具定义</span></button>
    <div class="explain"><b>B。</b>这是很实用的一个观察：知识检索一次通常几千 token，而十几轮之后的历史与工具返回值能到几十万 token。<b>所以要优先治理的是「状态」而不是「知识」</b>——把中间产物外部化、把历史结构化压缩，比优化检索的收益更直接。</div>
  </div>
  <div class="q-item" data-qid="harness04-q2" data-answer="3">
    <div class="q-text"><span class="idx">Q2</span>上下文各部分应该按什么顺序排列？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>按重要性排序，最重要的放最前</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>按时间顺序，最新的一轮放最前</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>随机即可，模型对顺序不敏感</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>按变化频率：变化越少的越靠前，变化越频繁的越靠后</span></button>
    <div class="explain"><b>D。</b>这条规则同时优化两个目标：<b>前缀缓存命中率最大</b>（变化少的在前 → 每轮共享最长前缀），以及<b>信息相关性</b>（新信息在尾部，离生成位置更近）。注意 A 看起来合理但会破坏缓存——把动态内容放前面，每轮前缀全废。</div>
  </div>
  <div class="q-item" data-qid="harness04-q3" data-answer="0">
    <div class="q-text"><span class="idx">Q3</span>为什么给检索到的知识标注「来源」和「层级（事实/推断/观点）」很重要？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>它是模型判断可信度与给出可验证引用的依据，也让用户能点开核对</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>能让检索速度更快</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>可以减少 token 占用</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>纯粹是排版美观的需要</span></button>
    <div class="explain"><b>A。</b>没有来源和层级，模型只能把所有检索内容一视同仁——一条用户随口说的「观点」和一条系统记录的事实会被同等采信。<b>标注层级本质上是把「可信度判断」这个能力所需的输入补给模型</b>，同时让最终回答可以带上可点开的引用，这是治理幻觉最有效的手段之一。</div>
  </div>
</div>

## 七、小结

| 议题 | 结论 |
| --- | --- |
| 上下文四成分类 | 指令 / 能力声明 / 知识 / 状态；治理重点在「状态」 |
| 排序原则 | 按变化频率，稳定的靠前，动态的靠后 |
| 压缩策略 | 滚动窗口（短任务）+ 阶段摘要（通用）+ 状态外置（长任务） |
| 压缩触发 | 用量 60%、单条超 10%、阶段边界，三个提前量信号 |
| 知识注入 | 必须带来源、更新时间、可信层级，否则无法判断与引用 |

<p class="pull-quote">效果上限不是由提示词的精妙程度决定的，而是由「该给的信息有没有给、不该给的噪音有没有删」决定的。<cite>本刊编辑部</cite></p>

下一章处理一个更长期的问题：如果这些信息不该每一轮都重新塞进去，那该存在哪里、什么时候取出来。

## 八、参考与延伸

这一层的实践材料比理论多。下面按「先看原则、再看机制、最后看极端案例」排好。全站不做原文转载，这里只登记链接与「为什么值得读」。

**先看原则（该给什么、不该给什么）**

- [Anthropic · Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) —— 把上下文工程从「提示词怎么写」里彻底拆出来，讲成一件「在有限的注意力预算下做取舍」的事，并且明确说上下文会「腐烂」（信息还在，但已经不该信了）。<strong>本章第一节的四类成分与它是同一件事的两种表述；如果你要给自己的项目定一份预算比例，先看它给的原则再看自己的数。</strong>
- [Anthropic · Prompt Engineering Overview](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview) —— 与上一份对着读：哪些属于措辞问题、哪些属于信息供给问题。<strong>如果你的团队还在用「优化提示词」去解决「该给的信息没给」的问题，把这一页发给对方，比争论有用。</strong>

**再看机制（前缀到底怎么被复用）**

- [vLLM · Automatic Prefix Caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching.html) —— 服务端视角的前缀复用：以块为单位做哈希命中，能命中多少取决于前缀里有多少个完整块逐字节相同。<strong>本章第二节说「把变化频率当排序键」，这里能让你看到它背后的匹配粒度——为什么首部改一个字符不是「慢一点」，而是整段作废。</strong>
- [vLLM 博客：用 PagedAttention 把大模型服务做到又快又省](https://blog.vllm.ai/2023/06/20/vllm.html) —— 重点看显存碎片与块管理那几张图。<strong>理解「前缀会被淘汰」之后，你就不会把「又长又稳定」当成缓存友好的默认答案：长前缀反而更容易在并发压力下被换出。</strong>

**最后看极端案例（长上下文到底能干什么）**

- [Efficient Memory Management for Large Language Model Serving with PagedAttention（arXiv:2309.06180）](https://arxiv.org/abs/2309.06180) —— 只读它的 KV 块管理一节即可。<strong>它解释了一个反直觉现象的成因：为什么你在应用层把前缀写得再稳定，命中率依然不完全由你决定——调度与淘汰也在你之外发生。</strong>
