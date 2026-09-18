# Harness Times · Agent 工程学习站

一份用**报纸版式**写成的 Harness / Agent 工程中文学习站。22 章正文，覆盖大模型原理、Harness 工程、评测工程、知识引擎构建四大领域；理论、动手实操、面试问答三层递进。

Astro 静态站，学习进度全部存在**你自己的浏览器**里（localStorage），不经过任何服务器。

---

## 这个站在解决什么问题

市面上的 Agent 学习资料普遍有两个毛病：要么是散落的博客，读完接不起来；要么是论文清单，读完知道名词但不会写代码。这个站按一条学习路径组织内容：

```
大模型原理 (5 章)  →  Harness 工程 (8 章)  →  评测工程 (5 章)  →  知识引擎 (4 章)
   为什么要懂          真正的战场              怎么证明有用          知识怎么进去
```

每章包含：

| 结构 | 说明 |
| --- | --- |
| 导读 | 一句话说清这章要解决什么 |
| 正文 | 原理拆解，报纸式排版（首字下沉、双栏、三线表、pull quote） |
| 图解 | 内联 SVG 手绘示意图，随图附图注结论；首页能力地图另附 CSV 原始数据（`public/data/harness-layers.csv`） |
| 实操 | 可直接跑的代码，不是伪代码 |
| 面试官会怎么问 | 3–4 组问答，含追问链 |
| 自测题 | 3 道单选题，答完即时给解析 |

---

## 维护站内知识 → 先读 `wiki/`

本仓库带一个**知识库**（`wiki/`），它是内容的唯一维护入口。想让 AI 或你自己改动站内知识，
先读 [`wiki/README.md`](wiki/README.md)：

| 文件 | 一句话 |
| --- | --- |
| [`wiki/README.md`](wiki/README.md) | 三层结构（原始 / 知识 / 规则）、三个操作（ingest / query / lint）、**不变量清单** |
| [`wiki/index.md`](wiki/index.md) | 知识目录：4 领域 / 22 章 / 72 问，每章一行含统计与关键标签 |
| [`wiki/schema.md`](wiki/schema.md) | 契约：frontmatter、正文骨架、图解规范、代码块、术语表、禁止事项 |
| [`wiki/sources.md`](wiki/sources.md) | 原始层：取材原则、外链台账（29 条）、归属章节、已知偏差 |
| [`wiki/log.md`](wiki/log.md) | 追加式变更日志 |

改 **版式 / 配色 / 断点 / 动效** 请读根目录的 [`design.md`](design.md)
（设计系统：色板、字体分工、版面骨架、响应式、无障碍与对比度实测）。

```bash
npm run wiki:facts     # 清点每章图 / 码 / 节 / 题（--md 输出可直接贴进 index.md）
npm run wiki:lint      # 体检：wiki 里的统计与真实内容是否一致
npm run verify:build   # 体检：dist/ 的 50 项产物结构断言
```

`wiki:lint` 是防「wiki 自己变成错误信息源」的：手写的统计一定会漂，
所以断言会核对 `index.md` 的每章数字、`curriculum.ts` 的难度时长、题库题数，以及 `schema.md` 里
那些「必须」是否真的成立。漂了会直接指出是哪一章、差多少。

> 如果你只想知道「某件事在哪一章讲过」——查 `wiki/index.md` 的目录表，别全文搜索。

---

## 本地开发

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # 产出 dist/
npm run preview    # 预览 dist/
```

### 内容校验（重要）

章节正文是 Markdown，但插图、信息盒、三线表都是**内联 HTML**。CommonMark 规定「HTML 块遇到空行即终止」，因此 SVG 内部只要有空行，`<figure>` 就会被截断，后半段会被当成缩进代码块渲染成 `<pre>`——页面看着还在，图却没了。

所以本项目加了一道内容守卫：

```bash
npm run content:check   # 校验（已挂在 prebuild，构建前自动运行）
npm run content:fix     # 自动删除 HTML 块内部的空行
```

`npm run build` 会先跑 `content:check`，发现问题直接构建失败，避免把坏图推上线。

---

## 项目结构

```
src/
├── data/
│   ├── curriculum.ts        # 4 大领域 / 22 章元数据（编号、难度、时长、关键词）
│   └── interview.ts         # 题库：22 章 × 3–4 题，含高频标记与追问
├── content/
│   ├── chapters/*.md        # 22 章正文
│   └── content.config.ts     # 内容集合 schema
├── layouts/
│   ├── BaseLayout.astro     # 报头 + 侧栏 + 纸张翻页过渡 + 本机数据面板
│   └── ChapterLayout.astro  # 章节阅读框架 + 进度/笔记/自评控件
├── components/              # Masthead / Sidebar / QA / InterviewSection
├── lib/progress.ts          # 存储层（localStorage，带版本号与迁移）
├── pages/
│   ├── index.astro          # 头版
│   ├── about.astro          # 关于本站（定位、出品方、关联网站、隐私模型）
│   ├── interview.astro      # 面试题库总览（可筛选、可自评）
│   ├── progress.astro       # 学习进度与复习计划
│   └── [domain]/            # 领域索引 + 章节页
└── styles/global.css        # 报纸设计系统

wiki/                        # 知识库：内容维护的唯一入口（先读 wiki/README.md）
├── README.md                # 三层结构 + 三个操作 + 不变量清单
├── index.md                 # 知识目录：4 领域 / 22 章 / 72 问
├── schema.md                # 契约：写作、图解、代码、命名、术语
├── sources.md               # 取材原则 + 外链台账 + 归属章节
└── log.md                   # 追加式变更日志

scripts/
├── normalize-content.mjs    # 内容守卫（见上）
├── clean.mjs                # 清 Astro 内容缓存（改 markdown 管线后必须跑）
├── check-links.mjs          # 外链体检
├── sources.txt              # 「关联网站」清单的原始台账
├── verify-build.mjs         # dist/ 产物结构断言（50 项）
├── measure.mjs              # 版面几何：居中、留白、溢出
├── shoot.mjs                # CDP 截图（22 张 → .shots/）
├── wiki-facts.mjs           # 清点每章图 / 码 / 节 / 题
└── wiki-lint.mjs            # 校验 wiki 统计与真实内容一致

tools/                       # 零依赖 CDP 验证工具（verify / audit / bisect / probe）
public/data/*.csv            # 图解对应的原始数据
```

---

## 两个容易踩的坑

### 1. 改 markdown 管线后必须清缓存

Astro 5 会把 markdown 的**渲染结果**缓存到 `.astro/`，缓存键只跟内容文件有关，跟你改的 remark/rehype/shiki 插件**无关**。所以只要动了 `astro.config.mjs` 里的 `markdown` 配置或 `src/lib/code-title.mjs`，就得先清缓存再构建，否则会出现「代码改了、构建也过了、产物一动不动」。

```bash
npm run clean         # 只清缓存
npm run build:fresh   # 清缓存 + 构建
```

### 2. 代码块的文件名栏靠「接力」实现

围栏写成 ```` ```python title="agent_loop.py" ```` 时，文件名不在 Shiki 的常规输出里，需要两步：

1. `src/lib/code-title.mjs` 的 `shikiCodeTitle()` 是 Shiki transformer，从 `this.options.meta.__raw` 里抠出 title 挂到 `<pre data-title>` 上。
   —— 注意 Shiki 调 `pre()` 时**只传一个参数**，meta 在 `this` 上，所以这个钩子必须是普通方法，不能写成箭头函数。
2. `rehypeCodeTitleWrapper()` 是 rehype 插件，在最终 hast 上把带 `data-title` 的 `<pre>` 包成 `<div class="code-block"><div class="code-head">…</div><pre/></div>`。
   —— 它能生效的前提是 Astro 把用户 rehype 插件排在 Shiki **之后**（`@astrojs/markdown-remark` 里确实是这个顺序）。

---

## 外链体检

正文与「关于本站」页里有不少站外链接，失效了构建期发现不了。上线前后跑一次：

```bash
node scripts/check-links.mjs                     # 扫描 src/ 下全部 http(s) 链接
node scripts/check-links.mjs --file=scripts/sources.txt
```

扫描会先剥掉围栏代码块与行内代码，避免把示例里的 `example.com` 当成真链接误报。
`openai.com` 系域名对非浏览器 UA 返回 403 属正常反爬，不代表链接失效。

---

## 学习进度的存储模型

单 key：`ht:progress:v1`。所有写入都包在 `try/catch` 里——隐私模式和配额满时不能白屏，这是学习站的底线。

记录内容：

- 章节状态（未读 / 阅读中 / 已学完）、打开次数、累计停留秒数、最大滚动完成度
- 自测作答（题目 ID → 选择与对错）
- 掌握度自评 0–5、重点标记
- 笔记（可多条，按时间倒序）
- 间隔重复队列：答「记得」档位前进，答「再想想」回到第一档并 10 分钟后重刷
- 每日学习分钟（`YYYY-MM-DD → minutes`），用于 30 天热力图与活跃天数

进度页支持**导出 JSON / 导入恢复**，导入走合并策略（取更靠前的状态、更长的时长、更高的滚动度，笔记按文本去重），不会覆盖已有记录。

---

## 部署（Cloudflare Pages）

```bash
npm run build
npx wrangler pages deploy dist --project-name harness-times
```

需要先完成鉴权，二选一：

- 交互式：`npx wrangler login`
- CI/CD：设置环境变量 `CLOUDFLARE_API_TOKEN`

`public/_headers` 已配置长缓存策略：带哈希的静态资源 1 年强缓存，HTML 不缓存。

---

## 内容取材

正文与题库取材于 Harness / Agent 工程实践，并参考了公开的岗位 JD 与面试反馈（尤其是「工程问题 ≠ 研究问题」这条分界线，它是 Harness 岗面试最常见的答错类型）。所有图例、代码与指标口径都经过整理重写，不直接复制任何受版权保护的原文。

## License

内容（`src/content/`）与代码（其余部分）均以 MIT 发布，可自由取用改写。
