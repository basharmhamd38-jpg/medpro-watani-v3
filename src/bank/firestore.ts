// طبقة بيانات بنك الأسئلة — قراءة ديناميكية من Firestore عبر REST (runQuery POST)
// القواعد ترفض الـGET المباشر (list)، لذا كل القراءات عبر runQuery كما في courses/firestore.ts.
//
// البنية الحقيقية (قاعدة ai-studio-nationalexamapp-330e566e-ddc6-4e62-86a9-8009ee9cde64):
//   sources/dawrat_watani/subjects/{subjectId}/sessions/{sessionId}/questions
//     الحقول: text, options[], correctIndices[], explanation, code, qtype
//   sources/dawrat_jami3at/universities/{univId}/subjects/{subjectId}/topics/{topicId}/questions
//     ملاحظة: الجامعات لا تملك مستوى sessions — المستوى الوسيط هو topics (مواضيع)
//     بتنظيم order، والأسئلة فيه تحمل correct كحرف (أ/ب/ج...) مع optionLabels.
//     دوال fetchUnivSessions/fetchUnivQuestions تعمل على هذا المستوى الوسيط فعليًا.
//
// كل دالة عامة تلتقط أي فشل وتُعيد مصفوفة فارغة — لا رمي استثناءات للواجهة.
import { FIREBASE } from '../config';
import { parseValue } from '../courses/firestore';
import { fetchWithQuota } from '../content/quotaGuard';

export { parseValue };

export interface BankSubject {
  id: string;
  name: string;
  order: number;
  questionCount: number | null;
}

export interface BankSession {
  id: string;
  name: string;
  year: number | null;
  questionCount: number | null;
}

export interface BankQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

function docId(name: string): string {
  const parts = String(name).split('/');
  return parts[parts.length - 1];
}

const num = (v: any, fb: number | null = null): number | null =>
  typeof v === 'number' && !isNaN(v) ? v : fb;
const str = (v: any, fb = ''): string => (typeof v === 'string' ? v : fb);
const arr = (v: any): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);

/**
 * runQuery عبر POST — parentPath تُرمَّز مقاطعها (قد تحوي أسماء عربية كمعرفات).
 * مهلة 15s + حارس الحصة (fetchWithQuota) — لا تعليق أبدًا ولا ضرب متكرر عند 429.
 */
async function runQuery(
  parentPath: string,
  collectionId: string,
  pageSize = 300,
  orderBy?: { fieldPath: string; direction: 'ASCENDING' | 'DESCENDING' },
): Promise<any[]> {
  const encoded = parentPath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  const url =
    `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}` +
    `/databases/${FIREBASE.databaseId}/documents/${encoded}:runQuery?key=${FIREBASE.apiKey}`;
  // مهلة 15 ثانية (AbortController — نمط الدوال الشقيقة) + حارس الحصة:
  // تراجع أسّي عند 429، وكسر دائرة بعد 3 متتالية (تُتخطَّى الشبكة 5 دقائق).
  // عند التبريد يُرمى QuotaExhaustedError («الحصة مستنفدة مؤقتًا») —
  // يلتقطه safe() فيُعيد []، وللواجهة: isSourceBlocked('firestore') من quotaGuard.
  const res = await fetchWithQuota(
    'firestore',
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          ...(orderBy
            ? { orderBy: [{ field: { fieldPath: orderBy.fieldPath }, direction: orderBy.direction }] }
            : {}),
          limit: pageSize,
        },
      }),
    },
    { timeoutMs: 15000 },
  );
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
  const rows: any[] = await res.json();
  return rows.filter((r) => r.document).map((r) => r.document);
}

/** مغلّف أمان: بلا مفتاح API أو عند أي فشل تُعاد مصفوفة فارغة — لا استثناءات للواجهة */
async function safe<T>(fn: () => Promise<T[]>): Promise<T[]> {
  if (FIREBASE.apiKey.length === 0) return [];
  try {
    return await fn();
  } catch {
    return [];
  }
}

function toSubject(d: any): BankSubject {
  const f = d.fields || {};
  const name = parseValue(f.name);
  return {
    id: docId(d.name),
    name: str(name, docId(d.name)),
    order: (num(parseValue(f.order), 999) as number) ?? 999,
    questionCount: num(parseValue(f.questionCount)),
  };
}

function toSession(d: any): BankSession {
  const f = d.fields || {};
  const name = parseValue(f.name);
  return {
    id: docId(d.name),
    name: str(name, docId(d.name)),
    year: num(parseValue(f.year)),
    questionCount: num(parseValue(f.questionCount)),
  };
}

const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'];

function toQuestion(d: any): BankQuestion {
  const f = d.fields || {};
  const options = arr(parseValue(f.options));
  // الإجابة الصحيحة: إما correctIndices[] (نمط الوطني) أو correct كحرف (نمط الجامعات)
  let correctIndex = 0;
  const ci = parseValue(f.correctIndices);
  if (Array.isArray(ci) && ci.length > 0 && typeof ci[0] === 'number') {
    correctIndex = ci[0];
  } else {
    const correctLetter = str(parseValue(f.correct));
    const labels = arr(parseValue(f.optionLabels));
    const byLabels = labels.length === options.length ? labels.indexOf(correctLetter) : -1;
    const byLetters = byLabels < 0 ? LETTERS.indexOf(correctLetter) : -1;
    correctIndex = byLabels >= 0 ? byLabels : byLetters >= 0 ? byLetters : 0;
  }
  if (correctIndex < 0 || correctIndex >= options.length) correctIndex = 0;
  return {
    id: docId(d.name),
    text: str(parseValue(f.text)),
    options,
    correctIndex,
    explanation: str(parseValue(f.explanation)),
  };
}

// ─── الدورات الوطنية ───
// الأولوية الآن: Firestore (الأساسي — لوحة المالك تكتب هنا مباشرة).
// Cloudflare احتياطي عند فشل Firestore. بلا تعقيد: تحرير اللوحة يظهر فورًا.

import { getRemoteContentVersion, setLocalContentVersion } from '../content/contentVersion';

/** بعد جلب ناجح من Firestore: سجّل الإصدار البعيد كـ"محلي" */
async function markVersionSynced(): Promise<void> {
  try {
    const v = await getRemoteContentVersion();
    if (v) await setLocalContentVersion(v);
  } catch {
    /* تجاهل */
  }
}

function cdnDawratToQuestion(raw: any, idx: number): BankQuestion | null {
  try {
    const text = String(raw.text || raw.q || '');
    if (!text) return null;
    let options: string[] = [];
    if (Array.isArray(raw.options)) options = raw.options.map((o: any) => String(typeof o === 'string' ? o : o?.text || o));
    else if (raw.options && typeof raw.options === 'object') options = Object.values(raw.options).map((o: any) => String(o));
    if (options.length === 0) return null;
    let correctIndex = 0;
    const ci = raw.correctIndices;
    if (Array.isArray(ci) && typeof ci[0] === 'number') correctIndex = ci[0];
    else if (typeof raw.correctIndex === 'number') correctIndex = raw.correctIndex;
    else if (typeof raw.correct === 'number') correctIndex = raw.correct;
    else if (typeof raw.correct === 'string') {
      const labels: string[] = Array.isArray(raw.optionLabels) ? raw.optionLabels : [];
      const byLabels = labels.indexOf(raw.correct);
      const byLetters = byLabels < 0 ? LETTERS.indexOf(raw.correct) : -1;
      correctIndex = byLabels >= 0 ? byLabels : byLetters >= 0 ? byLetters : 0;
    }
    if (correctIndex < 0 || correctIndex >= options.length) correctIndex = 0;
    return {
      id: String(raw.id || raw.code || `dq_${idx}`),
      text,
      options,
      correctIndex,
      explanation: String(raw.explanation || ''),
    };
  } catch {
    return null;
  }
}

/** جلسات/مواضيع مادة الدورات من بيانات الـCDN — متسامح مع sessions/topics */
function cdnDawratSessions(data: any): { id: string; name: string; year: number | null; questionCount: number | null; questions: any[] }[] {
  const list = Array.isArray(data?.sessions) ? data.sessions : Array.isArray(data?.topics) ? data.topics : [];
  return list.map((s: any, i: number) => ({
    id: String(s.id || s.name || `s${i}`),
    name: String(s.name || s.id || ''),
    year: typeof s.year === 'number' ? s.year : null,
    questionCount: Array.isArray(s.questions) ? s.questions.length : null,
    questions: Array.isArray(s.questions) ? s.questions : [],
  }));
}

async function tryCdnDawratSubjects(): Promise<BankSubject[] | null> {
  try {
    const { getDawratSubjects } = await import('../content/cloudflare');
    const subs = await getDawratSubjects();
    if (subs.length === 0) return null;
    return subs.map((s, i) => ({ id: s.id, name: s.name, order: i, questionCount: s.count || null }));
  } catch {
    return null;
  }
}

async function tryCdnDawratSessions(subjectId: string): Promise<BankSession[] | null> {
  try {
    const { getDawratSubjects, getDawratSubjectData } = await import('../content/cloudflare');
    const subs = await getDawratSubjects();
    const meta = subs.find((s) => s.id === subjectId || s.name === subjectId);
    if (!meta) return null;
    const data = await getDawratSubjectData(meta.file);
    if (!data) return null;
    const sessions = cdnDawratSessions(data);
    if (sessions.length === 0) return null;
    return sessions
      .map((s) => ({ id: s.id, name: s.name, year: s.year, questionCount: s.questionCount }))
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.name.localeCompare(b.name, 'ar'));
  } catch {
    return null;
  }
}

async function tryCdnDawratQuestions(subjectId: string, sessionId: string): Promise<BankQuestion[] | null> {
  try {
    const { getDawratSubjects, getDawratSubjectData } = await import('../content/cloudflare');
    const subs = await getDawratSubjects();
    const meta = subs.find((s) => s.id === subjectId || s.name === subjectId);
    if (!meta) return null;
    const data = await getDawratSubjectData(meta.file);
    if (!data) return null;
    const sessions = cdnDawratSessions(data);
    const sess = sessions.find((s) => s.id === sessionId || s.name === sessionId);
    if (!sess || sess.questions.length === 0) return null;
    return sess.questions
      .map((q: any, i: number) => cdnDawratToQuestion(q, i))
      .filter((q: BankQuestion | null): q is BankQuestion => q !== null);
  } catch {
    return null;
  }
}

export async function fetchWataniSubjects(): Promise<BankSubject[]> {
  // 1) Firestore (الأساسي)
  const fs = await safe(async () => {
    const docs = await runQuery('sources/dawrat_watani', 'subjects', 50, {
      fieldPath: 'order',
      direction: 'ASCENDING',
    });
    const out = docs.map(toSubject);
    return out.sort((a, b) => a.order - b.order);
  });
  if (fs.length > 0) {
    markVersionSynced().catch(() => {});
    return fs;
  }
  // 2) Cloudflare (احتياطي)
  const cdn = await tryCdnDawratSubjects().catch(() => null);
  return cdn ?? [];
}

export async function fetchWataniSessions(subjectId: string): Promise<BankSession[]> {
  // 1) Firestore (الأساسي)
  const fs = await safe(async () => {
    const docs = await runQuery(`sources/dawrat_watani/subjects/${subjectId}`, 'sessions', 100);
    const out = docs.map(toSession);
    // الأحدث أولًا — year تنازليًا ثم الاسم
    return out.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.name.localeCompare(b.name, 'ar'));
  });
  if (fs.length > 0) {
    markVersionSynced().catch(() => {});
    return fs;
  }
  // 2) Cloudflare (احتياطي)
  const cdn = await tryCdnDawratSessions(subjectId).catch(() => null);
  return cdn ?? [];
}

export async function fetchWataniQuestions(
  subjectId: string,
  sessionId: string,
): Promise<BankQuestion[]> {
  // 1) Firestore (الأساسي)
  const fs = await safe(async () => {
    const docs = await runQuery(
      `sources/dawrat_watani/subjects/${subjectId}/sessions/${sessionId}`,
      'questions',
      500,
    );
    return docs.map(toQuestion);
  });
  if (fs.length > 0) {
    markVersionSynced().catch(() => {});
    return fs;
  }
  // 2) Cloudflare (احتياطي)
  const cdn = await tryCdnDawratQuestions(subjectId, sessionId).catch(() => null);
  return cdn ?? [];
}

// ─── دورات الجامعات ───
// ملاحظة: الجامعات تنظّم أسئلتها تحت مستوى «topics» (مواضيع) لا «sessions» —
// الدوال التالية تعمل على ذلك المستوى الوسيط بنفس العقود المتفق عليها.
// الأولوية: Firestore (الأساسي) ← Cloudflare (احتياطي: dawrat_jami3at/<univId>/).

async function tryCdnUnivSubjects(univId: string): Promise<BankSubject[] | null> {
  try {
    const { getUnivSubjects } = await import('../content/cloudflare');
    const subs = await getUnivSubjects(univId);
    if (subs.length === 0) return null;
    return subs.map((s, i) => ({ id: s.id, name: s.name, order: i, questionCount: s.count || null }));
  } catch {
    return null;
  }
}

async function tryCdnUnivSessions(univId: string, subjectId: string): Promise<BankSession[] | null> {
  try {
    const { getUnivSubjects, getUnivSubjectData } = await import('../content/cloudflare');
    const subs = await getUnivSubjects(univId);
    const meta = subs.find((s) => s.id === subjectId || s.name === subjectId);
    if (!meta) return null;
    const data = await getUnivSubjectData(meta.file);
    if (!data) return null;
    const sessions = cdnDawratSessions(data);
    if (sessions.length === 0) return null;
    return sessions
      .map((s) => ({ id: s.id, name: s.name, year: s.year, questionCount: s.questionCount }))
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.name.localeCompare(b.name, 'ar'));
  } catch {
    return null;
  }
}

async function tryCdnUnivQuestions(
  univId: string,
  subjectId: string,
  sessionId: string,
): Promise<BankQuestion[] | null> {
  try {
    const { getUnivSubjects, getUnivSubjectData } = await import('../content/cloudflare');
    const subs = await getUnivSubjects(univId);
    const meta = subs.find((s) => s.id === subjectId || s.name === subjectId);
    if (!meta) return null;
    const data = await getUnivSubjectData(meta.file);
    if (!data) return null;
    const sessions = cdnDawratSessions(data);
    const sess = sessions.find((s) => s.id === sessionId || s.name === sessionId);
    if (!sess || sess.questions.length === 0) return null;
    return sess.questions
      .map((q: any, i: number) => cdnDawratToQuestion(q, i))
      .filter((q: BankQuestion | null): q is BankQuestion => q !== null);
  } catch {
    return null;
  }
}

export async function fetchUnivSubjects(univId: string): Promise<BankSubject[]> {
  // 1) Firestore (الأساسي)
  const fs = await safe(async () => {
    const docs = await runQuery(`sources/dawrat_jami3at/universities/${univId}`, 'subjects', 100, {
      fieldPath: 'order',
      direction: 'ASCENDING',
    });
    const out = docs.map(toSubject);
    return out.sort((a, b) => a.order - b.order);
  });
  if (fs.length > 0) return fs;
  // 2) Cloudflare (احتياطي)
  const cdn = await tryCdnUnivSubjects(univId).catch(() => null);
  return cdn ?? [];
}

export async function fetchUnivSessions(
  univId: string,
  subjectId: string,
): Promise<BankSession[]> {
  // 1) Firestore (الأساسي)
  const fs = await safe(async () => {
    const docs = await runQuery(
      `sources/dawrat_jami3at/universities/${univId}/subjects/${subjectId}`,
      'topics',
      200,
      { fieldPath: 'order', direction: 'ASCENDING' },
    );
    const out = docs.map(toSession);
    return out.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.name.localeCompare(b.name, 'ar'));
  });
  if (fs.length > 0) return fs;
  // 2) Cloudflare (احتياطي)
  const cdn = await tryCdnUnivSessions(univId, subjectId).catch(() => null);
  return cdn ?? [];
}

export async function fetchUnivQuestions(
  univId: string,
  subjectId: string,
  sessionId: string,
): Promise<BankQuestion[]> {
  // 1) Firestore (الأساسي)
  const fs = await safe(async () => {
    const docs = await runQuery(
      `sources/dawrat_jami3at/universities/${univId}/subjects/${subjectId}/topics/${sessionId}`,
      'questions',
      1000,
    );
    return docs.map(toQuestion);
  });
  if (fs.length > 0) return fs;
  // 2) Cloudflare (احتياطي)
  const cdn = await tryCdnUnivQuestions(univId, subjectId, sessionId).catch(() => null);
  return cdn ?? [];
}
