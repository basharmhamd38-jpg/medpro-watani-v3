// الإشعارات الذكية — Med pro - وطني
// تقييم محلي عند فتح التطبيق: مراجعات مستحقة، تحذير السلسلة، الملخص الأسبوعي
// تُعرض في صندوق الوارد داخل التطبيق (بلا اعتماد على خادم أو صلاحيات إضافية)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDueMistakes, getProfile, getActivityStats, damascusDate } from '../gamification/profile';
import { damascusHour } from '../gamification/achievements';

export interface SmartSettings {
  reviewReminder: boolean; // تذكير المراجعات المستحقة
  streakWarning: boolean; // تحذير انقطاع السلسلة
  achievementAlerts: boolean; // تنبيهات الإنجازات
  weeklySummary: boolean; // الملخص الأسبوعي
  reminderTime: string; // "09:00" — وقت التذكير المفضل
}

const SETTINGS_KEY = 'smart_notif_settings';
const INBOX_KEY = 'smart_notif_inbox';

export const DEFAULT_SMART_SETTINGS: SmartSettings = {
  reviewReminder: true,
  streakWarning: true,
  achievementAlerts: true,
  weeklySummary: true,
  reminderTime: '09:00',
};

export const REMINDER_TIMES = ['07:00', '08:00', '09:00', '12:00', '18:00', '21:00'];

export interface SmartInboxItem {
  id: string;
  icon: string;
  title: string;
  body: string;
  meta: string;
  date: string;
}

export async function getSmartSettings(): Promise<SmartSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SMART_SETTINGS };
    return { ...DEFAULT_SMART_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SMART_SETTINGS };
  }
}

export async function saveSmartSettings(s: SmartSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // تجاهل
  }
}

export async function getSmartInbox(): Promise<SmartInboxItem[]> {
  try {
    const raw = await AsyncStorage.getItem(INBOX_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** إضافة عنصر لصندوق الوارد مع منع التكرار (نفس المعرف) */
export async function pushInboxItem(item: Omit<SmartInboxItem, 'date'>): Promise<void> {
  try {
    const list = await getSmartInbox();
    if (list.some((i) => i.id === item.id)) return;
    const full: SmartInboxItem = { ...item, date: damascusDate() };
    const updated = [full, ...list].slice(0, 50);
    await AsyncStorage.setItem(INBOX_KEY, JSON.stringify(updated));
  } catch {
    // تجاهل
  }
}

/** تنبيهات فتح الأوسمة — تُستدعى من نظام الإنجازات */
export async function pushAchievementInbox(titles: string[]): Promise<void> {
  const settings = await getSmartSettings();
  if (!settings.achievementAlerts || titles.length === 0) return;
  const today = damascusDate();
  await pushInboxItem({
    id: `achievement_${today}_${titles.length}`,
    icon: '🏅',
    title: titles.length === 1 ? `وسام جديد: ${titles[0]}!` : `أوسمة جديدة: ${titles.join('، ')}!`,
    body: 'أحسنت! استمر على هذا الإيقاع.',
    meta: 'إنجاز جديد',
  });
}

function timePassed(reminderTime: string): boolean {
  try {
    const [rh, rm] = reminderTime.split(':').map((x) => parseInt(x, 10));
    const now = damascusHour();
    const nowMin = (() => {
      try {
        const m = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Damascus',
          minute: 'numeric',
          hour12: false,
        }).format(new Date());
        return parseInt(m, 10) || 0;
      } catch {
        return new Date().getMinutes();
      }
    })();
    return now * 60 + nowMin >= rh * 60 + rm;
  } catch {
    return true;
  }
}

/**
 * تقييم الإشعارات الذكية — تُستدعى عند إقلاع التطبيق والعودة للمقدمة.
 * كل نوع يُولّد عنصرًا واحدًا يوميًا كحد أقصى.
 */
export async function evaluateSmartNotifications(): Promise<void> {
  try {
    const settings = await getSmartSettings();
    const today = damascusDate();
    const profile = await getProfile();

    // 1) تذكير المراجعات المستحقة (بعد وقت التذكير المفضل)
    if (settings.reviewReminder && timePassed(settings.reminderTime)) {
      const due = await getDueMistakes();
      if (due.length > 0) {
        await pushInboxItem({
          id: `review_${today}`,
          icon: '⏰',
          title: `لديك ${due.length} مراجعة مستحقة اليوم`,
          body: 'راجع أخطاءك الآن لتثبيت المعلومة قبل نسيانها.',
          meta: 'تذكير المراجعة الذكية',
        });
      }
    }

    // 2) تحذير انقطاع السلسلة (مساءً، كان نشطًا أمس ولم ينشط اليوم)
    if (settings.streakWarning && profile.currentStreak > 0) {
      const yesterday = damascusDate(-1);
      const hour = damascusHour();
      if (profile.lastActiveDate === yesterday && hour >= 18) {
        await pushInboxItem({
          id: `streak_${today}`,
          icon: '🔥',
          title: `سلسلة الـ ${profile.currentStreak} أيام في خطر!`,
          body: 'ادرس اليوم ولو قليلًا للحفاظ على سلسلتك.',
          meta: 'تحذير السلسلة',
        });
      }
    }

    // 3) الملخص الأسبوعي (يوم الجمعة)
    if (settings.weeklySummary) {
      let weekday = 0;
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Damascus',
          weekday: 'short',
        }).format(new Date());
        weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts);
      } catch {
        weekday = new Date().getDay();
      }
      if (weekday === 5) {
        const stats = await getActivityStats();
        const weekXP = Object.entries(profile.xpHistory)
          .filter(([d]) => d >= damascusDate(-6))
          .reduce((s, [, x]) => s + (x || 0), 0);
        await pushInboxItem({
          id: `weekly_${today}`,
          icon: '📊',
          title: 'ملخص أسبوعك الدراسي',
          body: `${stats.questionsAnswered} سؤال محلول • ${weekXP} نقطة هذا الأسبوع • سلسلة ${profile.currentStreak} أيام`,
          meta: 'الملخص الأسبوعي',
        });
      }
    }
  } catch {
    // الإشعارات الذكية لا تعطل التطبيق أبدًا
  }
}
