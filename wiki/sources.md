# 原始层：取材原则与外链台账

> 这一层记录**内容从哪来**。它不做加工，也不重复正文——
> 只回答两个问题：写这些内容时依据的是什么？读者想往下深挖该去哪？

---

## 一、取材原则

1. **不抄原文，只重写。** 站内所有正文、图例、代码、指标口径都是原创整理重写，
   不直接复制任何受版权保护的原文。引用的观点会说明出处，但不用原文句子。
2. **一手优先。** 凡是二手解读有分歧的地方，回到官方文档与原始论文对一遍。
   所以「官方文档与工程手册」是台账里的第一组，也是唯一一组被要求「必须点开看」的。
3. **只收「点进去就有东西读」的页面。** 关联网站不收首页导航型站点、
   不收需要注册才能看内容的站点、不收纯聚合器。每条链接都必须能回答「为什么值得读」。
4. **工程实践优先于学术综述。** 这个站的定位是 Harness / Agent **工程**，
   所以长期更新的工程博客（写自己踩过的坑）比综述论文权重更高。
   例外是评测与基准——那里必须看原始基准的做法，不能看转述。
5. **面试反馈是取材的一部分。** 题库里有相当一部分题目来自公开的岗位 JD 与面试反馈。
   其中「工程问题 ≠ 研究问题」这条分界线被反复标记为高频，因为它是 Harness 岗
   最常见的**答错类型**（不是答不上来，是答成了另一个问题）。

---

## 二、外链台账

**唯一台账是 `scripts/sources.txt`**（每行一个 URL，`#` 开头为注释）。
`src/pages/about.astro` 的「关联网站」区是从它派生的展示层。

当前数量关系（`verify-build.mjs` 有断言盯着）：

```
sources.txt        29 条 URL
  ├─ 本站相关       2 条（beatree.cn 主站 + 公众号二维码）→ 不在「关联网站」列表里
  └─ 关联网站       27 条 → about.astro 的 27 个 .rel-item
```

> ⛔ **改「关联网站」的正确顺序**：先改 `scripts/sources.txt` → 跑
> `node scripts/check-links.mjs --file=scripts/sources.txt` 验活 →
> 再把确认可用的写进 `about.astro` 的 `RELATED` 数组 → 最后跑 `verify-build.mjs`
> （它断言 `.rel-item` 数量，数量错了会失败）。
> **不要只改 `about.astro`**，那样台账和展示层就分家了。

### 分组清单

#### 1. 官方文档与工程手册（8 条）

一手资料。凡是二手解读有分歧的地方，回到这里对一遍。

| 站点 | URL | 归属章节（编辑判断） |
| --- | --- | --- |
| Anthropic Engineering | `anthropic.com/engineering` | `harness-01` · `harness-04` |
| Building Effective Agents | `anthropic.com/engineering/building-effective-agents` | `harness-01` · `harness-06` |
| Claude Docs · 提示工程 | `docs.claude.com/…/prompt-engineering/overview` | `harness-03` · `harness-04` |
| Anthropic Learn | `anthropic.com/learn` | 全站入门 |
| OpenAI Cookbook | `developers.openai.com/cookbook` | `harness-03` · `knowledge-02` · `eval-*` |
| OpenAI Platform Docs | `platform.openai.com/docs/overview` | `harness-03` · `llm-04` |
| OpenAI Academy | `academy.openai.com` | 全站入门 |
| Model Context Protocol | `modelcontextprotocol.io` | `harness-03` |

#### 2. 长期更新的工程博客（6 条）

这些作者的特点是：写自己踩过的坑，而不是转述别人的结论。

| 站点 | URL | 归属章节（编辑判断） |
| --- | --- | --- |
| Simon Willison | `simonwillison.net` | 全站 · 工具与提示的真实观察 |
| Lilian Weng | `lilianweng.github.io` | `harness-05` · `harness-06`（记忆与规划的综述式长文） |
| Eugene Yan | `eugeneyan.com` | `knowledge-02` · `eval-02`（检索与评测） |
| Hamel Husain | `hamel.dev` | `eval-01` – `eval-05`（评测实操，这一组最重要的一条） |
| Chip Huyen | `huyenchip.com/blog` | `eval-01` · `harness-08`（ML 系统视角） |
| Phil Schmid | `philschmid.de` | `llm-05` · `harness-03`（推理优化、代码可跑） |

#### 3. 评测、基准与前沿（4 条）

想知道「怎么证明它真的行」，就从这些基准的做法开始看。

| 站点 | URL | 归属章节（编辑判断） |
| --- | --- | --- |
| SWE-bench | `swebench.com` | `eval-02` · `eval-03` · `harness-08` |
| SWE-bench (GitHub) | `github.com/SWE-bench/SWE-bench` | `eval-02`（看评测集怎么构建） |
| τ-bench | `github.com/sierra-research/tau-bench` | `eval-03`（办事型 Agent 的指标口径参考） |
| arXiv cs.CL recent | `arxiv.org/list/cs.CL/recent` | 前沿跟踪，无固定归属 |

#### 4. 框架与工具（6 条）

选型时对照读，不是必须用。

| 站点 | URL | 归属章节（编辑判断） |
| --- | --- | --- |
| LangChain | `python.langchain.com/docs/introduction` | `harness-02`（循环的工业实现） |
| LangGraph | `langchain-ai.github.io/langgraph` | `harness-02` · `harness-08`（状态机与持久化） |
| AutoGen | `microsoft.github.io/autogen/stable` | `harness-06`（多智能体编排） |
| OpenAI Agents SDK | `github.com/openai/openai-agents-python` | `harness-02` · `harness-03` |
| CrewAI | `docs.crewai.com` | `harness-06` |
| E2B | `e2b.dev` | `harness-07`（沙箱执行环境） |

#### 5. 中文资源（3 条）

| 站点 | URL | 归属章节（编辑判断） |
| --- | --- | --- |
| 动手学深度学习（中文版） | `zh.d2l.ai` | `llm-01` – `llm-05` 补齐数学与实现细节 |
| 李宏毅机器学习（台大） | `speech.ee.ntu.edu.tw/~hylee/ml/2023-spring.php` | `llm-01` – `llm-05` 入门视角 |
| Datawhale hugging-llm | `github.com/datawhalechina/hugging-llm` | `llm-02` · `llm-05` 动手 |

#### 6. 本站相关（2 条，不进入「关联网站」列表）

| 用途 | URL |
| --- | --- |
| 主站（零散笔记与工具折腾记录） | `https://beatree.cn` |
| 公众号二维码 | `https://beatree.cn/gzh/gzh-qr-card.jpg` |

主站在页面上有**三处入口**，缺一不可（`verify-build.mjs` 断言）：

1. **报头**：`做棵大树 出品` 右侧的 `主站 beatree.cn ↗` pill 按钮（`Masthead.astro`）
2. **关于页**：`关于本站` 里的 `.cta-row` 大按钮（`about.astro`）——全页最想让人点出去的地方
3. **侧栏**：「关于本站」之下的 `做棵大树 · 主站` 外链项（`Sidebar.astro`）

> 📌 **2026-09 修订**：曾收录过「宝玉 baoyu.io（长期翻译与解读大模型一手资料的中文专栏）」，
> 已按作者要求移除。移除时同步更新了 `scripts/sources.txt` 与 `wiki/index.md` 的统计。
>
> ⚠️ 注意「中文资源」这一组现在只有 3 条，且**没有一条是中文的 AI 评论/专栏**——
> 这是因为原来唯一的一条（宝玉）被移除了。若日后要补，请补充「原创解读 + 持续更新」型站点，
> 不要补搬运号。

---

## 三、外链验活

外链失效**构建期发现不了**（本地不联网也不会报错），必须在发布前后单独跑：

```bash
node scripts/check-links.mjs                              # 扫描 src/ 下全部 http(s) 链接
node scripts/check-links.mjs --file=scripts/sources.txt   # 只查台账
```

扫描会先剥掉围栏代码块与行内代码，避免把示例里的 `example.com` 当成真链接误报。

**已知误报，不要当成失效：**

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `openai.com` 系域名返回 403 | 对非浏览器 UA 的反爬 | 正常，链接有效 |
| 少数域名 `fetch failed` | 受限网络 | 换网络再验，不代表站点下线 |
| GitHub 仓库 301 | 仓库被重命名 | 脚本已跟随重定向，看最终地址 |

---

## 四、已知偏差（登记不掩盖）

| # | 偏差 | 状态 |
| --- | --- | --- |
| 1 | 根 `README.md` 曾称每章图解「另附 CSV 原始数据表」，实际全站只有 `public/data/harness-layers.csv`（首页能力地图用），22 张章节图解**没有**配套 CSV | ✅ **已收敛（2026-09-18）**：确认「CSV」属早期表述失误，本站不提供 CSV 附件；`public/data/` 与全部 CSV 提及已删除 |
| 2 | 「关联网站」的**分组归属**与「归属章节」是编辑判断，不是原文声明 | 本页已明确标注，非问题 |
| 3 | 22 处插图金句署名为 `<cite>本刊编辑部</cite>`，与「非报刊」定位措辞不一致 | 见 `wiki/schema.md` 第十节 |
| 4 | 「中文资源」组在移除宝玉后只剩 3 条，且**没有一条是中文的 AI 评论 / 专栏** | 待办：可补充「原创解读 + 持续更新」型站点，不补搬运号 |

> 发现偏差请**登记到本表**并在 `wiki/log.md` 记一笔，
> 不要只在对话里说一句——那种信息一定会丢。
