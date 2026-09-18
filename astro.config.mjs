import { defineConfig } from 'astro/config';
import { shikiCodeTitle, rehypeCodeTitleWrapper } from './src/lib/code-title.mjs';
import { rehypeDiagramMotion } from './src/lib/diagram-motion.mjs';

// Harness Times — 静态输出，产物在 dist/，可直接交给 Cloudflare Pages
export default defineConfig({
  site: 'https://harness-times.pages.dev',
  output: 'static',
  trailingSlash: 'ignore',
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
