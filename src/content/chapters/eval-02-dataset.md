---
chapter: eval-02-dataset
lead: '评测集从哪来？最靠谱的答案是「从线上长出来」。手工设计的问题集能覆盖的场景，永远少于真实用户踩出来的坑。这一章讲四件事：怎么分层、怎么设保留集防止过拟合、怎么让 badcase 回流、以及怎么判断你的评测集已经失效了。'
note: '本章开头那条纪律（评测集和调试集必须分开）是最容易被违反、后果也最严重的一条。'
---

<p class="dropcap">评测集最大的敌人不是「不够大」，而是「被污染」。当一个团队反复拿同一套题调优，这套题就失去了区分能力——你不是在提升系统能力，而是在提升系统在这套题上的分数。这一章处理的就是这个问题。</p>

## 一、评测集必须分层

不同层回答不同的问题，混在一起会导致「不知道该看哪个数」——所以才要分出[[smoke-set|冒烟集]]、回归集、边界集、对抗集这样的层次，每层有独立的通过标准与告警阈值。

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

**回归集的核心价值不是「测得多准」，而是「钉住不许退步」。** 它的每一条样本都应该来自一个真实发生过的问题，并且带一条注释说明「这条是因为什么引入的」——这套纪律防的就是[[overfitting|过拟合]]：反复在同一套题上调优，分数涨了但真实能力没变。[[regression-set|回归集]]就是用来锁住「曾经修好的东西不再坏」。

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
  <figcaption><b>图 1</b>　调试池与保留池的分工。关键纪律：<b>保留池不允许看单条样本、不允许针对性优化</b>。一旦你为了修某条样本而改代码，它就必须从保留池下放到调试池——否则保留池就失去了「无偏估计」的意义。  </figcaption>
</figure>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 320" role="img" aria-label="评测集四层：规模、频率、用途各不相同">
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">评测集为什么必须分层</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">四层回答不同的问题，频率与规模各不相同</text>
      <rect x="16" y="60" width="628" height="46" fill="#eef4f1" stroke="#2f6157" stroke-width="1.2"/>
      <text x="30" y="82" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#2f6157">冒烟集</text>
      <text x="160" y="82" font-family="ui-monospace, monospace" font-size="9.5" fill="#6b6257">10-20 条　每次提交　100% 通过才能合（有没有低级错误）</text>
      <rect x="16" y="112" width="628" height="46" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="30" y="134" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#8a6a1e">回归集</text>
      <text x="160" y="134" font-family="ui-monospace, monospace" font-size="9.5" fill="#6b6257">100-300 条　每次发版　钉住不许退步（真实问题沉淀）</text>
      <rect x="16" y="164" width="628" height="46" fill="#eef1f7" stroke="#345a75" stroke-width="1.2"/>
      <text x="30" y="186" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#345a75">边界集</text>
      <text x="160" y="186" font-family="ui-monospace, monospace" font-size="9.5" fill="#6b6257">50-150 条　每次发版　极端输入下不崩（超长/空值/多语言）</text>
      <rect x="16" y="216" width="628" height="46" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.2"/>
      <text x="30" y="238" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700" fill="#9b2c2c">对抗集</text>
      <text x="160" y="238" font-family="ui-monospace, monospace" font-size="9.5" fill="#6b6257">30-80 条　月度　挡住恶意输入/提示注入/诱导越权</text>
      <text x="16" y="288" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">混在一层 → 不知道该看哪个数；分层 → 每类问题有独立通过标准与告警阈值。</text>
      <text x="16" y="306" font-family="ui-monospace, monospace" font-size="9.4" fill="#9b2c2c">对抗集缺失 → 安全类问题根本不会被评测覆盖，是最危险的空白层。</text>
    </svg>
  </div>
  <figcaption><b>图 2</b>　四层评测集不是「越多越好」，而是「各管一类问题」。<b>对抗集常被省略，但一旦省略，安全类退步就彻底失去感知</b>——这正是防刷分要盯的分层之一。</figcaption>
</figure>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 300" role="img" aria-label="调试池与保留池分数差：过拟合的体温计">
      <defs>
        <marker id="ar2" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">调试池与保留池的分数差</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">差距越大，过拟合越严重：这是评测集健康的体温计</text>
      <line x1="100" y1="250" x2="580" y2="250" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="100" y="266" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">0</text>
      <text x="340" y="266" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">50</text>
      <text x="580" y="266" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">100</text>
      <rect x="150" y="86" width="90" height="164" fill="#eef4f1" stroke="#2f6157" stroke-width="1.2"/>
      <text x="195" y="78" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#2f6157">调试池 92%</text>
      <rect x="420" y="142" width="90" height="108" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.2"/>
      <text x="465" y="134" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#9b2c2c">保留池 68%</text>
      <line x1="195" y1="68" x2="465" y2="68" stroke="#9b2c2c" stroke-width="1.2" stroke-dasharray="3 2" marker-end="url(#ar2)"/>
      <text x="330" y="62" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" fill="#9b2c2c">差距 24 个百分点</text>
      <line x1="100" y1="223" x2="580" y2="223" stroke="#9b2c2c" stroke-width="1" stroke-dasharray="4 2"/>
      <text x="104" y="218" font-family="ui-monospace, monospace" font-size="8.8" fill="#9b2c2c">告警阈值 +15pct</text>
      <text x="16" y="290" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">判据：两池差距超过 15 个百分点即视为明显过拟合；保留池是「真实泛化能力」的无偏估计，敢不敢上线看它。</text>
    </svg>
  </div>
  <figcaption><b>图 3</b>　调试池 92%、保留池 68%，24 分的差距是过拟合的典型体温。<b>保留池才是敢不敢上线的依据</b>——它的分数不会因为你对某批样本调优而水涨船高。</figcaption>
</figure>

## 三、badcase 回流：评测集的生长机制

这是本章最有价值的部分：**一个健康的评测集，其增长速度应该与线上问题发现速度相当**——这正是[[badcase-backflow|badcase 回流]]机制的设计目标：线上每一次真实的失败，都沉淀成一条可复现的回归样本。

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

## 五、常见误区与追问

### 5.1 误区：评测集和调试集可以共用（其实必须用两个池子）

很多人把同一套题既用来调优又用来验收。错。一旦你为了修某条样本而改代码，那条样本就「被你背下来了」，它再也不能代表真实能力。[[holdout|保留池]]存在的意义就是无偏估计：平时不准看单条、不准针对性优化。判据：调试池与保留池分数差距 > 15 个百分点，即视为明显过拟合，必须补新样本稀释。

### 5.2 误区：样本越多越准（其实是分层配比错了更危险）

盲目堆数量不如把四层配齐。没有[[adversarial-set|对抗集]]，安全类退步完全无感知；没有[[boundary-set|边界集]]，极端输入下的崩溃没人发现。判据：先保证四层都在线（冒烟/回归/边界/对抗），再谈加量；对抗集哪怕只有 30 条，也比 500 条全是正常样本有用。

### 5.3 误区：标注「期望输出文本」就够（其实它不可判定）

新手常把标准答案写成一段期望文本然后做文本比对。错。同一件事有无数种正确说法，文本比对会大量误判（该对的判错），也会放过偷换说法的错。[[expected-behavior|期望行为]]要求标注「该调哪个工具、参数是什么、是否拒绝或澄清」——这些有明确对错。判据：一条样本若无法用工具/拒绝/澄清判定，禁止进入回归集。

### 5.4 误区：能跑过的样本就是好样本（其实是过拟合温床）

调试池能反复跑、反复调，很容易变成「针对这 80% 样本特训」。[[dev-set|调试池]]给出的是乐观估计，它的高分不能对外汇报。判据：对外结论一律以保留池为准；每次发版前必须看保留池，而不是看自己调了一下午的调试池。

### 5.5 误区：样本能不能自动判定无所谓（其实决定评测能否持续）

如果一条样本只能靠人读输出判断，它就没法进回归集、也没法接 CI。[[judgeability|可判定性]]是评测集可维护性的前提。判据：入库前先问「这条能不能不靠人眼判定」；不能判定的要么改写成可判定形式，要么只作人工抽检、不进自动门禁。

### 5.6 误区：badcase 回流就是「把报错存下来」（其实是带溯源的结构化沉淀）

把线上失败随便丢进一个文件夹，三个月后没人知道为什么留它、该怎么判。badcase 回流要求脱敏后标注期望行为、写清来源与原因、归到工程问题类。判据：缺来源或原因的样本必须拒收；无溯源的样本无法维护，等于给未来埋雷。

## 六、自测

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

## 七、小结

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

## 八、参考与延伸

评测集不是一次设计出来的，是随线上问题长出来的。下面几份材料按「建立直觉 → 动手 → 对齐一手定义」排好。

**先看图（建立直觉）**

- [Promptfoo 文档](https://www.promptfoo.dev/) —— 开源评测与红队框架，自带冒烟 / 回归 / 对抗多套数据集范式。**重点看它怎么把「期望行为」写成可判定的断言，正好对应本章第四节。**
- [Eugene Yan · 评测与监控](https://eugeneyan.com/) —— 从 LLMOps 视角讲评测集如何随线上问题生长。**他关于「评测集是活的系统」的观点，和本章 badcase 回流完全同构。**

**再看代码（动手实现）**

- [OpenAI Evals](https://github.com/openai/evals) —— 官方评测框架，直接看数据集怎么组织、grading 怎么写。**对比本章第四节的 Dataset 类，能看出生产级框架多做了哪些版本化与回归管理。**

**最后读论文（对齐一手定义）**

- [HELM · 斯坦福 CRFM](https://crfm.stanford.edu/helm/latest/) —— 公开口径的评测基准，把场景、维度、指标做成一套可被复现的定义。**它示范了「评测集为什么要分层、口径为什么要公开」。**
- [tau-bench](https://github.com/sierra-research/tau-bench) —— Agent 评测的一手基准，以「工具调用是否正确」定义完成度。**想理解「可判定样本」为什么是评测集的骨架，看它怎么构造任务就够了。**
