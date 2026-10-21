// طبقة بيانات البنوك / الحالات السريرية / النماذج التدريبية
// القاعدة: SQLite المحلية أولًا (أوفلاين دائمًا) ← Cloudflare CDN احتياطي
// Firestore مهجورة نهائيًا — لا تُقرأ أبدًا.
// fetchUWorld* = بنك الوطني (questions/ shards)؛ fetchRealUWorld* = بنك UWorld
// الحقيقي (uworld/ shards) — تبويبان مستقلان منذ 21 أكتوبر 2026.

import { getContent, getQuestionsIndex, getQuestionShard, getUWorldBankIndex } from '../content/cloudflare';
import {
  getBankSubjects,
  getSubjectTopics,
  getTopicQuestions,
  getSubjectQuestions,
  getSubjectClassTopics,
  getClassTopicQuestions,
  type LocalQuestion,
} from '../db/bankRead';
import { classTopicOf } from '../sync/normalize';

// ذاكرة الجلسة — 60 ثانية
const MEM_TTL_MS = 60_000;
interface MemEntry<T> { at: number; data: T; }
let memUWorldSubjects: MemEntry<QuizSubject[]> | null = null;
const memUWorldTopics = new Map<string, MemEntry<QuizTopic[]>>();
const memUWorldQuestions = new Map<string, MemEntry<QuizQuestion[]>>();
const inFlightUWorldTopics = new Map<string, Promise<QuizTopic[]>>();
const inFlightUWorldQuestions = new Map<string, Promise<QuizQuestion[]>>();

export interface QuizSubject {
  id: string;
  name: string;
  order: number;
  questionCount: number | null;
  topicCount: number | null;
}

export interface QuizTopic {
  id: string;
  name: string;
  order: number;
  questionCount: number | null;
}

export interface QuizOption {
  letter: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: QuizOption[];
  correctIndex: number;
  explanation: string;
  n: number | null;
}

/** أيقونة المادة حسب الاسم */
export function subjectIcon(name: string): string {
  if (!name) return '📚';
  if (name.includes('قلب')) return '🫀';
  if (name.includes('صدر') || name.includes('تنفس')) return '🌬️';
  if (name.includes('هضم') || name.includes('كبد')) return '🧬';
  if (name.includes('عصب')) return '🧠';
  if (name.includes('كل') || name.includes('بول')) return '💧';
  if (name.includes('غدد') || name.includes('صم') || name.includes('استقلاب')) return '⚡';
  if (name.includes('دم') || name.includes('أورام')) return '🩸';
  if (name.includes('إنتان') || name.includes('خمج') || name.includes('جراثيم')) return '🦠';
  if (name.includes('رثو') || name.includes('مفاص') || name.includes('مناع')) return '🦴';
  if (name.includes('طفل') || name.includes('أطفال') || name.includes('وليد')) return '👶';
  if (name.includes('جراح')) return '🏥';
  if (name.includes('نسا') || name.includes('توليد') || name.includes('حمل')) return '🌸';
  if (name.includes('نفس')) return '🧩';
  if (name.includes('عين')) return '👁️';
  if (name.includes('جلد')) return '🛡️';
  if (name.includes('أذن') || name.includes('أنف') || name.includes('حنجر')) return '👂';
  return '📚';
}

/** توحيد صيغ الخيارات */
export function parseQuizOptions(raw: any, optionLabels?: string[]): QuizOption[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((opt, idx) => {
      const defaultLetter =
        (optionLabels && optionLabels[idx]) || String.fromCharCode(65 + idx);
      if (typeof opt === 'object' && opt !== null) {
        const letter = opt.letter || opt.label || opt.key || defaultLetter;
        const text = opt.text || opt.value || opt.title || '';
        return {
          letter: String(letter).trim().toUpperCase(),
          text: String(text).trim(),
        };
      }
      return { letter: String(defaultLetter).trim().toUpperCase(), text: String(opt ?? '').trim() };
    });
  }
  if (typeof raw === 'object') {
    const keys = Object.keys(raw).sort();
    return keys.map((key, idx) => {
      const val = raw[key];
      const text =
        typeof val === 'object' && val !== null
          ? val.text || val.value || ''
          : String(val ?? '');
      const letter = String(key || String.fromCharCode(65 + idx)).trim().toUpperCase();
      return { letter, text: String(text).trim() };
    });
  }
  return [];
}

const AR_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'];

/** مطابقة الجواب الخام مع الخيارات */
export function resolveCorrectIndex(
  options: QuizOption[],
  rawCorrect: any,
  optionLabels?: string[],
): number {
  const n = options.length;
  if (n === 0) return 0;
  const clamp = (i: number) => (i >= 0 && i < n ? i : 0);
  if (rawCorrect === null || rawCorrect === undefined) return 0;
  if (typeof rawCorrect === 'number') return clamp(rawCorrect);
  const s = String(rawCorrect).trim();
  if (s === '') return 0;
  const upper = s.toUpperCase();
  if (!isNaN(Number(s))) {
    const v = Number(s);
    if (Number.isInteger(v)) return clamp(v);
  }
  if (optionLabels && optionLabels.length === n) {
    const li = optionLabels.findIndex(
      (l) => String(l).trim().toUpperCase() === upper || String(l).trim() === s,
    );
    if (li !== -1) return clamp(li);
  }
  const letterIdx = options.findIndex((o) => o.letter.toUpperCase() === upper);
  if (letterIdx !== -1) return clamp(letterIdx);
  const arIdx = AR_LETTERS.indexOf(s);
  if (arIdx !== -1) return clamp(arIdx);
  if (upper.length === 1 && upper >= 'A' && upper <= 'Z') {
    return clamp(upper.charCodeAt(0) - 65);
  }
  const textIdx = options.findIndex((o) => o.text.toLowerCase() === s.toLowerCase());
  if (textIdx !== -1) return clamp(textIdx);
  return 0;
}

/** تحويل سؤال محلي (SQLite) إلى QuizQuestion */
function localToQuiz(q: LocalQuestion): QuizQuestion {
  const options: QuizOption[] = (q.options || []).map((text, i) => ({
    letter: String.fromCharCode(65 + i),
    text: String(text),
  }));
  return {
    id: q.id,
    text: q.text || q.q,
    options,
    correctIndex: Math.max(0, Math.min(q.correctIndex ?? 0, Math.max(0, options.length - 1))),
    explanation: q.explanation || '',
    n: null,
  };
}

/** تحليل سؤال من صيغة CDN إلى QuizQuestion */
function cdnToQuestion(raw: any): QuizQuestion | null {
  try {
    if (!raw || typeof raw.text !== 'string' || raw.text.length === 0) return null;
    const optionLabels = Array.isArray(raw.optionLabels)
      ? raw.optionLabels.map((x: any) => String(x))
      : undefined;
    const options = parseQuizOptions(raw.options, optionLabels);
    if (options.length === 0) return null;
    const correctIndex = resolveCorrectIndex(options, raw.correct, optionLabels);
    return {
      id: String(raw.id || ''),
      text: String(raw.text),
      options,
      correctIndex,
      explanation: String(raw.explanation || ''),
      n: null,
    };
  } catch {
    return null;
  }
}

// ─── UWorld (بنك الوطني) — SQLite أولًا ← Cloudflare احتياطي ───

/** مواد UWorld من SQLite المحلية */
async function fetchUWorldSubjectsFromLocal(): Promise<QuizSubject[] | null> {
  try {
    const subs = await getBankSubjects('bank');
    if (subs.length === 0) return null;
    return subs.map((s, i) => ({
      id: s.id,
      name: s.name,
      order: i,
      questionCount: s.questionCount,
      topicCount: null,
    }));
  } catch {
    return null;
  }
}

/** جلب شجرة UWorld من الـCDN */
async function getUWorldTree(): Promise<any[] | null> {
  try {
    const index = await getQuestionsIndex();
    if (index && index.shards.length > 0) {
      return index.shards.map((s, i) => ({
        id: s.subject_id,
        name: s.subject_name,
        order: i,
        questionCount: s.count,
        topicCount: null,
        __shardFile: s.file,
      }));
    }
    return null;
  } catch {
    return null;
  }
}

/** مواد UWorld من الـCDN (احتياطي) */
async function fetchUWorldSubjectsFromCdn(): Promise<QuizSubject[] | null> {
  const tree = await getUWorldTree();
  if (!tree) return null;
  return tree.map((s: any, i: number) => ({
    id: String(s.id || ''),
    name: String(s.name || ''),
    order: i,
    questionCount: typeof s.questionCount === 'number' ? s.questionCount : null,
    topicCount: null,
  }));
}

let inFlightUWorldSubjects: Promise<QuizSubject[]> | null = null;

export async function fetchUWorldSubjects(): Promise<QuizSubject[]> {
  if (memUWorldSubjects && Date.now() - memUWorldSubjects.at < MEM_TTL_MS) {
    return memUWorldSubjects.data;
  }
  if (inFlightUWorldSubjects) return inFlightUWorldSubjects;
  const p: Promise<QuizSubject[]> = (async () => {
    // 1) SQLite المحلية (أوفلاين)
    const local = await fetchUWorldSubjectsFromLocal().catch(() => null);
    if (local && local.length > 0) {
      memUWorldSubjects = { at: Date.now(), data: local };
      return local;
    }
    // 2) Cloudflare (احتياطي — يتطلب إنترنت)
    const cdn = await fetchUWorldSubjectsFromCdn().catch(() => null);
    const out = cdn ?? [];
    memUWorldSubjects = { at: Date.now(), data: out };
    return out;
  })().finally(() => {
    inFlightUWorldSubjects = null;
  });
  inFlightUWorldSubjects = p;
  return p;
}

/** مواضيع مادة من SQLite المحلية */
async function fetchUWorldTopicsFromLocal(subjectId: string): Promise<QuizTopic[] | null> {
  try {
    const topics = await getSubjectTopics(subjectId);
    if (topics.length === 0) return null;
    return topics.map((t, i) => ({
      id: t.topic,
      name: t.topic,
      order: i,
      questionCount: t.count,
    }));
  } catch {
    return null;
  }
}

/** شارد مادة UWorld من الـCDN */
async function getUWorldShard(subjectId: string, shardFile?: string): Promise<any | null> {
  try {
    if (shardFile) return await getQuestionShard(shardFile);
    const index = await getQuestionsIndex();
    const sh = index?.shards.find(s => s.subject_id === subjectId || s.subject_name === subjectId);
    if (sh) return await getQuestionShard(sh.file);
    return null;
  } catch {
    return null;
  }
}

/** مواضيع مادة UWorld من الـCDN (احتياطي) */
async function fetchUWorldTopicsFromCdn(subjectId: string): Promise<QuizTopic[] | null> {
  const tree = await getUWorldTree();
  if (!tree) return null;
  const subj = tree.find((s: any) => String(s.id) === subjectId || String(s.name) === subjectId);
  const shard = await getUWorldShard(subjectId, subj?.__shardFile);
  const topics = Array.isArray(shard?.topics) ? shard.topics : [];
  if (topics.length === 0) return null;
  return topics.map((t: any, i: number) => ({
    id: String(t.id || t.name || ''),
    name: String(t.name || ''),
    order: i,
    questionCount: Array.isArray(t.questions) ? t.questions.length : null,
  }));
}

export async function fetchUWorldTopics(subjectId: string): Promise<QuizTopic[]> {
  const mem = memUWorldTopics.get(subjectId);
  if (mem && Date.now() - mem.at < MEM_TTL_MS) return mem.data;
  const inFlight = inFlightUWorldTopics.get(subjectId);
  if (inFlight) return inFlight;
  const p: Promise<QuizTopic[]> = (async () => {
    // 1) SQLite المحلية (أوفلاين)
    const local = await fetchUWorldTopicsFromLocal(subjectId).catch(() => null);
    if (local && local.length > 0) {
      memUWorldTopics.set(subjectId, { at: Date.now(), data: local });
      return local;
    }
    // 2) Cloudflare (احتياطي)
    const cdn = await fetchUWorldTopicsFromCdn(subjectId).catch(() => null);
    const out = cdn ?? [];
    memUWorldTopics.set(subjectId, { at: Date.now(), data: out });
    return out;
  })().finally(() => {
    inFlightUWorldTopics.delete(subjectId);
  });
  inFlightUWorldTopics.set(subjectId, p);
  return p;
}

/** أسئلة موضوع من SQLite المحلية */
async function fetchUWorldQuestionsFromLocal(
  subjectId: string,
  topicId: string,
): Promise<QuizQuestion[] | null> {
  try {
    const qs = await getTopicQuestions(subjectId, topicId);
    if (qs.length === 0) return null;
    return qs.map(localToQuiz).filter((q) => q.text.length > 0 && q.options.length > 0);
  } catch {
    return null;
  }
}

/** أسئلة موضوع UWorld من الـCDN (احتياطي) */
async function fetchUWorldQuestionsFromCdn(
  subjectId: string,
  topicId: string,
): Promise<QuizQuestion[] | null> {
  const tree = await getUWorldTree();
  if (!tree) return null;
  const subj = tree.find((s: any) => String(s.id) === subjectId || String(s.name) === subjectId);
  const shard = await getUWorldShard(subjectId, subj?.__shardFile);
  const topic = Array.isArray(shard?.topics)
    ? shard.topics.find((t: any) => String(t.id) === topicId || String(t.name) === topicId)
    : null;
  const rawQuestions = Array.isArray(topic?.questions) ? topic.questions : [];
  if (rawQuestions.length === 0) return null;
  const out = rawQuestions
    .map(cdnToQuestion)
    .filter((q: QuizQuestion | null): q is QuizQuestion => q !== null);
  return out.length > 0 ? out : null;
}

export async function fetchUWorldQuestions(subjectId: string, topicId: string): Promise<QuizQuestion[]> {
  const key = `${subjectId}__${topicId}`;
  const mem = memUWorldQuestions.get(key);
  if (mem && Date.now() - mem.at < MEM_TTL_MS) return mem.data;
  const inFlight = inFlightUWorldQuestions.get(key);
  if (inFlight) return inFlight;
  const p: Promise<QuizQuestion[]> = (async () => {
    // 1) SQLite المحلية (أوفلاين)
    const local = await fetchUWorldQuestionsFromLocal(subjectId, topicId).catch(() => null);
    if (local && local.length > 0) {
      memUWorldQuestions.set(key, { at: Date.now(), data: local });
      return local;
    }
    // 2) Cloudflare (احتياطي)
    const cdn = await fetchUWorldQuestionsFromCdn(subjectId, topicId).catch(() => null);
    const out = cdn ?? [];
    memUWorldQuestions.set(key, { at: Date.now(), data: out });
    return out;
  })().finally(() => {
    inFlightUWorldQuestions.delete(key);
  });
  inFlightUWorldQuestions.set(key, p);
  return p;
}

// ─── بنك الوطني «حسب المواضيع» — مواضيع التصنيف الطرفية من سلاسل الأسئلة ───

const memClassTopics = new Map<string, MemEntry<QuizTopic[]>>();
const memClassQuestions = new Map<string, MemEntry<QuizQuestion[]>>();
const inFlightClassTopics = new Map<string, Promise<QuizTopic[]>>();
const inFlightClassQuestions = new Map<string, Promise<QuizQuestion[]>>();

/** مواضيع التصنيف لمادة من SQLite المحلية */
async function fetchBankClassTopicsFromLocal(subjectId: string): Promise<QuizTopic[] | null> {
  try {
    const topics = await getSubjectClassTopics(subjectId);
    if (topics.length === 0) return null;
    return topics.map((t, i) => ({
      id: t.topic,
      name: t.topic,
      order: i,
      questionCount: t.count,
    }));
  } catch {
    return null;
  }
}

/** شارد المادة من الـCDN عبر شجرة الفهرس (نفس مسار احتياطي UWorld) */
async function getBankShardViaTree(subjectId: string): Promise<any | null> {
  const tree = await getUWorldTree();
  if (!tree) return null;
  const subj = tree.find((s: any) => String(s.id) === subjectId || String(s.name) === subjectId);
  return getUWorldShard(subjectId, subj?.__shardFile);
}

/** مواضيع التصنيف لمادة من الـCDN (احتياطي): تجميع الأوراق من أسئلة الشارد */
async function fetchBankClassTopicsFromCdn(subjectId: string): Promise<QuizTopic[] | null> {
  const shard = await getBankShardViaTree(subjectId).catch(() => null);
  if (!shard) return null;
  const counts = new Map<string, number>();
  for (const sec of Array.isArray(shard.topics) ? shard.topics : []) {
    for (const q of Array.isArray(sec?.questions) ? sec.questions : []) {
      const leaf = classTopicOf(q);
      if (!leaf) continue;
      counts.set(leaf, (counts.get(leaf) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count], i) => ({ id: name, name, order: i, questionCount: count }));
}

// كاش مواضيع/أسئلة التصنيف يعيش عمر الجلسة (إصلاح تجميد وضع المواضيع):
// TTL الـ60 ثانية القديم كان يعيد مسح شارد الـCDN الكامل عند كل فتح بعد دقيقة.
const CLASS_MEM_TTL_MS = 24 * 60 * 60_000;

/**
 * إبطال كاش التصنيف — يُستدعى عند اكتمال تحميل قسم بنك الوطني:
 * فرع «محلي بلا تصنيف» يخزّن [] للجلسة، فبلا إبطال تبقى المواضيع مخفية
 * حتى إعادة تشغيل التطبيق إن نُشر التصنيف وحُمّل القسم بنفس الجلسة
 * (ملاحظة المشرف الخبير على c8e5fb0).
 */
export function invalidateBankClassCaches(): void {
  memClassTopics.clear();
  memClassQuestions.clear();
  inFlightClassTopics.clear();
  inFlightClassQuestions.clear();
}

export async function fetchBankClassTopics(subjectId: string): Promise<QuizTopic[]> {
  const mem = memClassTopics.get(subjectId);
  if (mem && Date.now() - mem.at < CLASS_MEM_TTL_MS) return mem.data;
  const inFlight = inFlightClassTopics.get(subjectId);
  if (inFlight) return inFlight;
  const p: Promise<QuizTopic[]> = (async () => {
    const local = await fetchBankClassTopicsFromLocal(subjectId).catch(() => null);
    if (local && local.length > 0) {
      memClassTopics.set(subjectId, { at: Date.now(), data: local });
      return local;
    }
    // المادة محمّلة محليًا لكن بلا مواضيع تصنيف (class_topic فارغ بنيويًا):
    // مسح شارد الـCDN سيعيد الفراغ نفسه (نفس دالة التصنيف عند الإدخال) —
    // نعيد [] بلا مسح ونخزّنها للجلسة حتى لا يتكرر الفحص عند كل فتح.
    const hasLocal = await getSubjectQuestions(subjectId, 1).catch(() => []);
    if (hasLocal.length > 0) {
      memClassTopics.set(subjectId, { at: Date.now(), data: [] });
      return [];
    }
    const cdn = await fetchBankClassTopicsFromCdn(subjectId).catch(() => null);
    const out = cdn ?? [];
    // الفراغ العابر (لا محلي ولا CDN) لا يُخزَّن — قد يمتلئ بعد تحميل القسم
    if (out.length > 0) memClassTopics.set(subjectId, { at: Date.now(), data: out });
    return out;
  })().finally(() => {
    inFlightClassTopics.delete(subjectId);
  });
  inFlightClassTopics.set(subjectId, p);
  return p;
}

/** أسئلة موضوع تصنيف من SQLite المحلية */
async function fetchBankClassQuestionsFromLocal(
  subjectId: string,
  classTopic: string,
): Promise<QuizQuestion[] | null> {
  try {
    const qs = await getClassTopicQuestions(subjectId, classTopic);
    if (qs.length === 0) return null;
    return qs.map(localToQuiz).filter((q) => q.text.length > 0 && q.options.length > 0);
  } catch {
    return null;
  }
}

/** أسئلة موضوع تصنيف من الـCDN (احتياطي) */
async function fetchBankClassQuestionsFromCdn(
  subjectId: string,
  classTopic: string,
): Promise<QuizQuestion[] | null> {
  const shard = await getBankShardViaTree(subjectId).catch(() => null);
  if (!shard) return null;
  const out: QuizQuestion[] = [];
  for (const sec of Array.isArray(shard.topics) ? shard.topics : []) {
    for (const raw of Array.isArray(sec?.questions) ? sec.questions : []) {
      if (classTopicOf(raw) !== classTopic) continue;
      const q = cdnToQuestion(raw);
      if (q) out.push(q);
    }
  }
  return out.length > 0 ? out : null;
}

export async function fetchBankClassQuestions(
  subjectId: string,
  classTopic: string,
): Promise<QuizQuestion[]> {
  const key = `class__${subjectId}__${classTopic}`;
  const mem = memClassQuestions.get(key);
  if (mem && Date.now() - mem.at < CLASS_MEM_TTL_MS) return mem.data;
  const inFlight = inFlightClassQuestions.get(key);
  if (inFlight) return inFlight;
  const p: Promise<QuizQuestion[]> = (async () => {
    const local = await fetchBankClassQuestionsFromLocal(subjectId, classTopic).catch(() => null);
    if (local && local.length > 0) {
      memClassQuestions.set(key, { at: Date.now(), data: local });
      return local;
    }
    // نفس منطق المواضيع: مادة محمّلة محليًا بلا أسئلة لهذا التصنيف = فراغ بنيوي،
    // مسح الشارد الكامل من الـCDN يعيد النتيجة نفسها — لا نمسح.
    const hasLocal = await getSubjectQuestions(subjectId, 1).catch(() => []);
    if (hasLocal.length > 0) {
      memClassQuestions.set(key, { at: Date.now(), data: [] });
      return [];
    }
    const cdn = await fetchBankClassQuestionsFromCdn(subjectId, classTopic).catch(() => null);
    const out = cdn ?? [];
    if (out.length > 0) memClassQuestions.set(key, { at: Date.now(), data: out });
    return out;
  })().finally(() => {
    inFlightClassQuestions.delete(key);
  });
  inFlightClassQuestions.set(key, p);
  return p;
}

/** كل أسئلة المادة دفعة واحدة */
export async function fetchUWorldSubjectPool(subjectId: string): Promise<QuizQuestion[]> {
  const topics = await fetchUWorldTopics(subjectId);
  const lists = await Promise.all(
    topics.map((t) => fetchUWorldQuestions(subjectId, t.id).catch(() => [] as QuizQuestion[])),
  );
  const seen = new Set<string>();
  const out: QuizQuestion[] = [];
  for (const q of lists.flat()) {
    const id = String(q?.id ?? '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(q);
  }
  return out;
}

// ─── بنك UWorld الحقيقي (uworld/ shards) — تبويب مستقل عن بنك الوطني ───
// نفس نمط طبقة الوطني: SQLite أولًا ← CDN احتياطي، بمعرّفات محلية uworld_<sid>
// تُبنى أيضًا بمسار الـCDN حتى تتطابق الصيغ بين المصدرين.

let memRealUWorldSubjects: MemEntry<QuizSubject[]> | null = null;
const memRealUWorldTopics = new Map<string, MemEntry<QuizTopic[]>>();
const memRealUWorldQuestions = new Map<string, MemEntry<QuizQuestion[]>>();
const inFlightRealTopics = new Map<string, Promise<QuizTopic[]>>();
const inFlightRealQuestions = new Map<string, Promise<QuizQuestion[]>>();
let inFlightRealSubjects: Promise<QuizSubject[]> | null = null;

const realSidOf = (subjectId: string) => subjectId.replace(/^uworld_/, '');

async function getRealUWorldShard(subjectId: string): Promise<any | null> {
  try {
    const index = await getUWorldBankIndex();
    const sh = index?.shards.find(
      (s) => s.subject_id === realSidOf(subjectId) || s.subject_name === subjectId,
    );
    if (sh) return await getQuestionShard(sh.file);
    return null;
  } catch {
    return null;
  }
}

export async function fetchRealUWorldSubjects(): Promise<QuizSubject[]> {
  if (memRealUWorldSubjects && Date.now() - memRealUWorldSubjects.at < MEM_TTL_MS) {
    return memRealUWorldSubjects.data;
  }
  if (inFlightRealSubjects) return inFlightRealSubjects;
  const p: Promise<QuizSubject[]> = (async () => {
    try {
      const subs = await getBankSubjects('uworld');
      if (subs.length > 0) {
        const out = subs.map((s, i) => ({
          id: s.id,
          name: s.name,
          order: i,
          questionCount: s.questionCount,
          topicCount: null,
        }));
        memRealUWorldSubjects = { at: Date.now(), data: out };
        return out;
      }
    } catch {
      /* سقوط للـCDN */
    }
    try {
      const index = await getUWorldBankIndex();
      if (index && index.shards.length > 0) {
        const out = index.shards.map((s, i) => ({
          id: `uworld_${s.subject_id}`,
          name: s.subject_name,
          order: i,
          questionCount: s.count,
          topicCount: null,
        }));
        memRealUWorldSubjects = { at: Date.now(), data: out };
        return out;
      }
    } catch {
      /* تجاهل */
    }
    return [];
  })().finally(() => {
    inFlightRealSubjects = null;
  });
  inFlightRealSubjects = p;
  return p;
}

export async function fetchRealUWorldTopics(subjectId: string): Promise<QuizTopic[]> {
  const mem = memRealUWorldTopics.get(subjectId);
  if (mem && Date.now() - mem.at < MEM_TTL_MS) return mem.data;
  const inFlight = inFlightRealTopics.get(subjectId);
  if (inFlight) return inFlight;
  const p: Promise<QuizTopic[]> = (async () => {
    const local = await fetchUWorldTopicsFromLocal(subjectId).catch(() => null);
    if (local && local.length > 0) {
      memRealUWorldTopics.set(subjectId, { at: Date.now(), data: local });
      return local;
    }
    const shard = await getRealUWorldShard(subjectId);
    const topics = Array.isArray(shard?.topics) ? shard.topics : [];
    const out = topics.map((t: any, i: number) => ({
      id: String(t.id || t.name || ''),
      name: String(t.name || ''),
      order: i,
      questionCount: Array.isArray(t.questions) ? t.questions.length : null,
    }));
    if (out.length > 0) memRealUWorldTopics.set(subjectId, { at: Date.now(), data: out });
    return out;
  })().finally(() => {
    inFlightRealTopics.delete(subjectId);
  });
  inFlightRealTopics.set(subjectId, p);
  return p;
}

export async function fetchRealUWorldQuestions(
  subjectId: string,
  topicId: string,
): Promise<QuizQuestion[]> {
  const key = `${subjectId}__${topicId}`;
  const mem = memRealUWorldQuestions.get(key);
  if (mem && Date.now() - mem.at < MEM_TTL_MS) return mem.data;
  const inFlight = inFlightRealQuestions.get(key);
  if (inFlight) return inFlight;
  const p: Promise<QuizQuestion[]> = (async () => {
    const local = await fetchUWorldQuestionsFromLocal(subjectId, topicId).catch(() => null);
    if (local && local.length > 0) {
      memRealUWorldQuestions.set(key, { at: Date.now(), data: local });
      return local;
    }
    const shard = await getRealUWorldShard(subjectId);
    const topic = Array.isArray(shard?.topics)
      ? shard.topics.find((t: any) => String(t.id) === topicId || String(t.name) === topicId)
      : null;
    const rawQuestions = Array.isArray(topic?.questions) ? topic.questions : [];
    const out = rawQuestions
      .map(cdnToQuestion)
      .filter((q: QuizQuestion | null): q is QuizQuestion => q !== null);
    if (out.length > 0) memRealUWorldQuestions.set(key, { at: Date.now(), data: out });
    return out;
  })().finally(() => {
    inFlightRealQuestions.delete(key);
  });
  inFlightRealQuestions.set(key, p);
  return p;
}

/** كل أسئلة مادة UWorld الحقيقي دفعة واحدة (للمذاكرة الحرة) */
export async function fetchRealUWorldSubjectPool(subjectId: string): Promise<QuizQuestion[]> {
  const topics = await fetchRealUWorldTopics(subjectId);
  const lists = await Promise.all(
    topics.map((t) => fetchRealUWorldQuestions(subjectId, t.id).catch(() => [] as QuizQuestion[])),
  );
  const seen = new Set<string>();
  const out: QuizQuestion[] = [];
  for (const q of lists.flat()) {
    const id = String(q?.id ?? '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(q);
  }
  return out;
}

// ─── الحالات السريرية — من Cloudflare cases.json ───
// الصيغة تفاعلية (مريض افتراضي) — نحوّل كل حالة إلى سؤال تشخيصي Q&A:
// «ما التشخيص؟» + خيارات التشخيص + الجواب الصحيح + الشرح.

interface CdnCase {
  id?: string;
  title?: string;
  specialty?: string;
  presentation?: string;
  diagnosisOptions?: string[];
  correctDiagnosis?: string;
  explanation?: string;
}

let memCases: MemEntry<CdnCase[]> | null = null;

async function getCases(): Promise<CdnCase[]> {
  if (memCases && Date.now() - memCases.at < MEM_TTL_MS) return memCases.data;
  try {
    const { data } = await getContent('cases');
    const list: CdnCase[] = Array.isArray((data as any)?.cases) ? (data as any).cases : [];
    if (list.length > 0) {
      memCases = { at: Date.now(), data: list };
      return list;
    }
  } catch { /* أكمل لـSQLite */ }
  // احتياطي: جدول virtual_cases في SQLite (يُملأ عند أول تشغيل)
  try {
    const { getDB } = await import('../db/database');
    const db = getDB();
    const res = await db.execute(
      'SELECT id, title, specialty, presentation, diagnosis_options, correct_diagnosis, explanation FROM virtual_cases',
      []
    );
    const rows = (res.rows || []) as any[];
    if (rows.length > 0) {
      const list: CdnCase[] = rows.map((r: any) => {
        let opts: string[] = [];
        try { opts = JSON.parse(r.diagnosis_options || '[]'); } catch { /* */ }
        return {
          id: String(r.id || ''),
          title: String(r.title || ''),
          specialty: String(r.specialty || 'عام'),
          presentation: String(r.presentation || ''),
          diagnosisOptions: opts.map(String),
          correctDiagnosis: String(r.correct_diagnosis || ''),
          explanation: String(r.explanation || ''),
        };
      });
      memCases = { at: Date.now(), data: list };
      return list;
    }
  } catch { /* */ }
  return [];
}

function caseToQuiz(c: CdnCase, idx: number): QuizQuestion | null {
  const opts = (c.diagnosisOptions || []).filter((o) => String(o).trim().length > 0);
  if (opts.length < 2) return null;
  const correct = String(c.correctDiagnosis || '').trim();
  const options: QuizOption[] = opts.map((text, i) => ({
    letter: String.fromCharCode(65 + i),
    text: String(text),
  }));
  let correctIndex = options.findIndex((o) => o.text.trim() === correct);
  if (correctIndex < 0) correctIndex = 0;
  return {
    id: String(c.id || `case-${idx}`),
    text: String(c.presentation || c.title || ''),
    options,
    correctIndex,
    explanation: String(c.explanation || ''),
    n: null,
  };
}

export async function fetchClinicalSubjects(): Promise<QuizSubject[]> {
  const cases = await getCases().catch(() => [] as CdnCase[]);
  const bySpec = new Map<string, number>();
  for (const c of cases) {
    const s = String(c.specialty || 'عام').trim() || 'عام';
    bySpec.set(s, (bySpec.get(s) || 0) + 1);
  }
  return [...bySpec.entries()].map(([name, count], i) => ({
    id: name,
    name,
    order: i,
    questionCount: count,
    topicCount: 1,
  }));
}

export async function fetchClinicalTopics(subjectId: string): Promise<QuizTopic[]> {
  const cases = await getCases().catch(() => [] as CdnCase[]);
  const count = cases.filter((c) => String(c.specialty || 'عام').trim() === subjectId).length;
  if (count === 0) return [];
  return [{ id: subjectId, name: subjectId, order: 0, questionCount: count }];
}

export async function fetchClinicalQuestions(
  subjectId: string,
  _topicId: string,
): Promise<QuizQuestion[]> {
  const cases = await getCases().catch(() => [] as CdnCase[]);
  return cases
    .filter((c) => String(c.specialty || 'عام').trim() === subjectId)
    .map(caseToQuiz)
    .filter((q): q is QuizQuestion => q !== null && q.text.length > 0);
}

// ─── النماذج التدريبية ───
// المصدر: Cloudflare — v1/practice_models/index.json + v1/practice_models/{id}.json
// تُحمَّل مرة واحدة وتُخزَّن مشفّرة للعمل أوفلاين
const PRACTICE_MODELS_URL = 'https://watani-content.pages.dev/v1/practice_models';
const PM_INDEX_CACHE_KEY = 'pm_index';
const PM_MODEL_CACHE_PREFIX = 'pm_model_';

async function getCachedOrFetch(key: string, url: string): Promise<any | null> {
  try {
    const { secureGet, secureSet } = await import('../content/secureCache');
    // 1) الكاش المشفّر أولًا (أوفلاين)
    try {
      const cached = await secureGet(key);
      if (cached) {
        // تحديث صامت بالخلفية
        fetch(url).then(r => r.ok ? r.json() : null)
          .then(d => { if (d) secureSet(key, d).catch(() => {}); })
          .catch(() => {});
        return cached;
      }
    } catch { /* أكمل للشبكة */ }
    // 2) الشبكة + تخزين
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    await secureSet(key, data).catch(() => {});
    return data;
  } catch {
    return null;
  }
}

export async function fetchPracticeModels(): Promise<QuizSubject[]> {
  try {
    const idx = await getCachedOrFetch(PM_INDEX_CACHE_KEY, `${PRACTICE_MODELS_URL}/index.json`);
    if (!idx) return [];
    return (idx as any[]).map((m, i) => ({
      id: String(m.model_id),
      name: String(m.model_name),
      order: i,
      questionCount: Number(m.count) || 0,
      topicCount: null,
    }));
  } catch {
    return [];
  }
}

export async function fetchPracticeQuestions(modelId: string): Promise<QuizQuestion[]> {
  try {
    const doc = await getCachedOrFetch(`${PM_MODEL_CACHE_PREFIX}${modelId}`, `${PRACTICE_MODELS_URL}/${modelId}.json`);
    if (!doc) return [];
    const qs = (doc.questions || []) as any[];
    const AR = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
    return qs
      .map((q) => {
        const opts: string[] = (q.options || []).map(String);
        const labels: string[] = (q.optionLabels || []).map(String);
        let correctIndex = 0;
        const c = String(q.correct || '');
        const li = labels.indexOf(c);
        if (li >= 0) correctIndex = li;
        else {
          const ai = AR.indexOf(c);
          if (ai >= 0 && ai < opts.length) correctIndex = ai;
        }
        return {
          id: String(q.id),
          text: String(q.text || ''),
          options: opts.map((t, j) => ({ letter: labels[j] || AR[j] || String(j + 1), text: t })),
          correctIndex,
          explanation: String(q.explanation || ''),
          n: Number(q.n) || null,
        };
      })
      .filter((q) => q.text.length > 0 && q.options.length > 0)
      .sort((a, b) => (a.n ?? 0) - (b.n ?? 0));
  } catch {
    return [];
  }
}
