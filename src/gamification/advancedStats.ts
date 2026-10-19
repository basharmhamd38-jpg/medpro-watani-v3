// الإحصائيات المتقدمة — تُحسب محليًا من بيانات حقيقية فقط
import {
  getActivityHours,
  getActivityStats,
  getChallengeHistory,
  getProfile,
  getSubjectMastery,
} from './profile';

export type StudyPeriod = 'morning' | 'afternoon' | 'evening' | 'night' | null;

export interface AdvancedStats {
  /** أفضل فترة دراسة */
  bestPeriod: StudyPeriod;
  bestPeriodLabel: string;
  /** متوسط الدقة % من سجل التحديات */
  accuracy: number | null;
  /** أيام الدراسة (من سجل XP اليومي) */
  studyDays: number;
  /** دقائق دراسة تقديرية (الأسئلة × 45 ثانية) */
  estimatedMinutes: number;
  /** أطول سلسلة */
  longestStreak: number;
  /** السلسلة الحالية */
  currentStreak: number;
  /** إجمالي الأسئلة */
  questionsAnswered: number;
  /** إجمالي XP */
  totalXP: number;
  /** إتقان المواد */
  mastery: { subject: string; answered: number; correct: number; pct: number }[];
  /** هل توجد بيانات كافية */
  hasData: boolean;
}

const PERIOD_LABEL: Record<Exclude<StudyPeriod, null>, string> = {
  morning: 'الصباح (5–12)',
  afternoon: 'الظهر (12–17)',
  evening: 'المساء (17–23)',
  night: 'آخر الليل (23–5)',
};

function periodOf(hour: number): Exclude<StudyPeriod, null> {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 23) return 'evening';
  return 'night';
}

export async function getAdvancedStats(): Promise<AdvancedStats> {
  const [profile, stats, hours, mastery, history] = await Promise.all([
    getProfile().catch(() => null),
    getActivityStats().catch(() => null),
    getActivityHours().catch(() => ({})),
    getSubjectMastery().catch(() => ({})),
    getChallengeHistory().catch(() => []),
  ]);

  const questionsAnswered = stats?.questionsAnswered || 0;
  const hasData = questionsAnswered > 0;

  // أفضل فترة دراسة من توزيع الساعات
  let bestPeriod: StudyPeriod = null;
  let bestPeriodLabel = 'لا توجد بيانات كافية بعد';
  const periodCounts: Record<string, number> = {};
  let totalHits = 0;
  for (const [h, c] of Object.entries(hours)) {
    const p = periodOf(parseInt(h, 10));
    periodCounts[p] = (periodCounts[p] || 0) + c;
    totalHits += c;
  }
  if (totalHits >= 5) {
    const best = (Object.entries(periodCounts) as [string, number][]).sort(
      (a, b) => b[1] - a[1],
    )[0];
    if (best) {
      bestPeriod = best[0] as Exclude<StudyPeriod, null>;
      bestPeriodLabel = PERIOD_LABEL[bestPeriod];
    }
  }

  // متوسط الدقة من سجل التحديات
  let accuracy: number | null = null;
  const totC = history.reduce((s, r) => s + (r.correct || 0), 0);
  const totT = history.reduce((s, r) => s + (r.total || 0), 0);
  if (totT >= 5) accuracy = Math.round((totC / totT) * 100);

  // أيام الدراسة من سجل XP اليومي
  let studyDays = 0;
  try {
    studyDays = Object.keys(profile?.xpHistory || {}).length;
  } catch {
    studyDays = 0;
  }

  // إتقان المواد
  const masteryList = Object.entries(mastery)
    .map(([subject, m]) => ({
      subject,
      answered: m.answered,
      correct: m.correct,
      pct: m.answered > 0 ? Math.round((m.correct / m.answered) * 100) : 0,
    }))
    .sort((a, b) => b.answered - a.answered)
    .slice(0, 8);

  return {
    bestPeriod,
    bestPeriodLabel,
    accuracy,
    studyDays,
    estimatedMinutes: Math.round(questionsAnswered * 0.75),
    longestStreak: profile?.longestStreak || 0,
    currentStreak: profile?.currentStreak || 0,
    questionsAnswered,
    totalXP: profile?.totalXP || 0,
    mastery: masteryList,
    hasData,
  };
}
