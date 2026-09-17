---
chapter: eval-01-first-principles
lead: '「感觉这次好多了」不是工程结论。评测要回答三个问题：好在哪个维度、好了多少、这个差异是真的还是噪声。这三个问题分别对应维度定义、量化口径、显著性判断——缺任何一个，迭代方向就是凭直觉。'
note: '本章建立评测的判断框架。后面四章都是它的展开：评测集（怎么取样）、指标（怎么量化）、评审（怎么让机器打分可信）、闭环（怎么让评测真正影响决策）。'
---

<p class="dropcap">先承认一件不太体面的事实：大多数 Agent 团队的第一次迭代都是「改提示词 → 手动试几条 → 感觉好了 → 上线」。这条路偶尔能走通，但它不可持续——因为你不知道这次变好是不是运气好，也不知道下一条改动会不会把之前修好的问题重新弄坏。</p>

## 一、评测的三个第一性问题

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>问题</th><th>要回答什么</th><th>典型错误</th><th>正确做法</th></tr></thead>
    <tbody>
      <tr><td><b>哪个维度</b></td><td>「好」具体指什么？拆成可独立判断的几个维度</td><td>用「效果」这个模糊词，导致改进无法归因</td><td>拆成可分别评估的维度（如方向相关性 / 证据充分性 / 可执行性）</td></tr>
      <tr><td><b>好了多少</b></td><td>用什么数字衡量？分母是什么？</td><td>口径不清，同一个指标两个人算出两个数</td><td>指标定义要写到「能被别人复现」的程度</td></tr>
      <tr><td><b>是真的吗</b></td><td>这个差异超出噪声了吗？</td><td>拿 5 条样本的差异当结论</td><td>扩大样本、看置信区间、做 A/B 对照</td></tr>
    </tbody>
  </table>
</div>

这三个问题看起来朴素，但它们对应了三种最常见的评测失败：**维度混在一起导致改对了也不知道**、**口径不清导致数字无法比较**、**样本太小导致追噪声**。

## 二、维度怎么拆：正交是唯一标准

拆维度的唯一要求是**正交**——两个维度不能相互包含，否则你无法判断是哪一项在变化。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 380" role="img" aria-label="把模糊的「效果好」拆成正交的可评估维度">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">从「效果好」到可评估维度</text>
      <!-- 错误示范 -->
      <rect x="16" y="36" width="200" height="140" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="30" y="56" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#9b2c2c">不要这样拆</text>
      <rect x="40" y="70" width="152" height="26" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <text x="116" y="87" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#9b2c2c">效果好</text>
      <line x1="80" y1="96" x2="60" y2="112" stroke="#9b2c2c" stroke-width="1"/>
      <line x1="152" y1="96" x2="172" y2="112" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="20" y="112" width="88" height="24" fill="#ffffff" stroke="#9b2c2c" stroke-width="1"/>
      <text x="64" y="128" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">准确</text>
      <rect x="124" y="112" width="88" height="24" fill="#ffffff" stroke="#9b2c2c" stroke-width="1"/>
      <text x="168" y="128" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">有用</text>
      <text x="30" y="156" font-family="ui-monospace, monospace" font-size="8.8" fill="#9b2c2c">「准确」与「有用」互相包含：</text>
      <text x="30" y="170" font-family="ui-monospace, monospace" font-size="8.8" fill="#9b2c2c">不准确的东西谈不上有用 → 不可归因</text>
      <!-- 正确示范：执行型 -->
      <rect x="228" y="36" width="200" height="140" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="242" y="56" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#2f6157">办事型：四个正交维度</text>
      <rect x="242" y="66" width="172" height="24" fill="#ffffff" stroke="#2f6157" stroke-width="1"/>
      <text x="328" y="82" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.8" fill="#2f6157">① 可执行率（能不能跑）</text>
      <rect x="242" y="94" width="172" height="24" fill="#ffffff" stroke="#2f6157" stroke-width="1"/>
      <text x="328" y="110" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.8" fill="#2f6157">② 参数准确率（填对没）</text>
      <rect x="242" y="122" width="172" height="24" fill="#ffffff" stroke="#2f6157" stroke-width="1"/>
      <text x="328" y="138" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.8" fill="#2f6157">③ 任务完成率（做完没）</text>
      <rect x="242" y="150" width="172" height="20" fill="#ffffff" stroke="#2f6157" stroke-width="1"/>
      <text x="328" y="164" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.8" fill="#2f6157">④ 交互轮数 / 成本</text>
      <text x="242" y="180" font-family="ui-monospace, monospace" font-size="8.4" fill="#2f6157">可分别独立判断，改动可归因</text>
      <!-- 正确示范：洞察型 -->
      <rect x="440" y="36" width="204" height="140" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <text x="454" y="56" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#8a6a1e">洞察型：四个正交维度</text>
      <rect x="454" y="66" width="176" height="24" fill="#ffffff" stroke="#b8944b" stroke-width="1"/>
      <text x="542" y="82" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.8" fill="#8a6a1e">① 方向相关性</text>
      <rect x="454" y="94" width="176" height="24" fill="#ffffff" stroke="#b8944b" stroke-width="1"/>
      <text x="542" y="110" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.8" fill="#8a6a1e">② 证据充分性</text>
      <rect x="454" y="122" width="176" height="24" fill="#ffffff" stroke="#b8944b" stroke-width="1"/>
      <text x="542" y="138" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.8" fill="#8a6a1e">③ 可操作性</text>
      <rect x="454" y="150" width="176" height="20" fill="#ffffff" stroke="#b8944b" stroke-width="1"/>
      <text x="542" y="164" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.8" fill="#8a6a1e">④ 表达清晰度</text>
      <text x="454" y="180" font-family="ui-monospace, monospace" font-size="8.4" fill="#8a6a1e">「有洞察」不是维度，是四项的合成</text>
      <!-- 正交性检验 -->
      <rect x="16" y="192" width="628" height="70" fill="#fbf8f2" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="30" y="212" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#1f1b16">正交性检验（三句话就能测出来）</text>
      <text x="30" y="232" font-family="ui-monospace, monospace" font-size="9.3" fill="#6b6257">① 能不能构造一个样本，A 维度满分而 B 维度零分？不能 → 两者高度相关，需要合并。</text>
      <text x="30" y="250" font-family="ui-monospace, monospace" font-size="9.3" fill="#6b6257">② 改动 X 只影响 A 不影响 B 吗？如果我改任何一处都同时动两个维度，拆分就没意义。</text>
      <!-- 显著性 -->
      <rect x="16" y="274" width="628" height="94" fill="#eef4f1" stroke="#2f6157" stroke-width="1.2"/>
      <text x="30" y="294" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#2f6157">第三个问题：差异是真的还是噪声</text>
      <text x="30" y="314" font-family="ui-monospace, monospace" font-size="9.3" fill="#6b6257">样本量：30 条以内的差异不要下结论。8/20 与 9/20 的差别（45% vs 40%）在统计上等同于「没区别」。</text>
      <text x="30" y="332" font-family="ui-monospace, monospace" font-size="9.3" fill="#6b6257">对照组：改动前后必须用同一套评测集、同一版本模型、同一温度设置，否则差异无法归因。</text>
      <text x="30" y="350" font-family="ui-monospace, monospace" font-size="9.3" fill="#2f6157">多次运行：Agent 有随机性。同一配置跑 3 次取均值与方差，方差大的指标要谨慎解读。</text>
      <text x="30" y="366" font-family="ui-monospace, monospace" font-size="9.3" fill="#6b6257">区分「回归」与「波动」：跌幅小于历史波动区间的，不要当成回归去修。</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　维度拆解的正反例与正交性检验。核心判据：<b>能否构造出一个「A 好 B 差」的样本</b>——能构造，说明两维正交可用；构造不出，说明它们其实是一件事。</figcaption>
</figure>

## 三、指标口径：必须写到能被复现

这是最容易出问题的地方。以「可执行率」为例，下面三种口径会给出三个完全不同的数字：

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>口径</th><th>定义</th><th>问题</th></tr></thead>
    <tbody>
      <tr><td>A · 宽松</td><td>模型输出的 DSL 能被解析器解析成功</td><td>解析成功 ≠ 能执行。语法对但字段名错的情况被算作成功</td></tr>
      <tr><td>B · 适中</td><td>解析成功且查询引擎接受（不报错）</td><td>引擎不报错 ≠ 结果正确。查了错的条件也算通过</td></tr>
      <tr><td>C · 严格</td><td>解析成功、引擎接受、且返回结果与人工标注的期望结果一致</td><td>标准最严，人工标注成本最高</td></tr>
    </tbody>
  </table>
</div>

**三种口径都不是错的，但混用是错的。** 关键是：口径一旦定了，要写进评测代码的注释里、要能被别人复现，并且在对比两个版本时保持同一口径。

<div class="box box-key">
  <span class="box-title">口径定义的三条硬要求</span>
  <ul>
    <li><b>写分母</b>：分母是「全部样本」还是「成功进入该环节的样本」？两者差异巨大（后者会系统性高估）。</li>
    <li><b>写边界</b>：超时算不算失败？用户主动中断算不算？空结果算成功还是失败？</li>
    <li><b>写例子</b>：至少给一个「算通过」和一个「不算通过」的具体样本。</li>
  </ul>
  <p>满足这三条的口径，任何同事接手都能算出同一个数。<b>不满足的口径，等于没有口径。</b></p>
</div>

## 四、动手：一个可复现的评测骨架

```python title="eval_framework.py"
from dataclasses import dataclass, field
from typing import Callable, Any
import statistics, json
@dataclass
class Sample:
    id: str
    input: str
    expected: Any = None        # 有标准答案的样本才有
    tags: list[str] = field(default_factory=list)   # 分层标签：冒烟/回归/边界/对抗
@dataclass
class Metric:
    """
    指标必须自带口径说明。没有口径的指标不可能被复现，
    因此在数据结构层面就强制要求写清楚。
    """
    name: str
    numerator_desc: str         # 分子是什么
    denominator_desc: str       # 分母是什么
    boundary: str               # 边界情况怎么算（超时/中断/空结果）
    fn: Callable[[dict], bool]
    def describe(self) -> str:
        return (f"{self.name}\n"
                f"  分子：{self.numerator_desc}\n"
                f"  分母：{self.denominator_desc}\n"
                f"  边界：{self.boundary}")
@dataclass
class EvalReport:
    metrics: dict[str, float]
    n: int
    failures: list[dict]        # 必须保留失败样本，否则无法归因
    by_tag: dict[str, float]
def run_eval(samples: list[Sample], run_once: Callable[[Sample], dict],
             metrics: list[Metric], repeats: int = 1) -> EvalReport:
    """
    repeats > 1 用于估计方差 —— Agent 有随机性，
    只跑一遍得到的差异无法与噪声区分。
    """
    per_metric: dict[str, list[float]] = {m.name: [] for m in metrics}
    failures: list[dict] = []
    tag_scores: dict[str, list[float]] = {}
    for run_i in range(repeats):
        for s in samples:
            try:
                out = run_once(s)
            except Exception as e:
                # 异常也算一次「未通过」，不能让异常样本静默消失，
                # 否则分母被人为缩小，指标会虚高。
                out = {"error": f"{type(e).__name__}: {e}"}
            for m in metrics:
                per_metric[m.name].append(1.0 if m.fn(out) else 0.0)
            # 记录失败样本：这是最有价值的产出，而不是那个百分比
            main = metrics[0]
            if not main.fn(out):
                failures.append({"sample": s.id, "tags": s.tags, "output": out,
                                 "run": run_i})
                for t in s.tags:
                    tag_scores.setdefault(t, []).append(0.0)
            else:
                for t in s.tags:
                    tag_scores.setdefault(t, []).append(1.0)
    report = EvalReport(
        metrics={m.name: statistics.fmean(v) for m, v in
                 ((m, per_metric[m.name]) for m in metrics)},
        n=len(samples) * repeats,
        failures=failures,
        by_tag={t: statistics.fmean(v) for t, v in tag_scores.items()},
    )
    # 顺带输出方差：方差大的指标在决策时要更保守
    for m in metrics:
        v = per_metric[m.name]
        if len(v) > 1:
            report.metrics[f"{m.name}__stdev"] = statistics.pstdev(v)
    return report
# --- 指标定义示例（注意每一条都把口径写全了） ---
m_parse_ok = Metric(
    name="解析成功率",
    numerator_desc="输出能被 JSON 解析器成功解析的样本数",
    denominator_desc="全部参评样本数（含超时、异常、中断）",
    boundary="超时与异常一律计入分母且计为不通过；空输出计为不通过",
    fn=lambda out: "parsed" in out and out["parsed"] is not None,
)
m_tool_ok = Metric(
    name="工具调用成功率",
    numerator_desc="工具调用返回状态为 ok 或 empty 的样本数（empty 视为成功）",
    denominator_desc="全部参评样本数（含超时、异常、中断）",
    boundary="超时/异常计为不通过；empty 计为通过（查询成功但无数据）",
    fn=lambda out: out.get("tool_status") in ("ok", "empty"),
)
def compare(baseline: EvalReport, candidate: EvalReport) -> str:
    """
    对比报告。原则：
      · 差异小于历史波动（stdev）的不下结论
      · 主指标提升但分层指标恶化，必须显式提示（防刷分）
    """
    lines = [f"样本数：baseline {baseline.n} → candidate {candidate.n}"]
    for k, v_new in candidate.metrics.items():
        if k.endswith("__stdev"):
            continue
        v_old = baseline.metrics.get(k)
        if v_old is None:
            continue
        delta = v_new - v_old
        noise = max(candidate.metrics.get(f"{k}__stdev", 0),
                    baseline.metrics.get(f"{k}__stdev", 0))
        verdict = "差异不显著" if abs(delta) <= noise else ("提升" if delta > 0 else "回归")
        lines.append(f"{k}: {v_old:.1%} → {v_new:.1%}（Δ{delta:+.1%}）{verdict}")
    # 防刷分：整体提升但某个分层恶化
    for tag, v_new in candidate.by_tag.items():
        v_old = baseline.by_tag.get(tag)
        if v_old is not None and v_new < v_old - 0.05:
            lines.append(f"⚠ 分层「{tag}」出现回落：{v_old:.1%} → {v_new:.1%}，"
                         f"整体指标可能掩盖了局部退化，请检查")
    return "\n".join(lines)
```



<div class="box box-practice">
  <span class="box-title">实操任务</span>
  <ul>
    <li>给你手上的一个 Agent 定义三个正交维度，并各写一句「口径说明」（分子 / 分母 / 边界）；</li>
    <li>构造一个「总体指标上升但某个分层指标下降」的例子，验证 <code>compare()</code> 能发出警告；</li>
    <li>把 <code>repeats</code> 从 1 改成 3，观察各指标的方差——哪个指标最不稳定？为什么？</li>
  </ul>
</div>

## 五、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>第 2 题为高频考点</span></div>
  <div class="q-item" data-qid="eval01-q1" data-answer="2">
    <div class="q-text"><span class="idx">Q1</span>评测要回答的三个第一性问题不包括下面哪一个？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>好在哪个维度</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>好了多少</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>改动代码好不好看</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>差异是真的还是噪声</span></button>
    <div class="explain"><b>C。</b>三个第一性问题是：<b>维度（哪个方向）、量化（多少）、显著性（真的吗）</b>。代码好不好看属于工程规范，不属于评测要回答的问题——把这两类事混起来会导致评测报告里出现无法量化的主观判断。</div>
  </div>
  <div class="q-item" data-qid="eval01-q2" data-answer="1">
    <div class="q-text"><span class="idx">Q2</span>判断两个维度是否正交，最实用的检验方法是什么？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>看名字是否不同</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>尝试构造一个「A 维度满分而 B 维度零分」的样本；能构造出来说明正交，构造不出说明两者高度相关</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>看两个维度是否都由同一个人评估</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>看两个维度是否用了相同的评分范围（如都是 1-5 分）</span></button>
    <div class="explain"><b>B。</b>这是最实用的一条判据。例如「准确」与「有用」——你能构造出「准确但无用」的样本吗？很难，说明它们高度相关，应该合并或重新拆分。<b>能构造出反例，才是真正正交的两个维度。</b></div>
  </div>
  <div class="q-item" data-qid="eval01-q3" data-answer="3">
    <div class="q-text"><span class="idx">Q3</span>为什么评测里必须保留「失败样本列表」而不只是那个百分比？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>因为百分比计算容易出错</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>因为失败样本更少，存储成本低</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>为了向上级证明工作量</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>因为百分比只说明「有没有变好」，失败样本才回答「为什么没做好、该改哪里」——它是归因和下一步动作的唯一依据</span></button>
    <div class="explain"><b>D。</b>这是评测从「考核指标」变成「研发工具」的关键一步。只报百分比，团队会陷入「刷分」；保留失败样本并做归因，才能把评测结果转化为具体的改动清单。这也是下一章「badcase 回流」的起点。</div>
  </div>
</div>

## 六、小结

| 问题 | 结论 |
| --- | --- |
| 哪个维度 | 拆到正交为止；判据是能否构造出「A 好 B 差」的反例 |
| 好了多少 | 口径三要素：分子、分母、边界；不写口径等于没有指标 |
| 真的吗 | 样本量 ≥ 30、同集同配置、多次运行看方差 |
| 失败样本 | 必须保留并归因，这是评测真正的产出 |
| 防刷分 | 看分层指标，警惕整体提升掩盖局部退化 |

<p class="pull-quote">评测不是打分表，是研发工具。它的产出不是那个百分比，而是「下一步该改哪里」的清单。<cite>本刊编辑部</cite></p>

下一章讲评测集从哪来——答案可能会让你意外：它不是设计出来的，是长出来的。
