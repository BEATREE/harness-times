---
chapter: llm-02-kv-cache
lead: '一个 Agent 的单次任务往往要发十几轮请求，每一轮都带着前面所有轮次的完整历史。如果服务端每次都从头算一遍，你付的钱里有一大半是重复劳动。KV Cache 把这份重复劳动变成缓存命中，而命中率取决于一个平时根本不会被注意的细节：前缀稳定性。'
note: '本章是全站最重要的成本一章。读完后请务必把「前缀稳定性破坏点清单」写进你自己的笔记。'
---

<p class="dropcap">先看一个真实的账单形态。同一个 Agent 任务，第一轮请求 2,000 token 的输入，第二轮变成 2,400，第三轮 2,800……输入长度线性增长，而如果每一轮都要从头算一遍全部前缀，总成本就会呈平方级增长。这不是假设，这是绝大多数「感觉 Agent 很贵」的真实原因。</p>

## 一、重复计算发生在哪

生成式模型是自回归的：生成第 t 个 token 时，需要前面所有 token 的信息。而在 Transformer 里，每一层的信息都浓缩成两个张量——K（键）和 V（值）。

关键点在于：**这两个张量只依赖已经出现过的前缀，与后面要生成什么完全无关。**

所以第 2 轮请求里，那 2,000 个 token 的历史算出来的 K/V，和第 1 轮里算出来的**完全一样**。既然一样，就没有理由重算。把每一层的 K/V 存下来，下一轮直接复用，这就是 KV Cache。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 400" role="img" aria-label="前缀稳定性对 KV Cache 命中率的影响对比">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">同一个前缀，两种命运</text>
      <text x="16" y="38" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">灰色 = 缓存命中复用　深色 = 必须重新计算</text>
      <!-- 情况 A：命中 -->
      <text x="16" y="68" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#2f6157">A · 前缀稳定 → 命中</text>
      <g>
        <rect x="16" y="78" width="300" height="30" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
        <text x="166" y="97" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="#2f6157">第 1 轮：system + 历史 [2,000] 全部符合</text>
      </g>
      <text x="326" y="97" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">第 1 轮无缓存</text>
      <g>
        <rect x="16" y="116" width="300" height="30" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
        <text x="166" y="135" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="#2f6157">第 2 轮：完全相同的前缀 [2,000]</text>
      </g>
      <rect x="320" y="116" width="76" height="30" fill="#9b2c2c" stroke="#9b2c2c" stroke-width="1"/>
      <text x="358" y="135" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#ffffff">仅 +400</text>
      <text x="404" y="135" font-family="ui-monospace, monospace" font-size="10" fill="#2f6157">✓ 只算新增</text>
      <text x="16" y="168" font-family="ui-monospace, monospace" font-size="10" fill="#2f6157">第 2 轮输入成本 ≈ 400 token 量级，而非 2,400</text>
      <!-- 情况 B：未命中 -->
      <line x1="16" y1="190" x2="644" y2="190" stroke="#cfc6b6" stroke-width="1"/>
      <text x="16" y="216" font-family="Georgia, serif" font-size="11.5" font-weight="700" fill="#9b2c2c">B · 前缀被改动 → 未命中</text>
      <g>
        <rect x="16" y="226" width="300" height="30" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
        <text x="166" y="245" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="#2f6157">第 1 轮：system + 历史 [2,000]</text>
      </g>
      <text x="326" y="245" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">第 1 轮无缓存</text>
      <g>
        <rect x="16" y="264" width="52" height="30" fill="#f3c9c9" stroke="#9b2c2c" stroke-width="1.4"/>
        <text x="42" y="283" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.5" font-weight="700" fill="#9b2c2c">改</text>
        <rect x="68" y="264" width="248" height="30" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1" stroke-dasharray="3 2"/>
        <text x="192" y="283" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="#9b2c2c">system 开头多了一句「今天是周三」</text>
      </g>
      <rect x="320" y="264" width="76" height="30" fill="#9b2c2c" stroke="#9b2c2c" stroke-width="1"/>
      <text x="358" y="283" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#ffffff">全量</text>
      <text x="404" y="283" font-family="ui-monospace, monospace" font-size="10" fill="#9b2c2c">✗ 整段前缀作废</text>
      <text x="16" y="316" font-family="ui-monospace, monospace" font-size="10" fill="#9b2c2c">第 2 轮输入成本 ≈ 2,400 token 量级，缓存的 2,000 全部浪费</text>
      <rect x="16" y="336" width="628" height="48" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="30" y="356" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">缓存是按 token 逐位比对前缀的：从第一个 token 开始，一旦有一位不同，其后全部失效。</text>
      <text x="30" y="374" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">所以改动永远要加在尾部（追加），不要动头部（系统提示、工具定义、历史顺序）。</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　A 与 B 的区别只在于「前缀有没有被改动」。同样把输入从 2,000 加到 2,400，A 只需处理新增的 400，B 需要处理全部 2,400。<b>成本差异不是百分比，而是数量级。</b></figcaption>
</figure>

## 二、前缀稳定性：被忽略的成本开关

KV Cache 是按**前缀逐位比对**命中的。从序列的第一个 token 开始，一旦某一位不同，其后全部失效。这个机制带来一个反直觉但极其重要的结论：

> **在中间插入内容，比在末尾追加内容昂贵得多。**

常见的「插在中间」的操作，在工程里几乎随处可见：

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>常见写法</th><th>为什么破坏前缀</th><th>正确做法</th></tr></thead>
    <tbody>
      <tr><td>System Prompt 里塞 <code>当前时间：{now}</code></td><td>每轮时间都变，第一个 token 就不同</td><td>把动态信息放到最后一条 user 消息里，或只精确到天/小时并接受偶发失效</td></tr>
      <tr><td>每轮重新序列化工具列表，顺序不稳定</td><td>字典遍历顺序或 JSON 键序变化 → 字节不同</td><td>工具定义做稳定排序，序列化后缓存字符串而非重复生成</td></tr>
      <tr><td>把最新用户消息插到历史前面</td><td>历史整体后移，全部前缀作废</td><td>永远追加到尾部</td></tr>
      <tr><td>每轮重新注入「记忆」到 system 里</td><td>记忆内容变化 → 开头就不同</td><td>记忆放在尾部或独立的一条消息；或作为工具按需检索</td></tr>
      <tr><td>历史消息每次重新渲染（重新拼 Markdown）</td><td>换行、空格、引号形式细微变化即失效</td><td>保持历史消息<strong>字节级不变</strong>，原始字符串原样回传</td></tr>
      <tr><td>把工具执行结果截断长度随轮次变化</td><td>被截断位置之后的内容全变</td><td>截断策略要稳定（固定头尾保留量）</td></tr>
    </tbody>
  </table>
</div>

<div class="box box-warn">
  <span class="box-title">最容易被忽略的一条</span>
  <p><b>「重新序列化历史」是隐蔽的前缀杀手。</b>很多 Harness 会在每轮把消息数组拼成一次性的提示字符串，中间经过模板渲染、去空行、合并连续换行等「美化」步骤。这些步骤哪怕只差一个空格，前缀就废了。</p>
  <p>判断方法很简单：把你的请求体打印出来，对比第 1 轮与第 2 轮的<b>字节前缀</b>，看从第几个字符开始不同。如果第一个差异出现在前 1% 的位置，说明你的缓存命中率基本上是 0。</p>
</div>

## 三、显存估算：缓存的代价

缓存不是免费的，它占显存。估算公式不长，记住它就能在面试里立刻给出数量级。

```python title="kv_cache_footprint.py"
def kv_cache_bytes(
    batch: int,        # 并发请求数
    seq_len: int,      # 序列长度（含历史）
    n_layers: int,     # 层数
    n_kv_heads: int,   # K/V 头数（注意：不一定等于注意力头数）
    head_dim: int,     # 每个头的维度
    bytes_per_num: int = 2,   # fp16=2, fp8=1
) -> int:
    # 每层缓存 K 和 V 两份，所以乘 2
    return 2 * batch * seq_len * n_layers * n_kv_heads * head_dim * bytes_per_num
# 一个典型的 70B 级模型（GQA，kv_heads 远少于 query_heads）
total = kv_cache_bytes(
    batch=32, seq_len=32_000, n_layers=80, n_kv_heads=8, head_dim=128
)
print(f"{total / 1024**3:.1f} GiB")   # 大约 31 GiB —— 仅缓存，不含权重
# 关键观察：这个数是随 seq_len 线性长的
for s in (8_000, 32_000, 128_000):
    n = kv_cache_bytes(32, s, 80, 8, 128)
    print(f"seq_len={s:>7}: {n/1024**3:6.1f} GiB")
```



三点必须记住：

1. **KV Cache 显存随序列长度线性增长**，与注意力的算力平方增长不是同一回事。算力是平方问题，显存是线性问题——两者要分开讲。
2. **GQA / MQA** 的工程意义就在这里：把 K/V 的头数从 h 降到 h/8 甚至 1，缓存直接缩小同样倍数。这是长上下文能跑起来的关键手段之一。
3. **缓存有淘汰策略**。服务端不会让你无限占显存，通常按 LRU 或分页（PagedAttention）管理。这意味着**你的前缀如果排在很久不用的位置，可能已经被淘汰**——命中率还受并发与调度影响，不只看你自己。

## 四、动手：把「前缀稳定性」变成可检查的东西

下面的脚本可以直接接进你自己的 Harness 里做日常检查。

```python title="prefix_guard.py"
import json, hashlib
from typing import Any
def serialize_stable(obj: Any) -> str:
    """稳定序列化：键排序、分隔符固定、禁用 ascii 转义以保证同一对象字节一致"""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
def prefix_fingerprint(messages: list[dict], tools: list[dict]) -> str:
    """对 tools + 前 N-1 条消息取指纹，验证相邻两轮是否共享同一前缀"""
    stable_part = {
        "tools": tools,                 # 工具定义必须在 messages 之前，且顺序稳定
        "history": messages[:-1],       # 最后一条是新增内容，不参与指纹
    }
    return hashlib.sha256(serialize_stable(stable_part).encode()).hexdigest()[:16]
def append_only_messages(system: str, history: list[dict], user_input: str) -> list[dict]:
    """唯一推荐的组装方式：头部固定，只在尾部追加"""
    fixed_head = [{"role": "system", "content": system}]
    return fixed_head + history + [{"role": "user", "content": user_input}]
# --- 使用示例：连续两轮，观察指纹是否一致 ---
tools = [{"name": "get_weather"}, {"name": "get_time"}]   # 注意：顺序必须写死
h1 = [{"role": "user", "content": "北京天气"}]
fp1 = prefix_fingerprint(h1, tools)
h2 = h1 + [{"role": "assistant", "content": "正在查询"},
           {"role": "tool", "content": "晴 24℃"}]
fp2 = prefix_fingerprint(h2, tools)   # 注意这里的「-1」语义：最后一轮的新输入不入指纹
print(fp1, fp2)   # 这里的差异是因为 history 长度变了，实际检查时应比较「相同长度部分」
```



<div class="box box-practice">
  <span class="box-title">实操任务</span>
  <ul>
    <li>写一个函数，输入是两轮的完整请求体，输出<b>第一个不同字符的偏移量</b>；</li>
    <li>用它在你的 Harness 上跑一遍，看第 1→2 轮的偏移量是不是接近 0；</li>
    <li>把 <code>system prompt</code> 里所有动态变量（时间、用户名、记忆片段）挪到尾部，再测一次，记录偏移量的变化。</li>
  </ul>
  <p style="margin-top:10px">验收标准：能说出你的 Harness 里<b>至少五个</b>前缀破坏点，并指出各自的修法。</p>
</div>

## 五、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>本章为 DeepSeek 类岗位高频考点</span></div>
  <div class="q-item" data-qid="llm02-q1" data-answer="2">
    <div class="q-text"><span class="idx">Q1</span>为什么在 system prompt 里加一句「当前时间：14:03」会让成本显著上升？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>因为多了几个 token 的输入量</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>因为时间格式解析会拖慢推理</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>因为它在序列最前面，逐位比对时第一个位置就不同，导致整个前缀缓存失效</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>不会上升，KV Cache 与内容无关</span></button>
    <div class="explain"><b>C。</b>多出的 token 量可以忽略，真正的问题是位置。前缀比对从第一个 token 开始，头部一处改动就让其后全部作废。<b>通用的纪律是：动态内容一律放尾部，静态内容一律放头部。</b></div>
  </div>
  <div class="q-item" data-qid="llm02-q2" data-answer="0">
    <div class="q-text"><span class="idx">Q2</span>某模型 80 层、K/V 头数 8、head_dim 128、fp16 存储。单条 32k 上下文的 KV Cache 大约多大？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>约 1 GiB</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>约 32 GiB</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>约 8 MiB</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>约 128 GiB</span></button>
    <div class="explain"><b>A。</b>代入公式：<code>2 × 1 × 32000 × 80 × 8 × 128 × 2 = 2.6×10⁹</code> 字节 ≈ 1.05 GiB。关键是别漏掉那个 <code>2</code>（K 和 V 各一份）。<b>面试时能当场笔算出这个数，比说出「很大」有价值得多。</b></div>
  </div>
  <div class="q-item" data-qid="llm02-q3" data-answer="3">
    <div class="q-text"><span class="idx">Q3</span>GQA（分组查询注意力）主要解决什么问题？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>提升模型在推理任务上的准确率</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>把注意力的平方复杂度降为线性</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>减少模型权重的存储体积</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>让多个 query 头共享一组 K/V 头，显著缩小 KV Cache 显存，从而支撑长上下文与高并发</span></button>
    <div class="explain"><b>D。</b>GQA 不改变注意力的平方复杂度，也不改变权重体积，它压的是 <b>K/V 的头数</b>——也就是缓存大小。<code>n_kv_heads</code> 从 64 降到 8，缓存直接缩到 1/8。这解释了为什么长上下文模型几乎都用 GQA 或 MQA。</div>
  </div>
</div>

## 六、小结

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>结论</th><th>依据</th><th>你应该做的动作</th></tr></thead>
    <tbody>
      <tr><td>历史不该被重算</td><td>K/V 只依赖前缀，与后文无关</td><td>确保前缀字节稳定，最大化命中</td></tr>
      <tr><td>头部改动代价最高</td><td>前缀逐位比对，一错全废</td><td>动态内容（时间、记忆）一律放尾部</td></tr>
      <tr><td>缓存占显存，随长度线性增长</td><td><code>2 · B · L · n_layers · n_kv · d_head · bytes</code></td><td>长上下文要为缓存留预算，不只是权重</td></tr>
      <tr><td>命中率不完全由你决定</td><td>服务端有淘汰与调度策略</td><td>高频复用的前缀要短且稳定，别指望超长前缀一直驻留</td></tr>
    </tbody>
  </table>
</div>

<p class="pull-quote">前缀稳定性是那种「懂了就能立刻省一半钱、不懂也完全不知道自己在亏」的知识。面试里能主动提起它，说明你真的在为自己的系统付过账。<cite>本刊编辑部</cite></p>

下一章换一个角度：既然总参数可以很大而激活参数可以很小，成本结构还能再动一次手脚。
