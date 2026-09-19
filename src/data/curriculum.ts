/**
 * 课程结构：4 大知识领域 / 22 章
 * 排序即学习路径，由浅入深。list 顺序就是领域内推荐阅读顺序。
 */

export type DomainId = 'llm' | 'harness' | 'eval' | 'knowledge';
export type Level = 1 | 2 | 3;

export interface Domain {
  id: DomainId;
  no: string;
  name: string;
  en: string;
  tagline: string;
  desc: string;
  /** 报头版块色，用于该领域索引页的局部强调 */
  accent: string;
  /** 建议先读哪个领域 */
  order: number;
}

export interface Chapter {
  /** 与 src/content/chapters/<id>.md 文件名一致 */
  id: string;
  domain: DomainId;
  /** 领域内序号（1 起） */
  no: number;
  title: string;
  en: string;
  desc: string;
  level: Level;
  /** 预计阅读分钟数 */
  minutes: number;
  tags: string[];
}

export const DOMAINS: Domain[] = [
  {
    id: 'llm',
    no: 'I',
    name: '大模型原理',
    en: 'Model Foundations',
    tagline: '先看懂发动机',
    desc:
      'Harness 的所有工程决策最终都落在模型的物理特性上：注意力是 O(n²) 的，缓存是按前缀命中的，激活是稀疏的，输出是采样的。不理解这四件事，就只能靠感觉调参数。这一部分只讲与工程强相关的原理，不推导公式。',
    accent: '#2c4a7c',
    order: 1,
  },
  {
    id: 'harness',
    no: 'II',
    name: 'Harness 工程',
    en: 'Harness Engineering',
    tagline: '模型之外的一切',
    desc:
      '如果 Agent = Model + Harness，那么 Harness 就是"除模型本身以外的所有工作"。这是整个网站的主战场：循环、工具、上下文、记忆、编排、沙箱、长任务可靠性。每一章都按"原理 → 图解 → 代码 → 面试问答"展开。',
    accent: '#9b2c2c',
    order: 2,
  },
  {
    id: 'eval',
    no: 'III',
    name: '评测工程',
    en: 'Evaluation Engineering',
    tagline: '从许愿到工程',
    desc:
      '没有评测的 Agent 迭代本质上是在许愿。这一部分讲清楚怎么建评测集、怎么定义指标口径、怎么让机器打分可信、以及如何把线上 badcase 变成回归门禁。评测是工程与研究的交界地带，也是最能体现系统性思维的地方。',
    accent: '#b8944b',
    order: 3,
  },
  {
    id: 'knowledge',
    no: 'IV',
    name: '知识引擎',
    en: 'Knowledge Engine',
    tagline: '让回答有据可查',
    desc:
      'Agent 的幻觉不是靠提示词治好的，是靠"回答必须落在可验证的知识上"治好的。这一部分讲知识建模（实体 / 事实 / 推断三层）、RAG 的完整链路与失效模式、向量检索的原理与边界，以及如何让每一条引用都能被点开验证。',
    accent: '#2f6157',
    order: 4,
  },
];

export const CHAPTERS: Chapter[] = [
  /* ============ I. 大模型原理 ============ */
  {
    id: 'llm-01-transformer',
    domain: 'llm',
    no: 1,
    title: 'Transformer 与自注意力',
    en: 'Attention Is All You Need',
    desc:
      'Agent 的一切都跑在注意力机制之上。这一章只做三件事：说清 token、张量、投影、打分这些名词，跟着数据走一遍形状变化，再把 n² 的来源与工程推论讲透。',
    level: 1,
    minutes: 35,
    tags: ['Self-Attention', 'QKV', '复杂度', '位置编码'],
  },
  {
    id: 'llm-02-kv-cache',
    domain: 'llm',
    no: 2,
    title: 'KV Cache：多轮对话的隐性账单',
    en: 'The Hidden Bill of Multi-turn',
    desc:
      'Agent 的成本大头不在输入，而在每一轮都要重新送一遍的历史。KV Cache 把重复计算变成缓存命中，而命中率取决于一个你从没注意过的细节：前缀稳定性。',
    level: 2,
    minutes: 26,
    tags: ['KV Cache', '前缀稳定性', '成本模型', '显存估算'],
  },
  {
    id: 'llm-03-moe',
    domain: 'llm',
    no: 3,
    title: 'MoE 与稀疏激活',
    en: 'Sparse Activation',
    desc:
      '总参数 671B 的模型为什么能比 70B 的稠密模型还便宜？答案在"激活参数量"和"总参数量"之间的那条缝里。这一章讲清 MoE 的收益、代价，以及面试里最容易答错的那道题。',
    level: 2,
    minutes: 24,
    tags: ['MoE', '路由', '稀疏激活', '显存'],
  },
  {
    id: 'llm-04-sampling',
    domain: 'llm',
    no: 4,
    title: '采样、温度与确定性',
    en: 'Sampling and Determinism',
    desc:
      '同一个问题问两次得到不同答案，这不是 bug，是解码策略的必然结果。但在 Agent 里，不确定性会直接变成"工具参数写错了"。这一章讲清每个采样参数到底在动什么。',
    level: 1,
    minutes: 20,
    tags: ['Temperature', 'Top-P', '解码策略', '确定性'],
  },
  {
    id: 'llm-05-inference-opt',
    domain: 'llm',
    no: 5,
    title: '推理优化与成本杠杆',
    en: 'Inference Optimization',
    desc:
      '量化、PagedAttention、投机解码、连续批处理——四把把成本打下来的锤子。重点不是背名词，而是知道每个手段针对哪个瓶颈、代价是什么。',
    level: 3,
    minutes: 30,
    tags: ['量化', '投机解码', 'Continuous Batching', 'MLA'],
  },

  /* ============ II. Harness 工程 ============ */
  {
    id: 'harness-01-what-is-harness',
    domain: 'harness',
    no: 1,
    title: 'Harness 是什么',
    en: 'Model + Harness = Agent',
    desc:
      '"除模型本身以外的所有工作，都属于 Harness 的范畴"——这句话划出的地到底有多大？这一章给出一张完整的 Harness 能力地图，后面七章都挂在这张图上。',
    level: 1,
    minutes: 24,
    tags: ['Harness', '能力地图', 'Agent 定义'],
  },
  {
    id: 'harness-02-agent-loop',
    domain: 'harness',
    no: 2,
    title: 'Agent Loop 与终止条件',
    en: 'The Loop and When to Stop',
    desc:
      '写一个循环谁都会，难的是知道什么时候让它停下来。任务完成、轮数用尽、预算耗尽、无进展、需要人工——五类终止条件缺一不可。',
    level: 1,
    minutes: 32,
    tags: ['ReAct', '终止条件', '循环检测', 'Human-in-the-loop'],
  },
  {
    id: 'harness-03-tool-use',
    domain: 'harness',
    no: 3,
    title: 'Tool Use 与工具契约',
    en: 'Tools as Contracts',
    desc:
      '工具不是给人看的 API 文档，而是给模型看的能力契约。描述怎么写、错误怎么回喂、参数怎么校验、MCP 什么时候该用——这一章把工具层讲透。',
    level: 2,
    minutes: 34,
    tags: ['Function Calling', '工具描述', '错误分类', 'MCP'],
  },
  {
    id: 'harness-04-context-engineering',
    domain: 'harness',
    no: 4,
    title: 'Context Engineering',
    en: 'What the Model Gets to See',
    desc:
      'Prompt Engineering 是"怎么说"，Context Engineering 是"给它看什么"。上下文预算怎么分、什么常驻什么按需、顺序为什么会影响成本——这一章是效果上限的真正决定因素。',
    level: 2,
    minutes: 36,
    tags: ['上下文预算', '上下文压缩', '前缀稳定性', '状态外置'],
  },
  {
    id: 'harness-05-memory',
    domain: 'harness',
    no: 5,
    title: 'Memory 记忆系统',
    en: 'Remember and Forget',
    desc:
      '记住什么是能力，忘掉什么才是设计。记忆的写入时机、冲突处理、可解释性与可删除性，决定了它到底是资产还是污染源。',
    level: 2,
    minutes: 30,
    tags: ['长期记忆', '写入策略', '检索', '冲突消解'],
  },
  {
    id: 'harness-06-multi-agent',
    domain: 'harness',
    no: 6,
    title: 'Subagent 与多智能体编排',
    en: 'Orchestration',
    desc:
      '什么时候该多开一个 Agent，什么时候那是自找麻烦？答案是三个词：上下文隔离、并行提速、权限隔离。这一章给出选型标准与常见踩坑。',
    level: 3,
    minutes: 34,
    tags: ['Subagent', 'Supervisor', '上下文隔离', '结果汇总'],
  },
  {
    id: 'harness-07-sandbox-security',
    domain: 'harness',
    no: 7,
    title: '沙箱、权限与提示注入',
    en: 'Sandbox and Trust Boundary',
    desc:
      '把能力交出去之后，怎么守住边界？外部内容一律视为不可信数据、能力最小化、副作用操作强制确认、全量审计——四层防御缺一层都不够。',
    level: 3,
    minutes: 32,
    tags: ['沙箱', '最小权限', 'Prompt Injection', '审计'],
  },
  {
    id: 'harness-08-long-horizon',
    domain: 'harness',
    no: 8,
    title: '长任务与失败恢复',
    en: 'Long-Horizon Reliability',
    desc:
      '跑着跑着模型不吐字了、上下文满了、进程被关了——这些才是 Harness 工程师每天面对的东西，也是"工程问题"与"研究问题"的分水岭。',
    level: 2,
    minutes: 36,
    tags: ['流式卡死', '状态机', '检查点', '幂等'],
  },

  /* ============ III. 评测工程 ============ */
  {
    id: 'eval-01-first-principles',
    domain: 'eval',
    no: 1,
    title: '评测的第一性问题',
    en: 'How Do You Know It Got Better',
    desc:
      '"感觉这次好多了"不是工程结论。这一章讲清评测要回答的三个问题：好在哪个维度、好了多少、这个差异是真的还是噪声。',
    level: 1,
    minutes: 24,
    tags: ['评测设计', '基线', '噪声', '可复现'],
  },
  {
    id: 'eval-02-dataset',
    domain: 'eval',
    no: 2,
    title: '评测集建设与防过拟合',
    en: 'Building the Set',
    desc:
      '评测集从哪来？答案是从线上长出来。这一章讲分层设计（冒烟 / 回归 / 边界 / 对抗）、保留集机制，以及怎么避免你的系统把评测集背下来。',
    level: 2,
    minutes: 30,
    tags: ['评测集', '保留集', '分层', 'Badcase 回流'],
  },
  {
    id: 'eval-03-executable-metrics',
    domain: 'eval',
    no: 3,
    title: '办事型 Agent 的硬指标',
    en: 'Executable Metrics',
    desc:
      '可执行率、参数准确率、任务完成率——听起来都对，但分母是什么？枚举和自由文本能用同一个口径吗？口径不清的指标等于没有指标。',
    level: 2,
    minutes: 30,
    tags: ['可执行率', '参数准确性', '计算口径', '指标定义'],
  },
  {
    id: 'eval-04-insight-judge',
    domain: 'eval',
    no: 4,
    title: '洞察型评分与 LLM-as-Judge',
    en: 'Judging Insight',
    desc:
      '"洞察好不好"也能评吗？能，但要先把维度拆开：方向相关性、证据充分性、可操作性、表达清晰度。以及一个必须警惕的东西——机器打分的四类偏差。',
    level: 3,
    minutes: 34,
    tags: ['多维评分', 'Rubric', 'LLM-as-Judge', '偏差控制'],
  },
  {
    id: 'eval-05-trace-loop',
    domain: 'eval',
    no: 5,
    title: 'Trace、Replay 与线上闭环',
    en: 'Closing the Loop',
    desc:
      '出了问题查不到原因，是因为没有 trace；改了一版不敢上线，是因为没有 replay。这一章把"线上 badcase → 评测集 → 回归门禁 → 灰度"的闭环接起来。',
    level: 2,
    minutes: 28,
    tags: ['Trace', 'Replay', '回归门禁', '灰度发布'],
  },

  /* ============ IV. 知识引擎 ============ */
  {
    id: 'knowledge-01-modeling',
    domain: 'knowledge',
    no: 1,
    title: '知识建模：实体、事实、推断',
    en: 'Entity, Fact, Inference',
    desc:
      '把业务知识拆成三层——实体是可锚定的对象，事实是可溯源的关系，推断是带依据链的衍生结论。这一章讲清三层为什么必须分开，混在一起会出什么事。',
    level: 2,
    minutes: 30,
    tags: ['实体抽取', '事实层', '推断层', '依据链'],
  },
  {
    id: 'knowledge-02-rag',
    domain: 'knowledge',
    no: 2,
    title: 'RAG 的链路与失效模式',
    en: 'Retrieval Augmented Generation',
    desc:
      'RAG 不是"检索 + 生成"两句话，它是一条有六个环节的链路，每个环节都能独立地把结果做错。这一章把失效模式逐个拆开，并给出定位手段。',
    level: 2,
    minutes: 32,
    tags: ['RAG', '切分', '召回', '失效模式'],
  },
  {
    id: 'knowledge-03-embedding',
    domain: 'knowledge',
    no: 3,
    title: 'Embedding 与向量检索',
    en: 'Vectors and Similarity',
    desc:
      '语义检索为什么会找错？因为"语义相近"和"对回答问题有用"是两件事。这一章讲清向量检索的原理、相似度度量的选择，以及它的能力边界。',
    level: 2,
    minutes: 28,
    tags: ['Embedding', '余弦相似度', 'ANN', '能力边界'],
  },
  {
    id: 'knowledge-04-hybrid-trust',
    domain: 'knowledge',
    no: 4,
    title: '混合检索、Rerank 与知识可信',
    en: 'Hybrid Retrieval and Trust',
    desc:
      '召回要宽、排序要准、引用要能被点开验证。这一章把关键词检索与向量检索拼成一条混合链路，用 Rerank 做精排，最后解决"凭什么相信这条知识"的问题。',
    level: 3,
    minutes: 34,
    tags: ['混合检索', 'Rerank', '溯源引用', '冲突消解'],
  },
  {
    id: 'knowledge-05-knowledge-update',
    domain: 'knowledge',
    no: 5,
    title: '知识更新与时效性',
    en: 'Freshness and Update',
    desc:
      '知识会过期，而"过期的正确"比"错误"更危险。这一章讲清 TTL、失效标记、增量更新、回滚，以及怎么让"这条知识还新不新"变成系统可判定的属性，而不是靠人记得。',
    level: 2,
    minutes: 30,
    tags: ['知识更新', '时效性', 'TTL', '增量更新'],
  },
];

/* ============================ 查询辅助 ============================ */

export const chaptersByDomain = (id: DomainId): Chapter[] =>
  CHAPTERS.filter((c) => c.domain === id).sort((a, b) => a.no - b.no);

export const domainOf = (id: DomainId): Domain =>
  DOMAINS.find((d) => d.id === id) as Domain;

export const chapterIndex = (id: string): number =>
  CHAPTERS.findIndex((c) => c.id === id);

export const chapterById = (id: string): Chapter | undefined =>
  CHAPTERS.find((c) => c.id === id);

/** 章节页路径：/{domain}/{chapterId}/ —— 例如 /harness/harness-02-agent-loop/ */
export const pathOf = (id: string): string => {
  const c = chapterById(id);
  if (!c) return '/';
  return `/${c.domain}/${c.id}/`;
};

export const neighbors = (
  id: string
): { prev: Chapter | null; next: Chapter | null } => {
  const i = chapterIndex(id);
  return {
    prev: i > 0 ? CHAPTERS[i - 1] : null,
    next: i >= 0 && i < CHAPTERS.length - 1 ? CHAPTERS[i + 1] : null,
  };
};

export const TOTALS = {
  chapters: CHAPTERS.length,
  domains: DOMAINS.length,
  minutes: CHAPTERS.reduce((s, c) => s + c.minutes, 0),
};

export const levelLabel = (lv: Level): string =>
  lv === 1 ? '入门' : lv === 2 ? '进阶' : '深入';

/** 难度对应的 CSS 类 */
export const levelClass = (lv: Level): string => `lv${lv}`;
