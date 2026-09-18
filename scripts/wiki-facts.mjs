#!/usr/bin/env node
/**
 * 内容事实清点。
 *
 * 用途：wiki 维护的「原始事实源」。改完正文 / 题库后跑一次，
 * 拿它来核对 wiki/index.md 里的数字有没有漂移，或直接用 --md 贴回去。
 *
 * 为什么需要它：
 *   wiki/index.md 里写了「每章几图几题几段代码」这类统计。
 *   手写的统计一定会漂 —— 改完正文忘了改 wiki，读者看到的就是假信息。
 *   所以统计不从脑子里来，从这个脚本的输出来。
 *
 * 用法：
 *   node scripts/wiki-facts.mjs            # 人看的明细
 *   node scripts/wiki-facts.mjs --md       # 可直接粘贴的表格行
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chapterDir = join(root, 'src/content/chapters');
const asMd = process.argv.includes('--md');

/*
 * 读源文件一律折成 LF 再用。理由见 wiki-lint.mjs 同名函数：
 * Windows 上 autocrlf=true 会签出 CRLF，而带 m 标志的 `$` 不认 `\r\n`，
 * 于是下面 `^\s{6,}'.+?',$` 这类行尾锚定的正则会静默数成 0 ——
 * 不报错、只是数字变小，比直接红掉更难发现。
 */
const readText = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/**
 * 清点单章事实。
 * 说明：围栏数以 ``` 出现次数 / 2 计；`<svg` 以标签出现次数计
 * （一章可能画多张图）；汉字数用于估篇幅，不参与断言。
 */
export function chapterFacts() {
  const files = readdirSync(chapterDir)
    .filter((f) => f.endsWith('.md'))
    .sort();

  return files.map((file) => {
    const src = readText(join(chapterDir, file));
    const csvRefs = [
      ...new Set(
        (src.match(/\/data\/[a-z0-9_.-]+\.csv/g) || []).map((s) => s.replace(/^\//, ''))
      ),
    ];
    return {
      id: file.replace(/\.md$/, ''),
      file: `src/content/chapters/${file}`,
      svg: (src.match(/<svg/g) || []).length,
      figures: (src.match(/class="fig"/g) || []).length,
      code: Math.floor((src.match(/^```/gm) || []).length / 2),
      h2: (src.match(/^## /gm) || []).length,
      hanzi: (src.match(/[\u4e00-\u9fa5]/g) || []).length,
      csv: csvRefs,
    };
  });
}

/** 清点题库：每章几问、几问被标为高频。 */
export function interviewFacts() {
  const src = readText(join(root, 'src/data/interview.ts'));
  const ids = [...src.matchAll(/^ {2}'([a-z0-9-]+)':\s*\[/gm)].map((m) => m[1]);
  const out = new Map();
  ids.forEach((id, i) => {
    const from = src.indexOf(`  '${id}': [`);
    const to = i + 1 < ids.length ? src.indexOf(`  '${ids[i + 1]}': [`) : src.length;
    const seg = src.slice(from, to > from ? to : src.length);
    const total = (seg.match(/^\s{4,}q:/gm) || []).length;
    const high = (seg.match(/freq: 'high'/g) || []).length;
    const followups = (seg.match(/^\s{6,}'.+?',$/gm) || []).length;
    out.set(id, { total, high, followups });
  });
  return out;
}

function main() {
  const chapters = chapterFacts();
  const qa = interviewFacts();

  const sum = (k) => chapters.reduce((n, c) => n + c[k], 0);
  const qaTotal = [...qa.values()].reduce((n, q) => n + q.total, 0);

  if (asMd) {
    // 供 wiki/index.md 直接粘贴：一行一章
    for (const c of chapters) {
      const q = qa.get(c.id) ?? { total: 0, high: 0 };
      console.log(
        `| ${c.id} | ${c.svg} | ${c.code} | ${c.h2} | ${q.total}${q.high ? ` (${q.high})` : ''} |`
      );
    }
    return;
  }

  console.log('章节                                      图 码 节  汉字  题库(高频)  数据');
  for (const c of chapters) {
    const q = qa.get(c.id) ?? { total: 0, high: 0 };
    console.log(
      `${c.id.padEnd(26)} ${String(c.svg).padStart(2)} ${String(c.code).padStart(2)} ` +
        `${String(c.h2).padStart(2)} ${String(c.hanzi).padStart(5)}  ` +
        `${String(q.total).padStart(2)}(${String(q.high).padStart(2)})     ` +
        `${c.csv.join(', ') || '-'}`
    );
  }
  console.log(
    `\n合计：${chapters.length} 章 · ${sum('svg')} 图 · ${sum('code')} 段代码 · ` +
      `${sum('h2')} 个小节 · ${sum('hanzi')} 汉字 · 题库 ${qaTotal} 问`
  );
  const missing = chapters.filter((c) => !qa.has(c.id)).map((c) => c.id);
  const extra = [...qa.keys()].filter((id) => !chapters.some((c) => c.id === id));
  if (missing.length) console.log(`⚠ 缺题库：${missing.join(', ')}`);
  if (extra.length) console.log(`⚠ 题库多出：${extra.join(', ')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
