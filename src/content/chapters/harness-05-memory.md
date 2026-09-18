---
chapter: harness-05-memory
lead: '记住什么是能力，忘掉什么才是设计。一个没有遗忘机制的记忆系统，会从资产迅速变成污染源——错误信息被反复召回、过时结论被当成当前事实、用户的一句玩笑被永久固化。这一章讲清一个记忆系统必须回答的六个问题。'
note: '本章的核心判据只有一句话：能被解释、能被更正、能被删除的记忆才是资产。'
---

<p class="dropcap">把记忆理解成「把历史存起来、需要时取出来」是最简单的理解，也是失败率最高的理解。因为记忆系统的真正难点不在「存」，而在四件事：什么时候该写、写的是什么级别的信息、冲突时信谁、以及怎么保证用户能把它删掉。</p>

## 一、先分清三种「记忆」

很多人把 [[working-memory|工作记忆]]、[[episodic-memory|情节记忆]]、[[semantic-memory|语义记忆]] 三件不同的事都叫记忆，导致设计混乱。它们应该分开存、分开管。

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>类型</th><th>内容</th><th>存哪</th><th>存活期</th></tr></thead>
    <tbody>
      <tr><td><b>工作记忆</b></td><td>当前任务的上下文、中间结果、待办</td><td>上下文 + 外部状态文件</td><td>任务结束即释放</td></tr>
      <tr><td><b>情节记忆</b></td><td>发生过什么：任务历史、结论、失败原因</td><td>结构化日志 / 向量库</td><td>按需保留，可归档</td></tr>
      <tr><td><b>语义记忆</b></td><td>长期稳定的事实与偏好：用户是谁、习惯什么口径</td><td>键值或知识表</td><td>长期，但必须可修改可删除</td></tr>
    </tbody>
  </table>
</div>

混淆的代价很具体：如果把「用户这次让我用简洁格式」写进语义记忆，下一次任何任务都会被这个偏好影响；如果把「本次任务的目标」写进语义记忆，三个月后它还会被召回。

## 二、写入时机：三个触发器

写入是记忆系统最容易失控的环节。**最常见的事故是写入过多**——把每一轮对话都写进去，结果记忆库充满噪音，[[memory-recall|召回]]质量急剧下降。真正决定「写不写」的是 [[write-trigger|写入触发器]]：只有显式指令、任务固化、受控自动抽取三类事件才允许落库。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 400" role="img" aria-label="记忆写入的三个触发器与写入前后的校验流程">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">什么时候该写：三个触发器</text>
      <!-- 触发器 1 -->
      <rect x="16" y="38" width="200" height="120" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="30" y="58" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#2f6157">① 显式指令</text>
      <text x="30" y="78" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">用户明确说「记住……」</text>
      <text x="30" y="94" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">「以后都用这个口径」</text>
      <text x="30" y="118" font-family="ui-monospace, monospace" font-size="9.2" fill="#2f6157">可靠性：最高</text>
      <text x="30" y="134" font-family="ui-monospace, monospace" font-size="9.2" fill="#2f6157">频率：低</text>
      <text x="30" y="150" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">策略：写入后回显确认</text>
      <!-- 触发器 2 -->
      <rect x="230" y="38" width="200" height="120" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <text x="244" y="58" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#8a6a1e">② 任务结束固化</text>
      <text x="244" y="78" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">任务完成后固化「结论」而非</text>
      <text x="244" y="94" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">「过程」：目标、结论、依据</text>
      <text x="244" y="118" font-family="ui-monospace, monospace" font-size="9.2" fill="#8a6a1e">可靠性：高</text>
      <text x="244" y="134" font-family="ui-monospace, monospace" font-size="9.2" fill="#8a6a1e">频率：中（每任务一次）</text>
      <text x="244" y="150" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">策略：写成结构化条目</text>
      <!-- 触发器 3 -->
      <rect x="444" y="38" width="200" height="120" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="458" y="58" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#9b2c2c">③ 自动抽取　⚠ 最需谨慎</text>
      <text x="458" y="78" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">每轮自动判断「有无值得记的」</text>
      <text x="458" y="118" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">可靠性：低</text>
      <text x="458" y="134" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">频率：高	→ 噪音主要来源</text>
      <text x="458" y="150" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">策略：必须设阈值 + 定期清理</text>
      <!-- 写入前的四道校验 -->
      <rect x="16" y="176" width="628" height="120" fill="#fbf8f2" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="30" y="196" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#1f1b16">写入前必须过的四道校验（跳过任何一道都会留下长期污染）</text>
      <text x="30" y="218" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">① 稳定性：这条信息一个月后还成立吗？只是一次性偏好 → 不写。</text>
      <text x="30" y="238" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">② 来源可信：是用户在陈述事实，还是模型自己的推断？推断必须标为推断。</text>
      <text x="30" y="258" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">③ 非重复：与已有记忆语义重复 → 更新旧的，而不是新建一条（否则冲突）。</text>
      <text x="30" y="278" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">④ 可归属：必须关联到具体实体（用户 / 项目 / 部门），不能是悬空陈述。</text>
      <!-- 召回侧 -->
      <rect x="16" y="308" width="628" height="80" fill="#eef4f1" stroke="#2f6157" stroke-width="1.2"/>
      <text x="30" y="328" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#2f6157">召回侧：只选必要的那几条</text>
      <text x="30" y="348" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">召回过多的记忆会挤占上下文、并把无关信息变成干扰。上限建议 5 条以内，且必须带「写入时间」。</text>
      <text x="30" y="366" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">带时间的原因：让模型自己判断这条是不是已经过时——你无法替它判断，但你可以把判断依据交给它。</text>
      <text x="30" y="382" font-family="ui-monospace, monospace" font-size="9.4" fill="#2f6157">兜底：任何召回的记忆，都允许用户看到、更正、删除。</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　写入侧四个校验 + 召回侧三条纪律。<b>注意触发器 ③ 的标注</b>：自动抽取是记忆系统噪音的主要来源，绝大多数「记忆让效果变差」的案例都出在这里——不是记忆没用，而是自动抽取把一次性信息固化了。</figcaption>
</figure>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 320" role="img" aria-label="四类记忆冲突与各自的处理原则对照">
      <defs>
        <marker id="ar1" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">四类冲突，四套原则</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">时序用「取代」、来源用「权威性」、层级用「越临时越优先」、真伪用「暴露」</text>
      <rect x="16" y="54" width="628" height="22" fill="#1f1b16"/>
      <text x="28" y="69" font-family="ui-monospace, monospace" font-size="9.6" font-weight="700" fill="#fdf6e8">冲突类型</text>
      <text x="170" y="69" font-family="ui-monospace, monospace" font-size="9.6" font-weight="700" fill="#fdf6e8">典型示例</text>
      <text x="430" y="69" font-family="ui-monospace, monospace" font-size="9.6" font-weight="700" fill="#fdf6e8">处理原则</text>
      <rect x="16" y="78" width="628" height="54" fill="#fdf6e8" stroke="#b8944b" stroke-width="1"/>
      <text x="28" y="100" font-family="Georgia, serif" font-size="10.5" font-weight="700" fill="#8a6a1e">时序冲突</text>
      <text x="28" y="120" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">A 负责 → 半年后 B 负责</text>
      <text x="170" y="100" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">新事实取代旧事实，旧值</text>
      <text x="170" y="114" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">保留为历史版本并标记失效</text>
      <text x="430" y="100" font-family="ui-monospace, monospace" font-size="8.8" fill="#2f6157">按时间取最新；软删除</text>
      <text x="430" y="114" font-family="ui-monospace, monospace" font-size="8.8" fill="#2f6157">保留证据，不物理删除</text>
      <rect x="16" y="134" width="628" height="54" fill="#eef4f1" stroke="#2f6157" stroke-width="1"/>
      <text x="28" y="156" font-family="Georgia, serif" font-size="10.5" font-weight="700" fill="#2f6157">来源冲突</text>
      <text x="28" y="176" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">口述 X vs 文档 Y</text>
      <text x="170" y="156" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">系统文档优先作为事实；</text>
      <text x="170" y="170" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">口述作补充或待确认</text>
      <text x="430" y="156" font-family="ui-monospace, monospace" font-size="8.8" fill="#1f1b16">按来源权威性裁决</text>
      <text x="430" y="170" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">（文档 &gt; 口述）</text>
      <rect x="16" y="190" width="628" height="54" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1"/>
      <text x="28" y="212" font-family="Georgia, serif" font-size="10.5" font-weight="700" fill="#9b2c2c">层级冲突</text>
      <text x="28" y="232" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">长期「详细」vs 本次「简洁」</text>
      <text x="170" y="212" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">越临时的越优先：本次指令</text>
      <text x="170" y="226" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">覆盖长期偏好，且不改长期</text>
      <text x="430" y="212" font-family="ui-monospace, monospace" font-size="8.8" fill="#9b2c2c">不修改长期偏好</text>
      <text x="430" y="226" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">（否则永久污染画像）</text>
      <rect x="16" y="246" width="628" height="54" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="28" y="268" font-family="Georgia, serif" font-size="10.5" font-weight="700" fill="#1f1b16">真伪冲突</text>
      <text x="28" y="288" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">两条相反且无时间差</text>
      <text x="170" y="268" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">两条都标「存在冲突」，</text>
      <text x="170" y="282" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">在回答时显式暴露</text>
      <text x="430" y="268" font-family="ui-monospace, monospace" font-size="8.8" fill="#1f1b16">不选边；交用户裁决</text>
      <text x="430" y="282" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">并沉淀高置信新记忆</text>
    </svg>
  </div>
  <figcaption><b>图 2</b>　四类冲突用四套原则，不能混用。<b>第四行（真伪冲突）最容易被做错</b>：绝大多数系统会「取相似度高的那条」或「取新的那条」，都是在假装自己知道答案。正确做法是保留冲突并暴露。</figcaption>
</figure>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 240" role="img" aria-label="记忆版本链：软删除保留历史，任何时刻可解释">
      <defs>
        <marker id="ar2" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#2f6157"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">记忆版本链：软删除而非物理删除</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">同 key 的多个版本按时间排开；superseded_at 标出失效时刻，active 永远唯一</text>
      <line x1="60" y1="100" x2="610" y2="100" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar2)"/>
      <text x="612" y="104" text-anchor="end" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">时间 →</text>
      <rect x="40" y="78" width="150" height="44" fill="#eef4f1" stroke="#2f6157" stroke-width="1.2"/>
      <text x="115" y="98" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" font-weight="700" fill="#2f6157">v1 生效</text>
      <text x="115" y="113" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.4" fill="#6b6257">2025-03-12 写入</text>
      <rect x="255" y="78" width="150" height="44" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="330" y="98" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" font-weight="700" fill="#8a6a1e">v2 生效</text>
      <text x="330" y="113" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.4" fill="#6b6257">2025-09-01 写入</text>
      <line x1="115" y1="122" x2="330" y2="150" stroke="#9b2c2c" stroke-width="1.2" stroke-dasharray="3 2" marker-end="url(#ar2)"/>
      <text x="150" y="142" font-family="ui-monospace, monospace" font-size="8.4" fill="#9b2c2c">v1.superseded_at</text>
      <rect x="470" y="78" width="150" height="44" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="545" y="98" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" font-weight="700" fill="#8a6a1e">v3 生效</text>
      <text x="545" y="113" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.4" fill="#6b6257">2026-01-15 写入</text>
      <line x1="330" y1="122" x2="545" y2="150" stroke="#9b2c2c" stroke-width="1.2" stroke-dasharray="3 2" marker-end="url(#ar2)"/>
      <rect x="16" y="168" width="628" height="52" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="30" y="188" font-family="Georgia, serif" font-size="10.5" font-weight="700" fill="#1f1b16">可解释性：任何时刻都能回答「系统为什么曾这么认为」</text>
      <text x="30" y="206" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">v1 仍可被 explain() 打印：「2025-03-12 由 A 提供，2025-09-01 被 B 的新口径取代」——信任由此建立。</text>
      <text x="30" y="219" font-family="ui-monospace, monospace" font-size="9" fill="#9b2c2c">用户要求删除时，forget(hard=True) 彻底清除包括历史版本。</text>
    </svg>
  </div>
  <figcaption><b>图 3</b>　软删除让版本链始终可追溯：<b>失效的不是被抹掉，而是被打上 superseded_at</b>。这既满足合规（可解释），又保留用户行使删除权的能力（硬删除）。</figcaption>
</figure>

## 三、冲突消解：两条记忆打架怎么办

这是记忆系统最难的部分，也是面试里最容易问到的深层问题。它的正式名字是 [[conflict-resolution|冲突消解]]，难点不在「判断」，而在「判断之后要不要假装知道答案」。

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>冲突类型</th><th>示例</th><th>处理原则</th></tr></thead>
    <tbody>
      <tr><td><b>时序冲突</b></td><td>「A 部门负责这个指标」→ 半年后「改由 B 部门负责」</td><td>新事实取代旧事实，但旧事实要保留为历史版本并标记失效时间，而不是物理删除</td></tr>
      <tr><td><b>来源冲突</b></td><td>用户口述「口径是 X」，系统文档写「口径是 Y」</td><td>系统文档优先作为事实；用户口述作为补充或标注为待确认</td></tr>
      <tr><td><b>层级冲突</b></td><td>通用偏好「输出详细」vs 本次指令「要简洁」</td><td>越临时的越优先，本次指令覆盖长期偏好，且不修改长期偏好</td></tr>
      <tr><td><b>真伪冲突</b></td><td>两条记忆语义相反且无时间差异</td><td><b>不选边</b>：两条都标为「存在冲突」，在需要时向用户澄清</td></tr>
    </tbody>
  </table>
</div>

<div class="box box-key">
  <span class="box-title">第四行是很多系统的致命缺陷</span>
  <p>当两条记忆真正矛盾且无法用时序判断，绝大多数系统的做法是「取相似度高的那条」或「取新的那条」。这两种做法都在<strong>假装自己知道答案</strong>。</p>
  <p>正确做法是：<b>保留冲突，并在回答时显式暴露它</b>——「关于这个口径，我这里有两条互相矛盾的信息（A：…… B：……），你希望以哪条为准？」 这样做有两个好处：用户得到了正确的服务，而且这次澄清会产出一条高置信度的新记忆，把冲突真正解决掉。</p>
</div>

## 四、让记忆可解释、可更正、可删除

这三件事是记忆系统的底线，也是产品能不能被信任的前提。其中 [[soft-delete|软删除]] 保证「忘得掉」，[[memory-explainability|记忆可解释性]] 保证「说得清」——二者合起来，用户才敢用。

```python title="memory_store.py"
from dataclasses import dataclass, field
from datetime import datetime
import hashlib
@dataclass
class Memory:
    key: str                       # 归属实体 + 主题，如 "user:42/pref/format"
    content: str
    tier: str                      # fact | preference | inference
    confidence: float              # 0-1，推断类必须低于 0.8
    source: str                    # 谁说的 / 从哪来的
    written_at: str = field(default_factory=lambda: datetime.now().isoformat(timespec="seconds"))
    superseded_at: str | None = None    # 被新版本取代的时间（软删除）
    evidence: list[str] = field(default_factory=list)   # 依据链
    @property
    def active(self) -> bool:
        return self.superseded_at is None
    def to_prompt_line(self) -> str:
        """回喂格式：内容 + 时间 + 层级 + 置信度，让模型自己能判断时效"""
        tag = f"[{self.tier}·{self.confidence:.1f}]"
        return (f"{tag} {self.content}\n"
                f"    记录于 {self.written_at[:10]}　来源：{self.source}")
class MemoryStore:
    def __init__(self):
        self._items: dict[str, list[Memory]] = {}   # key -> 版本链（保留历史）
    def write(self, m: Memory) -> str:
        """
        同 key 的旧版本不删除，只标记 superseded_at。
        这保证了「可解释」——任何时候都能回答「为什么系统会这么认为」。
        去重按内容指纹判断，而不是字符串相等：同一事实会有无数种表述，
        直接比字符串几乎永远为假（见误区 5.3）。
        """
        chain = self._items.setdefault(m.key, [])
        fp = memory_fingerprint(m.content)
        for old in chain:
            if old.active and memory_fingerprint(old.content) == fp:
                return "duplicate"
            if old.active:
                old.superseded_at = m.written_at     # 软删除，保留证据
        chain.append(m)
        return "written"
    def recall(self, keys: list[str], limit: int = 5) -> list[Memory]:
        """只返回当前有效版本，且带时间戳"""
        out = []
        for k in keys:
            actives = [m for m in self._items.get(k, []) if m.active]
            out.extend(actives)
        return out[:limit]
    def conflicts(self) -> list[tuple[Memory, Memory]]:
        """检测同 key 下无法用时序消解的并存冲突（理论上不该存在）"""
        res = []
        for chain in self._items.values():
            actives = [m for m in chain if m.active]
            if len(actives) > 1:
                res.append((actives[0], actives[1]))
        return res
    def forget(self, key: str, hard: bool = False) -> int:
        """
        删除能力是记忆系统的合规底线。
        hard=True 用于用户行使「删除权」，彻底清除包括历史版本。
        """
        if key not in self._items:
            return 0
        n = len(self._items[key])
        if hard:
            del self._items[key]
        else:
            for m in self._items[key]:
                m.superseded_at = m.superseded_at or datetime.now().isoformat(timespec="seconds")
        return n
    def explain(self, key: str) -> str:
        """可解释性：把一条记忆的完整演变史打印出来"""
        chain = self._items.get(key, [])
        if not chain:
            return f"{key}: 无记录"
        lines = []
        for m in chain:
            state = "生效" if m.active else f"已于 {m.superseded_at[:10]} 失效"
            lines.append(f"  {m.written_at[:10]}  {state}　[{m.tier}] {m.content}（来源 {m.source}）")
        return f"{key} 的演变：\n" + "\n".join(lines)
def memory_fingerprint(text: str) -> str:
    """内容指纹，用于跨库去重"""
    return hashlib.sha256(text.strip().encode()).hexdigest()[:16]
```



<div class="box box-practice">
  <span class="box-title">实操任务</span>
  <ul>
    <li>用 <code>explain()</code> 输出一条记忆的演变史，检查是否满足「任何时刻的结论都能追溯到来源与时间」；</li>
    <li>构造一个时序冲突（先写 A，再写 A'），验证 <code>recall()</code> 只返回 A' 而历史仍可查；</li>
    <li>构造一个真伪冲突（同 key 两条 active），验证 <code>conflicts()</code> 能检出，并设计一段话术在回答时暴露冲突。</li>
  </ul>
</div>

## 五、常见误区与追问

### 5.1 误区：自动抽取最省事，开着就好
很多团队把「每轮自动判断有无值得记的」当成默认开启的能力。错在这会把一次性、临时的信息固化成长期记忆：用户随口说「这次简洁点」会被写成长期偏好，某次错误的推断会被当成事实。判据很硬：当记忆库里一次性信息的比例超过 30%，召回的信噪比会明显跌破可用线，模型开始「越跑越笨」。修法是给自动抽取设稳定性阈值（这条信息一个月后还成立吗？）加定期清理，且优先用显式指令触发写入。

### 5.2 误区：新旧事实冲突，直接覆盖旧的就行
直觉是「新的覆盖旧的，干掉旧的省事」。这是 [[temporal-conflict|时序冲突]] 的典型误处理：直接覆盖会丢掉可解释性——你再也无法回答「系统为什么曾经认为口径是 X」。正确做法是旧值保留为历史版本并标记 superseded_at（软删除），新值成为唯一 active 版本。代价只是多一点存储，换来的是任何时候都能把演变链打印出来。

### 5.3 误区：记忆去重靠字符串相等判断
实现上常写「如果内容等于已有记忆就跳过」。但同一事实会有无数种表述，字符串相等几乎永远为假，于是语义重复的记忆被反复写入，冲突与噪音随之而来。正确做法是用 [[memory-fingerprint|内容指纹]]（对内容取哈希）做跨库去重，更新时改旧版本的 superseded_at 而不是新建一条。

### 5.4 误区：用户说删记忆，删掉当前值就够了
只删当前 active 值，历史版本仍在，既不满足合规删除权（如 GDPR 的被遗忘权），也会让过期结论在审计里重现。系统必须同时支持软删除（标记失效，保留证据）与硬删除（彻底清除含历史版本）。这两件事不矛盾：日常用软删除保可解释，用户行使权利时用硬删除彻底清除。

### 5.5 误区：记忆越多，Agent 越聪明
反直觉但真实：记忆是资产还是污染源，取决于信噪比。召回上限建议 5 条以内，且必须带写入时间，让模型自己判断时效性。过量召回会挤占上下文、把无关信息变成干扰，结果不是「更懂你」，而是「更常被旧信息带偏」。判据：统计一次召回里有几条真正被写进答案，命中率低于一半就先按实体与主题收窄召回键，而不是继续加大 top-k；记忆出问题几乎都是召得太宽，而不是记得太少。

## 六、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>第 3 题区分度最高</span></div>
  <div class="q-item" data-qid="harness05-q1" data-answer="2">
    <div class="q-text"><span class="idx">Q1</span>为什么「每轮对话都自动抽取记忆」是危险的？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>因为会让模型调用次数增加，成本上升</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>因为会占用显存</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>因为会把一次性、临时的信息固化为长期记忆，噪音持续累积，导致召回质量下降</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>因为会导致上下文前缀不稳定</span></button>
    <div class="explain"><b>C。</b>成本上升只是次要问题。真正的伤害是<b>信噪比恶化</b>：「这次要简洁」被写成长期偏好，「这个数据好像不太对」被写成事实，最终召回的内容大量是噪音。<b>修法是设稳定性阈值 + 定期清理 + 优先用显式指令触发写入。</b></div>
  </div>
  <div class="q-item" data-qid="harness05-q2" data-answer="1">
    <div class="q-text"><span class="idx">Q2</span>记忆冲突中，「越临时的越优先」适用于哪种情况？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>两条记忆语义相反且没有时间差异</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>长期偏好与本次指令冲突</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>用户口述与系统文档冲突</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>新旧版本的事实冲突</span></button>
    <div class="explain"><b>B。</b>不同冲突用不同原则：D 用时序（新的取代旧的），C 用来源权威性（系统文档优先），A 则<b>不选边、暴露冲突</b>。B 是层级冲突——本次指令覆盖长期偏好，但必须注意<b>不能因此修改长期偏好</b>，否则一次临时要求会永久污染用户画像。</div>
  </div>
  <div class="q-item" data-qid="harness05-q3" data-answer="3">
    <div class="q-text"><span class="idx">Q3</span>为什么记忆要「软删除」（标记失效）而不是直接物理删除？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>为了节省存储，物理删除成本高</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>因为软删除能让召回结果更多</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>因为物理删除会破坏向量库索引</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>为了保留可解释性——任何时刻都能回答「系统为什么曾经这么认为」，同时用户行使删除权时仍可彻底清除</span></button>
    <div class="explain"><b>D。</b>可解释性是记忆系统的核心资产：当用户质疑「你为什么觉得我们口径是 X」时，能拿出「2025-03-12 由 A 提供，2025-09-01 被 B 的新口径取代」这条链，信任才建立得起来。同时要记住<b>用户要求删除时必须能真正硬删除</b>——这两件事不矛盾，是两套不同场景。</div>
  </div>
</div>

## 七、小结

| 问题 | 答案要点 |
| --- | --- |
| 记什么 | 分三层：工作记忆（任务级）/ 情节记忆（历史）/ 语义记忆（长期事实与偏好） |
| 什么时候写 | 显式指令 &gt; 任务结束固化 &gt; 自动抽取（最需谨慎） |
| 写入前校验 | 稳定性、来源可信、非重复、可归属，四条都要过 |
| 冲突怎么办 | 时序 / 来源 / 层级 / 真伪，四类用四套原则；真伪冲突不选边 |
| 怎么召回 | 上限 5 条以内，必须带时间与来源 |
| 底线 | 可解释、可更正、可删除（含硬删除） |

<p class="pull-quote">记忆的价值不在于记得多，而在于记得准、说得清、忘得掉。<cite>本刊编辑部</cite></p>

下一章处理一个常见的设计抉择：当任务复杂到一定程度，是该开更多 Agent，还是把上下文做得更好？

## 八、参考与延伸

本章的机制部分只讲到「够用」为止。想往下深挖，下面这几份材料按「先看图、再看代码、最后读博客」的顺序排好了。全站不做原文转载，这里只登记链接与「为什么值得读」。

**先看图（建立直觉）**

- [Anthropic · Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) —— 把「记忆 / 检索 / 工具」当成 Agent 的状态组件来设计。<strong>重点看它怎么把记忆作为结构化状态而不是聊天历史，和本章的「分层存储」直接对应。</strong>

**再看代码（动手实现）**

- [Datawhale · hugging-llm](https://github.com/datawhalechina/hugging-llm) —— 中文社区对 LLM 应用工程的系统梳理。<strong>其中记忆与检索相关章节，可对照本章的「写入触发器 / 冲突消解」动手实现一遍。</strong>

**最后读博客（对齐一手定义）**

- [Eugene Yan · Blog](https://eugeneyan.com/) —— Eugene 的长期实践帖覆盖记忆、检索与个性化。<strong>他关于「把用户偏好当长期状态管理」的讨论，正是本章语义记忆要解决的问题。</strong>
- [Simon Willison · LLM and AI notes](https://simonwillison.net/) —— Simon 大量记录「Agent 跑飞 / 工具误用」的真实案例。<strong>翻他的 agent 标签，能看到记忆与权限失控的真实事故。</strong>
