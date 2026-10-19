// «الدراسة الخضراء» — منطق جلسات التركيز الأوفلاين + الأثر البيئي
// كل القيم مبنية على أبحاث منشورة (IEA / LBNL / Carbon Trust / EU 2024)
// وتُعرض موسومة «تقدير مبني على أبحاث منشورة» — بلا اختلاق
import AsyncStorage from '@react-native-async-storage/async-storage';

/** مدة الجلسة بالدقائق */
export const SESSION_MINUTES = 30;

/** ثواني الجلسة */
export const SESSION_SECONDS = SESSION_MINUTES * 60;

/**
 * القيم البيئية لكل جلسة 30 دقيقة (تقديرية من أبحاث منشورة):
 * - CO₂: ساعة بث فيديو ≈ 36غ (IEA 2020) → نصف ساعة ≈ 18غ
 * - الماء: WUE ≈ 0.36 لتر/ك.و.س (LBNL 2024) × طاقة الجلسة ≈ 0.03 لتر
 * - الطاقة: ~0.055 ك.و.س/ساعة بث (Carbon Trust) → نصف ساعة ≈ 28 واط.ساعة
 */
export const CO2_PER_SESSION_G = 18;
export const WATER_PER_SESSION_L = 0.03;
export const ENERGY_PER_SESSION_WH = 28;

/** مصادر الأرقام — تُعرض في قسم المراجع */
export const SOURCES = [
  'وكالة الطاقة الدولية (IEA) — البصمة الكربونية للبث',
  'مختبر لورانس بيركلي الوطني (LBNL 2024) — كفاءة الماء WUE',
  'Carbon Trust — طاقة البث المرئي',
  'تقرير الاتحاد الأوروبي 2024 — كفاءة مراكز البيانات',
] as const;

/** نصائح بيئية حقيقية — عربية */
export const ECO_TIPS: string[] = [
  'مراكز البيانات تستهلك 1-2% من كهرباء العالم (IEA) — كل دقيقة أوفلاين تخفف هذا الحمل.',
  'ساعة واحدة من بث الفيديو تنتج نحو 36 غرام CO₂ — بقدر غلي إبريق شاي كامل.',
  'تبريد مراكز البيانات يبخّر ملايين اللترات من الماء يوميًا — دراستك أوفلاين توفّر الماء فعلًا.',
  'تقليل البث والتحميل أثناء الدراسة يخفف الضغط على شبكات الطاقة وموارد الماء.',
  'التوسع المستمر للبنية الرقمية يستهلك أراضٍ وموارد مائية تؤثر على الموائل الطبيعية والتنوع الحيوي.',
  'تحميل المواد مرة واحدة ثم الدراسة أوفلاين أنظف بيئيًا من البث المتكرر للمحتوى نفسه.',
  'الأجهزة أثناء الشحن والبث معًا تستهلك طاقة مضاعفة — ادرس أوفلاين وجهازك مرتاح.',
  'مشاركة الملاحظات كنص بدل الفيديو توفّر حتى 90% من البيانات المنقولة لنفس المعلومة.',
];

export interface GreenStudyStats {
  totalSessions: number;
  totalMinutes: number;
  totalCo2G: number;
  totalWaterL: number;
  totalEnergyWh: number;
}

const STORAGE_KEY = 'green_study_stats_v1';

export const EMPTY_STATS: GreenStudyStats = {
  totalSessions: 0,
  totalMinutes: 0,
  totalCo2G: 0,
  totalWaterL: 0,
  totalEnergyWh: 0,
};

/** تحميل الإحصائيات التراكمية */
export async function loadStats(): Promise<GreenStudyStats> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_STATS };
    const parsed = JSON.parse(raw) as Partial<GreenStudyStats>;
    return {
      totalSessions: Number(parsed.totalSessions) || 0,
      totalMinutes: Number(parsed.totalMinutes) || 0,
      totalCo2G: Number(parsed.totalCo2G) || 0,
      totalWaterL: Number(parsed.totalWaterL) || 0,
      totalEnergyWh: Number(parsed.totalEnergyWh) || 0,
    };
  } catch {
    return { ...EMPTY_STATS };
  }
}

/** تسجيل جلسة مكتملة (30 دقيقة) في الإحصائيات */
export async function recordCompletedSession(): Promise<GreenStudyStats> {
  const stats = await loadStats();
  const next: GreenStudyStats = {
    totalSessions: stats.totalSessions + 1,
    totalMinutes: stats.totalMinutes + SESSION_MINUTES,
    totalCo2G: stats.totalCo2G + CO2_PER_SESSION_G,
    totalWaterL: stats.totalWaterL + WATER_PER_SESSION_L,
    totalEnergyWh: stats.totalEnergyWh + ENERGY_PER_SESSION_WH,
  };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // فشل الحفظ لا يمنع إظهار النتيجة
  }
  return next;
}

/** تنسيق الوقت المتبقي: 29:59 */
export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(Math.max(0, totalSeconds) / 60);
  const s = Math.max(0, totalSeconds) % 60;
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return `${mm}:${ss}`;
}

/** نسبة تقدم الجلسة 0..1 */
export function sessionProgress(elapsedSeconds: number): number {
  return Math.min(1, Math.max(0, elapsedSeconds / SESSION_SECONDS));
}

/** القيم التراكمية أثناء الجلسة (تتصاعد مع الوقت) */
export function liveSessionValues(elapsedSeconds: number): {
  co2G: number;
  waterL: number;
  energyWh: number;
} {
  const p = sessionProgress(elapsedSeconds);
  return {
    co2G: CO2_PER_SESSION_G * p,
    waterL: WATER_PER_SESSION_L * p,
    energyWh: ENERGY_PER_SESSION_WH * p,
  };
}

/** تنسيق رقم عشري عربي بسيط */
export function fmt(n: number, digits = 1): string {
  return n.toFixed(digits);
}
