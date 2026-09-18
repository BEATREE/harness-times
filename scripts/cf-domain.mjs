#!/usr/bin/env node
/**
 * Cloudflare Pages 自定义域名的配置与体检。
 *
 * 为什么需要单独一个脚本：
 *   wrangler v4 **去掉了** `wrangler pages domain` 子命令
 *   （v4 只剩 project / deployment / functions / secret / download 六组），
 *   而自定义域名只能在 Dashboard 点、或者走 Cloudflare REST API。
 *   这个脚本走 API，把「加域名 → 等签发 → 验解析」变成一条可重复执行的命令。
 *
 * 背景（本项目踩到的坑，换个项目也可能遇到）：
 *   Pages 项目 `harness-times` 挂在**主账号**下，
 *   而 zone `beatree.cn` 挂在**另一个账号**下 —— 两个账号不是同一个。
 *   zone 跨账号时，Cloudflare **不会**自动创建 DNS 记录，必须手工在
 *   持有 zone 的那个账号里加一条 CNAME，否则域名会一直停在
 *   `status=pending / validation=pending/http`（HTTP 校验要能真的访问到你的域名，
 *   鸡生蛋问题：DNS 没解析 → 校验过不去 → 证书签不出来）。
 *
 *   ⚠️ 具体的邮箱与 account id / zone tag **不写进这个仓库**（仓库是公开的）。
 *   需要它们时看这两处（都在仓库之外）：
 *     · 本机：Windows 凭据管理器 / wrangler 的 `~/.wrangler` 配置
 *     · `.dev.vars`（已在 .gitignore 里）或部署环境的环境变量
 *   脚本从环境变量或配置文件读取，找不到就**明确报错**而不是静默用错账号。
 *
 * 凭据：
 *   · 优先读环境变量 CLOUDFLARE_API_TOKEN（需要 Pages:Edit + 若跨账号还要 Zone:DNS:Edit）
 *   · 否则回落到 wrangler 本机 OAuth 凭据 `~/.wrangler/config/default.toml`
 *     （**只有 pages:write / zone:read，没有 DNS 写权限**，所以加域名可以、加 CNAME 不行）
 *   · account id 从 CLOUDFLARE_ACCOUNT_ID 读；未设置时回落到 `.dev.vars`
 *   脚本不会打印 token。
 *
 * 用法：
 *   node scripts/cf-domain.mjs status                  # 查当前域名与签发状态
 *   node scripts/cf-domain.mjs add harness.beatree.cn  # 把域名挂到 Pages 项目
 *   node scripts/cf-domain.mjs check harness.beatree.cn # 解析 + HTTPS 实探
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 从 .dev.vars / .env 里取一个键（这两个文件都在 .gitignore 内，不会进仓库）。 */
function fromLocalEnvFile(key) {
  for (const f of ['.dev.vars', '.env', '.env.local']) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(new RegExp(`^\\s*${key}\\s*=\\s*"?([^"\\r\\n]+)"?`, 'm'));
    if (m) return m[1].trim();
  }
  return '';
}

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || fromLocalEnvFile('CLOUDFLARE_ACCOUNT_ID');
const PROJECT = process.env.CF_PAGES_PROJECT || 'harness-times';
const PAGES_HOST = `${PROJECT}.pages.dev`;
const API = 'https://api.cloudflare.com/client/v4';

/*
 * 输出脱敏。
 *
 * 这不是洁癖：上一次这些标识进到仓库，正是因为有人把本脚本的输出原样贴进了 wiki。
 * 仓库是公开的，所以默认把 account id / zone tag 打成 `0515…14b9` 这种半掩形式，
 * 既足够核对「是不是同一个账号」，又不构成可直接抄走的完整标识。
 * 需要完整值做排查时加 `--show-ids`。
 */
const SHOW_IDS = process.argv.includes('--show-ids');
const mask = (v) => {
  if (!v) return '-';
  if (SHOW_IDS) return v;
  const s = String(v);
  return s.length <= 10 ? `${s.slice(0, 3)}…` : `${s.slice(0, 4)}…${s.slice(-4)}`;
};

if (!ACCOUNT_ID) {
  console.error(
    '[cf-domain] 缺少 account id。\n' +
      '  这个仓库是公开的，所以 account id 不写进源码。请用下面任一方式提供：\n' +
      '    · export CLOUDFLARE_ACCOUNT_ID=<你的 Pages 账号 id>\n' +
      '    · 或在项目根建 .dev.vars（已在 .gitignore）写入 CLOUDFLARE_ACCOUNT_ID=<...>\n' +
      '  账号 id 可在 Cloudflare Dashboard 右侧栏或 `wrangler whoami` 里看到。'
  );
  process.exit(1);
}

/** 取凭据：环境变量优先，其次 wrangler 的 OAuth。(不打印任何值) */
function token() {
  if (process.env.CLOUDFLARE_API_TOKEN) return { tok: process.env.CLOUDFLARE_API_TOKEN, src: 'CLOUDFLARE_API_TOKEN' };
  const candidates = [
    join(process.env.APPDATA || '', 'xdg.config/.wrangler/config/default.toml'),
    join(homedir(), 'AppData/Roaming/xdg.config/.wrangler/config/default.toml'),
    join(homedir(), '.wrangler/config/default.toml'),
    join(homedir(), '.config/.wrangler/config/default.toml'),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(/oauth_token\s*=\s*"([^"]+)"/);
    if (m) return { tok: m[1], src: `wrangler OAuth (${p})` };
  }
  return null;
}

const call = async (t, path, init = {}) => {
  const r = await fetch(API + path, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

const domainsPath = `/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}/domains`;

async function status() {
  const c = token();
  if (!c) return fail('没有可用凭据。请设置 CLOUDFLARE_API_TOKEN，或先 `npx wrangler login`。');
  const { status: st, body } = await call(c.tok, domainsPath);
  if (!body.success) return fail(`列出域名失败：${JSON.stringify(body.errors)}`);
  const list = body.result ?? [];
  console.log(`Pages 项目 ${PROJECT}（账号 ${mask(ACCOUNT_ID)}${SHOW_IDS ? "" : " · 加 --show-ids 看完整值"}）`);
  console.log(`默认域名：https://${PAGES_HOST}`);
  console.log(`自定义域名：${list.length} 个\n`);
  if (!list.length) console.log('  （无）');
  for (const d of list) {
    const ok = d.status === 'active' ? '✅' : '⏳';
    console.log(`${ok} ${d.name}`);
    console.log(`     状态 ${d.status} · HTTP 校验 ${d.validation_data?.status ?? '-'} · CA ${d.certificate_authority ?? '-'}`);
    if (d.zone_tag) console.log(`     zone ${mask(d.zone_tag)}`);
    if (d.status !== 'active') {
      console.log(`     ⚠ 未激活：检查持有该 zone 的账号里是否已有 CNAME 指向 ${PAGES_HOST}（需代理开启）`);
    }
  }
  return list.some((d) => d.status !== 'active') ? 2 : 0;
}

async function add(name) {
  const c = token();
  if (!c) return fail('没有可用凭据。请设置 CLOUDFLARE_API_TOKEN，或先 `npx wrangler login`。');
  console.log(`凭据来源：${c.src}`);
  const { status: st, body } = await call(c.tok, domainsPath, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  console.log('HTTP', st, '| success', body.success);
  if (!body.success) {
    console.log('errors:', JSON.stringify(body.errors));
    console.log('\n常见原因：域名已被其他 Pages 项目占用 / 当前账号没有该 zone / 凭据缺少 Pages:Edit。');
    return 1;
  }
  const d = body.result;
  console.log(`已添加：${d.name}（status=${d.status}）`);
  if (d.zone_tag) {
    console.log(`zone_tag=${mask(d.zone_tag)}`);
    console.log(`\n下一步：在持有该 zone 的 Cloudflare 账号里加一条 DNS 记录`);
    console.log(`  CNAME  ${d.name.split('.')[0]}  →  ${PAGES_HOST}   （代理状态：已代理 / 橙色云）`);
    console.log('加完等待 1–5 分钟，再跑 `node scripts/cf-domain.mjs status` 看是否转为 active。');
  } else {
    console.log('未识别到 zone：该域名可能不在 Cloudflare 托管，需在 DNS 服务商处加 CNAME。');
  }
  return 0;
}

/** 解析 + HTTPS 实探，确认域名真的通了（不依赖 Cloudflare API）。 */
async function check(name) {
  const { promises: dns } = await import('node:dns');
  let resolved = [];
  try {
    resolved = await dns.resolve4(name);
  } catch {
    try {
      resolved = (await dns.resolveCname(name)).map((x) => `CNAME ${x}`);
    } catch { /* 无记录 */ }
  }
  console.log(`DNS ${name}: ${resolved.length ? resolved.join(', ') : '（无记录）'}`);
  try {
    const r = await fetch(`https://${name}/`, { redirect: 'manual' });
    const title = (await r.text()).match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    console.log(`HTTPS 探测：HTTP ${r.status} 🔒${r.headers.get('cf-ray') ? ' (Cloudflare)' : ''}`);
    if (title) console.log(`页面标题：${title}`);
    return r.ok ? 0 : 1;
  } catch (e) {
    console.log(`HTTPS 探测失败：${e.message}`);
    return 1;
  }
}

function fail(msg) {
  console.error(msg);
  return 1;
}

const [cmd, arg] = process.argv.slice(2);
const run = {
  status: () => status(),
  add: () => (arg ? add(arg) : fail('用法：node scripts/cf-domain.mjs add <域名>')),
  check: () => (arg ? check(arg) : fail('用法：node scripts/cf-domain.mjs check <域名>')),
};
if (!run[cmd]) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n/, ''));
  process.exit(1);
}
process.exitCode = await run[cmd]();
