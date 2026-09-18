# 知识目录

> 本站全部知识的索引。**要找「某件事在哪一章讲过」，先查这页。**
>
> 统计数字由 `node scripts/wiki-facts.mjs` 从正文清点得出，
> 并由 `node scripts/wiki-lint.mjs` 在体检时核对——手改数字会被拦住。

**口径**：`图` = 手写 `<svg>` 数量 · `码` = 围栏代码块数量 · `节` = `##` 小节数量 ·
`问答` = 题数（括号内为标注「高频」的题数）。

| 总量 | 4 领域 | 22 章 | 22 图 | 24 段代码 | 131 小节 | 72 问（30 高频） | 约 5.8 万汉字 |
| --- | --- | --- | --- | --- | --- | --- | --- |

---

## I. 大模型原理 · Model Foundations

> **先看懂发动机。** Harness 的工程决策最终都落在模型的物理特性上：
> 注意力是 O(n²) 的、缓存是按前缀命中的、激活是稀疏的、输出是采样的。
> 这部分只讲与工程强相关的原理，不推导公式。
> 版块色 `#2c4a7c` ｜ 建议阅读顺序：全站**第 1 站**。

| # | 章节标题 | 文件 | 难度 | 时长 | 图/码/节 | 问答 | 关键标签 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Transformer 与自注意力 | `llm-01-transformer.md` | L1 | 22 | 1/1/7 | 3(1) | Self-Attention · QKV · 复杂度 · 位置编码 |
| 2 | KV Cache：多轮对话的隐性账单 | `llm-02-kv-cache.md` | L2 | 26 | 1/2/6 | 4(3) | KV Cache · 前缀稳定性 · 成本模型 · 显存估算 |
| 3 | MoE 与稀疏激活 | `llm-03-moe.md` | L2 | 24 | 1/1/6 | 3(1) | MoE · 路由 · 稀疏激活 · 显存 |
| 4 | 采样、温度与确定性 | `llm-04-sampling.md` | L1 | 20 | 1/1/6 | 3(0) | Temperature · Top-P · 解码策略 · 确定性 |
| 5 | 推理优化与成本杠杆 | `llm-05-inference-opt.md` | L3 | 30 | 1/1/6 | 3(1) | 量化 · 投机解码 · Continuous Batching · MLA |

**这一领域的四根支柱**（面试里被反复问到的就这四件事）：
注意力复杂度决定了「上下文很贵」；KV Cache 与前缀稳定性决定了「多轮很便宜」；
MoE 决定了「大模型为什么能便宜」；采样策略决定了「为什么同样的问题两次答案不同」。

---

## II. Harness 工程 · Harness Engineering

> **模型之外的一切。** 如果 Agent = Model + Harness，那 Harness 就是「除模型以外的所有工作」。
> 这是全站的主战场，8 章按「原理 → 图解 → 代码 → 面试问答」逐章展开。
> 版块色 `#9b2c2c` ｜ 建议阅读顺序：**第 2 站**（本领域内部必须按 1→8 顺序读，后章依赖前章）。

| # | 章节标题 | 文件 | 难度 | 时长 | 图/码/节 | 问答 | 关键标签 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Harness 是什么 | `harness-01-what-is-harness.md` | L1 | 24 | 1/1/6 | 3(1) | Harness · 能力地图 · Agent 定义 |
| 2 | Agent Loop 与终止条件 | `harness-02-agent-loop.md` | L1 | 32 | 1/1/7 | 4(2) | ReAct · 终止条件 · 循环检测 · Human-in-the-loop |
| 3 | Tool Use 与工具契约 | `harness-03-tool-use.md` | L2 | 34 | 1/1/6 | 4(2) | Function Calling · 工具描述 · 错误分类 · MCP |
| 4 | Context Engineering | `harness-04-context-engineering.md` | L2 | 36 | 1/1/6 | 4(3) | 上下文预算 · 上下文压缩 · 前缀稳定性 · 状态外置 |
| 5 | Memory 记忆系统 | `harness-05-memory.md` | L2 | 30 | 1/1/6 | 3(1) | 长期记忆 · 写入策略 · 检索 · 冲突消解 |
| 6 | Subagent 与多智能体编排 | `harness-06-multi-agent.md` | L3 | 34 | 1/1/7 | 3(1) | Subagent · Supervisor · 上下文隔离 · 结果汇总 |
| 7 | 沙箱、权限与提示注入 | `harness-07-sandbox-security.md` | L3 | 32 | 1/1/6 | 3(2) | 沙箱 · 最小权限 · Prompt Injection · 审计 |
| 8 | 长任务与失败恢复 | `harness-08-long-horizon.md` | L2 | 36 | 1/2/6 | 4(2) | 流式卡死 · 状态机 · 检查点 · 幂等 |

**贯穿这 8 章的一条主线**：第 1 章画出能力地图 → 第 2 章是循环（骨架）→
第 3–5 章是循环要用到的三样东西（工具、上下文、记忆）→ 第 6 章是怎么拆成多个循环 →
第 7 章是拆开之后的安全边界 → 第 8 章是让整件事在长时间尺度上不塌。
**最容易答错的一题在第 8 章**：「工程问题 ≠ 研究问题」——这是 Harness 岗面试的分水岭。

---

## III. 评测工程 · Evaluation Engineering

> **从许愿到工程。** 没有评测的 Agent 迭代本质上是在许愿。
> 这部分讲清怎么建评测集、怎么定义指标口径、怎么让机器打分可信、
> 以及如何把线上 badcase 变成回归门禁。
> 版块色 `#b8944b` ｜ 建议阅读顺序：**第 3 站**。

| # | 章节标题 | 文件 | 难度 | 时长 | 图/码/节 | 问答 | 关键标签 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 评测的第一性问题 | `eval-01-first-principles.md` | L1 | 24 | 1/1/6 | 3(1) | 评测设计 · 基线 · 噪声 · 可复现 |
| 2 | 评测集建设与防过拟合 | `eval-02-dataset.md` | L2 | 30 | 1/1/6 | 3(1) | 评测集 · 保留集 · 分层 · Badcase 回流 |
| 3 | 办事型 Agent 的硬指标 | `eval-03-executable-metrics.md` | L2 | 30 | 1/1/6 | 3(1) | 可执行率 · 参数准确性 · 计算口径 · 指标定义 |
| 4 | 洞察型评分与 LLM-as-Judge | `eval-04-insight-judge.md` | L3 | 34 | 1/1/5 | 3(2) | 多维评分 · Rubric · LLM-as-Judge · 偏差控制 |
| 5 | Trace、Replay 与线上闭环 | `eval-05-trace-loop.md` | L2 | 28 | 1/1/6 | 3(1) | Trace · Replay · 回归门禁 · 灰度发布 |

**双轨结构**（本领域的骨架）：**办事型** Agent 看硬指标（可执行率 / 参数准确率 / 任务完成率），
**洞察型** Agent 看多维评分（方向相关性 / 证据充分性 / 可操作性 / 表达清晰度）。
第 3、4 章分别对应这两轨，第 5 章把两轨接进同一条线上闭环。

---

## IV. 知识引擎 · Knowledge Engine

> **让回答有据可查。** Agent 的幻觉不是靠提示词治好的，
> 是靠「回答必须落在可验证的知识上」治好的。
> 版块色 `#2f6157` ｜ 建议阅读顺序：**第 4 站**。

| # | 章节标题 | 文件 | 难度 | 时长 | 图/码/节 | 问答 | 关键标签 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 知识建模：实体、事实、推断 | `knowledge-01-modeling.md` | L2 | 30 | 1/1/5 | 3(1) | 实体抽取 · 事实层 · 推断层 · 依据链 |
| 2 | RAG 的链路与失效模式 | `knowledge-02-rag.md` | L2 | 32 | 1/1/5 | 3(1) | RAG · 切分 · 召回 · 失效模式 |
| 3 | Embedding 与向量检索 | `knowledge-03-embedding.md` | L2 | 28 | 1/1/6 | 3(1) | Embedding · 余弦相似度 · ANN · 能力边界 |
| 4 | 混合检索、Rerank 与知识可信 | `knowledge-04-hybrid-trust.md` | L3 | 34 | 1/1/5 | 4(1) | 混合检索 · Rerank · 溯源引用 · 冲突消解 |

**这四章的递进关系**：先定义知识的形状（三层建模）→ 再讲怎么把它取出来（RAG 链路）→
再讲取出来靠什么算（向量检索及其边界）→ 最后把召回与精排拼成一条可信链路（混合 + Rerank + 溯源）。

---

## 学习路径与前置关系

```
I. 大模型原理 (5章)  →  II. Harness 工程 (8章)  →  III. 评测工程 (5章)  →  IV. 知识引擎 (4章)
   为什么要懂              真正的战场                怎么证明有用            知识怎么进去
   ─── 无前置 ───       ─── 依赖 I 的成本模型 ──   ── 依赖 II 的循环 ──   ── 依赖 II+III ──
```

**强依赖（不读前一章会卡住）：**

| 这一章 | 必须先读 | 因为 |
| --- | --- | --- |
| `harness-04-context-engineering` | `llm-02-kv-cache` | 上下文顺序为什么影响**成本**，答案在前缀命中 |
| `harness-04-context-engineering` | `llm-01-transformer` | 上下文预算为什么必须切分，答案在 O(n²) |
| `harness-08-long-horizon` | `harness-02-agent-loop` | 状态机是终止条件的延长线 |
| `eval-02-dataset` | `eval-01-first-principles` | 不知道「评什么维度」就建不出评测集 |
| `eval-05-trace-loop` | `eval-03` / `eval-04` | 回归门禁要挂在前两章定义好的指标上 |
| `knowledge-04-hybrid-trust` | `knowledge-02-rag` · `knowledge-03-embedding` | 混合检索 = 关键词 + 向量，两者都要懂 |

**可以独立读的章节**（时间紧就从这几章开始）：
`harness-01-what-is-harness`（全局地图）、`harness-02-agent-loop`（骨架）、
`eval-03-executable-metrics`（口径）、`knowledge-02-rag`（最常被问的链路）。

---

## 题库索引

72 问分布在 4 个领域，其中 30 题标为**高频**（`freq: 'high'`）。
高频题集中在这三处，是面试前最该过的：

| 高密集区 | 高频题数 | 主题 |
| --- | --- | --- |
| `harness-04-context-engineering` | 3 | 上下文预算怎么分、压缩策略、为什么顺序影响成本 |
| `llm-02-kv-cache` | 3 | 缓存命中率取决于什么、显存怎么估 |
| `harness-02-agent-loop` · `harness-03-tool-use` · `harness-07-sandbox-security` · `harness-08-long-horizon` · `eval-04-insight-judge` | 各 2 | 终止条件与死循环、工具描述与错误回喂、注入防御、流式卡死与恢复、Judge 偏差 |

题库的**唯一来源**是 `src/data/interview.ts`，
章节页的「面试官会怎么问」与 `/interview/` 总览页共用同一份数据——**不要在正文里再抄一遍问答**。

每道题的结构：`q`（问题）· `answer`（参考答案，可含少量内联 HTML）·
`hint`（加分点：答出这层说明真做过）· `followups`（追问链）· `freq`（是否高频）。

---

## 路由与页面索引

| 路由 | 源文件 | 说明 |
| --- | --- | --- |
| `/` | `src/pages/index.astro` | 头版：能力地图、四领域入口、学习路径 |
| `/<domain>/` | `src/pages/[domain]/index.astro` | 领域索引（`llm` / `harness` / `eval` / `knowledge`） |
| `/<domain>/<id>/` | `src/pages/[domain]/[slug].astro` | 章节页（22 个）。**这是正文唯一的出口** |
| `/interview/` | `src/pages/interview.astro` | 题库总览（可筛选、可自评） |
| `/progress/` | `src/pages/progress.astro` | 学习进度、30 天热力图、复习队列、导出/导入 |
| `/about/` | `src/pages/about.astro` | 关于本站、出品方、关联网站、隐私模型 |

页面骨架：`BaseLayout.astro`（报头 + 侧栏 + 纸张翻页过渡 + 本机数据面板
+ `.sheet` 两侧的 `rail-prev` / `rail-next` 具名 slot）
→ `ChapterLayout.astro`（阅读框架 + 进度/笔记/自评 + **两侧大翻页区** + 章尾 `.pager`）。

---

## 资产索引

| 资产 | 位置 | 说明 |
| --- | --- | --- |
| 站点图标 | `public/favicon.svg` | |
| 缓存策略 | `public/_headers` | 带哈希静态资源 1 年强缓存；HTML 不缓存 |
| 公众号二维码 | `https://beatree.cn/gzh/gzh-qr-card.jpg` | 外链，不在本仓库 |
| 关联网站清单 | `scripts/sources.txt` | 原始台账，可被 `check-links.mjs` 验活 |

> ✅ **已收敛（2026-09-18）**：根 `README.md` 曾称每章图解「另附 CSV 原始数据表」，
> 而实际全站只有首页能力地图那一份 CSV。经确认那属于早期表述失误——
> **本站不提供 CSV 数据附件**，图解的结论以图注与正文承载。
> 因此 `public/data/` 目录连同 `harness-layers.csv` 已整体删除，
> README / wiki / 首页正文里的相关提及也一并清掉（`verify-build.mjs` 有「产物中不得出现 csv 下载入口」的断言思路可循）。
> 若日后确要提供数据附件，**先想清楚它服务谁**，再在 `public/data/` 落盘并在上表登记。
