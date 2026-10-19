// عميل Firestore عبر REST لقسم «الكورسات» — قراءة ديناميكية بالكامل، بلا أسماء مكتوبة يدويًا
// الصيغة: courses/{courseId} (الميتا) ← units/{unitId} ← questions/{qid} + حقل unitTest داخل الوحدة
import { FIREBASE } from '../config';
import type { CourseMeta, CourseQuestion, CourseUnit, UnitTest } from './types';

const BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/${FIREBASE.databaseId}/documents`;

export function isCoursesSyncAvailable(): boolean {
  return FIREBASE.apiKey.length > 0;
}

async function rest(path: string): Promise<any> {
  if (!isCoursesSyncAvailable()) throw new Error('مفتاح Firebase API غير مضبوط — المزامنة معطلة');
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}key=${FIREBASE.apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
  return res.json();
}

// جلب قائمة مجموعة عبر runQuery (POST) — بديل list (GET) الذي ترفضه القواعد
// path: مسار المجموعة مثل /courses أو /courses/psychiatry/units
// ملاحظة: الـparent يوضع في الـURL لا في الـbody
async function listCollection(path: string, pageSize = 300): Promise<any> {
  if (!isCoursesSyncAvailable()) throw new Error('مفتاح Firebase API غير مضبوط — المزامنة معطلة');
  const clean = path.split('?')[0].replace(/^\//, '');
  const segs = clean.split('/');
  const collectionId = segs.pop()!;
  const parentPath = segs.join('/');
  const base =
    `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}` +
    `/databases/${FIREBASE.databaseId}/documents`;
  const url = parentPath
    ? `${base}/${parentPath}:runQuery?key=${FIREBASE.apiKey}`
    : `${base}:runQuery?key=${FIREBASE.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: { from: [{ collectionId }], limit: pageSize },
    }),
  });
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
  const rows: any[] = await res.json();
  return { documents: rows.filter(r => r.document).map(r => r.document) };
}

// ─── تفكيك صيغة REST: {stringValue, integerValue, arrayValue{values[]}, mapValue{fields}, booleanValue} ───
export function parseValue(v: any): any {
  if (v === null || v === undefined) return null;
  if ('stringValue' in v) return v.stringValue ?? '';
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue === true || v.booleanValue === 'true';
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(parseValue);
  if ('mapValue' in v) {
    const out: Record<string, any> = {};
    const fields = v.mapValue.fields || {};
    for (const k of Object.keys(fields)) out[k] = parseValue(fields[k]);
    return out;
  }
  return v;
}

function docId(name: string): string {
  const parts = String(name).split('/');
  return parts[parts.length - 1];
}

function parseDoc(d: any): { id: string; [k: string]: any } {
  const out: { id: string; [k: string]: any } = { id: docId(d.name) };
  const fields = d.fields || {};
  for (const k of Object.keys(fields)) out[k] = parseValue(fields[k]);
  return out;
}

const num = (v: any, fb = 0): number => (typeof v === 'number' && !isNaN(v) ? v : fb);
const str = (v: any, fb = ''): string => (typeof v === 'string' ? v : fb);
const arr = (v: any): string[] => (Array.isArray(v) ? v.map(x => String(x)) : []);

function toQuestion(raw: any): CourseQuestion {
  const options = arr(raw.options);
  return {
    id: String(raw.id),
    text: str(raw.text),
    options,
    optionLabels: arr(raw.optionLabels).length ? arr(raw.optionLabels) : options.map((_, i) => String(i + 1)),
    correct: str(raw.correct),
    correctIndex: num(raw.correctIndex, 0),
    explanation: str(raw.explanation),
    difficulty: str(raw.difficulty),
    source: str(raw.source),
    sourceRef: str(raw.sourceRef),
    years: arr(raw.years),
    topic: str(raw.topic),
    order: num(raw.order, 0),
    keyCorrected: raw.keyCorrected === true,
    needsReview: raw.needsReview === true,
  };
}

function toUnitTest(raw: any): UnitTest | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const qs = Array.isArray(raw.questions) ? raw.questions.map(toQuestion) : [];
  if (!qs.length) return undefined;
  return {
    questions: qs.sort((a: CourseQuestion, b: CourseQuestion) => a.order - b.order),
    timeMinutes: num(raw.timeMinutes, 15),
    passThreshold: num(raw.passThreshold, 70),
  };
}

function toUnit(courseId: string, raw: any): CourseUnit {
  return {
    id: String(raw.id),
    courseId,
    order: num(raw.order, 0),
    title: str(raw.title),
    topics: arr(raw.topics),
    summary: str(raw.summary),
    questionCount: num(raw.questionCount, 0),
    unitTest: toUnitTest(raw.unitTest),
  };
}

// ─── الدوال العامة ───
export async function fetchCourses(): Promise<CourseMeta[]> {
  const data = await listCollection('/courses', 50);
  return (data.documents || []).map((d: any) => {
    const r = parseDoc(d);
    return {
      id: r.id,
      title: str(r.title, r.id),
      unitCount: num(r.unitCount, 0),
      questionCount: num(r.questionCount, 0),
      version: num(r.version, 1),
    } as CourseMeta;
  });
}

export async function fetchUnits(courseId: string): Promise<CourseUnit[]> {
  const data = await listCollection(`/courses/${courseId}/units`, 100);
  const units = (data.documents || []).map((d: any) => toUnit(courseId, parseDoc(d)));
  return units.sort((a: CourseUnit, b: CourseUnit) => a.order - b.order);
}

export async function fetchQuestions(courseId: string, unitId: string): Promise<CourseQuestion[]> {
  const out: CourseQuestion[] = [];
  // runQuery يدعم حتى 300 مستند — كافٍ لوحدات الكورس
  const data = await listCollection(`/courses/${courseId}/units/${unitId}/questions`, 300);
  for (const d of data.documents || []) out.push(toQuestion(parseDoc(d)));
  return out.sort((a, b) => a.order - b.order);
}
