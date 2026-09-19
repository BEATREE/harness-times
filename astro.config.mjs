import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { shikiCodeTitle, rehypeCodeTitleWrapper } from './src/lib/code-title.mjs';
import { rehypeDiagramMotion } from './src/lib/diagram-motion.mjs';
import { remarkGlossaryTerms } from './src/lib/glossary-terms.ts';

// Harness Times — 静态输出，产物在 dist/，可直接交给 Cloudflare Pages
export default defineConfig({
  /*
   * canonical / og:url 的基准，必须是**对外主张的那个地址**。
   * 自定义域名 harness.beatree.cn 已签发证书并可直接访问（2026-09-18 起 active），
   * 所以基准指向它而不是 Pages 默认域名 —— 否则搜索引擎会把两个域名各收一份，
   * 权重被摊薄，而作品集要的恰恰是「一个稳定的公开地址」。
   */
  site: 'https://harness.beatree.cn',
  output: 'static',
  trailingSlash: 'ignore',
  // 自动生成 /sitemap-index.xml（含 /sitemap-0.xml）。
  // 静态路由 + 所有 getStaticPaths 枚举的动态页（4 领域索引、23 章正文）都会被收进去。
  // lastmod 用 Git 提交时间（需在 git 仓库内构建），否则退回构建时间。
  integrations: [sitemap()],
  build: {
    // 目录式输出：/harness/agent-loop/index.html，便于 Pages 直接命中
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  markdown: {
    // 正文用衬线字体，代码块用浅色主题以贴合纸面
    shikiConfig: {
      theme: 'github-light',
      // 不折行：代码折行会破坏缩进语义，长行交给 .code-block 横向滚动，
      // 并用 CSS 的滚动阴影提示「右侧还有内容」。
      wrap: false,
      transformers: [shikiCodeTitle()],
    },
    // 把 ```lang title="文件名" 渲染成带文件名栏的代码块
    // 顺序有讲究：这两个插件都跑在 rehype-raw 之前，各自处理不同形态的节点
    // （Shiki 产出的 <pre> 元素 / markdown 里原样保留的 raw HTML 图解），互不干扰。
    rehypePlugins: [rehypeDiagramMotion, rehypeCodeTitleWrapper],
    // 把正文里的术语标记 [[id]] 展开成指向 /glossary/#t-<id> 的可点链接。
    // 它必须在 remark 阶段（mdast）做：那时 [[id]] 还落在一个 text 节点里，
    // 可以结构化地换成 link 节点，不会误伤代码块与 raw HTML 图解。
    // 术语数据来自 src/data/glossary.ts（唯一来源），未知 id 会让构建失败。
    remarkPlugins: [remarkGlossaryTerms],
    smartypants: false,
  },
  vite: {
    server: {
      // 反向代理访问时必须放开 host 校验
      host: '0.0.0.0',
      allowedHosts: true,
    },
  },
  devToolbar: {
    enabled: false,
  },
});
