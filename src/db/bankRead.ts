// طبقة قراءة SQLite لبنك الأسئلة — تعمل بلا إنترنت دائمًا.
//
// القاعدة: SQLite أولًا دائمًا. الشاشات تقرأ من هنا؛ وFirestore احتياطي فقط
// عند غياب البيانات محليًا (جدول فارغ)، وليس مصدرًا أساسيًا.
//
// صيغ الـids (المصدر الوحيد: src/sync/normalize.ts):
//   المواد:   bank_<sid> | dawrat_<sid> | uni_<univ>_<base> | uworld_<sid>
//   الأقسام:  <subjectId>__<sid>
//   الأسئلة:  <subjectId>__<q.id|q.code>  أو  <sessionId>#<index>
//
// كل دالة تلتقط أي فشل وتعيد قيمة افتراضية فارغة — لا استثناءات للواجهة أبدًا.
import { getDB } from './database';
import type { SubjectKind } from '../sync/normalize';

export type { SubjectKind };

export interface LocalSubject {
  id: string;
  /** من عمود name_ar */
  name: string;
  kind: SubjectKind;
  section: string;
  questionCount: number;
  downloaded: boolean;
  updatedAt: number;
}

export interface LocalSession {
  id: string;
  subjectId: string;
  name: string;
  year: string;
  month: string;
  term: string;
  isFree: boolean;
  questionCount: number;
}

export interface LocalQuestion {
  id: string;
  subjectId: string;
  sessionId: string;
  code: string;
  /** نص السؤال (من عمود q) — نفس قيمة q */
  text: string;
  q: string;
  options: string[];
  correctIndex: number;
  /** alias لتوافق قراءات seed.ts القديمة (q?.correct_index) */
  correct_index: number;
  correctIndices: number[];
  explanation: string;
  explanationSource: string;
  sessionLabel: string;
  topic: string;
  /** موضوع التصنيف الطرفي (عرض «حسب المواضيع» لبنك الوطني) — '' عند غيابه */
  classTopic: string;
}

export interface LocalTopic {
  topic: string;
  count: number;
}

export interface LocalUniversity {
  /** معرف الجامعة المستخرج من بادئة id المادة: uni_<univ>_<base> */
  id: string;
  name: string;
  /** مجموع أسئلة موادها — null تعني «قيد التجهيز» (بلا أسئلة بعد) */
  count: number | null;
}

export interface QuestionCounts {
  total: number;
  byKind: Record<SubjectKind, number>;
}

// ─── أدوات داخلية ───

function parseJsonArray(raw: any): string[] {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

function parseJsonNumberArray(raw: any, fallback: number[]): number[] {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(v)) {
      const nums = v.map((n) => Number(n)).filter((n) => Number.isInteger(n));
      return nums.length > 0 ? nums : fallback;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function num(v: any, fb = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function str(v: any, fb = ''): string {
  return v === null || v === undefined ? fb : String(v);
}

/** تحويل صف questions خام إلى كائن سؤال — خالص وقابل للاختبار */
export function parseLocalQuestion(row: any): LocalQuestion {
  const r = row && typeof row === 'object' ? row : {};
  const options = parseJsonArray(r.options);
  let correctIndex = num(r.correct_index, 0);
  if (options.length > 0) correctIndex = Math.min(Math.max(correctIndex, 0), options.length - 1);
  const correctIndices = parseJsonNumberArray(r.correct_indices, [correctIndex]);
  const q = str(r.q);
  return {
    id: str(r.id),
    subjectId: str(r.subject_id),
    sessionId: str(r.session_id),
    code: str(r.code),
    text: q,
    q,
    options,
    correctIndex,
    correct_index: correctIndex,
    correctIndices,
    explanation: str(r.explanation),
    explanationSource: str(r.explanation_source),
    sessionLabel: str(r.session_label),
    topic: str(r.topic),
    classTopic: str(r.class_topic),
  };
}

function toLocalSubject(row: any): LocalSubject {
  const r = row && typeof row === 'object' ? row : {};
  return {
    id: str(r.id),
    name: str(r.name_ar),
    kind: (r.kind === 'dawrat' || r.kind === 'university' || r.kind === 'uworld'
      ? r.kind
      : 'bank') as SubjectKind,
    section: str(r.section),
    questionCount: num(r.question_count),
    downloaded: num(r.downloaded) === 1,
    updatedAt: num(r.updated_at),
  };
}

function toLocalSession(row: any): LocalSession {
  const r = row && typeof row === 'object' ? row : {};
  return {
    id: str(r.id),
    subjectId: str(r.subject_id),
    name: str(r.name),
    year: str(r.year),
    month: str(r.month),
    term: str(r.term),
    isFree: num(r.is_free) === 1,
    questionCount: num(r.question_count),
  };
}

/** استخراج معرف الجامعة من id مادة جامعية: uni_<univ>_<base> */
export function univIdOfSubjectId(subjectId: string): string | null {
  const m = /^uni_([^_]+)_/.exec(String(subjectId || ''));
  return m ? m[1] : null;
}

const UNIV_AR_NAMES: Record<string, string> = {
  damascus: 'جامعة دمشق',
  hama: 'جامعة حماة',
  tishreen: 'جامعة اللاذقية',
  aleppo: 'جامعة حلب',
  homs: 'جامعة حمص',
};

async function select<T>(sql: string, params: any[], map: (row: any) => T): Promise<T[]> {
  try {
    const db = getDB();
    const r = await db.execute(sql, params);
    const rows = r.rows || [];
    return rows.map(map);
  } catch {
    return [];
  }
}

// ─── الدوال العامة ───

/** مواد بنك الأسئلة/الدورات/الجامعات مرتبة بالاسم العربي */
export async function getBankSubjects(kind: SubjectKind): Promise<LocalSubject[]> {
  return select(
    `SELECT id, name_ar, kind, section, question_count, downloaded, updated_at
     FROM subjects WHERE kind = ? ORDER BY name_ar`,
    [kind],
    toLocalSubject,
  );
}

/** أقسام/جلسات مادة — الأحدث أولًا (year تنازليًا ثم الاسم) */
export async function getSubjectSessions(subjectId: string): Promise<LocalSession[]> {
  return select(
    `SELECT id, subject_id, name, year, month, term, is_free, question_count
     FROM sessions WHERE subject_id = ? ORDER BY year DESC, name ASC`,
    [subjectId],
    toLocalSession,
  );
}

/** أسئلة جلسة/قسم محدد */
export async function getSessionQuestions(
  subjectId: string,
  sessionId: string,
): Promise<LocalQuestion[]> {
  return select(
    `SELECT id, subject_id, session_id, code, q, options, correct_index, correct_indices,
            explanation, explanation_source, session_label, topic, class_topic
     FROM questions WHERE subject_id = ? AND session_id = ? ORDER BY rowid`,
    [subjectId, sessionId],
    parseLocalQuestion,
  );
}

/** كل أسئلة مادة (لشاشة السؤال) — limit افتراضي 2000 لمنع إغراق الذاكرة */
export async function getSubjectQuestions(
  subjectId: string,
  limit = 2000,
): Promise<LocalQuestion[]> {
  const lim = Number.isInteger(limit) && limit > 0 ? ` LIMIT ${limit}` : '';
  return select(
    `SELECT id, subject_id, session_id, code, q, options, correct_index, correct_indices,
            explanation, explanation_source, session_label, topic, class_topic
     FROM questions WHERE subject_id = ? ORDER BY rowid${lim}`,
    [subjectId],
    parseLocalQuestion,
  );
}

/** أسئلة موضوع محدد داخل مادة */
export async function getTopicQuestions(
  subjectId: string,
  topic: string,
  limit = 2000,
): Promise<LocalQuestion[]> {
  const lim = Number.isInteger(limit) && limit > 0 ? ` LIMIT ${limit}` : '';
  return select(
    `SELECT id, subject_id, session_id, code, q, options, correct_index, correct_indices,
            explanation, explanation_source, session_label, topic, class_topic
     FROM questions WHERE subject_id = ? AND topic = ? ORDER BY rowid${lim}`,
    [subjectId, topic],
    parseLocalQuestion,
  );
}

/** مواضيع التصنيف الطرفية لمادة (عرض «حسب المواضيع») مع الأعداد — الأكثر أولًا */
export async function getSubjectClassTopics(subjectId: string): Promise<LocalTopic[]> {
  return select(
    `SELECT class_topic AS topic, COUNT(*) AS count FROM questions
     WHERE subject_id = ? AND class_topic != '' GROUP BY class_topic ORDER BY count DESC`,
    [subjectId],
    (r: any) => ({ topic: str(r.topic), count: num(r.count) }),
  );
}

/** أسئلة موضوع تصنيف طرفي محدد داخل مادة (عرض «حسب المواضيع») */
export async function getClassTopicQuestions(
  subjectId: string,
  classTopic: string,
  limit = 2000,
): Promise<LocalQuestion[]> {
  const lim = Number.isInteger(limit) && limit > 0 ? ` LIMIT ${limit}` : '';
  return select(
    `SELECT id, subject_id, session_id, code, q, options, correct_index, correct_indices,
            explanation, explanation_source, session_label, topic, class_topic
     FROM questions WHERE subject_id = ? AND class_topic = ? ORDER BY rowid${lim}`,
    [subjectId, classTopic],
    parseLocalQuestion,
  );
}

/** مواضيع المادة مع أعداد الأسئلة (الأكثر أولًا) */
export async function getSubjectTopics(subjectId: string): Promise<LocalTopic[]> {
  return select(
    `SELECT topic, COUNT(*) AS count FROM questions
     WHERE subject_id = ? AND topic != '' GROUP BY topic ORDER BY count DESC`,
    [subjectId],
    (r: any) => ({ topic: str(r.topic), count: num(r.count) }),
  );
}

/** إحصائيات الأعداد: الإجمالي + التوزيع حسب النوع */
export async function getQuestionCounts(): Promise<QuestionCounts> {
  const empty: QuestionCounts = {
    total: 0,
    byKind: { bank: 0, dawrat: 0, university: 0, uworld: 0 },
  };
  try {
    const db = getDB();
    const t = await db.execute('SELECT COUNT(*) AS c FROM questions', []);
    const total = num((t.rows || [])[0]?.c);
    const g = await db.execute(
      `SELECT s.kind AS kind, COUNT(*) AS c FROM questions q
       JOIN subjects s ON s.id = q.subject_id GROUP BY s.kind`,
      [],
    );
    const byKind = { ...empty.byKind };
    for (const row of g.rows || []) {
      const k = str((row as any).kind);
      if (k === 'bank' || k === 'dawrat' || k === 'university' || k === 'uworld') {
        byKind[k] = num((row as any).c);
      }
    }
    return { total, byKind };
  } catch {
    return empty;
  }
}

/** قائمة الجامعات المستنتجة من مواد kind='university' (الأكثر أسئلة أولًا) */
export async function getLocalUniversities(): Promise<LocalUniversity[]> {
  try {
    const rows = await select(
      `SELECT id, name_ar, question_count FROM subjects WHERE kind = 'university'`,
      [],
      (r: any) => ({
        id: str(r.id),
        nameAr: str(r.name_ar),
        count: num(r.question_count),
      }),
    );
    const byUniv = new Map<string, { name: string; count: number }>();
    for (const r of rows) {
      const u = univIdOfSubjectId(r.id);
      if (!u) continue;
      const cur = byUniv.get(u) || { name: UNIV_AR_NAMES[u] || u, count: 0 };
      cur.count += r.count;
      byUniv.set(u, cur);
    }
    return [...byUniv.entries()]
      .map(([id, v]) => ({ id, name: v.name, count: v.count > 0 ? v.count : null }))
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
  } catch {
    return [];
  }
}

/** مواد جامعة محددة (univId مثل 'damascus') */
export async function getUniversitySubjects(univId: string): Promise<LocalSubject[]> {
  const clean = String(univId || '').replace(/[%_]/g, '');
  if (!clean) return [];
  return select(
    `SELECT id, name_ar, kind, section, question_count, downloaded, updated_at
     FROM subjects WHERE kind = 'university' AND id LIKE ? ORDER BY name_ar`,
    [`uni_${clean}_%`],
    toLocalSubject,
  );
}

// ─── محوّلات لشكل كائنات الواجهة (مطابقة لأشكال src/bank/firestore.ts) ───

export interface BankSubjectShape {
  id: string;
  name: string;
  order: number;
  questionCount: number | null;
}

export interface BankSessionShape {
  id: string;
  name: string;
  year: number | null;
  questionCount: number | null;
}

export interface BankQuestionShape {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export function toBankSubject(s: LocalSubject, order = 999): BankSubjectShape {
  return {
    id: s.id,
    name: s.name,
    order,
    questionCount: s.questionCount > 0 ? s.questionCount : null,
  };
}

export function toBankSession(s: LocalSession): BankSessionShape {
  const y = parseInt(s.year, 10);
  return {
    id: s.id,
    name: s.name,
    year: Number.isFinite(y) ? y : null,
    questionCount: s.questionCount > 0 ? s.questionCount : null,
  };
}

export function toBankQuestion(q: LocalQuestion): BankQuestionShape {
  return {
    id: q.id,
    text: q.text,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
  };
}
