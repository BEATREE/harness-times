---
chapter: knowledge-04-hybrid-trust
lead: '召回要宽、排序要准、引用要能被点开验证——这是检索系统的三件事。这一章把关键词检索与向量检索拼成一条混合链路，用 Rerank 做精排，最后解决最容易被跳过的问题：凭什么相信这条知识。'
note: '本章是知识引擎部分的收尾，也是三章内容的汇总：实体（第 1 章）→ 检索链路（第 2 章）→ 向量边界（第 3 章）→ 混合与可信（本章）。'
---

<p class="dropcap">前三章分别解决了一个环节的问题。这一章把它们接起来，处理两个更高层的问题：怎么让两路检索的结果合理融合，以及怎么让用户敢相信系统给的答案。后者看起来是产品问题，实际上是工程问题——它取决于你能不能给出可验证的引用。</p>

## 一、混合检索：两路互补

第 3 章讲清了向量检索的三类失效场景，也讲清了关键词检索的短板（无法处理同义表达）。两者恰好互补。

<div class="tbl-wrap">
  <table class="news">
    <caption>两种检索的互补关系</caption>
    <thead><tr><th>查询类型</th><th>关键词/BM25</th><th>向量检索</th><th>混合后</th></tr></thead>
    <tbody>
      <tr><td>精确标识符（ERR_45004）</td><td><b>强</b>：精确命中</td><td>弱：被语义泛化淹没</td><td>关键词主导</td></tr>
      <tr><td>同义表达（提高复购的方式）</td><td>弱：词不匹配就找不到</td><td><b>强</b>：语义等价</td><td>向量主导</td></tr>
      <tr><td>否定/极性（不支持批量）</td><td><b>强</b>：词序与否定词可精确匹配</td><td>弱：极性几乎无位移</td><td>关键词补位</td></tr>
      <tr><td>长问题/多概念（如何降低新客流失）</td><td>弱：需要词全部出现</td><td><b>强</b>：整句语义理解</td><td>向量主导</td></tr>
      <tr><td>短查询（转化率）</td><td>中：词命中但排序粗</td><td>中：语义泛但噪音多</td><td>两者接近，靠重排补救</td></tr>
    </tbody>
  </table>
</div>

融合方式有两种，各有取舍：

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>方式</th><th>做法</th><th>优点</th><th>缺点</th></tr></thead>
    <tbody>
      <tr><td><b>加权分数和</b></td><td>两路分数各自归一化后按权重相加</td><td>可解释，权重可调</td><td>两路分数的分布差异大，归一化本身会引入偏差；需要调参</td></tr>
      <tr><td><b>RRF（倒数排名融合）</b></td><td>只看排名不看分数：<code>Σ 1/(k + rank_i)</code></td><td><b>无需归一化，鲁棒性好，几乎不用调参</b></td><td>丢失了分数幅度的信息</td></tr>
    </tbody>
  </table>
</div>

<div class="box box-key">
  <span class="box-title">为什么推荐 RRF</span>
  <p>两路检索的分数尺度往往不同：向量相似度可能落在 0.2-0.9，BM25 分数可能是 3.7、12.4、45.1 这种没有固定上界的值。强行归一化再加权，等于用一个不稳定的映射去调和两个不可比的量。</p>
  <p>RRF 绕开了这个问题：<b>它只关心「在这一路里排第几」，不关心分数是多少。</b>经验上，RRF 在多数场景下接近调好权重的加权和，而且几乎不需要调参。这是一个工程上非常实用的取舍。</p>
</div>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 420" role="img" aria-label="混合检索的完整链路：关键词与向量并行召回后用 RRF 融合再精排">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">混合检索链路：召回宽 → 融合稳 → 精排准</text>
      <!-- 查询 -->
      <rect x="248" y="36" width="164" height="34" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.3"/>
      <text x="330" y="58" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" fill="#1f1b16">查询 + 实体归一 + 条件抽取</text>
      <!-- 分叉 -->
      <line x1="330" y1="70" x2="330" y2="88" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="120" y1="88" x2="540" y2="88" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="120" y1="88" x2="120" y2="106" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#arH)"/>
      <line x1="540" y1="88" x2="540" y2="106" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#arH)"/>
      <defs>
        <marker id="arH" markerWidth="9" markerHeight="9" refX="4" refY="1" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <!-- 关键词路 -->
      <rect x="16" y="108" width="208" height="86" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="28" y="128" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#2f6157">关键词 / BM25</text>
      <text x="28" y="146" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">精确串匹配、否定词、编号</text>
      <text x="28" y="162" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">元数据过滤下推</text>
      <text x="28" y="180" font-family="ui-monospace, monospace" font-size="8.8" fill="#2f6157">取 top-50，记录排名</text>
      <!-- 向量路 -->
      <rect x="436" y="108" width="208" height="86" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="448" y="128" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#9b2c2c">向量检索</text>
      <text x="448" y="146" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">语义等价、跨语言、长问题</text>
      <text x="448" y="162" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">同一套元数据过滤</text>
      <text x="448" y="180" font-family="ui-monospace, monospace" font-size="8.8" fill="#9b2c2c">取 top-50，记录排名</text>
      <!-- 融合 -->
      <line x1="120" y1="194" x2="120" y2="212" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="540" y1="194" x2="540" y2="212" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="120" y1="212" x2="540" y2="212" stroke="#1f1b16" stroke-width="1.2"/>
      <line x1="330" y1="212" x2="330" y2="230" stroke="#b8944b" stroke-width="1.6" marker-end="url(#arHg)"/>
      <defs>
        <marker id="arHg" markerWidth="9" markerHeight="9" refX="4" refY="1" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#b8944b"/>
        </marker>
      </defs>
      <rect x="196" y="232" width="268" height="52" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.4"/>
      <text x="330" y="252" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#8a6a1e">RRF 融合　Σ 1/(60 + rank)</text>
      <text x="330" y="270" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">只看排名，不看分数 → 无需归一化</text>
      <!-- 精排 -->
      <line x1="330" y1="284" x2="330" y2="302" stroke="#2f6157" stroke-width="1.6" marker-end="url(#arKg2)"/>
      <defs>
        <marker id="arKg2" markerWidth="9" markerHeight="9" refX="4" refY="1" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#2f6157"/>
        </marker>
      </defs>
      <rect x="196" y="304" width="268" height="52" fill="#eef4f1" stroke="#2f6157" stroke-width="1.4"/>
      <text x="330" y="324" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="700" fill="#2f6157">Rerank 交叉编码器精排</text>
      <text x="330" y="342" text-anchor="middle" font-family="ui-monospace, monospace" font-size="8.8" fill="#6b6257">查询与候选一起过模型 → 截断到 top-6</text>
      <!-- 交付 -->
      <line x1="330" y1="356" x2="330" y2="374" stroke="#1f1b16" stroke-width="1.6" marker-end="url(#arH)"/>
      <rect x="116" y="376" width="428" height="34" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.3"/>
      <text x="330" y="398" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.4" fill="#1f1b16">带来源 / 时间 / 层级的证据块 → 组装进上下文，并保留可点开的引用</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　混合检索的三段式：<b>两路并行召回（各取 50）→ RRF 融合（只看排名）→ Rerank 精排（截断到 6）</b>。注意两路必须用同一套元数据过滤条件，否则融合时会混入不该出现的内容。</figcaption>
</figure>

## 二、Rerank：为什么必须有

初排（无论是 BM25 还是向量）都有一个结构性缺陷：**查询和文档是分别编码的，没有任何交互。** 向量检索把查询编码成一个点、文档编码成一个点，然后比距离——这个过程里查询和文档从未「见过」对方。

交叉编码器（Cross-Encoder）改变了这一点：它把「查询 + 候选文档」拼成一段输入，一起过模型，输出一个相关性分数。这样模型能捕捉两者之间的细粒度交互（同一个词在查询里和在文档里是否指向同一件事）。

<div class="tbl-wrap">
  <table class="news">
    <caption>初排与精排的取舍</caption>
    <thead><tr><th></th><th>初排（向量 / BM25）</th><th>精排（Cross-Encoder）</th></tr></thead>
    <tbody>
      <tr><td>查询-文档交互</td><td>无（各自编码后比距离）</td><td><b>有</b>（拼在一起过模型）</td></tr>
      <tr><td>速度</td><td>极快（可预计算、可 ANN）</td><td>慢（每条候选都要跑一次模型）</td></tr>
      <tr><td>可扩展性</td><td>百万级文档可用</td><td>只适合几十到几百条候选</td></tr>
      <tr><td>适用位置</td><td>召回阶段</td><td>精排阶段（在召回之后）</td></tr>
    </tbody>
  </table>
</div>

<div class="box box-warn">
  <span class="box-title">一个常见的过度优化</span>
  <p>有人会想：「既然精排更准，那是不是可以不用初排，直接对所有文档精排？」</p>
  <p>不行。精排需要对每一条候选跑一次模型前向，成本与文档量成线性关系。<b>一万篇文档每次查询都跑一遍交叉编码器，延迟会到秒级甚至更高。</b>正确的分工是：初排把候选从百万级降到几十级（哪怕排得不够准），精排在这几十条里排序（准且成本可接受）。<b>「召回宁可宽、排序必须准」是这套架构的核心。</b></p>
</div>

## 三、可信：让引用能被点开验证

这是本章最有价值的部分，也是多数系统做得最差的部分。

**「有引用」和「引用可信」是两件不同的事。** 很多系统会让模型生成类似「根据相关资料，转化率为 1.1%」的表述——这看起来有依据，但用户无法验证，因为「相关资料」是模糊的。

<div class="tbl-wrap">
  <table class="news">
    <caption>引用可信度的四个等级</caption>
    <thead><tr><th>等级</th><th>形态</th><th>用户能不能验证</th><th>实现成本</th></tr></thead>
    <tbody>
      <tr><td>L0 无引用</td><td>直接给结论</td><td>不能</td><td>无</td></tr>
      <tr><td>L1 模糊引用</td><td>「根据相关资料」「参考了相关文档」</td><td>不能（等于没有）</td><td>无</td></tr>
      <tr><td>L2 可定位引用</td><td>「来源：2025Q3 经营分析报告 第 3.2 节」</td><td>能（能找到原文）</td><td>低：块里已有来源字段</td></tr>
      <tr><td><b>L3 可点开验证</b></td><td>引用是链接，点开直达原文位置，且能看到更新时间与口径版本</td><td><b>能，且成本极低</b></td><td>中：需要 URL 与锚点</td></tr>
    </tbody>
  </table>
</div>

**目标至少要做到 L2，推荐 L3。** 实现要点有三个：

**第一，引用标识必须在上下文里就给到模型。** 每个证据块带上一个短 ID 和来源，并要求模型在结论后用这个 ID 标注依据。这样引用关系是模型「抄」的，不是它「编」的。

**第二，引用要能落到具体位置，而不只是文档级。** 「出自某文档」不够，要能到「第 3 节第 2 段」。

**第三，矛盾的证据要同时呈现。** 如果两路检索召回了互相冲突的内容，不要静默选一个——把两个都列出来并标注来源与时间，让用户判断。<b>这一点与第 1 章、第 5 章的原则完全一致：不假装自己知道答案。</b>

```python title="hybrid_trust.py"
from dataclasses import dataclass, field
@dataclass
class Evidence:
    """带可验证信息的证据块"""
    eid: str                       # 短 ID，供模型在回答里引用
    text: str
    source: str                    # 来源标识
    url: str = ""                  # 可点开的位置（含锚点）
    anchor: str = ""               # 定位信息：章节 / 段落号
    updated_at: str = ""
    tier: str = "fact"             # fact | inference
    caliber: str = ""              # 口径版本（数值类必须有）
    vec_rank: int | None = None
    kw_rank: int | None = None
    def cite(self) -> str:
        return f"[{self.eid}]"
    def render(self) -> str:
        """上下文里的形态：短 ID + 正文 + 来源信息，三者齐全"""
        loc = self.anchor or self.source
        extra = f"｜口径 {self.caliber}" if self.caliber else ""
        return (f"[{self.eid}] {self.text}\n"
                f"     来源：{self.source}　位置：{loc}　更新：{self.updated_at}"
                f"{extra}　层级：{self.tier}")
def rrf_fuse(vec_ranked: list[str], kw_ranked: list[str], k: int = 60) -> list[tuple[str, float]]:
    """
    RRF：只依赖排名，无需归一化。
    k 一般取 60（原论文经验值），作用是压低头部排名的相对优势，让两路更均衡。
    """
    scores: dict[str, float] = {}
    for ranked in (vec_ranked, kw_ranked):
        for rank, doc_id in enumerate(ranked, start=1):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank)
    return sorted(scores.items(), key=lambda x: -x[1])
def build_citations(evidences: list[Evidence], answer: str) -> dict:
    """
    后置校验：检查回答里引用的 ID 是否真实存在。
    模型可能引用一个不存在的编号 —— 这类幻觉必须被抓住。
    """
    valid = {e.eid for e in evidences}
    used = set()
    for e in evidences:
        if e.cite() in answer:
            used.add(e.eid)
    unknown = [x for x in extract_cite_ids(answer) if x not in valid]
    return {
        "used": sorted(used),
        "unused": sorted(valid - used),
        "hallucinated": unknown,        # 引用了不存在的证据 → 需要重试或降级
        "credible": len(unknown) == 0 and len(used) > 0,
        "checklist": [{"eid": e.eid, "url": e.url, "source": e.source}
                      for e in evidences if e.eid in used],
    }
def conflict_pairs(evidences: list[Evidence]) -> list[tuple[Evidence, Evidence]]:
    """
    同指标不同值的证据 → 必须同时呈现，不能静默选一个。
    判定条件：同一 source 主题、同期、同为 fact、值不同。
    """
    out = []
    for i in range(len(evidences)):
        for j in range(i + 1, len(evidences)):
            a, b = evidences[i], evidences[j]
            if a.tier == b.tier == "fact" and a.caliber == b.caliber and same_metric(a, b):
                if extract_value(a.text) != extract_value(b.text):
                    out.append((a, b))
    return out
CITE_RE = r"\[(E\d{1,3})\]"
def extract_cite_ids(text: str) -> list[str]:
    import re
    return re.findall(CITE_RE, text)
def same_metric(a: Evidence, b: Evidence) -> bool:
    return False        # 占位：真实实现比对指标名
def extract_value(text: str) -> str:
    return ""           # 占位：真实实现抽取数值
def provenance_block(evidences: list[Evidence]) -> str:
    """
    产物的「证据清单」区块：放在报告末尾，
    让用户能逐条点开核对。这是信任的最后一公里。
    """
    lines = ["本产物的依据来源："]
    for e in evidences:
        loc = e.anchor or "—"
        link = e.url or "（无链接）"
        lines.append(f"  {e.eid}　{e.source}　{loc}　更新 {e.updated_at}　{link}")
    return "\n".join(lines)
```



<div class="box box-practice">
  <span class="box-title">实操任务</span>
  <ul>
    <li>给你的检索结果加上短 ID 与来源，并要求模型在结论后标注依据 ID；用 <code>build_citations()</code> 检查有没有「引用了不存在的 ID」；</li>
    <li>实现「证据清单」区块：把用到的证据连同可点开的链接附在产物末尾，用人工方式核对 10 条；</li>
    <li>构造一组「同指标不同值」的证据，验证 <code>conflict_pairs()</code> 能检出，并设计一段话术同时呈现两者。</li>
  </ul>
  <p style="margin-top:10px"><b>验收标准：</b>随手指一条结论，你都能在 10 秒内在系统里点开它的原始依据，并看到该依据的更新时间与口径版本。</p>
</div>

## 四、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>第 1、3 题为高频考点</span></div>
  <div class="q-item" data-qid="knowledge04-q1" data-answer="1">
    <div class="q-text"><span class="idx">Q1</span>为什么推荐 RRF 而不是加权分数和来融合两路检索？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>因为 RRF 计算更快</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>因为两路分数的尺度不可比（向量相似度在固定区间，BM25 无固定上界），归一化会引入不稳定偏差；RRF 只看排名，无需归一化且几乎不用调参</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>因为 RRF 能保留分数幅度的信息</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>因为加权分数和无法处理超过两路的结果</span></button>
    <div class="explain"><b>B。</b>C 说反了——RRF <b>恰好</b>丢掉了分数幅度信息，这正是它的取舍所在。核心问题在于：把 0.2-0.9 的向量相似度和没有上界的 BM25 分数放在一起加权，需要一个不稳定的映射。<b>RRF 用「只看名次」绕开了整个问题，工程上非常划算。</b></div>
  </div>
  <div class="q-item" data-qid="knowledge04-q2" data-answer="3">
    <div class="q-text"><span class="idx">Q2</span>为什么不直接对所有文档做 Rerank，跳过初排？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>因为 Rerank 模型只能处理 10 条输入</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>因为 Rerank 的准确率不如向量检索</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>因为 Rerank 无法处理长文档</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>因为交叉编码器要对每条候选跑一次模型前向，成本与文档量线性相关，全量精排会带来秒级延迟</span></button>
    <div class="explain"><b>D。</b>这是「召回宽、排序准」这套分工的根本原因：<b>初排的作用不是排得准，而是把候选从百万级降到几十级</b>，让精排的成本变得可接受。想跳过初排，就像想「跳过筛选直接面试所有候选人」——逻辑上更准，实际上不可行。</div>
  </div>
  <div class="q-item" data-qid="knowledge04-q3" data-answer="2">
    <div class="q-text"><span class="idx">Q3</span>模型在回答里标注了 [E7]，但证据列表里只有 E1-E5。应该怎么处理？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>忽略这个引用，正常返回</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>把 [E7] 替换成最接近的 E5</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>判定为引用幻觉，不应把该回答直接交付——应重试、降级为「无依据」表述，或标记该条为待人工核对</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>把 E7 加入证据列表</span></button>
    <div class="explain"><b>C。</b>引用幻觉是「有引用」但「引用不可信」的典型形态，它比无引用更危险——因为它看起来有据可查。A 和 B 都是在掩盖问题，D 是伪造证据。<b>正确做法是在后置校验里抓住它，并明确降级处理</b>：要么重试，要么把这条结论改写为「未找到依据」，要么标记待核。</div>
  </div>
</div>

## 五、小结

| 环节 | 做法 | 要点 |
| --- | --- | --- |
| 双路召回 | 关键词（BM25）+ 向量，各取 top-50 | 两路必须用同一套元数据过滤条件 |
| 融合 | RRF：`Σ 1/(60 + rank)` | 只看排名，无需归一化，免调参 |
| 精排 | Rerank 交叉编码器，截断到 6 条 | 查询与候选一起过模型，捕捉细粒度交互 |
| 引用 | 证据块带短 ID、来源、位置、更新时间、口径版本 | 目标至少 L2，推荐 L3 可点开 |
| 校验 | 后置检查引用 ID 是否真实存在 | 抓住引用幻觉，降级而非掩盖 |
| 冲突 | 同指标不同值的证据必须同时呈现 | 不静默选边 |

<p class="pull-quote">信任不是靠「我们的答案很准」建立的，而是靠「你随时可以自己去核对」建立的。后者是工程能提供的东西，前者只是承诺。<cite>本刊编辑部</cite></p>

至此四个知识版块全部读完。回到进度页，看看你的完成度，并把还没掌握的部分加入复习队列——这些内容的价值不在于读一遍，而在于面试前能脱口而出。
