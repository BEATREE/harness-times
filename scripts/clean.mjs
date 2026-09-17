#!/usr/bin/env node
/**
 * 清掉 Astro 的内容构建缓存。
 *
 * 为什么需要它：
 *   Astro 5 的内容层会把「markdown 渲染结果」缓存到 .astro/ 下，缓存键只跟
 *   内容文件本身有关，跟 markdown 管线（remark/rehype/shiki 插件）的代码无关。
 *   所以只要改了 astro.config.mjs 的 markdown 配置、或 src/lib/ 下那几个
 *   插件，就必须先清缓存再 build，否则会一直拿到旧的 HTML——
 *   表现是「代码改了、build 也过了、产物却一动不动」。
 *
 * 用法：
 *   node scripts/clean.mjs      # 或 npm run clean
 *   npm run build:fresh         # 先 clean 再 build
 */
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const targets = [
  join(root, '.astro'),
  join(root, 'node_modules', '.astro'),
  join(root, 'node_modules', '.vite'),
];

for (const target of targets) {
  rmSync(target, { recursive: true, force: true });
  console.log(`[clean] removed ${target}`);
}
