---
chapter: knowledge-02-rag
lead: '「RAG 就是检索加生成」是这句话最大的问题——它把一个六个环节的链路压成了两个词，于是每个环节的失效模式都被忽略了。这一章把链路拆开，逐段列出失效模式与定位手段，最后给出一份可执行的排查顺序。'
note: '本章的失效模式表是实操清单，建议直接拿它去排查你手上的检索系统。'
---

<p class="dropcap">先纠正一个说法。「检索 + 生成」描述的是结果，不是过程。真实的链路有六个环节，而每个环节都能独立地把最终结果做错——而且错得毫无痕迹，你只能看到「回答不对」，看不到是哪一环出了问题。</p>

## 一、六个环节

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 420" role="img" aria-label="RAG 的六个环节及每个环节的失效模式">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">RAG 链路：六个环节，六个失效点</text>
      <!-- 1 查询理解 -->
      <rect x="16" y="38" width="196" height="112" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.3"/>
      <text x="28" y="58" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#1f1b16">① 查询理解</text>
      <text x="28" y="76" font-family="ui-monospace, monospace" font-size="8.7" fill="#6b6257">把用户口语转成检索意图：</text>
      <text x="28" y="91" font-family="ui-monospace, monospace" font-size="8.7" fill="#6b6257">实体归一、指代消解、改写</text>
      <line x1="28" y1="98" x2="200" y2="98" stroke="#1f1b16" stroke-width="0.7"/>
      <text x="28" y="114" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ 指代未消解（「它」指谁？）</text>
      <text x="28" y="129" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ 别名未归一（华东/东区）</text>
      <text x="28" y="144" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ 口语未改写（「卖得好吗」）</text>
      <!-- 2 切分 -->
      <rect x="232" y="38" width="196" height="112" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <text x="244" y="58" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#8a6a1e">② 切分 Chunking</text>
      <text x="244" y="76" font-family="ui-monospace, monospace" font-size="8.7" fill="#6b6257">把文档切成可检索的单元</text>
      <line x1="244" y1="84" x2="416" y2="84" stroke="#b8944b" stroke-width="0.7"/>
      <text x="244" y="100" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ 语义切断：答案被切在两块</text>
      <text x="244" y="115" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ 块过大：噪音多、匹配模糊</text>
      <text x="244" y="130" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ 块过小：丢上下文与前提</text>
      <text x="244" y="145" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ 表格/图表被切成乱码</text>
      <!-- 3 索引 -->
      <rect x="448" y="38" width="196" height="112" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="460" y="58" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#2f6157">③ 索引 Indexing</text>
      <text x="460" y="76" font-family="ui-monospace, monospace" font-size="8.7" fill="#6b6257">向量化 + 建索引</text>
      <line x1="460" y1="84" x2="632" y2="84" stroke="#2f6157" stroke-width="0.7"/>
      <text x="460" y="100" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ 嵌入模型换了但没重建</text>
      <text x="460" y="115" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ 元数据没入索引（无法过滤）</text>
      <text x="460" y="130" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ 增量更新遗漏，索引与源不一致</text>
      <!-- 4 召回 -->
      <rect x="16" y="162" width="196" height="112" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="28" y="182" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#9b2c2c">④ 召回 Retrieval</text>
      <text x="28" y="200" font-family="ui-monospace, monospace" font-size="8.7" fill="#6b6257">从索引里取回候选</text>
      <line x1="28" y1="208" x2="200" y2="208" stroke="#9b2c2c" stroke-width="0.7"/>
      <text x="28" y="224" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ top-k 太小：漏掉关键块</text>
      <text x="28" y="239" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ 无过滤：取回错误版本的文档</text>
      <text x="28" y="254" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ 纯向量：精确匹配的词反而漏</text>
      <text x="28" y="269" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ 无时间过滤：旧版本被召回</text>
      <!-- 5 重排 -->
      <rect x="232" y="162" width="196" height="112" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="244" y="182" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#2f6157">⑤ 重排 Rerank</text>
      <text x="244" y="200" font-family="ui-monospace, monospace" font-size="8.7" fill="#6b6257">对候选做精排</text>
      <line x1="244" y1="208" x2="416" y2="208" stroke="#2f6157" stroke-width="0.7"/>
      <text x="244" y="224" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ 跳过了重排，直接按相似度排</text>
      <text x="244" y="239" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ 重排模型与语料语言不匹配</text>
      <text x="244" y="254" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ 截断到 N 条时丢了关键证据</text>
      <!-- 6 组装 -->
      <rect x="448" y="162" width="196" height="112" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <text x="460" y="182" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#8a6a1e">⑥ 组装与生成</text>
      <text x="460" y="200" font-family="ui-monospace, monospace" font-size="8.7" fill="#6b6257">拼上下文 → 生成回答</text>
      <line x1="460" y1="208" x2="632" y2="208" stroke="#b8944b" stroke-width="0.7"/>
      <text x="460" y="224" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ 缺来源标注：模型无从判断可信</text>
      <text x="460" y="239" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ 上下文超限被截断：证据丢失</text>
      <text x="460" y="254" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ 没给「无相关资料」的出口</text>
      <text x="460" y="269" font-family="ui-monospace, monospace" font-size="8.7" fill="#9b2c2c">✗ 引用无法点开核对</text>
      <!-- 排查顺序 -->
      <rect x="16" y="288" width="628" height="118" fill="#fbf8f2" stroke="#1f1b16" stroke-width="1.3"/>
      <text x="30" y="308" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#1f1b16">排查顺序：从后往前，二分定位</text>
      <text x="30" y="328" font-family="ui-monospace, monospace" font-size="9.1" fill="#6b6257">Step 1　把标准答案所在的原文块，手工塞进上下文 → 模型能答对吗？</text>
      <text x="30" y="344" font-family="ui-monospace, monospace" font-size="9.1" fill="#2f6157">　　 能 → 问题在 ①-⑤（检索链路）；不能 → 问题在 ⑥（组装/生成）或模型能力</text>
      <text x="30" y="364" font-family="ui-monospace, monospace" font-size="9.1" fill="#6b6257">Step 2　检查召回结果里有没有那个块（把 top-k 调到 100 看）</text>
      <text x="30" y="380" font-family="ui-monospace, monospace" font-size="9.1" fill="#b8944b">　　 有 → 问题在 ⑤（排序）或 top-k 太小；没有 → 问题在 ①②③（建模/切分/索引）</text>
      <text x="30" y="398" font-family="ui-monospace, monospace" font-size="9.1" fill="#6b6257">Step 3　用原文里的关键词直接做全文检索，能不能找到那个块？</text>
      <text x="30" y="412" font-family="ui-monospace, monospace" font-size="9.1" fill="#9b2c2c">　　 能找到 → 是语义检索的问题（换嵌入模型或加混合检索）；找不到 → 切分或索引有问题</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　RAG 六环节与各自的失效模式，以及底部那段排查顺序。<b>排查的关键是「从后往前二分」</b>——先用「手工塞原文」把问题区间砍成两半，再逐段收敛。很多团队一上来就换嵌入模型，实际上问题往往出在切分（②）上。</figcaption>
</figure>

## 二、切分：最被低估的环节

如果说有一个环节的投入产出比最高，那就是切分。原因很简单：**切错了的内容，后面用再好的模型也救不回来。**

<div class="tbl-wrap">
  <table class="news">
    <caption>四种切分策略与适用场景</caption>
    <thead><tr><th>策略</th><th>做法</th><th>适合</th><th>风险</th></tr></thead>
    <tbody>
      <tr><td>固定长度</td><td>每 N 个字符切一刀</td><td>无结构的长文本</td><td><b>必然切断语义</b>，只能作为最后手段</td></tr>
      <tr><td>按结构</td><td>按标题层级 / 段落 / 列表项切</td><td>有明确结构的文档（规范、报告）</td><td>依赖文档结构质量；层级过深时块会很小</td></tr>
      <tr><td>按语义</td><td>相邻句子语义相似度骤降处切开</td><td>叙述性长文</td><td>计算成本高；结果不稳定，难调试</td></tr>
      <tr><td>父子块</td><td>小块用于检索，命中后返回其所属的大块</td><td><b>推荐默认方案</b></td><td>实现复杂度略高；需维护父子映射</td></tr>
    </tbody>
  </table>
</div>

<div class="box box-key">
  <span class="box-title">父子块为什么值得作为默认方案</span>
  <p>它同时解决了「块小则上下文不足」与「块大则匹配模糊」这对矛盾：</p>
  <ul>
    <li><b>检索阶段用小块</b>——句子级的块语义聚焦，与查询的语义匹配更准，不会被整段里的无关内容稀释；</li>
    <li><b>返回阶段给大块</b>——命中后返回它所属的段落或整个小节，保证模型拿到完整的前提与上下文；</li>
    <li>顺带的收益：可以只对小块做嵌入（数量多但每个都短），索引成本可控。</li>
  </ul>
</div>

**三个切分的实操细节**（都很容易被忽略）：

1. **重叠（overlap）是必要的。** 相邻块之间保留 10%-20% 的重叠，可以显著降低「答案被切断」的概率。代价是索引体积变大。
2. **表格必须特殊处理。** 表格按字符切会变成乱码。正确做法是把表格转为 Markdown 或自然语言描述（「表头为 地区/转化率，华东行取值为 1.1%」），作为整体一个块。
3. **每个块都要带上层级路径。** 块的开头附上「文档标题 > 一级标题 > 二级标题」，这既能提升检索准确率（路径参与嵌入），也让模型知道这段内容的语境。

## 三、动手：可调参的检索链路

<div class="code-block">
  <div class="code-head"><span>rag_pipeline.py</span><span class="lang">python</span></div>
  <pre><code>from dataclasses import dataclass, field
from typing import Callable
import re
@dataclass
class Chunk:
    id: str
    text: str
    parent_id: str | None = None     # 父子块：指向所属的大块
    path: str = ""                   # 层级路径：文档 > 章节 > 小节
    meta: dict = field(default_factory=dict)   # source, updated_at, version, lang
    def embed_text(self) -> str:
        """参与嵌入的文本：带上层级路径，提升语义匹配质量"""
        return f"{self.path}\n{self.text}" if self.path else self.text
@dataclass
class RagConfig:
    top_k: int = 20                  # 召回条数（先宽）
    top_n: int = 6                   # 精排后保留条数
    min_score: float = 0.0           # 分数下限，低于此值视为无关
    require_meta: dict | None = None # 必须满足的元数据过滤，如 {"lang": "zh"}
    max_chars_per_chunk: int = 3000  # 单块入上下文的字符上限
def retrieve(query: str, cfg: RagConfig, embed, search) -> list[Chunk]:
    """
    召回阶段。注意三点：
      1. 元数据过滤必须在召回时做，而不是后面过滤 —— 否则 top-k 会被无关内容占满
      2. 先宽召回，再精排（top_k > top_n）
      3. 分数下限很重要：宁可返回空，也不要用低相关内容凑数
    """
    vec = embed(query)
    raw = search(vec, k=cfg.top_k, filters=cfg.require_meta)
    picked = [c for c, score in raw if score >= cfg.min_score]
    return picked
def expand_parents(chunks: list[Chunk], get_parent: Callable[[str], Chunk]) -> list[Chunk]:
    """命中子块后膨胀为父块，但去重 —— 命中同一父块的多个子块只保留一个"""
    seen, out = set(), []
    for c in chunks:
        if c.parent_id and c.parent_id not in seen:
            seen.add(c.parent_id)
            out.append(get_parent(c.parent_id))
        elif not c.parent_id:
            out.append(c)
    return out
def build_rag_context(query: str, cfg: RagConfig, embed, search,
                      rerank, get_parent) -> tuple[str, dict]:
    """
    完整链路 + 诊断信息。
    诊断信息是必须的 —— 没有它，出了问题只能靠猜。
    """
    diag = {}
    # ④ 召回
    cand = retrieve(query, cfg, embed, search)
    diag["召回条数"] = len(cand)
    diag["召回来源分布"] = {}
    for c in cand:
        s = c.meta.get("source", "unknown")
        diag["召回来源分布"][s] = diag["召回来源分布"].get(s, 0) + 1
    if not cand:
        return ("（未检索到相关资料。请明确说明信息不足，不要凭推测作答。）", diag)
    # ⑤ 重排
    ranked = rerank(query, cand)[: cfg.top_n]
    diag["重排后条数"] = len(ranked)
    diag["最高分来源"] = ranked[0].meta.get("source") if ranked else None
    # 父子块膨胀
    expanded = expand_parents(ranked, get_parent)
    diag["膨胀后条数"] = len(expanded)
    # ⑥ 组装：必须带来源、时间、层级；超限要明确标注截断
    lines, used, dropped = [], 0, 0
    for c in expanded:
        body = c.text
        if len(body) > cfg.max_chars_per_chunk:
            body = body[: cfg.max_chars_per_chunk] + "……[内容过长已截断]"
        block = (f"【来源 {c.meta.get('source','未知')}｜"
                 f"更新 {c.meta.get('updated_at','未知')}｜"
                 f"层级 {c.path or '—'}】\n{body}")
        lines.append(block)
        used += len(block)
    if dropped:
        lines.append(f"（另有 {dropped} 条因长度限制未纳入）")
    head = ("以下为检索到的材料。请严格基于这些材料回答，"
            "并在结论处标注依据的来源。若材料不足以回答，请直接说明不足，不要推测。\n\n")
    diag["上下文总字符"] = used
    return head + "\n\n".join(lines), diag
def split_by_structure(doc: str, doc_title: str, target: int = 600,
                       overlap: int = 100) -> list[Chunk]:
    """
    结构化切分（默认推荐）：按标题切，超长再按段落切，段落仍超长才按长度切。
    每块都带上层级路径。
    """
    chunks: list[Chunk] = []
    # 简易实现：以 Markdown 标题为界
    sections = re.split(r"\n(?=#{1,3} )", doc)
    idx = 0
    for sec in sections:
        title = ""
        m = re.match(r"(#{1,3}) (.+)", sec)
        if m:
            title = m.group(2).strip()
        path = f"{doc_title} > {title}" if title else doc_title
        # 超长段落再按长度切，保留重叠
        if len(sec) <= target:
            chunks.append(Chunk(id=f"c{idx}", text=sec.strip(), path=path)); idx += 1
        else:
            start = 0
            while start < len(sec):
                piece = sec[start: start + target]
                chunks.append(Chunk(id=f"c{idx}", text=piece.strip(), path=path))
                idx += 1
                start += target - overlap
    return chunks
def table_to_text(rows: list[list[str]]) -> str:
    """
    表格处理：不要按字符切表格。
    转成「每行一句」的自然语言，作为一个整体块。
    """
    if not rows:
        return ""
    header = rows[0]
    lines = []
    for r in rows[1:]:
        pairs = ", ".join(f"{h}为{v}" for h, v in zip(header, r))
        lines.append(f"该表一行记录：{pairs}")
    return f"表头：{', '.join(header)}\n" + "\n".join(lines)
</code></pre>
</div>

<div class="box box-practice">
  <span class="box-title">实操任务</span>
  <ul>
    <li>挑 10 个「检索失败」的查询，按图 1 底部的三步排查顺序定位，统计各环节的失败占比；</li>
    <li>把 <code>top_k</code> 从 20 调到 100，看那个「本应命中却没命中」的块是否出现——如果出现，说明问题是排序而不是召回；</li>
    <li>实现父子块：<code>target=300</code> 的小块用于检索、<code>800</code> 的父块用于返回，对比上下文长度与答案准确率的变化。</li>
  </ul>
</div>

## 四、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>第 2 题为高频考点</span></div>
  <div class="q-item" data-qid="knowledge02-q1" data-answer="1">
    <div class="q-text"><span class="idx">Q1</span>检索不到答案时，正确的第一步排查是什么？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>换一个更强的嵌入模型</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>把标准答案所在的原文块手工塞进上下文，先判断是「检索链路」的问题还是「生成」的问题</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>调大 top-k</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>换更大的模型</span></button>
    <div class="explain"><b>B。</b>这是「二分定位」的第一步：<b>如果给了正确原文模型也答不对，那问题就不在检索上</b>，改嵌入模型纯属浪费——把问题区间先砍一半，后面的排查才有方向。C 是合理的第二步（用于区分召回与排序问题），但作为第一步会引入新的混淆因素。</div>
  </div>
  <div class="q-item" data-qid="knowledge02-q2" data-answer="2">
    <div class="q-text"><span class="idx">Q2</span>为什么元数据过滤（如只搜某个版本、某种语言）必须在召回阶段做，而不是拿到结果后再过滤？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>因为后过滤会破坏排序</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>因为后过滤代码更复杂</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>因为 top-k 的额度会被不符合条件的内容占满，过滤后实际可用结果可能只剩两三条，甚至为空</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>因为元数据在向量库外无法访问</span></button>
    <div class="explain"><b>C。</b>这是个很实际的问题：你取 top-20，其中 17 条来自旧版本文档，后过滤之后只剩 3 条，而真正相关的第 21-25 名根本没被召回进来。<b>正确做法是把过滤条件下推到检索层，让向量库只在符合条件的子集里做近邻搜索。</b></div>
  </div>
  <div class="q-item" data-qid="knowledge02-q3" data-answer="3">
    <div class="q-text"><span class="idx">Q3</span>表格内容为什么不能按字符长度切分？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>因为表格的 token 消耗更大</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>因为嵌入模型不支持表格</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>因为表格通常很长，切分成本高</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>因为按字符切会切断表头与数据行的对应关系，结果变成一串无法解读的碎片（数值与列名对不上）</span></button>
    <div class="explain"><b>D。</b>表格的信息在于「表头与单元格的对应关系」，切分一旦破坏这个关系，剩下的数字就毫无意义。<b>正确做法：把表格转为自然语言或 Markdown 后作为整体一个块</b>，例如「表头为 地区/转化率，华东行取值为 1.1%」——这样既能被检索到，也能被模型正确理解。</div>
  </div>
</div>

## 五、小结

| 环节 | 关键动作 | 最易犯的错 |
| --- | --- | --- |
| ① 查询理解 | 别名归一、指代消解、口语改写 | 没做归一，检索直接漏召回 |
| ② 切分 | 结构化切分 + 父子块 + 重叠 + 表格特殊处理 | 按字符切、切坏表格、丢层级路径 |
| ③ 索引 | 嵌入模型变更后必须重建 | 换了模型没重建，检索结果完全错乱 |
| ④ 召回 | 先宽召回、元数据过滤下推、设分数下限 | 后过滤导致可用结果被挤空 |
| ⑤ 重排 | 精排 + 截断到 N | 跳过重排，直接用相似度排序 |
| ⑥ 组装 | 带来源/时间/层级 + 超限显式标注 + 给「无资料」出口 | 没有来源标注，模型无从判断可信度 |

<p class="pull-quote">检索系统的调试只有一条有效路径：先二分定位环节，再动手改。跳过分步排查直接换模型，是耗时最长的一条路。<cite>本刊编辑部</cite></p>

下一章单独讲检索的物理基础：向量到底是什么，为什么「语义相近」和「对回答有用」是两件事。
