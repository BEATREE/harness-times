# tools/ — 零依赖站点验证

这套工具不装 Playwright、不装 Puppeteer，直接通过 **CDP（Chrome DevTools Protocol）**
驱动本机已有的 Chromium，用 Node 内置的 `fetch` + `WebSocket` 通信。这样验证脚本只有
几十 KB、没有 `node_modules`，在任何装了 Chrome 的机器上都能跑。

## 前置条件

需要一个 Chromium 可执行文件。默认读 `HT_CHROME` 环境变量，未设置时回退到本机
Playwright 缓存的 Chromium 路径：

```bash
# 指向你自己的 Chrome / Chromium
export HT_CHROME="/path/to/chrome"          # macOS / Linux
set HT_CHROME=D:\path\to\chrome.exe          # Windows
```

**注意**：必须用完整 Chromium，不能用 `chrome-headless-shell`——
后者的 CDP WebSocket 握手会失败。启动参数固定为 `--headless=new`。

## 四个工具

### `verify.mjs` — 功能验证

覆盖渲染、交互、存储与恢复四条链路：

| 分组 | 验什么 |
| --- | --- |
| 章节页渲染 | 导语、SVG 图形元素数与文字数、自测题数、信息盒/表格/代码块、面试问答数组 |
| 自测题交互 | 点击后锁定、错项标红正确项标绿、解析展开、作答写入 localStorage |
| 标记与笔记 | 标记学完、自动进复习队列、状态标签同步、掌握度自评、笔记保存与渲染 |
| 进度页 | 页面渲染、活跃天数统计、笔记汇总可见 |
| 导出恢复 | 存储结构含版本号、导出内容能否完整还原 |
| 面试题库页 | 22 章覆盖、条目数、高频标记、四大版块、自评写入独立 key、两种筛选 |
| 首页/关于页 | 侧栏导航完整、章节入口数、能力地图 SVG、隐私模型说明 |
| 移动端 | 390px 视口无横向溢出、菜单按钮存在 |
| 名词卡片 | 名词库页卡片数、搜索筛选、知识域筛选、术语链接指向 `#t-`、卡片预渲染进隐藏容器、点击弹窗（真鼠标事件）、Esc 关闭、卡片回位、焦点送出与收回、弹窗底栏「标记已掌握」不用滚动就可见 |
| 学习跟踪 | 点「标记已掌握」真的写进 `ht:progress.v1`（读原始 JSON 核对）、再点一下能取消（整条移除）、「只看未掌握」把刚标的那条筛掉、刷新后状态还在（只写不读的实现和「写了读不回来」长得一样，只能靠刷新验） |
| 图解完整性 | 全站 22 个章节页逐个量每张图里每个 `<text>` 的 `getBBox()`，确认没越过 `viewBox`（svg 默认 `overflow: hidden`，一行太长的注释字会被**安静地切掉**） |
| 运行期 | 页面无未捕获异常 |

```bash
npm run verify                              # 打本地预览（需先 npm run preview）
npm run verify:live                         # 打线上站
node tools/verify.mjs --base=http://127.0.0.1:5000
```

#### 测指针交互：三个会让「功能明明是好的」变成红色的坑

用 CDP 真事件（`Input.dispatchMouseEvent` / `dispatchKeyEvent`）测交互是刻意的：
合成事件里 `pointerType` 是自己填的，等于自己给自己发通行证。但真事件会带来三个
**看起来像功能坏了、其实是测试自己没摆好位**的失败：

1. **页面内 `dispatchEvent(new PointerEvent(...))` 不算数。** 这类特性的判断依赖
   真实的 `pointerType` 与事件时序，合成事件测不出「停留 110ms」这种时间语义。
2. **新开的无头浏览器指针停在 `(0,0)`。** 对「贴近视口左边缘」这类位置敏感的特性，
   那恰好就在触发带里。所以要先绕远再回目标位置 —— `shoot.mjs` 的 `hoverAt`
   支持传一串坐标正是为此。
3. **`html { scroll-behavior: smooth }` 会让 `scrollIntoView` 变成异步动画。**
   紧接着量坐标，拿到的是**滚动前**的位置，元素常常还在视口之外：
   `elementFromPoint` 返回 `null`，点位也点不中任何东西，报错却是「弹窗没打开」。
   修法是先 `document.documentElement.style.scrollBehavior = 'auto'` 再滚
   （`scrollIntoView({behavior:'auto'})` 没用 —— `auto` 的语义就是「听 CSS 的」）。

另外，行内元素（如正文里的术语链接）要用 `getClientRects()[0]` 取点击位，不能用
`getBoundingClientRect()`：术语正好落在换行处时，bounding rect 会把两行一起框住，
中心点落在两行之间的空白上。断言里留了「点击位确实命中链接」这一条，就是为了让这类
问题以「命中 null」而不是「弹窗没打开」的形式暴露出来。

#### 量几何：两个「报错了，但真因在测量方法」的坑

**一、越界判断的减数顺序不能凭感觉写。**
查「图里的文字有没有出画布」时，第一版把垂直方向写成了 `(vy + vh) - (b.y + b.height)` ——
那量的是「底边还剩多少空间」，于是任何正常文字都会得到几百的假正值，
**全站假报 711 处「溢出」**。正确写法是 `b.y + b.height - (vy + vh)`。
判据：越界量必须是**「内容跑到框外多少」**，不是「框里还剩多少」。

**二、`getBBox()` 要在动效落定之后再量，或者先冻结动效。**
图解有入场动画（`transform: translateY`），动画中途量到的不是终态框。
`verify.mjs` 的做法是注入一条 `*{animation-delay:0s!important;animation-duration:1ms!important}`，
**注入与测量分成两次 `evaluate`**（同一个 evaluate 里注入完就量，样式还没重算）。

**三、截图别用 `captureBeyondViewport: true` + 文档坐标 clip。**
它会让 Chrome 内部改视口尺寸来容纳整页，本站的三栏 flex 因此**重排**，
量好的坐标随即失配 —— 截出来像「页面把文字裁了」，其实是截歪了（图 5 被冤枉过一次）。
可靠做法：先 `window.scrollTo` 到目标位置，再整屏截（不传 `clip`）。为了看一眼而多带点周围内容，没有代价。

### `audit.mjs` — 多视口横向溢出审计

18 个代表性页面 × 4 档视口（360 / 390 / 768 / 1280）共 72 组，逐个检查
`document.scrollWidth` 是否超过 `clientWidth`；超了就自动定位最深的溢出元素并打印
它的宽度、层级与父元素。

```bash
npm run audit                               # 默认 http://localhost:4321
node tools/audit.mjs --base=http://localhost:4399
```

> ⚠️ **`--base=` 与 `HT_BASE` 都支持，前者优先**（2026-09 补上）。
> 之前只认环境变量，于是 `--base=…` 会被**静默忽略**、跑在默认端口上 ——
> 如果那个端口恰好有别的东西在跑，你会拿到一份「跑过了」的报告，
> 而它审的是另一个站点。传参不生效比报错危险得多，所以这两件事一起修了。
> 同理，改动端口后请确认输出里的路径都是真页面（404 页是不会溢出的，会一路全绿）。

### `probe.mjs` — 溢出元素探针

列出所有「`scrollWidth > clientWidth` 且 `overflow-x: visible`」的元素，以及所有
宽于视口的元素（按层级由深到浅）。适合初步缩小范围。

```bash
node tools/probe.mjs /harness/harness-02-agent-loop/ 390
```

### `bisect.mjs` — 二分隐藏法定位根因

`probe.mjs` 有时抓不到根因：溢出元素自己不超限，只是被内部元素的 min-content 撑大了
（典型就是 flex 项的 `min-width: auto`）。这个工具换一种确定性做法——从 `.app` 开始
逐个 `display: none`，看文档宽度何时回落到视口内，然后递归进去，直到叶子节点，最后
打印一条完整的「罪魁链条」。

```bash
node tools/bisect.mjs /harness/harness-02-agent-loop/ 390
```

输出示例：

```
1. <div.main.paper-texture>  rectW=725
   display=block overflowX=visible width=724.812px minWidth=auto
2. <div.sheet>  rectW=725
3. <article.prose>  rectW=685
4. <div.code-block>  rectW=685
5. <pre>  rectW=683
   display=block overflowX=auto whiteSpace=pre
6. <code>  rectW=651
```

顺着这条链就能看出：`pre` 的 min-content（最长代码行 683px）把整条祖先链一路撑到了
725px，而 `.main` 作为 flex 项 `min-width: auto` 无法收缩。修法是给 `.main` 加
`min-width: 0`——注意给 `pre` 加 `overflow-x: auto` 是**没用的**，它拦不住祖先的
min-content 传播。

## 为什么不用 Playwright

Playwright 会引入数百 MB 依赖，而这里需要的能力（导航、求值、模拟视口、捕获异常）
CDP 原生就有。零依赖意味着这套验证可以跟着仓库走，别人 clone 下来就能复现。
