---
chapter: harness-06-multi-agent
lead: '「什么时候该多开一个 Agent，什么时候那是自找麻烦」——这是 Agent 架构里最容易答错的一道题。正确答案不是「复杂任务就该多 Agent」，而是三个具体条件：上下文隔离、并行提速、权限隔离。三个都不满足，多开 Agent 只会让系统更难调试、更贵、更慢。'
note: '本章的核心判断题（为什么用 Subagent 而不是长上下文单 Agent）在真实面经中出现过，请重点看第二节。'
---

<p class="dropcap">先说一个反直觉的结论：<b>大多数「感觉该上多 Agent」的场景，正确的解法是把单 Agent 的上下文管理做好。</b>多 Agent 引入了进程间通信、上下文传递损失、结果汇总冲突、调试难度指数上升这四项成本，只有当它换来的收益明确大于这些成本时才值得。</p>

## 一、三种收益，对应三种拆分方式

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>收益</th><th>什么时候成立</th><th>拆分方式</th><th>典型场景</th></tr></thead>
    <tbody>
      <tr><td><b>上下文隔离</b></td><td>子任务会产生大量只要用一次、但会严重污染主上下文的中间输出</td><td>子 Agent 只把<b>结论</b>返回给父 Agent</td><td>深度检索：读了 30 篇文档，主 Agent 只需要 5 条结论</td></tr>
      <tr><td><b>并行提速</b></td><td>子任务之间彼此独立、无数据依赖</td><td>同时派生多个子 Agent，最后汇总</td><td>对 8 个候选方案各做一次可行性评估</td></tr>
      <tr><td><b>权限隔离</b></td><td>某些操作需要更高权限或更强的沙箱约束</td><td>用独立的 Agent 持有不同工具集</td><td>读数据的 Agent 与能写生产库的 Agent 分开</td></tr>
    </tbody>
  </table>
</div>

**注意：只有第一种收益是「结构性」的**——它来自 [[subagent|子 Agent]] 的 [[context-isolation|上下文隔离]]，解决了单 Agent 无法解决的问题（上下文容量）。第二种收益可以用并发工具调用实现，第三种收益可以用工具级权限控制实现。所以 [[multi-agent|多 Agent]] 真正必须上的场景，比想象中少。

## 二、为什么用 Subagent，而不是长上下文的单 Agent

这道题在真实面经里出现过，它是本章最值得背下来的答案框架。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 420" role="img" aria-label="长上下文单 Agent 与 Subagent 拆分的对比">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">同一个任务，两种结构</text>
      <!-- 单 Agent -->
      <text x="16" y="46" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#9b2c2c">A · 单 Agent + 长上下文</text>
      <rect x="16" y="56" width="308" height="230" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="30" y="76" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">上下文里累积：</text>
      <rect x="30" y="84" width="280" height="18" fill="#e8d5d5"/>
      <text x="36" y="97" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">系统指令 + 工具定义（固定）</text>
      <rect x="30" y="106" width="280" height="26" fill="#d6bcbc"/>
      <text x="36" y="122" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">文档 1 全文（4,000）</text>
      <rect x="30" y="136" width="280" height="26" fill="#d6bcbc"/>
      <text x="36" y="152" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">文档 2 全文（4,000）</text>
      <rect x="30" y="166" width="280" height="26" fill="#d6bcbc"/>
      <text x="36" y="182" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">文档 3 全文（4,000）</text>
      <rect x="30" y="196" width="280" height="26" fill="#d6bcbc"/>
      <text x="36" y="212" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">…… 文档 30 全文（4,000）</text>
      <text x="30" y="238" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">共 12 万 token，其中真正需要的结论约 500 字</text>
      <text x="30" y="256" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">每一轮都要重新送一遍 → 成本平方级上涨</text>
      <text x="30" y="274" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">信噪比 0.5%，注意力被 99.5% 的噪音稀释</text>
      <!-- 多 Agent -->
      <text x="336" y="46" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#2f6157">B · Subagent 拆分</text>
      <rect x="336" y="56" width="308" height="230" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <rect x="350" y="68" width="130" height="34" fill="#ffffff" stroke="#2f6157" stroke-width="1"/>
      <text x="415" y="83" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.8" fill="#2f6157">Subagent 1</text>
      <text x="415" y="96" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.2" fill="#6b6257">读文档 1-10，产出结论</text>
      <rect x="500" y="68" width="130" height="34" fill="#ffffff" stroke="#2f6157" stroke-width="1"/>
      <text x="565" y="83" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.8" fill="#2f6157">Subagent 2</text>
      <text x="565" y="96" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.2" fill="#6b6257">读文档 11-20，产出结论</text>
      <rect x="350" y="110" width="130" height="34" fill="#ffffff" stroke="#2f6157" stroke-width="1"/>
      <text x="415" y="125" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.8" fill="#2f6157">Subagent 3</text>
      <text x="415" y="138" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.2" fill="#6b6257">读文档 21-30，产出结论</text>
      <rect x="500" y="110" width="130" height="34" fill="#fdf6e8" stroke="#b8944b" stroke-width="1"/>
      <text x="565" y="125" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.8" fill="#8a6a1e">各自的上下文</text>
      <text x="565" y="138" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.2" fill="#6b6257">用完即释放</text>
      <line x1="415" y1="144" x2="415" y2="166" stroke="#2f6157" stroke-width="1.2"/>
      <line x1="565" y1="144" x2="565" y2="166" stroke="#2f6157" stroke-width="1.2"/>
      <line x1="415" y1="166" x2="565" y2="166" stroke="#2f6157" stroke-width="1.2"/>
      <line x1="490" y1="166" x2="490" y2="186" stroke="#2f6157" stroke-width="1.2" marker-end="url(#ar6)"/>
      <defs>
        <marker id="ar6" markerWidth="9" markerHeight="9" refX="4" refY="1" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#2f6157"/>
        </marker>
      </defs>
      <rect x="350" y="188" width="280" height="60" fill="#ffffff" stroke="#2f6157" stroke-width="1.3"/>
      <text x="490" y="206" text-anchor="middle" font-family="Georgia, serif" font-size="10.2" font-weight="700" fill="#2f6157">父 Agent 的上下文</text>
      <text x="490" y="222" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">只装 3 段结论（约 600 token）</text>
      <text x="490" y="238" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#2f6157">信噪比接近 100%，前缀稳定</text>
      <text x="350" y="266" font-family="ui-monospace, monospace" font-size="9.2" fill="#2f6157">成本：3 次并行子调用，各自一次性</text>
      <text x="350" y="280" font-family="ui-monospace, monospace" font-size="9.2" fill="#2f6157">主循环上下文稳定 → 缓存命中率极高</text>
      <!-- 结论 -->
      <rect x="16" y="300" width="628" height="106" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="30" y="320" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">答题框架：为什么用 Subagent（可直接背）</text>
      <text x="30" y="340" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">① 上下文隔离：子 Agent 的中间过程用完即弃，父 Agent 只接收结构化的结论，避免主上下文被噪音稀释。</text>
      <text x="30" y="358" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">② 并行提速：彼此独立的子任务可以同时跑，墙钟时间从「相加」变成「取最大」。</text>
      <text x="30" y="376" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">③ 权限隔离：读操作与写操作、可信区与不可信区分属不同 Agent，缩小能力边界。</text>
      <text x="30" y="396" font-family="ui-monospace, monospace" font-size="9.4" fill="#9b2c2c">代价必须一起说：上下文传递有信息损失、结果汇总可能冲突、调试与 trace 难度显著上升。</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　关键差别不在「有几个 Agent」，而在<b>父 Agent 的上下文里装的是什么</b>。A 装的是 12 万 token 的原始材料（信噪比 0.5%），B 装的是 600 token 的结论（信噪比接近 100%）。这个对比本身就是这道题的答案。</figcaption>
</figure>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 330" role="img" aria-label="三种编排形态：主管制、流水线、评审制的拓扑与失控方式">
      <defs>
        <marker id="ar1" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">三种编排形态：拓扑决定失控方式</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">形状不同 → 失败时出问题的位置不同</text>
      <text x="16" y="62" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#2f6157">① 主管制 Supervisor</text>
      <rect x="250" y="50" width="90" height="24" fill="#ffffff" stroke="#2f6157" stroke-width="1.2"/>
      <text x="295" y="67" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#2f6157">父 Agent</text>
      <rect x="150" y="88" width="56" height="22" fill="#eef4f1" stroke="#2f6157" stroke-width="1"/>
      <text x="178" y="103" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8" fill="#2f6157">子1</text>
      <rect x="276" y="88" width="56" height="22" fill="#eef4f1" stroke="#2f6157" stroke-width="1"/>
      <text x="304" y="103" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8" fill="#2f6157">子2</text>
      <rect x="402" y="88" width="56" height="22" fill="#eef4f1" stroke="#2f6157" stroke-width="1"/>
      <text x="430" y="103" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8" fill="#2f6157">子3</text>
      <line x1="270" y1="74" x2="178" y2="88" stroke="#2f6157" stroke-width="1" marker-end="url(#ar1)"/>
      <line x1="295" y1="74" x2="304" y2="88" stroke="#2f6157" stroke-width="1" marker-end="url(#ar1)"/>
      <line x1="320" y1="74" x2="430" y2="88" stroke="#2f6157" stroke-width="1" marker-end="url(#ar1)"/>
      <text x="478" y="70" font-family="ui-monospace, monospace" font-size="8.4" fill="#9b2c2c">失控：父成单点瓶颈；</text>
      <text x="478" y="84" font-family="ui-monospace, monospace" font-size="8.4" fill="#9b2c2c">汇总时压缩损失</text>
      <text x="16" y="132" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">② 流水线 Pipeline</text>
      <rect x="120" y="120" width="50" height="22" fill="#ffffff" stroke="#b8944b" stroke-width="1.2"/>
      <text x="145" y="135" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8" fill="#8a6a1e">A</text>
      <rect x="230" y="120" width="50" height="22" fill="#ffffff" stroke="#b8944b" stroke-width="1.2"/>
      <text x="255" y="135" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8" fill="#8a6a1e">B</text>
      <rect x="340" y="120" width="50" height="22" fill="#ffffff" stroke="#b8944b" stroke-width="1.2"/>
      <text x="365" y="135" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8" fill="#8a6a1e">C</text>
      <line x1="170" y1="131" x2="228" y2="131" stroke="#b8944b" stroke-width="1.2" marker-end="url(#ar1)"/>
      <line x1="280" y1="131" x2="338" y2="131" stroke="#b8944b" stroke-width="1.2" marker-end="url(#ar1)"/>
      <text x="478" y="128" font-family="ui-monospace, monospace" font-size="8.4" fill="#9b2c2c">失控：上游错误被放大；</text>
      <text x="478" y="142" font-family="ui-monospace, monospace" font-size="8.4" fill="#9b2c2c">一环卡住整体阻塞</text>
      <text x="16" y="202" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#9b2c2c">③ 评审制 Critic</text>
      <rect x="200" y="188" width="70" height="22" fill="#ffffff" stroke="#9b2c2c" stroke-width="1.2"/>
      <text x="235" y="203" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8" fill="#9b2c2c">生成者</text>
      <rect x="200" y="228" width="70" height="22" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.2"/>
      <text x="235" y="243" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8" fill="#9b2c2c">评审者</text>
      <path d="M270,199 C300,199 300,188 270,188" fill="none" stroke="#9b2c2c" stroke-width="1.1" marker-end="url(#ar1)"/>
      <path d="M270,239 C300,239 300,250 270,250" fill="none" stroke="#9b2c2c" stroke-width="1.1" marker-end="url(#ar1)"/>
      <text x="478" y="206" font-family="ui-monospace, monospace" font-size="8.4" fill="#9b2c2c">失控：来回修改无实质</text>
      <text x="478" y="220" font-family="ui-monospace, monospace" font-size="8.4" fill="#9b2c2c">提升，预算被烧光</text>
      <rect x="16" y="282" width="628" height="40" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="30" y="302" font-family="ui-monospace, monospace" font-size="9" fill="#1f1b16">共同代价：上下文传递有信息损失、结果汇总可能冲突、调试与 trace 难度显著上升——所以「先单 Agent 跑通，再按需拆分」。</text>
    </svg>
  </div>
  <figcaption><b>图 2</b>　三种形态的<b>拓扑形状直接对应各自的失控方式</b>：主管制的父是瓶颈、流水线的上游错误被放大、评审制容易陷入无进展循环。选形态前先想清楚会怎么坏。</figcaption>
</figure>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 260" role="img" aria-label="子 Agent 协议：回传必须带结论、证据、来源、置信度">
      <defs>
        <marker id="ar2" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#2f6157"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">子 Agent 协议：回传必须自解释</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">父 Agent 只拿到结构化的「结论 + 最小证据」，才能判断要不要采信</text>
      <rect x="16" y="54" width="300" height="60" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.2"/>
      <text x="30" y="74" font-family="Georgia, serif" font-size="10.5" font-weight="700" fill="#9b2c2c">✗ 自由文本</text>
      <text x="30" y="94" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">「我觉得这个方案大概可行，</text>
      <text x="30" y="106" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">不过也有些问题……」</text>
      <rect x="344" y="54" width="300" height="150" fill="#eef4f1" stroke="#2f6157" stroke-width="1.2"/>
      <text x="358" y="74" font-family="Georgia, serif" font-size="10.5" font-weight="700" fill="#2f6157">✓ SubResult 协议</text>
      <text x="358" y="92" font-family="ui-monospace, monospace" font-size="8.8" fill="#1f1b16">conclusion: 已确认 X 可行</text>
      <text x="358" y="108" font-family="ui-monospace, monospace" font-size="8.8" fill="#1f1b16">evidence: [依据1, 依据2]</text>
      <text x="358" y="124" font-family="ui-monospace, monospace" font-size="8.8" fill="#1f1b16">sources: [doc-12, doc-30]</text>
      <text x="358" y="140" font-family="ui-monospace, monospace" font-size="8.8" fill="#1f1b16">confidence: 0.82</text>
      <text x="358" y="156" font-family="ui-monospace, monospace" font-size="8.8" fill="#2f6157">caveats: 未覆盖 Y 场景</text>
      <text x="358" y="190" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">低置信度(&lt;0.7) 不进主结论，只作参考</text>
      <line x1="316" y1="84" x2="342" y2="120" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar2)"/>
      <text x="318" y="100" font-family="ui-monospace, monospace" font-size="8" fill="#6b6257">改造</text>
    </svg>
  </div>
  <figcaption><b>图 3</b>　子 Agent 的产出必须自解释：<b>带结论、带最小证据、带来源、带置信度</b>。缺任何一项，父 Agent 都无法判断该不该采信，只能靠「看起来有道理」盲信。</figcaption>
</figure>

## 三、编排形态：三种模式与各自的坑

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>形态</th><th>结构</th><th>适合</th><th>主要风险</th></tr></thead>
    <tbody>
      <tr><td><b>主管制</b>（Supervisor）</td><td>父 Agent 分解任务、派生、汇总</td><td>任务分解清晰、子任务同质</td><td>父 Agent 成为瓶颈与单点；汇总时信息压缩损失</td></tr>
      <tr><td><b>流水线</b>（Pipeline）</td><td>A 的输出交给 B，B 交给 C</td><td>阶段界限清晰的加工流程</td><td>上游错误被逐级放大且难以定位；某一环卡住整体阻塞</td></tr>
      <tr><td><b>评审制</b>（Critic）</td><td>生成者 + 评审者交替循环</td><td>质量要求高、可验证的产出</td><td><b>容易陷入「改了又改」的无进展循环</b>，必须设轮数上限</td></tr>
    </tbody>
  </table>
</div>

<div class="box box-warn">
  <span class="box-title">评审制最常见的失控方式</span>
  <p>生成者与评审者互相不满意，来回修改十几轮——每次修改都「看起来有道理」，但整体质量并不提升。这在日志里表现为一轮正常的对话，实际上已经烧掉大量预算。</p>
  <p><b>修法三件套：</b>① 评审必须有明确的通过标准（rubric），而不是「你觉得好不好」；② 设最大轮数上限；③ 每轮必须产生实质变化（改动点可枚举），否则判定为无进展、直接退出。<b>这与第 2 章的无进展检测是同一个思路。</b></p>
</div>

## 四、结果汇总：比想象中难

多 Agent 的成果最终要合到一起，这里有三个具体的坑——它们都指向同一件事：[[result-merge|结果汇总]] 必须显式处理，而不能交给模型「自由发挥」。

**第一，格式不一致。** 三个子 Agent 返回三种结构，父 Agent 得先做格式归一。**解法**：子 Agent 的输出必须强制结构化——这正是 [[subagent-protocol|子 Agent 协议]] 要解决的：固定字段的 JSON，而不是自由文本。

**第二，结论冲突。** 两个子 Agent 对同一问题给出相反结论。**解法**：不要静默选一个，要让父 Agent 显式处理——这正是 [[conflict-exposure|冲突暴露]]：要么用可判定的依据（时间、来源权威性）裁决，要么在最终产物里同时呈现两种观点及其依据。

**第三，信息损失。** 子 Agent 的结论太简略，父 Agent 无法判断其可信度。**解法**：结论里必须带最小必要证据——一句话的依据、来源标识、以及该子任务的置信度。

```python title="subagent_protocol.py"
from dataclasses import dataclass, asdict
from typing import Literal
import json
@dataclass
class SubResult:
    """
    子 Agent 返回给父 Agent 的唯一格式。
    设计要点：带证据、带置信度、带来源——否则父 Agent 无法判断该不该采信。
    """
    sub_task: str
    status: Literal["ok", "partial", "failed"]
    conclusion: str                 # 结论，尽量短
    evidence: list[str]             # 支撑结论的最小证据（每条一句）
    sources: list[str]              # 来源标识，可点开核对
    confidence: float               # 0-1，子 Agent 自评
    tokens_used: int = 0
    caveats: list[str] = None       # 已知局限 / 未覆盖范围
    def render(self) -> str:
        """父 Agent 看到的形态：结构化、紧凑、可核验"""
        return json.dumps(asdict(self), ensure_ascii=False, indent=1)
def dispatch(sub_tasks: list[str], run_subagent) -> list[SubResult]:
    """
    并行派发。注意三点：
      1. 每个子任务必须有明确的产出要求（否则子 Agent 会返回无法使用的东西）
      2. 失败不能中断整体（partial 也要收）
      3. 汇总前先做冲突检测
    """
    results: list[SubResult] = []
    for t in sub_tasks:
        spec = (f"{t}\n\n"
                f"要求：只返回结论 + 最少必要证据 + 来源 + 你的置信度（0-1）。"
                f"不要返回过程、不要返回原始文档全文。")
        try:
            results.append(run_subagent(spec))
        except Exception as e:
            results.append(SubResult(
                sub_task=t, status="failed",
                conclusion=f"子任务执行失败：{type(e).__name__}",
                evidence=[], sources=[], confidence=0.0))
    return results
def merge(results: list[SubResult]) -> dict:
    """汇总：先归并，再显式暴露冲突，绝不静默选边"""
    ok = [r for r in results if r.status == "ok"]
    partial = [r for r in results if r.status == "partial"]
    failed = [r for r in results if r.status == "failed"]
    # 低置信度结论不进主结论，只作为参考项
    strong = [r for r in ok if r.confidence >= 0.7]
    weak = [r for r in ok if r.confidence < 0.7]
    conflicts = detect_conflicts(strong)
    return {
        "primary": [{"conclusion": r.conclusion, "sources": r.sources} for r in strong],
        "reference": [{"conclusion": r.conclusion, "confidence": r.confidence} for r in weak],
        "unresolved": conflicts,        # 交给父 Agent 或用户裁决，不自己选
        "partial": [r.sub_task for r in partial],
        "failed": [{"task": r.sub_task, "reason": r.conclusion} for r in failed],
        "coverage": f"{len(ok)}/{len(results)} 个子任务完成",
    }
def detect_conflicts(results: list[SubResult]) -> list[dict]:
    """
    冲突检测：真实系统里可以用语义比对或让父 Agent 判断；
    这里用一个可插拔的占位实现，重点是**把冲突显式暴露出来**。
    """
    found = []
    for i in range(len(results)):
        for j in range(i + 1, len(results)):
            a, b = results[i], results[j]
            if contradicts(a.conclusion, b.conclusion):     # 占位
                found.append({"a": a.conclusion, "b": b.conclusion,
                              "a_sources": a.sources, "b_sources": b.sources})
    return found
def contradicts(a: str, b: str) -> bool:
    return False        # 占位：真实实现用语义模型或规则
```



## 五、什么时候<b>不要</b>用多 Agent

这份清单比「什么时候用」更值钱：

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>情形</th><th>为什么不该拆</th><th>更好的做法</th></tr></thead>
    <tbody>
      <tr><td>子任务之间有强数据依赖</td><td>串行依赖下并行收益为零，只增加通信开销</td><td>单 Agent，按顺序执行</td></tr>
      <tr><td>子任务产出很小</td><td>拆分的收益（隔离噪音）小于成本（通信 + 汇总）</td><td>直接在主 Agent 里调用工具</td></tr>
      <tr><td>需要全局一致性判断</td><td>每个子 Agent 都只看到局部，无法做全局判断</td><td>单 Agent 持有全局视图</td></tr>
      <tr><td>调试期、问题还没有定位</td><td>多一层派生就多一层不确定性，排查成本剧增</td><td>先让单 Agent 跑通，再考虑拆分</td></tr>
      <tr><td>延迟敏感且并行度低</td><td>进程启动与上下文传递带来的固定延迟可能超过收益</td><td>单 Agent + 并发工具调用</td></tr>
    </tbody>
  </table>
</div>

## 六、常见误区与追问

### 6.1 误区：任务一复杂就上多 Agent
最常见的直觉错误。多 Agent 引入了进程间通信、上下文传递损失、结果汇总冲突、调试难度指数上升四项成本。判据：只有当「上下文隔离 / 并行提速 / 权限隔离」至少一个成立时才值得拆；三项都说不清具体是哪一项，答案就是不拆。成本量级上，每多一层派生就多出一次上下文传递与一次结果汇总，固定开销约等于一次完整的模型调用——子任务体量小于这个开销时，拆分必亏。

### 6.2 误区：编排形态随便选，反正都能跑
三种形态各有固定的失控方式：[[supervisor|主管制]] 下父 Agent 是瓶颈与单点，汇总时信息压缩损失；[[pipeline|流水线]] 上游错误被逐级放大、一环卡住整体阻塞；[[critic|评审制]] 容易陷入「改了又改」的无进展循环。选型前先想清楚「它会怎么坏」，再配对应的护栏。判据：三种形态各配一条硬护栏——主管制给父 Agent 的汇总结果设 token 上限，流水线每一环加校验与错误回流，评审制设轮数上限并检查每轮是否真有可枚举的改动点。

### 6.3 误区：子 Agent 汇总让模型自己合并文本就行
让模型自由地把几个子结论揉成一段，等于把冲突消解交给了概率。正确做法是结果汇总显式处理：格式强制结构化、低置信度结论降为参考、冲突显式暴露交父 Agent 或用户裁决，绝不静默选边。判据：把子 Agent 的输出约束成固定字段（结论 / 证据 / 来源 / 置信度），缺字段直接判为不可用并重跑；自由文本一律不进主结论，只能进参考项。

### 6.4 误区：多 Agent 不需要权限隔离
一旦开了多 Agent，某个被提示注入说服的写操作 Agent 就能直接破坏生产库。[[permission-isolation|权限隔离]] 要求读数据与写生产库的操作由不同 Agent 持有不同工具集，且权限在工具内部强制执行——即使某个 Agent 被攻破，它也没有越权的钥匙。判据：读工具与写工具必须落在不同 Agent 的工具集里，权限检查写在工具实现内部；把系统提示词整段删掉后 Agent 仍然越不了权，这份隔离才算成立。

### 6.5 误区：评审制多跑几轮总能收敛
没有上限的评审循环，每一轮改动都「看起来有道理」，但实际质量不提升，预算被无声烧掉。修法三件套：明确通过标准（rubric）加轮数上限加每轮必须有可枚举的实质改动，否则判无进展直接退出。判据：轮数上限取 2–3 轮，与第 2 章的无进展检测同一思路——改进幅度落在波动区间内就不算改进，此时退出并返回当前最优版本，而不是继续烧预算。

## 七、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>第 1 题来自真实面经</span></div>
  <div class="q-item" data-qid="harness06-q1" data-answer="2">
    <div class="q-text"><span class="idx">Q1</span>用 Subagent 而不是让单 Agent 读全部材料，最主要的收益是什么？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>因为子 Agent 用了更小的模型，更省成本</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>因为子 Agent 的推理能力更强</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>把海量中间材料隔离在子 Agent 内部用完即弃，父 Agent 只接收结构化结论，从而提升信噪比、稳定主上下文并大幅降低成本</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>因为多 Agent 一定比单 Agent 效果更好</span></button>
    <div class="explain"><b>C。</b>答案是<b>上下文隔离</b>，这是唯一「结构性」的收益（单 Agent 无论怎么优化都无法让 12 万 token 的材料不占上下文）。顺带说清成本逻辑：Material 只在子 Agent 里出现一次，主循环前缀稳定、缓存命中率高，总成本反而下降。D 是典型的错误直觉。</div>
  </div>
  <div class="q-item" data-qid="harness06-q2" data-answer="0">
    <div class="q-text"><span class="idx">Q2</span>评审制（生成者 + 评审者）最常见的失控方式是？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>来回修改多轮但没有实质提升，预算被无声烧掉</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>评审者接受了所有输出，评审形同虚设</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>两个 Agent 无法通信</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>上下文窗口不够用</span></button>
    <div class="explain"><b>A。</b>这是最隐蔽的一种：每一轮改动都「看起来有道理」，日志里是一串正常的对话，质量却没有提升。<b>对策是给评审明确的通过标准（rubric）+ 轮数上限 + 每轮必须有可枚举的改动点</b>，与第 2 章的无进展检测同理。</div>
  </div>
  <div class="q-item" data-qid="harness06-q3" data-answer="3">
    <div class="q-text"><span class="idx">Q3</span>两个子 Agent 对同一问题给出相反结论，父 Agent 应该怎么处理？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>选置信度高的那个</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>选 token 消耗更多（说明更认真）的那个</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>随便选一个，用户不会注意到</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>显式暴露冲突，用可判定依据（来源权威性、时间）裁决，无法裁决时同时呈现两种结论及其依据</span></button>
    <div class="explain"><b>D。</b>静默选边是在<b>假装自己知道答案</b>——这在评测中会被记为「看似自信的错误」，比明确的「不确定」危害更大。正确做法与记忆系统的冲突处理一致：<b>能裁决就裁决（并说明依据），不能裁决就把冲突交出去。</b></div>
  </div>
</div>

## 八、小结

| 议题 | 结论 |
| --- | --- |
| 该不该拆 | 只有满足上下文隔离 / 并行提速 / 权限隔离之一才拆 |
| 最主要收益 | 上下文隔离（父 Agent 只装结论，不装材料） |
| 三种形态 | 主管制 / 流水线 / 评审制，各有对应的失控方式 |
| 汇总三坑 | 格式不一致、结论冲突、信息损失 |
| 冲突处理 | 绝不静默选边；能裁决就裁决并说明依据 |
| 上线顺序 | 先让单 Agent 跑通，再按需拆分 |

<p class="pull-quote">多 Agent 不是能力升级，是上下文管理的一种手段。把它当成能力升级来用，就会在不需要的地方引入三个新的失败面。<cite>本刊编辑部</cite></p>

下一章处理把能力交出去之后必须面对的问题：怎么守住边界。

## 九、参考与延伸

本章的机制部分只讲到「够用」为止。想往下深挖，下面这几份材料按「先看图、再看代码、最后读规范」的顺序排好了。全站不做原文转载，这里只登记链接与「为什么值得读」。

**先看图（建立直觉）**

- [Anthropic · Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) —— 官方对「何时该用多步 / 多 Agent」的判断。<strong>它明确把「上下文管理」放在「加 Agent」之前，和本章的核心判据一致。</strong>

**再看代码（动手实现）**

- [LangGraph 文档](https://langchain-ai.github.io/langgraph/) —— 用图表达 Agent 编排的主流框架。<strong>重点看 supervisor / 子图 / 人工介入节点，对应本章主管制与权限隔离。</strong>
- [AutoGen 文档](https://microsoft.github.io/autogen/stable/) —— 多 Agent 对话编排的参考实现。<strong>看它的 GroupChat 与 Critic 模式，能直观理解「评审制为什么会陷入无进展循环」。</strong>
- [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) —— 轻量多 Agent 原语。<strong>它的 handoff 机制是「上下文隔离」的最小可用实现。</strong>

**最后读规范（对齐一手定义）**

- [Model Context Protocol](https://modelcontextprotocol.io/) —— 工具供给的标准化协议。<strong>理解它能帮你想清「子 Agent 之间该共享什么、隔离什么」。</strong>
