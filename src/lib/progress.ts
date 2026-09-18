/**
 * Harness Times — 学习进度存储层
 *
 * 设计约定
 * 1. 全部数据落在浏览器 localStorage 的单一 key 下，key 带版本号（ht:v1），
 *    升级数据结构时通过 migrate() 处理，避免旧数据把页面打崩。
 * 2. 这里只做纯数据逻辑，不碰 DOM。交互由各页面组件自己订阅 'ht:progress' 事件。
 * 3. 任何写入都包在 try/catch 里：localStorage 在隐私模式 / 配额满时会抛异常，
 *    学习站点不能因此白屏。
 */

export const STORAGE_KEY = 'ht:progress:v1';
export const APP_TAG = 'harness-times';
/**
 * 存储结构版本。
 *   v1 → v2：新增 terms（名词卡片的「已掌握」标记）。
 * 升级不需要迁移脚本：normalize() 会把缺字段的对象补齐成当前 schema，
 * 旧的 v1 数据读进来自然就多出一个空的 terms。
 */
export const SCHEMA_VERSION = 2;

/** 间隔重复的复习间隔（天）。stage 越大间隔越长。 */
export const REVIEW_INTERVALS = [1, 3, 7, 16, 35];

export type ChapterStatus = 'unread' | 'reading' | 'done';

export interface Note {
  id: string;
  at: string;
  text: string;
}

export interface ReviewState {
  /** 当前间隔档位，对应 REVIEW_INTERVALS 下标 */
  stage: number;
  /** 下次到期时间 ISO */
  dueAt: string;
  /** 复习历史：每次结果的简短记录 */
  history: string[];
}

export interface ChapterState {
  status: ChapterStatus;
  /** 累计打开次数 */
  visits: number;
  /** 累计停留秒数（仅在页面可见时累加） */
  seconds: number;
  /** 最大滚动完成度 0-100 */
  scroll: number;
  /** 掌握度自评 0-5，0 表示未评 */
  confidence: number;
  starred: boolean;
  lastVisit: string | null;
  doneAt: string | null;
  quizzes: Record<string, { chosen: number; correct: boolean }>;
  notes: Note[];
  review: ReviewState | null;
}

export interface Store {
  app: string;
  version: number;
  updatedAt: string;
  /** 'YYYY-MM-DD' -> 当日学习分钟数 */
  daily: Record<string, number>;
  chapters: Record<string, ChapterState>;
  /**
   * 名词标记：termId -> 状态。
   * 挂在顶层而不是某一章下面，因为同一个名词会在多章出现，
   * 而「这个词我懂了」是跟着词走的，不是跟着章走的。
   */
  terms: Record<string, TermState>;
}

/**
 * 一个名词的学习状态。
 *
 * 只做一件事：记住「这个词我已经弄懂了」。刻意**不做**间隔重复的档位
 * （章节级的复习队列已经有一套），因为名词的粒度太细 —— 让读者为 25 个名词
 * 逐个安排复习日期，结果一定是没人用。
 */
export interface TermState {
  known: boolean;
  /** 最近一次标记为已掌握的时间；取消标记后保留，便于以后做统计 */
  at: string | null;
}

/* ============================ 基础工具 ============================ */

const nowISO = (): string => new Date().toISOString();

const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const dayKey = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const addDays = (days: number, from: Date = new Date()): string =>
  new Date(from.getTime() + days * 86400000).toISOString();

export const emptyChapter = (): ChapterState => ({
  status: 'unread',
  visits: 0,
  seconds: 0,
  scroll: 0,
  confidence: 0,
  starred: false,
  lastVisit: null,
  doneAt: null,
  quizzes: {},
  notes: [],
  review: null,
});

const emptyStore = (): Store => ({
  app: APP_TAG,
  version: SCHEMA_VERSION,
  updatedAt: nowISO(),
  daily: {},
  chapters: {},
  terms: {},
});

/* ============================ 读写 ============================ */

let cache: Store | null = null;

const available = (): boolean => {
  try {
    const k = '__ht_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
};

export const storageAvailable = (): boolean => available();

/** 把任意形状的历史数据补齐成当前 schema，避免字段缺失导致页面报错 */
const normalizeChapter = (raw: unknown): ChapterState => {
  const base = emptyChapter();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<ChapterState>;
  return {
    status:
      r.status === 'done' || r.status === 'reading' || r.status === 'unread'
        ? r.status
        : 'unread',
    visits: typeof r.visits === 'number' && r.visits >= 0 ? r.visits : 0,
    seconds: typeof r.seconds === 'number' && r.seconds >= 0 ? r.seconds : 0,
    scroll:
      typeof r.scroll === 'number'
        ? Math.max(0, Math.min(100, Math.round(r.scroll)))
        : 0,
    confidence:
      typeof r.confidence === 'number'
        ? Math.max(0, Math.min(5, Math.round(r.confidence)))
        : 0,
    starred: !!r.starred,
    lastVisit: typeof r.lastVisit === 'string' ? r.lastVisit : null,
    doneAt: typeof r.doneAt === 'string' ? r.doneAt : null,
    quizzes:
      r.quizzes && typeof r.quizzes === 'object'
        ? (r.quizzes as ChapterState['quizzes'])
        : {},
    notes: Array.isArray(r.notes)
      ? r.notes
          .filter((n) => n && typeof n.text === 'string')
          .map((n) => ({
            id: typeof n.id === 'string' ? n.id : uid(),
            at: typeof n.at === 'string' ? n.at : nowISO(),
            text: n.text,
          }))
      : [],
    review:
      r.review && typeof r.review === 'object' && typeof r.review.dueAt === 'string'
        ? {
            stage:
              typeof r.review.stage === 'number'
                ? Math.max(0, Math.min(REVIEW_INTERVALS.length - 1, r.review.stage))
                : 0,
            dueAt: r.review.dueAt,
            history: Array.isArray(r.review.history) ? r.review.history : [],
          }
        : null,
  };
};

const normalizeTerms = (raw: unknown): Record<string, TermState> => {
  const out: Record<string, TermState> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const r = v as Partial<TermState>;
    if (!r.known) continue; // 没标记过的不留记录，省得 localStorage 里全是空对象
    out[k] = { known: true, at: typeof r.at === 'string' ? r.at : null };
  }
  return out;
};

const normalize = (raw: unknown): Store => {
  const base = emptyStore();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Store>;
  const chapters: Record<string, ChapterState> = {};
  if (r.chapters && typeof r.chapters === 'object') {
    for (const [k, v] of Object.entries(r.chapters)) {
      chapters[k] = normalizeChapter(v);
    }
  }
  const daily: Record<string, number> = {};
  if (r.daily && typeof r.daily === 'object') {
    for (const [k, v] of Object.entries(r.daily)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === 'number' && v >= 0) {
        daily[k] = v;
      }
    }
  }
  return {
    app: APP_TAG,
    version: SCHEMA_VERSION,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : nowISO(),
    daily,
    chapters,
    terms: normalizeTerms(r.terms),
  };
};

export const load = (): Store => {
  if (cache) return cache;
  if (!available()) {
    cache = emptyStore();
    return cache;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw ? normalize(JSON.parse(raw)) : emptyStore();
  } catch {
    cache = emptyStore();
  }
  return cache;
};

export const save = (s?: Store): void => {
  const data = s || cache;
  if (!data) return;
  data.updatedAt = nowISO();
  cache = data;
  emit();
  if (!available()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* 配额满等情况：静默降级为仅内存态 */
  }
};

const emit = (): void => {
  try {
    window.dispatchEvent(new CustomEvent('ht:progress'));
  } catch {
    /* 非浏览器环境忽略 */
  }
};

/* ============================ 章节操作 ============================ */

export const CHAPTERS_KEY = 'ht:chapters-read';

/** 读出某章状态（只读，不落盘） */
export const getChapter = (id: string): ChapterState => {
  const s = load();
  return s.chapters[id] ? { ...s.chapters[id] } : emptyChapter();
};

const mutate = (
  id: string,
  fn: (c: ChapterState) => void | ChapterState
): ChapterState => {
  const s = load();
  const cur = s.chapters[id] ? { ...s.chapters[id] } : emptyChapter();
  const next = fn(cur) || cur;
  s.chapters[id] = next;
  save(s);
  return next;
};

/** 累计当日学习分钟 */
export const creditDaily = (minutes: number): void => {
  if (minutes <= 0) return;
  const s = load();
  const k = dayKey();
  s.daily[k] = (s.daily[k] || 0) + minutes;
  save(s);
};

/**
 * 记录「今天来过」。
 *
 * 为什么需要它：如果当日分钟数只由 addSeconds 跨整分钟时累加，那么一个只读了
 * 40 秒就关掉页面的访客，热力图和「活跃天数」都会是 0——这会让人以为记录丢了。
 * 所以规则定为：当天第一次打开任意章节即计 1 分钟，之后按实际停留时间继续累加。
 * 代价是每天最多多记 1 分钟，对学习热力图而言可以接受。
 */
export const touchDay = (): void => {
  const s = load();
  const k = dayKey();
  if (!(k in s.daily)) {
    s.daily[k] = 1;
    save(s);
  }
};

export const recordVisit = (id: string): ChapterState => {
  touchDay();
  return mutate(id, (c) => {
    c.visits += 1;
    c.lastVisit = nowISO();
    if (c.status === 'unread') c.status = 'reading';
  });
};

export const addSeconds = (id: string, sec: number): ChapterState => {
  const prev = getChapter(id);
  const next = mutate(id, (c) => {
    c.seconds += sec;
  });
  // 每累计满 1 分钟，给当日热力图记一笔
  const before = Math.floor(prev.seconds / 60);
  const after = Math.floor(next.seconds / 60);
  if (after > before) creditDaily(after - before);
  return next;
};

export const setScroll = (id: string, pct: number): ChapterState =>
  mutate(id, (c) => {
    c.scroll = Math.max(c.scroll, Math.max(0, Math.min(100, Math.round(pct))));
  });

export const setStatus = (id: string, status: ChapterStatus): ChapterState =>
  mutate(id, (c) => {
    c.status = status;
    if (status === 'done') {
      c.doneAt = c.doneAt || nowISO();
      if (!c.review) {
        c.review = { stage: 0, dueAt: addDays(REVIEW_INTERVALS[0]), history: [] };
      }
    } else if (status !== 'done') {
      c.doneAt = null;
    }
  });

export const toggleDone = (id: string): ChapterState => {
  const cur = getChapter(id);
  return setStatus(id, cur.status === 'done' ? 'reading' : 'done');
};

export const toggleStar = (id: string): ChapterState =>
  mutate(id, (c) => {
    c.starred = !c.starred;
  });

export const setConfidence = (id: string, value: number): ChapterState =>
  mutate(id, (c) => {
    c.confidence = Math.max(0, Math.min(5, Math.round(value)));
  });

export const recordQuiz = (
  id: string,
  qid: string,
  chosen: number,
  correct: boolean
): ChapterState =>
  mutate(id, (c) => {
    c.quizzes[qid] = { chosen, correct };
  });

/* ============================ 名词标记 ============================ */

/** 读某个名词的状态；没记录过就是未掌握 */
export const getTermState = (id: string): TermState =>
  load().terms[id] ?? { known: false, at: null };

/** 切换「已掌握」并落盘。返回切换后的状态 */
export const toggleTermKnown = (id: string): TermState => {
  const s = load();
  const cur = s.terms[id];
  const next: TermState = cur?.known
    ? { known: false, at: cur.at }
    : { known: true, at: nowISO() };
  if (next.known) s.terms[id] = next;
  else delete s.terms[id];
  save(s);
  return next;
};

/** 已经标记「已掌握」的名词 id */
export const knownTermIds = (): string[] =>
  Object.entries(load().terms)
    .filter(([, v]) => v.known)
    .map(([k]) => k);

/* ============================ 笔记 ============================ */

export const addNote = (id: string, text: string): ChapterState =>
  mutate(id, (c) => {
    const t = text.trim();
    if (!t) return;
    c.notes.push({ id: uid(), at: nowISO(), text: t });
  });

export const removeNote = (id: string, noteId: string): ChapterState =>
  mutate(id, (c) => {
    c.notes = c.notes.filter((n) => n.id !== noteId);
  });

export interface FlatNote extends Note {
  chapterId: string;
}

export const allNotes = (): FlatNote[] => {
  const s = load();
  const out: FlatNote[] = [];
  for (const [cid, c] of Object.entries(s.chapters)) {
    for (const n of c.notes) out.push({ ...n, chapterId: cid });
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
};

/* ============================ 复习队列 ============================ */

export type ReviewResult = 'good' | 'again';

/**
 * interval 制间隔重复：记得 → 档位前进；不记得 → 回到第一档。
 * 答"再想想"时把到期时间设为 10 分钟后，方便当天再刷一遍。
 */
export const gradeReview = (id: string, result: ReviewResult): ChapterState =>
  mutate(id, (c) => {
    const prevStage = c.review?.stage ?? 0;
    let stage: number;
    let dueAt: string;
    if (result === 'good') {
      stage = Math.min(prevStage + 1, REVIEW_INTERVALS.length - 1);
      dueAt = addDays(REVIEW_INTERVALS[stage]);
    } else {
      stage = 0;
      dueAt = new Date(Date.now() + 10 * 60000).toISOString();
      // 不记得说明掌握度要下调
      c.confidence = Math.max(1, c.confidence - 1);
    }
    c.review = {
      stage,
      dueAt,
      history: [
        ...(c.review?.history || []).slice(-19),
        `${dayKey()} ${result === 'good' ? '记得' : '再想想'}`,
      ],
    };
  });

export interface DueItem {
  chapterId: string;
  stage: number;
  dueAt: string;
  overdueDays: number;
}

export const dueForReview = (limit = 999): DueItem[] => {
  const s = load();
  const now = Date.now();
  const out: DueItem[] = [];
  for (const [cid, c] of Object.entries(s.chapters)) {
    if (!c.review) continue;
    const t = Date.parse(c.review.dueAt);
    if (Number.isNaN(t) || t > now) continue;
    out.push({
      chapterId: cid,
      stage: c.review.stage,
      dueAt: c.review.dueAt,
      overdueDays: Math.floor((now - t) / 86400000),
    });
  }
  return out.sort((a, b) => b.overdueDays - a.overdueDays).slice(0, limit);
};

export const upcomingReview = (limit = 999): DueItem[] => {
  const s = load();
  const now = Date.now();
  const out: DueItem[] = [];
  for (const [cid, c] of Object.entries(s.chapters)) {
    if (!c.review) continue;
    const t = Date.parse(c.review.dueAt);
    if (Number.isNaN(t) || t <= now) continue;
    out.push({
      chapterId: cid,
      stage: c.review.stage,
      dueAt: c.review.dueAt,
      overdueDays: 0,
    });
  }
  return out.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt)).slice(0, limit);
};

/* ============================ 统计 ============================ */

export interface Stats {
  totalSeconds: number;
  totalMinutes: number;
  doneCount: number;
  readingCount: number;
  starredCount: number;
  ratedCount: number;
  avgConfidence: number;
  streakDays: number;
  activeDays: number;
  todayMinutes: number;
}

export const buildStats = (): Stats => {
  const s = load();
  const vals = Object.values(s.chapters);
  const totalSeconds = vals.reduce((a, c) => a + c.seconds, 0);
  const rated = vals.filter((c) => c.confidence > 0);
  const activeDays = Object.values(s.daily).filter((m) => m > 0).length;

  // 连续学习天数：从今天往回数，遇到空档即停
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 400; i++) {
    const k = dayKey(d);
    if ((s.daily[k] || 0) > 0) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    } else if (i === 0) {
      // 今天还没学不算断，继续看昨天
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    totalSeconds,
    totalMinutes: Math.round(totalSeconds / 60),
    doneCount: vals.filter((c) => c.status === 'done').length,
    readingCount: vals.filter((c) => c.status === 'reading').length,
    starredCount: vals.filter((c) => c.starred).length,
    ratedCount: rated.length,
    avgConfidence: rated.length
      ? Math.round((rated.reduce((a, c) => a + c.confidence, 0) / rated.length) * 10) / 10
      : 0,
    streakDays: streak,
    activeDays,
    todayMinutes: s.daily[dayKey()] || 0,
  };
};

/** 最近 n 天的热力图数据（含日期与分钟数） */
export const heatmapDays = (
  days = 30
): { key: string; minutes: number; level: number }[] => {
  const s = load();
  const out: { key: string; minutes: number; level: number }[] = [];
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const k = dayKey(d);
    const m = s.daily[k] || 0;
    const level = m === 0 ? 0 : m < 5 ? 1 : m < 15 ? 2 : m < 30 ? 3 : 4;
    out.push({ key: k, minutes: m, level });
    d.setDate(d.getDate() + 1);
  }
  return out;
};

/* ============================ 导入 / 导出 ============================ */

export const exportPayload = (): string =>
  JSON.stringify(
    {
      app: APP_TAG,
      version: SCHEMA_VERSION,
      exportedAt: nowISO(),
      data: load(),
    },
    null,
    2
  );

export interface ImportResult {
  ok: boolean;
  message: string;
}

/**
 * 支持两种输入：完整导出包（含 data 字段）或裸 Store。
 * 只做合并式导入，不覆盖用户已有的其他章节记录。
 */
export const importPayload = (text: string, merge = true): ImportResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: '解析失败：不是合法的 JSON' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, message: '解析失败：内容不是对象' };
  }
  const obj = parsed as Record<string, unknown>;
  const body = (obj.data && typeof obj.data === 'object' ? obj.data : obj) as
    Record<string, unknown>;
  const incoming = normalize(body);
  const count = Object.keys(incoming.chapters).length;
  const termCount = Object.keys(incoming.terms).length;
  if (count === 0 && termCount === 0) {
    return { ok: false, message: '没有找到任何章节记录或名词标记，已忽略' };
  }

  if (merge) {
    const cur = load();
    for (const [k, v] of Object.entries(incoming.chapters)) {
      const old = cur.chapters[k];
      if (!old) {
        cur.chapters[k] = v;
        continue;
      }
      // 合并策略：取更"靠前"的状态、更长的时长、更高的滚动度，笔记去重合并
      const rank: Record<ChapterStatus, number> = { unread: 0, reading: 1, done: 2 };
      const status = rank[v.status] > rank[old.status] ? v.status : old.status;
      const noteIds = new Set(old.notes.map((n) => n.text));
      cur.chapters[k] = {
        ...old,
        status: status === 'done' ? 'done' : old.status === 'done' ? 'done' : status,
        visits: Math.max(old.visits, v.visits),
        seconds: Math.max(old.seconds, v.seconds),
        scroll: Math.max(old.scroll, v.scroll),
        confidence: Math.max(old.confidence, v.confidence),
        starred: old.starred || v.starred,
        lastVisit: old.lastVisit && v.lastVisit
          ? (old.lastVisit > v.lastVisit ? old.lastVisit : v.lastVisit)
          : old.lastVisit || v.lastVisit,
        doneAt: old.doneAt || v.doneAt,
        quizzes: { ...v.quizzes, ...old.quizzes },
        notes: [...old.notes, ...v.notes.filter((n) => !noteIds.has(n.text))],
        review: old.review || v.review,
      };
    }
    for (const [k, m] of Object.entries(incoming.daily)) {
      cur.daily[k] = Math.max(cur.daily[k] || 0, m);
    }
    // 名词标记同样是「取并集」：已掌握过就保持已掌握，别被旧备份降级
    for (const [k, v] of Object.entries(incoming.terms)) {
      const old = cur.terms[k];
      if (!old) {
        cur.terms[k] = v;
        continue;
      }
      cur.terms[k] = { known: true, at: old.at || v.at };
    }
    save(cur);
  } else {
    save(incoming);
  }
  const parts = [`${count} 章`];
  if (termCount) parts.push(`${termCount} 个名词标记`);
  return { ok: true, message: `已导入 ${parts.join(' · ')}` };
};

export const resetAll = (): void => {
  const s = emptyStore();
  cache = s;
  emit();
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
};
