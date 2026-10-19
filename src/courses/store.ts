// التخزين المحلي للكورسات (أوفلاين أولًا) — يملأ من Firestore بزر تحميل واحد
// التقدم: قراءة الخلاصة + أسئلة منجزة + درجة الاختبار لكل وحدة
import { getDB } from '../db/database';
import { fetchQuestions, fetchUnits, isCoursesSyncAvailable } from './firestore';
import type {
  CourseMeta,
  CourseQuestion,
  CourseUnit,
  UnitProgress,
  UnitStatus,
} from './types';

const COURSE_SCHEMA = `
CREATE TABLE IF NOT EXISTS course_meta (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  unit_count INTEGER DEFAULT 0,
  question_count INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  downloaded_at INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS course_units (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  ord INTEGER DEFAULT 0,
  title TEXT NOT NULL,
  topics TEXT DEFAULT '[]',
  summary TEXT DEFAULT '',
  question_count INTEGER DEFAULT 0,
  unit_test TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS course_questions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  ord INTEGER DEFAULT 0,
  text TEXT NOT NULL,
  options TEXT NOT NULL,
  option_labels TEXT NOT NULL,
  correct TEXT DEFAULT '',
  correct_index INTEGER DEFAULT 0,
  explanation TEXT DEFAULT '',
  difficulty TEXT DEFAULT '',
  source TEXT DEFAULT '',
  source_ref TEXT DEFAULT '',
  years TEXT DEFAULT '[]',
  topic TEXT DEFAULT '',
  key_corrected INTEGER DEFAULT 0,
  needs_review INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cq_unit ON course_questions(course_id, unit_id);
CREATE TABLE IF NOT EXISTS course_progress (
  unit_id TEXT PRIMARY KEY,
  summary_read INTEGER DEFAULT 0,
  questions_done INTEGER DEFAULT 0,
  questions_total INTEGER DEFAULT 0,
  test_score REAL,
  test_taken INTEGER DEFAULT 0,
  status TEXT DEFAULT 'not_started',
  updated_at INTEGER DEFAULT 0
);
`;

let schemaReady = false;
export async function ensureCourseSchema(): Promise<void> {
  if (schemaReady) return;
  const db = getDB();
  for (const stmt of COURSE_SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) {
    await db.execute(stmt);
  }
  schemaReady = true;
}

// ─── التحميل من Firestore ───
export async function downloadCourse(
  course: CourseMeta,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (!isCoursesSyncAvailable()) throw new Error('المزامنة غير متاحة — تحقق من الاتصال');
  await ensureCourseSchema();
  const db = getDB();
  const units = await fetchUnits(course.id);
  const totalSteps = units.length * 2 + 1;
  let done = 0;
  const tick = () => {
    done += 1;
    onProgress?.(done, totalSteps);
  };

  await db.execute('DELETE FROM course_questions WHERE course_id = ?', [course.id]);
  await db.execute('DELETE FROM course_units WHERE course_id = ?', [course.id]);

  for (const u of units) {
    const questions = await fetchQuestions(course.id, u.id);
    tick();
    await db.execute(
      `INSERT OR REPLACE INTO course_units (id, course_id, ord, title, topics, summary, question_count, unit_test)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        u.id, course.id, u.order, u.title,
        JSON.stringify(u.topics), u.summary, questions.length,
        JSON.stringify(u.unitTest ?? null),
      ],
    );
    for (const q of questions) {
      await db.execute(
        `INSERT OR REPLACE INTO course_questions
         (id, course_id, unit_id, ord, text, options, option_labels, correct, correct_index,
          explanation, difficulty, source, source_ref, years, topic, key_corrected, needs_review)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          q.id, course.id, u.id, q.order, q.text,
          JSON.stringify(q.options), JSON.stringify(q.optionLabels),
          q.correct, q.correctIndex, q.explanation, q.difficulty,
          q.source, q.sourceRef, JSON.stringify(q.years), q.topic,
          q.keyCorrected ? 1 : 0, q.needsReview ? 1 : 0,
        ],
      );
    }
    // تهيئة سجل التقدم للوحدة
    await db.execute(
      `INSERT OR IGNORE INTO course_progress (unit_id, questions_total, status, updated_at)
       VALUES (?, ?, 'not_started', ?)`,
      [u.id, questions.length, Date.now()],
    );
    tick();
  }

  const qTotal = units.reduce((s, u) => s + (u.questionCount || 0), 0);
  await db.execute(
    `INSERT OR REPLACE INTO course_meta (id, title, unit_count, question_count, version, downloaded_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [course.id, course.title, units.length, qTotal, course.version, Date.now()],
  );
  tick();
}

// ─── القراءة المحلية ───
export async function isCourseDownloaded(courseId: string): Promise<boolean> {
  await ensureCourseSchema();
  const db = getDB();
  const r = await db.execute('SELECT downloaded_at FROM course_meta WHERE id = ?', [courseId]);
  return Number(r.rows?.[0]?.downloaded_at || 0) > 0;
}

export async function getLocalCourses(): Promise<CourseMeta[]> {
  await ensureCourseSchema();
  const db = getDB();
  const r = await db.execute('SELECT * FROM course_meta ORDER BY title');
  return (r.rows ?? []).map((row: any) => ({
    id: String(row.id),
    title: String(row.title),
    unitCount: Number(row.unit_count || 0),
    questionCount: Number(row.question_count || 0),
    version: Number(row.version || 1),
  }));
}

export async function getLocalUnits(courseId: string): Promise<CourseUnit[]> {
  await ensureCourseSchema();
  const db = getDB();
  const r = await db.execute('SELECT * FROM course_units WHERE course_id = ? ORDER BY ord', [courseId]);
  return (r.rows ?? []).map((row: any) => ({
    id: String(row.id),
    courseId,
    order: Number(row.ord || 0),
    title: String(row.title),
    topics: safeArr(row.topics),
    summary: String(row.summary || ''),
    questionCount: Number(row.question_count || 0),
    unitTest: row.unit_test ? JSON.parse(String(row.unit_test)) : undefined,
  }));
}

export async function getLocalQuestions(courseId: string, unitId: string): Promise<CourseQuestion[]> {
  await ensureCourseSchema();
  const db = getDB();
  const r = await db.execute(
    'SELECT * FROM course_questions WHERE course_id = ? AND unit_id = ? ORDER BY ord',
    [courseId, unitId],
  );
  return (r.rows ?? []).map((row: any) => ({
    id: String(row.id),
    text: String(row.text),
    options: safeArr(row.options),
    optionLabels: safeArr(row.option_labels),
    correct: String(row.correct || ''),
    correctIndex: Number(row.correct_index || 0),
    explanation: String(row.explanation || ''),
    difficulty: String(row.difficulty || ''),
    source: String(row.source || ''),
    sourceRef: String(row.source_ref || ''),
    years: safeArr(row.years),
    topic: String(row.topic || ''),
    order: Number(row.ord || 0),
    keyCorrected: Number(row.key_corrected || 0) === 1,
    needsReview: Number(row.needs_review || 0) === 1,
  }));
}

function safeArr(v: any): string[] {
  try {
    const a = JSON.parse(String(v || '[]'));
    return Array.isArray(a) ? a.map(String) : [];
  } catch {
    return [];
  }
}

// ─── التقدم ───
export async function markSummaryRead(unitId: string): Promise<void> {
  await ensureCourseSchema();
  const db = getDB();
  await db.execute(
    `UPDATE course_progress SET summary_read = 1, updated_at = ? WHERE unit_id = ?`,
    [Date.now(), unitId],
  );
  await db.execute(
    `UPDATE course_progress SET status = 'in_progress', updated_at = ?
     WHERE unit_id = ? AND status = 'not_started'`,
    [Date.now(), unitId],
  );
}

export async function markQuestionDone(unitId: string): Promise<void> {
  await ensureCourseSchema();
  const db = getDB();
  await db.execute(
    `UPDATE course_progress
     SET questions_done = MIN(questions_done + 1, questions_total),
         status = 'in_progress', updated_at = ?
     WHERE unit_id = ? AND status != 'completed'`,
    [Date.now(), unitId],
  );
}

export async function saveTestScore(unitId: string, score: number, passThreshold: number): Promise<void> {
  await ensureCourseSchema();
  const db = getDB();
  const status: UnitStatus = score >= passThreshold ? 'completed' : 'in_progress';
  await db.execute(
    `UPDATE course_progress SET test_score = ?, test_taken = 1, status = ?, updated_at = ?
     WHERE unit_id = ?`,
    [score, status, Date.now(), unitId],
  );
}

export async function getProgressMap(courseId: string): Promise<Record<string, UnitProgress>> {
  await ensureCourseSchema();
  const db = getDB();
  const r = await db.execute(
    `SELECT p.* FROM course_progress p
     JOIN course_units u ON u.id = p.unit_id
     WHERE u.course_id = ?`,
    [courseId],
  );
  const out: Record<string, UnitProgress> = {};
  for (const row of r.rows ?? []) {
    const rid = String((row as any).unit_id);
    out[rid] = {
      unitId: rid,
      summaryRead: Number((row as any).summary_read || 0) === 1,
      questionsDone: Number((row as any).questions_done || 0),
      questionsTotal: Number((row as any).questions_total || 0),
      testScore: (row as any).test_score === null ? null : Number((row as any).test_score),
      testTaken: Number((row as any).test_taken || 0) === 1,
      status: String((row as any).status || 'not_started') as UnitProgress['status'],
      updatedAt: Number((row as any).updated_at || 0),
    };
  }
  return out;
}

// نسبة إتمام الوحدة: قراءة الخلاصة 20% + الأسئلة 50% + الاختبار 30%
export function unitProgressPct(p: UnitProgress | null, passThreshold: number): number {
  if (!p) return 0;
  if (p.status === 'completed') return 100;
  let pct = 0;
  if (p.summaryRead) pct += 20;
  if (p.questionsTotal > 0) pct += Math.round(50 * Math.min(p.questionsDone / p.questionsTotal, 1));
  if (p.testTaken && p.testScore !== null && p.testScore >= passThreshold) pct += 30;
  else if (p.testTaken) pct += 10;
  return Math.min(pct, 99);
}
