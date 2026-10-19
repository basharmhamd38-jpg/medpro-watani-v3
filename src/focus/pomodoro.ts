// مؤقت التركيز (بومودورو) — إحصائيات محلية أوفلاين + مزامنة Firestore
// دورة: 25 دقيقة تركيز / 5 دقائق راحة (قابلة للتخصيص من الواجهة)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE } from '../config';
import { damascusDate } from '../gamification/profile';
import { enqueueDocWrite } from '../sync/firestoreWrite';

export interface DayFocus {
  sessions: number;     // عدد جلسات التركيز المكتملة
  focusSeconds: number; // إجمالي ثواني التركيز
  date: string;         // YYYY-MM-DD
}

const KEY = 'watani_pomodoro_stats';

async function readAll(): Promise<Record<string, DayFocus>> {
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
async function writeLocal(data: Record<string, DayFocus>): Promise<void> {
  try {
    // الاحتفاظ بآخر 90 يومًا فقط (منع التضخم)
    const keys = Object.keys(data).sort();
    while (keys.length > 90) {
      const oldest = keys.shift();
      if (oldest) delete data[oldest];
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // تجاهل
  }
}

/** مسار مستند البومودورو للمستخدم الحالي — مفتاح تسلسل الكتابة */
async function getPomodoroDocPath(): Promise<string | null> {
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
    return `users/${encodeURIComponent(uid)}/pomodoro/stats`;
  } catch {
    return null;
  }
}

/**
 * مزامنة إحصائيات البومودورو إلى Firestore (لا تحجب الواجهة).
 * تُقرأ أحدث حالة محلية لحظة الإرسال — الـPATCH يدخل طابورًا متسلسلًا
 * لكل مستند فلا يمحو كتابة متزامنة أخرى.
 * updateMask: تحديث الحقلين صراحةً (stats، updatedAt) بدل الكتابة العمياء.
 */
async function syncNow(docPath: string): Promise<void> {
  try {
    if (FIREBASE.apiKey.length === 0) return;
    const data = await readAll();
    const url =
      `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}` +
      `/databases/${FIREBASE.databaseId}/documents/${docPath}` +
      `?key=${FIREBASE.apiKey}&updateMask.fieldPaths=stats&updateMask.fieldPaths=updatedAt`;
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          stats: { stringValue: JSON.stringify(data) },
          updatedAt: { stringValue: new Date().toISOString() },
        },
      }),
    });
  } catch {
    // يعمل أوفلاين — المزامنة لاحقًا
  }
}

/** إرسال المزامنة عبر الطابور المتسلسل للمستند (fire-and-forget) */
function queueSync(docPath: string): void {
  enqueueDocWrite(docPath, () => syncNow(docPath)).catch(() => {});
}

/** تسجيل جلسة تركيز مكتملة (بالثواني) */
export async function recordFocusSession(focusSeconds: number): Promise<DayFocus> {
  const docPath = await getPomodoroDocPath();
  const apply = async (): Promise<DayFocus> => {
    const all = await readAll();
    const today = damascusDate();
    const cur: DayFocus = all[today] ?? { sessions: 0, focusSeconds: 0, date: today };
    cur.sessions += 1;
    cur.focusSeconds += Math.max(0, Math.round(focusSeconds));
    all[today] = cur;
    await writeLocal(all);
    return cur;
  };
  if (!docPath) return apply();
  // القراءة-التعديل-الكتابة المحلية بتسلسل لكل مستند (لا سباق على AsyncStorage)
  const cur = await enqueueDocWrite(docPath, apply);
  // الـPATCH بتسلسل أيضًا — يحمل أحدث حالة محلية لحظة إرساله (لا محو متبادل)
  queueSync(docPath);
  return cur;
}

/** إحصائيات اليوم */
export async function getTodayFocus(): Promise<DayFocus> {
  const all = await readAll();
  const today = damascusDate();
  return all[today] ?? { sessions: 0, focusSeconds: 0, date: today };
}

/** آخر 7 أيام (الأقدم ← الأحدث) للرسم البياني */
export async function getWeekFocus(): Promise<DayFocus[]> {
  const all = await readAll();
  const out: DayFocus[] = [];
  for (let d = 6; d >= 0; d--) {
    const date = damascusDate(-d);
    out.push(all[date] ?? { sessions: 0, focusSeconds: 0, date });
  }
  return out;
}

/** إجمالي دقائق التركيز عبر كل الأيام المحفوظة */
export async function getTotalFocusMinutes(): Promise<number> {
  const all = await readAll();
  const totalSecs = Object.values(all).reduce((s, d) => s + d.focusSeconds, 0);
  return Math.round(totalSecs / 60);
}
