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

这三个问题看起来朴素，但它们对应了三种最常见的评测失败：**维度混在一起导致改对了也不知道**、**[[metric-definition|口径]]不清导致数字无法比较**、**样本太小导致追噪声，而「差异是不是真的」要靠[[significance|显著性]]判断**。

## 二、维度怎么拆：正交是唯一标准

拆维度的唯一要求是**正交**——两个维度不能相互包含，否则你无法判断是哪一项在变化。[[orthogonal-dimension|正交维度]]就是「互不包舍、可分别判断」的维度：能构造出「A 维度满分而 B 维度零分」的样本，两维才真正正交可用。

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
  <figcaption><b>图 1</b>　维度拆解的正反例与正交性检验。核心判据：<b>能否构造出一个「A 好 B 差」的样本</b>——能构造，说明两维正交可用；构造不出，说明它们其实是一件事。  </figcaption>
</figure>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 340" role="img" aria-label="多轮得分的均值与波动带：差距小于波动带视为噪声">
      <defs>
        <marker id="ar2" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">多轮得分的均值与波动带</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">方差界定噪声：跌幅小于历史波动区间，不应判为回归</text>
      <line x1="100" y1="300" x2="580" y2="300" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="100" y="316" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">0</text>
      <text x="340" y="316" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">50</text>
      <text x="580" y="316" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">100</text>
      <rect x="150" y="156" width="90" height="28" fill="#d6e5de" stroke="none"/>
      <rect x="420" y="149" width="90" height="34" fill="#d6e5de" stroke="none"/>
      <rect x="150" y="170" width="90" height="130" fill="#eef4f1" stroke="#2f6157" stroke-width="1.2"/>
      <text x="195" y="162" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" fill="#2f6157">A 均值 72</text>
      <line x1="195" y1="156" x2="195" y2="184" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="188" y1="156" x2="202" y2="156" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="188" y1="184" x2="202" y2="184" stroke="#1f1b16" stroke-width="1.2"/>
      <rect x="420" y="165" width="90" height="135" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="465" y="155" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" fill="#8a6a1e">B 均值 75</text>
      <line x1="465" y1="149" x2="465" y2="183" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="458" y1="149" x2="472" y2="149" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="458" y1="183" x2="472" y2="183" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="195" y1="138" x2="465" y2="138" stroke="#9b2c2c" stroke-width="1.2" stroke-dasharray="3 2" marker-end="url(#ar2)"/>
      <text x="330" y="132" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#9b2c2c">差距 3 分</text>
      <text x="16" y="334" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">差距 3 分远小于各自 ±8~9 分的波动带 → 视为噪声，不下结论；多次运行方向一致且超出波动带才算回归。</text>
    </svg>
  </div>
  <figcaption><b>图 2</b>　Agent 有随机性，同一配置多次运行得分是一条带。两版本均值差 3 分，但各自的波动带就有 ±8~9 分——<b>差距落在波动带内，不能判为回归</b>。这也是为什么必须跑多次取方差。</figcaption>
</figure>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 300" role="img" aria-label="整体指标提升但分层退化的防刷分对照">
      <defs>
        <marker id="ar3" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">整体提升 ≠ 真的变好</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">防刷分：整体指标上升，可能掩盖某个分层指标的退化</text>
      <rect x="16" y="58" width="300" height="150" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="30" y="80" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#2f6157">整体完成率</text>
      <text x="30" y="108" font-family="ui-monospace, monospace" font-size="13" font-weight="700" fill="#1f1b16">78% → 82%</text>
      <line x1="30" y1="120" x2="120" y2="120" stroke="#2f6157" stroke-width="2.4" marker-end="url(#ar3)"/>
      <text x="130" y="124" font-family="ui-monospace, monospace" font-size="11" font-weight="700" fill="#2f6157">+4 看起来赢了</text>
      <text x="30" y="150" font-family="ui-monospace, monospace" font-size="9.3" fill="#6b6257">单一数字，看不出结构。</text>
      <text x="30" y="168" font-family="ui-monospace, monospace" font-size="9.3" fill="#6b6257">容易被「平均」误导。</text>
      <text x="30" y="190" font-family="ui-monospace, monospace" font-size="9.3" fill="#2f6157">→ 对外汇报常用口径</text>
      <rect x="344" y="58" width="300" height="150" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="358" y="80" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#9b2c2c">分层「对抗集」</text>
      <text x="358" y="108" font-family="ui-monospace, monospace" font-size="13" font-weight="700" fill="#1f1b16">90% → 81%</text>
      <line x1="358" y1="120" x2="448" y2="120" stroke="#9b2c2c" stroke-width="2.4" marker-end="url(#ar3)"/>
      <text x="458" y="124" font-family="ui-monospace, monospace" font-size="11" font-weight="700" fill="#9b2c2c">−9 悄悄退化</text>
      <text x="358" y="150" font-family="ui-monospace, monospace" font-size="9.3" fill="#9b2c2c">安全类退步最危险。</text>
      <text x="358" y="168" font-family="ui-monospace, monospace" font-size="9.3" fill="#9b2c2c">被整体 4 分掩盖了。</text>
      <text x="358" y="190" font-family="ui-monospace, monospace" font-size="9.3" fill="#9b2c2c">→ 必须单列、必须告警</text>
      <rect x="16" y="220" width="628" height="64" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="30" y="242" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#9b2c2c">判据：任何分层指标回落超过 5 个百分点，必须显式告警</text>
      <text x="30" y="262" font-family="ui-monospace, monospace" font-size="9.3" fill="#6b6257">只看整体指标，等于放弃了对「局部退化」的感知。防刷分要求分层指标与整体指标一起看——否则刷分行为会系统性地抬高总分。</text>
      <text x="30" y="278" font-family="ui-monospace, monospace" font-size="9.3" fill="#6b6257">尤其警惕对抗集、边界集这类「不常发生但一发生就很严重」的分层。</text>
    </svg>
  </div>
  <figcaption><b>图 3</b>　整体完成率 +4 看似进步，但分层「对抗集」−9 才是真问题。<b>平均会掩盖结构</b>——防刷分的核心就是不让总分盖住局部退化。</figcaption>
</figure>

## 三、指标口径：必须写到能被复现

这是最容易出问题的地方。以「可执行率」为例，下面三种口径会给出三个完全不同的数字——同一个系统，[[denominator|分母]]的定义不同，算出的数能差 20 个百分点：

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

**三种口径都不是错的，但混用是错的。** 关键是：口径一旦定了，要写进评测代码的注释里、要能被别人[[reproducibility|复现]]，并且在对比两个版本时保持同一口径。

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



### 4.1 「差 3 个点」到底算不算提升

上面的 `compare()` 用了一个极简判据——「差值是否超过 stdev」——它适合**随手扫一眼**，但不够严谨。真正的面试必答题是：**两个版本在同一个样本集上差 3 个百分点，这 3 个点到底是真提升，还是随机波动？** 这需要显式的[[significance|显著性检验]]。

先说清为什么「3 个点」不可直接比较。Agent 评测有两个随机源：一是模型采样本身的随机性，二是评测集只是「全量线上流量」的一个抽样。两者都意味着：**换一批样本、或重跑一遍，那个 3 个点可能就没了。** 显著性检验要回答的是「如果两个版本其实没有差别，观察到这么大（或更大）差异的概率有多低」。

对「同一批样本、两个版本各跑一遍」的配对场景，最贴切的工具是 **McNemar 检验**：它只看那些「两个版本结论不一致」的样本——A 对 B 错、或 A 错 B 对——而把「都对」「都错」的样本丢掉。逻辑是：如果两个版本真的没有差别，那么「A 对 B 错」与「A 错 B 对」的样本数应该差不多，差异只是抛硬币。

```python title="mcnemar_test.py"
from math import comb
def mcnemar(a_only: int, b_only: int) -> float:
    """
    配对 McNemar 检验（双尾），返回 p 值。
    a_only: 版本 A 判对、版本 B 判错的样本数
    b_only: 版本 A 判错、版本 B 判对的样本数
    两者是「结论不一致」的样本；「都对」「都错」的样本不参与。
    """
    n = a_only + b_only
    if n == 0:
        return 1.0          # 没有任何不一致样本，无法判断孰优孰劣
    # 原假设：A、B 没有差别 → 每个不一致样本落入 a_only 或 b_only 的概率各 1/2
    # 双尾 p = 2 × 单尾；单尾 = P(X ≥ max(a_only, b_only))，X ~ Binomial(n, 1/2)
    m = max(a_only, b_only)
    tail = sum(comb(n, k) * (0.5 ** n) for k in range(m, n + 1))
    return min(1.0, 2 * tail)
def compare_versions(baseline_ok, candidate_ok):
    """
    baseline_ok / candidate_ok：两个版本在每个样本上的 0/1 结果，顺序对齐。
    """
    a_only = sum(1 for b, c in zip(baseline_ok, candidate_ok) if b and not c)
    b_only = sum(1 for b, c in zip(baseline_ok, candidate_ok) if not b and c)
    p = mcnemar(a_only, b_only)
    verdict = "差异不显著（不能下「提升」的结论）" if p >= 0.05 else "差异显著"
    return a_only, b_only, p, verdict
```

三个要点，面试时能把它们讲清，基本可以确认你真的做过、而不是背过：

- **配对 vs 独立**：两个版本跑在**同一批样本**上才是配对，用 McNemar；两批**不同的样本**（比如线上流量分桶）是独立的，要用两样本比例检验。选错检验比不检验更糟，因为结论是建立在错误假设上的。
- **p 值不是「效果大小」**。p < 0.05 只能说明「差异不太可能是噪声」，不说明「差异够大、值得上线」。3 个点的显著提升，配上「上线要改的工程量 / 回归风险」，可能仍不值当；反过来 0.5 个点若稳定且零成本，也可能值得。
- **多次比较会骗人**。同时看 10 个分层指标，纯随机也会有一个「p < 0.05」。所以分层指标要预先声明（预注册），事后到处找显著的分层属于「数据抓鱼」（p-hacking），得到的显著性不可信。

<div class="box box-key">
  <span class="box-title">线上怎么落地</span>
  <p>日常不必每次都手算 p 值——大多数时候看<b>不一致样本数</b>就够：如果「A 对 B 错」与「A 错 B 对」的数量级接近（比如 12 vs 9），那个 3 个点的差异大概率是噪声。真正要下「版本 A 明显更好」的结论时，再上 McNemar / bootstrap 给出 p 值，写进评测报告里。</p>
  <p>一句话判据：<b>没有显著性检验的对比，等于没有对比。</b></p>
</div>



<div class="box box-practice">
  <span class="box-title">实操任务</span>
  <ul>
    <li>给你手上的一个 Agent 定义三个正交维度，并各写一句「口径说明」（分子 / 分母 / 边界）；</li>
    <li>构造一个「总体指标上升但某个分层指标下降」的例子，验证 <code>compare()</code> 能发出警告；</li>
    <li>把 <code>repeats</code> 从 1 改成 3，观察各指标的方差——哪个指标最不稳定？为什么？</li>
  </ul>
</div>

## 五、常见误区与追问

### 5.1 误区：维度越多越全面（其实越容易不正交）

很多人以为把「准确性、鲁棒性、安全性、易用性」都列上就是严谨。错。维度必须正交——能构造「A 好 B 差」的样本才算两个独立维度。列一堆高度相关的维度，最终只是把同一个信号重复计了好几遍，出了问题还是归因不了。判据：每加一个维度前先问「我能构造一个该维度满分、另一个零分的样本吗」，构造不出就合并。

### 5.2 误区：显著差异就等于真的变好（其实可能是噪声）

看到两个版本差 5 个百分点就急着下结论，是评测里最常见的错误。Agent 有随机性，同一配置跑 3 次得分本身就能波动 ±8 分。[[variance|方差]]大于差异时，那个差异在数学上等同于「没区别」。判据：样本量 ≥ 30、同一配置跑 ≥ 3 次取均值与方差，差异落在波动带内（或置信区间重叠）就当噪声处理，不要去「修」它。

### 5.3 误区：口径差不多就行（其实能差 20 个百分点）

「可执行率 89%」和「67%」可能描述的是同一个系统——差别只在分母用的是「成功产出的样本」还是「全部样本」。口径不清会让两个团队为「谁更强」吵半天，其实只是分母不同。判据：拿到任何指标先问三件事——分子是什么、分母是什么、边界怎么算；报数时必须连带口径一起报。

### 5.4 误区：整体指标提升就赢了（其实是刷分）

整体完成率从 78% 涨到 82%，但分层「对抗集」从 90% 跌到 81%，这种情况比整体下降更危险——它隐藏了安全能力的退化。[[anti-gaming|防刷分]]要求把[[stratified-metric|分层指标]]单列并设阈值告警。判据：任何分层指标回落 > 5 个百分点必须显式告警；对抗集、边界集这类「低频高危害」分层尤其不能因总分上升被容忍。

### 5.5 误区：回归就是「统计回归」（其实是变差）

评测里说的「回归」和机器学习课的「回归模型」毫无关系。这里指的是「指标相对基线变差了」，而波动只是随机抖动。[[regression-vs-noise|回归与波动]]的区分是：把一次正常的波动当成回归去修，反而会引入特判、加剧过拟合。判据：先算该指标的历史波动区间，跌幅落在区间内就标为噪声，只有稳定、方向一致的恶化才进回归清单。

### 5.6 误区：失败样本没用，只要那个百分比（其实它是唯一产出）

团队常把「通过率 85%」当评测结果，把失败样本当垃圾丢掉。错。百分比只回答「变没变好」，失败样本才回答「为什么没做好、该改哪」。[[failure-samples|失败样本]]是下一步改动的唯一依据，也是 badcase 回流的原料。判据：每次评测必须保留并归因失败样本列表；只报百分比的评测等于没做评测。

## 六、自测

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

## 七、小结

| 问题 | 结论 |
| --- | --- |
| 哪个维度 | 拆到正交为止；判据是能否构造出「A 好 B 差」的反例 |
| 好了多少 | 口径三要素：分子、分母、边界；不写口径等于没有指标 |
| 真的吗 | 样本量 ≥ 30、同集同配置、多次运行看方差 |
| 失败样本 | 必须保留并归因，这是评测真正的产出 |
| 防刷分 | 看分层指标，警惕整体提升掩盖局部退化 |

<p class="pull-quote">评测不是打分表，是研发工具。它的产出不是那个百分比，而是「下一步该改哪里」的清单。<cite>本刊编辑部</cite></p>

下一章讲评测集从哪来——答案可能会让你意外：它不是设计出来的，是长出来的。

## 八、参考与延伸

评测的坑大多不是数学，而是纪律。下面几份材料按「建立直觉 → 动手 → 对齐一手定义」排好。

**先看图（建立直觉）**

- [Hamel Hussain 的博客](https://hamel.dev/) —— 大量关于 LLM 评测方法论与防刷分的实战文章，尤其适合建立「指标为什么会骗人」的直觉。**重点看他反复强调的「先定义什么是好，再谈怎么测」这一条。**
- [Eugene Yan · Evaluations in LLM/LLMOps](https://eugeneyan.com/) —— 从工程视角梳理评测与上线监控的关系。**他关于「线上信号比离线分数更可信」的论述，正好对应本章的失败样本与用户行为信号。**

**再看代码（动手实现）**

- [OpenAI Evals](https://github.com/openai/evals) —— 官方评测框架，直接看 grading 函数怎么写、rubric 怎么表达。**对比本章第四节的骨架，能立刻看出「生产级评测」多做了哪些事（版本化、回归、可复现）。**

**最后读论文（对齐一手定义）**

- [HELM · 斯坦福 CRFM 全息评测](https://crfm.stanford.edu/helm/latest/) —— 把评测维度、场景、指标做成一套公开口径的基准。**它的价值不在分数高低，而在于「口径公开、可复现」这件事本身，这正是本章反复强调的。**
- [SWE-bench](https://github.com/SWE-bench/SWE-bench) —— 可执行指标的一手标杆：以「能不能跑通测试」定义完成度。**想理解「端到端完成率」为什么比人工评审可信，看它怎么构造可判定的任务就够了。**
