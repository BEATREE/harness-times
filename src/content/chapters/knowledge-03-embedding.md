---
chapter: knowledge-03-embedding
lead: '语义检索为什么会找错？因为「语义相近」和「对回答问题有用」是两件事。前者是向量空间的几何关系，后者是任务相关性的判断。理解这中间的落差，才能明白向量检索的边界在哪里、什么时候必须叠加别的检索手段。'
note: '本章的核心是「能力边界」而不是数学。重点是理解为什么纯向量检索在一些场景必然失效。'
---

<p class="dropcap">先把向量检索的物理本质讲清楚：它把文本映射到一个高维空间里的点，让「语义相近的文本」在空间里距离更近。检索就是找最近的邻居。这个机制非常有效，也有非常明确的边界——而多数误用都源于不清楚边界在哪。</p>

## 一、嵌入做的事：从符号到坐标

文本在计算机里本来是离散符号序列，无法比较「相似」。嵌入模型把它变成连续向量，于是「相似」变成了「距离」这个可计算的东西。

关键在于「相似」是通过什么学到的。模型在大量文本对（相似的、不相似的）上训练，学会了把「意思接近」的文本映射到相近的位置。这带来两个直接结论：

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

## 四、动手：三种度量的对比与边界探测

<div class="code-block">
  <div class="code-head"><span>embedding_bounds.py</span><span class="lang">python</span></div>
  <pre><code>import numpy as np
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
</code></pre>
</div>

<div class="box box-practice">
  <span class="box-title">实操任务</span>
  <ul>
    <li>跑一遍 <code>probe_polarity_and_exactness()</code>，亲眼看「支持/不支持」的余弦相似度有多高——这个数字会改变你对向量检索的信任度；</li>
    <li>用你自己的语料构造 10 组「应该被区分开但向量分不清」的样本，统计需要用到关键词检索的比例；</li>
    <li>回答一个问题：如果你的检索系统里 30% 的查询属于这三类失效场景，你应该优先改哪一环？</li>
  </ul>
</div>

## 五、自测

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

## 六、小结

| 议题 | 结论 |
| --- | --- |
| 嵌入的本质 | 把语义相近映射为距离相近；编码的是「语义场」而非精确信息 |
| 度量选择 | 依据嵌入模型的训练方式（查模型卡），并用已知样本对比验证 |
| 三类失效 | 精确匹配类、极性反转类、条件约束类——都是机制性失效 |
| 应对方向 | 精确串用关键词检索；极性用查询改写；条件用元数据过滤下推 |
| 一条纪律 | 不要指望换嵌入模型解决边界问题；要靠混合手段 |

<p class="pull-quote">向量检索不是「更好的搜索」，它是「另一种搜索」。它的价值在于补上了关键词检索找不到的语义相近，代价是丢掉了关键词检索最擅长的精确。<cite>本刊编辑部</cite></p>

最后一章把关键词检索与向量检索拼在一起，解决「召回要宽、排序要准、引用要能被验证」这三件事。
