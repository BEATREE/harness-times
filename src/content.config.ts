import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * 章节内容集合。
 * 文件名即章节 id（如 harness-02-agent-loop.md → id = "harness-02-agent-loop"），
 * 与 src/data/curriculum.ts 中的 CHAPTERS[].id 一一对应。
 * 展示用的元数据（领域、序号、难度标签文案）以 curriculum.ts 为唯一来源，
 * frontmatter 只放正文相关的信息，避免两处失同步。
 */
const chapters = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/chapters' }),
  schema: z.object({
    /** 与 curriculum 的一致性校验用，写错会被构建失败挡住 */
    chapter: z.string(),
    /** 导语：斜体大字，页面顶部 */
    lead: z.string(),
    /** 可选的编辑注 / 本版修订说明 */
    note: z.string().optional(),
  }),
});

export const collections = { chapters };
