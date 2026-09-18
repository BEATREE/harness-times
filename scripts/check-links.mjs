#!/usr/bin/env node
/**
 * 外链体检：把站点里出现的外链逐个跑一遍，输出状态码。
 *
 * 为什么单独写一个：
 *   正文和「关于本站」页里有不少站外链接（官方文档、工程博客、公众号二维码图），
 *   这些链接会随时间失效，而构建期发现不了——只有读者点下去才知道。
 *   上线前后跑一次，比事后收到反馈再修划算。
 *
 * 用法：
 *   node scripts/check-links.mjs                     # 扫描 src/ 里的全部 http(s) 链接
 *   node scripts/check-links.mjs --file=sources.txt  # 只检查清单文件里的链接（每行一个）
 *   node scripts/check-links.mjs https://a.com ...   # 只检查命令行给出的链接
 *
 * 扫描时会先剥掉 ``` 围栏代码块与行内 `code`：
 *   代码示例里常出现 example.com 这类占位域名，它们不是真链接，
 *   不剥掉就会一直报假警。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 读取源文件统一折成 LF：Windows 上 autocrlf=true 会签出 CRLF，而带 m 标志的 $ 不认 \r\n。 */
const readText = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** 去掉围栏代码块与行内代码，避免把示例里的占位域名当成真链接 */
function stripCode(text) {
  return text
    .replace(/^[ \t]*(`{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[^\n]*$/gm, '')
    .replace(/`[^`\n]*`/g, '');
}

function collectFromSource() {
  const urls = new Set();
  const re = /https?:\/\/[^\s"'`)<>\\]+/g;
  for (const file of walk(join(root, 'src'))) {
    if (!/\.(astro|md|ts|mjs|js|json|css)$/.test(file)) continue;
    const text = stripCode(readText(file));
    for (const m of text.match(re) ?? []) urls.add(m.replace(/[.,;:]+$/, ''));
  }
  return [...urls];
}

async function check(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
        headers: { 'user-agent': 'harness-times-link-check/1.0' },
      });
      if (method === 'HEAD' && (res.status === 405 || res.status === 403)) continue;
      return { url, status: res.status, type: res.headers.get('content-type') ?? '' };
    } catch (err) {
      if (method === 'GET') return { url, status: 0, type: String(err?.message ?? err) };
    }
  }
  return { url, status: 0, type: 'unknown' };
}

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith('--file='))?.slice('--file='.length);

let targets;
if (fileArg) {
  targets = readText(resolve(root, fileArg))
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
} else {
  const inline = args.filter((a) => /^https?:\/\//.test(a));
  targets = inline.length ? inline : collectFromSource();
}

console.log(`[check-links] ${targets.length} 个链接\n`);

const results = await Promise.all(targets.map(check));

let bad = 0;
for (const r of results.sort((a, b) => a.status - b.status)) {
  const ok = r.status >= 200 && r.status < 400;
  if (!ok) bad += 1;
  console.log(
    `${ok ? ' OK ' : 'BAD '} ${String(r.status).padStart(4)}  ${r.url}${ok ? '' : `   ← ${r.type}`}`
  );
}

console.log(`\n[check-links] 共 ${results.length} 个，异常 ${bad} 个`);
process.exitCode = bad ? 1 : 0;
