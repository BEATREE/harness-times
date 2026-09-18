---
chapter: eval-03-executable-metrics
lead: '可执行率、参数准确率、任务完成率——这三个词每个人都说得出来，但问「分母是什么」「枚举和自由文本能用同一个口径吗」，多数人答不上来。而口径不清的指标比没有指标更危险：它会让你在错误的数字上做出信心十足的决策。'
note: '本章的核心是「口径」二字。建议读完把三张表存下来，面试讲到评测时可以直接引用。'
---

<p class="dropcap">办事型 Agent 的评测看起来比洞察型简单——因为它有明确的对错。但恰恰是「明确的对错」让人放松警惕：既然有对错，就一定能算准。事实是，三个团队测同一个系统，可能得出三个差 20 个百分点的答案，而每个团队都认为自己是对的。</p>

## 一、第一个坑：分母

这是最常见、影响最大的问题。看一个具体的例子：把[[executable-rate|可执行率]]的三种口径摆出来——

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>口径设计</th><th>分子</th><th>分母</th><th>算出的「可执行率」</th><th>问题</th></tr></thead>
    <tbody>
      <tr><td>A · 只看成功的样本</td><td>执行成功且结果正确</td><td>成功产出了 DSL 的样本</td><td>约 <b>89%</b></td><td>把「没产出」的样本排除在分母外，等于把失败藏起来了</td></tr>
      <tr><td>B · 全样本</td><td>执行成功且结果正确</td><td>参与评测的全部样本</td><td>约 <b>67%</b></td><td>准确反映端到端表现，适合对外汇报</td></tr>
      <tr><td>C · 排除不可解样本</td><td>执行成功且结果正确</td><td>全部样本减去「信息不足无法完成」的样本</td><td>约 <b>78%</b></td><td>更公平地衡量「在可解问题上做得多好」，但必须公开排除规则</td></tr>
    </tbody>
  </table>
</div>

三个数字都「对」，但含义完全不同。关键纪律是：报一个数字时必须同时报它的分母定义——这正是[[end-to-end-rate|端到端完成率]]（分母 = 全样本）之所以最值得对外汇报的原因。而且在同一份对比报告里，口径不能变——这次用 B、下次用 A 来显示进步，是典型的指标作弊。

<div class="box box-key">
  <span class="box-title">推荐的做法：分层报告，而不是选一个口径</span>
  <p>与其争论哪个口径对，不如把结果拆开报：</p>
  <ul>
    <li><b>端到端完成率</b>（分母 = 全样本）：最适合对外、最能反映用户真实体验；</li>
    <li><b>可解样本完成率</b>（分母 = 全样本 − 不可解）：用来衡量「技术能力的上限有多高」；</li>
    <li><b>不可解样本的处理率</b>（分母 = 不可解样本）：衡量「该拒绝或追问时有没有正确拒绝/追问」——<b>这是一个独立且非常重要的指标</b>。</li>
  </ul>
  <p>第三个指标最容易被漏掉，但它决定了系统「会不会硬猜」。一个把不可解问题也硬答的系统，端到端完成率数字会好看，但用户体验更差。</p>
</div>

## 二、第二个坑：什么叫「参数准确」

「参数准确率」听起来是最客观的指标——毕竟参数有明确的值。但只要细看就会发现问题成堆，最核心的是[[metric-granularity|比对粒度]]没事先定好。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 420" role="img" aria-label="参数准确率的四种比对粒度及其适用场景">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">「参数对了」有四种含义</text>
      <text x="16" y="38" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">同一个样本，不同粒度会得出「对」或「错」两种结论。必须先定粒度，再算数字。</text>
      <!-- 期望参数 -->
      <rect x="16" y="52" width="628" height="66" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="30" y="72" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#1f1b16">任务：查 2025 年 3 月华东区、销售额大于 100 万的客户</text>
      <text x="30" y="92" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">人工标注的期望参数：</text>
      <text x="30" y="108" font-family="ui-monospace, monospace" font-size="9.4" fill="#2f6157">{"region": "east", "year": 2025, "month": 3, "metric": "sales", "threshold": 1000000, "op": "&gt;"}</text>
      <!-- 四种粒度 -->
      <rect x="16" y="130" width="154" height="176" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="28" y="150" font-family="Georgia, serif" font-size="10.4" font-weight="700" fill="#2f6157">① 结构级</text>
      <text x="28" y="170" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">只要求 JSON 能解析、</text>
      <text x="28" y="184" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">必填字段齐全</text>
      <text x="28" y="206" font-family="ui-monospace, monospace" font-size="8.8" fill="#2f6157">放宽度：最松</text>
      <text x="28" y="224" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">适合：早期快速迭代</text>
      <text x="28" y="242" font-family="ui-monospace, monospace" font-size="8.8" fill="#9b2c2c">风险：语法对但语义全错</text>
      <text x="28" y="260" font-family="ui-monospace, monospace" font-size="8.8" fill="#9b2c2c">也能算「通过」</text>
      <text x="28" y="284" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">通常虚高 15-25 个百分点</text>
      <rect x="178" y="130" width="154" height="176" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <text x="190" y="150" font-family="Georgia, serif" font-size="10.4" font-weight="700" fill="#8a6a1e">② 字段级</text>
      <text x="190" y="170" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">逐个字段比对，要求值</text>
      <text x="190" y="184" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">完全一致</text>
      <text x="190" y="206" font-family="ui-monospace, monospace" font-size="8.8" fill="#8a6a1e">放宽度：中</text>
      <text x="190" y="224" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">适合：参数枚举明确的接口</text>
      <text x="190" y="242" font-family="ui-monospace, monospace" font-size="8.8" fill="#9b2c2c">风险：等价表达被判错</text>
      <text x="190" y="260" font-family="ui-monospace, monospace" font-size="8.8" fill="#9b2c2c">（"east" vs "East"）</text>
      <text x="190" y="284" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">最常见的选择</text>
      <rect x="340" y="130" width="154" height="176" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="352" y="150" font-family="Georgia, serif" font-size="10.4" font-weight="700" fill="#2f6157">③ 语义等价级</text>
      <text x="352" y="170" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">规范化后比对：大小写、</text>
      <text x="352" y="184" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">单位、同义词映射</text>
      <text x="352" y="206" font-family="ui-monospace, monospace" font-size="8.8" fill="#2f6157">放宽度：较严</text>
      <text x="352" y="224" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">适合：生产环境的准确评估</text>
      <text x="352" y="242" font-family="ui-monospace, monospace" font-size="8.8" fill="#2f6157">优点：贴近「能不能用」</text>
      <text x="352" y="260" font-family="ui-monospace, monospace" font-size="8.8" fill="#9b2c2c">成本：要维护规范化规则</text>
      <text x="352" y="284" font-family="ui-monospace, monospace" font-size="8.8" fill="#2f6157">推荐：指标与业务指标对齐</text>
      <rect x="502" y="130" width="142" height="176" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="514" y="150" font-family="Georgia, serif" font-size="10.4" font-weight="700" fill="#9b2c2c">④ 结果级</text>
      <text x="514" y="170" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">不看参数，直接比</text>
      <text x="514" y="184" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">查询返回的数据结果</text>
      <text x="514" y="206" font-family="ui-monospace, monospace" font-size="8.8" fill="#9b2c2c">放宽度：最严（也最真）</text>
      <text x="514" y="224" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">适合：最终验收</text>
      <text x="514" y="242" font-family="ui-monospace, monospace" font-size="8.8" fill="#2f6157">优点：无法被「碰巧写对」</text>
      <text x="514" y="260" font-family="ui-monospace, monospace" font-size="8.8" fill="#2f6157">的参数骗过</text>
      <text x="514" y="284" font-family="ui-monospace, monospace" font-size="8.8" fill="#9b2c2c">成本：需要可执行的环境</text>
      <!-- 陷阱 -->
      <rect x="16" y="320" width="628" height="88" fill="#fbf8f2" stroke="#1f1b16" stroke-width="1.3"/>
      <text x="30" y="340" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#1f1b16">枚举与自由文本不能用同一个口径</text>
      <text x="30" y="360" font-family="ui-monospace, monospace" font-size="9.3" fill="#6b6257">枚举参数（region / unit / op）：字段级比对即可，值来自封闭集合，等价形式可以穷举。</text>
      <text x="30" y="378" font-family="ui-monospace, monospace" font-size="9.3" fill="#6b6257">自由文本参数（用户的自然语言条件、备注）：无法用字段级比对，必须走语义等价判断（模型或规则）。</text>
      <text x="30" y="398" font-family="ui-monospace, monospace" font-size="9.3" fill="#9b2c2c">把两者混在一起算一个「参数准确率」，得到的数既不能反映结构正确性，也不能反映语义正确性。</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　参数准确率的四种粒度。选择原则很简单：<b>指标粒度应该与「业务会不会因此出错」对齐</b>——如果大小写不影响执行结果，就不该判错；如果阈值写错会导致查错数据，就必须判错。  </figcaption>
</figure>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 320" role="img" aria-label="同一系统三种分母口径给出三个不同的可执行率">
      <defs>
        <marker id="ar2" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">同一系统，三种分母，三个数</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">可执行率：89% / 67% / 78%——差 22 个百分点，全是分母不同</text>
      <line x1="100" y1="270" x2="600" y2="270" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="100" y="286" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">0</text>
      <text x="350" y="286" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">50</text>
      <text x="600" y="286" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">100</text>
      <rect x="130" y="110" width="110" height="160" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.2"/>
      <text x="185" y="102" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#9b2c2c">A 89%</text>
      <text x="185" y="300" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">只看成功样本</text>
      <rect x="300" y="149" width="110" height="121" fill="#eef4f1" stroke="#2f6157" stroke-width="1.2"/>
      <text x="355" y="141" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#2f6157">B 67%</text>
      <text x="355" y="300" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">全样本（推荐对外）</text>
      <rect x="470" y="130" width="110" height="140" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="525" y="122" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#8a6a1e">C 78%</text>
      <text x="525" y="300" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">排除不可解样本</text>
      <text x="16" y="312" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">A 把「没产出」的样本排除在分母外，等于把失败藏起来。报数必须连带分母；对比时口径不能变，否则差距只是分母游戏。</text>
    </svg>
  </div>
  <figcaption><b>图 2</b>　三个团队测同一个系统能得出差 22 个百分点的数，且都「没错」。<b>识别方法永远是三问：分子、分母、边界怎么算</b>——这一问，大多数「我们更强」的争论会自己结束。</figcaption>
</figure>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 300" role="img" aria-label="不可解样本必须单列指标，否则硬猜被端到端完成率掩盖">
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">不可解样本必须单列指标</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">一个把不可解问题也硬答的系统：端到端完成率虚高，但不可解处理率暴露了真相</text>
      <line x1="100" y1="250" x2="600" y2="250" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="100" y="266" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">0</text>
      <text x="350" y="266" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">50</text>
      <text x="600" y="266" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">100</text>
      <rect x="150" y="97" width="120" height="153" fill="#eef4f1" stroke="#2f6157" stroke-width="1.2"/>
      <text x="210" y="89" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#2f6157">端到端 85%</text>
      <text x="210" y="288" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">看起来不错</text>
      <rect x="390" y="200" width="120" height="50" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.2"/>
      <text x="450" y="192" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#9b2c2c">不可解处理 20%</text>
      <text x="450" y="288" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#9b2c2c">实际在硬猜</text>
      <text x="16" y="290" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">判据：不可解处理率必须独立成指标；端到端高但不可解处理低 = 系统把「不知道」也硬答了，体验更差。</text>
    </svg>
  </div>
  <figcaption><b>图 3</b>　只看端到端完成率，这个系统能拿 85 分；但它在不可解问题上基本靠硬猜（仅 20% 正确处理）。<b>单列不可解处理率，才拦得住「硬猜」这种最隐蔽的退化。</b></figcaption>
</figure>

## 三、第三个坑：任务完成率怎么判

「任务完成」是最难判定的指标，因为它通常需要人来看结果。可行的做法是按任务类型分三档，能用程序判定的优先程序化——这直接关系到[[task-completion-rate|任务完成率]]怎么算才不虚高：

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>任务类型</th><th>判定方式</th><th>可信度</th><th>成本</th></tr></thead>
    <tbody>
      <tr><td>结果可程序化验证</td><td>跑一遍、比对期望结果（如查出的行数、生成的代码能否通过测试）</td><td><b>最高</b></td><td>低（一次执行）</td></tr>
      <tr><td>结果可部分验证</td><td>检查关键断言（字段是否齐全、数值是否在合理范围、引用是否真实存在）</td><td>较高</td><td>中（写断言）</td></tr>
      <tr><td>结果需人工判断</td><td>抽样人工评审 + 多人交叉打分</td><td>一般</td><td><b>高</b>（每人每条若干分钟）</td></tr>
    </tbody>
  </table>
</div>

<div class="box box-practice">
  <span class="box-title">一个能大幅降低人工成本的技巧</span>
  <p><b>把「需人工判断」的任务尽量改造成「可程序化验证」。</b>具体做法是：不判定最终文本好不好，而是判定几个可程序化的副作用——</p>
  <ul>
    <li>产物文件是否存在、格式是否合法（解析一下就知道）；</li>
    <li>报告里提到的每个引用是否真实存在（拿 URL 去 HEAD 一下）；</li>
    <li>生成的查询是否真的能跑通且返回非空（跑一遍）；</li>
    <li>是否需要澄清时真的澄清了（检查是否发生了澄清动作）。</li>
  </ul>
  <p>这四条检查全部可以自动完成，而且它们覆盖了「完成度」最实质的部分。<b>剩下真正需要人看的，往往只有 10%-20%。</b></p>
</div>

## 四、动手：三档指标的计算实现

```python title="executable_metrics.py"
from dataclasses import dataclass
from typing import Any
import re, unicodedata
def normalize(v: Any, rules: dict) -> Any:
    """
    语义等价的规范化。规则必须是显式的、可审阅的，
    而不是「遇到不一致就放宽」——否则指标会失去意义。
    """
    if isinstance(v, str):
        v = unicodedata.normalize("NFKC", v).strip()
        if rules.get("case_insensitive"):
            v = v.lower()
        for src, dst in rules.get("synonyms", {}).items():
            if v == src:
                v = dst
    return v
def args_match(pred: dict, gold: dict, rules: dict) -> tuple[bool, list[str]]:
    """
    参数比对：返回 (是否匹配, 不匹配的字段列表)。
    返回字段明细很重要 —— 归因时你需要知道是哪个字段在错。
    """
    bad = []
    for k, gv in gold.items():
        if k not in pred:
            bad.append(f"{k}:缺失")
            continue
        pv = normalize(pred[k], rules.get(k, {}))
        if pv != normalize(gv, rules.get(k, {})):
            bad.append(f"{k}:{pv!r}≠{gv!r}")
    return (len(bad) == 0), bad
@dataclass
class MetricReport:
    """分层报告：任何一个数字都必须带口径说明"""
    end_to_end: float          # 分母 = 全样本
    solvable_only: float       # 分母 = 全样本 - 不可解
    refuse_handling: float     # 分母 = 不可解样本（正确拒绝或澄清的比例）
    args_field_level: float    # 参数：字段级严格比对
    args_semantic: float       # 参数：语义等价比对
    n_total: int
    n_solvable: int
    n_unsolvable: int
    def render(self) -> str:
        return (
            f"端到端完成率　　{self.end_to_end:.1%}"
            f"　（分母 {self.n_total} = 全样本）\n"
            f"可解样本完成率　{self.solvable_only:.1%}"
            f"　（分母 {self.n_solvable} = 全样本 − 不可解）\n"
            f"不可解处理正确率 {self.refuse_handling:.1%}"
            f"　（分母 {self.n_unsolvable} = 不可解样本，正确拒绝或追问澄清）\n"
            f"参数字段级准确率 {self.args_field_level:.1%}　（严格比对）\n"
            f"参数语义等价准确率 {self.args_semantic:.1%}　（规范化后比对）\n"
            f"※ 两行参数指标差值 = {abs(self.args_field_level - self.args_semantic):.1%}，"
            f"差值过大说明模型偏好非标准表达，可在描述里给出枚举值收敛"
        )
def evaluate(results: list[dict], rules: dict) -> MetricReport:
    """
    results 的每项形如：
    {
      "solvable": True,
      "pred_args": {...} | None,
      "gold_args": {...},
      "executed_ok": True,          # 真正跑通且结果正确
      "correctly_refused": False,   # 不可解样本上是否给出了正确回应
    }
    """
    total = len(results)
    unsolvable = [r for r in results if not r["solvable"]]
    solvable = [r for r in results if r["solvable"]]
    e2e = sum(1 for r in results if r.get("executed_ok")) / total if total else 0
    solv = sum(1 for r in solvable if r.get("executed_ok")) / len(solvable) if solvable else 0
    refu = (sum(1 for r in unsolvable if r.get("correctly_refused")) / len(unsolvable)
            if unsolvable else 0)
    has_args = [r for r in results if r.get("pred_args") and r.get("gold_args")]
    field_ok = sum(1 for r in has_args if args_match(r["pred_args"], r["gold_args"], {})[0])
    sem_ok = sum(1 for r in has_args if args_match(r["pred_args"], r["gold_args"], rules)[0])
    return MetricReport(
        end_to_end=e2e,
        solvable_only=solv,
        refuse_handling=refu,
        args_field_level=field_ok / len(has_args) if has_args else 0,
        args_semantic=sem_ok / len(has_args) if has_args else 0,
        n_total=total, n_solvable=len(solvable), n_unsolvable=len(unsolvable),
    )
# --- 规范化规则示例（显式、可审阅、可版本化） ---
RULES = {
    "case_insensitive": True,                 # 全局：忽略大小写
    "region": {"synonyms": {"华东": "east", "华东区": "east", "East": "east"}},
    "op": {"synonyms": {"大于": ">", ">": ">", "gt": ">"}},
    "unit": {"synonyms": {"万": "10000", "万元": "10000"}},
}
```



<div class="box box-warn">
  <span class="box-title">规范化规则必须版本化</span>
  <p>规范化规则一旦修改，历史指标就不可比了。例如把「华东区」加入同义词后，参数准确率会突然上升——但这不代表系统变好了，只是评判标准变了。</p>
  <p><b>做法：把 <code>RULES</code> 当成代码一样纳入版本管理，规则变更时在报告里显式标注「口径已更新」，并且不要在规则变更的同一版里对比新旧数据。</b>这是评测工程的专业性所在，也是「口径不清等于没有指标」这句话的具体表现。</p>
</div>

## 五、常见误区与追问

### 5.1 误区：可执行率只要能跑就行（其实「可执行」含「跑对」）

很多人把「输出能被解析」就当成功。错。可执行率的「可执行」必须包含「跑出正确结果」——否则语法对但字段名错的情况会被算作成功，指标系统性虚高。判据：把三种口径（解析 / 引擎接受 / 结果正确）分开报；只报最宽松口径的团队，分数至少虚高 15-25 个百分点。

### 5.2 误区：参数准确率用一种粒度就够了（其实枚举和自由文本天差地别）

用字段级严格比对处理自由文本，等价表达（「华东」vs「east」）会被判错；用语义比对处理枚举，该抓的错被放过。[[arg-accuracy|参数准确率]]的比对粒度必须按参数类型选：枚举走字段级，自由文本走语义级。判据：把两个粒度都算出来，两者差值大说明模型偏好非标准表达——这本身是一条优化线索。

### 5.3 误区：不可解样本也该硬答（其实是硬猜）

信息不足、根本不该答的问题，系统却给了一个看似合理的答案，端到端完成率反而更高。[[unsolvable-sample|不可解样本]]的正确处理是拒绝或追问澄清。判据：必须把[[refusal-handling|不可解处理率]]单列成指标；该拒绝却硬答的样本要当作失败计入，而不是当成「完成了一次回答」。

### 5.4 误区：字符串「归一化」和向量「归一化」是一回事（其实完全不同）

评测里说的[[string-normalization|字符串规范化]]是统一大小写、单位、同义词后再比对；而向量语境的「归一化」是把向量缩放到单位长度。混用这两个词会导致规则写错、比对失效。判据：凡涉及参数比对，明确写「字符串规范化」；涉及 embedding 相似度再谈向量归一化，二者不 crossover。

### 5.5 误区：两个写法不同就是错（其实是语义等价）

「2025年3月」和「2025-03」表达的是同一个时间，字段级比对会判错。[[semantic-equivalence|语义等价]]要求规范化后判定两者是否同义。判据：维护一张显式的同义词与单位映射表，把「华东/East」这类都归一；但映射必须经人工审阅，不能「遇不一致就放宽」，否则指标失去意义。

### 5.6 误区：规范化规则改了无所谓（其实历史指标立刻不可比）

把「华东区」加入同义词后参数准确率会突然上升——但这不代表系统变好，只是评判标准变了。[[rule-versioning|规则版本化]]要求把规范化规则当代码管，变更时显式标注「口径已更新」，且不在变更同版对比新旧数据。判据：规则一改，新旧指标必须打上不同版本号，禁止直接相减。

## 六、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>第 2 题是真实面试题</span></div>
  <div class="q-item" data-qid="eval03-q1" data-answer="1">
    <div class="q-text"><span class="idx">Q1</span>为什么「不可解样本的处理正确率」是一个必须有独立指标？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>因为这类样本数量最多</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>因为它衡量系统会不会硬猜：正确拒绝或追问澄清是可贵的正确行为，但在只看完成率的指标里会被埋没甚至惩罚</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>因为它更容易计算</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>因为它能提升整体完成率</span></button>
    <div class="explain"><b>B。</b>如果只看「完成率」，一个面对模糊需求就直接猜一个查询的系统会拿到更高分数——因为「追问澄清」在完成率视角下等于没完成任务。<b>这会系统性地激励错误行为。</b>把「正确处理不可解问题」单列成指标，才能纠正这个激励。</div>
  </div>
  <div class="q-item" data-qid="eval03-q2" data-answer="3">
    <div class="q-text"><span class="idx">Q2</span>枚举参数与自由文本参数可以合用同一个「参数准确率」口径吗？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>可以，都是参数，一样处理</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>可以，只要都用严格比对</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>可以，只要都用语义比对</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>不可以。枚举值来自封闭集合，可穷举等价形式并严格比对；自由文本无法字段比对，必须走语义判断——混算会得到一个既反映不了结构正确性、也反映不了语义正确性的数字</span></button>
    <div class="explain"><b>D。</b>这是「口径」问题最典型的表现。用严格比对处理自由文本 → 大量等价表达被判错（指标偏低且无意义）；用语义比对处理枚举 → 该抓的错被放过（指标虚高）。<b>正确做法是分列两个指标，并观察两者差值——差值大说明模型偏好非标准表达，这本身是一条有价值的优化线索。</b></div>
  </div>
  <div class="q-item" data-qid="eval03-q3" data-answer="0">
    <div class="q-text"><span class="idx">Q3</span>团队 A 报可执行率 89%，团队 B 报 67%，最可能的原因是？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>两者分母不同：A 只把「成功产出 DSL」的样本计入分母，B 用全样本</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>A 的模型更强</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>A 的评测集更简单</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>A 用了更多的人工评审</span></button>
    <div class="explain"><b>A。</b>这是最典型的「口径差异伪装成能力差异」。<b>识别方法：拿到任何指标先问三件事——分子是什么、分母是什么、边界情况怎么算。</b>三问之后，大部分「我们的数字比你们好」的讨论都会自动结束。B、C 也可能造成差异，但 22 个百分点的差距更符合分母口径不同的特征。</div>
  </div>
</div>

## 七、小结

| 指标 | 关键口径问题 |
| --- | --- |
| 可执行率 | 分母是「全样本」还是「成功产出样本」？差 20 个百分点 |
| 参数准确率 | 粒度是结构级 / 字段级 / 语义等价级 / 结果级？ |
| 任务完成率 | 能程序化验证的优先程序化；人工评审控制在 10-20% |
| 不可解处理率 | 必须独立成指标，否则会激励「硬猜」 |
| 规范化规则 | 必须显式、可审阅、可版本化；变更时口径标注更新 |
| 报告方式 | 分层报告（端到端 / 可解 / 不可解），不选单一数字 |

<p class="pull-quote">指标的全部价值在于「能被复现」。一个别人复现不出来的数字，无论多么精确，都只是个人观点。<cite>本刊编辑部</cite></p>

下一章处理更棘手的问题：当输出是「洞察」而不是「结果」，怎么评？

## 八、参考与延伸

办事型指标的核心不是「算出一个数」，而是「这个数能不能被复现、口径有没有写清」。下面按「建立直觉 → 动手 → 对齐一手定义」排好。

**先看图（建立直觉）**

- [Promptfoo 文档](https://www.promptfoo.dev/) —— 开源评测框架，支持把「期望行为」写成可执行断言（含参数比对、语义等价）。**重点看它怎么定义不同严格度的断言，正好对应本章的粒度阶梯。**
- [Hamel Hussain 博客](https://hamel.dev/) —— 大量 LLM 评测实战，尤其「可执行指标怎么写才不骗人」。**他反复强调的「先定义什么是正确，再谈怎么测」，正是分母与口径纪律的来由。**

**再看代码（动手实现）**

- [OpenAI Evals](https://github.com/openai/evals) —— 官方评测框架，grading 函数与 rubric 怎么表达「结果级」判定。**对比本章第四节的 MetricReport，能看出生产级框架多做了哪些分层与版本管理。**

**最后读论文（对齐一手定义）**

- [SWE-bench](https://github.com/SWE-bench/SWE-bench) —— 以「能否跑通测试」定义任务完成度的一手基准。**它是「端到端完成率」最硬核的样本：不可解的不算，跑错的算失败。**
- [HELM · 斯坦福 CRFM](https://crfm.stanford.edu/helm/latest/) —— 公开口径的指标基准，把场景与指标做成可被复现的定义。**想理解「为什么口径必须版本化」，看它怎么维护指标定义最直观。**
