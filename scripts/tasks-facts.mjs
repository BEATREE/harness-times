#!/usr/bin/env node
/**
 * 逐章「完善度」清点 —— `wiki/tasks.md` 里那张进度表的唯一出处。
 *
 * 为什么需要它：
 *   wiki/tasks.md 记的是「每一章的五项完善工作做到哪了」。这类逐章状态表
 *   和 index.md 的统计一样，**手写一定会漂**：补了两张图、加了三道自测题，
 *   表上还是旧数字，于是这张表从「进度看板」变成「错误信息源」。
 *   所以表不由人写，由这个脚本从正文里数出来，用 --write 写回。
 *
 * 与 wiki-facts.mjs 的分工：
 *   wiki-facts  →  章节的「体量」（几图几码几节几字）→ 贴进 index.md 目录表
 *   tasks-facts →  章节的「完善度」（五项工作是否到位、缺口是什么）→ 贴进 tasks.md
 *   两者共用 wiki-facts 的 chapterFacts() / interviewFacts()，不各数一遍。
 *
 * 用法：
 *   node scripts/tasks-facts.mjs           # 人看的清单 + 缺口汇总
 *   node scripts/tasks-facts.mjs --md      # 只输出表格（可直接粘贴）
 *   node scripts/tasks-facts.mjs --write   # 写回 wiki/tasks.md 的 AUTO 区
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { chapterFacts, interviewFacts } from './wiki-facts.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chapterDir = join(root, 'src/content/chapters');
const tasksPath = join(root, 'wiki/tasks.md');

const AUTO_BEGIN = '<!-- AUTO:BEGIN -->';
const AUTO_END = '<!-- AUTO:END -->';

/* 读源文件一律折成 LF —— 理由见 wiki-lint.mjs 同名函数（CRLF 会让行尾锚定的正则静默数成 0）。 */
const readText = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/**
 * 五项判据 + 阈值。
 * 阈值就是「做到什么程度算这一项过关」，与 wiki/schema.md 的写作契约对应：
 *   双语名词 —— 每个术语在正文里用 [[id]] 标出，卡片才点得开；
 *   图解     —— 抽象机制必须有图，一章少于 3 张通常意味着有大段纯文字；
 *   常见误区 —— 面试真正拉开差距的一段，少于 4 条说明还没贴到考点；
 *   延伸阅读 —— 名词卡讲「是什么」，外链负责「往哪深挖」；
 *   自测题   —— schema 定为 3 道，多于此也不会被判失败。
 */
export const CRITERIA = [
  ['terms', 8, '名词'],
  ['svg', 3, '图解'],
  ['mistakes', 4, '误区'],
  ['refs', 3, '延伸'],
  ['selftest', 3, '自测'],
];

/** 取某个 `## ` 小节到下一个 `## ` 之间的正文（找不到返回空串）。 */
function sectionBody(src, headingRe) {
  const m = src.match(headingRe);
  if (!m) return '';
  const rest = src.slice(m.index + m[0].length);
  const next = rest.search(/^## /m);
  return next === -1 ? rest : rest.slice(0, next);
}

/** 清点单章的五项完善度 + 体量。 */
export function chapterAudit() {
  const facts = new Map(chapterFacts().map((c) => [c.id, c]));
  const qa = interviewFacts();
  const files = readdirSync(chapterDir).filter((f) => f.endsWith('.md')).sort();

  return files.map((file) => {
    const id = file.replace(/\.md$/, '');
    const src = readText(join(chapterDir, file));
    const f = facts.get(id) ?? { svg: 0, code: 0, h2: 0, hanzi: 0 };

    const terms = new Set(
      [...src.matchAll(/\[\[([a-zA-Z0-9_-]+)(?:\|[^\]]+)?\]\]/g)].map((m) => m[1])
    ).size;
    const mistakes = (sectionBody(src, /^##\s+[^\n]*常见误区与追问\s*$/m).match(/^### /gm) || []).length;
    const refs = new Set(
      (sectionBody(src, /^##\s+[^\n]*参考与延伸\s*$/m).match(/https?:\/\/[^\s)<>"）]+/g) || []).map((u) =>
        u.replace(/[.,;，。；]+$/, '')
      )
    ).size;
    const selftest = (src.match(/data-qid=/g) || []).length;

    const row = {
      id,
      terms,
      svg: f.svg,
      mistakes,
      refs,
      selftest,
      qa: (qa.get(id) ?? { total: 0 }).total,
      code: f.code,
      h2: f.h2,
      hanzi: f.hanzi,
    };
    row.missing = CRITERIA.filter(([k, min]) => row[k] < min).map(([, , label]) => label);
    row.ok = row.missing.length === 0;
    return row;
  });
}

/** 渲染 tasks.md 的 AUTO 区内容（表格 + 合计行）。 */
export function renderAutoBlock() {
  const rows = chapterAudit();
  const sum = (k) => rows.reduce((n, r) => n + r[k], 0);
  const out = [];
  out.push('| 章节 | 名词 | 图解 | 误区 | 延伸 | 自测 | 问答 | 小节 | 汉字 | 状态 |');
  out.push('| --- | --: | --: | --: | --: | --: | --: | --: | --: | :-: |');
  for (const r of rows) {
    out.push(
      `| \`${r.id}\` | ${r.terms} | ${r.svg} | ${r.mistakes} | ${r.refs} | ${r.selftest} | ` +
        `${r.qa} | ${r.h2} | ${r.hanzi} | ${r.ok ? '✅' : `⚠ ${r.missing.join('·')}`} |`
    );
  }
  out.push(
    `| **合计** | ${sum('terms')} | ${sum('svg')} | ${sum('mistakes')} | ${sum('refs')} | ` +
      `${sum('selftest')} | ${sum('qa')} | ${sum('h2')} | ${sum('hanzi')} | ${rows.filter((r) => r.ok).length}/${rows.length} 章达标 |`
  );
  return out.join('\n');
}

/** 把 AUTO 区内容写回 tasks.md（保持其余部分原样）。 */
export function writeTasksFile() {
  const md = readText(tasksPath);
  const b = md.indexOf(AUTO_BEGIN);
  const e = md.indexOf(AUTO_END);
  if (b === -1 || e === -1 || e < b) {
    throw new Error(`wiki/tasks.md 里找不到成对的 ${AUTO_BEGIN} / ${AUTO_END}`);
  }
  const next = md.slice(0, b + AUTO_BEGIN.length) + '\n' + renderAutoBlock() + '\n' + md.slice(e);
  writeFileSync(tasksPath, next);
  return renderAutoBlock();
}

function main() {
  if (process.argv.includes('--write')) {
    writeTasksFile();
    const rows = chapterAudit();
    console.log(`[tasks-facts] 已写回 wiki/tasks.md：${rows.filter((r) => r.ok).length}/${rows.length} 章达标`);
    return;
  }
  if (process.argv.includes('--md')) {
    console.log(renderAutoBlock());
    return;
  }

  const rows = chapterAudit();
  console.log('章节                             名词 图解 误区 延伸 自测  问答  汉字  状态');
  for (const r of rows) {
    console.log(
      `${r.id.padEnd(30)} ${String(r.terms).padStart(3)} ${String(r.svg).padStart(3)} ` +
        `${String(r.mistakes).padStart(4)} ${String(r.refs).padStart(4)} ${String(r.selftest).padStart(4)} ` +
        `${String(r.qa).padStart(5)} ${String(r.hanzi).padStart(6)}  ${r.ok ? '✅' : '⚠ ' + r.missing.join('·')}`
    );
  }
  const bad = rows.filter((r) => !r.ok);
  console.log(
    `\n${rows.length} 章，达标 ${rows.length - bad.length}，待补 ${bad.length}` +
      (bad.length ? `：${bad.map((r) => `${r.id}(${r.missing.join('·')})`).join(' ')}` : '')
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
