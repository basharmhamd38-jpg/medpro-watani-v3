// التكرار المتباعد — خوارزمية SM-2 (نمط Anki)
// يعمل أوفلاين بالكامل: AsyncStorage محلي + مزامنة Firestore (fire-and-forget)
// يُستخدم للبطاقات التعليمية وأسئلة الاختبارات
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE } from '../config';
import { damascusDate } from '../gamification/profile';
import { enqueueDocWrite } from '../sync/firestoreWrite';

export interface SM2Record {
  itemId: string;      // معرّف العنصر (بطاقة أو سؤال)
  easeFactor: number;  // معامل السهولة (يبدأ 2.5)
  interval: number;    // الفاصل بالأيام
  repetitions: number; // عدد المراجعات الناجحة المتتالية
  nextReview: string;  // YYYY-MM-DD (توقيت دمشق)
  lastGrade: number;   // آخر تقييم 0-5
  updatedAt: string;   // ISO
}

const KEY = 'watani_sm2';

const DEFAULT_EF = 2.5;
const MIN_EF = 1.3;

/**
 * خوارزمية SM-2 الأصلية.
 * quality: 0 = نسيان تام، 1-2 = صعب/خاطئ، 3 = مقبول، 4 = جيد، 5 = سهل جدًا
 */
export function sm2Grade(prev: SM2Record | null, quality: number): SM2Record {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let ef = prev?.easeFactor ?? DEFAULT_EF;
  let interval = prev?.interval ?? 0;
  let reps = prev?.repetitions ?? 0;

  if (q < 3) {
    // إجابة خاطئة/صعبة: إعادة الجدولة من الصفر
    reps = 0;
    interval = 1;
  } else {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.round(interval * ef);
  }

  // تحديث معامل السهولة
  ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ef < MIN_EF) ef = MIN_EF;

  const nextReview = damascusDate(interval);
  return {
    itemId: prev?.itemId ?? '',
    easeFactor: Math.round(ef * 100) / 100,
    interval,
    repetitions: reps,
    nextReview,
    lastGrade: q,
    updatedAt: new Date().toISOString(),
  };
}

async function readAll(): Promise<Record<string, SM2Record>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

/** كتابة محلية فقط — تُستدعى داخل الطابور المتسلسل لكل مستند */
async function writeLocal(records: Record<string, SM2Record>): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    // تجاهل أخطاء التخزين
  }
}

/** مسار قاعدة SM-2 للمستخدم الحالي — مفتاح تسلسل الكتابة */
async function getSm2BasePath(): Promise<string | null> {
  try {
    const { getAuth, getDeviceId } = await import('../auth/auth');
    const a = getAuth();
    let uid = '';
    if (a.type === 'user') {
      uid = `email_${a.email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    } else {
      uid = getDeviceId();
    }
    if (!uid) return null;
    return `users/${encodeURIComponent(uid)}/sm2`;
  } catch {
    return null;
  }
}

// حجم الشارد — أقل بكثير من حد 1MB لوثيقة Firestore (W17)
const SHARD_SIZE = 200;

/**
 * مزامنة سجلات SM-2 إلى Firestore (لا تحجب الواجهة) — مجزأة على شاردات.
 * تُقرأ أحدث حالة محلية لحظة الإرسال — لأن الـPATCH يدخل طابورًا متسلسلًا
 * لكل مستند، فيحمل دائمًا لقطة أحدث من (أو مساوية لـ) الكتابات السابقة:
 * لا محو متبادل بين كتابات متزامنة.
 * updateMask: تحديث الحقول صراحةً بدل الكتابة العمياء.
 * الشاردات: users/{uid}/sm2/shards/shard_{i} + ميتا users/{uid}/sm2/sync_meta.
 */
async function syncNow(basePath: string): Promise<void> {
  try {
    if (FIREBASE.apiKey.length === 0) return;
    const records = await readAll();
    const keys = Object.keys(records);
    const shardCount = Math.max(1, Math.ceil(keys.length / SHARD_SIZE));
    const docBase =
      `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}` +
      `/databases/${FIREBASE.databaseId}/documents/${basePath}`;
    const mask =
      'updateMask.fieldPaths=records&updateMask.fieldPaths=updatedAt';
    for (let i = 0; i < shardCount; i++) {
      const chunk: Record<string, SM2Record> = {};
      for (const k of keys.slice(i * SHARD_SIZE, (i + 1) * SHARD_SIZE)) {
        chunk[k] = records[k];
      }
      await fetch(`${docBase}/shards/shard_${i}?key=${FIREBASE.apiKey}&${mask}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            records: { stringValue: JSON.stringify(chunk) },
            updatedAt: { stringValue: new Date().toISOString() },
          },
        }),
      });
    }
    // عدد الشاردات السابقة — لحذف الزائدة عند تقلّص البيانات
    const prevCount: number = await fetch(
      `${docBase}/sync_meta?key=${FIREBASE.apiKey}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((j: any) => {
        const v = j?.fields?.shardCount?.integerValue;
        const n = v != null ? parseInt(String(v), 10) : 0;
        return Number.isFinite(n) && n >= 0 ? n : 0;
      })
      .catch(() => 0);
    await fetch(
      `${docBase}/sync_meta?key=${FIREBASE.apiKey}` +
        '&updateMask.fieldPaths=shardCount&updateMask.fieldPaths=updatedAt',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            shardCount: { integerValue: String(shardCount) },
            updatedAt: { stringValue: new Date().toISOString() },
          },
        }),
      },
    );
    for (let i = shardCount; i < prevCount; i++) {
      await fetch(`${docBase}/shards/shard_${i}?key=${FIREBASE.apiKey}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
  } catch {
    // فشل المزامنة لا يعطل التطبيق (يعمل أوفلاين)
  }
}

/** إرسال المزامنة عبر الطابور المتسلسل للمستند (fire-and-forget) */
function queueSync(basePath: string): void {
  enqueueDocWrite(basePath, () => syncNow(basePath)).catch(() => {});
}

/** تسجيل تقييم عنصر (بطاقة/سؤال) بجودة 0-5 */
export async function gradeItem(itemId: string, quality: number): Promise<SM2Record> {
  const basePath = await getSm2BasePath();
  const apply = async (): Promise<SM2Record> => {
    const all = await readAll();
    const prev = all[itemId] ?? null;
    const next = sm2Grade(prev, quality);
    next.itemId = itemId;
    all[itemId] = next;
    await writeLocal(all);
    return next;
  };
  if (!basePath) return apply();
  // القراءة-التعديل-الكتابة المحلية بتسلسل لكل مستند (لا سباق على AsyncStorage)
  const next = await enqueueDocWrite(basePath, apply);
  // الـPATCH بتسلسل أيضًا — يحمل أحدث حالة محلية لحظة إرساله (لا محو متبادل)
  queueSync(basePath);
  return next;
}

/** تسجيل نتائج اختبار دفعة واحدة: الصحيح → 4، الخاطئ → 2 */
export async function gradeQuizResults(
  items: { id: string; correct: boolean }[],
): Promise<void> {
  if (items.length === 0) return;
  const basePath = await getSm2BasePath();
  const apply = async (): Promise<void> => {
    const all = await readAll();
    for (const it of items) {
      const prev = all[it.id] ?? null;
      const next = sm2Grade(prev, it.correct ? 4 : 2);
      next.itemId = it.id;
      all[it.id] = next;
    }
    await writeLocal(all);
  };
  if (!basePath) {
    await apply();
    return;
  }
  await enqueueDocWrite(basePath, apply);
  queueSync(basePath);
}

/** العناصر المستحقة للمراجعة اليوم (nextReview <= اليوم) */
export async function getDueItems(): Promise<SM2Record[]> {
  const all = await readAll();
  const today = damascusDate();
  return Object.values(all).filter((r) => r.nextReview <= today);
}

/** عدد العناصر المستحقة — للشارة على التبويب */
export async function getDueCount(): Promise<number> {
  const due = await getDueItems();
  return due.length;
}

/** سجل عنصر معين (إن وُجد) */
export async function getRecord(itemId: string): Promise<SM2Record | null> {
  const all = await readAll();
  return all[itemId] ?? null;
}

/** إحصائيات سريعة: إجمالي العناصر + المستحقة + متوسط معامل السهولة */
export async function getSM2Stats(): Promise<{
  total: number;
  due: number;
  avgEF: number;
}> {
  const all = await readAll();
  const list = Object.values(all);
  const due = list.filter((r) => r.nextReview <= damascusDate()).length;
  const avgEF =
    list.length > 0
      ? Math.round((list.reduce((s, r) => s + r.easeFactor, 0) / list.length) * 100) / 100
      : 0;
  return { total: list.length, due, avgEF };
}
