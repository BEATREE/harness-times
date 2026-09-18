# 规则层：写作与制图契约

> 这一页是**约束**，不是教程。它规定「以后新增或修改的任何一章，必须长成什么样」。
>
> 判断标准很简单：**凡是这里写了「必须」的，都有一条脚本或构建期抛错在守着它**。
> 如果你发现某条规则只是文档里的愿望、没有脚本守，请把它降级成建议，或者去 `scripts/wiki-lint.mjs` 里补上断言。

---

## 一、frontmatter 契约

每章正文的头三行必须是：

```yaml
---
chapter: harness-02-agent-loop      # 必须等于文件名去掉 .md
lead: '一句话导语，斜体大字，出现在页面顶部'
note: '可选的编辑注 / 本版修订说明'    # 可选
---
```

| 字段 | 必填 | 规则 |
| --- | --- | --- |
| `chapter` | ✅ | **必须等于文件名**。不等时 `src/pages/[domain]/[slug].astro` 会抛错、构建失败 |
| `lead` | ✅ | 单引号包裹的单行字符串。**不要换行**——YAML 里换行会变成多行折叠，排版会歪 |
| `note` | ⬜ | 有则显示为「编辑注」信息条。用于「本版改了什么」「为什么强调这一点」 |

**⛔ 不要在 frontmatter 里写标题、序号、难度、时长、标签。**
这些的**唯一来源**是 `src/data/curriculum.ts` 的 `CHAPTERS` 数组。
两处都写必然失同步，而失同步时页面只会静默显示错的那一个。

---

## 二、正文骨架（7 块，顺序固定）

读者已经习惯了每章的结构，新增章节请沿用：

```
1. 导语           ← <p class="dropcap">…</p>   首字下沉段，承接 lead
2. 分节正文       ← ## 一、…  ## 二、…          中文数字小节，每章 5–7 节
3. 图解           ← <figure class="fig">        每章 1 张主图，放在需要「看一眼」的位置
4. 实操代码       ← ```python title="x.py"      每章 ≥1 段，必须能跑，不是伪代码
5. 面试官会怎么问 ← 由 src/data/interview.ts 自动渲染，正文里不要写
6. 自测           ← <div class="quiz">          3 道单选，见第五节
7. 小结 + 金句    ← 列表 + <p class="pull-quote">
```

小节标题用**中文数字**（`## 一、循环的骨架`），不用阿拉伯数字、不用加粗替代。
每章末尾的 `pull-quote` 是全章最想让人记住的一句，署名固定为 `<cite>本刊编辑部</cite>`。

---

## 三、图解规范 ★ 最容易踩坑的一块

### 3.1 外层结构

```html
<figure class="fig">
  <div class="fig-frame">
    <svg viewBox="0 0 660 420" role="img" aria-label="用一句话描述这张图在讲什么">
      …
    </svg>
  </div>
  <figcaption><b>图 1</b>　图注。**加粗的那半句**才是这张图的结论。</figcaption>
</figure>
```

- **`role="img"` + `aria-label` 必填**。SVG 里的 `<text>` 对读屏软件不构成可读内容，
  没有 `aria-label` 的图对屏幕阅读器用户等于不存在。
- `figcaption` 以 `<b>图 N</b>　` 开头（注意是全角空格 `　`），N 是该章的图序号。
- **`viewBox` 必填，且必须写成 `0 0 <宽> <高>`**。
  构建期插件 `src/lib/diagram-motion.mjs` 从 `viewBox` 里读出宽度，
  写成 `--vbw` 内联样式，移动端靠它决定图解的最小宽度（见 3.4）。
  `viewBox` 缺失或格式不对 → 图解标注整段跳过 → 动效与移动端适配全部失效。

### 3.2 图内的排版约定

| 项 | 取值 | 说明 |
| --- | --- | --- |
| 标题字体 | `font-family="Georgia, serif"` | 拉丁走衬线，与站内标题一致 |
| 正文字体 | `font-family="ui-monospace, monospace"` | 图内说明文字走等宽，视觉上「像标注」 |
| 字号区间 | `8.2` – `13` | 标题 `11`–`13`，主标签 `10.8`–`11.5`，说明 `8.7`–`9.8`。**不要低于 8.2** |
| 主文字色（描边/深字） | `#1f1b16` | 墨色 |
| 辅助说明色 | `#6b6257` | 灰褐，用于次要一行 |
| 领域色 | 见下表 | 图内强调色必须取自所属领域 |

**领域配色（与侧栏、领域页一致）：**

| 领域 | 主色 | 浅底 | 典型用途 |
| --- | --- | --- | --- |
| `llm` 大模型原理 | `#2c4a7c` | `#eef1f7` | 模型侧的概念 |
| `harness` Harness 工程 | `#9b2c2c` | `#fbf1f1` | 失败模式、危险路径 |
| `eval` 评测工程 | `#b8944b`（深字用 `#8a6a1e`） | `#fdf6e8` | 指标、口径 |
| `knowledge` 知识引擎 | `#2f6157` | `#eef4f1` | 数据、知识、可信路径 |

**形与底：**

- 有边框的节点：`stroke-width="1.3"` + `fill` 用对应的浅底色。
- 纯底板（无边框的大块说明区）：`fill="#fbf8f2"`。
- 连线：`stroke-width="1.2"`。
- 箭头用 `<defs><marker>` 定义，**`id` 必须在同一页内唯一**（当前约定 `ar1` / `ar2` / `ar3`…）。
  两章之间 id 重复无妨（不同页面），同一页内重复会导致后一个 marker 覆盖前一个。
- `<defs>` 放在**图末尾**（当前 22 张图都是这个习惯），不要塞在图中间打断阅读顺序。
- 图内**不要写空行**——见 3.3，这是最要命的一条。

### 3.3 ⛔ 两个会「静默失败」的坑

**坑 A：HTML 块内的空行会腰斩整张图。**

CommonMark 规定「HTML 块遇到空行即终止」。所以：

```html
<figure class="fig">
  <svg …>
    <text …>第一行</text>

    <text …>这一行开始，整个 figure 已经被截断了</text>
  </svg>
</figure>
```

结果：`</figure>` 之前的内容被渲染，之后的内容被当成缩进代码块塞进 `<pre>`。
**页面看起来还在，图却没了**——没有任何报错。

防线：`npm run content:check`（已挂在 `prebuild`）。
写完正文先跑一次；它会指出文件与行号，`npm run content:fix` 可自动删除块内空行。

**坑 B：SVG 空元素丢掉自闭合斜杠 → 整张图消失。**

```html
<rect x="16" y="36" width="150" height="40"/>   ← 对
<rect x="16" y="36" width="150" height="40">    ← 灾难
```

HTML 解析里，`<rect>` 不是可容纳子元素的容器。少一个 `/` 之后，
它后面的所有元素都变成了它的子节点，于是**整张图什么都不渲染**。

防线：`diagram-motion.mjs` 在构建期扫描每个 SVG 行，
发现 `rect|line|circle|path|ellipse|polygon|polyline` 缺少 `/>` 会**直接抛错、构建失败**。
这是刻意设计的「宁可构建失败，也不要静默产出空图」——因为空图只有截图才能发现，
而截图不在 CI 里。

### 3.4 移动端可读性（不能靠「看起来还行」）

图解在设计稿上是 660px 宽的。手机上正文栏只有 ~340px，
如果让 SVG 等比缩到 340/660 ≈ 0.52，图里 9px 的字会变成 4.7px——**完全读不了**。

所以采取的策略是**不让它缩，让它横向滚动**：

```css
/* 基础：不小于设计宽度 */
figure.fig svg { min-width: calc(var(--vbw, 660) * 1px); }

/* 窄屏：再放大一点，并把右边缘提示成可滚动 */
@media (max-width: 1128px) {
  svg { min-width: calc(var(--vbw) * 1.35px); }
  .fig-frame { /* 右缘滚动阴影 */ }
}
@media (max-width: 1128px) and (hover: none) {
  /* 触屏设备追加一行「↔ 图解可左右滑动」提示 */
}
```

这条链路完整依赖 `--vbw`，而 `--vbw` 来自 `viewBox`（见 3.1）。
**所以 viewBox 缺失 = 移动端图解不可读**，这是同一个 bug 的两种表现。

⚠️ **不在 markdown 管线里的内联图**（例如 `src/pages/index.astro` 的能力地图）
不会被插件标注，必须**手写** `style="--vbw:680"`，否则移动端适配失效。

### 3.5 图解动效（由插件自动加，不要手写）

`diagram-motion.mjs` 在构建期给 SVG 标注这些 class，样式在 `global.css` 里：

| class | 加在什么元素上 | 表现 |
| --- | --- | --- |
| `dm-svg` | `<svg>` | 容器钩子，同时写入 `--vbw` |
| `dm-n` | 有描边的 `rect`/`circle` | 描边从细到粗的「扫读」脉冲，表达阅读顺序 |
| `dm-plate` | 无描边的底板 | 同上，弱化版 |
| `dm-t` | 所有 `<text>` | 按 `--i` 错峰淡入（每 22ms 一级，最长 760ms） |
| `dm-go` | 箭头线（构造成 `<line class="dm-go">`） | 沿 `--len` 走的「流向彗星」，`stroke-dashoffset` 动画 |

**写正文时不需要做任何事**——不要手写这些 class，不要手写 `--i` / `--len` / `--sw`。
插件会算。手动加反而会被覆盖或算错。

无箭头只有分层的图（如知识建模）靠 `dm-n` 的扫读脉冲表达顺序；
有箭头的流转图额外多一层彗星。两种情况要表达的是同一件事：**读这张图的顺序**。

`@media (prefers-reduced-motion: reduce)` 下所有动效关闭、彗星层置 `opacity:0`。
**新增动效时不要忘记把这个降级分支一起写上。**

---

## 四、代码块规范

````markdown
```python title="agent_loop.py"
# 代码
```
````

- **`title="…"` 必填**。文件名栏是这个站的视觉识别点之一，缺了它代码块会退化成一个光秃秃的 `<pre>`。
  实现原理（Shiki transformer + rehype 插件「接力」）在根 `README.md` 里，改之前务必读。
- 语言标签目前**只用 `python`**（22 段全部是 Python）。
  引入新语言没问题，但要先确认 Shiki 已加载该语法高亮。
- 代码必须**可直接运行**，不是伪代码。宁可短，也要能跑。
- 代码里的注释用中文，但**变量名与输出字符串保持英文/ASCII**——
  中文变量名会和等宽字体配合得很糟。

---

## 五、信息盒、三线表、自测题

### 5.1 信息盒（正文用到的共 43 个）

```html
<div class="box box-key">      <!-- 关键结论：15 个 -->
<div class="box box-practice"> <!-- 实操提示：15 个 -->
<div class="box box-warn">     <!-- 警告/反直觉：13 个 -->
  <div class="box-title">标题</div>
  <p>正文…</p>
</div>
```

三种盒子各有语义，**不要用 `box-warn` 装普通提示**——读者是靠颜色区分「这句要小心」的。

### 5.2 三线表（正文用到的共 45 个）

```html
<div class="tbl-wrap">          <!-- 必须包在外面：窄屏横向滚动靠它 -->
  <table class="news">          <!-- news 是三线表样式 -->
    <thead><tr><th>列</th>…</tr></thead>
    <tbody><tr><td>值</td>…</tr></tbody>
  </table>
</div>
```

**`tbl-wrap` 不能省。** 表在手机上必然超出正文栏，没有这层包裹就只能整页横向滚动。

### 5.3 自测题（每章 3 题，共 66 题）

```html
<div class="quiz">
  <div class="quiz-head"><span>本章自测</span><span>答错的题请回看第 N 节的表格</span></div>
  <div class="q-item" data-qid="llm04-q1" data-answer="1">
    <div class="q-text"><span class="idx">Q1</span>题干？</div>
    <button class="opt" data-i="0"><span class="tick">A</span><span>选项</span></button>
    <button class="opt" data-i="1"><span class="tick">B</span><span>选项</span></button>
    <button class="opt" data-i="2"><span class="tick">C</span><span>选项</span></button>
    <button class="opt" data-i="3"><span class="tick">D</span><span>选项</span></button>
    <div class="explain"><b>B。</b>解析，并说明**为什么错的选项错**。</div>
  </div>
  …
</div>
```

| 属性 | 规则 |
| --- | --- |
| `data-qid` | `<领域前缀><章号>-q<题号>`，如 `llm04-q1`、`harness02-q3`。**全站唯一**，进度存储用它做键 |
| `data-answer` | 正确选项下标，**0 起**（`0` = A） |
| `data-i` | 该选项下标，必须 0/1/2/3 齐全且与 `data-answer` 对应 |
| `class="tick"` | 固定显示 A–D 的圆形标记 |
| `.explain` | **必须写**。解析的价值不是重复答案，而是解释**干扰项为什么错** |

> ⚠️ `data-qid` 一旦上线就**不要改**：它已经写进读者的浏览器 localStorage 里了。
> 改了会导致老读者的答题记录错位。要改就新加一道题。

---

## 六、命名规范

| 对象 | 规范 | 例子 |
| --- | --- | --- |
| 章节文件名 | `<领域>-<两位序号>-<kebab-case>` | `harness-04-context-engineering.md` |
| 章节 id | 文件名去 `.md` | `harness-04-context-engineering` |
| 领域 id | 四选一：`llm` / `harness` / `eval` / `knowledge` | |
| 自测题 id | `<领域><两位序号>-q<n>` | `harness04-q2` |
| 专栏 CSS class | 短横线，语义前缀 | `.sp-card`（side pager）、`.dm-*`（diagram motion）、`.fig-*` |
| 示意数据文件 | `public/data/<描述>.csv` | `harness-layers.csv` |

**新增内容时不要造新的领域**。四个领域的划分是整站的骨架，
加一个领域要同时改 `DOMAINS`、侧栏、首页、配色、读路径——不是「顺手」的改动。

---

## 七、术语表（统一写法，别混用）

| 统一写法 | 不要写成 | 说明 |
| --- | --- | --- |
| Harness | harness（句中）/ 外壳 / 工具链 | 作为专有概念时首字母大写 |
| Agent | agent / 智能体 | 中文语境里「智能体」可作解释性同义替换，但正文主用 Agent |
| Agent Loop | 代理循环 / 主循环 | |
| Tool Use | 工具调用（可用作解释） | 章节标题固定为「Tool Use 与工具契约」 |
| Context Engineering | 上下文工程（可用作解释） | 章节标题固定为英文 |
| KV Cache | KVCache / kv cache | 中间有空格 |
| Subagent | sub agent / 子代理 | 章节标题里的写法 |
| 终止条件 | 停止条件 / 退出条件 | |
| 前缀稳定性 | 前缀一致 | 与 KV Cache 命中率挂钩的那个术语 |
| 幂等 | 幂等性 | 函数/操作的性质 |
| Badcase | bad case / bad-case | 连写，首字母大写 |
| Trace / Replay | 追踪 / 重放 | 作为功能名保留英文，首次出现可加中文解释 |
| Rerank | 重排（可作解释） | 章节标题用 `Rerank` |
| LLM-as-Judge | LLM as judge / 模型评审 | 连字符 |

**通用原则**：术语首次出现时「英文 +（中文解释）」，之后只用英文。
不要在同一章里两种写法来回换。

---

## 八、禁止事项

| 禁止 | 为什么 |
| --- | --- |
| 「本报」「第 N 期」「发刊」 | 本站是**按章组织、随修订更新**的学习站，不是每日报刊（`verify-build.mjs` 有断言） |
| 在 frontmatter 写元数据 | 会与 `curriculum.ts` 失同步 |
| 在正文里抄一遍面试问答 | 题库唯一来源是 `interview.ts`，抄一遍就是两处维护 |
| HTML 块内留空行 | 整张图会被截断（见 3.3 坑 A） |
| SVG 空元素漏 `/` | 整张图静默消失（见 3.3 坑 B） |
| 手写 `dm-*` / `--i` / `--len` / `--sw` | 构建期插件会算，手写会被覆盖 |
| 不用 `tbl-wrap` 包表格 | 手机上整页横向滚动 |
| 抄受版权保护的原文 | 全站内容均为原创重写；外链只登记链接与「为什么值得读」 |
| 改已上线章节的 `data-qid` | 会打乱老读者的答题记录 |
| 忘了 `prefers-reduced-motion` 降级 | 会做成一个晕动症用户无法使用的新动效 |

---

## 九、动完手之后的检查清单

```bash
npm run content:check          # ① 空行守卫（HTML 块内不能有空行）
npm run build                  # ② 构建（frontmatter / viewBox / 自闭合 都在这一步拦）
node scripts/verify-build.mjs  # ③ 50 项产物结构断言
node scripts/wiki-lint.mjs     # ④ wiki 统计与真实内容是否一致
node scripts/check-links.mjs   # ⑤ 若新增了外链
```

若动的是 **CSS / JS / 版式**，再加：

```bash
npm run build:fresh            # 动了 markdown 管线时必做（缓存键不含插件）
npm run preview                # 起服务，注意是 http://localhost:4321
node tools/verify.mjs          # 活页面交互 36 项
node scripts/measure.mjs       # 版面几何：居中、留白、溢出
node scripts/shoot.mjs         # 22 张截图落到 .shots/（供人眼终审）
```

---

## 十、一条待办（发现即记录，不擅自改）

全站 22 处插图金句的署名是 `<cite>本刊编辑部</cite>`，
另有 3 处 `note` 里用了「本刊认为…」（`harness-01` / `harness-02` / `harness-07`）。

这与「不出现期号、不是每日报刊」的定位存在**措辞上的不一致**：
「本刊」隐含期刊身份，但换掉它需要改 25 处、且属于创作口吻的选择，不是技术问题。

**结论：保留现状，在此登记为已知项。** 未来若决定统一改为「做棵大树」或「编者」，
改完请同步更新本节与 `wiki/log.md`。
