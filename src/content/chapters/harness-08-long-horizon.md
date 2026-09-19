---
chapter: harness-08-long-horizon
lead: '跑着跑着模型不吐字了、上下文满了、进程被用户关掉了、同一个工具超时了三次——这些才是 Harness 工程师每天面对的东西。它们有个共同特点：都不是「模型不够聪明」，而是「系统没设计好」。这一章处理的就是这类问题，也是「工程问题」与「研究问题」的分水岭。'
note: '本章是全站最贴近真实面试考点的一章。如果你只能读完一章然后去面试，读这一章。'
---

<p class="dropcap">先建立一个分类标准。当一个 Agent 出问题时，你要能在三秒内判断它属于哪一类：</p>

<div class="tbl-wrap">
  <table class="news">
    <caption>问题分类（这张表决定了你答题的类型是否错位）</caption>
    <thead><tr><th>类别</th><th>典型问题</th><th>该怎么解</th><th>归属</th></tr></thead>
    <tbody>
      <tr><td><b>工程问题</b></td><td>流式响应卡死、上下文窗口超限、进程中断后无法恢复、工具超时后状态不一致</td><td>检测 + 状态机 + 检查点 + 幂等，全是确定性的系统设计</td><td><b>Harness</b></td></tr>
      <tr><td><b>产品问题</b></td><td>用户不知道该问什么、产物格式不满足要求、权限申请流程太长</td><td>交互设计、默认值、引导</td><td>产品</td></tr>
      <tr><td><b>研究问题</b></td><td>模型推理能力不足、幻觉、长链任务中目标漂移、指令跟随不稳</td><td>训练、数据、结构改进</td><td>模型团队</td></tr>
    </tbody>
  </table>
</div>

<div class="box box-warn">
  <span class="box-title">一个真实且昂贵的教训</span>
  <p>有位候选人面试某大模型公司的 Harness 岗，一面通过，二面落选。原因是他被问「做 Agent 遇到过哪些工程挑战」时，答的是 <b>long-horizon 能力不足</b>和<b>减少幻觉</b>。面试官的评价是：<b>「这些都是研究问题，不是工程问题。」</b></p>
  <p>他后来才想明白对方想听的是什么：<b>换 provider 的成本与兼容、模型输出卡死后怎么自动恢复、上下文窗口满了怎么自动压缩。</b></p>
  <p>这三个答案有共同特征——它们都是<b>「不管模型多聪明都会发生，而且只能靠系统设计解决」</b>的问题。答研究问题不会让你显得不懂技术，但会让你显得<b>没在真实的系统里干过活</b>。</p>
</div>

## 一、流式卡死：最常见的线上事故

先说现象。[[long-horizon|长任务]] 在流式阶段最容易出的事故就是 [[streaming-stall|流式卡死]]：流式响应可能以多种方式「卡住」——完全没有数据返回；返回了几个 token 后停住；返回了内容但没有结束标记；连接还活着但服务端不吐字。检测它靠两个阈值：[[ttfb|首字节时延]]和 [[inter-chunk-timeout|字节间超时]]。

**这些现象背后是不同的原因，但处理策略可以统一。** 关键在于：你的 Harness 必须有一套与「模型是否合作」无关的检测与恢复机制。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 440" role="img" aria-label="流式卡死的检测信号、判定与恢复状态机">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">流式卡死：从检测到恢复</text>
      <!-- 检测信号 -->
      <rect x="16" y="38" width="308" height="150" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="30" y="58" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#9b2c2c">检测：三个独立的心跳信号</text>
      <text x="30" y="80" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">① 首字节超时（TTFB &gt; 30s）</text>
      <text x="30" y="96" font-family="ui-monospace, monospace" font-size="9.2" fill="#a49a8c">　说明请求可能都没被接住</text>
      <text x="30" y="118" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">② 字节间超时（&gt; 15s 无新 chunk）</text>
      <text x="30" y="134" font-family="ui-monospace, monospace" font-size="9.2" fill="#a49a8c">　说明生成中途停住（最常见）</text>
      <text x="30" y="156" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">③ 总时长超时（&gt; 上限）</text>
      <text x="30" y="172" font-family="ui-monospace, monospace" font-size="9.2" fill="#a49a8c">　兜底，防止缓慢但持续的消耗</text>
      <rect x="336" y="38" width="308" height="150" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <text x="350" y="58" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">判定：能不能安全重试</text>
      <text x="350" y="80" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">关键问题：已经收到的部分内容怎么办？</text>
      <text x="350" y="100" font-family="ui-monospace, monospace" font-size="9.2" fill="#2f6157">纯文本生成 → 丢弃部分内容，整段重试</text>
      <text x="350" y="116" font-family="ui-monospace, monospace" font-size="9.2" fill="#a49a8c">　（无损，最安全）</text>
      <text x="350" y="138" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">已发生副作用 → 不能整段重试！</text>
      <text x="350" y="154" font-family="ui-monospace, monospace" font-size="9.2" fill="#a49a8c">　必须靠幂等键判重，或改为断点续跑</text>
      <text x="350" y="176" font-family="ui-monospace, monospace" font-size="9.2" fill="#b8944b">重试次数上限：2-3 次，且要退避</text>
      <!-- 状态机 -->
      <rect x="16" y="202" width="628" height="150" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="30" y="222" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#2f6157">恢复：一张必须显式的状态机</text>
      <rect x="30" y="234" width="92" height="30" fill="#ffffff" stroke="#2f6157" stroke-width="1"/>
      <text x="76" y="253" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#2f6157">IDLE</text>
      <line x1="122" y1="249" x2="150" y2="249" stroke="#2f6157" stroke-width="1.2" marker-end="url(#ar8)"/>
      <defs>
        <marker id="ar8" markerWidth="9" markerHeight="9" refX="4" refY="1" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#2f6157"/>
        </marker>
      </defs>
      <rect x="152" y="234" width="104" height="30" fill="#ffffff" stroke="#2f6157" stroke-width="1"/>
      <text x="204" y="253" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#2f6157">STREAMING</text>
      <line x1="256" y1="249" x2="284" y2="249" stroke="#2f6157" stroke-width="1.2" marker-end="url(#ar8)"/>
      <rect x="286" y="234" width="104" height="30" fill="#ffffff" stroke="#2f6157" stroke-width="1"/>
      <text x="338" y="253" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#2f6157">VALIDATING</text>
      <line x1="390" y1="249" x2="418" y2="249" stroke="#2f6157" stroke-width="1.2" marker-end="url(#ar8)"/>
      <rect x="420" y="234" width="92" height="30" fill="#ffffff" stroke="#2f6157" stroke-width="1.3"/>
      <text x="466" y="253" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#2f6157">EXECUTING</text>
      <line x1="512" y1="249" x2="540" y2="249" stroke="#2f6157" stroke-width="1.2" marker-end="url(#ar8)"/>
      <rect x="540" y="234" width="90" height="30" fill="#d6e5de" stroke="#2f6157" stroke-width="1.3"/>
      <text x="585" y="253" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#2f6157">DONE</text>
      <!-- 失败转移 -->
      <line x1="204" y1="264" x2="204" y2="292" stroke="#9b2c2c" stroke-width="1.3" marker-end="url(#ar8r)"/>
      <defs>
        <marker id="ar8r" markerWidth="9" markerHeight="9" refX="4" refY="1" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#9b2c2c"/>
        </marker>
      </defs>
      <rect x="140" y="292" width="128" height="30" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="204" y="311" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#9b2c2c">RETRYING (≤3)</text>
      <line x1="300" y1="264" x2="300" y2="292" stroke="#9b2c2c" stroke-width="1.3" marker-end="url(#ar8r)"/>
      <rect x="286" y="292" width="110" height="30" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="341" y="311" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#9b2c2c">RECOVERING</text>
      <line x1="396" y1="264" x2="396" y2="292" stroke="#9b2c2c" stroke-width="1.3" marker-end="url(#ar8r)"/>
      <rect x="412" y="292" width="130" height="30" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="477" y="311" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#9b2c2c">FAILED_SAFE</text>
      <text x="30" y="344" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">RECOVERING 的含义：切换 provider / 降低输出长度 / 关闭流式 / 换更小或更大的模型 —— 先想办法把活干完，而不是立刻报错。</text>
      <!-- 原则 -->
      <rect x="16" y="364" width="628" height="62" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.3"/>
      <text x="30" y="384" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#1f1b16">两条铁律</text>
      <text x="30" y="402" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">① 所有网络调用都必须有超时 + 重试 + 退避，包括流式响应的「字节间超时」——只设总超时会让你在卡死上等满全程。</text>
      <text x="30" y="418" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">② 状态机必须持久化：进程重启后要能从检查点继续，而不是从头再来（甚至重复副作用）。</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　流式卡死的完整处理链。<b>最容易漏掉的是「字节间超时」</b>——只设总超时的实现在「服务端每 60 秒吐一个字」的情况下会一直等下去，看起来没超时，实际上任务永远不会完成。</figcaption>
</figure>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 300" role="img" aria-label="上下文分层：不可压缩区与可压缩区">
      <defs>
        <marker id="ar1" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">上下文分层：钉住不可压缩区</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">只压缩下半部分；上半部分只追加、不压缩，并放在最前（契合前缀稳定）</text>
      <rect x="16" y="54" width="628" height="110" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.4"/>
      <text x="30" y="74" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">不可压缩区（钉住，永不压缩）</text>
      <rect x="30" y="84" width="180" height="30" fill="#ffffff" stroke="#b8944b" stroke-width="1"/>
      <text x="120" y="104" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#1f1b16">原始任务目标</text>
      <rect x="226" y="84" width="200" height="30" fill="#ffffff" stroke="#b8944b" stroke-width="1"/>
      <text x="326" y="104" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#1f1b16">用户明确约束（如口径）</text>
      <rect x="442" y="84" width="180" height="30" fill="#ffffff" stroke="#b8944b" stroke-width="1"/>
      <text x="532" y="104" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#1f1b16">已确认关键结论</text>
      <text x="30" y="146" font-family="ui-monospace, monospace" font-size="8.8" fill="#8a6a1e">放在最前 → 前缀稳定，缓存命中率高；且不会被后续压缩吞掉</text>
      <rect x="16" y="172" width="628" height="100" fill="#eef4f1" stroke="#2f6157" stroke-width="1.4"/>
      <text x="30" y="192" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#2f6157">可压缩区（过程性内容）</text>
      <rect x="30" y="200" width="180" height="26" fill="#ffffff" stroke="#2f6157" stroke-width="1"/>
      <text x="120" y="218" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.4" fill="#6b6257">旧步骤摘要</text>
      <rect x="226" y="200" width="180" height="26" fill="#ffffff" stroke="#2f6157" stroke-width="1"/>
      <text x="316" y="218" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.4" fill="#6b6257">超长观测裁剪</text>
      <rect x="422" y="200" width="200" height="26" fill="#ffffff" stroke="#2f6157" stroke-width="1"/>
      <text x="522" y="218" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.4" fill="#6b6257">最近几轮原文</text>
      <text x="30" y="252" font-family="ui-monospace, monospace" font-size="8.8" fill="#2f6157">这一步可被单条裁剪 / 摘要 / 钉住 三步自动压缩</text>
      <path d="M600,222 C620,222 620,150 600,150" fill="none" stroke="#9b2c2c" stroke-width="1.2" stroke-dasharray="3 2" marker-end="url(#ar1)"/>
      <text x="470" y="150" font-family="ui-monospace, monospace" font-size="8.4" fill="#9b2c2c">压缩只作用于此</text>
    </svg>
  </div>
  <figcaption><b>图 2</b>　压缩最常犯的错误是<b>把关键约束与结论一起压掉</b>。解法是分层：不可压缩区（目标 / 约束 / 已确认结论）只追加、放最前；可压缩区才被裁剪与摘要。</figcaption>
</figure>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 260" role="img" aria-label="软超时与硬超时的触发时机与对应动作">
      <defs>
        <marker id="ar2" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">软超时 vs 硬超时</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">软超时触发降级，硬超时才判定失败并返回部分结果</text>
      <line x1="60" y1="110" x2="610" y2="110" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar2)"/>
      <text x="612" y="114" text-anchor="end" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">时间 →</text>
      <circle cx="80" cy="110" r="4" fill="#1f1b16"/>
      <text x="80" y="132" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">开始</text>
      <line x1="260" y1="110" x2="260" y2="80" stroke="#8a6a1e" stroke-width="1.2"/>
      <circle cx="260" cy="110" r="4" fill="#8a6a1e"/>
      <text x="260" y="74" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" font-weight="700" fill="#8a6a1e">软超时</text>
      <rect x="150" y="140" width="220" height="40" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="260" y="158" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#1f1b16">降级：缩小输出 / 跳可选步</text>
      <text x="260" y="172" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#8a6a1e">任务继续，不失败</text>
      <line x1="500" y1="110" x2="500" y2="80" stroke="#9b2c2c" stroke-width="1.2"/>
      <circle cx="500" cy="110" r="4" fill="#9b2c2c"/>
      <text x="500" y="74" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" font-weight="700" fill="#9b2c2c">硬超时</text>
      <rect x="390" y="140" width="220" height="40" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.2"/>
      <text x="500" y="158" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#1f1b16">判定失败，返回部分结果</text>
      <text x="500" y="172" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#9b2c2c">只有硬超时导致失败</text>
      <rect x="16" y="200" width="628" height="44" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="30" y="220" font-family="Georgia, serif" font-size="10.5" font-weight="700" fill="#1f1b16">判据</text>
      <text x="30" y="236" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">软/硬阈值按「用户耐心」与「预算上限」分别设；恢复策略：切 provider / 降长度 / 关流式 / 换模型。</text>
    </svg>
  </div>
  <figcaption><b>图 3</b>　把超时拆成两级：<b>软超时触发降级（任务不失败），硬超时才返回部分结果</b>。只设一个总超时会让「缓慢但持续吐字」的卡死永远等不到边界。</figcaption>
</figure>

## 二、上下文自动压缩：让长任务能跑完

第 4 章讲了压缩策略，这里讲**怎么把它做成一个自动机制**，因为手动触发在长任务里不现实。这套机制的核心是 [[context-compaction|上下文自动压缩]]，而最关键的一步是 [[pinned-conclusion|结论钉住]]——把不可丢失的结论排除在压缩之外。

```python title="auto_compact.py"
import hashlib, json
from dataclasses import dataclass, field
@dataclass
class CompactionPolicy:
    window: int = 128_000
    trigger_ratio: float = 0.60      # 到 60% 就开始压，留出余量
    keep_recent_turns: int = 4       # 最近几轮原样保留
    max_single_obs_ratio: float = 0.10   # 单条工具结果不得超过窗口的 10%
    summarize: object = None         # 注入的摘要函数（调用模型）
@dataclass
class Step:
    turn: int
    tool: str
    status: str
    brief: str                       # 该步的一句话说明
    result_fingerprint: str          # 结果指纹，用于判重与去噪
    full_output: str | None = None   # 完整输出：压缩后丢弃，只留摘要
def estimate_tokens(messages: list[dict]) -> int:
    """粗略估算。生产环境请用真实 tokenizer，这里按字符数近似"""
    return sum(len(str(m.get("content", ""))) for m in messages) // 2
def trim_single_observation(obs: str, limit_chars: int) -> str:
    """
    单条超长结果的头尾保留裁剪。
    关键：必须显式标注省略了多少，否则模型会以为这就是全部内容。
    """
    if len(obs) <= limit_chars:
        return obs
    head = obs[: int(limit_chars * 0.6)]
    tail = obs[-int(limit_chars * 0.3):]
    omitted = len(obs) - len(head) - len(tail)
    return f"{head}\n……[此处省略 {omitted} 字符]……\n{tail}"
def compact(messages: list[dict], steps: list[Step], policy: CompactionPolicy) -> tuple[list[dict], str]:
    """
    返回 (压缩后的消息列表, 压缩事件说明)。
    三件事按顺序做：单条裁剪 → 旧步骤摘要 → 结论固化到头部。
    """
    events = []
    # ---- 第一步：单条超长结果裁剪（成本最低，先做） ----
    limit = int(policy.window * policy.max_single_obs_ratio * 2)   # 字符数近似
    for m in messages:
        if m.get("role") == "tool" and len(str(m.get("content", ""))) > limit:
            before = len(str(m["content"]))
            m["content"] = trim_single_observation(str(m["content"]), limit)
            events.append(f"裁剪单条工具结果 {before}→{limit} 字符")
    # ---- 第二步：用量仍超阈值，则摘要旧步骤 ----
    if estimate_tokens(messages) > policy.window * policy.trigger_ratio:
        old = steps[:-policy.keep_recent_turns] if len(steps) > policy.keep_recent_turns else []
        if old:
            summary = structured_summary(old, policy.summarize)
            # 用摘要替换掉旧的具体消息，但保留最近几轮原文
            kept = messages[:3] + [{"role": "user", "content": f"【已完成步骤摘要】\n{summary}"}]
            kept += messages[-(policy.keep_recent_turns * 2):]
            messages = kept
            events.append(f"摘要压缩 {len(old)} 个步骤，上下文降至 {estimate_tokens(messages)} token")
    # ---- 第三步：把不可丢失的结论固化到头部（防止被后续压缩丢掉） ----
    pinned = [s for s in steps if s.status == "ok" and s.brief]
    if pinned:
        digest = "；".join(f"{s.tool}:{s.brief}" for s in pinned[-10:])
        # 头部插入「钉住的事实」，这部分不再参与后续压缩
        messages.insert(2, {"role": "user", "content": f"【已确认的关键结论】{digest}"})
    return messages, "　|　".join(events) if events else "无需压缩"
def structured_summary(steps: list[Step], summarize_fn) -> str:
    """
    结构化摘要：固定四段。自由文本摘要会越摘越糊，
    而固定字段能保证「目标 / 已完成 / 结论 / 待办」都不丢。
    """
    done = [s for s in steps if s.status == "ok"]
    failed = [s for s in steps if s.status != "ok"]
    return (
        f"目标：见任务描述（未变更）\n"
        f"已完成（{len(done)}）：" + "；".join(f"{s.tool}→{s.brief}" for s in done) + "\n"
        f"失败/已放弃（{len(failed)}）：" + "；".join(f"{s.tool}→{s.status}" for s in failed) + "\n"
        f"待办：目标中尚未被任何步骤覆盖的部分"
    )
def fingerprint(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:12]
```



<div class="box box-key">
  <span class="box-title">压缩机制里最重要的一步是「钉住」</span>
  <p>压缩的常见失败方式是：把关键结论一起压掉了。跑了几十轮之后，模型忘了「用户一开始说要以 2025 年的口径为准」，于是后面的分析全部跑偏。</p>
  <p><b>解法是分层：把上下文分成「可压缩区」和「不可压缩区」。</b>不可压缩区放三类内容：原始任务目标、用户明确给出的约束、以及每一步确认过的关键结论。这个区域只追加、不压缩，并且放在最前面（顺带契合前缀稳定性原则）。</p>
</div>

### 2.1 压缩省 token，但可能把账单打贵

压缩看起来是「省钱」，但长任务里有一笔隐性账，第 2 章（`llm-02`）的缓存计费已经埋了伏笔，这里展开：

**压缩破坏前缀，前缀破坏缓存命中。** 长任务的每一轮，请求体都在「前缀 + 本轮新内容」上追加。如果某一轮在**前缀部分**做了压缩——把历史步骤重写成摘要、重新拼一遍消息——那么从改动处开始，整个前缀缓存作废，下一轮输入从「命中」变成「未命中」，单价可能翻数倍。

```python title="compaction_cost.py"
def compaction_cost_tradeoff(input_tokens: int, saved_tokens: int,
                             hit_price: float, miss_price: float) -> str:
    """
    压缩省了 saved_tokens 个 token，但若压缩发生在前缀部分，
    缓存从命中(hit)变成未命中(miss)，单价上涨。
    判断：省下的 token × 命中价  vs  重新计算的前缀 × (未命中价-命中价)。
    """
    saved_value = saved_tokens * hit_price
    # 最坏情况：整段前缀（压缩前的那部分）都要按未命中价重算
    prefix = input_tokens - saved_tokens
    extra_cost = prefix * (miss_price - hit_price)
    if extra_cost > saved_value:
        return f"得不偿失：省 {saved_tokens} token 值 {saved_value:.2f}，却多付 {extra_cost:.2f}"
    return f"值得：省 {saved_value:.2f}，多付 {extra_cost:.2f}"
```

三个可直接落地的结论：

- **压缩尽量只动「尾部」**：最近几轮原样保留、旧步骤摘要化——如果摘要改写的是**靠前**的历史，就把前缀打碎了。更稳的做法是把摘要追加在尾部，而不是回头改写旧消息。
- **压缩时机要「成批、少次」**：每轮都压一次 = 每轮都把前缀打碎一次，缓存永远命中不了。宁可攒到阈值一次性压，让两次压缩之间保持长段稳定前缀。
- **把「钉住区」放最前、永不重排**：这一节前面讲的「不可压缩区」之所以强调「只追加、放最前」，不止是为了不丢结论，也是为了**让这段稳定前缀始终可命中**——它一动，后面全废。

一句话：**压缩省的是「读的 token」，代价可能是「重算的 token」**。在判断要不要压、压哪里之前，先问一句「这会动到前缀吗」——这是长任务成本控制里最容易漏的一环。

## 三、崩溃恢复：检查点与幂等

长任务会跨越进程生命周期。用户会关窗口、机器会重启、部署会滚动更新。任务必须能在中断后接上——靠的是显式的 [[state-machine|状态机]] 与落盘的 [[checkpoint|检查点]]。

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>机制</th><th>做什么</th><th>关键细节</th></tr></thead>
    <tbody>
      <tr><td><b>检查点</b></td><td>每个步骤完成后持久化状态快照</td><td>快照要包含：已完成步骤、钉住的结论、待办队列、外部副作用记录</td></tr>
      <tr><td><b>幂等键</b></td><td>每个副作用操作带一个稳定标识</td><td>基于「任务 ID + 步骤序号」生成，恢复后重复执行会被识别并跳过</td></tr>
      <tr><td><b>恢复语义</b></td><td>定义「从哪继续」</td><td>只重放<b>未完成</b>的步骤；已完成步骤的结果从快照读取，不重新执行</td></tr>
      <tr><td><b>副作用日志</b></td><td>记录每个已发生的副作用</td><td>恢复时用它判断「这个操作到底做没做」，避免重复下单/重复发送</td></tr>
      <tr><td><b>版本校验</b></td><td>恢复前检查代码版本与工具集是否变更</td><td>工具签名变了就不该静默续跑，应提示用户或重新规划</td></tr>
    </tbody>
  </table>
</div>

```python title="checkpoint.py"
import json, os, time
from dataclasses import dataclass, asdict, field
STATE_DIR = os.environ.get("HT_STATE_DIR", "./.ht_state")
@dataclass
class Checkpoint:
    task_id: str
    goal: str                                  # 原始目标，永不压缩
    constraints: list[str]                     # 用户明确给出的约束，永不压缩
    pinned_conclusions: list[str]              # 已确认结论，只追加
    pending: list[str]                         # 待办
    side_effects: list[dict] = field(default_factory=list)  # 已发生的副作用
    version: int = 1
    updated_at: float = field(default_factory=time.time)
def save(cp: Checkpoint) -> None:
    """原子写：先写临时文件再重命名，避免中断导致快照损坏"""
    os.makedirs(STATE_DIR, exist_ok=True)
    path = os.path.join(STATE_DIR, f"{cp.task_id}.json")
    tmp = path + ".tmp"
    cp.updated_at = time.time()
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(asdict(cp), f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)          # 原子替换
def load(task_id: str) -> Checkpoint | None:
    path = os.path.join(STATE_DIR, f"{task_id}.json")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return Checkpoint(**json.load(f))
def idempotent_side_effect(cp: Checkpoint, step_no: int, action: str, run) -> dict:
    """
    所有副作用必须走这里。
    恢复后重复调用会命中 side_effects 记录，直接返回上次结果。
    """
    key = f"{cp.task_id}:{step_no}:{action}"
    for rec in cp.side_effects:
        if rec["key"] == key:
            return {"status": "already_done", "result": rec["result"]}
    result = run()
    cp.side_effects.append({"key": key, "action": action,
                            "result": result, "at": time.time()})
    save(cp)                    # 立即落盘：副作用发生后必须马上可查
    return {"status": "executed", "result": result}
def resume(task_id: str, current_tools: set[str]) -> tuple[Checkpoint, list[str]]:
    """
    恢复：只重放未完成步骤，并检查工具集是否变更。
    如果某个待办步骤依赖的工具已经不存在，必须显式报告而不是静默跳过。
    """
    cp = load(task_id)
    if cp is None:
        raise FileNotFoundError(f"没有找到任务 {task_id} 的检查点")
    problems = []
    for step in list(cp.pending):
        tool = step.split("::")[0] if "::" in step else step
        if tool not in current_tools:
            problems.append(f"待办步骤依赖的工具 {tool} 已不可用，需重新规划：{step}")
    return cp, problems
```



## 四、三个常被忽略的稳定性问题

**第一，[[provider-abstraction|provider 适配层]]。** 不要假设只有一个模型供应商。做到两点：把所有调用收敛到一个适配层（换 provider 只改一处）；并且用「能力探测」而不是「硬编码模型名」来决定用哪个模型（例如不支持工具调用的模型要自动降级为纯文本模式）。

**第二，输出解析的宽容度。** 模型可能返回带 Markdown 代码块包裹的 JSON、尾随逗号、单引号、注释。**解析器要能容忍这些常见变体**，而不是直接抛异常。宽容解析 + 严格校验的组合，比严格解析 + 宽容校验有效得多。

**第三，时间与预算的耦合。** 用户的等待耐心和你的预算上限不是同一件事。建议分别设：[[soft-hard-timeout|软超时与硬超时]]——**软超时**触发降级策略（缩小输出规模、跳过可选步骤），**硬超时**才直接返回部分结果并判定失败。只有硬超时会导致任务失败。

## 五、常见误区与追问

### 5.1 误区：任务跑不动就怪模型 long-horizon 能力不足
面试里最贵的教训：把工程问题答成研究问题。模型推理不足、幻觉、目标漂移是研究问题，得靠训练与数据；而换 provider 的成本、流式卡死恢复、上下文自动压缩是「不管模型多聪明都会发生、只能靠系统设计」的工程问题。判据：这个问题是否「换了更强的模型就消失」？会消失的是研究问题，不会的是工程问题。

### 5.2 误区：只设总响应超时就够了
总超时测的是「总时长」，而卡死的特征往往是「长时间没有新数据」。服务端每 60 秒吐一个字，总超时永远不触发，任务实际已死。必须同时设首字节时延（TTFB）与字节间超时两个独立阈值。数字上可以这样定：TTFB 30–60 秒、字节间 10–20 秒、总时长按用户耐心上限（如 5 分钟），三者独立触发，触发后的动作也不同——前两级中断后重试，第三级直接返回部分结果。

### 5.3 误区：上下文压缩就是截断
直接丢掉最早的 token，会把用户最初给的约束、已确认的关键结论一起删掉，后续推理整体跑偏。正确做法是上下文自动压缩配合分层与结论钉住：不可压缩区只追加、放最前。判据：压缩完成后回查三样东西还在不在——原始任务目标、用户明确给出的约束、已确认的关键结论；少任意一样，这次压缩就是在制造跑偏。

### 5.4 误区：崩溃后从头重跑最稳
从头重跑会重复执行已产生副作用的步骤（重复发邮件、重复下单）。正确做法是检查点加幂等键：只重放未完成步骤，已发生的副作用通过幂等键识别并跳过。判据：恢复前先查副作用日志，给每个待执行步骤算一次幂等键（任务 ID + 步骤序号），命中记录就跳过——做不到这一步，「重跑」就是重复下单。

### 5.5 误区：工具调用值得无限重试
已发生副作用的调用不能整段重试，否则重复下单。判据：重试次数上限 2–3 次且退避；已发生副作用时必须靠幂等键判重或改为断点续跑。数字上超过 2–3 次往往就不是网络抖动了，而是输入或工具本身有问题，继续重试只是把预算烧光，应该转人工或换方案。

### 5.6 误区：provider 写死模型名无所谓
硬编码模型名，换供应商就要改代码、重测、可能回归。正确做法是收敛到 provider 适配层，并用「能力探测」而非模型名决定走哪条路径（不支持工具调用的模型自动降级纯文本）。判据：在业务代码里搜一遍模型名与端点，出现即说明适配层没做——正确形态是业务代码只表达「要什么能力」，由适配层决定用哪个模型、走哪条路径。

## 六、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>本章三题全部为真实面试高频题</span></div>
  <div class="q-item" data-qid="harness08-q1" data-answer="2">
    <div class="q-text"><span class="idx">Q1</span>只设置「总响应超时」有什么问题？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>没有问题，总超时已经足够</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>会让 token 消耗变多</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>服务端缓慢持续吐字（如每 60 秒一个字符）时完全不会触发，任务实际已经卡死但系统仍在等待</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>会导致前缀缓存失效</span></button>
    <div class="explain"><b>C。</b>这是流式处理必须知道的一条：<b>总超时测的是「总时长」，而卡死的特征往往是「长时间没有任何新数据」。</b>所以必须同时设 TTFB 超时和<b>字节间超时</b>（inter-chunk timeout）。这个细节能答出来，基本能确认你真的写流式处理代码。</div>
  </div>
  <div class="q-item" data-qid="harness08-q2" data-answer="1">
    <div class="q-text"><span class="idx">Q2</span>上下文自动压缩最容易出问题的地方是？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>压缩本身要花钱</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>把关键约束与结论一起压掉，导致模型忘记原始目标与口径，后续推理整体跑偏</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>压缩后上下文变短，模型会不适应</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>压缩会导致前缀缓存全部失效（这确实是代价，但可控）</span></button>
    <div class="explain"><b>B。</b>D 确实是一种代价（压缩会改前缀），但可以通过「把不可压缩区放最前、只压后续内容」来缓解。真正的伤害是信息丢失：<b>解法是上下文分层——不可压缩区（原始目标、用户约束、已确认结论）+ 可压缩区（过程性内容）</b>。</div>
  </div>
  <div class="q-item" data-qid="harness08-q3" data-answer="3">
    <div class="q-text"><span class="idx">Q3</span>长任务中断后恢复，最重要的设计是什么？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>把整个对话历史存下来，恢复时全部重放</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>从头重新执行一遍，保证一致性</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>把模型换成支持更长上下文的，减少中断概率</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>检查点 + 幂等键：只重放未完成步骤，已发生的副作用通过幂等键识别并跳过，避免重复执行</span></button>
    <div class="explain"><b>D。</b>A 的问题是重放会重复执行已产生副作用的步骤（比如重复发邮件）；B 更糟，等于重复所有副作用。C 是回避问题而非解决问题。<b>正确思路：状态快照（记录已完成与副作用）+ 幂等键（让重复执行可被识别）</b>——这两件事必须同时有，缺一不可。</div>
  </div>
</div>

## 七、小结

| 问题 | 工程解法 | 关键细节 |
| --- | --- | --- |
| 流式卡死 | TTFB 超时 + 字节间超时 + 总超时，三级独立 | 只设总超时无法检测「缓慢但持续」的卡死 |
| 输出不完整 | 状态机 + 有限重试 + 退避 | 已发生副作用时不能整段重试 |
| 上下文超限 | 自动压缩：单条裁剪 → 旧步骤摘要 → 结论钉住 | 上下文要分层，不可压缩区放最前 |
| 进程中断 | 检查点 + 幂等键 + 副作用日志 | 幂等键必须稳定（基于任务 ID + 步骤序号） |
| provider 变更 | 适配层 + 能力探测 | 不要硬编码模型名 |
| 解析失败 | 宽容解析 + 严格校验 | 兼容代码块包裹、尾随逗号等常见变体 |

<p class="pull-quote">「换 provider、卡死恢复、上下文压缩」这三个答案之所以被面试官认可，是因为它们都满足同一个条件：不管模型多聪明，这些问题都会发生，而且只能靠系统设计解决。<cite>本刊编辑部</cite></p>

Harness 工程部分到此结束。接下来进入一个更少人认真做、也更能体现系统思维的部分：怎么证明你的改动真的让系统变好了。

## 八、参考与延伸

本章的机制部分只讲到「够用」为止。想往下深挖，下面这几份材料按「先看图、再看代码、最后读规范」的顺序排好了。全站不做原文转载，这里只登记链接与「为什么值得读」。

**先看图（建立直觉）**

- [Simon Willison · LLM notes](https://simonwillison.net/) —— 大量「长任务跑飞 / 流式中断 / 工具超时」的真实记录。<strong>翻他的 agent 与 tool-use 标签，能建立「工程问题 vs 研究问题」的直觉。</strong>

**再看代码（动手实现）**

- [SWE-bench](https://github.com/SWE-bench/SWE-bench) —— 长任务 Agent 的评测基座。<strong>看它的任务分片与重放机制，理解「为什么需要检查点与可恢复」。</strong>
- [τ-bench](https://github.com/sierra-research/tau-bench) —— 多步工具调用可靠性的评测。<strong>它的「用户中途介入」设定，正是本章人工确认 / 状态机要解决的问题。</strong>

**最后读规范（对齐一手定义）**

- [Anthropic · Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) —— 官方对长任务编排的建议。<strong>它把「流式、工具、恢复」当成一等公民，和本章的超时三级、检查点直接对应。</strong>
- [OpenAI Platform 文档](https://platform.openai.com/docs/overview) —— 模型调用的官方能力说明。<strong>看它怎么描述流式、函数调用与超时，作为把本章机制落地的依据。</strong>
