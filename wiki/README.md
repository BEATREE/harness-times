# Harness Times · 知识库（wiki）

> 这是本站的**唯一维护入口**。想让 AI 或你自己改动站内知识，先读这一页。
>
> 它和根目录 `README.md` 的分工：`README.md` 面向「怎么把这个项目跑起来」（安装 / 构建 / 部署）；
> 本目录面向「里面的知识是怎么组织的、怎么改不会改坏」。

---

## 一、为什么需要它

这个站的正文有 22 章、约 5.8 万字、22 张手绘图解、24 段代码、72 道面试问答。
内容分散在四类文件里：

| 内容 | 载体 | 谁在消费 |
| --- | --- | --- |
| 章节元数据（编号 / 标题 / 难度 / 时长 / 标签） | `src/data/curriculum.ts` | 侧栏、首页、领域页、上/下章 |
| 章节正文（含手写 SVG、三线表、代码、自测题） | `src/content/chapters/*.md` | 章节页 |
| 面试问答（含追问链、高频标记） | `src/data/interview.ts` | 章节页、`/interview/` 总览 |
| 关联网站台账 | `scripts/sources.txt` → `src/pages/about.astro` | 关于页 |

分散带来的问题是：**改一处、忘一处**。最典型的三个坑——
往正文里加一章，忘了在 `curriculum.ts` 登记（构建会失败，还算安全）；
改了正文里的图解数量，wiki 里的统计没跟着改（静默出错，没人发现）；
改了 markdown 渲染管线，构建过了但产物没变（最阴的一个，README 里有专门一节）。

本目录就是为了让这三类事情有一处可查、可校验的地方。

---

## 二、三层结构

借鉴 LLM Wiki 的分层思想：**原始层不加工、知识层可检索、规则层管约束**。
每一层只对下一层负责，改动时按层判断「我这次动的是哪一层」。

```
┌─ 规则层（怎么改） ────────────────────────────────────────────┐
│  wiki/schema.md      写作契约、图解与代码规范、术语表、禁止事项  │
└───────────────────────────────────────────────────────────────┘
             ↑ 约束
┌─ 知识层（有什么） ────────────────────────────────────────────┐
│  wiki/index.md       4 领域 / 22 章 / 72 问的完整目录与统计     │
│  wiki/log.md         追加式变更日志（只写不删）                 │
└───────────────────────────────────────────────────────────────┘
             ↑ 引用
┌─ 原始层（从哪来） ────────────────────────────────────────────┐
│  wiki/sources.md     取材原则与外链台账                        │
│  scripts/sources.txt 「关联网站」的原始清单（可被脚本验活）      │
│  src/content/…       正文本身（不做二次加工的真实来源）          │
└───────────────────────────────────────────────────────────────┘
```

**改动的判断规则：**

- 只改文字措辞、例子、错误信息 → 动**原始层**（正文），完事跑一次 lint 核对统计。
- 加了章、换了标题、调了难度 → 动**原始层 + 知识层**（`curriculum.ts` + `index.md`）。
- 改了「以后所有章节都必须遵守的东西」（比如图解必须带 `--vbw`）→ 动**规则层**（`schema.md`），
  并同步加到 `scripts/wiki-lint.mjs` 的断言里，让它从「文档里的愿望」变成「构建期会拦的规则」。

---

## 三、三个操作

### ① ingest —— 新增或修订内容

**改一章的正文**（最常见的操作）：

```bash
# 1. 找到这一章 → wiki/index.md 的目录表，或直接看文件名
#    （文件名即章节 id，如 harness-04-context-engineering.md）

# 2. 改正文
#    注意：HTML 块内部不要留空行，否则图会被截断成 <pre>
npm run content:check      # 先自查有没有空行问题
npm run content:fix        # 有的话自动修（只删 HTML 块内的空行）

# 3. 重建并验证
npm run build:fresh        # 动了 markdown 管线就必须 fresh；只改正文可以 npm run build
node scripts/verify-build.mjs    # 50 项产物断言
node scripts/wiki-lint.mjs       # 核对 wiki 统计有没有漂
```

**新增一章**（涉及 4 个文件，缺一个就构建失败）：

```bash
# 1. src/data/curriculum.ts  → CHAPTERS 数组里登记（id / domain / no / 标题 / 难度 / 时长 / 标签）
# 2. src/content/chapters/<id>.md → 新建正文，frontmatter 里 chapter 必须等于文件名
# 3. src/data/interview.ts   → 加 3–4 道问答（不加也能构建，但页面上会少一块）
# 4. wiki/index.md           → 补一行目录（跑 node scripts/wiki-facts.mjs --md 拿现成的行）
```

**修订题库**：改 `src/data/interview.ts`。问答只在这一份数据里维护，
章节页与 `/interview/` 总览共用，**不要在正文里再抄一遍**。

### ② query —— 查内容落在哪

不要靠全文搜索找「讲过 X 的是哪一章」，先查 `wiki/index.md` 的目录表：
每章都有一列「核心命题」和一行「关键标签」。目录表查不到再搜正文。

也可以直接用脚本清点：

```bash
node scripts/wiki-facts.mjs          # 明细：每章几图、几段代码、几节、几题
node scripts/wiki-facts.mjs --md     # 输出可直接粘进 index.md 的表格行
```

### ③ lint —— 内容体检

| 命令 | 查什么 | 什么时候跑 |
| --- | --- | --- |
| `npm run content:check` | HTML 块里有没有空行（图会不会被截断） | 改完正文，已挂在 `prebuild` |
| `node scripts/verify-build.mjs` | 产物结构：50 项断言（代码块、翻页、图解动效、居中实现…） | 每次构建后 |
| `node scripts/wiki-lint.mjs` | 本目录的统计与实际内容是否一致 | 改完正文/题库后 |
| `node scripts/check-links.mjs` | 站外链接是否还活着 | 上线前后 |
| `node tools/verify.mjs` | 活页面交互（36 项，需起 preview） | 动过 JS/交互后 |
| `node scripts/measure.mjs` | 版面几何（居中、留白、溢出） | 动过 CSS 后 |

> `tools/verify.mjs` / `scripts/measure.mjs` / `scripts/shoot.mjs` 都需要先起预览服务：
> `npm run preview`，地址是 **`http://localhost:4321`**（注意不是 `127.0.0.1`）。

---

## 四、不变量（改坏了会静默出错的那几条）

这些不是风格偏好，是**踩过坑之后立的规矩**。详细说明在 `schema.md`，这里只列清单：

1. **`curriculum.ts` 是章节元数据的唯一来源**，frontmatter 只放 `chapter` / `lead` / `note`，
   不许在 frontmatter 里再写一遍标题、难度、标签。
2. **`frontmatter.chapter` 必须等于文件名**。不等会在 `[slug].astro` 里抛错、构建失败。
3. **正文里的 HTML 块内部不能有空行**。CommonMark 规定 HTML 块遇空行即终止，
   `<figure>` 会被腰斩，后半段渲染成 `<pre>`——页面看着还在，图没了。
4. **手写 `<svg>` 必须带 `style="--vbw:<设计宽度>"`**。移动端靠这个值决定图解的最小宽度，
   缺了它小屏上字会被压到读不清。
5. **SVG 空元素必须正确自闭合**（`<rect … />` 的斜杠不能丢）。
   构建期插件 `src/lib/diagram-motion.mjs` 会检查并**在丢失时直接抛错**，
   因为一旦丢掉斜杠，整张图会静默消失而构建照过。
6. **动了 markdown 管线（`astro.config.mjs` 的 `markdown` 配置、`src/lib/*.mjs`）必须 `npm run build:fresh`**。
   Astro 5 的内容缓存键不含插件，不清缓存会出现「改了、构建过了、产物没变」。
7. **不再出现「本报」「第 N 期」**。本站是按章组织、随修订更新的学习站，不是每日报刊。
8. **每章必须有 1 张主图 + ≥1 段可运行代码 + 3–4 道问答**（当前 22 章全部满足）。

---

## 五、不要在这里做的事

- **不要把 `wiki/index.md` 手写成「副本」**。它只放目录、统计与命题，
  正文永远只有一份，在 `src/content/chapters/`。
- **不要为了「内容更全」把受版权保护的原文抄进 wiki**。`sources.md` 只登记链接与「为什么值得读」。
- **不要在 wiki 里记构建产物、临时路径、调试输出**——那些用 `.shots/`、`.probe-out.txt`（已在 `.gitignore`）。

---

## 六、文件索引

| 文件 | 一句话 |
| --- | --- |
| `wiki/README.md` | 本页：三层结构 + 三个操作 + 不变量清单 |
| `wiki/index.md` | 知识目录：4 领域 / 22 章 / 72 问，每章一行 |
| `wiki/schema.md` | 规则层：写作、图解、代码、命名、术语的契约 |
| `wiki/sources.md` | 原始层：取材原则 + 外链台账 + 归属章节 |
| `wiki/log.md` | 追加式变更日志（倒序，最新的在最上面） |
| `design.md` | **设计系统**（仓库根目录）：色板、字体、版面骨架、动效、断点、无障碍 —— 面向「换个项目怎么复用」 |
| `scripts/wiki-facts.mjs` | 清点脚本：产出 `index.md` 里的统计 |
| `scripts/wiki-lint.mjs` | 体检脚本：核对 wiki 与真实内容是否一致 |

> 改**版式 / 配色 / 断点**要读 `design.md`；改**内容 / 图解 / 代码块**要读 `schema.md`。
> 两者有交集的地方（图解规范）以 `schema.md` 为准，`design.md` 只讲设计意图。
