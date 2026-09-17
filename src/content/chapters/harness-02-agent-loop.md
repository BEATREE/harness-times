---
chapter: harness-02-agent-loop
lead: '写一个循环谁都会：调用模型、解析动作、执行工具、把结果塞回去。难的是四件事——知道它该停下来、知道它卡住了、知道它绕圈子、以及在它需要人拍板时把控制权交出去。这一章把循环从一个 while 语句升级成一个可控的执行系统。'
note: '「什么时候该停下来」是本刊认为最被低估的工程问题。绝大多数线上事故不是模型不够聪明，而是循环没有正确的刹车。'
---

<p class="dropcap">先看一个未经训练的写法：<code>while True: plan = model(ctx); ctx += act(plan)</code>。它的失败方式多得惊人——模型可能永远说「再查一次」，可能反复调用同一个工具，可能在一个空结果上打转，也可能已经完成了却不知道要停。这一章把每一种失败都对应上一个明确的终止条件。</p>

## 一、循环的骨架

Agent 循环的最小结构只有三步，这三步的命名在不同框架里不同，但语义一致：

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>阶段</th><th>做什么</th><th>失败模式</th></tr></thead>
    <tbody>
      <tr><td>Think（思考）</td><td>模型基于当前上下文决定下一步动作</td><td>动作格式非法；在信息不足时硬猜；重复同一个动作</td></tr>
      <tr><td>Act（行动）</td><td>执行工具调用，产生副作用或获取信息</td><td>参数错误；超时；权限不足；副作用不可逆</td></tr>
      <tr><td>Observe（观察）</td><td>把结果加工后回喂上下文</td><td>结果过长挤爆上下文；错误信息丢失；把外部内容当指令</td></tr>
    </tbody>
  </table>
</div>

看起来很清晰，但工程上的麻烦几乎全部集中在「Observe → Think」这一段的回喂内容上。同一段工具结果，怎么截断、怎么标注来源、怎么标记可信度，直接决定下一轮模型会不会做出荒唐决策。

## 二、五类终止条件：一个都不能少

这是本章的核心。**只写「任务完成就停」的系统，一定会以三种方式之一失控。**

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 420" role="img" aria-label="Agent 循环的五类终止条件与各自的触发时机">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">五道刹车：任何一道被触发都要退出循环</text>
      <!-- 循环主干 -->
      <rect x="16" y="36" width="150" height="40" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.3"/>
      <text x="91" y="60" text-anchor="middle" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#1f1b16">Think</text>
      <line x1="166" y1="56" x2="196" y2="56" stroke="#1f1b16" stroke-width="1.2"/>
      <rect x="196" y="36" width="150" height="40" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="271" y="60" text-anchor="middle" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#2f6157">Act</text>
      <line x1="346" y1="56" x2="376" y2="56" stroke="#1f1b16" stroke-width="1.2"/>
      <rect x="376" y="36" width="150" height="40" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <text x="451" y="60" text-anchor="middle" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#8a6a1e">Observe</text>
      <!-- 回环 -->
      <line x1="451" y1="76" x2="451" y2="98" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="451" y1="98" x2="91" y2="98" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="91" y1="98" x2="91" y2="76" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar2)"/>
      <defs>
        <marker id="ar2" markerWidth="9" markerHeight="9" refX="4" refY="1" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <text x="271" y="94" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">回到 Think（这一圈必须有刹车）</text>
      <!-- 五道刹车 -->
      <rect x="16" y="118" width="628" height="34" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="28" y="133" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#2f6157">① 任务完成　模型明确声明结束</text>
      <text x="28" y="147" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">要求：必须是一个显式动作（如 finish 工具），不能靠「不再调用工具」隐式判断</text>
      <rect x="16" y="158" width="628" height="34" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <text x="28" y="173" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#8a6a1e">② 预算耗尽　轮数 / token / 时间 / 金额任一触顶</text>
      <text x="28" y="187" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">要求：退出时要返回「部分结果 + 已完成的步骤」，而不是一句失败</text>
      <rect x="16" y="198" width="628" height="34" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="28" y="213" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#9b2c2c">③ 无进展检测　连续 N 轮状态未发生实质变化</text>
      <text x="28" y="227" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">判据：工具调用签名重复、观察结果哈希不变、产出文件无变更</text>
      <rect x="16" y="238" width="628" height="34" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="28" y="253" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#2f6157">④ 需要人工　越权、不可逆操作、信息缺失</text>
      <text x="28" y="267" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">要求：暂停并保持状态可恢复，不能「假装问过了」继续往下跑</text>
      <rect x="16" y="278" width="628" height="34" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.3"/>
      <text x="28" y="293" font-family="Georgia, serif" font-size="10.8" font-weight="700" fill="#1f1b16">⑤ 系统异常　模型输出无法解析 / 流式卡死 / 上游 5xx</text>
      <text x="28" y="307" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">要求：区分「可重试」与「不可重试」，且有最大重试次数（否则变成死循环）</text>
      <!-- 说明 -->
      <rect x="16" y="326" width="628" height="76" fill="#fbf8f2" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="30" y="346" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#1f1b16">为什么五类都要有（这是面试里最好用的一句话）</text>
      <text x="30" y="364" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">只写① → 模型判断失误时无限循环，成本失控（最常见的事故）。</text>
      <text x="30" y="380" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">只写② → 明明两轮就能做完，却因为轮数上限太低而中途放弃。</text>
      <text x="30" y="396" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">缺③ → 模型在两轮之间原地打转，预算被无声耗尽，日志里看不出异常。</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　五类终止条件分别覆盖不同的失控方式。<b>第 ③ 类「无进展检测」是最容易被漏掉、也最能体现工程经验的一条</b>——它处理的不是「跑不完」，而是「跑了但没动」，这类问题在日志里几乎看不出来。</figcaption>
</figure>

## 三、无进展检测怎么做

不要指望模型自己意识到自己在绕圈。要在 Harness 侧用可计算的判据来检测。常用手段按可靠性排序：

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>判据</th><th>计算方式</th><th>优点</th><th>局限</th></tr></thead>
    <tbody>
      <tr><td>工具调用签名重复</td><td>对 <code>(tool_name, normalized_args)</code> 做哈希，统计重复次数</td><td>实现简单，几乎零误报</td><td>参数只要有微小变化就检测不到（但那种情况往往也不是真进展）</td></tr>
      <tr><td>观察结果哈希不变</td><td>对工具返回内容取哈希，连续 3 轮相同即判定停滞</td><td>能捕捉「换了参数但结果一样」</td><td>返回内容带时间戳等噪声时会失效</td></tr>
      <tr><td>状态指纹不变</td><td>对「工作区文件列表 + 文件哈希」取指纹</td><td>最接近「实质进展」的定义</td><td>只适用于有文件系统产出的任务</td></tr>
      <tr><td>模型自述停滞</td><td>让模型在每轮输出一个 progress 标记</td><td>能捕捉语义层面的绕圈</td><td><b>不可靠</b>，模型经常自信地认为自己有进展</td></tr>
      <tr><td>成本斜率异常</td><td>每轮 token 消耗持续上升但产出不变</td><td>能提前预警上下文膨胀</td><td>只能作为辅助信号</td></tr>
    </tbody>
  </table>
</div>

<div class="box box-warn">
  <span class="box-title">一个真实的反模式</span>
  <p>很多实现只统计「同一个工具调用了多少次」，超过阈值就报错退出。问题是：<b>合法的搜索任务本来就会调用同一工具很多次</b>（换不同关键词检索）。</p>
  <p>正确的判据不是「调用了多少次」，而是<b>「调用之后状态有没有变化」</b>。同样是调用 search 十次，每次返回不同内容是新信息；每次返回同一批结果才是死循环。这个区别决定了你的检测器是帮了忙还是帮了倒忙。</p>
</div>

## 四、动手：一个带完整刹车的循环

<div class="code-block">
  <div class="code-head"><span>agent_loop.py</span><span class="lang">python</span></div>
  <pre><code>import hashlib, json, time
from dataclasses import dataclass, field
def sig(tool: str, args: dict) -> str:
    """工具调用签名：参数做稳定序列化，避免键序影响"""
    return f"{tool}::{json.dumps(args, sort_keys=True, ensure_ascii=False)}"
@dataclass
class LoopGuard:
    max_turns: int = 15
    max_seconds: float = 300
    stall_limit: int = 3           # 连续多少轮无进展就退出
    repeat_limit: int = 3          # 同一调用签名最多重复几次
    started: float = field(default_factory=time.time)
    turns: int = 0
    seen: dict = field(default_factory=dict)     # 签名 -> 次数
    last_obs: str = ""
    stall: int = 0
    def check(self) -> tuple[bool, str]:
        """返回 (是否应继续, 退出原因)"""
        if self.turns >= self.max_turns:
            return False, "BUDGET_TURNS"
        if time.time() - self.started > self.max_seconds:
            return False, "BUDGET_TIME"
        if self.stall >= self.stall_limit:
            return False, "NO_PROGRESS"
        return True, ""
    def note_call(self, tool: str, args: dict) -> tuple[bool, str]:
        """记录一次调用；返回是否允许执行"""
        s = sig(tool, args)
        self.seen[s] = self.seen.get(s, 0) + 1
        if self.seen[s] > self.repeat_limit:
            return False, f"同一调用已重复 {self.seen[s]} 次，请换策略或结束任务"
        return True, ""
    def note_observation(self, content: str) -> None:
        """观察结果没变化 → 记为一次停滞"""
        h = hashlib.sha256(content.encode()).hexdigest()
        if h == self.last_obs:
            self.stall += 1
        else:
            self.stall = 0
            self.last_obs = h
def run(task: str, call_model, exec_tool, ask_human):
    guard = LoopGuard()
    ctx = [{"role": "user", "content": task}]
    while True:
        ok, why = guard.check()
        if not ok:
            # 关键：退出时带上已完成的部分，而不是一句失败
            return {"status": why, "turns": guard.turns,
                    "partial": summarize(ctx), "context": ctx}
        guard.turns += 1
        plan = call_model(ctx, temperature=0)
        # ① 显式完成信号（不要靠「没调工具」隐式判断）
        if plan["action"] == "finish":
            return {"status": "DONE", "result": plan.get("answer"), "turns": guard.turns}
        # ④ 需要人工：暂停而不是硬闯
        if plan["action"] == "need_human":
            return {"status": "NEED_HUMAN", "question": plan.get("question", ""),
                    "context": ctx, "resumable": True}
        # ⑤ 输出无法解析：有限次重试后才放弃
        if plan["action"] == "invalid":
            ctx.append({"role": "user",
                        "content": "上一次输出无法解析为合法动作，请只输出 JSON。"})
            continue
        allowed, msg = guard.note_call(plan["tool"], plan.get("args", {}))
        if not allowed:
            ctx.append({"role": "user", "content": msg})
            continue
        result = exec_tool(plan["tool"], plan.get("args", {}))
        guard.note_observation(str(result))
        # 副作用操作必须确认（人工介入点）
        if result.get("side_effect") and not ask_human(plan):
            ctx.append({"role": "user", "content": "用户拒绝了该操作。"})
            continue
        ctx.append({"role": "tool", "content": str(result)[:2000]})
</code></pre>
</div>

<div class="box box-practice">
  <span class="box-title">实操任务</span>
  <ul>
    <li>给 <code>LoopGuard</code> 加一个「成本斜率」信号：连续三轮 token 消耗上升但观察结果哈希不变，就提前退出；</li>
    <li>把 <code>stall_limit</code> 从 3 调到 1，观察误杀率变化（很多合法任务会出现一轮「无变化」），思考阈值该怎么定；</li>
    <li>写一个测试：构造一个「每次都调用 search('同样的词')」的假模型，验证 <code>NO_PROGRESS</code> 能被触发且只用了 3 轮。</li>
  </ul>
</div>

## 五、Human-in-the-loop 的正确姿势

人工介入不是「弹个窗问一下」那么简单，它有三个必须设计清楚的点：

**第一，暂停必须可恢复。** 用户拒绝或长时间不回应之后，任务不能就这么死掉。要把完整状态（上下文、已完成的步骤、待决策的问题）持久化，用户回来时能从中断点继续。

**第二，问题必须包含决策所需的信息。** 问「是否继续？」是没用的；问「我准备删除 <code>orders_2025</code> 表（共 12 万行，最后访问 3 天前），确认删除还是先备份？」才是可决策的。**把选项和后果一起给出来。**

**第三，不是所有事都要问。** 该自动化的自动化，该问的才问。判据是「可逆性 + 影响范围」：

| 操作类型 | 示例 | 策略 |
| --- | --- | --- |
| 只读、无副作用 | 检索、读取、查询 | 直接执行，不问 |
| 可逆写操作 | 写文件到工作目录、创建草稿 | 自动执行 + 记录，可回滚 |
| 不可逆但有边界 | 发送邮件到内部群、创建线上工单 | 首次确认，同类操作可批量授权 |
| 不可逆且影响外部 | 删除数据、支付、发布公开内容 | <b>每次强制确认</b>，且确认信息必须包含影响范围 |

## 六、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>第 1、3 题为高频考点</span></div>
  <div class="q-item" data-qid="harness02-q1" data-answer="2">
    <div class="q-text"><span class="idx">Q1</span>只实现「任务完成后退出」这一种终止条件，最可能发生什么？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>任务过早退出，完成率下降</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>工具调用参数错误率上升</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>当模型判断失误或陷入循环时无限继续，成本失控</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>上下文会被更快地压缩</span></button>
    <div class="explain"><b>C。</b>这是线上最典型的事故形态。模型可能因为对「完成」的判断出错而持续重试，也可能在两轮之间空转，而没有预算上限与无进展检测的系统不会阻止它。<b>「加一个 max_turns」是任何 Agent 上线的第一条纪律。</b></div>
  </div>
  <div class="q-item" data-qid="harness02-q2" data-answer="1">
    <div class="q-text"><span class="idx">Q2</span>为什么不应该用「本轮没有调用工具」作为完成信号？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>因为模型可能在文本里输出工具调用</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>因为模型完全可能只是想继续说明、追问澄清或输出中间结论，这并不等于任务完成；显式信号才是可判定的</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>因为这样会增加 token 消耗</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>因为工具调用可能失败，失败时不调用工具是正常的</span></button>
    <div class="explain"><b>B。</b>「没调工具」是一个<b>缺失信号</b>，不是<b>肯定信号</b>，它无法区分「我做完了」和「我还在想」。工程上的原则是：<b>状态的迁移必须由显式事件驱动，不能由「某个事件没发生」来推断。</b>这一点在状态机设计里同样成立。</div>
  </div>
  <div class="q-item" data-qid="harness02-q3" data-answer="3">
    <div class="q-text"><span class="idx">Q3</span>检测「无进展」最可靠的判据是？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>同一个工具被调用的总次数超过阈值</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>模型自述「我没有进展」</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>总 token 消耗超过阈值</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>调用签名重复且观察结果哈希连续多轮不变</span></button>
    <div class="explain"><b>D。</b>A 会误杀合法的多次检索（换关键词是正常行为）；B 不可靠，模型经常误判自己；C 是预算控制而不是进展检测。<b>只有「调用重复 + 结果不变」才同时满足「没有新信息进入」和「没有新动作产生」两个条件。</b></div>
  </div>
</div>

## 七、小结

| 要素 | 必须做到 |
| --- | --- |
| 循环骨架 | Think / Act / Observe 三步，重点在 Observe 的回喂加工 |
| 终止条件 | 五类齐全：完成、预算、无进展、需要人工、系统异常 |
| 无进展检测 | 用「调用签名 + 结果哈希」，不要用调用次数 |
| 人工介入 | 暂停可恢复；问题带选项与后果；按可逆性分级而非一律询问 |
| 退出时 | 返回部分结果与已完成步骤，不返回一句失败 |

<p class="pull-quote">循环的上限由模型的推理能力决定，循环的可靠性由刹车决定。而线上事故绝大多数出在刹车上。<cite>本刊编辑部</cite></p>

刹车装好了，下一章处理最容易出问题的那一层：工具。因为工具是模型唯一能真正改变世界的手。
