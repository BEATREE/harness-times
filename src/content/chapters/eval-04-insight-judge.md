---
chapter: eval-04-insight-judge
lead: '「洞察好不好」能不能评？能，但前提是先把维度拆开——方向相关性、证据充分性、可操作性、表达清晰度。四维分开之后，每一维都能写出可判定的评分标准。随后的问题更棘手：怎么让机器打分可信？答案是必须先认清机器打分的四类偏差。'
note: '本章的 Rubric 设计与偏差控制是评测工程的深水区。第 1 题和第 3 题是面试中的高频追问。'
---

<p class="dropcap">办事型任务的评测有客观结果可依，洞察型任务的输出是一段分析、一份建议、一个报告。它没有唯一的正确答案，所以「好不好」看起来只能靠人判断。但「看起来只能靠人判断」不等于「无法系统化」——关键在于把模糊的总评拆成若干个可分别判断的维度。</p>

## 一、把「有洞察」拆成四个维度

「这篇分析很有洞察」是一个整体印象。要让它可评，必须拆到每一维都能独立回答「是/否」的程度。

这份 [[rubric]] 把「好不好」拆成四个互不包含的维度：[[direction-relevance|方向相关性]]——答的是不是用户真正关心的问题；[[evidence-sufficiency|证据充分性]]——每条结论有没有可核验的依据；[[actionability|可操作性]]——看完能不能直接动手。拆分是否成立，有一条判据就能验：能不能构造出一份「方向对、证据足、表达清楚，但完全没说该做什么」的输出？能构造，说明可操作性是一维独立的能力；构造不出，说明它和前两维其实是一件事。

<div class="tbl-wrap">
  <table class="news">
    <caption>洞察型输出的四维 Rubric</caption>
    <thead><tr><th>维度</th><th>回答什么问题</th><th>5 分（优秀）</th><th>3 分（合格）</th><th>1 分（不合格）</th></tr></thead>
    <tbody>
      <tr>
        <td><b>方向相关性</b></td>
        <td>是否回答了用户真正关心的问题？</td>
        <td>直击核心问题，且发现了用户没明说但更重要的那个问题</td>
        <td>回答了明确提出的问题</td>
        <td>答非所问，或只复述了数据没有回应问题</td>
      </tr>
      <tr>
        <td><b>证据充分性</b></td>
        <td>每条结论是否有可核验的依据？</td>
        <td>每个结论都有具体数据/来源支撑，且给出了量级或对比基线</td>
        <td>主要结论有依据，个别结论为推测但已标注</td>
        <td>结论无依据，或用了「显著」「大幅」等无量化词</td>
      </tr>
      <tr>
        <td><b>可操作性</b></td>
        <td>用户看完能做什么？</td>
        <td>给出了具体动作、执行主体、判断标准，用户可直接排期</td>
        <td>给出方向性建议，但未细化到可执行</td>
        <td>只有现象描述，没有下一步</td>
      </tr>
      <tr>
        <td><b>表达清晰度</b></td>
        <td>信息是否结构化、可快速定位？</td>
        <td>结构清晰、有摘要、长短得当、关键数字突出</td>
        <td>结构基本清楚，篇幅略长或重点不突出</td>
        <td>大段文字堆砌，找不到重点</td>
      </tr>
    </tbody>
  </table>
</div>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 400" role="img" aria-label="洞察型评分的四维雷达与合成方式">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">四维分开评，再合成</text>
      <!-- 两个样本对比 -->
      <text x="16" y="48" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">同一个问题，两份输出的得分差异（5 分制）</text>
      <!-- 样本 A -->
      <rect x="16" y="58" width="308" height="180" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="30" y="78" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#2f6157">输出 A　总评 4.5（可交付）</text>
      <text x="30" y="104" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">方向相关性</text>
      <rect x="130" y="94" width="180" height="12" fill="#e8e2d6"/>
      <rect x="130" y="94" width="180" height="12" fill="#2f6157"/>
      <text x="316" y="104" font-family="ui-monospace, monospace" font-size="9" fill="#2f6157">5</text>
      <text x="30" y="128" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">证据充分性</text>
      <rect x="130" y="118" width="180" height="12" fill="#e8e2d6"/>
      <rect x="130" y="118" width="144" height="12" fill="#2f6157"/>
      <text x="316" y="128" font-family="ui-monospace, monospace" font-size="9" fill="#2f6157">4</text>
      <text x="30" y="152" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">可操作性</text>
      <rect x="130" y="142" width="180" height="12" fill="#e8e2d6"/>
      <rect x="130" y="142" width="180" height="12" fill="#2f6157"/>
      <text x="316" y="152" font-family="ui-monospace, monospace" font-size="9" fill="#2f6157">5</text>
      <text x="30" y="176" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">表达清晰度</text>
      <rect x="130" y="166" width="180" height="12" fill="#e8e2d6"/>
      <rect x="130" y="166" width="144" height="12" fill="#2f6157"/>
      <text x="316" y="176" font-family="ui-monospace, monospace" font-size="9" fill="#2f6157">4</text>
      <text x="30" y="204" font-family="ui-monospace, monospace" font-size="9" fill="#2f6157">四维都高 → 可以直接交付给业务方</text>
      <text x="30" y="222" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">特征：有结论、有依据、有动作、结构清楚</text>
      <!-- 样本 B -->
      <rect x="336" y="58" width="308" height="180" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="350" y="78" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#9b2c2c">输出 B　总评 3.0（不能交付）</text>
      <text x="350" y="104" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">方向相关性</text>
      <rect x="450" y="94" width="140" height="12" fill="#e8e2d6"/>
      <rect x="450" y="94" width="112" height="12" fill="#9b2c2c"/>
      <text x="596" y="104" font-family="ui-monospace, monospace" font-size="9" fill="#9b2c2c">4</text>
      <text x="350" y="128" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">证据充分性</text>
      <rect x="450" y="118" width="140" height="12" fill="#e8e2d6"/>
      <rect x="450" y="118" width="84" height="12" fill="#9b2c2c"/>
      <text x="596" y="128" font-family="ui-monospace, monospace" font-size="9" fill="#9b2c2c">3</text>
      <text x="350" y="152" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">可操作性</text>
      <rect x="450" y="142" width="140" height="12" fill="#e8e2d6"/>
      <rect x="450" y="142" width="28" height="12" fill="#9b2c2c"/>
      <text x="596" y="152" font-family="ui-monospace, monospace" font-size="9" fill="#9b2c2c">1</text>
      <text x="350" y="176" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">表达清晰度</text>
      <rect x="450" y="166" width="140" height="12" fill="#e8e2d6"/>
      <rect x="450" y="166" width="112" height="12" fill="#9b2c2c"/>
      <text x="596" y="176" font-family="ui-monospace, monospace" font-size="9" fill="#9b2c2c">4</text>
      <text x="350" y="204" font-family="ui-monospace, monospace" font-size="9" fill="#9b2c2c">平均分 3.0 看似「合格」，但可操作性只有 1 分</text>
      <text x="350" y="222" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">→ 这类输出业务方看完不知道要做什么，实质无用</text>
      <!-- 合成规则 -->
      <rect x="16" y="248" width="628" height="140" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="30" y="268" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">合成规则：不要简单求平均</text>
      <text x="30" y="290" font-family="ui-monospace, monospace" font-size="9.3" fill="#6b6257">规则一　一票否决：可操作性 &lt; 2 分 → 总评为不合格，无论其他维度多高。</text>
      <text x="30" y="310" font-family="ui-monospace, monospace" font-size="9.3" fill="#6b6257">　　　理由：洞察的最终价值在于「用户能据此行动」。没有动作的建议，写得再漂亮也没有价值。</text>
      <text x="30" y="330" font-family="ui-monospace, monospace" font-size="9.3" fill="#6b6257">规则二　权重差异：方向相关性权重最高（0.35），其余三维各 0.22 左右。</text>
      <text x="30" y="350" font-family="ui-monospace, monospace" font-size="9.3" fill="#6b6257">　　　理由：方向错了，后面三项的努力全部作废——这是「南辕北辙」的量化表达。</text>
      <text x="30" y="372" font-family="ui-monospace, monospace" font-size="9.3" fill="#9b2c2c">警示：平均分掩盖短板。4/4/1/4 与 3/3/3/3 的平均分都是 3.0 上下，但前者实质无用，后者至少可读。</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　四维分开评的核心价值在于<b>暴露短板</b>。样本 B 的平均分看似合格，但可操作性只有 1 分——这类输出在业务上等于零价值。<b>所以合成时必须有「一票否决」规则，不能简单求平均。</b></figcaption>
</figure>

## 二、LLM-as-Judge：能用，但要认清它的偏差

让模型来打分是必要手段（人工成本太高），但它的四类偏差必须被系统性地处理——这套做法通称 [[llm-as-judge|LLM-as-Judge]]。

<div class="tbl-wrap">
  <table class="news">
    <caption>机器打分的四类偏差与缓解手段</caption>
    <thead><tr><th>偏差</th><th>表现</th><th>成因</th><th>缓解手段</th></tr></thead>
    <tbody>
      <tr>
        <td><b>位置偏差</b></td>
        <td>在 A/B 对比中偏向先出现的那一个</td>
        <td>注意力对前文更敏感</td>
        <td>交换顺序跑两次，两次结论一致才采纳；不一致则标记为「平局」</td>
      </tr>
      <tr>
        <td><b>长度偏差</b></td>
        <td>更长、更啰嗦的回答得分更高</td>
        <td>长度与「详尽」在训练语料里高度相关</td>
        <td>Rubric 里明确写「简洁且信息密度高得高分」，并单独统计长度与得分的相关性</td>
      </tr>
      <tr>
        <td><b>自我偏好</b></td>
        <td>评审模型偏袒与自己风格相似的输出</td>
        <td>同源模型的表达习惯一致</td>
        <td>用不同家族/不同规模的模型做评审；关键样本用人工复核</td>
      </tr>
      <tr>
        <td><b>格式偏好</b></td>
        <td>结构化、带小标题、带 emoji 的输出得分更高</td>
        <td>排版特征被当成质量信号</td>
        <td>评分前统一格式（去掉 Markdown 装饰），或把「格式」单列一维</td>
      </tr>
    </tbody>
  </table>
</div>

四类偏差里，[[position-bias|位置偏差]] 最容易自测：把 A、B 交换位置再跑一次，结论翻转就说明它存在。[[length-bias|长度偏差]] 最隐蔽，因为它和「详尽」在训练语料里天然相关，只看分数看不出来，必须单独统计「长度 × 得分」的相关系数。[[self-preference|自我偏好]] 只在生成模型与评审模型同源时出现，换一个模型家族重跑就能验证。[[format-bias|格式偏好]] 则表现为排版漂亮的答案分数更高——评分前剥掉 Markdown 装饰，就能把它隔离掉。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 430" role="img" aria-label="LLM-as-Judge 四类偏差各怎么验出来、各怎么压下去">
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">四类偏差：先验出来，再压下去</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">每一类都有「一眼可测」的对照实验：测不出量级，就不必为它改评分标准</text>
      <text x="30" y="70" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#1f1b16">偏差</text>
      <text x="170" y="70" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#1f1b16">怎么验出来</text>
      <text x="410" y="70" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#1f1b16">怎么压下去</text>
      <line x1="16" y1="78" x2="644" y2="78" stroke="#cfc6b6" stroke-width="1"/>
      <rect x="16" y="84" width="628" height="68" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1"/>
      <text x="30" y="112" font-family="ui-monospace, monospace" font-size="10.4" font-weight="700" fill="#9b2c2c">位置偏差</text>
      <text x="30" y="130" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">偏向先出现的那一个</text>
      <text x="170" y="112" font-family="ui-monospace, monospace" font-size="9.6" fill="#1f1b16">交换 A/B 顺序再评一次</text>
      <text x="170" y="130" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">翻转率 = 偏差的强度</text>
      <text x="410" y="112" font-family="ui-monospace, monospace" font-size="9.6" fill="#2f6157">两次一致才采信，不一致记平局</text>
      <text x="410" y="130" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">不要试图「校正偏移量」</text>
      <rect x="16" y="156" width="628" height="68" fill="#fdf6e8" stroke="#b8944b" stroke-width="1"/>
      <text x="30" y="184" font-family="ui-monospace, monospace" font-size="10.4" font-weight="700" fill="#8a6a1e">长度偏差</text>
      <text x="30" y="202" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">长而啰嗦的得分更高</text>
      <text x="170" y="184" font-family="ui-monospace, monospace" font-size="9.6" fill="#1f1b16">统计「长度 × 得分」相关系数</text>
      <text x="170" y="202" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">正相关 → 在给长答案加分</text>
      <text x="410" y="184" font-family="ui-monospace, monospace" font-size="9.6" fill="#2f6157">写「简洁且信息密度高者得高分」</text>
      <text x="410" y="202" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">并按长度分桶看平均分</text>
      <rect x="16" y="228" width="628" height="68" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1"/>
      <text x="30" y="256" font-family="ui-monospace, monospace" font-size="10.4" font-weight="700" fill="#9b2c2c">自我偏好</text>
      <text x="30" y="274" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">偏袒同源模型的风格</text>
      <text x="170" y="256" font-family="ui-monospace, monospace" font-size="9.6" fill="#1f1b16">换一个模型家族重跑</text>
      <text x="170" y="274" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">分数系统性下降 → 存在</text>
      <text x="410" y="256" font-family="ui-monospace, monospace" font-size="9.6" fill="#2f6157">评审模型与生成模型不同源</text>
      <text x="410" y="274" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">关键样本人工复核</text>
      <rect x="16" y="300" width="628" height="68" fill="#fdf6e8" stroke="#b8944b" stroke-width="1"/>
      <text x="30" y="328" font-family="ui-monospace, monospace" font-size="10.4" font-weight="700" fill="#8a6a1e">格式偏好</text>
      <text x="30" y="346" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">排版漂亮就加分</text>
      <text x="170" y="328" font-family="ui-monospace, monospace" font-size="9.6" fill="#1f1b16">同一份内容换两种排版各评一次</text>
      <text x="170" y="346" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">内容不变、分数却变 → 存在</text>
      <text x="410" y="328" font-family="ui-monospace, monospace" font-size="9.6" fill="#2f6157">评分前统一剥掉 Markdown 装饰</text>
      <text x="410" y="346" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">或把「格式」单列成一个维度</text>
      <rect x="16" y="376" width="628" height="48" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="30" y="398" font-family="ui-monospace, monospace" font-size="9.6" fill="#1f1b16">先量偏差，再改标准。位置、长度、自我偏好这三项，都能用一两次对照实验测出量级。</text>
      <text x="30" y="416" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">测不出量级，就不必为它改评分标准；测出来明显，改标准也压不下去——要从流程上解决。</text>
    </svg>
  </div>
  <figcaption><b>图 2</b>　四类偏差对应的对照实验与缓解手段。注意验证方法一栏：<b>它们都是「换个条件再跑一次」的对照实验，不是靠读模型给的分数去猜</b>。先把偏差量出来，才知道该不该动评分标准。</figcaption>
</figure>

<div class="box box-key">
  <span class="box-title">判断机器打分是否可信的三步校准</span>
  <ol>
    <li><b>一致性检查</b>：同一份输出打两次，分数差异超过 1 分的样本占比应低于 10%。超过说明 Rubric 描述不清。</li>
    <li><b>与人工对齐</b>：抽 30-50 条人工打分，计算与机器打分的相关性。同向率低于 75% 就不能直接用机器分数做决策。</li>
    <li><b>反例注入</b>：故意放入几条明显很差（如空输出、答非所问）的输出，看机器是否能给低分。给不出低分说明评分尺度整体偏松。</li>
  </ol>
</div>

## 三、动手：可校准的评分器

````python title="insight_judge.py"
import json, re
from dataclasses import dataclass
RUBRIC = """
你是评审员。请对下面这份分析输出按四个维度打分（1-5 的整数），
并给出理由。评分标准：
【方向相关性】5=直击核心问题且发现了用户未明说但更重要的问题；
　3=回答了明确提出的问题；1=答非所问或只复述数据。
【证据充分性】5=每个结论都有具体数据/来源，并给出量级或对比基线；
　3=主要结论有依据，个别为推测但已标注；1=结论无依据或使用无量化词。
【可操作性】5=给出具体动作、执行主体、判断标准，可直接排期；
　3=给出方向性建议但未细化；1=只有现象描述没有下一步。
【表达清晰度】5=结构清晰、有摘要、关键数字突出；3=结构基本清楚；
　1=大段文字堆砌找不到重点。
注意：
· 不要因为篇幅长而给高分，信息密度高才给高分。
· 不要因为排版漂亮而给高分，格式不计入表达清晰度之外的维度。
· 如果某维度确实无法判断，给 0 并在理由里说明。
只输出 JSON：
{"direction":n,"evidence":n,"actionable":n,"clarity":n,
 "reason":"一句话理由","blocking":"最严重的短板维度名或 null"}
"""
@dataclass
class Verdict:
    direction: int
    evidence: int
    actionable: int
    clarity: int
    reason: str
    blocking: str | None = None
    @property
    def weighted(self) -> float:
        """加权：方向相关性权重最高——方向错了，其余努力全部作废"""
        w = {"direction": 0.35, "evidence": 0.22, "actionable": 0.25, "clarity": 0.18}
        return (self.direction * w["direction"] + self.evidence * w["evidence"]
                + self.actionable * w["actionable"] + self.clarity * w["clarity"])
    def passed(self) -> bool:
        """一票否决：可操作性过低 → 直接判定不合格，不用平均分"""
        if self.actionable <= 2:
            return False
        return self.weighted >= 3.5
    def explain(self) -> str:
        return (f"方向 {self.direction} 证据 {self.evidence} "
                f"动作 {self.actionable} 表达 {self.clarity}　"
                f"加权 {self.weighted:.2f}　"
                f"{'通过' if self.passed() else '不通过'}"
                f"{f'（卡在 {self.blocking}）' if self.blocking else ''}")
def judge(output: str, call_model) -> Verdict:
    raw = call_model(RUBRIC, output, temperature=0)
    data = parse_lenient(raw)
    return Verdict(**{k: data[k] for k in
                      ("direction", "evidence", "actionable", "clarity", "reason")},
                   blocking=data.get("blocking"))
def parse_lenient(raw: str) -> dict:
    """宽容解析：模型常把 JSON 包在代码块里，或带尾随逗号"""
    text = raw.strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.M).strip()
    text = re.sub(r",(\s*[}\]])", r"\1", text)     # 去掉尾随逗号
    if "{" in text:
        text = text[text.index("{"): text.rindex("}") + 1]
    return json.loads(text)
def judge_stable(output: str, call_model, repeats: int = 2) -> tuple[Verdict, dict]:
    """
    稳定性检查：同一份输出多次打分。
    方差大的样本不能进入自动决策 —— 它们必须转人工。
    """
    verdicts = [judge(output, call_model) for _ in range(repeats)]
    scores = [v.weighted for v in verdicts]
    spread = max(scores) - min(scores)
    meta = {
        "spread": spread,
        "reliable": spread <= 0.8,     # 分差超过 0.8 视为不可靠
        "verdicts": [v.explain() for v in verdicts],
    }
    # 取中位数（比均值更抗单次异常）
    scores_sorted = sorted(scores)
    median = scores_sorted[len(scores_sorted) // 2]
    best = min(verdicts, key=lambda v: abs(v.weighted - median))
    return best, meta
def pairwise_stable(a: str, b: str, call_model) -> dict:
    """
    两两对比必须交换顺序跑两次。
    两次结论不一致 → 判平局，而不是选一个。
    """
    first = call_model(RUBRIC + "\n请判断 A 与 B 哪个更好。", f"【A】{a}\n【B】{b}", temperature=0)
    second = call_model(RUBRIC + "\n请判断 A 与 B 哪个更好。", f"【A】{b}\n【B】{a}", temperature=0)
    # 解析出「选了谁」，交换后应指向同一个原始样本
    pick1 = "A" if "A" in first[:20] else "B"
    pick2 = "B" if "A" in second[:20] else "A"      # 第二次的位置已交换
    return {
        "consistent": pick1 == pick2,
        "winner": pick1 if pick1 == pick2 else "tie",
        "note": "两次顺序一致的结论才可采信；否则记为平局",
    }
````



<div class="box box-warn">
  <span class="box-title">一个必须提防的循环论证</span>
  <p>如果用 A 模型生成洞察、又用 A 模型做评审，你会得到一组很漂亮且很一致的分数——但它是自证。这类系统在换用户之后会突然「失灵」，因为真实用户的偏好与 A 模型不一致。</p>
  <p><b>要求：评审模型与生成模型不同源；并且每轮评测都要抽样人工复核，用人工结论定期校准机器结论。</b>机器打分是用来降低人工成本的，不是用来替代人的判断的。</p>
</div>

把这条要求落到流程上，需要三样东西：[[circular-reasoning|循环论证]] 的检查——生成模型与评审模型必须不同源；稳定性过滤——同一份输出多次打分，加权分差超过 0.8 的样本转人工；以及 [[pairwise-comparison|两两对比]] 的顺序交换——两次结论一致才采信，不一致记平局，而不是把两次结果平均。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 360" role="img" aria-label="同源生成评审的自证链路与异源评审加人工校准的对照">
      <defs>
        <marker id="ar1" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">评审者换不换成别人，是可信与自证的分界</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">左边分数更漂亮，右边分数更低——但只有右边能迁移到真实用户</text>
      <rect x="16" y="54" width="308" height="212" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="30" y="76" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#9b2c2c">自证：同源生成 + 同源评审</text>
      <rect x="36" y="88" width="248" height="32" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <text x="160" y="109" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#9b2c2c">A 模型生成洞察</text>
      <line x1="160" y1="120" x2="160" y2="136" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar1)"/>
      <rect x="36" y="138" width="248" height="32" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <text x="160" y="159" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#9b2c2c">A 模型评审</text>
      <text x="30" y="196" font-family="ui-monospace, monospace" font-size="9.6" fill="#9b2c2c">分数漂亮、内部高度一致</text>
      <text x="30" y="214" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">但它只证明了「A 与自己一致」</text>
      <text x="30" y="234" font-family="ui-monospace, monospace" font-size="9.6" fill="#9b2c2c">换一批用户偏好后突然失灵</text>
      <rect x="344" y="54" width="300" height="212" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="358" y="76" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#2f6157">可信：异源评审 + 人工校准</text>
      <rect x="378" y="88" width="232" height="30" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <text x="494" y="108" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#2f6157">A 模型生成洞察</text>
      <line x1="494" y1="118" x2="494" y2="132" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar1)"/>
      <rect x="378" y="134" width="232" height="30" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <text x="494" y="154" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#2f6157">B 模型（不同家族）评审</text>
      <line x1="494" y1="164" x2="494" y2="178" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar1)"/>
      <rect x="378" y="180" width="232" height="30" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <text x="494" y="200" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#2f6157">人工抽检校准（同向率 ≥ 75%）</text>
      <text x="358" y="234" font-family="ui-monospace, monospace" font-size="9.6" fill="#2f6157">分数会低一些，但可迁移</text>
      <text x="358" y="252" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">换用户、换模型都还站得住</text>
      <rect x="16" y="278" width="628" height="64" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="30" y="300" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">判据：生成模型与评审模型必须不同源</text>
      <text x="30" y="320" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">每轮评测抽 30-50 条人工打分，人工与机器同向率低于 75% 时，机器分数不得用于决策。</text>
      <text x="30" y="336" font-family="ui-monospace, monospace" font-size="9.6" fill="#9b2c2c">机器打分是用来降低人工成本的，不是用来替代人的判断的。</text>
    </svg>
  </div>
  <figcaption><b>图 3</b>　同源生成-评审会形成自证闭环：分数漂亮且内部一致，但它只证明了「模型与自己一致」。<b>把评审者换成另一个模型家族、再加人工抽检，分数会下降，换来的却是可迁移性。</b></figcaption>
</figure>

## 四、常见误区与追问

### 4.1 误区：四维分别打分之后，取平均就是总评（其实平均会掩盖短板）

错在哪：把四个维度当成可以互相补偿的项。为什么自然：平均是最省事的合成方式，还显得「全面、客观」。正确做法：洞察的价值结构不可补偿——一份方向对、证据足、表达清楚，但没说「该做什么」的分析，业务方拿到手里等于零。判据：先看有没有哪一维低于 2 分，有就直接判不合格，平均分根本不参与合成；剩下的才按权重算（方向相关性 0.35）。数字：4/4/1/4 与 3/3/3/3 的平均分都在 3.0 上下，但前者实质不可交付。这条规则叫 [[veto-rule|一票否决]]，它不是保险栓，而是对「洞察的价值来自可行动」这件事的直接编码。

### 4.2 误区：Rubric 写得越细，机器打分就越准（其实偏差来自模型，不来自标准）

错在哪：把「评分不准」全部归因于评分标准写得不清楚。为什么自然：rubric 是唯一能直接改的东西，改起来最有掌控感，于是每次分数不对就去抠措辞。正确做法：先量偏差，再改标准。位置偏差用交换顺序测——同一对输出跑两次，结论翻转的比例就是它的强度；长度偏差用「长度 × 得分」的相关系数测，明显为正说明模型在给长答案加分；自我偏好用换模型家族重跑来测，分数系统性下降即说明同源偏好存在。判据：这三项都测过且量级可接受，再去抠 rubric 的措辞；否则你只是在给一把有偏的尺子刻更细的刻度。

### 4.3 误区：两两对比比绝对打分更可靠，所以不用交换顺序

错在哪：以为「A 与 B 谁更好」这种相对判断天然免疫位置效应。为什么自然：相对判断确实比绝对打分稳定，这条共识容易被顺推成「不需要额外保护」。正确做法：两两对比恰恰是位置偏差最严重的地方——它只给模型两个选项，「先看到谁」的影响被放大。判据：同一对输出按 A-B 与 B-A 各跑一次，两次结论一致才采信，不一致记平局；不要取平均，也不要挑其中一次用。数字：在两个能力接近的输出上，顺序翻转率常常达到两成以上——每五对里就有一对的胜负是顺序决定的。

### 4.4 误区：生成模型换成更强的，就不用再花力气做评审校准了

错在哪：把「生成质量」和「评审可信度」揉成一件事。为什么自然：更强的模型写出来的分析确实更好，看起来问题已经被解决了。正确做法：生成能力与评审能力是两件事，而且同源生成-评审会形成自证——分数漂亮且内部高度一致，但它只证明了「A 与 A 自己一致」，换一批用户偏好就会失灵。判据：评审模型与生成模型必须不同源；每轮评测抽 30-50 条人工打分，人工与机器同向率低于 75% 时，机器分数不得用于决策。

### 4.5 误区：稳定性检查跑两遍、分数差不多就够了

错在哪：只看了两次分数的差值，没看分差的分布。为什么自然：跑两次取均值，看起来已经处理了随机性。正确做法：真正要盯的是「分差大的样本占比」，而不是你随手抽出来对比的那一两条。判据：同一份输出重复打分，加权分差超过 0.8 的样本占比应低于 10%；超过就说明 rubric 描述不清，要去修标准，而不是怪模型不稳。做法：对不可靠的样本取中位数而非均值，并把它们转人工——把「模型自己都分不清」的样本留在自动决策里，等于把噪声当信号。

## 五、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>第 1、3 题为高频追问</span></div>
  <div class="q-item" data-qid="eval04-q1" data-answer="2">
    <div class="q-text"><span class="idx">Q1</span>为什么洞察型评分不应简单取四个维度的平均分？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>因为平均分计算复杂</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>因为四个维度的取值范围不同</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>因为平均分掩盖短板：4/4/1/4 与 3/3/3/3 平均分接近，但前者因可操作性过低而实质无用，必须用一票否决规则</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>因为平均分无法体现表达清晰度的重要性</span></button>
    <div class="explain"><b>C。</b>平均分的本质缺陷是<b>允许维度之间互相补偿</b>。但洞察的价值结构不是可补偿的——一份方向对、证据足、但完全没说「该做什么」的分析，业务方拿到手里毫无用处。所以合成规则要包含一票否决与权重差异，而不是简单加总。</div>
  </div>
  <div class="q-item" data-qid="eval04-q2" data-answer="1">
    <div class="q-text"><span class="idx">Q2</span>「长度偏差」指的是什么，怎么缓解？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>输入太长导致评审模型看不到重点；缓解方式是分块评审</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>评审模型给更长、更啰嗦的输出打更高分；缓解方式是在 Rubric 里明确「简洁且信息密度高得高分」，并统计长度与得分的相关性</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>输出过长导致 token 消耗增加；缓解方式是限制输出长度</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>评分结果受上下文长度影响；缓解方式是缩短评分提示词</span></button>
    <div class="explain"><b>B。</b>长度偏差是最普遍、最难察觉的一类——因为它与「详尽」在训练语料里高度相关，模型学到了这个隐含关联。<b>缓解的关键是显式反向声明 + 量化监控</b>：不仅要在 Rubric 里写明，还要实际统计「长度 vs 得分」的相关系数，确认没有正相关。</div>
  </div>
  <div class="q-item" data-qid="eval04-q3" data-answer="3">
    <div class="q-text"><span class="idx">Q3</span>两两对比（A vs B）时，为什么必须交换顺序各跑一次？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>为了增加样本量，提高统计显著性</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>为了减少 token 消耗</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>为了测试评审模型是否稳定</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>因为评审模型存在位置偏差，偏向先出现的那一个；交换后结论一致才可采信，不一致应判平局</span></button>
    <div class="explain"><b>D。</b>位置偏差是 LLM-as-Judge 最稳定的偏差之一——即使内容完全相同，只交换顺序，结论也可能翻转。<b>处理方式不是「校正偏移量」，而是「用一致性做过滤」</b>：两次一致才采信，不一致就判平局。这也顺便解决了一部分「模型本身分不清优劣」的问题。</div>
  </div>
</div>

## 六、小结

| 议题 | 结论 |
| --- | --- |
| 维度拆分 | 方向相关性 / 证据充分性 / 可操作性 / 表达清晰度，四维正交 |
| 打分标准 | 每维给出 5 / 3 / 1 分的具体描述，标准要能回答「是/否」 |
| 合成规则 | 权重差异（方向相关性最高）+ 一票否决（可操作性过低直接不合格） |
| 四类偏差 | 位置 / 长度 / 自我偏好 / 格式偏好，各有对应的缓解手段 |
| 可信度校准 | 一致性检查、与人工对齐、反例注入三步 |
| 一票否决示例 | 可操作性 &lt; 2 分 → 不合格，不管其他维度多高 |
| 必须避免 | 生成模型与评审模型同源（循环论证） |

<p class="pull-quote">机器打分是用来降低人工成本的，不是用来替代人的判断的。这两件事在长期看差别巨大。<cite>本刊编辑部</cite></p>

下一章把前面所有测评工作接成闭环：怎么让评测真正影响线上质量，而不是变成一份没人看的报告。

## 七、参考与延伸

洞察型评测没有「跑一遍就知道对错」的捷径，下面是几条能真正提高判断质量的材料。

**先看图（建立直觉）**

- [Hamel Husain 的博客](https://hamel.dev/) —— 长期写 LLM 评测方法，其中「评测者与被评者的角色要分清」「评分标准要能被第二个人复现」这两条，正对应本章的四维拆分与三步校准。<strong>如果你只想读一篇，读他讲 rubric 设计边界的那几篇。</strong>

**再看代码（动手实现）**

- [Anthropic Engineering](https://www.anthropic.com/engineering) —— 官方工程博客，评审类提示词（让模型输出结构化评分与理由）的写法在这里有第一手示范。<strong>对照本章第三节的 RUBRIC 模板，能看出生产版在约束输出格式上多做了哪些事。</strong>

**最后读论文（对齐一手定义）**

- [Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena（arXiv:2306.05685）](https://arxiv.org/abs/2306.05685) —— 位置偏差、长度偏差、自我偏好这三类偏差的命名与量化出处。<strong>读完你会知道「交换顺序跑两次」不是经验技巧，而是有实验数据支撑的标准做法。</strong>
- [Eugene Yan 的博客](https://eugeneyan.com/) —— 从 LLMOps 视角讲离线评审怎么与人工校准配合，以及「机器评审的分数什么时候不能用来做决策」。<strong>本章三步校准里的同向率阈值，读他的实践总结会更有底气。</strong>
