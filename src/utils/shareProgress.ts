// مشاركة التقدم — رسالة عربية بهوية التطبيق عبر Share API الأصلي
import { Share } from 'react-native';
import { getAuth } from '../auth/auth';
import { getProfile, type GamificationProfile } from '../gamification/profile';

const APP_NAME = 'Med pro - وطني';

function userName(): string {
  try {
    const a = getAuth();
    return a.type === 'user' ? a.name || 'طالب طب' : 'طالب طب';
  } catch {
    return 'طالب طب';
  }
}

/** مشاركة نتيجة اختبار بعد إنهائه */
export async function shareTestResult(
  testTitle: string,
  correct: number,
  total: number,
): Promise<void> {
  try {
    const profile: GamificationProfile = await getProfile().catch(
      () => ({ totalXP: 0, level: 1, currentStreak: 0 } as GamificationProfile),
    );
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const message =
      `🎉 أنهيت اختبار «${testTitle}» في ${APP_NAME} بنتيجة ${pct}%!\n` +
      `✅ ${correct} من ${total} إجابات صحيحة\n` +
      `⚡ المستوى ${profile.level} • ${profile.totalXP} XP • 🔥 سلسلة ${profile.currentStreak} أيام\n\n` +
      `حمّل التطبيق وابدأ رحلتك نحو التفوق في الامتحان الوطني! 🩺`;
    await Share.share({ message, title: APP_NAME });
  } catch {
    /* ألغى المستخدم أو فشلت المشاركة */
  }
}

/** مشاركة التقدم العام من تبويب «تقدمي» */
export async function shareProgress(): Promise<void> {
  try {
    const profile: GamificationProfile = await getProfile().catch(
      () => ({ totalXP: 0, level: 1, currentStreak: 0, longestStreak: 0 } as GamificationProfile),
    );
    const name = userName();
    const message =
      `🏆 تقدمي في ${APP_NAME}\n` +
      `👨‍⚕️ ${name}\n` +
      `⚡ المستوى ${profile.level} • ${profile.totalXP} نقطة XP\n` +
      `🔥 سلسلة ${profile.currentStreak} أيام (الأطول: ${profile.longestStreak})\n\n` +
      `انضم إليّ واستعد للامتحان الوطني بذكاء! 🩺`;
    await Share.share({ message, title: APP_NAME });
  } catch {
    /* ألغى المستخدم أو فشلت المشاركة */
  }
}
