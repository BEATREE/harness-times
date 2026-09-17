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

### `verify.mjs` — 功能验证（36 项）

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
| 运行期 | 页面无未捕获异常 |

```bash
npm run verify                              # 打本地预览（需先 npm run preview）
npm run verify:live                         # 打线上站
node tools/verify.mjs --base=http://127.0.0.1:5000
```

### `audit.mjs` — 多视口横向溢出审计

17 个代表性页面 × 4 档视口（360 / 390 / 768 / 1280）共 68 组，逐个检查
`document.scrollWidth` 是否超过 `clientWidth`；超了就自动定位最深的溢出元素并打印
它的宽度、层级与父元素。

```bash
npm run audit
```

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
