import { defineConfig } from 'astro/config';

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
    // 报纸风格正文用衬线字体，代码块用浅色主题以贴合纸面
    shikiConfig: {
      theme: 'github-light',
      wrap: true,
    },
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
