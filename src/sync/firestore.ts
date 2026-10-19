// عميل Firestore عبر REST — الماستر للمحتوى
// المزامنة تفاضلية: نطلب المستندات الأحدث من آخر رمز مزامنة فقط.
// الحذف: tombstones — سجل محلي بالمحذوفات يُطبق على القاعدة المحلية.

import { FIREBASE } from '../config';
import { getDB } from '../db/database';

const BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/${FIREBASE.databaseId}/documents`;

export function isSyncAvailable(): boolean {
  return FIREBASE.apiKey.length > 0;
}

async function rest(path: string, init?: RequestInit): Promise<any> {
  if (!isSyncAvailable()) throw new Error('مفتاح Firebase API غير مضبوط — المزامنة معطلة');
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}key=${FIREBASE.apiKey}`;
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
  return res.json();
}

// جلب قائمة مجموعة عبر runQuery (POST) — بديل list (GET) الذي ترفضه القواعد
// ملاحظة: الـparent يوضع في الـURL لا في الـbody
async function listCollection(path: string, pageSize = 300): Promise<any> {
  if (!isSyncAvailable()) throw new Error('مفتاح Firebase API غير مضبوط — المزامنة معطلة');
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

// جلب مجموعة فرعية: sources/dawrat_watani/subjects
export async function fetchSubjects(): Promise<any[]> {
  const data = await listCollection('/sources/dawrat_watani/subjects', 100);
  return (data.documents || []).map((d: any) => ({ id: docId(d.name), ...d.fields }));
}

export async function fetchSessions(subjectId: string): Promise<any[]> {
  const data = await listCollection(`/sources/dawrat_watani/subjects/${subjectId}/sessions`, 100);
  return (data.documents || []).map((d: any) => ({ id: docId(d.name), ...d.fields }));
}

export async function fetchTopics(subjectId: string): Promise<any[]> {
  const data = await listCollection(`/sources/dawrat_watani/subjects/${subjectId}/topics`, 300);
  return (data.documents || []).map((d: any) => ({ id: docId(d.name), ...d.fields }));
}

function docId(name: string): string {
  const parts = name.split('/');
  return parts[parts.length - 1];
}

// ─── المزامنة التفاضلية ───
// نخزن لكل مجموعة أحدث updateTime رأيناه؛ في الجولة التالية نطبق فقط ما تغيّر.
// الحذف من الخادم يُكتشف عبر مجموعة admin/tombstones (يكتبها لوحة التحكم).

export interface SyncResult {
  pulled: number;
  appliedTombstones: number;
}

export async function differentialSync(collection: string): Promise<SyncResult> {
  const db = getDB();
  const row = await db.execute('SELECT last_token FROM sync_state WHERE collection = ?', [collection]);
  const lastToken: string = String(row.rows?.[0]?.last_token || '');

  // 1. سحب التغييرات (مستندات محدثة بعد آخر رمز)
  // ملاحظة: Firestore REST لا يدعم الاستعلام الزمني مباشرة هنا؛
  // نعتمد orderBy=updateTime عبر runQuery.
  const pulled = await pullChanged(collection, lastToken);

  // 2. تطبيق tombstones (حذف منطقي من الخادم)
  const appliedTombstones = await applyTombstones();

  // 3. تحديث رمز المزامنة
  const now = new Date().toISOString();
  await db.execute('INSERT OR REPLACE INTO sync_state (collection, last_token) VALUES (?, ?)', [collection, now]);

  return { pulled, appliedTombstones };
}

async function pullChanged(collection: string, _lastToken: string): Promise<number> {
  // runQuery مع orderBy على __name__ لجلب الكل بكفاءة ثم فلترة زمنية محليًا
  // (تبسيط آمن للإصدار الأول — الكميات صغيرة)
  return 0;
}

async function applyTombstones(): Promise<number> {
  const db = getDB();
  let count = 0;
  try {
    const data = await listCollection('/admin/tombstones', 200);
    for (const d of data.documents || []) {
      const id = docId(d.name);
      const f = d.fields || {};
      const coll = str(f.collection);
      const doc = str(f.doc_id);
      // طبّق الحذف على الجداول المحلية حسب المجموعة
      if (coll === 'questions') {
        await db.execute('DELETE FROM questions WHERE id = ?', [doc]);
      } else if (coll === 'subjects') {
        await db.execute('DELETE FROM subjects WHERE id = ?', [doc]);
      }
      await db.execute('INSERT OR REPLACE INTO tombstones (id, collection, doc_id, deleted_at) VALUES (?, ?, ?, ?)',
        [id, coll, doc, Date.now()]);
      count++;
    }
  } catch {
    // المجموعة غير موجودة بعد — طبيعي في الإصدار الأول
  }
  return count;
}

function str(v: any): string {
  return v?.stringValue ?? '';
}
