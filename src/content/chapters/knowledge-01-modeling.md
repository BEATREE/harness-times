---
chapter: knowledge-01-modeling
lead: '把业务知识塞进向量库就完事了？不是。检索找不到、找到了不敢信、信了发现过时——这三个问题的根因都相同：知识没有被建模。这一章讲清实体、事实、推断这三层为什么必须分开，混在一起会出什么事。'
note: '本章的「三层知识结构」是知识引擎部分的地基，后面三章（RAG、Embedding、混合检索）都建立在它之上。'
---

<p class="dropcap">先看一个典型的知识库事故：用户问「上个季度华东区的转化率是多少」。检索命中了一段文档，内容是「华东区转化率偏低，建议关注」。模型据此回答「华东区转化率偏低」。</p>

问题出在哪？文档里那句话是<b>半年前的某个人的判断</b>，不是数据。而在向量库里，它和一条真实的季度数据看起来没有任何区别——都是「一段和华东区、转化率相关的文本」。</p>

## 一、三层知识：为什么必须分

<div class="tbl-wrap">
  <table class="news">
    <caption>知识的三个层次：各自的来源、特征与用途</caption>
    <thead><tr><th>层</th><th>定义</th><th>来源</th><th>可验证性</th><th>用途</th></tr></thead>
    <tbody>
      <tr>
        <td><b>实体层</b><br>Entity</td>
        <td>可锚定的对象：人、部门、项目、指标、系统、文档</td>
        <td>主数据、组织架构、元数据</td>
        <td>高（有唯一标识）</td>
        <td>解决「说的是同一个东西吗」——如「华东」和「华东区」是不是一个地区</td>
      </tr>
      <tr>
        <td><b>事实层</b><br>Fact</td>
        <td>可溯源的关系与数值：谁在什么时候是什么、某指标某期等于多少</td>
        <td>数据库、系统记录、正式文档</td>
        <td><b>最高</b>（能回溯到源系统）</td>
        <td>回答「是什么」——这是唯一可以直接作为结论依据的层</td>
      </tr>
      <tr>
        <td><b>推断层</b><br>Inference</td>
        <td>带依据链的衍生结论：分析、建议、判断、预测</td>
        <td>人的分析、模型的生成</td>
        <td>低（依赖依据链是否成立）</td>
        <td>提供视角与方向——但<b>必须带依据链，且不能当作事实</b></td>
      </tr>
    </tbody>
  </table>
</div>

**三层混在一起的后果**，就是开头那个例子：半年前的「判断」被当成了[[fact-layer|事实]]，而模型无从分辨——因为它们在库里长得一模一样。更隐蔽的是：一段[[inference-layer|推断]]如果没带[[evidence-chain|依据链]]，和一条事实在库里也毫无区别，却可能被当成结论直接给出。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 430" role="img" aria-label="知识三层结构、依据链与冲突消解">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">三层知识结构与依据链</text>
      <!-- 推断层 -->
      <rect x="16" y="36" width="628" height="86" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.4"/>
      <text x="30" y="56" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">③ 推断层　带依据链的衍生结论</text>
      <text x="30" y="76" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">「Q3 华东转化率下滑主要因为新客占比上升」</text>
      <text x="30" y="94" font-family="ui-monospace, monospace" font-size="9.2" fill="#8a6a1e">依据链：fact#1024（Q3 新客占比 42%）+ fact#1025（新客转化率 1.1% vs 老客 4.3%）</text>
      <text x="30" y="112" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">规则：没有依据链的推断不允许入库；带推断标记展示，用户可见其证据</text>
      <line x1="330" y1="122" x2="330" y2="140" stroke="#b8944b" stroke-width="1.4" marker-end="url(#arK)"/>
      <defs>
        <marker id="arK" markerWidth="9" markerHeight="9" refX="4" refY="1" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#b8944b"/>
        </marker>
      </defs>
      <!-- 事实层 -->
      <rect x="16" y="142" width="628" height="104" fill="#eef4f1" stroke="#2f6157" stroke-width="1.4"/>
      <text x="30" y="162" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#2f6157">② 事实层　可溯源的关系与数值（唯一可直接作为依据的层）</text>
      <text x="30" y="182" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">fact#1024　指标=新客占比　维度=华东　期=2025Q3　值=42%</text>
      <text x="30" y="198" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">　　　来源：bi.sales.daily_agg　口径版本：v3　更新时间：2025-10-08</text>
      <text x="30" y="216" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">fact#1025　指标=转化率　维度=华东·新客　期=2025Q3　值=1.1%</text>
      <text x="30" y="232" font-family="ui-monospace, monospace" font-size="9.2" fill="#2f6157">规则：每条事实必须带「来源 + 口径版本 + 更新时间」，三者缺一不可</text>
      <line x1="330" y1="246" x2="330" y2="264" stroke="#2f6157" stroke-width="1.4" marker-end="url(#arKg)"/>
      <defs>
        <marker id="arKg" markerWidth="9" markerHeight="9" refX="4" refY="1" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#2f6157"/>
        </marker>
      </defs>
      <!-- 实体层 -->
      <rect x="16" y="266" width="628" height="74" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.4"/>
      <text x="30" y="286" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#1f1b16">① 实体层　可锚定的对象与它们的同一性</text>
      <text x="30" y="306" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">ent:region/east　别名：华东、华东区、East China、东区　上级：ent:region/china</text>
      <text x="30" y="324" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">ent:metric/conversion_rate　别名：转化率、CVR、成交转化率　口径表：v3（2025-09 变更）</text>
      <text x="30" y="338" font-family="ui-monospace, monospace" font-size="9.2" fill="#1f1b16">作用：把用户的说法映射到系统里的唯一对象——这是检索准确的第一步</text>
      <!-- 冲突消解 -->
      <rect x="16" y="352" width="628" height="62" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="30" y="372" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#9b2c2c">冲突消解：不同层产生分歧时，信谁</text>
      <text x="30" y="390" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">事实 vs 推断冲突 → <tspan font-weight="700">信事实</tspan>，并把推断标记为「与最新事实不符，可能已过时」</text>
      <text x="30" y="407" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">新事实 vs 旧事实冲突 → 信新的，但旧事实保留并标记失效时间（可回溯口径变更历史）</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　三层结构自下而上支撑：实体提供「同一性」、事实提供「可溯源依据」、推断提供「视角与方向」。<b>关键规则有两条</b>：事实必须带来源 + 口径版本 + 更新时间；推断必须有依据链、必须带标记、且在与事实冲突时让步。</figcaption>
</figure>

## 二、实体层：解决「说的是同一个东西吗」

[[entity-layer|实体层]]这一层最容易被跳过，但它是检索准确率的第一道关。三个具体的必要性：

**第一，别名归一。** 用户说「华东」「东区」「East China」，系统里只有 `east`。不做[[alias-normalization|归一]]，检索会漏掉大部分相关内容。

**第二，歧义消解。** 「转化率」在不同业务线可能指不同指标。[[disambiguation|歧义消解]]要能根据上下文确定具体指向哪一个——这正是办事型 Agent 里[[nl2dsl]]的核心难点之一。

**第三，层级关系。** 实体层本质是[[master-data|主数据]]（组织架构、元数据等权威基础数据）。「华东区的销售额」是否包含「华东区下各城市的销售额」？这依赖实体层的层级定义。没有这层关系，聚合查询会算错。

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>实体类型</th><th>必须维护的字段</th><th>常见坑</th></tr></thead>
    <tbody>
      <tr><td>地区</td><td>id、标准名、别名列表、上级、层级深度</td><td>别名不全导致检索漏召回；层级不清导致聚合范围错</td></tr>
      <tr><td>指标</td><td>id、标准名、别名、口径定义、口径版本、生效时间</td><td><b>口径变更无记录</b>——这是数据类争议的主要来源</td></tr>
      <tr><td>部门/人</td><td>id、名称、别名、所属、有效期</td><td>组织架构调整后旧关系失效但未标记，导致引用错误</td></tr>
      <tr><td>项目/系统</td><td>id、名称、别名、负责人、状态</td><td>同名不同项目（如多个「增长」项目）未区分</td></tr>
    </tbody>
  </table>
</div>

## 三、事实层：口径版本是灵魂

事实层的设计里，最重要的不是「存了什么值」，而是**每个值都带着它被定义时的口径版本**。

同一个「转化率」，2025 年 9 月前后可能是两个不同的计算方式（比如是否包含退款订单）。如果系统不记录口径版本，就会出现这种情况：

- 用户看到 2025Q2 转化率 4.2%、2025Q4 转化率 3.1%，得出「下滑明显」的结论；
- 实际上 Q4 换了更严格的口径（剔除退款），两个数字不可比。

**这不是检索问题，是建模问题。** 而它造成的后果比检索错更严重——用户会基于错误的对比做出决策。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 380" role="img" aria-label="同一个指标在两个口径版本下的数值不可直接比较">
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">同一个「转化率」，两个不可比的口径</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">两个数值都真实、都出自同一张表，但分母定义不同 → 放在一起比就是错的</text>
      <rect x="16" y="56" width="290" height="126" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="28" y="76" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#2f6157">口径 v2 · 含退款订单</text>
      <text x="28" y="94" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">生效 2025-03 ~ 2025-08</text>
      <text x="28" y="110" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">下单数 ÷ 访问数，不剔退款</text>
      <text x="28" y="142" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">2025Q2 =</text>
      <text x="108" y="144" font-family="Georgia, serif" font-size="18" font-weight="700" fill="#2f6157">4.2%</text>
      <text x="28" y="170" font-family="ui-monospace, monospace" font-size="9.6" fill="#2f6157">在库里，它与右边的数字长得一模一样</text>
      <rect x="354" y="56" width="290" height="126" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="366" y="76" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#2f6157">口径 v3 · 剔除退款</text>
      <text x="366" y="94" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">生效 2025-09 起</text>
      <text x="366" y="110" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">剔退款后成交数 ÷ 访问数</text>
      <text x="366" y="142" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">2025Q4 =</text>
      <text x="446" y="144" font-family="Georgia, serif" font-size="18" font-weight="700" fill="#2f6157">3.1%</text>
      <text x="366" y="170" font-family="ui-monospace, monospace" font-size="9.6" fill="#2f6157">口径变更这件事只写在元数据里</text>
      <line x1="330" y1="50" x2="330" y2="188" stroke="#9b2c2c" stroke-width="1.2" stroke-dasharray="3 2"/>
      <text x="330" y="208" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#9b2c2c">2025-09 口径变更：分母改为「剔除退款订单」——这一点之后，两条曲线的含义不同了</text>
      <rect x="16" y="222" width="628" height="68" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1.2"/>
      <text x="30" y="242" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#9b2c2c">✗ 界面上看到的：4.2% → 3.1%，一年「下滑 26%」</text>
      <text x="30" y="260" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">两个数的分母不同：一个含退款、一个剔退款。数字都是真的，对比是假的。</text>
      <text x="30" y="278" font-family="ui-monospace, monospace" font-size="9.6" fill="#9b2c2c">系统不会报错也不会提示——用户据此排期、复盘、写进汇报，错误一路向下游传播。</text>
      <rect x="16" y="298" width="628" height="70" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="30" y="318" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">✓ 让「可比性」变成数据可判定的属性</text>
      <text x="30" y="336" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">每条数值事实都带「来源 + 口径版本 + 更新时间」；口径版本不同的两个值禁止直接比较。</text>
      <text x="30" y="354" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">必须跨口径看趋势时：按旧口径重算一版，或在界面上标出断点并写明「口径变更，不可比」。</text>
    </svg>
  </div>
  <figcaption><b>图 2</b>　口径版本不同的两个数值，在数据层看起来完全一样，在业务上却是两个指标。<b>把口径版本写进每一条事实，等于把「这两个数能不能比」从一个需要人判断的问题，变成一个代码能判定的问题。</b></figcaption>
</figure>

```python title="knowledge_model.py"
from dataclasses import dataclass, field
from typing import Literal
from datetime import date
@dataclass
class Entity:
    """实体层：解决「说的是同一个东西吗」"""
    id: str
    canonical: str                       # 标准名
    aliases: list[str] = field(default_factory=list)
    kind: Literal["region", "metric", "org", "project", "system"] = "region"
    parent: str | None = None            # 上级实体，用于层级聚合
    attrs: dict = field(default_factory=dict)
    def match(self, mention: str) -> bool:
        m = mention.strip().lower()
        return m == self.canonical.lower() or any(m == a.lower() for a in self.aliases)
@dataclass
class Fact:
    """
    事实层：可溯源的关系与数值。
    三个字段缺一不可 —— 缺来源则不可信，缺口径版本则不可比，缺时间则不知时效。
    """
    id: str
    subject: str                         # 实体 id
    predicate: str                       # 关系/指标名：指标=转化率
    value: str                           # 值
    period: str                          # 期：2025Q3
    source: str                          # 来源系统：bi.sales.daily_agg
    caliber_version: str                 # 口径版本：v3  ← 最容易被漏掉的一个
    updated_at: str                      # 更新时间
    dims: dict = field(default_factory=dict)   # 附加维度：{"客群": "新客"}
    def comparable_with(self, other: "Fact") -> bool:
        """两个事实能不能直接比较：同指标、同口径版本、同维度才可比"""
        return (self.predicate == other.predicate
                and self.caliber_version == other.caliber_version
                and self.dims == other.dims)
    def render(self) -> str:
        dims = "·".join(f"{k}={v}" for k, v in self.dims.items())
        return (f"{self.subject} {self.predicate} {self.value}"
                f"（{self.period}{'·' + dims if dims else ''}）"
                f"　[来源 {self.source}｜口径 {self.caliber_version}｜更新 {self.updated_at}]")
@dataclass
class Inference:
    """推断层：必须带依据链，且永远不能替代事实"""
    id: str
    conclusion: str
    based_on: list[str]                  # 依据：事实 id 列表 —— 没有它就不允许存在
    producer: str                        # 谁产出的：人 / 模型 + 版本
    produced_at: str
    confidence: float = 0.7
    def is_valid(self) -> bool:
        return len(self.based_on) > 0 and 0.0 <= self.confidence <= 1.0
    def render(self) -> str:
        return (f"[推断·{self.confidence:.1f}] {self.conclusion}\n"
                f"  依据：{', '.join(self.based_on) or '（缺失，不应展示）'}\n"
                f"  产出：{self.producer}　{self.produced_at}")
def resolve_conflict(a: Fact, b: Fact) -> tuple[Fact | None, str]:
    """
    两层之间的冲突消解原则。
    返回 (应采用的事实, 说明)。选择 None 表示无法裁决，应暴露冲突。
    """
    if a.predicate != b.predicate:
        return None, "两个事实不是同一指标，不可比较，不应裁决"
    # 口径版本不同 → 不可比，必须显式暴露
    if a.caliber_version != b.caliber_version:
        return None, (f"口径版本不同（{a.caliber_version} vs {b.caliber_version}），"
                      f"数值不可直接比较。请确认应使用哪个口径。")
    # 口径相同、期相同、值不同 → 数据源冲突
    if a.period == b.period and a.value != b.value:
        return None, (f"同期同口径出现两个值（{a.value} vs {b.value}），"
                      f"来源分别为 {a.source} / {b.source}，需要人工确认以哪个为准。")
    # 期不同 → 取更新的
    newer, older = (a, b) if a.updated_at > b.updated_at else (b, a)
    return newer, f"取更新的一条（{newer.updated_at} > {older.updated_at}），旧值保留为历史"
def render_for_prompt(facts: list[Fact], inferences: list[Inference],
                      budget_chars: int = 5000) -> str:
    """
    回喂给模型的形态：事实在前、推断在后，推断必须带依据，
    并且整体带「来源/口径/更新」标签 —— 让模型自己判断该信谁。
    """
    blocks = []
    for f in facts:
        blocks.append(f"[事实] {f.render()}")
    for i in inferences:
        if i.is_valid():                 # 无效推断（无依据链）直接不展示
            blocks.append(f"{i.render()}")
    text, used = [], 0
    for b in blocks:
        if used + len(b) > budget_chars:
            break
        text.append(b)
        used += len(b)
    head = ("以下为可核验材料。【事实】可直接作为结论依据；"
            "【推断】仅代表某一时期的分析观点，需判断其依据是否仍然成立。\n\n")
    return head + "\n\n".join(text)
```



<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 408" role="img" aria-label="两条知识冲突时的五步裁决顺序">
      <defs>
        <marker id="arC" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#6b6257"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">两条知识冲突时，按这五个判据依次裁决</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">顺序不能颠倒：先判层次，再判可比性，最后才比时间——跳过前两步直接比时间，是最常见的错</text>
      <rect x="16" y="52" width="628" height="30" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.3"/>
      <text x="330" y="72" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="#1f1b16">入口：同一个问题下，检索回了两条互相矛盾的结论</text>
      <rect x="16" y="94" width="246" height="48" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="28" y="111" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#b8944b">① 层次不同</text>
      <text x="28" y="129" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">事实 vs 推断</text>
      <line x1="264" y1="118" x2="296" y2="118" stroke="#b8944b" stroke-width="1.2" marker-end="url(#arC)"/>
      <rect x="300" y="94" width="344" height="48" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="312" y="111" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#b8944b">信事实，推断让步</text>
      <text x="312" y="127" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">推断标记为「与最新事实不符，可能已过时」，</text>
      <text x="312" y="139" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">仍可展示，但必须标明它只是视角，不是依据</text>
      <rect x="16" y="148" width="246" height="48" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="28" y="165" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#1f1b16">② 层内 · 指标不同</text>
      <text x="28" y="183" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">如转化率 vs 留存率</text>
      <line x1="264" y1="172" x2="296" y2="172" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#arC)"/>
      <rect x="300" y="148" width="344" height="48" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="312" y="165" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#1f1b16">不可比 → 不裁决</text>
      <text x="312" y="181" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">两个数值分开呈现，都不作为结论依据，</text>
      <text x="312" y="193" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">更不要用相似度或时间戳强行选一个</text>
      <rect x="16" y="202" width="246" height="48" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1.2"/>
      <text x="28" y="219" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#9b2c2c">③ 层内 · 口径版本不同</text>
      <text x="28" y="237" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">v2 含退款 vs v3 剔退款</text>
      <line x1="264" y1="226" x2="296" y2="226" stroke="#9b2c2c" stroke-width="1.2" marker-end="url(#arC)"/>
      <rect x="300" y="202" width="344" height="48" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1.2"/>
      <text x="312" y="219" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#9b2c2c">不可比 → 暴露冲突</text>
      <text x="312" y="235" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">提示「口径不同，数值不可直接比较」，</text>
      <text x="312" y="247" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">请用户确认该按哪个口径回答</text>
      <rect x="16" y="256" width="246" height="48" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1.2"/>
      <text x="28" y="273" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#9b2c2c">④ 层内 · 同期同口径</text>
      <text x="28" y="291" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">期相同、值不同</text>
      <line x1="264" y1="280" x2="296" y2="280" stroke="#9b2c2c" stroke-width="1.2" marker-end="url(#arC)"/>
      <rect x="300" y="256" width="344" height="48" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1.2"/>
      <text x="312" y="273" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#9b2c2c">数据源冲突 → 交给人</text>
      <text x="312" y="289" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">两个来源各写各的，系统不静默选边，</text>
      <text x="312" y="301" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">把两条的来源与更新时间一起给用户</text>
      <rect x="16" y="310" width="246" height="48" fill="#d6e5de" stroke="#2f6157" stroke-width="1.2"/>
      <text x="28" y="327" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#2f6157">⑤ 层内 · 期不同</text>
      <text x="28" y="345" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">如 Q2 vs Q4</text>
      <line x1="264" y1="334" x2="296" y2="334" stroke="#2f6157" stroke-width="1.2" marker-end="url(#arC)"/>
      <rect x="300" y="310" width="344" height="48" fill="#d6e5de" stroke="#2f6157" stroke-width="1.2"/>
      <text x="312" y="327" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#2f6157">取更新的，旧值留档</text>
      <text x="312" y="343" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">取 updated_at 更大的那条作为当前值，</text>
      <text x="312" y="355" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">旧值软删除并记失效时间，保留可解释性</text>
      <rect x="16" y="368" width="628" height="32" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="28" y="383" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#8a6a1e">能被自动裁决的只有一部分：①②③④里有两类必须交给人。</text>
      <text x="28" y="396" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">所以「同级冲突不能裁决时必须暴露冲突」不是保守，而是唯一不会让错误静默通过的选法。</text>
    </svg>
  </div>
  <figcaption><b>图 3</b>　裁决顺序本身就是一层信息：<b>先问「是不是同一层」，再问「是不是同一个指标、同一个口径」，只有这两步都过了，才轮到比时间。</b>把顺序写死成代码（见上一节的 <code>resolve_conflict</code>），就不会因为「新的看起来更可信」而误判。</figcaption>
</figure>

## 四、推断层：结论必须带着它的依据

实体层讲「同一性」、事实层讲「可溯源」，但真正最容易出错的是[[inference-layer|推断层]]——因为它长得最像「有用的答案」，却最不可信。这一节把它单独讲透。

**推断是什么**：从事实出发、经过推理得到的衍生结论——「华东转化率下滑，主要因为新客占比上升」就是一条推断，它本身不是一个可直接查询的数值，而是对几个事实的**解释**。

**它和事实的本质区别只有一条**：事实可以直接作为结论依据（因为它可回溯到源系统），推断**必须带着依据链**，且永远不能替代事实。这条区别决定了推断层的三条硬规则：

1. **没有依据链的推断不允许入库。** 一条裸结论（「华东转化率偏低，建议关注」）没有任何可验证的锚点，和事实放在一起，模型无从分辨它到底是数据还是某人的判断——这正是开头那个事故的根因。[[evidence-chain|依据链]]就是把结论钉回它来自哪些事实的那根绳子。
2. **推断必须带「产出者」和「产出时间」。** 依据链只能说明「它从这些事实推出来」，不能说明「这推理现在还成立」。一个 Q3 的分析结论，到了 Q4 可能已经过时；一个模型生成的推断和一个资深分析师写的推断，可信度也完全不同。所以推断要记 `producer`（人/模型 + 版本）和 `produced_at`。
3. **依据链成立 ≠ 结论可信。** 依据链只证明「推理有出处」，不证明「推理本身正确」——前提可能选错了、可能遗漏了关键因素。所以推断即使带全了依据，也只能作为**视角**呈现，不能作为**结论**呈现。

<div class="tbl-wrap">
  <table class="news">
    <caption>一条合格推断必须携带的字段</caption>
    <thead><tr><th>字段</th><th>作用</th><th>缺失的后果</th></tr></thead>
    <tbody>
      <tr><td><code>based_on</code>（依据链）</td><td>钉回它来自哪些事实</td><td>变成无法验证的裸结论，与事实无法区分</td></tr>
      <tr><td><code>producer</code>（产出者）</td><td>区分人/模型、及版本</td><td>无法判断可信度等级</td></tr>
      <tr><td><code>produced_at</code>（产出时间）</td><td>判断是否过时</td><td>过期推断被当成现行结论</td></tr>
      <tr><td><code>confidence</code>（置信度）</td><td>给下游一个「可不可信」的量化信号</td><td>下游只能全信或全不信</td></tr>
    </tbody>
  </table>
</div>

**推断层的生命周期比事实短得多，所以要单独管「失效」。** 事实会因口径变更而「不可比」，推断会因**依据失效**而「作废」：某条推断引用了 fact#1024（Q3 新客占比 42%），到了 Q4 这条事实更新了、或者口径变了，那条推断的结论就不再成立。所以推断层要有一个「复核时间」字段，并在每次口径版本变更时，批量扫描所有引用了该指标的推断，标记为「依据已变更，待复核」。没有这一步，系统会长期沉淀一批「看起来有依据」的历史结论——它们比没有依据更危险，因为读者会默认「带了依据就是可信的」。

一句话记住三层的关系：**实体决定「说的是不是同一个东西」，事实决定「这个值能不能信、能不能比」，推断决定「这个结论有没有出处、还新不新」。** 三者各管一段可信度，混在一起就全塌了。

## 五、常见误区与追问

这一章的结论很容易被点头同意，然后在工程里被忘掉。下面五条，都是「听起来对、做起来错」的典型。

### 5.1 误区：把「知识库」当成「文档库 + 向量化」

错在哪：以为把文档切块、嵌入、入库，知识就建好了。为什么自然：几乎所有 RAG 教程都从「切块—嵌入—检索」讲起，看起来那就是全部工作。**但向量库只回答「哪段文字语义相近」，不回答「这条信息是不是事实、值不值得信」。** 判据：随机抽 10 条检索结果，如果你不能在 10 秒内为每条说出「它是事实还是推断 / 来自哪个源系统 / 口径版本是什么」，那么你缺的是建模，不是更好的嵌入模型。一条不带来源的数值和一条带来源的数值，在上下文里长得完全一样，前者的错误要等到用户拿它做决策时才暴露。

### 5.2 误区：口径版本是数据团队的事，与检索和 Agent 无关

错在哪：把它当成数仓内部的元数据约定。为什么自然：口径确实由业务方定义，落库时也常常只写在表注释里。**但对 Agent 来说，口径版本是判断「两个数能不能比」的唯一依据，必须一路带到上下文里。** 判据（可操作）：把两个口径不同的季度值同时放进上下文，看模型会不会主动做对比、甚至算出「下滑 26%」——会，就说明 [[caliber-version|口径版本]] 没有跟着知识块进上下文，或者提示词里没有写「口径不同的数值不可直接比较」这条硬规则。这类错误不需要模型犯错，只需要它足够勤快地做对比。

### 5.3 误区：有依据链，推断就可以当事实用

错在哪：把「可溯源」直接当成「可信」。为什么自然：依据链确实提升了可验证性，看起来比一条裸结论可靠得多。**但它只证明「结论是从这些事实推出来的」，不证明「推理本身成立」。** 判据两条：依据链是否覆盖了全部关键前提；前提是否仍然有效（未过期、未因口径变更而失效）。缺任何一条，这条推断就只能作为视角呈现，不能作为结论依据。这也是 [[provenance|可溯源]] 的边界——它保证你能回到源头，不保证源头支持你的结论。

### 5.4 误区：别名表一次建好就够

错在哪：把别名归一当成一次性数据清洗。为什么自然：别名看起来是静态词典，建表时穷举一遍就完了。**但它会持续增长：新简称、新外文写法、错别字变体、组织改名。** 判据可操作：每周从检索日志里捞出「出现过但没有映射到任何实体 id」的名词提及，做成未命中列表；累计超过 50 条就补一次表。同时给每条别名加「生效期」与「上下级」两个字段——改过的别名不要删除，只标记失效时间，否则历史问题会莫名其妙地对不上实体。

### 5.5 误区：三层分完就一劳永逸

错在哪：以为分好实体、事实、推断，建好表这件事就结束了。为什么自然：结构定下来之后，日常只剩往里写数据。**但三层的边界会被时间侵蚀**：一份 Q3 的分析报告，到 Q4 变成「过时推断」，新口径发布后又变成「口径不同的事实」。判据：给推断层加一个「复核时间」字段，并在每次口径版本变更时扫描所有引用了该指标的推断，批量标记为「依据已变更，待复核」。没有这一步，系统会长期沉淀一批「看起来有依据」的历史结论，而它们比没有依据更危险。

## 六、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>第 1、3 题是核心考点</span></div>
  <div class="q-item" data-qid="knowledge01-q1" data-answer="2">
    <div class="q-text"><span class="idx">Q1</span>为什么知识要分成实体、事实、推断三层？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>为了减少存储空间</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>为了方便按类型检索</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>因为三层的可验证性完全不同：事实可溯源、可直接作为依据；推断依赖依据链、只能作为视角。混在一起就无法分辨一段文本到底是数据还是某人的判断</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>因为三层的数据量不同，需要分层存储加快检索</span></button>
    <div class="explain"><b>C。</b>这是知识建模的核心动机。开头那个案例就是典型：半年前的「判断」被当作「事实」使用。三层的本质区别是<b>可信度与可验证性等级不同</b>，而不是存储方式不同。分开之后，系统才能做到「用事实作结论、用推断提供视角、并且始终标注哪个是哪个」。</div>
  </div>
  <div class="q-item" data-qid="knowledge01-q2" data-answer="1">
    <div class="q-text"><span class="idx">Q2</span>事实层的三个必备字段是什么？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>id、值、创建人</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>来源、口径版本、更新时间</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>数值、单位、精度</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>实体、关系、属性</span></button>
    <div class="explain"><b>B。</b>缺来源则不可信，缺口径版本则不可比，缺更新时间则不知时效。<b>其中「口径版本」最容易被漏掉，而它造成的后果最严重</b>——用户会拿两个不同口径的数字做对比，得出错误结论，而这在界面上看起来完全正常。</div>
  </div>
  <div class="q-item" data-qid="knowledge01-q3" data-answer="3">
    <div class="q-text"><span class="idx">Q3</span>检索到一条事实和一条推断，两者结论相反，应该怎么处理？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>取相似度更高的那条</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>两条都丢掉，避免出错</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>取更新的那条</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>信事实，并把该推断标记为「与最新事实不符，可能已过时」，若有价值则同时呈现但明确标注层级差异</span></button>
    <div class="explain"><b>D。</b>这是三层结构存在的直接价值：<b>当层次不同的两条知识冲突时，层级本身就提供了裁决依据</b>——不需要额外判断。C 看起来合理但会出错：一条刚生成的推断可能比事实「更新」，但可信度低得多。</div>
  </div>
</div>

## 七、小结

| 层 | 必须带什么 | 用途 | 冲突时 |
| --- | --- | --- | --- |
| 实体 | id、标准名、别名、层级 | 解决同一性与歧义 | 提供裁决的上位依据 |
| 事实 | 来源 + **口径版本** + 更新时间 | 唯一可直接作为依据的层 | <b>优先于推断</b> |
| 推断 | 依据链 + 产出者 + 时间 + 置信度 | 提供视角与方向 | 与事实冲突时让步并标注 |

其中三条硬规则：**没有依据链的推断不允许入库**；**口径版本不同的数值不可直接比较**；**同级冲突不能裁决时必须暴露冲突**。

<p class="pull-quote">知识建模的本质，是把「可信度」这个属性从人的判断变成数据结构。做成了，系统才可能「有据可查」。<cite>本刊编辑部</cite></p>

建模清楚了，下一章看检索的完整链路——以及那条链上六个环节各自能怎样把结果做错。

## 八、参考与延伸

这一章的方法论没有单一一手论文可读，所以下面按「先对齐概念、再看工业实现、最后读规范」排了三份材料。全站不做原文转载，这里只登记链接与「为什么值得读」。

**先看概念（把「指标口径」想清楚）**

- [dbt 官方文档 · About MetricFlow](https://docs.getdbt.com/docs/build/about-metricflow) —— 工业界怎么把「指标」定义成可版本化、可复用的声明式对象。<strong>读本章第三节卡住时来这儿最快：它把「同一个指标名 + 不同定义」当成一等公民处理，而不是把它塞进表注释。</strong>

**再看实现（别人把校验放在哪一层）**

- [Eugene Yan · Patterns for Building LLM-based Systems & Products](https://eugeneyan.com/writing/llm-patterns/) —— 从评测、RAG 到 guardrails 的工程模式总览。<strong>重点看「数据校验与输出约束」落在流水线的哪一段——本章的实体／事实／推断分层，正是这类校验的依据来源。</strong>

**最后读规范（对齐一手定义）**

- [W3C · PROV-O: The PROV Ontology](https://www.w3.org/TR/prov-o/) —— 「来源（provenance）」这件事的官方本体定义：Entity、Activity、Agent 三类核心对象及其派生关系。<strong>只需要看核心类与 <code>prov:wasDerivedFrom</code> 这一个关系——本章说的「依据链」，在规范里就是它的传递闭包。</strong>
