---
chapter: knowledge-05-knowledge-update
lead: '知识库建好之后，真正的考验才刚开始：今天对的知识，明天可能就错了。而「过期的正确」比「明显的错误」更危险——因为它看起来仍然可信。这一章讲清知识怎么过期、怎么更新、怎么回滚，以及怎么让「这条还新不新」变成系统能判定的属性。'
note: '本章是知识引擎的最后一站：前面讲怎么建模、怎么检索、怎么保证可信，这一章讲怎么让这些知识在时间上不腐坏。'
---

<p class="dropcap">先看一个真实的事故：一个内部知识 Agent 回答「公司的报销标准」，给的是三年前的旧制度。</p>

答案本身措辞严谨、引用齐全、置信度看起来很高——唯一的错误是：这份制度**已经废止了**。用户照着去报销，被财务驳回。比「答错」更糟的是，用户从此不再信任这个 Agent 的「引用」。

问题不在检索、不在生成，在于**知识会过期，而系统没有把它当成一个必须持续处理的问题**。前面四章讲「知识是什么、怎么取、怎么信」，这一章补上最后一块：**知识在时间轴上怎么不腐坏**。

## 一、知识会以三种方式「变旧」

「过时」不是一个笼统的词，它至少有三种不同的机制，处理方式也完全不同：

<div class="tbl-wrap">
  <table class="news">
    <caption>知识变旧的三种机制</caption>
    <thead><tr><th>机制</th><th>例子</th><th>特征</th><th>处理手段</th></tr></thead>
    <tbody>
      <tr><td><b>事实被取代</b></td><td>负责人从 A 换成 B；报销标准从 v2 改成 v3</td><td>旧值不再成立，但「曾经成立」这件事有历史价值</td><td>新值生效 + 旧值软删除留档（见第 5 章软删除）</td></tr>
      <tr><td><b>事实失效</b></td><td>一个临时活动结束了；一次促销只到月底</td><td>旧值彻底失去意义，无需保留</td><td>TTL 到期自动下线，或标记「已过期」</td></tr>
      <tr><td><b>推断作废</b></td><td>「Q3 下滑因为新客占比上升」——到 Q4 前提变了</td><td>结论依赖的事实已更新，推理不再成立</td><td>依据变更时批量标记「待复核」（见第 1 章推断层）</td></tr>
    </tbody>
  </table>
</div>

关键区别在于：**「事实被取代」要保留历史（可回溯），「事实失效」可以干净地拿掉，「推断作废」要主动扫描依赖关系。** 把三者混为一谈，就会要么把该删的历史留着占地方，要么把该留的证据物理删掉。

这三种「变旧」正好落在知识建模的三层上（见第 1 章）：[[entity-layer|实体层]]和[[fact-layer|事实层]]的知识会被「取代 / 失效」，而[[inference-layer|推断层]]的知识会「作废」。所以时效机制不能只盯着事实，还得沿着依赖关系追到推断——这是这一章和第 1 章的分工：第 1 章定「知识的形状」，这一章定「形状怎么在时间里不塌」。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 400" role="img" aria-label="知识变旧的三种机制与各自的处理手段">
      <defs>
        <marker id="arU" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#2f6157"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">「过时」是三种不同的病，药不一样</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">都叫「旧了」，但「被取代 / 已失效 / 作废」的处理手段完全不同</text>
      <!-- 被取代 -->
      <rect x="16" y="56" width="198" height="120" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="28" y="76" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#2f6157">① 事实被取代</text>
      <text x="28" y="96" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">负责人 A → B；口径 v2 → v3</text>
      <text x="28" y="116" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">「曾成立」有历史价值</text>
      <line x1="28" y1="126" x2="202" y2="126" stroke="#2f6157" stroke-width="0.8"/>
      <text x="28" y="144" font-family="ui-monospace, monospace" font-size="9.2" font-weight="700" fill="#2f6157">新值生效 + 旧值软删除留档</text>
      <text x="28" y="162" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">可回溯「曾经是 A，何时变成 B」</text>
      <!-- 已失效 -->
      <rect x="231" y="56" width="198" height="120" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <text x="243" y="76" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">② 事实失效</text>
      <text x="243" y="96" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">临时活动结束；促销到期</text>
      <text x="243" y="116" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">旧值彻底失去意义</text>
      <line x1="243" y1="126" x2="417" y2="126" stroke="#b8944b" stroke-width="0.8"/>
      <text x="243" y="144" font-family="ui-monospace, monospace" font-size="9.2" font-weight="700" fill="#8a6a1e">TTL 到期下线 / 标记「已过期」</text>
      <text x="243" y="162" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">干净拿掉，不占检索与上下文</text>
      <!-- 推断作废 -->
      <rect x="446" y="56" width="198" height="120" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="458" y="76" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#9b2c2c">③ 推断作废</text>
      <text x="458" y="96" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">结论依赖的事实已更新</text>
      <text x="458" y="116" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">推理不再成立</text>
      <line x1="458" y1="126" x2="632" y2="126" stroke="#9b2c2c" stroke-width="0.8"/>
      <text x="458" y="144" font-family="ui-monospace, monospace" font-size="9.2" font-weight="700" fill="#9b2c2c">依据变更 → 批量标记「待复核」</text>
      <text x="458" y="162" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">主动扫描依赖，而非等它被问到时才慌</text>
      <!-- 底部统一结论 -->
      <rect x="16" y="200" width="628" height="66" fill="#fbf8f2" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="30" y="222" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#1f1b16">判据：先问「这是被取代、失效、还是作废」，再决定留不留</text>
      <text x="30" y="242" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">被取代 → 留历史（软删除）；失效 → 干净下线（TTL）；作废 → 标待复核（扫依赖）。</text>
      <text x="30" y="258" font-family="ui-monospace, monospace" font-size="9.6" fill="#9b2c2c">混为一谈的后果：该删的历史占着地方，该留的证据被物理删除，该复核的推断被当成现行结论。</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　「过时」不是一个动作，是三种病。<b>分清「被取代 / 已失效 / 作废」，才能对每种用对药——这是知识更新设计的第一道分水岭。</b></figcaption>
</figure>

## 二、TTL：给每条知识一个「保质期」

[[ttl|TTL]]（Time To Live，生存时间）是最朴素也最有效的时效机制：给每条知识标一个「到什么时候不再新鲜」。它解决的是「系统不知道这条什么时候该重新确认」的问题。

TTL 不是拍脑袋设一个统一值，而是**按知识的「变质速度」分级**：

<div class="tbl-wrap">
  <table class="news">
    <caption>不同知识类型的 TTL 参考（不是绝对值，是量级）</caption>
    <thead><tr><th>知识类型</th><th>变质速度</th><th>TTL 参考</th><th>过期后动作</th></tr></thead>
    <tbody>
      <tr><td>组织架构、负责人</td><td>慢（季度级）</td><td>30–90 天</td><td>重新拉取主数据确认</td></tr>
      <tr><td>业务指标口径</td><td>中（随制度变更）</td><td>7–30 天</td><td>核对口径版本是否仍生效</td></tr>
      <tr><td>价格、库存、活动</td><td>快（小时/天级）</td><td>1 小时–1 天</td><td>实时查询，不缓存结论</td></tr>
      <tr><td>推断、分析结论</td><td>不确定（依赖依据）</td><td>与依据 TTL 挂钩</td><td>依据失效即作废，见第 1 章</td></tr>
    </tbody>
  </table>
</div>

<div class="box box-key">
  <span class="box-title">TTL 的真正价值不在「自动删除」</span>
  <p>很多人把 TTL 理解成「到期就删」，其实它更重要的价值是<b>让「要不要重新确认」变成一个可触发的信号</b>。一条知识 TTL 到期，不等于立刻删——而是触发一次「重新拉取源数据、比对是否变化」。没变就续期，变了就更新。</p>
  <p>这比「等用户来问才发现错了」主动得多，也比「无脑定期全量刷新」便宜得多。</p>
</div>

## 三、增量更新：别为了改一条把整个库重刷一遍

知识库会持续变化，但「变化」通常是**局部的**——今天只改了 3 个指标口径、换了 1 个负责人。如果每次都用「全量重建」应对，成本会失控，而且重建窗口里服务会退化为旧知识。

[[incremental-update|增量更新]]的核心思想：**只更新变化的那部分，并记录「什么变了、为什么变、从哪个版本变到哪个版本」**。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 360" role="img" aria-label="全量重建与增量更新的成本对比">
      <defs>
        <marker id="arU2" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#2f6157"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">全量重建 vs 增量更新</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">左：一次改 3 条也要把整库重刷；右：只动变化的部分，并留变更记录</text>
      <!-- 全量重建 -->
      <text x="40" y="70" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#9b2c2c">全量重建</text>
      <rect x="40" y="84" width="260" height="20" fill="#f3c9c9" stroke="#9b2c2c" stroke-width="1"/>
      <text x="170" y="98" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#9b2c2c">重建整个索引（哪怕只改了 3 条）</text>
      <rect x="40" y="112" width="260" height="20" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <text x="170" y="126" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#9b2c2c">重建窗口内服务退化为旧知识</text>
      <rect x="40" y="140" width="260" height="20" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <text x="170" y="154" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#9b2c2c">成本随全库规模线性增长，不可持续</text>
      <!-- 增量更新 -->
      <text x="360" y="70" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#2f6157">增量更新</text>
      <rect x="360" y="84" width="260" height="20" fill="#eef4f1" stroke="#2f6157" stroke-width="1"/>
      <text x="490" y="98" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#2f6157">只重算变化的 3 条，其余原地不动</text>
      <rect x="360" y="112" width="260" height="20" fill="#eef4f1" stroke="#2f6157" stroke-width="1"/>
      <text x="490" y="126" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#2f6157">变更日志：什么变了 / 为什么 / 从 v 几到 v 几</text>
      <rect x="360" y="140" width="260" height="20" fill="#eef4f1" stroke="#2f6157" stroke-width="1"/>
      <text x="490" y="154" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#2f6157">成本随「变化量」增长，而非全库规模</text>
      <!-- 箭头：局部 -->
      <line x1="300" y1="220" x2="360" y2="220" stroke="#2f6157" stroke-width="1.2" marker-end="url(#arU2)"/>
      <text x="320" y="212" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#2f6157">只动 3 条</text>
      <!-- 底部 -->
      <rect x="16" y="250" width="628" height="90" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="30" y="272" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">增量更新的三个硬前提</text>
      <text x="30" y="294" font-family="ui-monospace, monospace" font-size="9.8" fill="#6b6257">1. 每条知识有稳定主键，能定位「哪一条变了」——否则无从谈起增量。</text>
      <text x="30" y="312" font-family="ui-monospace, monospace" font-size="9.8" fill="#6b6257">2. 索引支持局部重算（向量库按 id upsert），不是只能整体重建。</text>
      <text x="30" y="330" font-family="ui-monospace, monospace" font-size="9.8" fill="#9b2c2c">3. 变更日志是审计与回滚的基础——没有它，改错了都回不去。</text>
    </svg>
  </div>
  <figcaption><b>图 2</b>　增量更新的收益不是「快」，而是<b>成本随变化量增长、而非随全库规模增长</b>——这是知识库能持续维护下去的前提。它的三个硬前提里，变更日志尤其重要，因为它是回滚的唯一依据。</figcaption>
</figure>

## 四、回滚：改错了要能退回去

知识更新会出错——源数据错了、口径理解错了、自动化批量更新误伤了。这时候「能退回去」比「改得快」更重要。[[rollback|回滚]]依赖的就是上一节的**变更日志**和第一节的[[soft-delete|软删除]]。

```python title="knowledge_versioning.py"
from dataclasses import dataclass, field
from datetime import datetime, timedelta

@dataclass
class KnowledgeVersion:
    version: int
    value: str
    updated_at: str
    updated_by: str
    change_reason: str            # 为什么变：口径变更 / 源修正 / 误操作回滚
    superseded_at: str | None = None

@dataclass
class KnowledgeItem:
    id: str                       # 稳定主键：如 "metric:conversion_rate"
    ttl: timedelta                # 保质期
    versions: list = field(default_factory=list)   # 版本链，最新在末位
    def current(self):
        """当前生效版本 = 版本链里最后一条未 superseded 的（被软删除的自动跳过）"""
        for v in reversed(self.versions):
            if v.superseded_at is None:
                return v
        return None
    def is_fresh(self) -> bool:
        cur = self.current()
        if not cur:
            return False
        expires = datetime.fromisoformat(cur.updated_at) + self.ttl
        return datetime.now() < expires
    def update(self, new_value: str, reason: str, by: str) -> None:
        """新增版本：旧的标记 superseded，而不是物理删除"""
        for v in self.versions:
            if v.superseded_at is None:
                v.superseded_at = datetime.now().isoformat(timespec="seconds")
        self.versions.append(KnowledgeVersion(
            version=len(self.versions) + 1,
            value=new_value,
            updated_at=datetime.now().isoformat(timespec="seconds"),
            updated_by=by, change_reason=reason,
        ))
    def rollback(self) -> bool:
        """回滚 = 把最新（错误）版本软删除，让 current() 指回上一版"""
        if len(self.versions) < 2:
            return False
        bad = self.versions[-1]            # 最新（错误）版本
        bad.superseded_at = datetime.now().isoformat(timespec="seconds")
        # 不移出列表：它仍在版本链里，但已标记 superseded；
        # current() 返回的是「最后一条未 superseded 的版本」，因此自动指回上一版
        return True
```

三个必须同时成立、少一个回滚就是空话的环节：

- **版本链**：每次更新不是覆盖，而是追加一个新版本、把旧的标 `superseded_at`。这样任何时刻都能回答「这条曾经是什么值」。
- **变更日志**：每次变更记下 `why`（为什么变）和 `by`（谁/什么系统改的）。没有 `why` 的回滚，等于把错误改成一个「不知道为什么」的新状态。
- **回滚本身也要留痕**：回滚不是「删掉错误版本」，而是「标记它错误、退回上一版」。这样审计时能看到「曾经改错、又退了回来」的完整轨迹。

<div class="box box-warn">
  <span class="box-title">回滚最容易漏掉的一环：依赖它的下游</span>
  <p>一条事实被回滚，但<strong>引用它的推断不会自动跟着回滚</strong>。比如你把「转化率口径」回滚到 v2，但已经用 v3 口径产出的几条分析结论还躺在推断层里，它们现在引用了一个已经「倒退」的前提。</p>
  <p>所以回滚要和第 1 章的「依据变更 → 批量标记待复核」联动：<b>回滚任何一条事实，都要扫描引用了它的推断，一并标记为待复核</b>，否则下游会继续引用一个已经不成立的前提。</p>
</div>

## 五、新鲜度信号：检索时怎么排序

即使知识更新机制都对了，检索时还要面对一个问题：**召回了两条都「有效」的知识，但一条是昨天刚更新的、一条是半年前的，该怎么排？** 这就需要一个显式的 [[freshness-signal|新鲜度信号]]。

<div class="tbl-wrap">
  <table class="news">
    <caption>三种新鲜度排序策略</caption>
    <thead><tr><th>策略</th><th>做法</th><th>适用</th><th>风险</th></tr></thead>
    <tbody>
      <tr><td>纯时间降序</td><td>越新越靠前</td><td>新闻、行情这类「新就是好」的场景</td><td>误伤「老但权威」的稳定知识（如制度原文）</td></tr>
      <tr><td>时间衰减加权</td><td>相关性分数 × 时间衰减因子</td><td>大多数通用知识库</td><td>衰减系数要调，调不好要么基本无效、要么盖过相关性</td></tr>
      <tr><td>显式新鲜度标签</td><td>检索时把「是否新鲜」作为独立过滤/排序维度</td><td>对时效敏感的业务（价格、库存、口径）</td><td>需要 TTL/更新机制配合，否则标签本身会过期</td></tr>
    </tbody>
  </table>
</div>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 360" role="img" aria-label="新鲜度应作为相关性之内的二次排序，而非替代相关性">
      <defs>
        <marker id="arU3" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#2f6157"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">新鲜度是「相关性之内」的二次排序，不是替代相关性</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">先按相关性召回，再在同相关候选里按新鲜度排——避免「越新越靠前」误伤权威旧知识</text>
      <!-- 阶段 1：相关性召回 -->
      <rect x="16" y="56" width="200" height="120" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="28" y="76" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#2f6157">① 相关性召回</text>
      <text x="28" y="96" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">关键词 + 向量，先挑「相关」</text>
      <text x="28" y="114" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">半年前的制度 / 昨天的口径</text>
      <text x="28" y="132" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">只要相关都进候选，不看新旧</text>
      <text x="28" y="158" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">这一步「宁可宽」</text>
      <!-- 箭头 -->
      <line x1="216" y1="116" x2="252" y2="116" stroke="#2f6157" stroke-width="1.2" marker-end="url(#arU3)"/>
      <!-- 阶段 2：新鲜度二次排序 -->
      <rect x="256" y="56" width="200" height="120" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <text x="268" y="76" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">② 同相关内按新鲜度排</text>
      <text x="268" y="96" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">只对「已相关」的候选排先后</text>
      <text x="268" y="114" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">昨天的口径 &gt; 半年前的旧口径</text>
      <text x="268" y="132" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">但「老却权威」不会被时间挤掉</text>
      <text x="268" y="158" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">这一步「排序要准」</text>
      <!-- 箭头 -->
      <line x1="456" y1="116" x2="492" y2="116" stroke="#2f6157" stroke-width="1.2" marker-end="url(#arU3)"/>
      <!-- 阶段 3：结果 -->
      <rect x="496" y="56" width="148" height="120" fill="#fbf8f2" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="508" y="76" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#1f1b16">③ 输出</text>
      <text x="508" y="96" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">相关 + 新鲜</text>
      <text x="508" y="114" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">两条都要</text>
      <text x="508" y="132" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">缺一样就失真</text>
      <!-- 底部反例 -->
      <rect x="16" y="200" width="628" height="72" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.2"/>
      <text x="30" y="222" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#9b2c2c">反例：「越新越靠前」会怎样</text>
      <text x="30" y="244" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">把新鲜度当唯一排序键，昨天的「小道消息」会压过半年前的「制度原文」。</text>
      <text x="30" y="262" font-family="ui-monospace, monospace" font-size="9.6" fill="#9b2c2c">后果：相关性被新鲜度盖过，权威稳定知识被误伤——这正是纯时间降序的最大风险。</text>
      <!-- 底部结论 -->
      <rect x="16" y="288" width="628" height="54" fill="#fbf8f2" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="30" y="310" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#1f1b16">判据：先问「相关吗」，再在同相关里问「新吗」</text>
      <text x="30" y="330" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">新鲜度是相关性内的 tie-breaker，不是独立的第一排序键。</text>
    </svg>
  </div>
  <figcaption><b>图 3</b>　新鲜度排序的正确姿势是<b>「相关性之内二次排序」</b>：先召回相关候选，再在同相关里按新鲜度排先后。把它当成唯一排序键（越新越靠前）会把权威但略旧的稳定知识误伤——这是时效机制里最容易犯的一个错。</figcaption>
</figure>

关键原则：**新鲜度不能盖过「相关性和可信度」，但也不能被忽略。** 最稳妥的做法是把它做成一个**独立的排序信号**，让它在「相关知识」里再排先后，而不是直接替代相关性排序。这样「半年前那个权威制度」不会被误伤，「昨天刚改的口径」也不会被淹没。

## 六、常见误区与追问

### 6.1 误区：知识库建好就一劳永逸，更新是后期的事

错在哪：把知识更新当成上线后「有空再做」的附加项。为什么自然：建库时所有知识都是新鲜的，看不出问题。正确做法：**时效机制是知识库设计的一部分，不是补丁**。判据：建库时就要给每条知识定 TTL、定更新来源、定回滚方案——否则上线后第一批「过期知识」出现时，你既没有触发更新的机制，也没有退回去的能力，只能手工救火。

### 6.2 误区：TTL 到期就直接删掉

错在哪：把 TTL 理解成「自动删除」。为什么自然：到期删除看起来是干净的自动清理。正确做法：**TTL 到期触发的是「重新确认」，不是「删除」**。判据：到期后重新拉源数据比对——没变就续期，变了才更新，只有「事实彻底失效」这类才真的下线。把「重新确认」和「删除」混为一谈，会导致大量本可续期的知识被误删，或反过来，该删的失效知识一直躺着。

### 6.3 误区：全量重建最省事，增量更新太复杂

错在哪：用「实现简单」掩盖「不可持续」。为什么自然：全量重建确实好写，一次跑完就完事。正确做法：**成本要按「长期」算**。判据：全量重建成本随全库规模线性增长，且重建窗口内服务退化为旧知识；增量更新成本只随变化量增长。知识库一旦超过某个规模，全量重建的窗口期会成为「服务不可用」的定时炸弹。

### 6.4 误区：回滚就是「把值改回去」

错在哪：把回滚当成一次普通的数据修改。为什么自然：改回去看起来就是「再写一次旧值」。正确做法：**回滚要走版本链，且要联动下游**。判据两条：一是回滚后旧版本要能被解释「为什么曾经是这个值、又为什么退回来」；二是引用这条事实的推断要一并标记待复核。只改值不留痕，等于把错误历史抹掉，审计时无从查起。

### 6.5 误区：新鲜度排序就是「越新越靠前」

错在哪：把新鲜度当成唯一排序键。为什么自然：新的看起来更对，直觉成立。正确做法：**新鲜度是相关性之内的二次排序**。判据：先按相关性召回，再在同相关的候选里按新鲜度排。直接「越新越靠前」会把「老但权威」的稳定知识（制度原文、主数据）压下去——而这些恰恰是不能被时间衰减误伤的东西。

## 七、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>第 1 题是核心考点</span></div>
  <div class="q-item" data-qid="knowledge05-q1" data-answer="2">
    <div class="q-text"><span class="idx">Q1</span>一条「负责人从 A 换成 B」的知识，正确更新方式是？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>直接覆盖，把 A 删掉</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>新增 B，但保留 A 与 B 并列，检索时都返回</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>新增 B 作为当前值，把 A 标记 superseded 留档（软删除）</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>给 A 设一个很短的 TTL，等它自动消失</span></button>
    <div class="explain"><b>C。</b>「被取代」的事实有历史价值（能回答「曾经是谁、何时换的」），所以不能物理删除，要软删除留档。A 直接删会丢历史，B 并列会让系统同时返回两个负责人造成冲突，D 用 TTL 处理「被取代」是把两种病混为一谈。</div>
  </div>
  <div class="q-item" data-qid="knowledge05-q2" data-answer="1">
    <div class="q-text"><span class="idx">Q2</span>TTL 到期的正确动作是什么？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>自动删除该条知识</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>触发一次「重新拉源数据比对」，没变就续期，变了才更新</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>把该条知识标记为低置信度</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>什么也不做，等用户来问才发现</span></button>
    <div class="explain"><b>B。</b>TTL 的价值在「让重新确认变成可触发信号」，不是「自动删除」。到期不等于失效，大多数时候知识没变，重新确认后就能续期。A 会把本可续期的知识误删，D 则完全失去 TTL 的意义。</div>
  </div>
  <div class="q-item" data-qid="knowledge05-q3" data-answer="3">
    <div class="q-text"><span class="idx">Q3</span>回滚一条事实后，最容易漏掉的是哪一步？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>把旧值重新写回去</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>记录这次回滚的操作人</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>通知相关用户</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>扫描引用了这条事实的推断，一并标记「待复核」</span></button>
    <div class="explain"><b>D。</b>事实被回滚后，引用它的推断不会自动跟着回滚——那些推断现在引用了一个已经「倒退」的前提。不回滚下游，就会继续产出基于旧前提的结论。A/B/C 都重要，但 D 是最容易被漏掉、后果也最隐蔽的一环。</div>
  </div>
</div>

## 八、小结

| 你要能回答的问题 | 一句话答案 |
| --- | --- |
| 知识怎么变旧 | 三种机制：事实被取代（留历史）、事实失效（下线）、推断作废（标待复核） |
| TTL 是干什么的 | 给知识一个保质期，到期触发「重新确认」而非「删除」 |
| 为什么增量更新 | 成本随变化量而非全库规模增长，且重建窗口不退化服务 |
| 回滚靠什么 | 版本链 + 变更日志 + 软删除，三者缺一回滚就是空话 |
| 新鲜度怎么排 | 作为相关性之内的二次排序，不替代相关性、也不被忽略 |

<p class="pull-quote">知识更新的本质，是把「这条还新不新」从人的记忆变成系统可判定的属性。做成了，知识库才不会在时间轴上悄悄腐坏。<cite>本刊编辑部</cite></p>

这是知识引擎的最后一章。到这里，从「知识怎么建模」到「知识怎么不过期」的完整链条就闭环了。

## 九、参考与延伸

本章的方法论分散在工业实践与规范里，下面按「先看工业实现、再看规范、最后读实践总结」排了三份材料。全站不做原文转载，这里只登记链接与「为什么值得读」。

**先看工业实现（别人怎么做版本化与增量）**

- [dbt 官方文档 · About MetricFlow](https://docs.getdbt.com/docs/build/about-metricflow) —— 指标口径的版本化与增量刷新。<strong>读本章第二节卡住时来这儿：它把「指标定义」当成可版本化、可增量更新的对象，而不是散落的表注释。</strong>

**再看规范（来源与版本的本体定义）**

- [W3C · PROV-O: The PROV Ontology](https://www.w3.org/TR/prov-o/) —— 来源（provenance）与版本（wasRevisionOf）的官方本体。<strong>只需要看 <code>prov:wasRevisionOf</code> 与 <code>prov:invalidatedAtTime</code> 两个关系——本章的「版本链」和「软删除」在规范里就是它们。</strong>

**最后读实践总结（工程模式全景）**

- [Eugene Yan · Patterns for Building LLM-based Systems & Products](https://eugeneyan.com/writing/llm-patterns/) —— 从评测、RAG 到 guardrails 的工程模式总览。<strong>重点看「数据新鲜度与更新」落在流水线的哪一段——本章的 TTL / 增量 / 回滚正是这类模式的具体化。</strong>
