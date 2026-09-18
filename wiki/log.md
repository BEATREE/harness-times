# 变更日志

> **追加式**：只往上加，不删旧条目。最新的在最上面。
>
> 记什么：改了什么内容 / 为什么改 / 连带改了什么 / 验证有没有过。
> 不记什么：构建产物、临时路径、调试过程（那些在 `.shots/` 和 `.probe-out.txt`）。
>
> 格式：

```markdown
## YYYY-MM-DD · <一句话标题>

- **类型**：内容 / 版式 / 工程 / 部署
- **改了什么**：…
- **为什么**：…
- **连带改动**：…（哪些文件必须一起改）
- **验证**：跑过哪些脚本、结果如何
```

---

## 2026-09-18 · harness.beatree.cn 转 active —— canonical 随之切到自定义域名

- **类型**：部署 + 工程
- **改了什么**：
  - `astro.config.mjs` 的 `site` 从 `https://harness-times.pages.dev`
    改为 **`https://harness.beatree.cn`**；`BaseLayout.astro` 里的兜底值同步。
    `package.json` 的 `verify:live` 也跟着切到自定义域名。
  - 自定义域名真的生效了：CNAME 补上后 Cloudflare 自动签发
    `CN=harness.beatree.cn`（有效期至 2026-12-17），
    `node scripts/cf-domain.mjs status` → `status=active / HTTP 校验 active`。
    上一节里那条「停在 pending」的待办**已闭环**。
- **为什么**：两个域名都能访问 → canonical 一旦退回 `pages.dev`，
  站还是好的、页面也不报错，但搜索引擎会把同一份内容按两个域名各收一份，
  权重被摊薄。而本站的定位是「一个稳定的公开地址」，这正是作品集需要的东西。
  **这类退化只有断言拦得住**，所以新增 3 条：
  - `每个页面都有 canonical`（30 / 30）
  - `canonical 全部指向 harness.beatree.cn`
  - `canonical 里不再出现 pages.dev`
- **连带改动**：`README.md` 的「线上地址」表把自定义域名提为主地址，
  并把「为什么需要手工加 CNAME」改写成「怎么挂上去的（复盘）」+ 已解决的结论。
  `design.md` 版本行同步。
- **验证**：
  - `node scripts/verify-build.mjs` → **67/67**（64 → 67）
  - 负向测试：把 `site` 改回 `pages.dev` 重构建 → 上述两条断言**确实报红**
    （`← https://harness-times.pages.dev/about/`），改回后恢复绿
  - `node tools/verify.mjs --base=https://harness.beatree.cn` → **53/53**
  - `node tools/verify.mjs` → 53/53 ·`scripts/measure.mjs` → 异常 0 项
  - `node tools/audit.mjs` → 全视口无横向溢出 ·`scripts/wiki-lint.mjs` → 27/27

---

## 2026-09-18 · 正文加宽到与工具栏同宽 + 两侧大翻页区（替换 34px 小书签）

- **类型**：版式 + 工程
- **改了什么**：
  1. **正文栏宽度**：新增 `--sheet-pad`（纸面内边距）作为唯一来源。
     `.chapter-head` / `.prose` / `.chapter-foot` 与 `.chapter-toolbar` 共用同一个式子
     （`width: calc(100% + 2*var(--sheet-pad))` + 等量负 margin），**四条边线因此重合**。
     实测 1440px 下正文栏 640px → **761px**（= 工具栏宽，这就是诉求本身）。
  2. **两侧大翻页区**：删掉原来的 `.side-pager`（34px 宽悬浮小书签），
     换成 `.main` 里的三栏 flex：`rail-prev | .sheet | rail-next`。
     新面板 **150×(≥300)px**，直接显示目标章节标题 / 摘要 / 版块 / 时长，
     领域配色沿用侧栏与图解那套，`position: sticky` 跟随阅读位置。
     断点从 1340px 收到 **1300px**（按 侧栏 268 + 翻页区 348 + 可读下限 720 算出来的）。
     `.main` 在 ≥1300px 时左右各留 `--rail-gap`(24px) 呼吸位 ——
     先试过 `padding-right: 0`，右侧面板正好贴在屏幕最右缘、描边与圆角像被裁掉，
     所以补上这一份。因为左右等量，正文居中基准不变（仍偏右 134px），只把栏宽 809 → 761。
  3. **键盘 ← / →**：与翻页区等价，带三道「不抢键」守卫
     （焦点在输入框 / 按了修饰键 / 焦点元素可横向滚动）。
     走 `target.click()` 而非 `location.href`，否则站内的换页过渡会失效。
  4. **CSV 全部移除**：`public/data/harness-layers.csv` 与 `public/data/` 目录删除，
     README / wiki / 首页正文里的 CSV 提及一并清掉。
- **为什么**：
  - 「正文栏过窄」和「翻页按钮太小、不好点」是两条直接的用户反馈。
  - CSV 那条是**早期表述失误**（原话是 canvas，被记成了 csv）——本站本来就不提供数据附件。
- **明确的取舍（写进 `design.md` 5.2 了）**：≥1300px 时**取消镜像留白**。
  上一版靠它把正文钉在视口中线上，但它要白送 268px，加上两侧翻页区之后
  1440px 视口里正文栏只剩 604px —— 与「加宽正文」正面冲突。
  所以这一版把空间还给正文与翻页区：**正文更宽、翻页区更大，但整组内容相对屏幕右偏 134px**
  （= 侧栏宽 / 2）。收起侧栏时 `--sidebar-hold` 归零，正文自然回到正中央。
- **连带改动**（这几处必须一起改，否则静默出错）：
  - `src/styles/global.css`·`src/layouts/BaseLayout.astro`（新增 `rail-prev` / `rail-next` 具名 slot）·`src/layouts/ChapterLayout.astro`
  - `scripts/verify-build.mjs`（50 → **67 项**）·`tools/verify.mjs`（36 → **53 项**）·`scripts/measure.mjs`
  - `design.md`（新增 5.2 取舍一节，第八节整节重写为 `.page-rail`）
  - `wiki/index.md`·`wiki/schema.md`·`wiki/sources.md`·`wiki/README.md`·根 `README.md`
- **顺手修掉的坑**：`tools/verify.mjs` / `tools/audit.mjs` / `scripts/measure.mjs` / `scripts/shoot.mjs`
  的默认地址写成 `127.0.0.1:4321`，而 Windows 上 `astro preview` **默认只绑 IPv6 回环**，
  于是这几个脚本在没有 `--base` 时全部连不上（`curl` 返回 `000`，`shoot.mjs` 更隐蔽 ——
  它会安静地截出一批空白图，且报错完全看不出是地址族问题）。
  默认值统一改成 `http://localhost:4321`。
- **验证**（全部在默认 `npm run preview` 下跑，未传任何 `--base`）：
  - `node scripts/verify-build.mjs` → **64/64**（新增 14 条：翻页区存在性 / 兄弟节点顺序 / 领域着色 / 键盘提示 / 正文与工具栏同宽 / 打印隐藏 / CSV 缺席）
  - `node tools/verify.mjs` → **53/53**（新增 17 条：真键盘事件跳章 + 两道不抢键守卫 + 面板尺寸与呼吸位 + 侧栏不压面板 + 首末章边界）
  - `node scripts/measure.mjs` → **异常 0 项**（新增「正文栏 vs 工具栏宽度」这一组直接量）
  - `node tools/audit.mjs` → 全视口无横向溢出
  - `node scripts/wiki-lint.mjs` → 27/27

---

## 2026-09-18 · 自定义域名 harness.beatree.cn（Pages 侧已挂，DNS 待手工加）

- **类型**：部署
- **改了什么**：
  - 新增 `scripts/cf-domain.mjs`（`npm run cf:domain`）：查 / 加 / 实探 Pages 自定义域名。
    之所以要自己写：**wrangler v4 删掉了 `wrangler pages domain` 子命令**，
    域名操作只剩 Dashboard 或 REST API 两条路，脚本走 API，可重复执行。
  - **已通过 API 把 `harness.beatree.cn` 挂到 Pages 项目 `harness-times`**，
    返回 `status=initializing` → `pending`，`zone_tag=ZONE_TAG`。
- **卡在哪**：zone 跨账号。
  - Pages 项目在账号 **主账号**（`PAGES_ACCOUNT_ID`）
  - zone `beatree.cn` 在账号 **另一个账号**（`ZONE_ACCOUNT_ID`）

  跨账号时 Cloudflare **不会**自动建 DNS 记录，所以域名永远停在
  `pending / validation=pending/http` —— HTTP 校验要求能真的访问到域名，
  而 DNS 没解析就访问不到，证书签不出来（鸡生蛋）。
  且 wrangler 本机 OAuth 凭据的 scope 里**只有 `zone:read`，没有 DNS 写权限**
  （scope 清单实测：`pages:write` ✅ / `zone:read` ✅ / 无 `dns_records:edit` ❌）。

- **待办（需要持有 beatree.cn 的账号操作）**：
  在 Beatreehero 账号 → `beatree.cn` → DNS 添加：

  ```
  类型 CNAME · 名称 harness · 目标 harness-times.pages.dev · 代理：已代理（橙色云）
  ```

  加完 1–5 分钟，`npm run cf:domain` 应显示 `active`。
  若改用 API 自动加：需要一个带 `Zone → DNS → Edit` 的 `CLOUDFLARE_API_TOKEN`，
  `cf-domain.mjs` 会优先读这个环境变量。

- **验证**：`node scripts/cf-domain.mjs check harness-times.pages.dev`
  → `HTTP 200`，页面标题 `Harness Times`（默认域名线上正常）。

---

## 2026-09-18 · 建立知识库（wiki）；沉淀设计系统（design.md）

- **类型**：工程 + 版式 + 内容
- **改了什么**：

  **一、建立本 wiki**（新增 `wiki/` 4 个文件 + 2 个脚本）

  | 文件 | 作用 |
  | --- | --- |
  | `wiki/README.md` | 入口：三层结构、三个操作、8 条不变量 |
  | `wiki/index.md` | 目录：4 领域 / 22 章 / 72 问，每章一行含统计与关键标签 |
  | `wiki/schema.md` | 契约：frontmatter、正文骨架、图解规范、代码块、术语表、禁止事项 |
  | `wiki/sources.md` | 原始层：取材原则、29 条外链台账、归属章节、已知偏差 |
  | `wiki/log.md` | 本文件 |
  | `scripts/wiki-facts.mjs` | 清点每章图 / 码 / 节 / 题，`--md` 输出可直接粘进 `index.md` |
  | `scripts/wiki-lint.mjs` | 核对 wiki 统计与真实内容是否一致（防止手改数字漂掉） |

  **另：沉淀设计系统 `design.md`**（仓库根目录，14 节）

  面向「**换个项目怎么复用**」而不是「本项目样式表说明」：
  四条设计原则、色板（纸三级 + 套色四色 + 暖灰线）、字体四条栈及其分工理由、
  尺度变量、**版面骨架与 `--sidebar-hold` 镜像让位机制**、组件清单、
  插图规范、侧边翻页、动效系统（曲线与两次踩坑）、响应式断点取舍、
  **无障碍与对比度实算**、复用指南、十条「不要做」。

  对比度一节是实算的（WCAG 相对亮度公式），并**登记了 3 个真实缺口**：
  `--ink-faint` 仅 1.94:1 却被当文字色用了 18 处（含交互控件侧栏折叠按钮）、
  `--ink-muted` 3.19:1 用在极小字号元信息上、`--gold` 2.49:1 用作版块编号文字。
  三条都给了具体改法，但**本次不改**——收紧会动到既有视觉，应先确认。

  **另：修正根 `README.md` 的一处描述失实**

  原文称每章图解「另附 CSV 原始数据表」，实际全站只有 `public/data/harness-layers.csv`
  （首页能力地图用）。已改为准确表述，并在 `wiki/index.md`、`wiki/sources.md`
  的偏差表里标记为 ✅ 已修正。

  **二、网站优化五项**（对应 `9291ccb`）

  1. 关联网站移除「宝玉 baoyu.io」；主站 `beatree.cn` 升级为三处显式入口
     （报头 pill / 关于页 `.cta-row` 大按钮 / 侧栏外链项）
  2. 正文页新增左右「上一节 / 下一节」侧边翻页（`.side-pager` / `.sp-prev` / `.sp-next`），
     桌面端 ≥1340px 显示，悬浮展开目标章标题 / 摘要 / 元信息；首章无「上一节」，
     末章「下一节」指向 `/progress/`
  3. 正文改为**按屏幕边缘等距居中**：`.main` 左右两侧镜像占位
     （`margin-left: var(--sidebar-hold)` + `padding-right` 自适应收窄），
     侧栏折叠时正文位置不变；窄屏自适应让位保证可读宽度
  4. 新增构建期 rehype 插件 `src/lib/diagram-motion.mjs`，为 22 张手写 SVG 标注动效：
     箭头走流向彗星（`dm-go`）、分层图走描边扫读（`dm-n` / `dm-plate`）、
     文字按 `--i` 错峰入场（`dm-t`）
  5. 移动端图解：`min-width` 撑到设计宽度 + 右缘滚动阴影 + 触屏「可左右滑动」提示；
     `prefers-reduced-motion` 下全部降级

- **为什么**：让内容有一处可查、可校验的维护入口；同时把「图解读不懂」「正文不居中」
  「不知道往下读哪章」三个阅读侧问题一次性解决。

- **连带改动**（容易忘的）：

  - 移除宝玉后，`scripts/sources.txt` 少 1 条 → 关于页 `.rel-item` 从 28 变 27
    → `verify-build.mjs` 的断言必须同步改，否则构建门禁误报
  - `diagram-motion.mjs` 会给 SVG 加 class 和 `--vbw`，
    但它处理的是**裸 HTML 节点**（用户 rehype 插件跑在 `rehypeRaw` 之前），
     所以必须做字符串级改写，不能操作 hast
  - `index.astro` 的能力地图不在 markdown 管线里，插件标注不到，
     必须**手写** `style="--vbw:680"` 才有多图移动端适配

- **踩到的坑（已修）**：

  1. **`addAttrs` 吃掉了自闭合斜杠** → `<rect …/>` 变 `<rect …>` →
     后续元素全成它的子节点 → **整张图静默消失**，而构建照样成功。
     修法：`addAttrs` 保留 `/`；并在 `transform()` 末尾加**fail-loud 守卫**，
     发现任何空元素缺 `/>` 直接抛错。全站扫描确认：22 张图、28 条流向彗星、**0 处破损**。
  2. **`measure.mjs` 用错了参照物**：它拿 `.main` 的左右边距比对称，
     于是正文明明已经按屏幕居中了，它却报「差 268px 不对称」。
     改为按**视口**测（`prose.left` 与 `vw - prose.right`），并加了
     「侧栏开 / 收状态下正文位置不变」的不变性测试。
  3. **对称占位把正文挤到 185px**（768px 宽时：侧栏 268 + 镜像 268）。
     改为 `padding-right: min(var(--sidebar-hold), max(0px, calc(100% - 860px)))`，
     窄屏自动收窄让位。
  4. **图解出血（负 margin）撞上侧边翻页按钮**（约 1047px 时图压住「下一章」）。
     直接取消出血，改用 `min-width: 设计宽度`（最多 30px 横向滚动，只裁右侧空白）。
  5. **预览服务地址**：`astro preview` 绑的是 `localhost:4321`，
     不是 `127.0.0.1`（curl 127.0.0.1 返回 000）。

- **验证**：

  | 脚本 | 结果 |
  | --- | --- |
  | `node scripts/verify-build.mjs` | **50 项断言，失败 0 项**（从 25 项扩到 50 项） |
  | `node scripts/measure.mjs` | **异常 0 项**；1440px 下正文左右各 393px（对称）；折叠前后 `prose.left` 一致 |
  | `node scripts/shoot.mjs` | 22 张截图全部产出（新增 15–22：翻页悬浮、图解动效 / 移动端 / 入场中间帧 / reduced-motion 对照、关于页 CTA、1440 正文） |
  | `npm run content:check` | 通过 |

- **本页建立的统计基线**（改内容后请用 `wiki-facts.mjs` 核对）：

  ```
  22 章 · 4 领域 · 22 图 · 24 段代码 · 131 小节 · 72 问（30 高频）· 约 57,958 汉字
  ```

---

## 2026-09-18 · 代码块文件名栏 · 字体与可读性 · 换页过渡 · 侧栏折叠 · 正文居中 · 关于页重写

- **类型**：版式 + 内容
- **改了什么**：
  - 代码块增加**文件名栏**（`code-block` / `code-head` / `lang`），
    由 Shiki transformer（`src/lib/code-title.mjs`）+ rehype 插件「接力」实现
  - 正文字体改为黑体系（`PingFang SC` / `Microsoft YaHei`），
    去掉会落到 `SimSun` 的发虚回退；标题拉丁走衬线、中文走黑体
  - 换页过渡改为 ≤10px 淡入淡出，底衬改回纸色（此前深色底导致「灰屏」）
  - 侧栏支持**分组折叠**（4 组）与**整体收起**（`nav-collapsed`）
  - 正文栏 `--measure: 40rem`，左右等宽居中
  - 关于页重写：定位声明（**不是每日报刊**）、出品方、关联网站、隐私模型
- **为什么**：修「代码块分不清文件」「中文用宋体发虚」「换页闪灰屏」三个可读性问题
- **连带改动**：新增 `scripts/verify-build.mjs`（产物结构断言）、`scripts/measure.mjs`
  （版面几何）、`scripts/shoot.mjs`（CDP 截图），形成「构建 → 结构 → 几何 → 人眼」四级验证
- **踩到的坑**：Astro 5 把 markdown 渲染结果缓存到 `.astro/`，**缓存键不含插件** →
  改了插件、构建也过了、产物一动不动。修法：加 `npm run build:fresh`（清缓存 + 构建）

---

## 2026-09-17 · 收录零依赖验证工具与部署脚本

- **类型**：工程
- **改了什么**：
  - `tools/verify.mjs`（36 项功能）、`tools/audit.mjs`（多视口溢出审计）、
    `tools/bisect.mjs`（二分法定位溢出根因）、`tools/probe.mjs`——零依赖，CDP 直连本机 Chromium
  - `scripts/clean.mjs`（清 Astro 内容缓存）、`scripts/check-links.mjs` + `scripts/sources.txt`（外链体检）、
    `scripts/normalize-content.mjs`（内容守卫，挂在 `prebuild`）
  - `package.json` 补 `deploy` / `cf:whoami` / `cf:login` 等 Cloudflare Pages 脚本
- **为什么**：这个站的产出是「静态 HTML」，很多问题只有浏览器里才看得见；
  但没有浏览器自动化就没法验证。所以用 CDP 直连本机已有的 Chromium，做到**零依赖**。

---

## 2026-09-17 · Harness Times 首次发布

- **类型**：内容 + 工程
- **改了什么**：确立 4 大领域 / 22 章的内容结构；Astro 静态站 + 报纸版式；
  学习进度存 localStorage（单 key `ht:progress:v1`，带版本号与迁移、导入导出合并策略）；
  部署到 Cloudflare Pages（项目名 `harness-times`）
- **为什么**：把散落的 Agent 工程知识整理成一条可按章读下去的学习路径
- **文案定位（重要，后续修订都要遵守）**：
  本站是「**按章组织、随修订更新**的学习站」，**不是每天更新的报刊**。
  因此不出现期号、不出现在「第 N 期」、不出现「本报」。
  设计上保留报纸的**版式语言**（报头、三线表、首字下沉、pull quote），但不搬报纸的**出版制度**。

---

## 更早

项目首版之前的原型与素材整理未纳入本日志（无版本控制记录）。
