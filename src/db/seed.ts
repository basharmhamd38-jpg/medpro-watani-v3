// تحميل البيانات المضمّنة إلى القاعدة المشفرة (أول تشغيل)
// البنوك الكاملة تأتي لاحقًا من Firestore (الماستر) عبر زر «تحميل المادة».

import { getDB } from './database';

// نطلب الملفات صراحةً ليضمّنها Metro في الحزمة
const NT_MANIFEST = require('../assets/data/nt_manifest.json');
const CHUNKS: Record<string, any[]> = {
  'nt_00_00.json': require('../assets/data/nt_00_00.json'),
  'nt_00_01.json': require('../assets/data/nt_00_01.json'),
  'nt_00_02.json': require('../assets/data/nt_00_02.json'),
  'nt_00_03.json': require('../assets/data/nt_00_03.json'),
};

const SEEDED_KEY = 'seeded_v1';

export interface SeedStats {
  subjects: number;
  questions: number;
}

export async function isSeeded(): Promise<boolean> {
  const db = getDB();
  const r = await db.execute('SELECT value FROM user_progress WHERE key = ?', [SEEDED_KEY]);
  return (r.rows?.length || 0) > 0;
}

export async function seedBundledData(): Promise<SeedStats> {
  const db = getDB();
  if (await isSeeded()) return { subjects: 0, questions: 0 };

  let qCount = 0;
  const subjects = NT_MANIFEST.subjects || {};

  await db.execute('BEGIN');
  try {
    let si = 0;
    for (const [name, meta] of Object.entries<any>(subjects)) {
      const sid = `nt_${si++}`;
      await db.execute(
        'INSERT OR REPLACE INTO subjects (id, name_ar, kind, question_count, downloaded, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [sid, name, 'watani', meta.questions || 0, 0, Date.now()]
      );
      const chunks: string[] = meta.chunks || [];
      for (const chunkFile of chunks) {
        const list: any[] = CHUNKS[chunkFile] || [];
        for (const q of list) {
          await db.execute(
            `INSERT OR REPLACE INTO questions
             (id, subject_id, session_id, code, q, options, correct_index, correct_indices, explanation, explanation_source, session_label, topic)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              q.questionId || q.code,
              sid,
              q.sessionId || '',
              q.code || '',
              q.text || '',
              JSON.stringify(q.options || []),
              typeof q.correctIndex === 'number' ? q.correctIndex : 0,
              JSON.stringify(q.correctIndices || [q.correctIndex || 0]),
              q.explanation || '',
              q.explanationSource || '',
              q.sessionLabel || '',
              q.category || '',
            ]
          );
          qCount++;
        }
      }
    }
    await db.execute('INSERT OR REPLACE INTO user_progress (key, value) VALUES (?, ?)', [SEEDED_KEY, '1']);
    await db.execute('COMMIT');
  } catch (e) {
    await db.execute('ROLLBACK');
    throw e;
  }
  return { subjects: Object.keys(subjects).length, questions: qCount };
}

// جلب أسئلة مادة من القاعدة المحلية
export async function getQuestionsForSubject(subjectId: string, limit = 500): Promise<any[]> {
  const db = getDB();
  const r = await db.execute('SELECT * FROM questions WHERE subject_id = ? LIMIT ?', [subjectId, limit]);
  return (r.rows || []).map((row: any) => ({
    ...row,
    options: JSON.parse(row.options || '[]'),
    correctIndices: JSON.parse(row.correct_indices || '[]'),
  }));
}

export async function getSubjects(kind?: string): Promise<any[]> {
  const db = getDB();
  const r = kind
    ? await db.execute('SELECT * FROM subjects WHERE kind = ? ORDER BY name_ar', [kind])
    : await db.execute('SELECT * FROM subjects ORDER BY name_ar');
  return r.rows ? [...r.rows] : [];
}

// مواضيع المادة (من عمود topic — يُبنى من Firestore لاحقًا)
export async function getTopicsForSubject(subjectId: string): Promise<{ topic: string; count: number }[]> {
  const db = getDB();
  const r = await db.execute(
    "SELECT topic, COUNT(*) as count FROM questions WHERE subject_id = ? AND topic != '' GROUP BY topic ORDER BY count DESC",
    [subjectId]
  );
  return (r.rows || []).map((row: any) => ({
    topic: String(row.topic),
    count: Number(row.count) || 0,
  }));
}

// أسئلة موضوع محدد داخل مادة
export async function getQuestionsForTopic(subjectId: string, topic: string, limit = 500): Promise<any[]> {
  const db = getDB();
  const r = await db.execute('SELECT * FROM questions WHERE subject_id = ? AND topic = ? LIMIT ?', [subjectId, topic, limit]);
  return (r.rows || []).map((row: any) => ({
    ...row,
    options: JSON.parse(row.options || '[]'),
    correctIndices: JSON.parse(row.correct_indices || '[]'),
  }));
}
