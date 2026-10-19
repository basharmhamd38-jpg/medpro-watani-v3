// التوصيات الذكية — تُحسب محليًا من بيانات النشاط (بدون AI)
// "لم تدرس X منذ Y يوم" / "أضعف مادة لديك هي Z" / "حافظ على سلسلتك!"
import type { GamificationProfile } from '../gamification/profile';
import type { TabParamList, DrawerParamList } from '../navigation/types';
import { damascusDate } from '../gamification/profile';

/** اسم مسار مسجّل في التنقل — تبويب سفلي أو شاشة درج */
export type RecommendationTarget = keyof TabParamList | keyof DrawerParamList;

export interface Recommendation {
  id: string;
  icon: 'flame' | 'book' | 'target' | 'zap' | 'calendar' | 'trophy';
  title: string;
  body: string;
  actionLabel: string;
  /**
   * اسم المسار المستهدف عند الضغط — مُكتوب بنوع RecommendationTarget
   * فيُكتشف أي اسم مسار غير مسجّل في التنقل عند البناء مباشرةً
   * (كانت القيم النصية الصغيرة 'challenge'/'bank'... لا تطابق أي مسار مسجّل
   * فكان الضغط لا يفعل شيئًا — UI7)
   */
  targetTab: RecommendationTarget;
  priority: number; // الأعلى أولًا
}

interface Input {
  profile: GamificationProfile;
  /** آخر نشاط لكل مادة: subjectId → تاريخ YYYY-MM-DD */
  subjectLastStudied?: Record<string, string>;
  /** أسماء المواد: subjectId → الاسم العربي */
  subjectNames?: Record<string, string>;
  /** نسبة الإتقان لكل مادة: subjectId → 0-100 */
  subjectMastery?: Record<string, number>;
  /** هل أُنجز التحدي اليومي؟ */
  challengeDoneToday?: boolean;
}

function daysBetween(a: string, b: string): number {
  // YYYY-MM-DD → فرق الأيام
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export function buildRecommendations(input: Input): Recommendation[] {
  const { profile, challengeDoneToday } = input;
  const today = damascusDate();
  const recs: Recommendation[] = [];

  // 1. التحدي اليومي لم يُنجز
  if (!challengeDoneToday) {
    recs.push({
      id: 'daily-challenge',
      icon: 'zap',
      title: 'التحدي اليومي بانتظارك',
      body: '10 أسئلة فقط وتربح +30 XP وتحافظ على سلسلتك.',
      actionLabel: 'ابدأ التحدي',
      targetTab: 'ChallengeTab',
      priority: 100,
    });
  }

  // 2. خطر انقطاع السلسلة
  if (profile.currentStreak > 0) {
    const lastActive = profile.lastActiveDate;
    if (lastActive && lastActive !== today) {
      const gap = daysBetween(lastActive, today);
      if (gap >= 1) {
        recs.push({
          id: 'streak-risk',
          icon: 'flame',
          title: `سلسلتك (${profile.currentStreak} يوم) في خطر!`,
          body: 'ادرس اليوم قبل منتصف الليل لتحافظ عليها.',
          actionLabel: 'ادرس الآن',
          targetTab: 'BankTab',
          priority: 95,
        });
      }
    }
  }

  // 3. مواد لم تُدرس منذ فترة
  const { subjectLastStudied = {}, subjectNames = {} } = input;
  const stale: { id: string; name: string; days: number }[] = [];
  Object.entries(subjectLastStudied).forEach(([sid, lastDate]) => {
    const days = daysBetween(lastDate, today);
    if (days >= 5) {
      stale.push({
        id: sid,
        name: subjectNames[sid] || sid,
        days,
      });
    }
  });
  stale.sort((a, b) => b.days - a.days);
  if (stale.length > 0) {
    const s = stale[0];
    recs.push({
      id: `stale-${s.id}`,
      icon: 'book',
      title: `لم تدرس ${s.name} منذ ${s.days} أيام`,
      body: 'المراجعة المتباعدة تثبّت المعلومة — راجعها اليوم.',
      actionLabel: 'راجع المادة',
      targetTab: 'BankTab',
      priority: 80,
    });
  }

  // 4. أضعف مادة (أقل إتقان)
  const { subjectMastery = {} } = input;
  const entries = Object.entries(subjectMastery).filter(([, v]) => v < 70);
  if (entries.length > 0) {
    entries.sort((a, b) => a[1] - b[1]);
    const [sid, score] = entries[0];
    recs.push({
      id: `weak-${sid}`,
      icon: 'target',
      title: `نقطة ضعف: ${subjectNames[sid] || sid} (${score}%)`,
      body: 'ركّز على هذه المادة لرفع مستواك العام.',
      actionLabel: 'قوّي المادة',
      targetTab: 'CoursesTab',
      priority: 70,
    });
  }

  // 5. تشجيع للمبتدئين (XP منخفض)
  if (profile.totalXP < 100) {
    recs.push({
      id: 'beginner',
      icon: 'trophy',
      title: 'ابدأ رحلتك!',
      body: 'حل 20 سؤالًا اليوم لتفتح أول وسام لك.',
      actionLabel: 'ابدأ الآن',
      targetTab: 'BankTab',
      priority: 60,
    });
  }

  // 6. تذكير بالمراجعة الذكية (إن وُجدت أخطاء متراكمة)
  // (يُمرَّر من الشاشة إن توفر العدد)
  
  // 7. تحفيز السلسلة الطويلة
  if (profile.currentStreak >= 7) {
    recs.push({
      id: 'streak-celebrate',
      icon: 'flame',
      title: `${profile.currentStreak} أيام متتالية — مذهل!`,
      body: 'استمر على هذا الإيقاع، أنت من النخبة.',
      actionLabel: 'واصل',
      targetTab: 'ProgressTab',
      priority: 50,
    });
  }

  // ترتيب حسب الأولوية وإرجاع أول 3
  recs.sort((a, b) => b.priority - a.priority);
  return recs.slice(0, 3);
}
