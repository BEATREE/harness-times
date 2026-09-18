---
chapter: eval-05-trace-loop
lead: '出了问题查不到原因，是因为没有 trace；改了一版不敢上线，是因为没有 replay。这一章把「线上 badcase → 评测集 → 回归门禁 → 灰度发布」这条闭环接起来。接上之后，评测才从一份报告变成一套能挡住问题的机制。'
note: '本章是全站最有「系统感」的一章。面试里讲清这条闭环，等于证明你做过完整的质量工程，而不只是写过评测脚本。'
---

<p class="dropcap">前面四章分别解决了「评什么维度」「用哪些样本」「指标怎么算」「机器打分怎么可信」。但还有一个更根本的问题：这套东西怎么才能<b>真的挡住</b>问题，而不是变成每季度产出一份没人看的报告。</p>

## 一、闭环的五个环节

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 420" role="img" aria-label="从线上trace到灰度发布的评测闭环">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">质量闭环：五个环节，一个都不能断</text>
      <!-- 环节 1 -->
      <rect x="16" y="40" width="196" height="104" fill="#eef4f1" stroke="#2f6157" stroke-width="1.4"/>
      <text x="28" y="60" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#2f6157">① Trace　全链路记录</text>
      <text x="28" y="80" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">每次请求记录：</text>
      <text x="28" y="95" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">· 完整上下文（脱敏后）</text>
      <text x="28" y="110" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">· 每次工具调用的参数与返回</text>
      <text x="28" y="125" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">· token 数、延迟、重试次数</text>
      <text x="28" y="139" font-family="ui-monospace, monospace" font-size="8.8" fill="#2f6157">要求：能完整重放（replay）</text>
      <!-- 环节 2 -->
      <rect x="232" y="40" width="196" height="104" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.4"/>
      <text x="244" y="60" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#8a6a1e">② 归因　定位到具体环节</text>
      <text x="244" y="80" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">按环节切分失败原因：</text>
      <text x="244" y="95" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">· 理解错（意图识别）</text>
      <text x="244" y="110" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">· 选错工具 / 填错参数</text>
      <text x="244" y="125" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">· 工具本身故障 / 数据问题</text>
      <text x="244" y="139" font-family="ui-monospace, monospace" font-size="8.8" fill="#b8944b">产出：归因分布，而非「失败率」</text>
      <!-- 环节 3 -->
      <rect x="448" y="40" width="196" height="104" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.4"/>
      <text x="460" y="60" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#9b2c2c">③ 入集　沉淀为回归样本</text>
      <text x="460" y="80" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">只纳入「工程问题」类：</text>
      <text x="460" y="95" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">· 标注期望行为</text>
      <text x="460" y="110" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">· 写明加入原因与来源</text>
      <text x="460" y="125" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">· 研究类问题单独归档</text>
      <text x="460" y="139" font-family="ui-monospace, monospace" font-size="8.8" fill="#9b2c2c">否则回归集永远修不完</text>
      <!-- 箭头 -->
      <line x1="212" y1="92" x2="228" y2="92" stroke="#1f1b16" stroke-width="1.4" marker-end="url(#ar9)"/>
      <line x1="428" y1="92" x2="444" y2="92" stroke="#1f1b16" stroke-width="1.4" marker-end="url(#ar9)"/>
      <defs>
        <marker id="ar9" markerWidth="9" markerHeight="9" refX="4" refY="1" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <!-- 环节 4 -->
      <rect x="16" y="168" width="300" height="104" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.4"/>
      <text x="28" y="188" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#1f1b16">④ 门禁　把评测接进 CI</text>
      <text x="28" y="208" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">提交前（每次 PR，2 分钟内必须跑完）：</text>
      <text x="28" y="224" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">· 冒烟集 100% 通过（硬性）</text>
      <text x="28" y="239" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">· 关键单测（解析器、错误分类）</text>
      <text x="28" y="256" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">发版前：</text>
      <text x="28" y="270" font-family="ui-monospace, monospace" font-size="8.8" fill="#1f1b16">· 回归集不得低于基线；保留池结果作为决策依据</text>
      <!-- 环节 5 -->
      <rect x="336" y="168" width="308" height="104" fill="#eef4f1" stroke="#2f6157" stroke-width="1.4"/>
      <text x="348" y="188" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#2f6157">⑤ 灰度　用小流量验证真实分布</text>
      <text x="348" y="208" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">1% → 5% → 20% → 全量，每个档位观察：</text>
      <text x="348" y="224" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">· 任务完成率、平均轮数、成本 / 次</text>
      <text x="348" y="239" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">· 用户主动重试率、中断率（最有价值的负向信号）</text>
      <text x="348" y="256" font-family="ui-monospace, monospace" font-size="8.8" fill="#2f6157">回滚条件要事先写死，不能临时决定</text>
      <text x="348" y="270" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">· 例：完成率跌幅 &gt; 3pct 或成本涨幅 &gt; 20% → 立即回滚</text>
      <!-- 回环 -->
      <line x1="336" y1="220" x2="322" y2="220" stroke="#2f6157" stroke-width="1.4" marker-end="url(#ar9g)"/>
      <defs>
        <marker id="ar9g" markerWidth="9" markerHeight="9" refX="4" refY="1" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#2f6157"/>
        </marker>
      </defs>
      <line x1="166" y1="272" x2="166" y2="300" stroke="#1f1b16" stroke-width="1.4"/>
      <line x1="166" y1="300" x2="546" y2="300" stroke="#1f1b16" stroke-width="1.4"/>
      <line x1="546" y1="300" x2="546" y2="150" stroke="#1f1b16" stroke-width="1.4" marker-end="url(#ar9)"/>
      <text x="356" y="316" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">灰度中发现的新 badcase 回到 ① Trace —— 闭环成立</text>
      <!-- 断链警示 -->
      <rect x="16" y="334" width="628" height="76" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="30" y="354" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#9b2c2c">闭环断在哪，问题就出在哪</text>
      <text x="30" y="374" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">断在 ① → 出了问题只能靠猜（最常见，也最致命）</text>
      <text x="30" y="390" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">断在 ② → 知道有多少失败，但不知道该改哪一层，改进靠碰运气</text>
      <text x="30" y="405" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">断在 ③ → 修过的问题反复出现（回归集没长起来）</text>
      <text x="30" y="418" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">断在 ④ → 评测只是一份报告，不构成约束力</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　评测闭环的五个环节。<b>最容易断的是 ① 和 ④</b>：没有可重放的 trace，一切归因都是猜；评测没接进 CI，它就没有约束力，改动照样能合进去。</figcaption>
</figure>

这五个环节各自解决一个具体问题：[[trace|全链路 Trace]] 让失败可复现，[[attribution|归因]] 把失败落到具体环节，入集把一次性问题变成永久约束，[[regression-gate|回归门禁]] 让评测拥有否决权，[[canary-release|灰度发布]] 用小流量在真实分布上做最后一次验证。断掉任何一个，后面的环节都会退化——这正是「明明做了评测，线上却还在出同样的问题」的最常见原因。

## 二、Trace 的设计：为「重放」而记录

Trace 的价值不是「记录发生了什么」，而是「能在本地[[replay|重放]]当时发生了什么」。这个区别决定了你要记录什么。

<div class="tbl-wrap">
  <table class="news">
    <caption>Trace 必须记录的七类字段（按重要性排序）</caption>
    <thead><tr><th>#</th><th>字段</th><th>为什么必须</th></tr></thead>
    <tbody>
      <tr><td>1</td><td><b>完整的请求体（脱敏后）</b></td><td>没有它就无法重放。这是 trace 的核心，其余都是辅助</td></tr>
      <tr><td>2</td><td>模型与版本标识</td><td>换模型/换版本后的行为差异只有对比才能发现</td></tr>
      <tr><td>3</td><td>每次工具调用的名称、参数、返回、耗时</td><td>归因的最主要依据——多数失败发生在工具环节</td></tr>
      <tr><td>4</td><td>上下文各部分的大小（指令/知识/状态各占多少）</td><td>定位「上下文膨胀」类问题的唯一手段</td></tr>
      <tr><td>5</td><td>重试与失败的完整序列（含错误分类）</td><td>区分「一次就对」与「重试三次才对」——后者是隐患</td></tr>
      <tr><td>6</td><td>关键时间戳（TTFB、每次 chunk、总时长）</td><td>定位卡死与性能问题的唯一依据</td></tr>
      <tr><td>7</td><td>用户后续行为（是否重试、是否中断、是否手动修正）</td><td><b>这是最强的质量信号</b>——用户用脚投票比任何评分都真实</td></tr>
    </tbody>
  </table>
</div>

<div class="box box-key">
  <span class="box-title">第 7 项被严重低估</span>
  <p>「用户重试率」和「用户中断率」是最接近真相的质量指标。原因很简单：<b>模型评分再准也只是代理指标，用户行为是真实结果。</b>一个完成率 90% 但用户重试率 30% 的系统，实际体验远差于完成率 85%、重试率 8% 的系统。</p>
  <p>建议把这两个信号当作一等指标，与完成率并列观察。它们还能自动帮你挖掘 badcase——所有重试请求的原始 trace，就是一份高质量的问题样本来源。</p>
</div>

这两个信号值得单独说清楚。[[user-retry-rate|用户重试率]] 是「同一件事被问第二次」的比例，[[user-abort-rate|用户中断率]] 是中途放弃的比例；它们比任何离线评分都更接近真相，而且天然自带 badcase 挖掘功能——每一次重试都意味着上一次输出没被接受。

## 三、动手：Trace 与重放

```python title="trace_replay.py"
import json, time, hashlib
from dataclasses import dataclass, field, asdict
@dataclass
class ToolCall:
    turn: int
    name: str
    args: dict
    status: str                     # ok | empty | bad_args | timeout | ...
    duration_ms: int
    result_digest: str              # 结果指纹，而不是全文（全文另存）
@dataclass
class Trace:
    trace_id: str
    started_at: float
    model: str
    request_body: dict              # 脱敏后的完整请求体 —— 重放的依据
    tool_calls: list[ToolCall] = field(default_factory=list)
    context_sizes: dict = field(default_factory=dict)   # {"instructions":1200,...}
    ttfb_ms: int | None = None
    total_ms: int = 0
    retries: list[dict] = field(default_factory=list)
    outcome: str = "unknown"        # done | budget_exhausted | failed | need_human
    user_signal: str = "none"       # none | retried | aborted | corrected
    def to_json(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=False)
def trace_id_for(request_body: dict, model: str) -> str:
    """
    trace id 用「请求内容 + 模型」派生。
    好处：同一个输入重复出现时能自动聚类，便于统计高频问题。
    """
    key = json.dumps(request_body, sort_keys=True, ensure_ascii=False) + model
    return hashlib.sha256(key.encode()).hexdigest()[:16]
def replay(trace: Trace, run_once) -> dict:
    """
    重放：用当时的请求体重新跑一遍，对比结果差异。
    这是「改了代码到底有没有改善」的最直接验证方式。
    """
    result = run_once(trace.request_body)          # 用同一份请求体
    diffs = {
        "outcome_changed": result.get("outcome") != trace.outcome,
        "tool_call_count": (len(result.get("tool_calls", [])), len(trace.tool_calls)),
        "retry_count": (len(result.get("retries", [])), len(trace.retries)),
        "latency_ms": (result.get("total_ms"), trace.total_ms),
    }
    return {"trace_id": trace.trace_id, "improved": not diffs["outcome_changed"]
            or result.get("outcome") == "done", "diffs": diffs}
def classify_failure(trace: Trace) -> str:
    """
    归因：把一次失败定位到具体环节。
    这一段逻辑是「评测报告」与「评测工具」的分界线 ——
    有归因，报告才能直接变成改动清单。
    """
    if trace.outcome == "budget_exhausted":
        if trace.context_sizes.get("state", 0) > 0.6 * sum(trace.context_sizes.values()):
            return "上下文膨胀：状态占比过高，需要加强压缩或状态外置"
        return "轮数/预算上限不足，或陷入无进展循环（检查调用签名重复度）"
    bad = [c for c in trace.tool_calls if c.status == "bad_args"]
    if bad:
        return f"参数错误（{len(bad)} 次）：检查工具描述与参数约束"
    to = [c for c in trace.tool_calls if c.status == "timeout"]
    if to:
        return f"工具超时（{len(to)} 次）：检查超时设置与退避策略"
    if trace.retries:
        return f"重试 {len(trace.retries)} 次后成功：属隐患，应查清根因"
    if trace.ttfb_ms and trace.ttfb_ms > 15000:
        return "首字节延迟过高：可能需要换 provider 或降级流式"
    return "未归因：需要人工查看 trace"
def attribution_report(traces: list[Trace]) -> dict:
    """归因分布：这份报告比「失败率 12%」有用得多"""
    from collections import Counter
    failed = [t for t in traces if t.outcome != "done"]
    reasons = Counter(classify_failure(t) for t in failed)
    return {
        "total": len(traces),
        "failed": len(failed),
        "failure_rate": len(failed) / len(traces) if traces else 0,
        "by_reason": reasons.most_common(),
        "user_retry_rate": sum(1 for t in traces if t.user_signal == "retried") / len(traces)
                           if traces else 0,
    }
```



重放的产出不是「这次跑通了」，而是一份按环节切分的 [[attribution-report|归因分布]]——参数错占几成、工具超时占几成、上下文膨胀占几成。这份分布才是后续改动的优先级清单：它把「失败率 12%」这个没有信息量的数字，换成了「本周该先修哪一层」。

## 四、回归门禁：让评测有约束力

这是闭环里最容易被省略、也最关键的一环。没有门禁的评测只是报告。

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>阶段</th><th>跑什么</th><th>耗时预算</th><th>不通过的后果</th></tr></thead>
    <tbody>
      <tr><td>本地提交前</td><td>解析器与错误分类的单元测试</td><td>&lt; 10 秒</td><td>开发者自己发现问题，不浪费 CI 资源</td></tr>
      <tr><td>PR 创建后</td><td>冒烟集（10-20 条）+ 静态检查</td><td>&lt; 2 分钟</td><td><b>阻塞合并</b>——没有例外</td></tr>
      <tr><td>合并到主分支后</td><td>回归集 + 边界集</td><td>&lt; 15 分钟</td><td>产生告警，并自动创建 issue</td></tr>
      <tr><td>发版候选</td><td>回归 + 边界 + 对抗 + 保留池</td><td>可到 1 小时</td><td><b>阻塞发布</b>；主指标回归必须人工确认才能放行</td></tr>
      <tr><td>上线后</td><td>线上指标监控（完成率、重试率、成本）</td><td>持续</td><td>触发回滚条件则自动回滚</td></tr>
    </tbody>
  </table>
</div>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 420" role="img" aria-label="回归门禁的四层结构：越频繁跑的层越轻、越接近发版的层越严">
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">门禁分层：越频繁跑的层越轻</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">从下往上看——跑的频率越来越低，门槛越来越严，代价只花在少数几次上</text>
      <rect x="180" y="58" width="300" height="56" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="330" y="82" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.4" font-weight="700" fill="#9b2c2c">④ 发版候选　覆盖：回归 + 边界 + 对抗 + 保留池</text>
      <text x="330" y="102" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">≤ 1 小时　不通过则阻塞发布（主指标回归须人工确认）</text>
      <rect x="145" y="122" width="370" height="56" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <text x="330" y="146" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.4" font-weight="700" fill="#8a6a1e">③ 合并到主分支后　覆盖：回归集 + 边界集</text>
      <text x="330" y="166" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">≤ 15 分钟　产生告警并自动创建 issue，不阻塞合并</text>
      <rect x="110" y="186" width="440" height="56" fill="#eef1f7" stroke="#345a75" stroke-width="1.3"/>
      <text x="330" y="210" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.4" font-weight="700" fill="#345a75">② PR 创建后　覆盖：冒烟集 10-20 条 + 静态检查</text>
      <text x="330" y="230" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">≤ 2 分钟　不通过则阻塞合并，没有例外</text>
      <rect x="75" y="250" width="510" height="56" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="330" y="274" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10.4" font-weight="700" fill="#2f6157">① 本地提交前　覆盖：解析器与错误分类的单元测试</text>
      <text x="330" y="294" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">≤ 10 秒　开发者自己发现问题，不占用 CI 资源</text>
      <rect x="16" y="318" width="628" height="88" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="30" y="340" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#9b2c2c">门槛的高度，决定它是被遵守还是被绕过</text>
      <text x="30" y="360" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">任何一层只要耗时超过开发者能忍受的阈值，团队就会加 skip-eval 标签绕过它——门禁一旦可以被绕过，等于没有。</text>
      <text x="30" y="380" font-family="ui-monospace, monospace" font-size="9.6" fill="#2f6157">所以严格性必须与频率成反比：越频繁跑的层越轻（秒级），越接近发版的层越重（小时级）。</text>
      <text x="30" y="396" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">不允许下降的分层指标（尤其是对抗集）要写进配置，而不是靠人记得。</text>
    </svg>
  </div>
  <figcaption><b>图 2</b>　门禁的四层结构：越靠下越频繁、越轻；越靠上越严格、越贵。判据是<b>「这一层跑一次要多久，会不会让人想绕开」</b>——把全量评测压在 PR 阶段，换来的一定是 skip-eval 标签，而不是更好的质量。</figcaption>
</figure>

<div class="box box-warn">
  <span class="box-title">门禁设计的两个坑</span>
  <p><b>坑一：把门槛设得太高，导致人人都想办法绕过它。</b>如果 PR 阶段要跑 40 分钟，团队很快就会加 <code>skip-eval</code> 标签。正确做法是<b>分层：PR 只跑最关键的冒烟集（2 分钟内），重的评测放到合并后与发版前</b>。</p>
  <p><b>坑二：只卡「总体指标」。</b>这样很容易被「总体提升、局部退化」的改动骗过去（见第 2 章）。正确做法是<b>把哪些分层指标不允许下降写进配置</b>——尤其是对抗集，安全类的退步不能因为总体分数上升而被容忍。</p>
</div>

门禁的另一半在线上：[[rollback-condition|回滚条件]] 必须在发版前写死，而不是出事时临时决定。常用的三条是完成率跌幅超过 3 个百分点、单次成本涨幅超过 20%、用户重试率翻倍——命中任意一条即自动回滚，不等人开会。写出可自动判定的数值条件，才算写完了发版流程；需要人来解释才知道该不该触发的条件，等于没有。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 400" role="img" aria-label="灰度发布的四个流量档位与事先写死的回滚条件">
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">灰度爬坡：每一档都要有回滚条件</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">流量按 1% → 5% → 20% → 全量推进，每档留出观察窗口再放量</text>
      <text x="20" y="132" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">流量占比 ↑</text>
      <line x1="90" y1="290" x2="620" y2="290" stroke="#1f1b16" stroke-width="1.2"/>
      <rect x="120" y="266" width="76" height="24" fill="#eef4f1" stroke="#2f6157" stroke-width="1.2"/>
      <text x="158" y="258" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#2f6157">1%</text>
      <rect x="250" y="246" width="76" height="44" fill="#eef4f1" stroke="#2f6157" stroke-width="1.2"/>
      <text x="288" y="238" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#2f6157">5%</text>
      <rect x="380" y="200" width="76" height="90" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="418" y="192" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#8a6a1e">20%</text>
      <rect x="510" y="120" width="76" height="170" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.2"/>
      <text x="548" y="112" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#9b2c2c">全量</text>
      <text x="158" y="308" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">阶段一 · 观察 2 小时</text>
      <text x="288" y="308" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">阶段二 · 观察 1 天</text>
      <text x="418" y="308" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">阶段三 · 观察 3 天</text>
      <text x="548" y="308" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">全量 · 持续监控</text>
      <rect x="16" y="328" width="628" height="64" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="30" y="350" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">回滚条件必须在发版前写死</text>
      <text x="30" y="370" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">完成率跌幅 &gt; 3 个百分点，或单次成本涨幅 &gt; 20%，或用户重试率翻倍——命中任意一条即自动回滚。</text>
      <text x="30" y="386" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">小流量意味着信号弱：档位越小越安全，也越难看出问题，所以每一档都要留出观察窗口再放量。</text>
    </svg>
  </div>
  <figcaption><b>图 3</b>　灰度不是「先放 1% 试试」，而是一条带观察窗口的爬坡路径。<b>真正起作用的不是档位本身，而是事先写死的回滚条件</b>——没有它，灰度只是把全量故障推迟了几天发生。</figcaption>
</figure>

## 五、常见误区与追问

### 5.1 误区：Trace 记录得越全越好（其实标准是「能不能重放」）

错在哪：把「留痕」当成目标，结果日志里堆满了好看但用不上的字段。为什么自然：出问题时第一反应总是「当时记的东西不够」，于是下一次什么都记。正确做法：判据只有一个——把这条 trace 拿回来，能不能不改一行代码就在本地跑出同样的失败？不能，说明字段缺了；能，但你还想加字段，那属于过度记录。做法：优先保证完整请求体、工具调用参数与返回、上下文各部分大小这三项，其余字段按「它能让哪一类问题可归因」来决定去留。

### 5.2 误区：门禁越严格越好（其实门槛过高会诱导团队绕过它）

错在哪：把门禁的严格程度当成质量的唯一变量。为什么自然：「宁可多拦一点」听起来永远政治正确。正确做法：门禁的可用性和严格性必须一起设计。数字：PR 阶段如果要求跑 40 分钟全量评测，团队很快会加 skip-eval 标签；一旦出现第一个例外，门禁的约束力就开始归零。做法：让耗时与频率成反比——每次提交跑的层控制在 2 分钟内，重的评测放到合并后与发版前。

### 5.3 误区：灰度就是「小流量上线」，回滚条件到时候再定

错在哪：把回滚当成应急响应，而不是发布流程的一部分。为什么自然：谁都不想在发版前花时间写一份「可能用不上」的条款。正确做法：回滚条件必须在发版前写死，并且是可自动判定的数值条件。数字：完成率跌幅超过 3 个百分点、单次成本涨幅超过 20%、用户重试率翻倍——命中任意一条即自动回滚，不等人开会。判据：如果一条条件需要人来解释才知道该不该触发，那它写得还太模糊，等于没有。

### 5.4 误区：归因到「失败率 12%」就算做完归因了

错在哪：把总量指标当成归因结论。为什么自然：失败率是最容易算、也最容易向上汇报的数字。正确做法：失败率只回答「有多少」，不回答「为什么」；归因分布才回答「该改哪一层」。判据：如果一份失败报告读完，你说不出「这周该优先修哪一个环节」，那它就是一份没做完的归因。数字：把失败按参数错、工具超时、上下文膨胀、无进展循环四类切开，通常会看到某一类占到一半以上——那一类就是本周的改动清单。

### 5.5 误区：用户重试率是体验问题，不该混进质量指标

错在哪：把用户行为信号归到「产品侧」，让它和数据指标分家。为什么自然：质量指标通常由工程团队定义，用户行为由产品团队看，两者天然被切在不同的报表里。正确做法：用户重试率与中断率是最接近真相的质量指标，因为模型评分只是代理指标，用户行为才是真实结果。数字：完成率 90%、重试率 30% 的系统，实际体验远差于完成率 85%、重试率 8% 的系统。判据：把它和完成率并列观察；只提升完成率而重试率上升的改动，应当视为失败。

### 5.6 误区：所有 badcase 都该进回归门禁

错在哪：把「收藏问题」和「设成门槛」当成同一件事。为什么自然：每一条 badcase 看起来都值得防住。正确做法：只有能通过 Harness 改动解决的工程问题才进回归集；需要模型侧改进的研究问题单独归档，作为改进输入而不是门槛。判据：如果一条样本注定长期失败，团队就会为它开白名单、加例外；而一旦开始加例外，门禁就废了。

## 六、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>第 2 题为高区分度题</span></div>
  <div class="q-item" data-qid="eval05-q1" data-answer="1">
    <div class="q-text"><span class="idx">Q1</span>为什么「用户重试率」和「中断率」是很有价值的质量信号？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>因为它们容易采集</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>因为模型评分只是代理指标，而用户行为是真实结果——用户用脚投票最接近真相，且重试请求的 trace 是高质量 badcase 的来源</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>因为它们能替代人工评审</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>因为它们的数值更稳定</span></button>
    <div class="explain"><b>B。</b>一个完成率 90% 但重试率 30% 的系统，体验远差于完成率 85%、重试率 8% 的系统——这个例子能很好说明代理指标与真实结果的差距。<b>而且这两个信号自带 badcase 挖掘功能</b>：所有重试请求都值得看一眼。</div>
  </div>
  <div class="q-item" data-qid="eval05-q2" data-answer="3">
    <div class="q-text"><span class="idx">Q2</span>PR 阶段的门禁应该跑多少评测？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>全部评测都跑，越全越安全</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>不跑，等发版前一次性跑</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>只跑单元测试，评测靠人工</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>只跑冒烟集等最关键的少量样本（2 分钟内），重的评测放到合并后与发版前——门槛过高会诱导团队绕过门禁</span></button>
    <div class="explain"><b>D。</b>这是很实用的工程经验：<b>门禁的可用性和严格性需要平衡</b>。让开发者每次提交等 40 分钟，结果一定不是「质量更好」，而是「大家想办法跳过」。分层设计让每一层的耗时与其约束力匹配，门禁才能长期存活。</div>
  </div>
  <div class="q-item" data-qid="eval05-q3" data-answer="2">
    <div class="q-text"><span class="idx">Q3</span>为什么要把 badcase 分成「工程问题」与「研究问题」分别处理？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>因为研究问题不需要记录</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>因为工程问题更容易修复</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>因为只有工程问题能通过 Harness 改动解决，进入回归集才有意义；研究问题需要模型侧改进，放进去会导致回归集永远无法全绿，团队逐渐忽略门禁</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>因为研究问题的样本质量更差</span></button>
    <div class="explain"><b>C。</b>关键在「门禁的可维护性」：如果回归集里混着一批「模型能力不足导致」的样本，这些样本会长期失败，团队就不得不为它们开白名单、加例外——一旦开始加例外，门禁就废了。<b>研究类问题应该单独归档，作为模型侧改进的输入，而不是回归门槛。</b></div>
  </div>
</div>

## 七、小结

| 环节 | 关键要求 |
| --- | --- |
| Trace | 为「可重放」而记录：完整请求体、工具调用、上下文大小、重试、时间戳、用户行为 |
| 归因 | 定位到具体环节（参数错 / 超时 / 上下文膨胀 / 无进展），产出归因分布而非单一失败率 |
| 入集 | 只纳入工程问题；标注期望行为；写清来源与原因 |
| 门禁 | 分层设计，PR 只跑冒烟（2 分钟内），发版前跑全量；不允许下降的分层指标要写进配置 |
| 灰度 | 回滚条件事先写死；关注完成率、重试率、成本三项 |
| 最强信号 | 用户重试率 / 中断率——真实结果，且自带 badcase 挖掘 |

<p class="pull-quote">评测没有接进 CI，就只是文档。文档不会挡住任何一个坏改动。<cite>本刊编辑部</cite></p>

评测工程部分结束。最后一部分回到「回答必须有据可查」这个问题：知识怎么建模、怎么检索、怎么让人信。

## 八、参考与延伸

闭环这件事没有单一权威文档，下面几份材料各自补一块：规范、基准、编排原则，以及线上监控的实践。

**先看图（建立直觉）**

- [Anthropic · Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) —— 讲 Agent 循环该在什么地方停下来交给人，对应本章「归因之后该改哪一层」的判断。<strong>如果团队正在争「这个失败该改提示词还是改流程」，先读它关于工作流与 Agent 分界的部分。</strong>

**再看代码（动手实现）**

- [tau-bench](https://github.com/sierra-research/tau-bench) —— 多轮 Agent 基准，把用户建模成模拟器、把工具建模成真实接口，它的评测协议本身就是一套 replay。<strong>想理解「重放为什么必须固定外部依赖」，看它怎么把用户与工具都做成可复现的受控对象。</strong>

**最后读论文（对齐一手定义）**

- [OpenTelemetry · Generative AI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— 目前唯一在推进「LLM 与 Agent 调用该记哪些字段」标准化的官方规范。<strong>本章第二节那张 trace 字段表，可以直接拿去和它的字段命名对照，省掉自己造一套私有 schema。</strong>
- [SWE-bench](https://www.swebench.com/) —— 用「真实仓库的测试能不能跑通」当门禁的极端形态。<strong>想知道把门禁彻底程序化会变成什么样，看它的任务构造与判定方式。</strong>

**延伸阅读**

- [Hamel Husain 的博客](https://hamel.dev/) —— 线上监控与离线评测怎么接成闭环，以及「评测不接进流程就等于没做」的多次讨论。<strong>本章的门禁分层与告警阈值，可以拿他的实践清单逐条核对。</strong>
