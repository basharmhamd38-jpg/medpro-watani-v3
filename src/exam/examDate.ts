// موعد الامتحان الوطني — يُقرأ من app_config/exam في Firestore (حقل examDate بصيغة YYYY-MM-DD)
// الإدارة تتحكم به من لوحة المالك. عند غياب المستند → "يُعلن قريبًا".
// عند فشل الشبكة/الحصة → آخر قيمة مخزنة، وإلا التاريخ الافتراضي.
import { FIREBASE } from '../config';
import { formatNumber } from '../utils/numbers';

/** التاريخ الافتراضي الاحتياطي (يُستخدم عند تعذر الوصول للقاعدة) */
export const DEFAULT_EXAM_DATE_ISO = '2027-01-15';

export interface ExamDateInfo {
  /** تاريخ ISO (حقيقي من الإدارة أو الافتراضي الاحتياطي) */
  iso: string;
  /** هل الموعد مُعلن رسميًا من الإدارة؟ */
  isConfigured: boolean;
}

let cachedIso: string | null = null;
let cachedConfigured = false;
let hasCache = false;
let lastFetch = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 دقيقة

/** جلب موعد الامتحان — لا ترمي استثناءات أبدًا */
export async function fetchExamDate(): Promise<ExamDateInfo> {
  const now = Date.now();
  if (hasCache && now - lastFetch < CACHE_TTL && cachedIso) {
    return { iso: cachedIso, isConfigured: cachedConfigured };
  }
  lastFetch = now;
  try {
    if (!FIREBASE.apiKey) throw new Error('no api key');
    const url =
      `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}` +
      `/databases/${FIREBASE.databaseId}/documents/app_config/exam?key=${FIREBASE.apiKey}`;
    const res = await fetch(url);
    if (res.status === 404) {
      cachedIso = DEFAULT_EXAM_DATE_ISO;
      cachedConfigured = false;
      hasCache = true;
      return { iso: cachedIso, isConfigured: false };
    }
    if (!res.ok) throw new Error(`Firestore ${res.status}`);
    const doc = await res.json();
    const raw = doc?.fields?.examDate?.stringValue;
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
      cachedIso = raw.slice(0, 10);
      cachedConfigured = true;
      hasCache = true;
      return { iso: cachedIso, isConfigured: true };
    }
    cachedIso = DEFAULT_EXAM_DATE_ISO;
    cachedConfigured = false;
    hasCache = true;
    return { iso: cachedIso, isConfigured: false };
  } catch {
    // فشل الشبكة/الحصة: آخر قيمة معروفة، وإلا الافتراضي (غير مُعلن)
    if (hasCache && cachedIso) {
      return { iso: cachedIso, isConfigured: cachedConfigured };
    }
    cachedIso = DEFAULT_EXAM_DATE_ISO;
    cachedConfigured = false;
    hasCache = true;
    return { iso: cachedIso, isConfigured: false };
  }
}

/** عدد الأيام المتبقية حتى تاريخ ISO (سالب/صفر = حان الموعد) */
export function daysUntil(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return 0;
  const exam = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  exam.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((exam.getTime() - today.getTime()) / 86400000);
}

const AR_MONTHS = [
  'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول',
];

/** "15 كانون الثاني 2027" */
export function formatArabicDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const month = AR_MONTHS[Number(m[2]) - 1] || m[2];
  return `${formatNumber(Number(m[3]))} ${month} ${formatNumber(m[1])}`;
}

/** صياغة عربية لعدد الأيام: "يوم واحد" / "يومان" / "X أيام" / "X يومًا" */
export function arabicDaysLabel(days: number): string {
  if (days === 1) return 'يوم واحد';
  if (days === 2) return 'يومان';
  if (days >= 3 && days <= 10) return `${formatNumber(days)} أيام`;
  return `${formatNumber(days)} يومًا`;
}

/** كلمة الوحدة فقط بجانب الرقم الكبير: "يوم" / "يومان" / "أيام" / "يومًا" */
export function arabicDaysUnit(days: number): string {
  if (days === 1) return 'يوم';
  if (days === 2) return 'يومان';
  if (days >= 3 && days <= 10) return 'أيام';
  return 'يومًا';
}
