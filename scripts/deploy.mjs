#!/usr/bin/env node
/**
 * 把 dist/ 部署到 Cloudflare Pages。
 *
 * 为什么不直接在 package.json 里写 `wrangler pages deploy`：
 * 本项目的 Pages 项目与 zone `beatree.cn` 分属**两个 Cloudflare 账号**。
 * 没有显式 `CLOUDFLARE_ACCOUNT_ID` 时，wrangler 会**交互式**等你选账号，
 * 而那个提示在无人值守场景下 25 秒就超时 —— 表现出来是「命令挂着不动」，
 * 像网络问题，其实它在等键盘输入。这个坑在 2026-09-18 记过一次，这里固化下来。
 *
 * 所以：account id 一律由本脚本解析后显式传给 wrangler，杜绝交互。
 * 取值顺序：环境变量 → `.dev.vars` → `.env` → `.env.local`（后三个都在 .gitignore 内）。
 *
 * account id 是**标识**不是凭据（单独泄了也不能调 API），但仓库是公开的，
 * 所以本脚本自己的输出里只打半掩形式 —— 同 scripts/cf-domain.mjs 的约定。
 *
 * 用法：
 *   node scripts/deploy.mjs                  # 部署 dist/
 *   node scripts/deploy.mjs --branch=preview # 额外参数原样透传给 wrangler
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PROJECT = process.env.CF_PAGES_PROJECT || 'harness-times';

/** 从本机私密文件里取一个键（`.dev.vars` 是 wrangler 自己的约定文件名） */
function fromLocalEnvFile(key) {
  for (const f of ['.dev.vars', '.env', '.env.local']) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(new RegExp(`^\\s*${key}\\s*=\\s*"?([^"\\r\\n]+)"?`, 'm'));
    if (m) return m[1].trim();
  }
  return '';
}

/** 半掩：`0515…14b9`。够核对「是不是同一个账号」，又不会被直接抄走。 */
const mask = (v) => (v && v.length > 10 ? `${v.slice(0, 4)}…${v.slice(-4)}` : v || '-');

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || fromLocalEnvFile('CLOUDFLARE_ACCOUNT_ID');

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`[deploy] 找不到 ${DIST}/index.html —— 先跑 \`npm run build\`。`);
  process.exit(1);
}

if (!ACCOUNT_ID) {
  console.error(
    [
      '[deploy] 没有拿到 CLOUDFLARE_ACCOUNT_ID。',
      '',
      '  不传它 wrangler 会进交互式选账号，然后超时卡住（看着像网络问题）。',
      '  两种给法都行：',
      `    · 写进 ${join(ROOT, '.dev.vars')}：CLOUDFLARE_ACCOUNT_ID=<你的 account id>`,
      '    · 或临时带上：CLOUDFLARE_ACCOUNT_ID=xxx npm run deploy',
      '',
      '  不知道 account id 的话：`node scripts/cf-domain.mjs status --show-ids`。',
    ].join('\n')
  );
  process.exit(1);
}

// 除本脚本自己的参数外，其余原样透传（--branch / --commit-hash / --dry-run 等）
const passthrough = process.argv.slice(2);

console.log(`[deploy] 项目 ${PROJECT} · 账号 ${mask(ACCOUNT_ID)} · 目录 ${DIST}`);
if (passthrough.length) console.log(`[deploy] 透传参数：${passthrough.join(' ')}`);

const args = [
  'wrangler', 'pages', 'deploy', DIST,
  '--project-name', PROJECT,
  // 本地构建产物常带未提交/已忽略的差异，不打这个开关 wrangler 会拦下来问一句
  '--commit-dirty=true',
  ...passthrough,
];

const r = spawnSync('npx', args, {
  cwd: ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32', // Windows 上 npx 是 .cmd，不开 shell 找不到
  env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID },
});

process.exit(r.status ?? 1);
