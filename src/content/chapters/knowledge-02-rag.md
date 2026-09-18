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

「检索 + 生成」压成两个词，漏掉了中间四个环节。真实的[[rag|链路]]有六段——[[query-understanding|查询理解]]、[[chunking|切分]]、[[indexing|索引]]、[[retrieval|召回]]、[[rerank|重排]]、组装——每段都能独立把结果做错，且错得毫无痕迹。

## 二、切分：最被低估的环节

如果说有一个环节的投入产出比最高，那就是切分——尤其是[[parent-child-chunk|父子块]]这种策略。原因很简单：**切错了的内容，后面用再好的模型也救不回来。**

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

1. **[[chunk-overlap|重叠]]是必要的。** 相邻块之间保留 10%-20% 的重叠，可以显著降低「答案被切断」的概率。代价是索引体积变大。
2. **表格必须特殊处理。** 表格按字符切会变成乱码。正确做法是把表格转为 Markdown 或自然语言描述（「表头为 地区/转化率，华东行取值为 1.1%」），作为整体一个块。
3. **每个块都要带上层级路径。** 块的开头附上「文档标题 > 一级标题 > 二级标题」，这既能提升检索准确率（路径参与嵌入），也让模型知道这段内容的语境。

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 312" role="img" aria-label="父子块：同一份材料两种粒度，检索用小块、返回用大块">
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">父子块：检索用小块，返回用大块</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">同一份材料被切成两套粒度——嵌入与匹配走子块，进上下文的是子块所属的父块</text>
      <rect x="16" y="56" width="628" height="88" fill="#f0ebe1" stroke="#1f1b16" stroke-width="1.3"/>
      <text x="30" y="76" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#1f1b16">父块（小节）约 800–1500 字　·　不参与嵌入、不进候选排序</text>
      <rect x="36" y="88" width="134" height="44" fill="#fdf6e8" stroke="#b8944b" stroke-width="1"/>
      <text x="44" y="106" font-family="ui-monospace, monospace" font-size="9.2" fill="#8a6a1e">子块①</text>
      <text x="44" y="122" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">背景与前提</text>
      <rect x="190" y="88" width="134" height="44" fill="#d6e5de" stroke="#2f6157" stroke-width="1.4"/>
      <text x="198" y="106" font-family="ui-monospace, monospace" font-size="9.2" font-weight="700" fill="#2f6157">子块② 命中</text>
      <text x="198" y="122" font-family="ui-monospace, monospace" font-size="9.2" fill="#2f6157">转化率 1.1%</text>
      <rect x="344" y="88" width="134" height="44" fill="#fdf6e8" stroke="#b8944b" stroke-width="1"/>
      <text x="352" y="106" font-family="ui-monospace, monospace" font-size="9.2" fill="#8a6a1e">子块③</text>
      <text x="352" y="122" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">原因分析</text>
      <rect x="498" y="88" width="134" height="44" fill="#fdf6e8" stroke="#b8944b" stroke-width="1"/>
      <text x="506" y="106" font-family="ui-monospace, monospace" font-size="9.2" fill="#8a6a1e">子块④</text>
      <text x="506" y="122" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">结论与建议</text>
      <text x="257" y="150" text-anchor="middle" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">↑ 只有子块（约 200–400 字）被嵌入、被比对</text>
      <rect x="16" y="160" width="300" height="72" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="30" y="178" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#2f6157">② 检索粒度 = 子块</text>
      <text x="30" y="194" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">查询向量只与子块比，语义聚焦，</text>
      <text x="30" y="208" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">不会被整段里的无关内容稀释。</text>
      <text x="30" y="224" font-family="ui-monospace, monospace" font-size="9.2" fill="#2f6157">命中：子块②（不是父块）</text>
      <line x1="320" y1="196" x2="340" y2="196" stroke="#1f1b16" stroke-width="1.2" marker-end="url(#arR)"/>
      <defs>
        <marker id="arR" markerWidth="9" markerHeight="9" refX="7.5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#1f1b16"/>
        </marker>
      </defs>
      <rect x="344" y="160" width="300" height="72" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="358" y="178" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#2f6157">③ 返回粒度 = 父块</text>
      <text x="358" y="194" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">按 parent_id 上溯，把整个小节放进</text>
      <text x="358" y="208" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">上下文：前提、数据、结论都在。</text>
      <text x="358" y="224" font-family="ui-monospace, monospace" font-size="9.2" fill="#2f6157">同一父块的多个子块命中只返回一次</text>
      <rect x="16" y="248" width="628" height="52" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="30" y="266" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#8a6a1e">两套粒度分开，才同时拿到「匹配准」与「上下文全」——这正是它适合当默认方案的原因。</text>
      <text x="30" y="284" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">代价：要维护子块到父块的映射；命中膨胀后总字符变多，必须按预算截断并显式标注。</text>
    </svg>
  </div>
  <figcaption><b>图 2</b>　把「检索单元」和「返回单元」拆成两套粒度：小块负责被找到，大块负责被读懂。<b>「块要小还是大」这个争论之所以长期没有答案，是因为它把两个问题问成了一个——父子块让它们各自取值。</b></figcaption>
</figure>

## 三、动手：可调参的检索链路

```python title="rag_pipeline.py"
from dataclasses import dataclass, field
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
```

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 386" role="img" aria-label="元数据过滤下推到检索层与召回后再过滤的结果对比">
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">过滤时机决定你能拿到几条有效结果</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">同一个查询「只看 v3 版本文档」、同样取 top-20，两种做法的区别只在于过滤发生在哪一步</text>
      <text x="16" y="72" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#9b2c2c">A · 先召回、再过滤（错）</text>
      <text x="250" y="72" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">绿色 = 符合条件的 v3 文档　红色 = 旧版本，取完才被丢掉</text>
      <rect x="16" y="82" width="29" height="24" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="46" y="82" width="29" height="24" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="76" y="82" width="29" height="24" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="106" y="82" width="29" height="24" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="136" y="82" width="29" height="24" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="166" y="82" width="29" height="24" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="196" y="82" width="29" height="24" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="226" y="82" width="29" height="24" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="256" y="82" width="29" height="24" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="286" y="82" width="29" height="24" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="316" y="82" width="29" height="24" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="346" y="82" width="29" height="24" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="376" y="82" width="29" height="24" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="406" y="82" width="29" height="24" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="436" y="82" width="29" height="24" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="466" y="82" width="29" height="24" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="496" y="82" width="29" height="24" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="526" y="82" width="29" height="24" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="556" y="82" width="29" height="24" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="586" y="82" width="29" height="24" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1"/>
      <rect x="16" y="82" width="89" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <text x="16" y="126" font-family="ui-monospace, monospace" font-size="9.6" fill="#9b2c2c">top-20 里 17 条来自旧版本 → 过完滤只剩 3 条；真正相关的第 21–25 名从未被召回进来。</text>
      <rect x="16" y="136" width="628" height="34" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1.2"/>
      <text x="30" y="158" font-family="ui-monospace, monospace" font-size="10" fill="#9b2c2c">可用结果 3 条　·　额度被无关内容占满，答案往往就差在那 17 条挤掉的位置上</text>
      <line x1="16" y1="188" x2="644" y2="188" stroke="#cfc6b6" stroke-width="1"/>
      <text x="16" y="214" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#2f6157">B · 把过滤条件下推到检索层（对）</text>
      <text x="290" y="214" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">向量库只在 v3 这个子集里做近邻搜索</text>
      <rect x="16" y="224" width="29" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <rect x="46" y="224" width="29" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <rect x="76" y="224" width="29" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <rect x="106" y="224" width="29" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <rect x="136" y="224" width="29" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <rect x="166" y="224" width="29" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <rect x="196" y="224" width="29" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <rect x="226" y="224" width="29" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <rect x="256" y="224" width="29" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <rect x="286" y="224" width="29" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <rect x="316" y="224" width="29" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <rect x="346" y="224" width="29" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <rect x="376" y="224" width="29" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <rect x="406" y="224" width="29" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <rect x="436" y="224" width="29" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <rect x="466" y="224" width="29" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <rect x="496" y="224" width="29" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <rect x="526" y="224" width="29" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <rect x="556" y="224" width="29" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <rect x="586" y="224" width="29" height="24" fill="#d6e5de" stroke="#2f6157" stroke-width="1"/>
      <text x="16" y="268" font-family="ui-monospace, monospace" font-size="9.6" fill="#2f6157">top-20 全部有效，而且第 21–25 名这类「不靠前但相关」的块也有机会进候选池。</text>
      <rect x="16" y="278" width="628" height="34" fill="#d6e5de" stroke="#2f6157" stroke-width="1.2"/>
      <text x="30" y="300" font-family="ui-monospace, monospace" font-size="10" fill="#2f6157">可用结果 20 条　·　同样的 top-k，有效额度差 6 倍以上</text>
      <rect x="16" y="326" width="628" height="48" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="30" y="344" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#8a6a1e">差别不在召回质量，而在额度：过滤器每回收一个额度，就多一条可能命中的证据。</text>
      <text x="30" y="362" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">判据：过滤后剩下的结果少于召回条数的一半，说明过滤该下推；向量库不支持带过滤的近邻搜索就要换库。</text>
    </svg>
  </div>
  <figcaption><b>图 3</b>　「先取后滤」和「边滤边取」看起来只差一行代码，代价却是可用额度。<b>凡是有确定性的条件（版本、语言、时间、权限），都要在召回时就参与筛选，而不是等结果回来再挑。</b></figcaption>
</figure>

<div class="box box-practice">
  <span class="box-title">实操任务</span>
  <ul>
    <li>挑 10 个「检索失败」的查询，按图 1 底部的三步排查顺序定位，统计各环节的失败占比；</li>
    <li>把 <code>top_k</code> 从 20 调到 100，看那个「本应命中却没命中」的块是否出现——如果出现，说明问题是排序而不是召回；</li>
    <li>实现父子块：<code>target=300</code> 的小块用于检索、<code>800</code> 的父块用于返回，对比上下文长度与答案准确率的变化。</li>
  </ul>
</div>

## 四、常见误区与追问

这一章的六环节表看起来像常识，但下面五条是「知道结论却仍然会做错」的地方。

### 4.1 误区：检索不到答案，就换一个更强的嵌入模型

错在哪：把「检索失败」默认归因到模型能力。为什么自然：换模型是唯一看起来「一次性解决」的动作，而且动作清晰、不用排查。**但六环节里只有 ③④ 与嵌入模型相关，而 ② 切分与过滤错误会让目标块根本不在候选里。** 判据：先做两步二分——把标准答案所在的原文块手工塞进上下文，模型能答对吗（不能则问题在生成侧）；再用原文里的关键词做一次全文检索，能找到那个块吗（能找到则问题在语义召回，找不到就是切分或索引）。量级上，换嵌入模型通常带来「召回率几个百分点」的改善，而切分切错带来的是「这条直接得 0 分」，两者不是一个量级。

### 4.2 误区：元数据过滤可以等拿到结果后再做

错在哪：把过滤当成一段后期清洗代码。为什么自然：向量库的检索 API 用起来简单，先取一批再在本地挑，写起来更快。**但 top-k 是额度：被过滤掉的每一条都占掉了一个名额。** 判据：统计过滤后被丢掉的比例——如果超过召回条数的一半（例如 top-20 里 17 条来自旧版本，只剩 3 条可用），就必须把 [[metadata-filter|元数据过滤]] 下推到检索层，让向量库只在符合条件的子集里做近邻搜索。这也解释了为什么选向量库时要先确认它支持带过滤的近邻查询，而不是事后补。

### 4.3 误区：top-k 越大越好，干脆取 100 条

错在哪：用「召回宽度」冒充「答案质量」。为什么自然：多取一些总不会漏，直觉上更安全。**但 [[top-k]] 决定的是候选池大小，不是进上下文的内容；池子越大，低相关内容越多，精排与生成都会被稀释。** 判据：把两头分开设——召回取 20～50 条（宽），重排后截到 4～8 条（窄），并且给召回设分数下限，低于阈值宁可返回空。一个可操作的检查：把 top-k 从 20 提到 100，如果最终进上下文的条数也跟着涨到 100，那你优化的是噪声占比，不是召回率。

### 4.4 误区：块要么小、要么大，必须选一个

错在哪：把两个粒度的问题问成了一个。为什么自然：「块小匹配准、块大上下文全」这个矛盾太显眼，于是默认要做取舍。**实际做法是把它们解耦：检索块 200～400 字符，返回块 800～1500 字符，用父子映射连起来。** 判据：如果你现在的做法是「把块调到 500 字左右，两个问题各让一步」，那答案准确率通常会卡在一个不上不下的水平；换成父子块后，同一份语料可以做到检索更准、上下文更全。顺带一条纪律：单块进上下文超过 3000 字符必须截断，并在块里显式写出「已截断多少字符」。

### 4.5 误区：RAG 的上限由生成模型决定

错在哪：把「答得不好」归因到生成侧。为什么自然：回答是生成模型写的，看起来它才是那个「做判断的人」。**但生成侧只能使用检索给它的材料——材料里没有答案时，模型无论多强都只能编或者拒答。** 判据：手工把正确原文塞进上下文，如果模型能给出正确答案，那么这次失败与生成模型无关，瓶颈在检索；如果塞了原文仍然答错，才轮到提示词与生成模型。这条判据只需几分钟，却能把排查方向一次砍成两半——而多数团队是先换模型、再回头查检索，把最难的一步留到最后。

## 五、自测

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

## 六、小结

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

## 七、参考与延伸

这一章的每个环节都有各自的深挖材料，下面按「先看实证、再看代码、最后读论文」排好了。全站不做原文转载，这里只登记链接与「为什么值得读」。

**先看实证（量化「每个环节值多少钱」）**

- [Anthropic · Introducing Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) —— 用数据回答「切分加语境」值多少：top-20 检索失败率从 5.7% 降到 3.7%（只加语境），叠加关键词召回降到 2.9%，再加精排降到 1.9%。<strong>想说服同事「先修切分和融合，别急着换嵌入模型」，这篇的数字最好用。</strong>

**再看代码（动手实现召回与精排）**

- [Sentence-Transformers · Retrieve &amp; Re-Rank](https://sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html) —— 官方实现的双阶段检索范例：先双塔召回 top-100，再交叉编码器精排。<strong>本章第二节的三段式分工，这份代码里就是可运行的最小版本。</strong>

**最后读论文（对齐一手定义）**

- [Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks（arXiv:2005.11401）](https://arxiv.org/abs/2005.11401) —— RAG 的一手来源（Lewis 等，NeurIPS 2020）。<strong>注意读它的术语：这里的「检索」是把文档喂给生成器，今天工程上的六环节都是它的实现细节——先读第 2 节，别从头啃。</strong>

