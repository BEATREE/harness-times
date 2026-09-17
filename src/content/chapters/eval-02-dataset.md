---
chapter: eval-02-dataset
lead: '评测集从哪来？最靠谱的答案是「从线上长出来」。手工设计的问题集能覆盖的场景，永远少于真实用户踩出来的坑。这一章讲四件事：怎么分层、怎么设保留集防止过拟合、怎么让 badcase 回流、以及怎么判断你的评测集已经失效了。'
note: '本章开头那条纪律（评测集和调试集必须分开）是最容易被违反、后果也最严重的一条。'
---

<p class="dropcap">评测集最大的敌人不是「不够大」，而是「被污染」。当一个团队反复拿同一套题调优，这套题就失去了区分能力——你不是在提升系统能力，而是在提升系统在这套题上的分数。这一章处理的就是这个问题。</p>

## 一、评测集必须分层

不同层回答不同的问题，混在一起会导致「不知道该看哪个数」。

<div class="tbl-wrap">
  <table class="news">
    <caption>四层评测集：规模、频率、用途各不相同</caption>
    <thead><tr><th>层</th><th>规模</th><th>运行频率</th><th>回答什么问题</th><th>通过标准</th></tr></thead>
    <tbody>
      <tr><td><b>冒烟集</b></td><td>10-20 条</td><td>每次提交</td><td>系统还能不能跑通（有没有低级错误）</td><td>100% 通过，一条挂就不能合</td></tr>
      <tr><td><b>回归集</b></td><td>100-300 条</td><td>每次发版</td><td>之前修好的问题有没有重新坏掉</td><td>不允许低于基线（哪怕 1 条）</td></tr>
      <tr><td><b>边界集</b></td><td>50-150 条</td><td>每次发版</td><td>极端输入下会不会崩（超长、空值、多语言、歧义）</td><td>不允许崩溃，失败率不高于阈值</td></tr>
      <tr><td><b>对抗集</b></td><td>30-80 条</td><td>定期（月度）</td><td>恶意输入、提示注入、诱导越权能不能被挡住</td><td>不能出现安全事件，宁可返回「拒绝」</td></tr>
    </tbody>
  </table>
</div>

**回归集的核心价值不是「测得多准」，而是「钉住不许退步」。** 它的每一条样本都应该来自一个真实发生过的问题，并且带一条注释说明「这条是因为什么引入的」。

## 二、保留集：防过拟合的唯一手段

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 380" role="img" aria-label="评测集与调试集分离，以及保留集的轮换机制">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">两个池子，不能是同一个</text>
      <!-- 调试池 -->
      <rect x="16" y="36" width="308" height="180" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="30" y="56" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#2f6157">调试池（Dev Set）　约 80%</text>
      <text x="30" y="76" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">日常迭代看这个池子的结果</text>
      <line x1="30" y1="86" x2="310" y2="86" stroke="#2f6157" stroke-width="0.8"/>
      <text x="30" y="104" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">· 可以看到每条样本的输入输出</text>
      <text x="30" y="122" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">· 可以针对失败样本做定向优化</text>
      <text x="30" y="140" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">· 可以反复跑、反复调</text>
      <text x="30" y="164" font-family="ui-monospace, monospace" font-size="9.2" fill="#2f6157">代价：你会不自觉地针对它过拟合</text>
      <text x="30" y="182" font-family="ui-monospace, monospace" font-size="9.2" fill="#2f6157">所以它的分数是「乐观估计」</text>
      <text x="30" y="204" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">用途：指导改进方向，不作对外结论</text>
      <!-- 保留池 -->
      <rect x="336" y="36" width="308" height="180" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="350" y="56" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#9b2c2c">保留池（Holdout）　约 20%</text>
      <text x="350" y="76" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">只在关键节点看，平时不看</text>
      <line x1="350" y1="86" x2="630" y2="86" stroke="#9b2c2c" stroke-width="0.8"/>
      <text x="350" y="104" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">· 不允许看单条样本的细节</text>
      <text x="350" y="122" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">· 不允许针对性优化</text>
      <text x="350" y="140" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">· 只在发版前 / 对外汇报时跑</text>
      <text x="350" y="164" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">作用：给出「真实泛化能力」的无偏估计</text>
      <text x="350" y="182" font-family="ui-monospace, monospace" font-size="9.2" fill="#2f6157">判据：保留池远低于调试池 → 已过拟合</text>
      <text x="350" y="204" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">用途：决策依据（敢不敢上、能不能大范围推）</text>
      <!-- 轮换 -->
      <rect x="16" y="230" width="628" height="66" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="30" y="250" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">保留池会「用旧」，必须定期轮换</text>
      <text x="30" y="270" font-family="ui-monospace, monospace" font-size="9.3" fill="#6b6257">每季度：从最新线上数据中抽取一批新样本补入保留池，把其中一批旧样本下放到调试池。</text>
      <text x="30" y="288" font-family="ui-monospace, monospace" font-size="9.3" fill="#6b6257">原因：用户行为、数据分布、模型版本都在变。一套一年前的题，测不出今天的问题。</text>
      <!-- 判定 -->
      <rect x="16" y="308" width="628" height="60" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.3"/>
      <text x="30" y="328" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#1f1b16">评测集失效的三个信号</text>
      <text x="30" y="346" font-family="ui-monospace, monospace" font-size="9.3" fill="#6b6257">① 分数长期停在 95% 以上不再变化 → 缺乏区分度，该加难度了（加边界与对抗样本）。</text>
      <text x="30" y="362" font-family="ui-monospace, monospace" font-size="9.3" fill="#6b6257">② 调试池与保留池差距持续扩大 → 已经过拟合，改进没有泛化。</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　调试池与保留池的分工。关键纪律：<b>保留池不允许看单条样本、不允许针对性优化</b>。一旦你为了修某条样本而改代码，它就必须从保留池下放到调试池——否则保留池就失去了「无偏估计」的意义。</figcaption>
</figure>

## 三、badcase 回流：评测集的生长机制

这是本章最有价值的部分：**一个健康的评测集，其增长速度应该与线上问题发现速度相当。**

<div class="tbl-wrap">
  <table class="news">
    <caption>badcase 从发现到进入评测集的标准流程</caption>
    <thead><tr><th>步骤</th><th>动作</th><th>要求</th></tr></thead>
    <tbody>
      <tr><td>1 发现</td><td>线上 trace 筛选 / 用户反馈 / 人工巡检</td><td>每条 badcase 必须带上完整 trace（输入、上下文、工具调用、输出）</td></tr>
      <tr><td>2 定性</td><td>判断问题归属：工程 / 产品 / 研究</td><td>工程问题才进回归集；研究问题记录但不作为回归项（否则永远修不完）</td></tr>
      <tr><td>3 脱敏</td><td>去除真实用户信息与敏感数据</td><td>脱敏后仍要保持问题的可复现性（这是难点）</td></tr>
      <tr><td>4 标注</td><td>写出期望行为（不是期望文本）</td><td>标注「应该调用哪个工具、参数应该是什么」，而不是「应该说什么」</td></tr>
      <tr><td>5 入集</td><td>加入回归集，并记录引入原因</td><td>注释格式：<code># 2025-11-03 工单 1234：user 字段传了 null 时崩溃</code></td></tr>
      <tr><td>6 回归</td><td>修复后必须跑通该条</td><td>修 bug 的 PR 必须包含这条样本的通过截图</td></tr>
    </tbody>
  </table>
</div>

<div class="box box-key">
  <span class="box-title">第 4 步是最关键也最常做错的一步</span>
  <p>标注「期望输出文本」的问题是：同一件事有很多种正确的说法，文本比对会大量误判。而<b>标注「期望行为」是可判定的</b>——工具名、参数、是否应该拒绝、是否应该追问澄清，这些都有明确的对错。</p>
  <p>举个具体的例子。用户说「帮我看看上周的数据」，正确的期望不是某段话，而是：<code>应该先追问澄清（是哪个指标、哪个范围），而不是直接猜一个查询</code>。这条期望可以用「是否发生了澄清动作」来判定，无需人工逐条读输出。</p>
</div>

## 四、动手：评测集管理

```python title="eval_dataset.py"
from dataclasses import dataclass, field, asdict
from typing import Literal
import json, random, hashlib
Layer = Literal["smoke", "regression", "boundary", "adversarial"]
@dataclass
class EvalCase:
    id: str
    layer: Layer
    input: str
    # 期望行为（可判定），而不是期望文本
    expect_tool: str | None = None
    expect_args: dict | None = None
    expect_refuse: bool = False        # 是否应该拒绝
    expect_clarify: bool = False       # 是否应该追问澄清
    # 溯源信息：没有这个字段的样本是无法维护的
    origin: str = ""                   # 来源：工单号 / trace id / 人工设计
    reason: str = ""                   # 为什么加入：xxx 场景下会崩
    added_at: str = ""
    tags: list[str] = field(default_factory=list)
    def is_judgeable(self) -> bool:
        """
        可判定性检查：一条样本如果既没有期望工具也没有明确的拒绝/澄清要求，
        就只能靠人读输出判断 —— 这类样本不能进回归集（无法自动化）。
        """
        return bool(self.expect_tool or self.expect_refuse or self.expect_clarify)
class Dataset:
    def __init__(self):
        self.cases: dict[str, EvalCase] = {}
        # 保留池划分：用稳定的哈希决定，保证多次运行划分一致
        self.holdout_ratio = 0.2
    def add(self, case: EvalCase) -> str:
        if not case.is_judgeable():
            return "rejected: 样本不可判定，请补充期望行为（工具/拒绝/澄清）"
        if not case.reason:
            return "rejected: 缺少加入原因，无法维护"
        self.cases[case.id] = case
        return "added"
    def holdout_id(self, case_id: str) -> bool:
        """
        用内容哈希划分，而不是随机数 ——
        随机数会导致每次运行划分不同，分数无法比较。
        """
        h = int(hashlib.sha256(case_id.encode()).hexdigest()[:8], 16)
        return (h % 100) < self.holdout_ratio * 100
    def split(self) -> tuple[list[EvalCase], list[EvalCase]]:
        dev = [c for c in self.cases.values() if not self.holdout_id(c.id)]
        hold = [c for c in self.cases.values() if self.holdout_id(c.id)]
        return dev, hold
    def by_layer(self, layer: Layer) -> list[EvalCase]:
        return [c for c in self.cases.values() if c.layer == layer]
    def health(self) -> dict:
        """健康度报告：用来发现评测集自身的问题"""
        layers = {l: len(self.by_layer(l)) for l in
                  ("smoke", "regression", "boundary", "adversarial")}
        no_origin = [c.id for c in self.cases.values() if not c.origin]
        return {
            "total": len(self.cases),
            "layers": layers,
            "missing_origin": len(no_origin),        # 无溯源的样本无法维护
            "advice": (
                "冒烟集偏少，建议至少 10 条" if layers["smoke"] < 10 else
                "对抗集缺失，安全类问题不会被评测覆盖" if layers["adversarial"] == 0 else
                "结构基本健康"
            ),
        }
    def to_json(self) -> str:
        return json.dumps([asdict(c) for c in self.cases.values()],
                          ensure_ascii=False, indent=1)
    @classmethod
    def from_json(cls, text: str) -> "Dataset":
        d = cls()
        for item in json.loads(text):
            d.cases[item["id"]] = EvalCase(**item)
        return d
def from_badcase(trace_id: str, expect_tool: str, expect_args: dict,
                 reason: str, layer: Layer = "regression") -> EvalCase:
    """从线上 badcase 构造样本的标准入口"""
    return EvalCase(
        id=f"bc-{trace_id}", layer=layer,
        input="",                    # 由 trace 回填（已脱敏）
        expect_tool=expect_tool, expect_args=expect_args,
        origin=f"trace:{trace_id}", reason=reason,
    )
```



<div class="box box-practice">
  <span class="box-title">实操任务</span>
  <ul>
    <li>给你的项目建三层的评测集（冒烟 10 / 回归 30 / 边界 10），每条都要写 <code>reason</code>；</li>
    <li>跑一次 <code>health()</code>，检查有没有「无溯源」的样本——这类样本三个月后没人知道为什么要留着；</li>
    <li>用同一份评测集连跑两次，比较 dev 与 holdout 的分数差。如果差距超过 15 个百分点，说明已经有明显过拟合。</li>
  </ul>
</div>

## 五、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>第 1、3 题为高频考点</span></div>
  <div class="q-item" data-qid="eval02-q1" data-answer="1">
    <div class="q-text"><span class="idx">Q1</span>为什么评测集必须划分出独立的保留池（holdout）？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>为了让评测跑得更快</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>因为反复针对同一批样本调优会导致过拟合，保留池提供无偏的泛化能力估计，避免「分数涨了但真实效果没变」</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>为了减少标注工作量</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>因为保留池的样本质量更高</span></button>
    <div class="explain"><b>B。</b>过拟合在 Agent 上的表现非常隐蔽：你可能针对某批样本调了提示词、加了特判，调试池分数从 60% 涨到 85%，但线上毫无变化。<b>保留池的存在就是为了让这种自欺欺人无处藏身</b>——它的分数才是你敢不敢上线的依据。</div>
  </div>
  <div class="q-item" data-qid="eval02-q2" data-answer="3">
    <div class="q-text"><span class="idx">Q2</span>从线上 badcase 构造评测样本时，应该标注什么？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>期望输出的完整文本</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>期望输出的关键词列表</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>模型应该使用的提示词</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>期望行为：应该调用哪个工具、参数是什么、是否应拒绝或追问澄清</span></button>
    <div class="explain"><b>D。</b>标注「期望文本」会带来两个问题：同一件事有无数种正确说法（文本比对大量误判），以及模型换了说法就被判失败。<b>标注「期望行为」是可判定的</b>，能自动化、能稳定复现，也正是「办事型 Agent 硬指标」能成立的前提。</div>
  </div>
  <div class="q-item" data-qid="eval02-q3" data-answer="2">
    <div class="q-text"><span class="idx">Q3</span>调试池分数 92%、保留池分数 68%，最可能的原因是什么？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>保留池的样本更难</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>保留池样本量太少导致统计噪声</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>已经对调试池过拟合：改进只在这批样本上生效，没有泛化到未见过的输入</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>保留池的划分脚本有 bug</span></button>
    <div class="explain"><b>C。</b>24 个百分点的差距是过拟合的典型信号，说明系统学到的是「这批样本的解法」而不是「这类问题的解法」。<b>处理方式：把更大比例的线上新样本补进保留池，并检查最近几次改动是否包含针对具体样本的特判逻辑。</b>顺带一提，A 和 B 都要先排除，但它们无法解释这么大的差距。</div>
  </div>
</div>

## 六、小结

| 议题 | 结论 |
| --- | --- |
| 分层 | 冒烟（每次提交）/ 回归（每次发版）/ 边界 / 对抗 |
| 保留池 | 20% 左右，不看单条、不针对性优化；低于调试池太多即为过拟合 |
| 生长机制 | badcase → 定性 → 脱敏 → 标注期望行为 → 入集并写明原因 → 回归验证 |
| 标注什么 | 期望**行为**（工具、参数、拒绝、澄清），不是期望文本 |
| 失效信号 | 分数长期不动、两层差距扩大 |
| 维护要求 | 每条样本必须有来源与加入原因，否则无法维护 |

<p class="pull-quote">评测集不是一次性的资产，而是需要持续维护的基础设施。一个三个月没更新过的评测集，测的是三个月前的用户。<cite>本刊编辑部</cite></p>

下一章处理办事型 Agent 最核心、也最容易口径混乱的问题：那些硬指标到底怎么算。
