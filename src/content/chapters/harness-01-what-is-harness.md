---
chapter: harness-01-what-is-harness
lead: '「除模型本身以外的所有工作，都属于 Harness 的范畴」——这句话看起来像一句甩锅式的定义，实际上它划出的地盘大得惊人：从工具契约到上下文预算，从失败恢复到权限沙箱，从循环终止到评测闭环。这一章给出完整的能力地图，后面七章都挂在这张图上。'
note: '本刊读者若只读一章，请读这一章。它决定了后面所有内容在你脑子里是「一堆知识点」还是「一张地图」。'
---

<p class="dropcap">先看一个被反复引用却很少被真正拆解的等式：<b>Model + Harness = Agent</b>。同一个模型，套上不同的 Harness，能做出效果差异巨大的产品。理解这个等式，就理解了为什么「模型能力」不是产品效果的唯一变量——也理解了为什么这个岗位值得存在。</p>

## 一、把这个等式拆开看

模型提供三种能力：理解输入、生成内容、在给定格式下输出结构化结果。它不能做的是：记住上一次对话、访问外部世界、判断自己的输出对不对、在失败后重试、控制自己做事的顺序、以及在出事之后被追责。

这些「不能做」的事情，就是 Harness 的地盘。换个更工程化的说法：

> **Harness 是把一个概率性的文本生成器，包装成一个可交付、可观测、可控制、可恢复的执行系统的全部工程。**

「可交付」意味着用户拿到的是结果而不是一段文字；「可观测」意味着每一步都能查；「可控制」意味着越权行为会被拦住；「可恢复」意味着中途断了能接着跑。这四件事没有一件是模型本身提供的。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 460" role="img" aria-label="Harness 能力地图：从模型到产品的六层结构">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">Harness 能力地图</text>
      <text x="16" y="38" font-family="ui-monospace, monospace" font-size="9.8" fill="#6b6257">越靠上的层越贴近用户，越靠下的层越贴近模型。每一层都可能成为效果的瓶颈。</text>
      <!-- L6 交付层 -->
      <rect x="16" y="52" width="628" height="52" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.3"/>
      <text x="30" y="72" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#1f1b16">⑥ 交付层　Deliverables</text>
      <text x="30" y="90" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">产物形态（报告 / 表格 / 代码 / 网页）、分享与权限、版本与回滚、导出与归档</text>
      <text x="30" y="100" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">　</text>
      <!-- L5 编排层 -->
      <rect x="16" y="112" width="628" height="52" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="30" y="132" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#2f6157">⑤ 编排层　Orchestration</text>
      <text x="30" y="150" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">任务分解、Subagent 派生、并行与串行、结果汇总、人工介入点、长任务状态机与检查点</text>
      <text x="30" y="160" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">　</text>
      <!-- L4 记忆与知识层 -->
      <rect x="16" y="172" width="628" height="52" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <text x="30" y="192" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#8a6a1e">④ 记忆与知识层　Memory &amp; Knowledge</text>
      <text x="30" y="210" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">长期记忆写入与召回、知识建模（实体/事实/推断）、检索与引用、冲突消解、可删除性</text>
      <text x="30" y="220" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">　</text>
      <!-- L3 上下文层 -->
      <rect x="16" y="232" width="628" height="52" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="30" y="252" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#9b2c2c">③ 上下文层　Context Engineering　★ 效果上限的真正来源</text>
      <text x="30" y="270" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">预算分配、什么常驻什么按需、压缩与摘要、状态外置、顺序与前缀稳定性</text>
      <text x="30" y="280" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">　</text>
      <!-- L2 工具层 -->
      <rect x="16" y="292" width="628" height="52" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="30" y="312" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#2f6157">② 工具层　Tools as Contracts</text>
      <text x="30" y="330" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">工具描述、参数 schema、错误分类与回喂、结果裁剪、MCP 接入、幂等与副作用标记</text>
      <text x="30" y="340" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">　</text>
      <!-- L1 循环层 -->
      <rect x="16" y="352" width="628" height="52" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.3"/>
      <text x="30" y="372" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#1f1b16">① 循环层　The Loop</text>
      <text x="30" y="390" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">思考-行动-观察循环、终止条件、轮数与预算上限、循环检测、流式解析与卡死恢复</text>
      <text x="30" y="400" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">　</text>
      <!-- 底座 -->
      <rect x="16" y="412" width="628" height="40" fill="#1f1b16" stroke="#1f1b16" stroke-width="1.3"/>
      <text x="330" y="430" text-anchor="middle" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#ffffff">模型　Model —— 提供理解与生成，其余全部由上面六层提供</text>
      <text x="330" y="446" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" fill="#d6cbb8">越权防护、审计、可观测性贯穿所有层，不单独成层</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　Harness 能力地图。注意第 ③ 层的标注：<b>上下文层是效果上限的真正来源</b>——工具再多、编排再花，模型看到的上下文决定了它能做出什么判断。这也是后面第七、八章反复回到这一层的原因。</figcaption>
</figure>

## 二、为什么「同一模型不同效果」是常态

一个常被忽略的事实：把 GPT / Claude / DeepSeek 换进同一个 Harness，效果差异往往小于「同一个模型换一个 Harness」。原因有三：

**第一，工具描述的质量决定了模型会不会用、用得对不对。** 同一个查询接口，描述写成「查询数据」，写成一个带参数说明、取值范例、返回结构示例的完整契约，工具调用成功率可以差出一倍。

**第二，上下文里的信息决定模型能做什么判断。** 如果历史全量堆进上下文，模型注意力被稀释；如果该给的信息没给（比如「这个字段昨天刚改过口径」），模型只能猜。

**第三，失败处理决定系统能不能跑完。** 同一个模型，遇到工具报错就整轮失败，和把错误分类后回喂让它换参数重试，任务完成率的差距是量级级别的。

<p class="pull-quote">模型决定上限，Harness 决定你能不能摸到那个上限。而绝大多数产品离上限还差得远，所以 Harness 才是主战场。<cite>本刊编辑部</cite></p>

## 三、一个最小可用的 Harness 应该有什么

不需要一上来就建六层。但如果只有一天时间写一个能用的 Harness，下面这六件事缺一不可：

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>#</th><th>必需能力</th><th>缺了会怎样</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>循环 + 五类终止条件</td><td>要么永不停止（烧钱），要么提前放弃（完不成任务）</td></tr>
      <tr><td>2</td><td>工具契约 + 参数校验</td><td>模型调用失败率高，且你在日志里看不出为什么</td></tr>
      <tr><td>3</td><td>错误分类与回喂</td><td>任何一次工具报错都会让整轮任务失败</td></tr>
      <tr><td>4</td><td>上下文预算与压缩</td><td>跑十几轮就撑满窗口，成本平方级上涨</td></tr>
      <tr><td>5</td><td>全链路 trace</td><td>出问题只能靠猜，无法定位到底哪一步坏掉</td></tr>
      <tr><td>6</td><td>副作用操作确认 / 最小权限</td><td>模型一次误判就可能直接改坏线上数据</td></tr>
    </tbody>
  </table>
</div>

<div class="code-block">
  <div class="code-head"><span>minimal_harness.py</span><span class="lang">python</span></div>
  <pre><code>"""
最小可用 Harness 骨架。
刻意把六层压缩成 40 行，只为展示「Harness 到底在做什么」。
生产环境每一行都会膨胀成好几十行，但骨架不变。
"""
from dataclasses import dataclass, field
@dataclass
class Budget:
    max_turns: int = 12            # 轮数上限
    max_tokens: int = 120_000      # 累计 token 上限（成本闸）
    max_seconds: float = 300.0     # 挂钟时间上限
    turns: int = 0
    tokens: int = 0
    trace: list = field(default_factory=list)   # 全链路可观测
    def spent(self) -> bool:
        return self.turns >= self.max_turns
class Tool:
    """工具 = 契约。描述、schema、是否幂等、是否有副作用，四者必须齐全。"""
    def __init__(self, name, description, schema, handler, side_effect=False):
        self.name, self.description = name, description
        self.schema, self.handler = schema, handler
        self.side_effect = side_effect      # 有副作用的工具执行前必须确认
TOOLS = {
    "search": Tool("search", "按关键词检索站内文章，返回 [{title,url,snippet}]",
                   {"q": "string"}, lambda **kw: [{"title": "示例", "url": "…"}],
                   side_effect=False),
    "write_file": Tool("write_file", "把内容写入指定路径，会覆盖同名文件",
                       {"path": "string", "content": "string"},
                       lambda **kw: "written", side_effect=True),
}
def build_context(task: str, history: list, observations: list) -> list:
    """
    第 ③ 层的核心：决定模型看到什么。这里用最朴素的三段式，
    真实系统要在这里做预算分配、摘要压缩与状态外置。
    """
    tool_docs = "\n".join(f"- {t.name}: {t.description}" for t in TOOLS.values())
    return [
        {"role": "system", "content": f"你是任务执行器。可用工具：\n{tool_docs}"},
        {"role": "user", "content": f"任务：{task}"},
        *history,
        *observations,
    ]
def classify_error(exc: Exception) -> str:
    """错误分类决定回喂方式，这是第 ②③ 层交界处最容易被跳过的一步"""
    name = type(exc).__name__
    if name in ("TimeoutError",):
        return "TIMEOUT：可以原样重试一次，超时通常是瞬时的"
    if name in ("ValueError", "KeyError"):
        return "BAD_ARGS：参数有问题，必须改参数后重试，重试原参数无意义"
    if name in ("PermissionError",):
        return "FORBIDDEN：没有权限，重试无用，应上报请求授权"
    return "UNKNOWN：记录并交由上层决定"
def run(task: str, budget: Budget) -> dict:
    history, observations = [], []
    while not budget.spent():
        budget.turns += 1
        # 1. 组装上下文（决定模型看到什么）
        messages = build_context(task, history, observations)
        # 2. 调用模型，要求结构化输出
        plan = call_model(messages, temperature=0)      # 占位
        budget.trace.append({"turn": budget.turns, "plan": plan})
        # 3. 终止判断：模型认为完成
        if plan.get("action") == "finish":
            return {"status": "done", "result": plan.get("answer"),
                    "turns": budget.turns, "trace": budget.trace}
        # 4. 执行工具，带错误分类
        tool = TOOLS.get(plan.get("tool"))
        if tool is None:
            observations.append({"role": "user",
                                 "content": f"工具 {plan.get('tool')} 不存在，请从可用列表中选择。"})
            continue
        if tool.side_effect and not confirm(f"即将执行有副作用的操作 {tool.name}，确认？"):
            observations.append({"role": "user", "content": "用户拒绝了该操作，请换方案或结束。"})
            continue
        try:
            result = tool.handler(**plan.get("args", {}))
            observations.append({"role": "tool", "content": str(result)[:2000]})
        except Exception as e:                            # 关键：错误也回喂
            observations.append({"role": "user",
                                 "content": f"工具执行失败[{classify_error(e)}]：{e}"})
    return {"status": "budget_exhausted", "turns": budget.turns, "trace": budget.trace}
</code></pre>
</div>

<div class="box box-key">
  <span class="box-title">这段代码里最值钱的三行</span>
  <ul>
    <li><code>except Exception as e</code> 之后把错误<b>回喂给模型</b>——绝大多数玩具实现会直接抛出异常终止；</li>
    <li><code>classify_error()</code> 把错误分成「可重试 / 必须改参数 / 重试无用」——决定后续行为的不是错误本身，而是分类；</li>
    <li><code>tool.side_effect and not confirm(...)</code>——在把能力交出去之前先设一道闸。</li>
  </ul>
</div>

## 四、面试里怎么答「什么是 Harness」

这道题的标准陷阱是答成「Agent 的框架」。正确的答法是给一个判据，而不是一个描述：

<div class="box box-practice">
  <span class="box-title">推荐的答题结构</span>
  <p><b>结论：</b>Harness 是「把概率性文本生成器包装成可交付、可观测、可控制、可恢复系统」的全部工程，判据是——这件事模型自己做不到。</p>
  <p><b>机制：</b>按六层展开：循环 / 工具 / 上下文 / 记忆与知识 / 编排 / 交付，另外权限与可观测性贯穿全层。</p>
  <p><b>代价与边界：</b>Harness 做得越厚，延迟越高、调试越难、模型升级带来的收益越可能被掩盖。所以好的 Harness 要能<b>随模型变强而变薄</b>——那些「为了绕开模型弱点」的补丁应该在模型升级后被主动拆掉。</p>
  <p><b>实践：</b>举一个你自己的例子（比如把某个失败率高的链路从「加提示词」改成「改错误分类 + 回喂」）。</p>
</div>

## 五、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>第 3 题最容易答错</span></div>
  <div class="q-item" data-qid="harness01-q1" data-answer="2">
    <div class="q-text"><span class="idx">Q1</span>下面哪一项<b>不属于</b> Harness 的职责？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>把工具执行错误分类后回喂给模型</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>在上下文超限前压缩历史</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>提升模型在长序列上的注意力计算效率</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>判断任务是否应该继续循环</span></button>
    <div class="explain"><b>C。</b>注意力计算的效率是<b>模型与推理框架</b>的事（FlashAttention、MLA、稀疏注意力），Harness 无法改变模型内部的计算方式。这是「研究问题 vs 工程问题」的一个典型分界：<b>凡是需要改模型结构或训练才能做到的，都不属于 Harness。</b></div>
  </div>
  <div class="q-item" data-qid="harness01-q2" data-answer="1">
    <div class="q-text"><span class="idx">Q2</span>「同一个模型套不同 Harness 效果差异巨大」，最主要原因是什么？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>不同 Harness 会用不同的采样温度</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>工具描述质量、上下文里能看到的判断依据、失败后的恢复策略三者不同，直接决定模型能否做出正确决策并完成任务</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>不同 Harness 的代码质量不同，bug 多少不同</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>因为 Harness 会微调模型权重</span></button>
    <div class="explain"><b>B。</b>Harness 不碰权重（排除 D），温度是次要变量（排除 A）。真正的差异来自三条链路：<b>信息够不够（上下文）、能力好不好用（工具契约）、坏了能不能修（错误恢复）</b>。这三条正好对应能力地图的第 ③② 层与失败处理。</div>
  </div>
  <div class="q-item" data-qid="harness01-q3" data-answer="3">
    <div class="q-text"><span class="idx">Q3</span>「好的 Harness 应该能随模型变强而变薄」这句话的含义是？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>Harness 的代码量应该尽量少，越简单越好</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>模型升级后应该换掉整个 Harness 重写</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>Harness 只是过渡方案，最终会被模型自身能力取代</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>为绕开模型旧弱点而加的补丁应该被识别出来并在模型变强后主动拆除，否则会变成限制上限的负债</span></button>
    <div class="explain"><b>D。</b>这是很有区分度的一题。很多 Agent 系统里堆着大量「当年因为模型不会 X 所以加了一层 Y」的补丁，模型升级后这些补丁不但没用，还会<b>压制模型的真实能力</b>（例如强制模板化的输出格式让更强的模型也无法发挥）。能主动清理这类技术债，是资深工程师的标志。</div>
  </div>
</div>

## 六、小结

- **判据比定义重要**：模型做不到的，就是 Harness 的。
- **六层地图**：循环 / 工具 / 上下文 / 记忆与知识 / 编排 / 交付，权限与观测贯穿全层。
- **上下文层是效果上限的真正来源**，工具层是失败率的主要来源，编排层是长任务能否跑完的关键。
- **Harness 要能变薄**：为绕开旧模型弱点而加的补丁要能被识别并拆除。

下一章从最底下那层开始：循环该怎么写，尤其是——什么时候该让它停下来。
