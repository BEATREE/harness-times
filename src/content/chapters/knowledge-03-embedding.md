---
chapter: knowledge-03-embedding
lead: '语义检索为什么会找错？因为「语义相近」和「对回答问题有用」是两件事。前者是向量空间的几何关系，后者是任务相关性的判断。理解这中间的落差，才能明白向量检索的边界在哪里、什么时候必须叠加别的检索手段。'
note: '本章的核心是「能力边界」而不是数学。重点是理解为什么纯向量检索在一些场景必然失效。'
---

<p class="dropcap">先把向量检索的物理本质讲清楚：它把文本映射到一个高维空间里的点，让「语义相近的文本」在空间里距离更近。检索就是找最近的邻居。这个机制非常有效，也有非常明确的边界——而多数误用都源于不清楚边界在哪。</p>

## 一、嵌入做的事：从符号到坐标

文本在计算机里本来是离散符号序列，无法比较「相似」。[[embedding|嵌入]]模型把它变成连续向量，于是「相似」变成了「距离」这个可计算的东西。

关键在于「相似」是通过什么学到的。模型在大量文本对（相似的、不相似的）上训练，学会了把「意思接近」的文本映射到相近的位置——这就是[[semantic-field|语义场]]。这带来两个直接结论：像[[exact-identifier|精确标识符]]（订单号、错误码）差一个字符就是另一个东西，而[[negation-problem|否定词]]带来的[[polarity-reversal|极性反转]]在向量空间几乎不产生位移。

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>嵌入擅长的</th><th>嵌入不擅长的</th></tr></thead>
    <tbody>
      <tr><td>同义表达：「转化率低」与「成交比例不高」</td><td>精确标识符：订单号、错误码、函数名、型号（差一个字符就是另一个东西）</td></tr>
      <tr><td>跨语言：「客户满意度」与「customer satisfaction」</td><td>逻辑关系：「A 大于 B」与「B 大于 A」在向量空间里可能很近</td></tr>
      <tr><td>语义概括：「怎么提升留存」与「提高用户复购的方法」</td><td>否定与极性：「有效」与「无效」在向量空间里往往距离很近</td></tr>
      <tr><td>主题归类：一段文字属于哪个业务领域</td><td>时效与版本：「2024 口径」与「2025 口径」的向量几乎相同</td></tr>
    </tbody>
  </table>
</div>

<div class="box box-warn">
  <span class="box-title">否定词问题是向量检索最经典的失效模式</span>
  <p>「这个方案有效」和「这个方案无效」在向量空间里通常非常接近，因为模型学到的主要是「方案 + 有效性评估」这个主题，而不是那个「否」字带来的极性反转。类似的还有「同比增长」与「同比下降」、「支持」与「不支持」。</p>
  <p><b>后果很严重：用户明确问「哪些功能不支持 X」，检索回来的全是「支持 X」的文档。</b>解法不是换嵌入模型（这是共性局限），而是在查询理解阶段把「不支持」改写为「缺少 / 未提供 / 不兼容」等正向表述，或者辅以关键词检索把「不支持」这个精确串匹配上。</p>
</div>

## 二、相似度度量：怎么选

选哪个度量不看直觉，看训练：[[metric-selection|相似度度量选择]]取决于嵌入模型怎么训的。[[cosine-similarity|余弦相似度]]是默认；若模型用点积则必须用点积（未归一化时长向量会被高估），[[euclidean-distance|欧氏距离]]在[[l2-normalization|归一化]]后与余弦等价。

<div class="tbl-wrap">
  <table class="news">
    <thead><tr><th>度量</th><th>公式直觉</th><th>何时用</th><th>注意</th></tr></thead>
    <tbody>
      <tr><td><b>余弦相似度</b></td><td>只看两个向量的夹角，忽略长度</td><td>默认选择，绝大多数文本嵌入</td><td>归一化之后与点积等价</td></tr>
      <tr><td><b>点积</b></td><td>夹角 + 长度都算</td><td>模型训练时就用的点积（如部分 OpenAI 模型）</td><td><b>必须与训练时一致</b>，否则排序会系统性偏移</td></tr>
      <tr><td><b>欧氏距离</b></td><td>空间中的直线距离</td><td>向量已归一化时与余弦等价（单调对应）</td><td>未归一化时对长度敏感，容易偏向短文本</td></tr>
    </tbody>
  </table>
</div>

<div class="box box-key">
  <span class="box-title">一条实用纪律</span>
  <p><b>使用哪个度量，取决于嵌入模型是怎么训练的，而不是取决于你的直觉。</b>模型卡（model card）通常会写明推荐度量。用错了不会报错，只会让排序质量悄悄变差——这类问题极难发现，因为结果「看起来还算相关」。</p>
  <p>验证方法：取 20 组已知的相关/不相关样本对，分别用两种度量算排序，看哪个更符合预期。这个测试大概花 20 分钟，能省下后面大量的排查时间。</p>
</div>

## 三、能力边界：三类必然失效的场景

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 400" role="img" aria-label="向量检索的三类必然失效场景与补救手段">
      <text x="16" y="20" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">向量检索的能力边界</text>
      <text x="16" y="38" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">这三类场景不是「调参能解决」的，而是机制上的必然失效。识别出来，才能选对补救手段。</text>
      <!-- 场景 1 -->
      <rect x="16" y="52" width="628" height="100" fill="#fbf1f1" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="30" y="72" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#9b2c2c">① 精确匹配类　需要一字不差</text>
      <text x="30" y="92" font-family="ui-monospace, monospace" font-size="9.1" fill="#6b6257">查询：「ERR_45004 是什么原因」　期望：定位到报错码对应的文档条目</text>
      <text x="30" y="110" font-family="ui-monospace, monospace" font-size="9.1" fill="#9b2c2c">向量会把它匹配到讨论「错误处理」「异常码规范」的泛泛文档，而 ERR_45004 那条可能排在 50 名开外。</text>
      <text x="30" y="128" font-family="ui-monospace, monospace" font-size="9.1" fill="#2f6157">补救：关键词/BM25 检索精确串匹配，再与向量结果融合（见下一章）。</text>
      <text x="30" y="144" font-family="ui-monospace, monospace" font-size="9.1" fill="#6b6257">同类：订单号、函数名、配置项名、产品型号、人名、法律条文编号。</text>
      <!-- 场景 2 -->
      <rect x="16" y="162" width="628" height="100" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <text x="30" y="182" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#8a6a1e">② 极性 / 逻辑反转类　词几乎相同但含义相反</text>
      <text x="30" y="202" font-family="ui-monospace, monospace" font-size="9.1" fill="#6b6257">查询：「哪些接口不支持批量操作」　期望：只返回不支持的那些</text>
      <text x="30" y="220" font-family="ui-monospace, monospace" font-size="9.1" fill="#b8944b">「支持批量操作」与「不支持批量操作」的向量距离极近，检索会把两者混在一起。</text>
      <text x="30" y="238" font-family="ui-monospace, monospace" font-size="9.1" fill="#2f6157">补救：查询改写为正向表述（「缺少批量能力」），或用否定词规则在召回后做二次判别。</text>
      <text x="30" y="254" font-family="ui-monospace, monospace" font-size="9.1" fill="#6b6257">同类：有效/无效、同意/不同意、同比增长/同比下降、包含/不包含。</text>
      <!-- 场景 3 -->
      <rect x="16" y="272" width="628" height="100" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="30" y="292" font-family="Georgia, serif" font-size="11" font-weight="700" fill="#2f6157">③ 条件 / 数值约束类　信息在结构化字段里，不在语义里</text>
      <text x="30" y="312" font-family="ui-monospace, monospace" font-size="9.1" fill="#6b6257">查询：「2025 年 9 月之后更新的华东区口径文档」　期望：三个条件同时满足</text>
      <text x="30" y="330" font-family="ui-monospace, monospace" font-size="9.1" fill="#2f6157">向量只能表达「华东区口径文档」这个语义主题，无法表达「时间 &gt; 2025-09」这个约束。</text>
      <text x="30" y="348" font-family="ui-monospace, monospace" font-size="9.1" fill="#2f6157">补救：条件抽出来做元数据过滤（结构化过滤下推到召回层），向量只负责语义部分。</text>
      <text x="30" y="364" font-family="ui-monospace, monospace" font-size="9.1" fill="#6b6257">同类：时间范围、版本号、状态、地区、金额区间、部门归属。</text>
    </svg>
  </div>
  <figcaption><b>图 1</b>　三类必然失效的场景与补救手段。<b>共同规律是：失效都发生在「需要精确或结构化判断」的地方，而向量只在「语义模糊匹配」上强。</b>所以正确的架构不是选一种，而是让每种手段处理它擅长的部分。</figcaption>
</figure>

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 370" role="img" aria-label="三组文本在向量空间中的相对位置示意">
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">把句子放进向量空间：该分开的没分开</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">圆点之间的距离代表语义距离（示意，非真实尺度）；右侧框内是这一对句子的余弦相似度</text>
      <rect x="16" y="56" width="628" height="76" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1.3"/>
      <text x="30" y="78" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#9b2c2c">① 极性对 · 词几乎相同，含义相反</text>
      <text x="248" y="108" text-anchor="end" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">接口支持批量操作</text>
      <line x1="266" y1="104" x2="274" y2="104" stroke="#1f1b16" stroke-width="2.4"/>
      <circle cx="256" cy="104" r="5" fill="#1f1b16"/>
      <circle cx="284" cy="104" r="5" fill="#1f1b16"/>
      <text x="300" y="108" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">接口不支持批量操作</text>
      <rect x="520" y="88" width="110" height="34" fill="#f3c9c9" stroke="#9b2c2c" stroke-width="1.1"/>
      <text x="530" y="104" font-family="ui-monospace, monospace" font-size="9.2" font-weight="700" fill="#9b2c2c">cos ≈ 0.92</text>
      <text x="530" y="118" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">几乎重合</text>
      <text x="30" y="126" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">两句共享「批量操作 × 支持性」这个主题，那个「不」字几乎不产生位移。</text>
      <rect x="16" y="138" width="628" height="76" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <text x="30" y="160" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#b8944b">② 极性对 · 数值方向相反</text>
      <text x="248" y="190" text-anchor="end" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">同比增长 12%</text>
      <line x1="266" y1="186" x2="274" y2="186" stroke="#1f1b16" stroke-width="2.4"/>
      <circle cx="256" cy="186" r="5" fill="#1f1b16"/>
      <circle cx="284" cy="186" r="5" fill="#1f1b16"/>
      <text x="300" y="190" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">同比下降 12%</text>
      <rect x="520" y="170" width="110" height="34" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.1"/>
      <text x="530" y="186" font-family="ui-monospace, monospace" font-size="9.2" font-weight="700" fill="#b8944b">cos ≈ 0.90</text>
      <text x="530" y="200" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">几乎重合</text>
      <text x="30" y="208" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">句子里唯一的不同是方向词，而方向词造成的位移最小。</text>
      <rect x="16" y="220" width="628" height="76" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <text x="30" y="242" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#2f6157">③ 精确串 · 差一个字符就是另一个东西</text>
      <text x="138" y="272" text-anchor="end" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">ERR_45004 参数超长</text>
      <line x1="156" y1="268" x2="392" y2="268" stroke="#1f1b16" stroke-width="1" stroke-dasharray="3 2"/>
      <circle cx="150" cy="268" r="5" fill="#1f1b16"/>
      <circle cx="398" cy="268" r="5" fill="#1f1b16"/>
      <text x="414" y="272" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">常见的错误处理规范</text>
      <rect x="520" y="252" width="110" height="34" fill="#d6e5de" stroke="#2f6157" stroke-width="1.1"/>
      <text x="530" y="268" font-family="ui-monospace, monospace" font-size="9.2" font-weight="700" fill="#2f6157">cos ≈ 0.31</text>
      <text x="530" y="282" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">相距很远</text>
      <text x="30" y="290" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">精确串与主题文档离得远，在向量里查它必然排不上来，只能靠关键词兜住。</text>
      <rect x="16" y="308" width="628" height="52" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="30" y="326" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#8a6a1e">所以「语义相近」和「能回答我的问题」是两件事：前者是几何关系，后者是任务判断。</text>
      <text x="30" y="344" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">对策都不在换模型：极性靠查询改写（不支持 → 缺少 / 未提供），精确串靠关键词检索。</text>
    </svg>
  </div>
  <figcaption><b>图 2</b>　三组对照放在一起看：越该被区分的句子，在向量空间里往往挨得越近；越需要一字不差的串，反而离得越远。<b>极性反转与精确标识符是机制性的失效，换任何通用嵌入模型都躲不掉。</b></figcaption>
</figure>

## 四、动手：三种度量的对比与边界探测

```python title="embedding_bounds.py"
import numpy as np
def l2_normalize(m: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(m, axis=-1, keepdims=True)
    return m / np.where(n == 0, 1, n)
def cosine(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return l2_normalize(a) @ l2_normalize(b).T
def dot(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return a @ b.T
def euclidean(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    # 返回负距离，便于与相似度统一为「越大越好」
    diff = a[:, None, :] - b[None, :, :]
    return -np.linalg.norm(diff, axis=-1)
METRICS = {"cosine": cosine, "dot": dot, "euclidean": euclidean}
def compare_metrics(query: str, docs: list[str], embed) -> None:
    """
    用一组已知样本对比三种度量的排序差异。
    20 分钟的成本，能避免后面几个月的排序质量问题。
    """
    qv = embed([query])
    dv = embed(docs)
    print(f"查询：{query}\n")
    for name, fn in METRICS.items():
        scores = fn(qv, dv)[0]
        order = np.argsort(-scores)[:5]
        print(f"--- {name} top5 ---")
        for i in order:
            print(f"  {scores[i]:+.4f}  {docs[i][:44]}")
    print()
def probe_polarity_and_exactness(embed) -> dict:
    """
    边界探测：亲手验证两类必然失效。
    这一步的目的是建立「什么时候不能只靠向量」的判断力。
    """
    pairs = [
        # (A, B, 期望：两者是否应该被区分开)
        ("接口支持批量操作", "接口不支持批量操作"),
        ("ERR_45004 参数超长", "常见的错误处理规范"),
        ("同比增长 12%", "同比下降 12%"),
        ("该字段可以为空", "该字段不可以为空"),
        ("华东区转化率 1.1%", "华东区转化率偏低，建议关注"),
    ]
    out = {}
    for a, b in pairs:
        va, vb = embed([a, b])
        out[f"{a[:14]}… vs {b[:14]}…"] = float(cosine(va, vb)[0, 0])
    return out
# --- 输出示例（数值会随模型不同而变，但规律稳定） ---
# 「支持批量操作」vs「不支持批量操作」            → 约 0.92  ← 距离极近，无法区分极性
# 「ERR_45004 参数超长」vs「常见的错误处理规范」   → 约 0.31  ← 精确串反而更远
# 结论：极性反转与精确标识符，必须靠向量之外的手段处理。
def hybrid_score(vec_score: np.ndarray, kw_score: np.ndarray,
                  alpha: float = 0.6) -> np.ndarray:
    """
    一个极简的混合打分示意。
    真实系统用 RRF 或带权重归一化的加权和（见下一章），
    这里只为说明「两路信号可以互补」。
    """
    v = (vec_score - vec_score.min()) / (vec_score.ptp() + 1e-9)
    k = (kw_score - kw_score.min()) / (kw_score.ptp() + 1e-9)
    return alpha * v + (1 - alpha) * k
```

<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 366" role="img" aria-label="余弦、点积、欧氏距离在向量长度翻倍时的差别">
      <defs>
        <marker id="arM" markerWidth="8" markerHeight="8" refX="6.5" refY="3.6" orient="auto">
          <path d="M0,0 L7,3.6 L0,7.2 z" fill="#6b6257"/>
        </marker>
      </defs>
      <text x="16" y="22" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#1f1b16">同一组向量，三种度量给出三种答案</text>
      <text x="16" y="40" font-family="ui-monospace, monospace" font-size="10" fill="#6b6257">三行用的是同一组向量：b 与 a 成夹角 θ，c 与 a 同方向、长度为 a 的两倍</text>
      <rect x="16" y="56" width="628" height="76" fill="#eef4f1" stroke="#2f6157" stroke-width="1.3"/>
      <line x1="56" y1="118" x2="150" y2="118" stroke="#cfc6b6" stroke-width="1"/>
      <line x1="56" y1="118" x2="146" y2="90" stroke="#2f6157" stroke-width="1.2" marker-end="url(#arM)"/>
      <line x1="56" y1="118" x2="188" y2="94" stroke="#2f6157" stroke-width="1.2" stroke-dasharray="3 2" marker-end="url(#arM)"/>
      <line x1="56" y1="118" x2="146" y2="66" stroke="#6b6257" stroke-width="1.2" marker-end="url(#arM)"/>
      <text x="148" y="88" font-family="ui-monospace, monospace" font-size="9.2" fill="#2f6157">a</text>
      <text x="192" y="90" font-family="ui-monospace, monospace" font-size="9.2" fill="#2f6157">c = 2a</text>
      <text x="152" y="114" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">b</text>
      <text x="248" y="82" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#2f6157">① 余弦相似度　只看夹角，不看长度</text>
      <text x="248" y="104" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">cos(a,b) 与 cos(c,b) 完全相同：方向一样，长度翻倍也不影响分数。</text>
      <text x="248" y="122" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">默认选择；向量归一化之后，它与点积等价。</text>
      <rect x="16" y="134" width="628" height="76" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.3"/>
      <line x1="56" y1="196" x2="150" y2="196" stroke="#cfc6b6" stroke-width="1"/>
      <line x1="56" y1="196" x2="146" y2="168" stroke="#b8944b" stroke-width="1.2" marker-end="url(#arM)"/>
      <line x1="56" y1="196" x2="188" y2="172" stroke="#b8944b" stroke-width="1.2" stroke-dasharray="3 2" marker-end="url(#arM)"/>
      <line x1="56" y1="196" x2="146" y2="144" stroke="#6b6257" stroke-width="1.2" marker-end="url(#arM)"/>
      <text x="148" y="166" font-family="ui-monospace, monospace" font-size="9.2" fill="#b8944b">a</text>
      <text x="192" y="168" font-family="ui-monospace, monospace" font-size="9.2" fill="#b8944b">c = 2a</text>
      <text x="152" y="192" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">b</text>
      <text x="248" y="160" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#b8944b">② 点积　夹角 × 长度</text>
      <text x="248" y="182" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">c·b = 2 × a·b：同样的夹角，长向量拿到更高的分数。</text>
      <text x="248" y="200" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">必须与嵌入模型训练时用的度量一致，否则排序会系统性偏移。</text>
      <rect x="16" y="212" width="628" height="76" fill="#f6e2e2" stroke="#9b2c2c" stroke-width="1.3"/>
      <line x1="56" y1="274" x2="150" y2="274" stroke="#cfc6b6" stroke-width="1"/>
      <line x1="56" y1="274" x2="146" y2="246" stroke="#9b2c2c" stroke-width="1.2" marker-end="url(#arM)"/>
      <line x1="56" y1="274" x2="188" y2="250" stroke="#9b2c2c" stroke-width="1.2" stroke-dasharray="3 2" marker-end="url(#arM)"/>
      <line x1="56" y1="274" x2="146" y2="222" stroke="#6b6257" stroke-width="1.2" marker-end="url(#arM)"/>
      <text x="148" y="244" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">a</text>
      <text x="192" y="246" font-family="ui-monospace, monospace" font-size="9.2" fill="#9b2c2c">c = 2a</text>
      <text x="152" y="270" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">b</text>
      <text x="248" y="238" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#9b2c2c">③ 欧氏距离　直线距离，长度也算进去</text>
      <text x="248" y="260" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">|c−b| 明显大于 |a−b|：方向一样但更长，距离反而更远。</text>
      <text x="248" y="278" font-family="ui-monospace, monospace" font-size="9.2" fill="#6b6257">归一化后与余弦单调对应；未归一化时容易偏向短文本。</text>
      <rect x="16" y="300" width="628" height="56" fill="#fdf6e8" stroke="#b8944b" stroke-width="1.2"/>
      <text x="30" y="320" font-family="Georgia, serif" font-size="10.6" font-weight="700" fill="#8a6a1e">L2 归一化的意义就在这里：把「长度」这一维从打分里去掉，三种度量收敛成同一套排序。</text>
      <text x="30" y="340" font-family="ui-monospace, monospace" font-size="9.6" fill="#6b6257">所以「归一化 + 点积」是最省算力的等价写法；用错度量不会报错，只会让排序悄悄偏掉。</text>
    </svg>
  </div>
  <figcaption><b>图 3</b>　三个面板用的是同一组向量，只换度量。<b>余弦对长度免疫、点积放大长度、欧氏距离把长度算进距离</b>——这就是「用哪个度量要跟嵌入模型训练时保持一致」的全部原因。</figcaption>
</figure>

<div class="box box-practice">
  <span class="box-title">实操任务</span>
  <ul>
    <li>跑一遍 <code>probe_polarity_and_exactness()</code>，亲眼看「支持/不支持」的余弦相似度有多高——这个数字会改变你对向量检索的信任度；</li>
    <li>用你自己的语料构造 10 组「应该被区分开但向量分不清」的样本，统计需要用到关键词检索的比例；</li>
    <li>回答一个问题：如果你的检索系统里 30% 的查询属于这三类失效场景，你应该优先改哪一环？</li>
  </ul>
</div>

## 五、常见误区与追问

### 5.1 误区：向量检索比关键词检索「更高级」，应该全面替换

错在哪：把两种检索当成新旧替代关系。为什么自然：语义匹配更接近人理解语言的方式，听起来就是升级版。**但它们擅长的是不同的东西：向量赢在同义与跨语言，关键词赢在精确串、编号与否定词。** 判据（可操作）：统计自己系统里「必须一字不差才能命中」的查询占比——订单号、错误码、型号、函数名、条文编号这类。只要这个比例超过 10%，纯向量就会留下一批必错的查询，必须上混合检索。反过来说，如果 90% 的查询都是口语化长问题，纯粹为了「更全」而加一路关键词，收益也有限。

### 5.2 误区：相似度分数是绝对可信度，0.8 就是相关

错在哪：把余弦值当成跨模型通用的阈值。为什么自然：分数落在 −1 到 1 之间，看起来是标准化的。**但分数的分布会随嵌入模型、语料领域、甚至文本长度而变：同一个 0.78，在这个模型里是「高度相关」，在另一个模型里可能只是「同一主题」。** 判据：取 20 组已知相关、20 组已知不相关的样本，分别看两批分数的分布边界，用它们之间那条空隙来定阈值；更换嵌入模型后必须重标一次。这也是 [[boundary-probe|边界探测]] 值得花 20 分钟的原因——它把「感觉还行」换成一条能复现的线。

### 5.3 误区：归一化只是为了算得快

错在哪：把 L2 归一化当成性能优化。为什么自然：归一化之后点积可以替代余弦，确实省一次除法。**但它真正的作用是让「长度」这一维退出打分，从而让余弦、点积、欧氏距离三种度量收敛到同一套排序（见 图 3）。** 判据：如果你发现「长文档总是排得更高」或者「同一段话复制两遍分数变高」，先检查两件事——向量有没有归一化、嵌入模型训练时用的是点积还是余弦。这两项对不上时，排序会系统性偏好长文本，而且不会报任何错。

### 5.4 误区：否定词问题只能靠换更强的嵌入模型解决

错在哪：把它当成模型能力不足。为什么自然：模型越强似乎越该懂「不」字的含义。**但这是嵌入在编码「主题」而不是「极性」的机制性结果，换通用模型同样存在。** 判据：跑一次边界探测，若「支持批量操作 / 不支持批量操作」的余弦仍然在 0.85 以上，就不要再指望换模型。正确做法有两条：查询理解阶段把否定改写成正向表述（不支持 → 缺少 / 未提供 / 不兼容），或者叠加一路关键词分做 [[hybrid-score|混合打分]]。经验上，改写后这类查询会从「基本不命中」变成「命中一半以上」——量级差别，不是几个百分点。

### 5.5 误区：向量维度越高越好

错在哪：把维度当成容量指标，似乎越高能装的信息越多。为什么自然：维度确实意味着表达能力，而升级到更高维是「只改一个配置」的动作。**但维度是嵌入模型出厂固定的，它由训练方式决定，不由你的语料决定。** 判据：换模型时同时记录三项——检索指标、索引体积、单次查询延迟。很多 384 或 768 维的模型在同义匹配上并不输 1536 维，而索引体积与延迟差 2 到 4 倍。把「维度翻倍」当成优化目标，最常见的结局是成本涨了、指标没动。

## 六、自测

<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>第 2 题是经典考点</span></div>
  <div class="q-item" data-qid="knowledge03-q1" data-answer="0">
    <div class="q-text"><span class="idx">Q1</span>用哪种相似度度量，主要取决于什么？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>嵌入模型在训练时采用的度量（查模型卡），而不是直觉偏好</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>语料的长度分布</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>文档数量多少</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>向量维度高低</span></button>
    <div class="explain"><b>A。</b>用错度量不会报错，只会让排序质量悄悄变差——这类问题极难发现，因为结果「看起来还算相关」。<b>验证方式：取 20 组已知相关性的样本对，对比不同度量的排序是否符合预期。</b></div>
  </div>
  <div class="q-item" data-qid="knowledge03-q2" data-answer="2">
    <div class="q-text"><span class="idx">Q2</span>为什么向量检索难以区分「支持批量操作」与「不支持批量操作」？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>因为嵌入模型的中文能力不足</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>因为这两句长度不同，向量长度不一致</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>因为嵌入主要编码「主题/语义场」，两句共享同一主题（批量操作 × 支持性），否定词带来的极性反转在向量空间中几乎不产生位移</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>因为相似度计算有数值误差</span></button>
    <div class="explain"><b>C。</b>这是<b>机制性的局限，不是模型不够好</b>——换任何通用嵌入模型都会遇到。所以对策必须来自向量之外：查询改写（把否定转成「缺少/未提供」的正向表述）或叠加关键词检索对否定词做精确匹配。</div>
  </div>
  <div class="q-item" data-qid="knowledge03-q3" data-answer="1">
    <div class="q-text"><span class="idx">Q3</span>查询「2025 年 9 月之后更新的华东区口径文档」，向量检索的正确分工是什么？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>把整句话嵌入，让向量一次性处理所有条件</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>抽出时间与地区做元数据过滤（下推至召回层），向量只负责「口径文档」这个语义部分</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>用全文检索处理所有条件，不用向量</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>先向量召回 1000 条，再用脚本逐条过滤</span></button>
    <div class="explain"><b>B。</b>结构化的条件（时间、版本、地区、状态）应该交给元数据过滤，语义部分才交给向量——<b>让每种机制处理它擅长的东西</b>。A 的问题是把数值约束交给了一个无法表达它的机制；D 就是「后过滤」，会因 top-k 额度被占满而导致可用结果过少。</div>
  </div>
</div>

## 七、小结

| 议题 | 结论 |
| --- | --- |
| 嵌入的本质 | 把语义相近映射为距离相近；编码的是「语义场」而非精确信息 |
| 度量选择 | 依据嵌入模型的训练方式（查模型卡），并用已知样本对比验证 |
| 三类失效 | 精确匹配类、极性反转类、条件约束类——都是机制性失效 |
| 应对方向 | 精确串用关键词检索；极性用查询改写；条件用元数据过滤下推 |
| 一条纪律 | 不要指望换嵌入模型解决边界问题；要靠混合手段 |

<p class="pull-quote">向量检索不是「更好的搜索」，它是「另一种搜索」。它的价值在于补上了关键词检索找不到的语义相近，代价是丢掉了关键词检索最擅长的精确。<cite>本刊编辑部</cite></p>

最后一章把关键词检索与向量检索拼在一起，解决「召回要宽、排序要准、引用要能被验证」这三件事。

## 八、参考与延伸

这一章的重点是「边界」而不是数学，所以下面三份材料按「先读文档、再看中文代码、最后读论文」排好了。全站不做原文转载，这里只登记链接与「为什么值得读」。

**先读文档（把度量和归一化的关系钉死）**

- [Sentence Transformers · Semantic Textual Similarity](https://www.sbert.net/docs/sentence_transformer/usage/semantic_textual_similarity.html) —— 官方文档里 <code>similarity_fn_name</code> 的取值就是 cosine / dot / euclidean 三种，并且明确写着「模型末尾带归一化层时应该选 dot，它比 cosine 更快且等价」。<strong>本章第二节那张表的判据，在这页文档里就是一行配置——想确认「用哪个度量」到底由谁决定，看这一段。</strong>

**再看中文代码（把相似度算一遍）**

- [动手学深度学习（中文，zh.d2l.ai）](https://zh.d2l.ai/) —— 第 14 章的词嵌入部分把「向量、相似度、近似训练」讲成了可跑的代码。<strong>把余弦相似度那一节敲一遍，再回过头看本章的边界探测，会发现「支持 / 不支持分数很高」是可复现的，而不是玄学。</strong>

**最后读论文（对齐一手定义）**

- [Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks（arXiv:1908.10084）](https://arxiv.org/abs/1908.10084) —— 双塔句向量的一手来源，也是「为什么向量检索可以预计算」的起点。<strong>重点看它为什么要用 Siamese 结构把 10000 句的配对从 6500 万次推理降到 10000 次——这正是向量检索能存在的前提。</strong>

