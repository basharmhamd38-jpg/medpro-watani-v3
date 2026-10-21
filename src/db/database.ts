// طبقة قاعدة البيانات المحلية المشفرة (SQLCipher عبر op-sqlite)
// المخطط: مواد ← أسئلة ← تحميلات ← حالة المزامنة ← tombstones للحذف

import { open, type DB } from '@op-engineering/op-sqlite';
import { deriveContentKey } from '../content/secureCache';

let db: DB | null = null;

// مفتاح التشفير: مشتق من معرّف التثبيت (فريد لكل جهاز) —
// نسخ ملف القاعدة لجهاز آخر لا يفتحها لاختلاف المفتاح.
// الترحيل: الأجهزة القديمة بمفتاح 'watani-sqlcipher-v1' تُرقّى تلقائيًا عبر PRAGMA rekey.
const LEGACY_KEY = 'watani-sqlcipher-v1';
let activeKey: string | null = null;

export function getDatabaseEncryptionKey(): string {
  return activeKey || LEGACY_KEY;
}

async function testKey(key: string): Promise<boolean> {
  let d: DB | null = null;
  try {
    d = open({ name: 'watani.db', encryptionKey: key });
    await d.execute('SELECT count(*) AS c FROM sqlite_master');
    return true;
  } catch {
    return false;
  } finally {
    try {
      d?.close();
    } catch { /* تجاهل */ }
  }
}

/**
 * تهيئة مفتاح القاعدة (تُستدعى مرة واحدة عند الإقلاع قبل initDatabase).
 * - تثبيت جديد: المفتاح المشتق مباشرة.
 * - تثبيت قديم: يُفتح بالمفتاح القديم ثم يُعاد التشفير بالمفتاح المشتق.
 * - عند أي فشل: يُستخدم المفتاح القديم (لا فقدان بيانات أبدًا).
 */
export async function ensureDatabaseKey(): Promise<void> {
  if (activeKey) return;
  try {
    const derived = await deriveContentKey();
    if (await testKey(derived)) {
      activeKey = derived;
      return;
    }
    if (await testKey(LEGACY_KEY)) {
      // ترقية: إعادة التشفير بالمفتاح المشتق
      let d: DB | null = null;
      try {
        d = open({ name: 'watani.db', encryptionKey: LEGACY_KEY });
        await d.execute(`PRAGMA rekey = '${derived}'`);
        await d.execute('SELECT count(*) AS c FROM sqlite_master');
        activeKey = derived;
      } catch {
        activeKey = LEGACY_KEY;
      } finally {
        try {
          d?.close();
        } catch { /* تجاهل */ }
      }
      return;
    }
    activeKey = derived;
  } catch {
    activeKey = activeKey || LEGACY_KEY;
  }
}

export function getDB(): DB {
  if (db) return db;
  db = open({
    name: 'watani.db',
    encryptionKey: getDatabaseEncryptionKey(),
  });
  return db;
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  kind TEXT NOT NULL,
  section TEXT,
  question_count INTEGER DEFAULT 0,
  downloaded INTEGER DEFAULT 0,
  updated_at INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  name TEXT NOT NULL,
  year TEXT,
  month TEXT,
  term TEXT,
  is_free INTEGER DEFAULT 0,
  question_count INTEGER DEFAULT 0,
  FOREIGN KEY(subject_id) REFERENCES subjects(id)
);
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  session_id TEXT,
  code TEXT,
  q TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_index INTEGER DEFAULT 0,
  correct_indices TEXT,
  explanation TEXT DEFAULT '',
  explanation_source TEXT DEFAULT '',
  session_label TEXT DEFAULT '',
  topic TEXT DEFAULT '',
  class_topic TEXT DEFAULT '',
  FOREIGN KEY(subject_id) REFERENCES subjects(id)
);
CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject_id);
CREATE TABLE IF NOT EXISTS flashcards (
  id TEXT PRIMARY KEY,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  subject TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS downloads (
  subject_id TEXT PRIMARY KEY,
  bytes INTEGER DEFAULT 0,
  completed_at INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sync_state (
  collection TEXT PRIMARY KEY,
  last_token TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS tombstones (
  id TEXT PRIMARY KEY,
  collection TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  deleted_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS user_progress (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS virtual_cases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  specialty TEXT DEFAULT '',
  source TEXT DEFAULT '',
  source_note TEXT DEFAULT '',
  difficulty TEXT DEFAULT 'medium',
  presentation TEXT DEFAULT '',
  history TEXT DEFAULT '[]',
  examinations TEXT DEFAULT '[]',
  tests TEXT DEFAULT '[]',
  diagnosis_options TEXT DEFAULT '[]',
  correct_diagnosis TEXT DEFAULT '',
  explanation TEXT DEFAULT '',
  learning_points TEXT DEFAULT '[]',
  xp_reward INTEGER DEFAULT 40,
  updated_at INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_virtual_cases_specialty ON virtual_cases(specialty);
`;

export async function initDatabase(): Promise<void> {
  const database = getDB();
  const statements = SCHEMA.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await database.execute(stmt);
  }
  // ترحيل: عمود تصنيف المواضيع لقواعد الأجهزة القديمة (يُبنى بـCREATE للحالات
  // الجديدة فيُبتلع خطأ التكرار هنا بصمت)
  try {
    await database.execute(
      "ALTER TABLE questions ADD COLUMN class_topic TEXT DEFAULT ''",
    );
  } catch {
    /* العمود موجود أصلًا */
  }
}
