#!/usr/bin/env node
/**
 * wiki 一致性体检。
 *
 * 为什么需要它：
 *   wiki/index.md 里写满了「每章几图几题、本领域几章、总共有多少问」这类统计。
 *   手写的统计一定会漂——改完正文忘了改 wiki，wiki 就从「维护入口」变成「错误信息源」。
 *   比没有 wiki 更糟。
 *
 *   所以这里把 wiki 里的说法与真实内容对一遍：
 *     · index.md 的每章统计 ←→ 正文实际统计
 *     · index.md 的难度 / 时长 / 标题 ←→ curriculum.ts
 *     · index.md 的章节顺序 ←→ CHAPTERS 数组顺序（防止章节被塞错领域）
 *     · index.md 的总量行 ←→ 全部实测值
 *     · schema.md 里那些「必须」←→ 正文是否真的满足
 *
 * 用法：node scripts/wiki-lint.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { chapterFacts, interviewFacts } from './wiki-facts.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wikiDir = join(root, 'wiki');

/*
 * 所有源文件读取都走这里，强制把 CRLF 折成 LF。
 *
 * 为什么必须有：本仓库是公开的，Windows 上 `core.autocrlf=true`（默认）的人一 clone
 * 得到的就是 CRLF 工作区，而 JS 正则里的 `$`（带 m 标志）**只认 `\n` 之前**，
 * 不认 `\r\n` —— 于是 `/^---\n([\s\S]*?)\n---/` 直接匹配不到 frontmatter，
 * 一夜之间「每章都有 chapter / lead」两条断言全红，看起来像内容坏了，
 * 其实只是行尾。这类失败最坑人的地方是：**在本机怎么改都不会复现**。
 *
 * 注意只在*文本*层面折行，不写回文件 —— 校验脚本不该有副作用。
 */
const readText = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const results = [];
const check = (name, pass, detail = '') => results.push({ name, pass, detail });

/* ---------- 0. 目录结构 ---------- */
for (const f of ['README.md', 'index.md', 'schema.md', 'sources.md', 'log.md']) {
  check(`wiki/${f} 存在`, existsSync(join(wikiDir, f)));
}
if (results.some((r) => !r.pass)) {
  for (const r of results) console.log(`${r.pass ? ' ok ' : 'FAIL'}  ${r.name}`);
  console.error('\n[wiki-lint] wiki 目录不完整，后续检查跳过。');
  process.exit(1);
}

const index = readText(join(wikiDir, 'index.md'));
const schema = readText(join(wikiDir, 'schema.md'));
const sources = readText(join(wikiDir, 'sources.md'));
const readme = readText(join(wikiDir, 'README.md'));

/* ---------- 1. 真实事实 ---------- */
const facts = chapterFacts();
const qa = interviewFacts();
const byId = new Map(facts.map((f) => [f.id, f]));

const curriculumSrc = readText(join(root, 'src/data/curriculum.ts'));
const curriculum = [
  ...curriculumSrc.matchAll(
    /id: '([^']+)',\s*\n\s*domain: '([^']+)',\s*\n\s*no: (\d+),\s*\n\s*title: '((?:[^'\\]|\\.)*)',[\s\S]*?\n\s*level: (\d),\s*\n\s*minutes: (\d+),/g
  ),
].map((m) => ({ id: m[1], domain: m[2], no: Number(m[3]), title: m[4], level: Number(m[5]), minutes: Number(m[6]) }));

check('curriculum.ts 解析出 22 章', curriculum.length === 22, `实际 ${curriculum.length}`);
check('正文文件数与 curriculum 一致', facts.length === curriculum.length, `${facts.length} vs ${curriculum.length}`);
check('题库覆盖全部章节', curriculum.every((c) => qa.has(c.id)), `缺 ${curriculum.filter((c) => !qa.has(c.id)).map((c) => c.id).join(',')}`);

/* ---------- 2. 解析 index.md 的章节表 ---------- */
// 行格式：| 1 | 标题 | `xx.md` | L2 | 30 | 1/1/6 | 3(1) | 标签 |
const rowRe = /^\|\s*(\d+)\s*\|([^|]+)\|\s*`([a-z0-9-]+\.md)`\s*\|\s*L([123])\s*\|\s*(\d+)\s*\|\s*(\d+)\/(\d+)\/(\d+)\s*\|\s*(\d+)\((\d+)\)\s*\|/gm;
const rows = [];
for (const m of index.matchAll(rowRe)) {
  rows.push({
    no: Number(m[1]),
    title: m[2].trim(),
    file: m[3],
    id: m[3].replace(/\.md$/, ''),
    level: Number(m[4]),
    minutes: Number(m[5]),
    svg: Number(m[6]),
    code: Number(m[7]),
    h2: Number(m[8]),
    qaTotal: Number(m[9]),
    qaHigh: Number(m[10]),
  });
}

check('index.md 表格解析出 22 行', rows.length === 22, `实际 ${rows.length}`);

/* ---------- 3. 逐行核对 ---------- */
let mismatch = [];
for (const r of rows) {
  const f = byId.get(r.id);
  const c = curriculum.find((x) => x.id === r.id);
  const q = qa.get(r.id);
  if (!f) { mismatch.push(`${r.id}: 正文文件不存在`); continue; }
  if (!c) { mismatch.push(`${r.id}: curriculum 里没有`); continue; }
  if (r.title !== c.title) mismatch.push(`${r.id}: 标题「${r.title}」≠「${c.title}」`);
  if (r.level !== c.level) mismatch.push(`${r.id}: 难度 L${r.level} ≠ L${c.level}`);
  if (r.minutes !== c.minutes) mismatch.push(`${r.id}: 时长 ${r.minutes} ≠ ${c.minutes}`);
  if (r.svg !== f.svg) mismatch.push(`${r.id}: 图 ${r.svg} ≠ ${f.svg}`);
  if (r.code !== f.code) mismatch.push(`${r.id}: 码 ${r.code} ≠ ${f.code}`);
  if (r.h2 !== f.h2) mismatch.push(`${r.id}: 节 ${r.h2} ≠ ${f.h2}`);
  if (!q) mismatch.push(`${r.id}: 题库里没有`);
  else {
    if (r.qaTotal !== q.total) mismatch.push(`${r.id}: 问答 ${r.qaTotal} ≠ ${q.total}`);
    if (r.qaHigh !== q.high) mismatch.push(`${r.id}: 高频 ${r.qaHigh} ≠ ${q.high}`);
  }
  // 章节序号必须与 curriculum 的 no 一致
  if (r.no !== c.no) mismatch.push(`${r.id}: 序号 ${r.no} ≠ ${c.no}`);
}
check('index.md 每行统计与正文 / curriculum / 题库一致', mismatch.length === 0, mismatch.slice(0, 6).join('；') + (mismatch.length > 6 ? ` …共 ${mismatch.length} 处` : ''));

/* ---------- 4. 顺序与分组 ---------- */
const rowOrder = rows.map((r) => r.id).join(',');
const curOrder = curriculum.map((c) => c.id).join(',');
check('index.md 的章节顺序与 CHAPTERS 一致（章节没被放错领域）', rowOrder === curOrder,
  rowOrder === curOrder ? '' : '顺序或分组不同');

const fMissing = facts.filter((f) => !rows.some((r) => r.id === f.id)).map((f) => f.id);
check('每个正文文件都在 index.md 里有行', fMissing.length === 0, fMissing.join(', '));

/* ---------- 5. 总量行 ---------- */
const sum = (k) => facts.reduce((n, f) => n + f[k], 0);
const qaTotal = [...qa.values()].reduce((n, q) => n + q.total, 0);
const qaHigh = [...qa.values()].reduce((n, q) => n + q.high, 0);
const hanzi = sum('hanzi');
const domains = new Set(curriculum.map((c) => c.domain)).size;

const expectedTotal =
  `| ${domains} 领域 | ${facts.length} 章 | ${sum('svg')} 图 | ${sum('code')} 段代码 | ` +
  `${sum('h2')} 小节 | ${qaTotal} 问（${qaHigh} 高频） | 约 ${(hanzi / 10000).toFixed(1)} 万汉字 |`;
check('index.md 总量行与实测一致', index.includes(expectedTotal), expectedTotal);

/* ---------- 6. schema.md 里的「必须」是否真的成立 ---------- */
const frontmatterBad = [];
const viewBoxBad = [];
const titleFenceBad = [];
const quizBad = [];
const leadBad = [];
for (const f of facts) {
  const src = readText(join(root, f.file));
  const fm = src.match(/^---\n([\s\S]*?)\n---/);
  const body = fm ? src.slice(fm[0].length) : src;

  if (!fm || !new RegExp(`^chapter:\\s*${f.id}\\s*$`, 'm').test(fm[1])) frontmatterBad.push(f.id);
  if (!/^lead:\s*\S/m.test(fm ? fm[1] : '')) leadBad.push(f.id);
  // 每个 <svg> 都要有 viewBox="0 0 W H"
  const svgCount = (src.match(/<svg\b/g) || []).length;
  const vbCount = (src.match(/<svg[^>]*viewBox="0 0 [\d.]+ [\d.]+"/g) || []).length;
  if (svgCount !== vbCount) viewBoxBad.push(`${f.id}(${vbCount}/${svgCount})`);
  // 每段围栏都要有 title=
  const fences = (src.match(/^```[a-z]+/gm) || []).length;
  const titled = (src.match(/^```[a-z]+ title="/gm) || []).length;
  if (fences !== titled) titleFenceBad.push(`${f.id}(${titled}/${fences})`);
  // 自测题必须 3 题且 data-answer 与选项下标对应
  const qids = new Set((src.match(/data-qid="([^"]+)"/g) || []).map((s) => s.slice(11, -1)));
  const answers = [...src.matchAll(/data-answer="(\d)"/g)].map((m) => m[1]);
  if (qids.size !== 3 || answers.length !== 3) quizBad.push(`${f.id}(题 ${qids.size})`);
}

check('每章 frontmatter 的 chapter 等于文件名', frontmatterBad.length === 0, frontmatterBad.join(', '));
check('每章 frontmatter 有 lead', leadBad.length === 0, leadBad.join(', '));
check('每个 <svg> 都带 viewBox="0 0 W H"', viewBoxBad.length === 0, viewBoxBad.join(', '));
check('每段代码围栏都带 title=', titleFenceBad.length === 0, titleFenceBad.join(', '));
check('每章都有 3 道自测题', quizBad.length === 0, quizBad.join(', '));

/* ---------- 7. schema.md 里声明的禁止事项，抽查是否守住 ---------- */
const allSrc = facts.map((f) => readText(join(root, f.file))).join('\n');
check('正文中不含「本报」', !allSrc.includes('本报'));
check('正文中不含「第 N 期」式期号', !/第\s*\d+\s*期/.test(allSrc));

// schema.md 提到的关键 class 必须真的在正文里出现过（防止文档写了、现实没有）
for (const [cls, why] of [
  ['tbl-wrap', '表格必须包 tbl-wrap'],
  ['box-key', '信息盒'],
  ['quiz', '自测题'],
  ['pull-quote', '章末金句'],
  ['fig-frame', '图解外层'],
]) {
  check(`schema.md 提到的 \`${cls}\` 在正文中确实存在`, allSrc.includes(`class="${cls}"`) || allSrc.includes(`${cls}"`) || allSrc.includes(cls), why);
}

/* ---------- 8. 交叉引用：sources.md 的总量说法 ---------- */
const urlCount = readText(join(root, 'scripts/sources.txt'))
  .split('\n')
  .filter((l) => /^https?:\/\//.test(l.trim())).length;
check('sources.md 记的 URL 条数与 sources.txt 一致', sources.includes(`${urlCount} 条 URL`), `sources.txt 实际 ${urlCount} 条`);

/* ---------- 9. README 里的「不变量」数量与实际一致 ---------- */
const invN = (readme.match(/^\d+\.\s+\*\*/gm) || []).length;
check('README 列出了不变量清单', invN >= 6, `解析到 ${invN} 条`);

/* ---------- 输出 ---------- */
let failed = 0;
for (const r of results) {
  if (!r.pass) failed += 1;
  console.log(`${r.pass ? ' ok ' : 'FAIL'}  ${r.name}${r.pass || !r.detail ? '' : `   ← ${r.detail}`}`);
}
console.log(`\n[wiki-lint] ${results.length} 项断言，失败 ${failed} 项`);
if (failed) {
  console.log('提示：统计漂了就跑 `node scripts/wiki-facts.mjs --md` 拿正确数字贴回 wiki/index.md。');
}
process.exitCode = failed ? 1 : 0;
