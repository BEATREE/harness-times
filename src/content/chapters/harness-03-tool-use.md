---
chapter: harness-03-tool-use
lead: '工具不是给人看的 API 文档，而是给模型看的能力契约。同一段业务逻辑，描述写法不同，工具调用成功率可以差出一倍。这一章讲四件事：描述怎么写、参数怎么约束、错误怎么分类回喂、以及什么时候该上 MCP。'
note: '这一章的内容可以直接拿去改你手上的 Harness —— 它是投入产出比最高的一层。'
---

<p class="dropcap">先纠正一个常见误解：工具调用的失败，多数不是模型「不会用」，而是模型「不知道该怎么用」。你要给它的不是接口签名，而是判断依据——什么时候用这个工具、参数填什么范围、返回的结构长什么样、出错时代表什么。</p>

## 一、工具是契约，不是接口

一个完整的工具契约包含七个要素。少任何一个都会以某种方式转化为线上问题——其中 [[tool-description|工具描述]] 与 [[tool-schema|参数 schema]] 直接决定模型「会不会用、用得对不对」：

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>要素</th><th>写什么</th><th>缺了会怎样</th></tr></thead>
    <tbody>
      <tr><td>名称</td><td>动词开头、语义唯一、不与其它工具重名或近似</td><td>模型在多个相似工具间随机选择</td></tr>
      <tr><td>用途描述</td><td>一句话说明「做什么」+ 一句话说明「什么时候该用 / 不该用」</td><td>模型在该用的场景想不到它</td></tr>
      <tr><td>参数 schema</td><td>类型、必填性、<b>枚举取值</b>、范围、格式范例</td><td>参数写错、格式不对、枚举乱填</td></tr>
      <tr><td>返回值结构</td><td>字段名、类型、是否可能为空、可能的错误形态</td><td>模型误读结果，基于空值继续推理</td></tr>
      <tr><td>幂等性标记</td><td>是否可安全重试</td><td>超时后盲目重试，产生重复副作用</td></tr>
      <tr><td>副作用等级</td><td>只读 / 可逆写 / 不可逆</td><td>越权执行，出事无法追责</td></tr>
      <tr><td>调用成本提示</td><td>是否昂贵、是否慢、是否有配额</td><td>模型反复调用昂贵接口，成本失控</td></tr>
    </tbody>
  </table>
</div>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 360" role="img" aria-label="同一工具两种描述写法的对比">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">同一工具，两种命运</text>
      <text x="16" y="38" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">差别不在业务逻辑上，只在你给模型看的那几百个字符上。</text>
      <!-- 差写法 -->
      <rect x="16" y="52" width="308" height="180" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="30" y="72" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#9b2c2c">写法 A　调用成功率低</text>
      <text x="30" y="94" font-family="ui-monospace, monospace" font-size="9.4" fill="#1f1b16">{</text>
      <text x="38" y="110" font-family="ui-monospace, monospace" font-size="9.4" fill="#1f1b16">"name": "query_data",</text>
      <text x="38" y="126" font-family="ui-monospace, monospace" font-size="9.4" fill="#9b2c2c">"description": "查询数据",</text>
      <text x="38" y="142" font-family="ui-monospace, monospace" font-size="9.4" fill="#1f1b16">"parameters": {</text>
      <text x="46" y="158" font-family="ui-monospace, monospace" font-size="9.4" fill="#1f1b16">"type": "object",</text>
      <text x="46" y="174" font-family="ui-monospace, monospace" font-size="9.4" fill="#9b2c2c">"properties": {"q": {"type": "string"}}</text>
      <text x="38" y="190" font-family="ui-monospace, monospace" font-size="9.4" fill="#1f1b16">}</text>
      <text x="30" y="206" font-family="ui-monospace, monospace" font-size="9.4" fill="#6b6257">}</text>
      <text x="30" y="224" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">→ 模型不知道 q 是自然语言还是 SQL，不知道返回值长什么样</text>
      <!-- 好写法 -->
      <rect x="336" y="52" width="308" height="180" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="350" y="72" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#2f6157">写法 B　调用成功率高</text>
      <text x="350" y="94" font-family="ui-monospace, monospace" font-size="9.4" fill="#1f1b16">{</text>
      <text x="358" y="110" font-family="ui-monospace, monospace" font-size="9.4" fill="#1f1b16">"name": "search_articles",</text>
      <text x="358" y="126" font-family="ui-monospace, monospace" font-size="9.4" fill="#2f6157">"description": "按关键词检索已发布文章，</text>
      <text x="358" y="140" font-family="ui-monospace, monospace" font-size="9.4" fill="#2f6157">返回标题与摘要。适合先定位候选；</text>
      <text x="358" y="154" font-family="ui-monospace, monospace" font-size="9.4" fill="#2f6157">需要正文请用 fetch_article。",</text>
      <text x="358" y="170" font-family="ui-monospace, monospace" font-size="9.4" fill="#1f1b16">"parameters": {</text>
      <text x="366" y="186" font-family="ui-monospace, monospace" font-size="9.4" fill="#2f6157">"q": {"type":"string","description":"中文关键词，</text>
      <text x="366" y="200" font-family="ui-monospace, monospace" font-size="9.4" fill="#2f6157">　　不要写 SQL；例：'客服 满意度'"},</text>
      <text x="366" y="216" font-family="ui-monospace, monospace" font-size="9.4" fill="#2f6157">"limit": {"type":"integer","minimum":1,"maximum":20}</text>
      <text x="358" y="230" font-family="ui-monospace, monospace" font-size="9.4" fill="#1f1b16">}</text>
      <!-- 差异表 -->
      <rect x="16" y="248" width="628" height="96" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="30" y="268" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">B 比 A 多做的四件事（每一件都直接对应成功率提升）</text>
      <text x="30" y="288" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">1. 说清「什么时候用」+「什么时候用别的」→ 消除相似工具之间的选择困难</text>
      <text x="30" y="306" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">2. 参数给格式范例与反例 → 避免模型按自己理解填（如误填 SQL）</text>
      <text x="30" y="324" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">3. 用 minimum / maximum 约束范围 → 把「错参数」变成结构上不可能</text>
      <text x="30" y="342" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">4. 说明返回结构 → 模型知道下一步怎么用这批结果，减少无意义追问</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　工具描述的四个层次：做什么 → 什么时候用 → 参数怎么填 → 返回什么。多数团队只写了第一层，然后靠「加系统提示词」去补救第二到第四层——<b>把该写在契约里的信息写进提示词，是典型的职责错位。</b></figcaption>
</figure>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 320" role="img" aria-label="三层约束金字塔：描述约束弱、执行前校验强，强制程度递增">
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">让调用不可能出错：三层约束，强制程度递增</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">越往下越「硬」：上层靠模型自觉，下层靠结构强制。</text>
      <polygon points="300,64 392,64 410,124 282,124" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="346" y="88" text-anchor="middle" font-family="Georgia, serif" font-size="10.5" font-weight="700" fill="#9b2c2c">③ 执行前校验</text>
      <text x="346" y="106" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">Handler 入口再校验</text>
      <text x="346" y="118" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">不信任任何上游 · 强</text>
      <polygon points="272,128 420,128 442,188 250,188" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <text x="346" y="152" text-anchor="middle" font-family="Georgia, serif" font-size="10.5" font-weight="700" fill="#8a6a1e">② schema 约束</text>
      <text x="346" y="170" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">enum/min/max/required 堵死非法</text>
      <text x="346" y="182" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">结构化输出保证 · 中</text>
      <polygon points="244,192 448,192 474,252 218,252" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="346" y="216" text-anchor="middle" font-family="Georgia, serif" font-size="10.5" font-weight="700" fill="#2f6157">① 描述约束</text>
      <text x="346" y="234" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">取值范围 + 范例，靠模型自觉</text>
      <text x="346" y="246" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.6" fill="#6b6257">成本最低 · 弱</text>
      <rect x="486" y="64" width="158" height="188" fill="#fbf8f2" stroke="#1f1b16" stroke-width="1.2"/>
      <text x="500" y="86" font-family="Georgia, serif" font-size="10.5" font-weight="700" fill="#1f1b16">为什么三层</text>
      <text x="500" y="108" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">模型可能绕过第①层</text>
      <text x="500" y="126" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">（不走结构化通道），</text>
      <text x="500" y="144" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">也可能无视第②层；</text>
      <text x="500" y="162" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">第③层在代码里，</text>
      <text x="500" y="180" font-family="ui-monospace, monospace" font-size="9" fill="#6b6257">谁都绕不过去。</text>
      <text x="500" y="204" font-family="ui-monospace, monospace" font-size="9" font-weight="700" fill="#9b2c2c">三层叠加，</text>
      <text x="500" y="222" font-family="ui-monospace, monospace" font-size="9" font-weight="700" fill="#9b2c2c">错误在抵达外部前</text>
      <text x="500" y="240" font-family="ui-monospace, monospace" font-size="9" font-weight="700" fill="#9b2c2c">就被拦下。</text>
    </svg>
  </div>
  <figcaption><b>图 2</b>　把「防止出错」从「指望模型自觉」升级成「结构上不可能」。<b>最可靠的一层永远在执行前校验</b>——它在代码里，不依赖任何模型行为，是防御的最后一道硬墙。</figcaption>
</figure>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 340" role="img" aria-label="错误回喂的决策链路：先排除空结果，再分类决定重试/换方案/上报">
      <defs>
        <marker id="ar1" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/></marker>
        <marker id="ar2" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#9b2c2c"/></marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">错误回喂的决策链路</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">分类决定下一步动作；空结果要先排除——它不是错误。</text>
      <rect x="30" y="70" width="180" height="40" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.3"/>
      <text x="120" y="95" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" font-weight="700" fill="#1f1b16">工具执行返回</text>
      <line x1="210" y1="90" x2="248" y2="90" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar1)"/>
      <polygon points="252,66 372,66 392,90 372,114 252,114 272,90" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <text x="320" y="94" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" font-weight="700" fill="#8a6a1e">是空结果？</text>
      <line x1="392" y1="90" x2="430" y2="90" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar1)"/>
      <rect x="430" y="70" width="200" height="40" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="530" y="95" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.2" font-weight="700" fill="#9b2c2c">明确告知：成功但无数据</text>
      <text x="320" y="138" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">否 →</text>
      <line x1="320" y1="114" x2="320" y2="150" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar1)"/>
      <rect x="230" y="150" width="180" height="40" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="320" y="175" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" font-weight="700" fill="#2f6157">错误分类</text>
      <line x1="230" y1="170" x2="120" y2="210" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar1)"/>
      <line x1="320" y1="190" x2="320" y2="220" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#ar1)"/>
      <line x1="410" y1="170" x2="540" y2="210" stroke="#9b2c2c" stroke-width="1.2" marker-end="url(#ar2)"/>
      <rect x="30" y="210" width="180" height="44" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="120" y="230" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.2" font-weight="700" fill="#2f6157">参数/格式错误</text>
      <text x="120" y="246" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">改参数后重试</text>
      <rect x="230" y="220" width="180" height="44" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <text x="320" y="240" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.2" font-weight="700" fill="#8a6a1e">超时/限流</text>
      <text x="320" y="256" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">原样重试（退避）</text>
      <rect x="460" y="210" width="180" height="44" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="550" y="230" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.2" font-weight="700" fill="#9b2c2c">权限/业务拒绝</text>
      <text x="550" y="246" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">换方案 / 上报</text>
    </svg>
  </div>
  <figcaption><b>图 3</b>　回喂给模型的内容由「分类」决定，而不是由「失败了」三个字决定。<b>最隐蔽的坑是空结果</b>：它会被当成失败，引发「换关键词—再失败—再换」的空转，而日志里全是正常调用。</figcaption>
</figure>

## 二、错误分类：决定重试有没有意义

这是本章最有工程价值的部分，核心是 [[error-taxonomy|错误分类]]。工具执行失败时，Harness 只有两种选择：抛出异常终止，或者把错误回喂让模型换策略。而**回喂的内容决定了第二次尝试有没有意义**——尤其要注意 [[empty-result|空结果]]：查询成功但无数据，必须和「失败」区分开，否则模型会陷入换关键词空转。

<div class="tbl-wrap">
  <table class="news">
    <caption>错误分类 → 处理策略（这张表建议直接抄进你的代码）</caption>
    <thead><tr><th>错误类别</th><th>典型来源</th><th>该不该重试</th><th>回喂内容</th></tr></thead>
    <tbody>
      <tr><td><b>参数错误</b></td><td>字段缺失、类型不符、枚举越界</td><td>必须改参数后重试</td><td>指出具体哪个字段错、合法取值是什么</td></tr>
      <tr><td><b>格式错误</b></td><td>JSON 解析失败、日期格式不对</td><td>改格式后重试</td><td>给出正确格式的示例</td></tr>
      <tr><td><b>业务规则拒绝</b></td><td>不符合前置条件（如「订单已关闭」）</td><td>换方案，不重试</td><td>说明被拒原因与可能的替代路径</td></tr>
      <tr><td><b>权限不足</b></td><td>无权限访问该资源</td><td>重试无用</td><td>明确「重试无用」，建议上报或换目标</td></tr>
      <tr><td><b>资源不存在</b></td><td>对象已删除、ID 拼错</td><td>换目标后重试</td><td>提示确认标识是否正确</td></tr>
      <tr><td><b>超时 / 限流</b></td><td>下游慢、配额耗尽</td><td>可原样重试（退避）</td><td>提示是瞬时问题，可稍后重试</td></tr>
      <tr><td><b>上游 5xx</b></td><td>依赖服务故障</td><td>有限次重试</td><td>标为系统故障，避免模型反复自我怀疑</td></tr>
      <tr><td><b>结果为空</b></td><td>查询合法但无数据</td><td><b>不是错误</b></td><td>明确告知「查询成功但无结果」，防止模型以为工具坏了而反复重试</td></tr>
    </tbody>
  </table>
</div>

<div class="box box-warn">
  <span class="box-title">最后一行是隐形杀手</span>
  <p>「查询成功但无结果」被当成错误处理，会引发一类非常隐蔽的成本浪费：模型看到「失败」，于是换关键词重试；再失败，再换；直到预算耗尽。日志里看到的是一连串工具调用（看起来很正常），实际全程都在做无用功。</p>
  <p><b>修法：把「空结果」和「失败」在协议层就区分开</b>——返回值里带上明确的状态字段（如 <code>{"status":"ok","items":[]}</code>），回喂时也明确告诉模型「查询成功，但确实没有匹配数据，请考虑条件是否过严或该数据不存在」。</p>
</div>

## 三、让调用不可能出错：三层约束

按「结构的强制程度」从弱到强排列：

**第一层，描述约束。** 在描述里写清取值范围与范例。靠模型自觉，最弱但成本最低。

**第二层，schema 约束。** 用 JSON Schema 的 `enum`、`minimum`、`maximum`、`pattern`、`required` 把非法输入堵死，这本质上是在强制 [[structured-output|结构化输出]]。多数模型 API 在结构化输出模式下会直接保证符合 schema。

**第三层，[[pre-execution-validation|执行前校验]]。** 无论前面怎么写，Handler 入口必须再校验一遍——因为模型可能根本不走结构化输出通道，或者你做了参数转换。对有副作用的工具，还要配合 [[idempotency-key|幂等键]] 在重试时去重。

```python title="tool_contract.py"
from dataclasses import dataclass
from typing import Any, Callable
import json
@dataclass
class ToolResult:
    """统一返回协议：状态是显式的，绝不靠异常或空值暗示"""
    status: str            # ok | empty | bad_args | forbidden | not_found | timeout | upstream
    data: Any = None
    message: str = ""      # 给模型看的一句话说明
    retryable: bool = False
    side_effect_done: bool = False   # 副作用是否已经发生（决定能否安全重试）
    cost: float = 0.0
    def to_observation(self) -> str:
        """回喂给模型的字符串：状态 + 说明 + 精简数据"""
        head = f"[{self.status.upper()}] {self.message}"
        if self.data is None:
            return head
        body = json.dumps(self.data, ensure_ascii=False)
        return f"{head}\n{body[:1800]}"
def search_articles(q: str, limit: int = 10) -> ToolResult:
    # --- 第三层：执行前校验（不信任任何上游） ---
    if not isinstance(q, str) or not q.strip():
        return ToolResult("bad_args", message="参数 q 不能为空，请给出中文关键词。")
    if not (1 <= limit <= 20):
        return ToolResult("bad_args",
                          message=f"limit 必须在 1-20 之间，当前为 {limit}。",
                          data={"allowed": [1, 20]})
    try:
        rows = db_search(q, limit)                     # 真实查询
    except TimeoutError:
        return ToolResult("timeout", message="查询超时，这是瞬时问题，可原样重试。",
                          retryable=True)
    except PermissionError:
        return ToolResult("forbidden", message="当前身份无权访问该数据源，重试无用。")
    # --- 空结果不是错误 ---
    if not rows:
        return ToolResult("empty",
                          message=f"查询成功，但没有匹配「{q}」的文章。"
                                  f"建议换更宽的关键词，或确认该主题确实没有内容。",
                          data={"items": [], "hint": "可尝试同义词或去掉限定词"})
    return ToolResult("ok", data={"items": rows[:limit], "total": len(rows)},
                      message=f"命中 {len(rows)} 条。",
                      cost=0.001)
# ---------------------------------------------------------------
# 有副作用的工具必须带幂等键
# ---------------------------------------------------------------
IDEMPOTENCY_STORE: dict[str, ToolResult] = {}
def send_notification(user_id: str, text: str, idempotency_key: str) -> ToolResult:
    """
    不可逆操作的正确姿势：
      1. 要求调用方提供幂等键
      2. 同一个键重复调用直接返回上次结果，不重复执行
      3. 返回值必须说明「副作用是否已经发生」
    """
    if idempotency_key in IDEMPOTENCY_STORE:
        prev = IDEMPOTENCY_STORE[idempotency_key]
        return ToolResult("ok", data=prev.data,
                          message="该请求此前已成功执行过，本次未重复发送（幂等命中）。",
                          side_effect_done=True)
    if not text.strip():
        return ToolResult("bad_args", message="通知内容不能为空。")
    resp = api_send(user_id, text)                     # 真实发送
    res = ToolResult("ok", data={"message_id": resp["id"]},
                     message="已发送。", side_effect_done=True, cost=0.01)
    IDEMPOTENCY_STORE[idempotency_key] = res
    return res
def db_search(q, limit): raise NotImplementedError
def api_send(user_id, text): raise NotImplementedError
```



<div class="box box-key">
  <span class="box-title">幂等键为什么必须由调用方提供</span>
  <p>如果 Harness 自己生成幂等键（比如用时间戳），那么「超时后重试」会生成一个新键，幂等保护就完全失效了。正确做法是：<b>幂等键来自「这次操作代表什么意图」</b>——例如任务 ID + 步骤序号，或者用户请求 ID。这样重试时键不变，才能真正挡住重复副作用。</p>
  <p>面试里能把这一点讲清，基本可以确认你真的处理过线上幂等问题。</p>
</div>

## 四、什么时候该用 MCP

[[mcp|MCP]]（Model Context Protocol）解决的是**工具供给的标准化**问题，不是工具设计的质量问题。用不用的判据很清楚——有 [[side-effect-level|副作用等级]] 的工具在调用前必须确认，而 [[call-cost-hint|调用成本提示]] 能阻止模型反复敲昂贵接口：

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>场景</th><th>建议</th><th>理由</th></tr></thead>
    <tbody>
      <tr><td>工具要跨团队 / 跨产品复用</td><td><b>用 MCP</b></td><td>一次实现，多处接入，避免每个 Harness 各写一份适配层</td></tr>
      <tr><td>需要第三方生态（数据库、SaaS、设计工具）</td><td><b>用 MCP</b></td><td>直接复用现成 server，省掉接入成本</td></tr>
      <tr><td>工具只服务单一业务、调用链极短</td><td>直接用函数调用</td><td>引入 MCP 会多一层进程与协议开销，收益为负</td></tr>
      <tr><td>工具需要极致低延迟（如实时补全）</td><td>慎用</td><td>跨进程通信会引入额外延迟</td></tr>
      <tr><td>工具需要访问宿主私有状态</td><td>视情况</td><td>进程隔离有时是优点（安全边界清晰），有时是障碍</td></tr>
    </tbody>
  </table>
</div>

**但要记住：MCP 不解决工具描述写得差的问题。** 一个描述糟糕的 MCP 工具，接入之后依然会被误用。协议标准化与契约质量是两件事。

<p class="pull-quote">把工具当接口写，模型会当接口用——参数填得对，语义完全错。把工具当契约写，模型才知道你的系统期望它做什么。<cite>本刊编辑部</cite></p>

## 五、常见误区与追问

### 5.1 误区：工具描述是「文档」，写短一点省 token

错在哪：把描述当成占 token 的成本项，而不是决定成功率的输入。为什么自然：描述越长，每轮请求的常驻前缀越大，看着确实是在烧钱。判据：先算账再决定删不删——描述属于常驻前缀，前缀稳定时它被缓存复用，边际成本接近零；而描述含糊带来的每一次误调用，都要额外一轮「失败→回喂→重试」，那一轮的输入是完整上下文。所以「描述多写 300 token」和「多跑一轮 4k token」不是一个量级的取舍。<strong>要压就压真正冗余的部分</strong>，例如重复的业务背景、与调用无关的实现细节。

### 5.2 误区：把该写在 schema 里的约束写进系统提示词

错在哪：用概率性手段去实现确定性约束。为什么自然：改提示词看起来更快。判据：凡是能用 enum、minimum、maximum、required 表达的限制，都不该写进提示词——schema 约束下非法输入在结构上不可能出现，提示词约束下它只是变得不太可能。<strong>检查方法：把提示词里带数字或范围的句子抄出来，逐条问「这条能不能写成 schema 字段」；能改而没改的，就是留给线上事故的口子。</strong>提示词该留的是 schema 表达不了的东西：什么时候用、什么时候换别的。

### 5.3 误区：错误回喂就是把异常信息打印给模型

错在哪：把「让模型看到错误」当成「让模型能修正错误」。为什么自然：try/except 里直接拼一句 str(e) 只需要一行。判据：回喂内容必须回答三个问题——哪个字段错了、合法取值是什么、这次该不该重试。原始堆栈只能回答第一个，而且往往答不清：invalid literal 不会告诉模型 limit 应该落在 1–20。<strong>只回喂堆栈时，模型通常会原样重试 2–3 次才想到换参数，那是 2–3 轮完整上下文的成本；说清合法区间，第一次改参数就能过。</strong>

### 5.4 误区：有了重试就不需要幂等

错在哪：把「重试」和「重复执行」当成两件事，而不是同一件事的两种叫法。为什么自然：重试看起来只是再发一次请求，没人觉得危险。判据：最容易出事的是超时——服务端可能已经执行完、只是响应在路上丢了，此时重试就是第二次执行。挡住它的唯一办法是幂等键，而键必须由调用方按「操作意图」生成（任务 ID + 步骤序号），绝不能是时间戳或随机 UUID，否则每次重试都是新键，去重表永远命中不了。<strong>检查动作：把服务端的去重记录捞出来，看同一个业务对象有没有两条来自同一任务的记录。</strong>

### 5.5 误区：上了 MCP 就解决了工具接入的乱象

错在哪：把「供给标准化」当成「质量提升」。为什么自然：MCP 确实让同一份能力可以跨产品复用，看起来是全面的进步。判据：它解决的是「一次实现、N 处接入」的成本问题，一个字都没规定工具该怎样命名、描述怎么写、错误怎么分类。描述含糊的 MCP 工具接进来照样被误用，七要素一条都不能省。<strong>反过来也成立：如果这份能力只服务一个产品、调用链又极短，引入 MCP 只会多一层进程与协议开销，收益为负。</strong>所以判据是「它需不需要被第二个产品复用」，而不是「MCP 是不是更先进」。

## 六、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>第 2 题为高频考点</span></div>
  <div class="q-item" data-qid="harness03-q1" data-answer="1">
    <div class="q-text"><span class="idx">Q1</span>提升工具调用成功率最有效的单项改动通常是？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>增加重试次数</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>把工具描述补全为「做什么 + 何时用 + 参数格式与范例 + 返回结构」</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>降低 temperature</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>换成更强的模型</span></button>
    <div class="explain"><b>B。</b>重试与降温度都只是止损，换模型成本高昂且不可控。而描述补全是<b>一次性投入、长期生效</b>的改动——它直接消除了模型「不知道该填什么」的不确定性来源。这是 Harness 工程里投入产出比最高的优化之一。</div>
  </div>
  <div class="q-item" data-qid="harness03-q2" data-answer="3">
    <div class="q-text"><span class="idx">Q2</span>工具返回「查询成功但结果为空」，Harness 应该怎么处理？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>当作错误抛出，触发重试</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>什么都不回喂，让循环继续</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>当作失败，让模型换个工具</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>明确区分「成功但无数据」，回喂时说明条件可能过严或数据确实不存在，避免模型反复换关键词空转</span></button>
    <div class="explain"><b>D。</b>把空结果误判为失败，会让模型进入「换关键词—再失败—再换」的空转循环，日志上看全是正常的工具调用，成本却被无声烧掉。<b>协议层就把 <code>ok</code> 与 <code>empty</code> 分开，是性价比极高的一处修复。</b></div>
  </div>
  <div class="q-item" data-qid="harness03-q3" data-answer="0">
    <div class="q-text"><span class="idx">Q3</span>关于幂等键，下面哪个说法正确？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>幂等键应由调用方基于「这次操作的意图」生成，这样重试时键不变才能真正挡住重复副作用</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>幂等键用时间戳生成最简单，效果一样</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>幂等只在读操作上有意义</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>有了幂等键就不需要人工确认了</span></button>
    <div class="explain"><b>A。</b>时间戳生成（B）是最常见的错法：每次重试都得到新键，幂等形同虚设。C 反了——读操作天然幂等，<b>恰恰是写操作最需要幂等保护</b>。D 混淆了两件事：幂等解决「重复执行」，人工确认解决「是否该执行」，两者不可互相替代。</div>
  </div>
</div>

## 七、小结

- 工具是**契约**：名称、用途、参数、返回、幂等性、副作用等级、成本提示，七项齐全。
- 描述要回答四个问题：做什么 / 何时用 / 参数怎么填 / 返回什么。
- 错误要**分类**：可重试、必须改参数、重试无用，三类处理方式完全不同。
- **空结果不是错误**，必须在协议层与失败区分。
- 有副作用的操作要有幂等键，且键必须来自调用方。
- MCP 解决工具**供给标准化**，不解决工具**设计质量**。

下一章处理那个决定效果上限的层：模型到底能看到什么。

## 八、参考与延伸

工具这一层的理论文献很薄，但官方文档质量极高——因为各家模型厂都在教人怎么写工具。下面按「先看怎么写、再看协议、最后看怎么量」排好。全站不做原文转载，这里只登记链接与「为什么值得读」。

**先看怎么写（契约的四个层次）**

- [Anthropic · Writing Tools for Agents](https://www.anthropic.com/engineering/writing-tools-for-agents) —— 目前最接近「工具描述实操手册」的一篇：命名怎么起、描述该写哪几段、返回结构怎么设计、错误怎么回喂，都给了改前改后的对照。<strong>把它和本章第一节的七要素表并排放着看，重合的部分可以直接照抄着改你自己的工具——这是本章所有延伸材料里唯一「当天就能用」的一份。</strong>
- [Anthropic · Prompt Engineering Overview](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview) —— 标题像讲措辞，但有大半篇幅在讲工具定义、结构化输出这类确定性通道的正确用法。<strong>想彻底弄清「哪些约束该交给 schema、哪些只能靠提示词」，这一页把边界划得最清楚；本章第三层约束的设计标准就是从这里来的。</strong>

**再看协议（工具怎么供给）**

- [Model Context Protocol 官方站](https://modelcontextprotocol.io/) —— 规范、各语言 SDK、示例 server 都在这一站，读 Getting Started 一页足够建立全貌。<strong>本章第四节说「MCP 解决供给标准化、不解决设计质量」，读完规范你会确认这一点：它定义的是传输与方法，一个字都没规定描述该怎么写。</strong>
- [OpenAI Cookbook](https://developers.openai.com/cookbook) —— 函数调用、结构化输出、并行工具调用都有可直接跑的 notebook。<strong>想验证「schema 约束到底能拦住多少错参数」，照它的结构化输出示例改一版你自己的工具，一个下午就能拿到自己的数据，而不必相信任何人的说法。</strong>

**最后看怎么量（调用得对不对）**

- [τ-bench（sierra-research/tau-bench）](https://github.com/sierra-research/tau-bench) —— 它的评分同时看「参数是否准确」和「是否在正确的时机调用了正确的工具」。<strong>这正好对应本章强调的那条区别：参数填对但语义用错，是最难被单测发现的失败形态；只统计工具调用成功率是看不出来的。</strong>
