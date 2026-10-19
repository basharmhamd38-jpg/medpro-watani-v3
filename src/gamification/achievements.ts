// نظام الأوسمة والإنجازات — Med pro - وطني
// تعريفات الشارات + فحص الفتح + تخزين + إشعار المشتركين
// (لا يستورد profile.ts في زمن التشغيل — يستقبل السياق كوسائط لتفادي الاستيراد الدائري)
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Target,
  Flame,
  Zap,
  Star,
  BookOpen,
  Award,
  Sunrise,
  Moon,
  type LucideIcon,
} from 'lucide-react-native';
import type { GamificationProfile, ActivityStats } from './profile';

export interface BadgeDef {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  target: number;
  unit: string;
  getProgress: (ctx: BadgeContext) => number;
  check: (ctx: BadgeContext) => boolean;
}

export interface BadgeContext {
  profile: GamificationProfile;
  stats: ActivityStats;
  subjectsAttempted: string[];
  perfectScores: number;
  perfectScoreNow: boolean;
  hour: number; // بتوقيت دمشق (0-23)
}

/** عدد المواد المستهدفة لوسام المستكشف (مواد دورات الوطني) */
export const EXPLORER_TARGET = 20;

export const BADGES: BadgeDef[] = [
  {
    id: 'first_100',
    title: 'المثابر',
    description: 'حللت 100 سؤال — الاستمرارية تصنع الأطباء',
    icon: Target,
    color: '#7A1F2B',
    bg: '#F9F0F1',
    target: 100,
    unit: 'سؤال',
    getProgress: (c) => Math.min(c.stats.questionsAnswered, 100),
    check: (c) => c.stats.questionsAnswered >= 100,
  },
  {
    id: 'streak_7',
    title: 'الشعلة المتوهجة',
    description: 'حافظت على سلسلة دراسة 7 أيام متتالية',
    icon: Flame,
    color: '#C2410C',
    bg: '#FFF3E8',
    target: 7,
    unit: 'أيام',
    getProgress: (c) =>
      Math.min(Math.max(c.profile.currentStreak, c.profile.longestStreak), 7),
    check: (c) =>
      c.profile.currentStreak >= 7 || c.profile.longestStreak >= 7,
  },
  {
    id: 'first_challenge',
    title: 'روح التحدي',
    description: 'أكملت أول تحدي يومي بنجاح',
    icon: Zap,
    color: '#B8860B',
    bg: '#FFF8E1',
    target: 1,
    unit: 'تحدي',
    getProgress: (c) => Math.min(c.stats.challengesDone, 1),
    check: (c) => c.stats.challengesDone >= 1,
  },
  {
    id: 'xp_1000',
    title: 'النجم الصاعد',
    description: 'جمعت 1000 نقطة خبرة (XP)',
    icon: Star,
    color: '#6D28D9',
    bg: '#F3EDFF',
    target: 1000,
    unit: 'نقطة',
    getProgress: (c) => Math.min(c.profile.totalXP, 1000),
    check: (c) => c.profile.totalXP >= 1000,
  },
  {
    id: 'explorer',
    title: 'مستكشف المواد',
    description: `جرّبت ${EXPLORER_TARGET} مادة دراسية مختلفة`,
    icon: BookOpen,
    color: '#0E7C66',
    bg: '#E6F7F4',
    target: EXPLORER_TARGET,
    unit: 'مادة',
    getProgress: (c) => Math.min(c.subjectsAttempted.length, EXPLORER_TARGET),
    check: (c) => c.subjectsAttempted.length >= EXPLORER_TARGET,
  },
  {
    id: 'perfect_score',
    title: 'العلامة الكاملة',
    description: 'حصلت على 100% في اختبار كامل',
    icon: Award,
    color: '#1D4ED8',
    bg: '#EAF1FE',
    target: 1,
    unit: 'اختبار',
    getProgress: (c) => Math.min(c.perfectScores, 1),
    check: (c) => c.perfectScores >= 1,
  },
  {
    id: 'early_bird',
    title: 'الطائر المبكر',
    description: 'درست قبل الساعة 7 صباحًا — يومك يبدأ متفوقًا',
    icon: Sunrise,
    color: '#0284C7',
    bg: '#E8F5FD',
    target: 1,
    unit: '',
    getProgress: (c) => (c.hour < 7 || unlockedSync('early_bird') ? 1 : 0),
    check: (c) => c.hour < 7,
  },
  {
    id: 'night_owl',
    title: 'بومة الليل',
    description: 'درست بعد الساعة 11 مساءً — المثابرة لا تنام',
    icon: Moon,
    color: '#4C1D95',
    bg: '#F1EAFE',
    target: 1,
    unit: '',
    getProgress: (c) => (c.hour >= 23 || unlockedSync('night_owl') ? 1 : 0),
    check: (c) => c.hour >= 23,
  },
];

// ─── التخزين ───

const BADGES_KEY = 'watani_unlocked_badges';
const BADGE_DATES_KEY = 'watani_badge_dates';
const PERFECT_KEY = 'watani_perfect_scores';

// ذاكرة متزامنة خفيفة لحالة الفتح (تُحمّل عند أول فحص)
let unlockedCache: string[] | null = null;
let datesCache: Record<string, string> | null = null;

function unlockedSync(id: string): boolean {
  return !!unlockedCache && unlockedCache.includes(id);
}

async function loadState(): Promise<{
  unlocked: string[];
  dates: Record<string, string>;
  perfectScores: number;
}> {
  if (unlockedCache && datesCache) {
    const ps = await readPerfect();
    return { unlocked: unlockedCache, dates: datesCache, perfectScores: ps };
  }
  try {
    const [u, d, p] = await Promise.all([
      AsyncStorage.getItem(BADGES_KEY),
      AsyncStorage.getItem(BADGE_DATES_KEY),
      AsyncStorage.getItem(PERFECT_KEY),
    ]);
    unlockedCache = u ? JSON.parse(u) : [];
    datesCache = d ? JSON.parse(d) : {};
    if (!Array.isArray(unlockedCache)) unlockedCache = [];
    return {
      unlocked: unlockedCache,
      dates: datesCache || {},
      perfectScores: p ? parseInt(p, 10) || 0 : 0,
    };
  } catch {
    unlockedCache = [];
    datesCache = {};
    return { unlocked: [], dates: {}, perfectScores: 0 };
  }
}

async function readPerfect(): Promise<number> {
  try {
    const p = await AsyncStorage.getItem(PERFECT_KEY);
    return p ? parseInt(p, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

async function persistUnlocked(unlocked: string[], dates: Record<string, string>): Promise<void> {
  unlockedCache = unlocked;
  datesCache = dates;
  try {
    await Promise.all([
      AsyncStorage.setItem(BADGES_KEY, JSON.stringify(unlocked)),
      AsyncStorage.setItem(BADGE_DATES_KEY, JSON.stringify(dates)),
    ]);
  } catch {
    // تجاهل
  }
}

export async function addPerfectScore(): Promise<number> {
  const n = (await readPerfect()) + 1;
  try {
    await AsyncStorage.setItem(PERFECT_KEY, String(n));
  } catch {
    // تجاهل
  }
  return n;
}

// ─── الفحص والفتح ───

/** الساعة الحالية بتوقيت دمشق (0-23) */
export function damascusHour(): number {
  try {
    const h = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Damascus',
      hour: 'numeric',
      hour12: false,
    }).format(new Date());
    return parseInt(h, 10) % 24;
  } catch {
    return new Date().getHours();
  }
}

type BadgeListener = (badges: BadgeDef[]) => void;
const listeners = new Set<BadgeListener>();

/** الاشتراك في حدث فتح أوسمة جديدة (يُستخدم من نافذة الاحتفال) */
export function onBadgesUnlocked(cb: BadgeListener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notifyBadges(badges: BadgeDef[]): void {
  for (const cb of listeners) {
    try {
      cb(badges);
    } catch {
      // لا يعطل التطبيق
    }
  }
  // صندوق وارد الإشعارات الذكية (تنبيهات الإنجازات)
  if (badges.length > 0) {
    import('../notifications/smart')
      .then((m) => m.pushAchievementInbox(badges.map((b) => b.title)))
      .catch(() => {});
  }
}

/**
 * فحص الشارات وفتح الجديدة — تُستدعى من recordActivity بعد كل نشاط.
 * تُرجع الشارات المفتوحة حديثًا (لعرض الاحتفال).
 */
export async function checkAndUnlockBadges(ctx: BadgeContext): Promise<BadgeDef[]> {
  const state = await loadState();
  const fullCtx: BadgeContext = {
    ...ctx,
    perfectScores: state.perfectScores,
  };
  const newly: BadgeDef[] = [];
  const unlocked = [...state.unlocked];
  const dates = { ...state.dates };
  const today = new Date().toISOString().slice(0, 10);

  for (const badge of BADGES) {
    if (unlocked.includes(badge.id)) continue;
    let ok = false;
    try {
      ok = badge.check(fullCtx);
    } catch {
      ok = false;
    }
    if (ok) {
      unlocked.push(badge.id);
      dates[badge.id] = today;
      newly.push(badge);
    }
  }

  if (newly.length > 0) {
    await persistUnlocked(unlocked, dates);
    notifyBadges(newly);
  }
  return newly;
}

/** كل الشارات مع حالة الفتح والتقدم — لشاشة الأوسمة */
export async function getBadgesWithProgress(ctx: BadgeContext): Promise<
  { def: BadgeDef; unlocked: boolean; progress: number; unlockedAt?: string }[]
> {
  const state = await loadState();
  const fullCtx: BadgeContext = { ...ctx, perfectScores: state.perfectScores };
  return BADGES.map((def) => {
    const unlocked = state.unlocked.includes(def.id);
    let progress = 0;
    try {
      progress = unlocked ? def.target : def.getProgress(fullCtx);
    } catch {
      progress = 0;
    }
    return {
      def,
      unlocked,
      progress,
      unlockedAt: state.dates[def.id],
    };
  });
}

/** عدد الأوسمة المفتوحة — للعرض السريع */
export async function getUnlockedCount(): Promise<number> {
  const state = await loadState();
  return state.unlocked.length;
}
