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

> ### ⚠️ 关于账号标识：本文件（以及整个仓库）一律不写
>
> **本仓库是公开的**，所以下面这些一律不进仓库，历史提交里也已清理（见 2026-09-18 那条）：
> 邮箱、QQ 号、Cloudflare account id、zone tag、任何 token。
>
> **别只盯文件内容**：提交元数据（`%ae` / `%ce`）同样是公开信息，
> 而且 `git log --oneline` 看不见它 —— 2026-09-18 那次就漏到第二遍才发现。
> 提交前对一眼 `git log -1 --format='%an <%ae> | %cn <%ce>'`，
> 并确认**本仓库**的 `user.email` 是 noreply（`git config user.email`，别用 `--global`）。
>
> 需要它们时的去处：
> - **本机**：项目根的 `.dev.vars`（已在 `.gitignore` 内）
> - **脚本参数**：`CLOUDFLARE_ACCOUNT_ID=… npm run cf:domain`
> - **查完整值**：`node scripts/cf-domain.mjs status --show-ids`
>
> `cf-domain.mjs` 的输出默认是半掩的（`0515…14b9`）—— 因为**这些标识之所以会进仓库，
> 正是因为有人把它的输出原样贴进了本文件**。半掩值足够核对「是不是同一个账号」，
> 又不会被人直接抄走。
>
> 写文档时请用「主账号 / 持有 zone 的那个账号」这类描述，而不是具体邮箱。

---

## 2026-09-18 · 第 1 章图解补到 7 张；术语加了双语原名 / 红色标识 / 掌握标记；修掉「中文标点吃掉加粗」

- **类型**：内容 + 版式 + 工程
- **改了什么**：
  1. **第 1 章补 6 张图解**（`llm-01-transformer.md` 由图 2 到图 7，覆盖 3.1 投影 / 3.2 打分 /
     3.3 缩放 / 3.4 加权求和 / 3.5 多头 / 3.6 因果掩码）。风格对齐 Illustrated Transformer：
     小方格拼成矩阵、行 = token 位置、颜色区分 Q/K/V。全站图解 22 → **28 张**。
  2. **术语英文原名**：`src/lib/glossary-terms.ts` 现在会在**本章首次**出现该名词时，
     自动在链接**外面**补一个 `<span class="term-en">（Forward pass）</span>`。
     不手写、不重复注（`en` 已含在显示文字里的跳过）。
  3. **新增 `naming` 字段**（25 条全补）：写清「中文译名从哪个英文词来、直译丢了什么」。
     起因是「前向」读不懂 —— `forward pass`（过程）与 `feed-forward`（结构）
     在中文里塌成了同一批字。卡片上排在「出现场景」之后。
  4. **行内术语改成套色红 + 虚线底**（原来是墨色 + 灰虚线），并补上 `focus-visible` 红描边。
  5. **单词卡加「标记已掌握」**。存储放在 `ht:progress.v1` 的**顶层 `terms`**（不按章节分，
     因为词跨章复用）；**取消标记是整条删掉**，不留 `known: false` 空行。
  6. **名词库页加「只看未掌握」筛选**（读存储而不是卡片上的旧属性）。
  7. **修掉正文里 14 处 `**` 没生效**：中文标点让 `**` 闭合定界符不再是 right-flanking，
     于是那一对配不上；还有一类是 `**` 写在 HTML 块里（永不解析）。新增
     `scripts/lib/emphasis.mjs`，用项目自己的 mdast 解析器找出**真正漏出来的**那几对，
     只改它们；`content:check` 与 `verify-build` 各加一道闸。
  8. **弹窗底栏钉住**：`.tm-body` 是滚动区，卡片正文普遍比面板高
     （「张量」那张要滚 1000+px），「标记已掌握」本来藏在滚动条尽头（实测 4 张卡里 3 张看不见）。
     `position: sticky; bottom: 0`，只钉弹窗，名词库页不钉。
- **为什么**：前 5 条来自一次集中反馈（「前向」看不懂 / 术语不显眼 / 想标记掌握度 /
  加图解）；第 7 条是反馈里附的一个具体例子。第 8 条是改完 5 之后自己量出来的 ——
  「加上了」和「用得上」是两件事。
- **连带改动**：`src/data/glossary.ts`（`naming` / `en` / 新增 `forward`）、
  `src/lib/progress.ts`（schema v2，顶层 `terms`）、`src/components/TermCardBody.astro`、
  `src/pages/glossary.astro`、`src/styles/global.css`、`wiki/index.md`（图 22→28、
  汉字 6.2→6.4 万）、`wiki/schema.md`（新增 11.4.1–11.7）、`wiki/README.md`（断言数）。
- **验证**：`content:check` 0 处加粗泄漏｜`verify-build` **120 项**全过（新增 10 项：
  双语原名只在首次 / 挂在链接外 / 命名行条数 / 掌握按钮 / 只看未掌握 / 术语红对比度实算）｜
  `wiki-lint` 33 项全过｜`tools/verify.mjs` **85 项**全过（新增 6 项：掌握标记的
  写入-取消-筛选-刷新读回、弹窗底栏可见、全站 22 页图解文字没被画布裁掉）｜
  `tools/audit.mjs` 全视口无横向溢出。
- **两个顺手记下的探针教训**（都是「报错了但真因在测量方法」）：
  · 查「文字有没有溢出 viewBox」时，垂直方向写成 `(vy+vh)-(b.y+b.height)` ——
    那量的是「底边还剩多少」，于是正常文字全报几百的假值，**全站假报 711 处**。
    正确写法是 `b.y + b.height - (vy + vh)`。
  · 截图别用 `captureBeyondViewport: true` + 文档坐标 clip：Chrome 会改视口尺寸来容纳整页，
    本站的三栏 flex 因此**重排**，量好的坐标随即失配，截出来像「页面把文字裁了」——
    图 5 就这么被冤枉过一次。改成「先滚动、再整屏截」就稳了。

---

## 2026-09-18 · 两处「静默少东西」的测试坑：平滑滚动骗过点击、截图串味带走侧栏

- **类型**：工程
- **改了什么**：
  1. `tools/verify.mjs` 第 [11] 节的名词卡片交互测试由 5 项失败转为全过：
     定位术语前先把 `document.documentElement.style.scrollBehavior` 置回 `auto` 再滚，
     并把「点位有没有落在视口内」写进失败信息（下一眼就能看出是没滚到位还是坐标算错）。
  2. 同文件把最后一节的编号从重复的 `[11]` 改成 `[12]`。
  3. `scripts/shoot.mjs`：主循环在**每个镜头跳转前**显式复位侧栏收起状态
     （写 `localStorage` 的 `ht:nav:sidebar`），需要收起的镜头自己用 `nav: 'collapsed'` 声明；
     跑之前先访问一次站点根（`about:blank` 是不透明源，写不了 localStorage）。
  4. `tools/README.md`：`verify.mjs` 覆盖表补「名词卡片」一行；新增小节
     「测指针交互：三个会让『功能明明是好的』变成红色的坑」。
- **为什么**：两处是**同一类问题 —— 不报错、不空白，只是默默少了一块**，
  而且都出在验证/截图工具自己身上，比产品 bug 更难发现。
  1. 全站 `html { scroll-behavior: smooth }`（`global.css`）让 `scrollIntoView`
     变成**异步动画**：紧接着量出来的坐标还是滚动前的位置，术语因此常常落在视口之外，
     `elementFromPoint` 返回 `null` —— 但报出来的现象是「弹窗没打开」。
     而弹窗本身一直是好的：同一份产物上 `shoot.mjs` 早就用 `a.term.click()` 截出了
     30/31/32 三张正常的图。差一点就顺着错的现象去改产品代码。
     （顺带记一个反直觉点：`scrollIntoView({behavior:'auto'})` 解决不了 ——
     `auto` 的语义就是「听 CSS 的」。）
  2. 侧栏收起状态存在 `localStorage`，于是 `26-nav-peek` 点一下收起之后，
     **排在它后面的每一张图**都少一条侧栏。看图的人不会知道少了什么，
     只会以为「这页本来就没有目录」；而且以后每新增一个镜头都会自动中招 ——
     一个纯靠顺序传播的缺陷，且只在截图产物里，任何断言都拦不到。
- **连带改动**：无。只动验证与截图工具及工具文档，产品代码一行未改。
- **验证**：`tools/verify.mjs` **78 项 0 失败**（第 [11] 节 14 项全过）·
  `shoot.mjs` 32 张全部重出，`27-glossary-top` 已带回侧栏、`05-sidebar-collapsed` 仍为收起状态 ·
  `verify-build` 106 项 0 失败 · `wiki-lint` 33 项 0 失败 ·
  `check-links` 57 个链接、异常 5 个（均为已知 403 反爬误报）·
  `audit.mjs` 全部页面 × 4 档视口无横向溢出。

---

## 2026-09-18 · 名词卡片基础设施 + 第 1 章按新标准重写为样板

- **类型**：内容
- **改了什么**：
  1. **新增名词卡片体系（全站基础设施）**：`src/data/glossary.ts`（24 条名词的唯一来源，
     含含义/出现场景/知识域/展开解释/例子/内联图例/延伸阅读）、`src/lib/glossary-terms.ts`
     （remark 插件，把正文里的 `[[id]]` 展开成 `<a class="term">`，查不到 id 直接抛错让构建失败）、
     `TermCardBody.astro`（卡片本体，弹窗与名词库页共用一套模板）、`TermCard.astro`
     （章节页弹窗：焦点陷阱 + Esc 关闭 + 捕获阶段拦截 click）、`src/pages/glossary.astro`
     （`/glossary/` 名词库页：可搜索、可按知识域筛、含快速索引与「正文出现于」反查）。
  2. **第 1 章（`llm-01-transformer`）按新标准重写**：新增第二节「先把名词说清楚」
     （token / embedding / 张量 / 形状 / 隐藏维度 / 位置编码，全程不出现公式），
     第三节补齐每个机制的「输入是什么、输出是什么、为什么需要」，
     小节从 7 节扩到 9 节、正文从约 2.6k 汉字扩到 6.5k，末尾新增「参考与延伸」外链节。
- **为什么**：读者反馈「第一章讲 Transformer，底下直接开始讲公式和形状，但什么是张量、
  什么是投影、投影的输入输出是什么，一个都没解释」。这不是某一章的问题，是**讲解顺序问题**，
  所以除了改文，还把标准立成了契约（`wiki/schema.md` 第十一节）。
- **连带改动**：
  - `astro.config.mjs` 挂上 remark 插件；`BaseLayout.astro` 新增 `overlay` 具名 slot
    （弹窗必须挂在 `.app` 之外，否则会被 `.prose` 排版规则串味）；`ChapterLayout.astro` /
    `[slug].astro` 把本章用到的术语 id 传给弹窗；`Sidebar.astro` 加「名词库」入口；
    `global.css` 新增「名词卡片 / 名词库」分节（21 → 22 个分节）。
  - `curriculum.ts`：`llm-01` 时长 22 → 35 分钟，`desc` 同步改写。
  - `wiki/schema.md`：正文骨架 7 块 → 8 块、小节数 5–7 → 7–12、新增 2.1/2.2 与第十一节。
  - `wiki/index.md`：总量行（133 小节 / 约 6.2 万汉字）、第 1 章行、路由表加 `/glossary/`。
  - `README.md` / `design.md`（新增 5.6 名词卡片弹窗、组件清单两行、无障碍一节补对比度处置）。
- **⚠️ 顺手发现并处理的一个真问题：外链可达性。**
  给名词卡片挑延伸阅读时默认用了 `en.wikipedia.org` 与 `huggingface.co` 兜底，
  跑 `check-links` 全是 `fetch failed` —— **是连不上，不是 403 反爬**。
  本站读者主要在中国大陆，这两类域名点开就是空白页，所以全部换成了可达等价来源
  （`zh.d2l.ai` / `oi-wiki.org` / `tiktoken` / vLLM 博客与论文 / The Illustrated Word2vec）。
  台账 `scripts/sources.txt` 因此新增「章级延伸阅读」一组（29 → 54 条 URL），
  它**不进入 about 页的 27 个 `.rel-item`**（与「本站相关」那一组同理），
  并明确了「`fetch failed` 要按不可达处理、`403` 才是误报」这条判据。
  详见 `wiki/sources.md` 的第二节之二与第四节偏差 5。
- **验证**：`content:check` ✅ · `build:fresh` 31 页 ✅ · `verify-build` **106 项**
  （新增 25 项名词卡片断言）0 失败 ✅ · `wiki-lint` 33 项 0 失败 ✅ ·
  `check-links` 57 个链接、异常 5 个（全是 openai.com / kexue.fm 的 403 反爬，属已知误报）·
  `tools/verify.mjs` 活页面 **78 项**（新增 14 项名词卡片交互）0 失败 ✅ · `shoot.mjs` 32 张截图（新增 27–32 共 6 张名词卡片镜头）。

---

## 2026-09-18 · 上面那两条提交推上云（+ 一个「git push 连不上」的真因）

- **类型**：部署
- **改了什么**：`e587a85` / `b9040af` 两条推上 `origin/main`，远端从 `3efc52a` 前进到 `b9040af`；
  本地与远端逐字符一致。
  （这里**刻意不写「共 N 条提交」** —— 本条补记本身就会成为下一条提交，
  一写数字当场就旧了。想知道条数用 `git rev-list --count origin/main`。）
- **为什么单列一条**：下面那条里写的「已强推到 `3efc52a`」是**那一刻**的实况，
  这两条是之后才攒出来的 —— 补一句才不至于让人以为远端停在 13 条。
- **⚠️ 踩到的坑：`git push` 全挂在网络层，真因是代理。**
  三种报错依次出现，很容易一路误判：
  1. `OpenSSL SSL_read: SSL_ERROR_SYSCALL, errno 0` —— 像是 TLS 坏了；
  2. `CONNECT tunnel failed, response 502` —— 像是仓库或代理挂了；
  3. 手动清掉代理后 `Failed to connect to github.com port 443 after 21s` —— 又像是被墙。

  实际原因：**shell 里的 `HTTPS_PROXY` 环境变量指向一个不转发 GitHub 的代理**。
  最有迷惑性的一点是 `Invoke-WebRequest https://github.com` 返回 **200** ——
  因为它走的是 **Windows 系统代理**，与 `HTTPS_PROXY` 是两套东西。
  「浏览器能开、git 就是不行」这个经典错位，源头就在这里。
  - 读系统代理：`HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings`
    的 `ProxyServer` 值；
  - 让 git 显式走它：`git -c http.proxy=<系统代理> -c https.proxy=<系统代理> push`
    —— 命令行 `-c` 的优先级**高于环境变量**，正好用来覆盖掉那个坏代理；
  - 顺手设 `GIT_TERMINAL_PROMPT=0`，凭据缺失时直接失败，而不是一直挂着等人敲键盘。
- **验证**：`git ls-remote` 与本地 HEAD 一致（`b9040af`）；15 条提交的
  author / committer 全部是 `BEATREE <BEATREE@users.noreply.github.com>`；
  全历史 **28862 行新增**对 6 类标识 + `ghp_` + 两类私钥头 **0 命中**
  （`sk-` 唯一命中是 `gfm-task-list-item` 里的 `sk-`，误报）。

---

## 2026-09-18 · 给 `log.md` 补结构断言（并修掉断言自己的一处误报）+ 把 9 处漂了的断言数拉回一致

- **类型**：工程
- **改了什么**：
  1. `wiki-lint.mjs` 新增第 10 节「log.md 的结构」，6 条断言：
     「没有没标题的正文」「`## ` 要么是日期条目、要么是『更早』收尾」
     「每条条目都有『类型』行」「日期倒序」「标题不重复」「条目数合理」。
  2. 按新查出的线索把文档里 **9 处漂了的断言数**全部拉回一致（见下）。
- **为什么**：有个失误犯过**两次** —— 往最上面追加条目时用「把 `---` 和旧标题一起替换掉」
  的写法，结果**旧标题被吃掉、正文留了下来**，新条目下面直接糊着一段没标题的正文。
  它不报错、页面照常渲染，两次都是靠人眼发现的 —— 正是「只能靠断言拦」的那一类。
- **踩到的坑**：第一版断言把每个 `## ` 都当条目，于是尾部 `## 更早` 立刻报红。
  这是**断言错、不是文件错**（那段本来就不该有「类型」行）。
  但收窄成「只查日期条目」之后又露出一个真漏洞：一个手误的日期标题
  （比如 `## 2026/09-17 …`）会从「类型」检查里**悄悄漏出去**。
  所以最后落成两条**互相独立**的判据：非日期标题只准叫「更早」，否则报红；
  而只要标题不叫「更早」，作者就是把它当条目写的 —— 日期格式写错也照样要为「类型」行负责。
  两条同时红是好事，说明信号没有互相掩盖。
- **顺带清出的 9 处文档漂移**（都是历次加断言时漏同步的）：
  `verify-build` 在 `README.md` 里写着 **50 / 62**（实际 **79**）；
  `verify.mjs` 在 `wiki/schema.md` 与 `tools/README.md` 里写着 **36**（实际 **64**）；
  `shoot.mjs` 写着 **22 张**（实际 **26**）；`wiki-lint` 自己写着 **27**（现在 **33**）。
  根因很清楚：这些数字被抄进了 6 个文件的注释里，**每加一条断言就有 6 个地方要改**。
  所以顺手改了规矩 —— **断言数只在 `wiki/README.md` 第 ③ 节那张表里写一次**，
  别处只写「这个脚本干什么」。这条规矩已经写进 `wiki/README.md`。
- **连带改动**：`wiki/log.md` 的 `## 更早` 段补了一句「这是收尾说明、没有「类型」行是有意的，
  别为了格式统一给它补一行」—— 否则下一个人会「顺手修好」它。
- **验证**：`wiki-lint` **33/33**（27 → 33）。
  新断言做过**反向破坏测试**：把某条标题的 `·` 换成空格、同时把「类型」改成「类别」，
  两条断言**同时报红**且各自点出是哪个标题；改回后恢复绿。

---

## 2026-09-18 · 历史重写已强推上云 + 重新部署；把 `npm run deploy` 挂起那个坑修掉

- **类型**：部署
- **改了什么**：
  - 重写后的历史**已强推到 `origin/main`**（13 条提交，`3efc52a`）。
    远端校验：`git ls-remote` 与本机 HEAD **逐字符相同**；
    `git log origin/main --format="%ae %ce"` 13 条**全部**是
    `BEATREE@users.noreply.github.com` —— QQ 号在公开的提交元数据里已经没有了。
  - 重新部署到 Pages（`51fa5467.harness-times.pages.dev`，同时生效于自定义域名）。
    线上实探：JS 里有 `nav-peek` + `pointermove`、CSS 里有 `.nav-peek` 规则、
    关于页有 `BEATREE/harness-times` 入口 —— 三项都是这一轮才有的东西，
    说明推上去的确实是新产物，不是「0 files already uploaded」那句话看着那样。
  - **新增 `scripts/deploy.mjs`**，`npm run deploy` 改成
    `build:fresh + deploy.mjs`，并拆出一个 `deploy:only`。
- **为什么**：`npm run deploy` 原本是裸的 `wrangler pages deploy`，在**双账号**环境下
  会进交互式选账号，25 秒超时卡住 —— 表现出来像网络问题，实际在等键盘。
  这个坑在本文件里记过一次（当时是手工加 `CLOUDFLARE_ACCOUNT_ID=` 绕过），
  这次把它固化进脚本：自己按「环境变量 → `.dev.vars` → `.env` → `.env.local`」解析
  account id 再显式传下去；拿不到就**报错并说明两种给法**，绝不悄悄退化成交互式。
  输出沿用 `cf-domain.mjs` 的半掩约定（`0515…14b9`），因为它自己的日志也会被人贴出来。
- **⚠️ 顺序约束已闭环**：关于页的「本站源码」入口会把访客引向这个仓库，
  所以必须是 **脱敏 → 强推 → 部署**，不能颠倒。这次就是这个顺序。
- **验证**：
  - `node tools/verify.mjs --base=https://harness.beatree.cn` → **64/64**
    （含这一轮新增的 11 项悬停唤出用例，在线上真跑通了）。
  - 线上实探三项新特性均存在（见上）。
  - `wiki-lint` 27/27 · `verify:build` 79/79。

---

## 2026-09-18 · 侧栏加了「鼠标贴到左边缘就弹出目录」

- **类型**：版式 + 交互
- **改了什么**：
  - 新增 `body.nav-peek` 状态：目录收起时，指针移进视口最左侧 16px 就开始为期
    110ms 的停留判定，留住就弹出；指针离开侧栏即收回。
  - 桌面端（≥761px）只做 `transform` 复位 + 加阴影，**正文一格不动**。
  - 窄屏（≤760px）复用抽屉那套 `nav-open`，但**不带遮罩**。
  - 唤出期间收起书签让位（`opacity:0` + `pointer-events:none`），
    并补了 `prefers-reduced-motion` 降级（「不要做」清单第 10 条）。
- **为什么**：收起侧栏能换来 268px 正文宽度，但代价是「想瞄一眼目录」变麻烦了。
  这条是给收起态配的快捷键，不是要取代收起书签。
- **最要紧的一条设计约束**：**唤出只许动 `transform`，绝不许碰 `--sidebar-hold`。**
  收起本身就靠 `--sidebar-hold: 0` 让正文重排（见 design.md 5.4）；
  唤出若沿用同一招，鼠标每划到左边一次整页正文就重排一次。
  侧栏本来就是 `position: fixed` + `z-index: 40` 浮在正文之上的，
  `translateX` 回来就够了。这条已进「不要做」清单（第 14 条）。
- **两个状态必须分开记**：`nav-peek`（悬停弹的）和 `nav-open`（人点 ☰ 开的）。
  悬停弹的可以自动收回，人自己按出来的绝不能。
  另有一个 `suppress` 拉黑：手动开合后要等指针真的退到边带之外才恢复自动唤出 ——
  这条是对窄屏 `☰` 说的，它左半边就压在触发带上。
- **连带改动**：
  - `scripts/verify-build.mjs` 72 → **79 项**（锁住「只做 transform」「书签让位」
    「reduced-motion 降级」「窄屏无遮罩」四条静态约束 + JS 侧的行为标志）。
  - `tools/verify.mjs` 53 → **64 项**：新一节用 **CDP 真实鼠标事件**测，
    含「停留不足不弹」「弹出来时正文左边界与收起时逐像素一致」「窄屏 ☰ 关掉后
    指针还贴着左边不许弹回」。核心断言是那个「不重排」不变性。
  - `scripts/shoot.mjs` 新增 `26-nav-peek`，并支持 `hoverAt` 传**一串坐标**。
  - `design.md` 新增 5.5 小节（含四条约束表与两个时间参数）、组件清单一行、
    「不要做」第 14 条、无障碍 11.1 补「指针专属能力」一行。
- **踩到的坑（值得记）**：`26-nav-peek` 第一版截出来是**空的**。
  原因是截图脚本用 `js: '…click()'` 收起侧栏 —— 那是 DOM 调用、不产生指针移动，
  而新开的无头浏览器指针停在 `(0,0)`，**恰好就在触发带里**。
  于是「点收起 → 直接挪到 x=8」被 `suppress` 正确地拉黑了（行为没错，是测试错）。
  修法是让 `hoverAt` 能传一串点，先绕到 x=760 再回到 x=8 —— 那才是真实用户的路径。
  教训：**用 DOM 调用模拟交互时，要意识到指针位置是另一套状态**。
- **验证**：`verify:build` **79/79** · `tools/verify.mjs` **64/64** ·
  `audit` 全视口无横向溢出 · `measure` 异常 0 项 · `wiki-lint` 27/27 ·
  `content:check` 通过。新增的 4 条静态断言做过**反向破坏测试**（逐条人为改坏后确实报红）。

---

## 2026-09-18 · 修掉一个 CRLF 潜伏 bug：Windows 上一 clone 就会红两条断言

- **类型**：工程
- **现象**：一次 `git reset --hard` 之后（也就是「**任何人在 Windows 上 clone 本仓库**」
  得到的状态），`wiki-lint` 从 27/27 掉到 25/27，
  「每章 frontmatter 的 chapter 等于文件名」「每章 frontmatter 有 lead」
  两条对 **22 章全部报红** —— 看起来像 22 个内容文件一起坏了，其实文件一个字都没动。
- **根因**：`wiki-lint.mjs` 用 `/^---\n([\s\S]*?)\n---/` 取 frontmatter。
  仓库里存的是 LF，但 Windows 上 `core.autocrlf=true`（安装默认）会**签出成 CRLF**，
  于是 `---\n` 匹配不到 `---\r\n`，`fm` 直接为 `null`，两条断言全红。
  同一类的还有 `wiki-facts.mjs` 的 `/^\s{6,}'.+?',$/gm` —— 它更阴：
  CRLF 下**不报错**，只是把 followups 静默数成 0，数字悄悄变小。
  共同点是 JS 正则里带 `m` 标志的 `$` **只认 `\n` 之前，不认 `\r\n`**。
- **为什么直到今天才暴露**：本机工作区一直是 LF（由脚本与编辑器写出，git 没重签出过），
  而 `git status` 因为 autocrlf 归一化仍然显示干净 ——
  所以这个 bug **在开发机上不可能复现**，只有真正签出才会现形。
  这次是重写历史时 `git reset --hard` 顺带把它逼出来的，属于「坏事里的好事」。
- **修法**：`wiki-lint.mjs` / `wiki-facts.mjs` / `check-links.mjs` 各加一个
  `readText()`，读进来先 `replace(/\r\n/g, '\n')`，**所有源文件读取统一走它**。
  只折行、不写回文件 —— 校验脚本不该有副作用。
- **连带改动**：新增脚本里的源文件读取要记得用 `readText` 而不是 `readFileSync`；
  写 `$` 锚定的正则时先想一句「CRLF 下还成立吗」。
- **验证**：CRLF 工作区下 `wiki-lint` **27/27**；`wiki-facts` 数字与 LF 时完全一致
  （22 章 · 22 图 · 24 段代码 · 131 小节 · 57958 汉字 · 72 问）；
  `check-links` 正常（2 个 BAD 是 OpenAI 站点对爬虫返 403，与本次无关）；
  `verify:build` **72/72** · `tools/verify.mjs` **53/53** · `audit` 全视口无横向溢出 ·
  `measure` 异常 0 项。
- **考虑过但没做**：加 `.gitattributes`（`* text=auto eol=lf`）从源头统一行尾。
  没做是因为它会改写现有工作区的行尾，让 `git status` 出现满屏「已修改」，
  而收益已经被 `readText()` 完整覆盖 —— 不值当。

---

## 2026-09-18 · 关于页出口区补「本站源码」入口

- **类型**：版式
- **改了什么**：`about.astro` 在原有的「主站 / 公众号」两块大卡下面，加了一条
  **整宽的源码横条**（`.cta-slim.cta-src` → `github.com/BEATREE/harness-times`）。
- **为什么**：仓库已经公开，但页面上没有任何入口指过去 —— 作品要是没人点得到，
  公开就等于没公开。放在关于页最想让人点出去的那一区，是它能被看到的位置。
- **踩到的坑（重要）**：第一版做成了**第三张竖卡**（`grid-template-columns: 1.45fr 1fr 1fr`），
  1440px 上很好看，一到 1100px 就崩 —— 侧栏是固定占位的，纸面只剩 470px 左右，
  三栏把 `.cta-d` 说明压成「一列一个字」。
  所以改成两块竖卡（保持原构图）+ 一条横条：横条对纸面宽度不敏感，
  靠 `flex-wrap` 自己就够，**不需要额外断点**；只保留 `≤620px` 让它由 `flex` 转 `block`。
  这条已经写进 `design.md` 第六节组件清单与第十三节第 13 条。
- **连带改动**：`scripts/verify-build.mjs` 新增 5 条断言（源码入口存在 / 外链带 `rel=noopener` /
  出口区仍是两块主推卡 / `≤620px` 降单列 / `.cta-slim` 走 `flex`）；
  `scripts/shoot.mjs` 新增 `24-about-cta-1100`、`25-about-cta-620` 两个镜头 ——
  **只看 1440px 的广角图发现不了上面那个坑**，必须留下窄一档的证据。
- **验证**：`npm run build:fresh` → `verify:build` **72/72**；`tools/verify.mjs` **53/53**；
  `tools/audit.mjs` 全视口无横向溢出；三个宽度的截图（1440 / 1100 / 620）人工过目。

---

## 2026-09-18 · 仓库脱敏收尾：工作区改完 + 历史重写

- **类型**：工程
- **改了什么**：
  - `scripts/cf-domain.mjs` 不再硬编码 account id，改为读 `CLOUDFLARE_ACCOUNT_ID`
    环境变量 → 回落到 `.dev.vars`（`.gitignore` 内）；输出默认**半掩**（`0515…14b9`），
    要完整值加 `--show-ids`。
  - `README.md`、`wiki/log.md` 里的邮箱换成「主账号 / 持有 zone 的那个账号」这类描述。
  - 本文件顶部加了「账号标识一律不进仓库」的约定说明。
  - **历史重写**：`3a9b3c9` 引入的这些串在所有后续提交里都还在（一个串进了仓库，
    它就在每一个后续 tree 里），所以工作区改干净**不等于**仓库改干净 ——
    必须重写历史再强推。重写后校验：全历史 blob 扫一遍，邮箱 0 条、
    32 位十六进制标识 0 条、token 0 条。
- **为什么**：仓库是 public 的。要脱的不是密码（本来就没有），
  而是**账号标识**：它们单看不是凭据，但足以让人定位到具体账号，
  和「顺手贴进日志的输出」拼在一起就是一条可用的线索。
  用户明确要求「历史版本提交记录也不要透露出来」，所以走重写而非只改工作区。
- **连带改动**：重写历史会**换掉所有 commit hash**，远端必须
  `git push --force-with-lease`；本地任何基于旧 hash 的引用（分支、tag、笔记）都要重新对。
  提交者身份也一起换了 —— 所有提交的 author/committer 从 `<QQ号>@qq.com`
  改成 `BEATREE <BEATREE@users.noreply.github.com>`。**这条最容易漏**：
  `git log --oneline` 默认不显示邮箱，但 GitHub 网页与 API 都会给出来，
  QQ 号就那样躺在公开的提交元数据里。
  另外**本仓库的 `git config user.email` 也要改**（只改本仓库，别动 `--global`）——
  否则下一条提交立刻把 QQ 号又写回去，前面全白做。
- **⚠️ 顺序约束**：**强推完成之前不要部署站点**。
  关于页新增的「本站源码」入口直指这个仓库 —— 若先把站点发上去、历史却还是旧版，
  等于亲手把访客引向一个「历史里还带着标识」的仓库。正确顺序：脱敏 → 强推 → 部署。
- **⚠️ 踩过的坑：`--replace-text` 的规则文件不认 `#` 注释**。
  我按「注释行」写了几行 `#` 开头的说明，其中一行是**孤立的 `#`** ——
  它被当成了一条真规则：*把每个 `#` 替换成 `***REMOVED***`*。
  结果全仓库所有 `.mjs` 的 shebang（`#!/usr/bin/env node`）连同 53 个文件里的
  `#` 全被改写，`wiki-lint.mjs` 直接 `SyntaxError: Unexpected token '**'`。
  注意 `--replace-text` / `--replace-message` 走的是 `get_replace_text()`，
  **它没有注释逻辑**；`--replace-paths` 走的 `get_paths_from_file()` 才跳过 `#`。
  两个函数行为不一样，别互相类比。
  所以：**规则文件里只准写 `literal:...==>...`，一个注释都不要加**；
  跑之前先把文件喂给 `FilteringOptions.get_replace_text()` 数一遍规则条数。
  这次靠 `***REMOVED***` 当损坏哨兵 + 重写前后 `HEAD^{tree}` 必须逐字节相同这两条抓住了，
  并用重写前的 `git bundle` 完整回滚重来。
- **怎么做的（可复用）**：
  1. **先扫清家底**，这步不能跳：要扫**历史里所有 blob**，不是工作区。
     `git rev-list --objects --all | awk 'NF==2{print $1}' | sort -u` 拿 blob 清单，
     逐个 `git cat-file -p` 再 grep。只看 `git diff` 会漏掉历史中间版本。
     提交信息与 `%ae/%ce` 要**分开扫**，它们不在 blob 里。
  2. **备份**：`git bundle create <备份>.bundle --all` + `git bundle verify`。
     本次就是靠它回滚的 —— 不是形式主义。
  3. `git filter-repo --force --replace-text <规则> --replace-message <规则> --mailmap <映射>`
     —— blob 内容、提交信息、提交者元数据**三处都要过**，只做第一处等于没做。
     替换值用占位描述（`主账号` / `PAGES_ACCOUNT_ID`）而不是删空，旧提交才仍读得通。
     注意 filter-repo 会**顺手删掉 origin**，事后要 `git remote add` 加回来。
  4. **复扫 + 校验三件事**：6 类敏感模式 0 命中、`***REMOVED***` 哨兵 0 命中、
     `%an <%ae> | %cn <%ce>` 全部是预期身份。
     再加一条最硬的：**重写前后 `HEAD^{tree}` 必须完全一致** ——
     因为 HEAD 的文件本来就干净，内容替换不该动它；一旦不等，说明规则误伤了正文。
- **验证**：全历史 **214 个 blob** + **10 条提交信息与身份**对 6 类模式（两个邮箱、
  QQ 号、两个 account id、zone tag）**全部 0 命中**；`***REMOVED***` 哨兵 0；
  （复扫时 `***REMOVED***` 会命中本文件里对它自身的 4 处引用 —— 那是说明文字，
  不是损坏；判据以 `src/` `scripts/` `tools/` 为准，那三处必须为 0。）
  `HEAD^{tree}` 与重写前逐字节相同（`15a79fd…`）；占位符确实写入（主账号 15 处 /
  另一个账号 16 处 / `PAGES_ACCOUNT_ID` 6 处 / `ZONE_ACCOUNT_ID` 5 处 / `ZONE_TAG` 5 处）；
  10 commits / 71 files 不变；工作区干净。
  重写前的完整备份在仓库外：`E:\AllWorkspace\ht-backup\`
  （`harness-times-pre-rewrite.bundle` + `replacements-v2.txt` + `mailmap.txt`）。

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
    返回 `status=initializing` → `pending`。（zone_tag 与账号 id **已按 2026-09-18 的
    脱敏决定移除**，见本文件顶部的说明。）
- **卡在哪**：zone 跨账号。
  - Pages 项目挂在**主账号**下
  - zone `beatree.cn` 挂在**另一个账号**下 —— 两个账号不是同一个

  跨账号时 Cloudflare **不会**自动建 DNS 记录，所以域名永远停在
  `pending / validation=pending/http` —— HTTP 校验要求能真的访问到域名，
  而 DNS 没解析就访问不到，证书签不出来（鸡生蛋）。
  且 wrangler 本机 OAuth 凭据的 scope 里**只有 `zone:read`，没有 DNS 写权限**
  （scope 清单实测：`pages:write` ✅ / `zone:read` ✅ / 无 `dns_records:edit` ❌）。

- **待办（需要持有 beatree.cn 的账号操作）**：
  在持有 zone 的那个账号 → `beatree.cn` → DNS 添加：

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

> 收尾说明，**不是条目** —— 所以它没有「类型」行，这是有意的（`wiki-lint` 只对
> 日期条目要求「类型」行）。别为了「格式统一」给它补一行。

项目首版之前的原型与素材整理未纳入本日志（无版本控制记录）。
