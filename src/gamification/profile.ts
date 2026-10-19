// نظام التحفيز المحلي: XP + المستوى + السلسلة + إنجاز التحدي اليومي
// مرجعية AI Studio (gamificationProfile في App.tsx) — تخزين AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface GamificationProfile {
  totalXP: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string;
  dailyChallengeDone: Record<string, boolean>;
  xpHistory: Record<string, number>;
  subjectsAttempted: string[];
}

export interface ChallengeRecord {
  date: string;
  correct: number;
  total: number;
  xpEarned: number;
}

export interface MistakeItem {
  qid: string;
  text: string;
  options: { letter: string; text: string }[];
  correctIndex: number;
  explanation: string;
  subjectName: string;
  wrongAt: string;
  nextReview: string;
  reviewCount: number;
}

const PROFILE_KEY = 'gamification_profile';
const CHALLENGES_KEY = 'daily_challenge_history';
const MISTAKES_KEY = 'challenge_mistakes';

const DEFAULT_PROFILE: GamificationProfile = {
  totalXP: 0,
  level: 1,
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: '',
  dailyChallengeDone: {},
  xpHistory: {},
  subjectsAttempted: [],
};

/** تاريخ دمشق بصيغة YYYY-MM-DD */
export function damascusDate(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Damascus',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parts; // YYYY-MM-DD
}

export function levelForXP(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

async function writeJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // تجاهل أخطاء التخزين
  }
}

export async function getProfile(): Promise<GamificationProfile> {
  const p = await readJSON<GamificationProfile>(PROFILE_KEY, DEFAULT_PROFILE);
  p.level = levelForXP(p.totalXP);
  return p;
}

/** إضافة XP مع تحديث السلسلة — isDailyChallenge يعلّم إنجاز اليوم */
export async function awardXP(amount: number, isDailyChallenge = false): Promise<GamificationProfile> {
  const p = await getProfile();
  const today = damascusDate();
  const yesterday = damascusDate(-1);

  const newXP = p.totalXP + amount;
  const newLevel = levelForXP(newXP);

  let newStreak = p.currentStreak;
  if (p.lastActiveDate === today) {
    // نفس اليوم — السلسلة ثابتة
  } else if (p.lastActiveDate === yesterday || p.lastActiveDate === '') {
    newStreak = (p.lastActiveDate === '' ? 0 : p.currentStreak) + 1;
  } else {
    newStreak = 1; // انقطعت السلسلة
  }

  const updated: GamificationProfile = {
    totalXP: newXP,
    level: newLevel,
    currentStreak: newStreak,
    longestStreak: Math.max(p.longestStreak, newStreak),
    lastActiveDate: today,
    dailyChallengeDone: {
      ...p.dailyChallengeDone,
      ...(isDailyChallenge ? { [today]: true } : {}),
    },
    xpHistory: {
      ...p.xpHistory,
      [today]: (p.xpHistory[today] || 0) + amount,
    },
    subjectsAttempted: p.subjectsAttempted || [],
  };
  await writeJSON(PROFILE_KEY, updated);
  return updated;
}

export async function isChallengeDoneToday(): Promise<boolean> {
  const p = await getProfile();
  return !!p.dailyChallengeDone[damascusDate()];
}

/** سجل التحديات السابقة (الأحدث أولًا) */
export async function getChallengeHistory(): Promise<ChallengeRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(CHALLENGES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function addChallengeRecord(rec: ChallengeRecord): Promise<void> {
  const list = await getChallengeHistory();
  list.unshift(rec);
  await writeJSON(CHALLENGES_KEY, list.slice(0, 60));
}

/** الأخطاء المحفوظة للمراجعة الذكية */
export async function getMistakes(): Promise<MistakeItem[]> {
  try {
    const raw = await AsyncStorage.getItem(MISTAKES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const SRS_STEPS = [1, 3, 7, 14, 30];

export async function addMistakes(items: Omit<MistakeItem, 'wrongAt' | 'nextReview' | 'reviewCount'>[]): Promise<void> {
  if (items.length === 0) return;
  const existing = await getMistakes();
  const today = damascusDate();
  const byId = new Map(existing.map((m) => [m.qid, m]));
  for (const it of items) {
    if (byId.has(it.qid)) continue;
    byId.set(it.qid, {
      ...it,
      wrongAt: today,
      nextReview: damascusDate(1),
      reviewCount: 0,
    });
  }
  const merged = [...byId.values()].slice(-200);
  await writeJSON(MISTAKES_KEY, merged);
}

/** المستحق مراجعته اليوم أو قبله */
export async function getDueMistakes(): Promise<MistakeItem[]> {
  const today = damascusDate();
  const list = await getMistakes();
  return list.filter((m) => m.nextReview <= today);
}

/** بعد جلسة مراجعة: حدّث جدولة العنصر */
export async function markReviewed(qid: string, correct: boolean): Promise<void> {
  const list = await getMistakes();
  const item = list.find((m) => m.qid === qid);
  if (!item) return;
  const nextCount = correct ? item.reviewCount + 1 : 0;
  const step = SRS_STEPS[Math.min(nextCount, SRS_STEPS.length - 1)];
  item.reviewCount = nextCount;
  item.nextReview = damascusDate(step);
  await writeJSON(MISTAKES_KEY, list);
}

export async function clearMistake(qid: string): Promise<void> {
  const list = await getMistakes();
  await writeJSON(
    MISTAKES_KEY,
    list.filter((m) => m.qid !== qid),
  );
}

// ─── نظام الأنشطة المركزي ───
// أي شاشة في التطبيق تستدعي recordActivity() عند إنجاز نشاط.
// الدكتور سيضيف أقسامًا جديدة لاحقًا — أضف نوع النشاط هنا فقط.

export type ActivityType =
  | 'bank_question'   // بنك الأسئلة (دورات الوطني، UWorld، الحالات، النماذج)
  | 'course_unit'     // وحدة كورس منجزة
  | 'daily_challenge' // التحدي اليومي
  | 'flashcard'       // جلسة بطاقات
  | 'study_guide'     // قسم دليل الدراسة
  | 'virtual_case';   // حالة مريض افتراضي منجزة

export interface ActivityStats {
  questionsAnswered: number;  // إجمالي الأسئلة المحلولة (بنك + تحدي)
  coursesCompleted: number;   // الوحدات/الدورات المنجزة
  challengesDone: number;     // التحديات اليومية المنجزة
  flashcardsReviewed: number; // البطاقات المراجعة
  testsCompleted: number;     // الاختبارات المنجزة
  casesCompleted: number;     // حالات المريض الافتراضي المنجزة
}

const ACTIVITY_KEY = 'activity_stats';

const DEFAULT_ACTIVITY: ActivityStats = {
  questionsAnswered: 0,
  coursesCompleted: 0,
  challengesDone: 0,
  flashcardsReviewed: 0,
  testsCompleted: 0,
  casesCompleted: 0,
};

export async function getActivityStats(): Promise<ActivityStats> {
  return readJSON<ActivityStats>(ACTIVITY_KEY, DEFAULT_ACTIVITY);
}

/** بيانات إضافية اختيارية لتسجيل النشاط (تُستخدم لفحص الأوسمة) */
export interface ActivityMeta {
  perfectScore?: boolean; // علامة 100% في الاختبار
  subjectId?: string; // معرّف المادة المجرّبة (لوسام المستكشف)
  correct?: number; // عدد الإجابات الصحيحة (لإتقان المواد)
  total?: number; // عدد الأسئلة الكلي (لإتقان المواد)
}

/** مفاتيح التتبع المتقدم (للإحصائيات) */
const ACTIVITY_HOURS_KEY = 'watani_activity_hours'; // {hour(0-23 دمشق): count}
const SUBJECT_MASTERY_KEY = 'watani_subject_mastery'; // {subjectId: {answered, correct}}

export interface SubjectMastery {
  answered: number;
  correct: number;
}

/** توزيع النشاط حسب الساعة (بتوقيت دمشق) */
export async function getActivityHours(): Promise<Record<string, number>> {
  try {
    const raw = await (
      await import('@react-native-async-storage/async-storage')
    ).default.getItem(ACTIVITY_HOURS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** إتقان المواد: {subjectId: {answered, correct}} */
export async function getSubjectMastery(): Promise<
  Record<string, SubjectMastery>
> {
  try {
    const raw = await (
      await import('@react-native-async-storage/async-storage')
    ).default.getItem(SUBJECT_MASTERY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * الوظيفة المركزية لتسجيل أي نشاط:
 * 1. تضيف XP وتحدّث المستوى والسلسلة
 * 2. تحدّث عدّادات الأنشطة (للصفحة الرئيسية)
 * 3. تفحص الأوسمة وتفتح الجديدة (مع نافذة احتفال)
 * 4. تزامن مع Firestore للصدارة (fire-and-forget)
 */
export async function recordActivity(
  type: ActivityType,
  xp: number,
  counts?: Partial<ActivityStats>,
  meta?: ActivityMeta,
): Promise<GamificationProfile> {
  const profile = await awardXP(xp, type === 'daily_challenge');

  // أثر تشخيصي لـ Crashlytics — يظهر مع أي عطل لاحق
  try {
    const { logEvent } = await import('../utils/crashReporting');
    logEvent('activity', { type, xp });
  } catch {
    /* تجاهل */
  }

  // تتبّع المواد المجرّبة لوسام المستكشف
  if (meta?.subjectId) {
    const set = new Set(profile.subjectsAttempted || []);
    set.add(meta.subjectId);
    const list = [...set].slice(0, 100);
    profile.subjectsAttempted = list;
    await writeJSON(PROFILE_KEY, profile);
  }

  let stats = await getActivityStats();
  if (counts) {
    const updated: ActivityStats = { ...stats };
    (Object.keys(counts) as (keyof ActivityStats)[]).forEach((k) => {
      updated[k] = (updated[k] || 0) + (counts[k] || 0);
    });
    await writeJSON(ACTIVITY_KEY, updated);
    stats = updated;
  }

  // تتبع متقدم للإحصائيات: الساعة + إتقان المواد (لا يحجب ولا يعطل)
  try {
    const AsyncStorageMod = (
      await import('@react-native-async-storage/async-storage')
    ).default;
    const { damascusHour } = await import('./achievements');
    const hr = String(damascusHour());
    const hoursRaw = await AsyncStorageMod.getItem(ACTIVITY_HOURS_KEY);
    const hours: Record<string, number> = hoursRaw ? JSON.parse(hoursRaw) : {};
    hours[hr] = (hours[hr] || 0) + 1;
    await AsyncStorageMod.setItem(ACTIVITY_HOURS_KEY, JSON.stringify(hours));
    if (meta?.subjectId && meta?.total) {
      const mRaw = await AsyncStorageMod.getItem(SUBJECT_MASTERY_KEY);
      const mastery: Record<string, SubjectMastery> = mRaw
        ? JSON.parse(mRaw)
        : {};
      const cur = mastery[meta.subjectId] || { answered: 0, correct: 0 };
      cur.answered += meta.total;
      cur.correct += meta.correct || 0;
      mastery[meta.subjectId] = cur;
      await AsyncStorageMod.setItem(
        SUBJECT_MASTERY_KEY,
        JSON.stringify(mastery),
      );
    }
  } catch {
    /* تجاهل */
  }

  // فحص الأوسمة — لا يحجب الواجهة ولا يعطل تسجيل النشاط
  try {
    const { checkAndUnlockBadges, addPerfectScore, damascusHour } = await import(
      './achievements'
    );
    const storedPerfect = meta?.perfectScore ? await addPerfectScore() : 0;
    await checkAndUnlockBadges({
      profile,
      stats,
      subjectsAttempted: profile.subjectsAttempted || [],
      perfectScores: storedPerfect,
      perfectScoreNow: !!meta?.perfectScore,
      hour: damascusHour(),
    });
  } catch {
    /* تجاهل */
  }

  // مزامنة الصدارة — لا تحجب الواجهة
  syncProfileToFirestore(profile).catch(() => {});
  return profile;
}

/** مزامنة الملف الشخصي مع Firestore (لظهور المستخدم في الصدارة) */
async function syncProfileToFirestore(profile: GamificationProfile): Promise<void> {
  try {
    const { FIREBASE } = await import('../config');
    // معرّف المستخدم: البريد إن وُجد، وإلا معرّف الجهاز
    let uid = '';
    let name = '';
    let email = '';
    try {
      const { getAuth } = await import('../auth/auth');
      const a = getAuth();
      if (a.type === 'user') {
        email = a.email;
        name = a.name || a.email;
        uid = `email_${a.email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      }
    } catch { /* guest */ }
    if (!uid) {
      try {
        const AsyncStorageMod = (await import('@react-native-async-storage/async-storage')).default;
        let deviceId = await AsyncStorageMod.getItem('watani_device_id');
        if (!deviceId) {
          deviceId = `dev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
          await AsyncStorageMod.setItem('watani_device_id', deviceId);
        }
        uid = deviceId;
        name = 'زائر';
      } catch { return; }
    }

    const docPath = `projects/${FIREBASE.projectId}/databases/${FIREBASE.databaseId}/documents/users/${encodeURIComponent(uid)}`;
    const url = `https://firestore.googleapis.com/v1/${docPath}?key=${FIREBASE.apiKey}`;
    const fields: Record<string, any> = {
      totalXP: { integerValue: String(profile.totalXP) },
      level: { integerValue: String(profile.level) },
      name: { stringValue: name },
      lastActive: { stringValue: damascusDate() },
    };
    if (email) fields.email = { stringValue: email };
    // جامعة المستخدم — تُستخدم في صدارة الجامعات
    try {
      const { getMyUniversity } = await import('../universities');
      const uni = getMyUniversity();
      if (uni) fields.university = { stringValue: uni };
    } catch {
      /* تجاهل */
    }
    // إحصائيات الأنشطة — تُجمَّع في لوحة المالك (تبويب الإحصائيات)
    try {
      const stats = await getActivityStats();
      fields.questionsAnswered = { integerValue: String(stats.questionsAnswered || 0) };
      fields.challengesDone = { integerValue: String(stats.challengesDone || 0) };
      fields.testsCompleted = { integerValue: String(stats.testsCompleted || 0) };
      fields.flashcardsReviewed = { integerValue: String(stats.flashcardsReviewed || 0) };
    } catch {
      /* تجاهل */
    }

    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
  } catch {
    // فشل المزامنة لا يعطل التطبيق
  }
}
