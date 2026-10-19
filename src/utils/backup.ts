// النسخ الاحتياطي — تصدير/استيراد بيانات المستخدم كـ JSON
// المفاتيح المغطاة: الملف الشخصي، الإحصائيات، الأوسمة، المفضلة، الملاحظات،
// الأخطاء، سجل التحديات، تقدم المريض الافتراضي
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  profile: 'gamification_profile',
  activity: 'activity_stats',
  badges: 'watani_unlocked_badges',
  badgeDates: 'watani_badge_dates',
  favorites: 'watani_favorites',
  notes: 'watani_notes',
  mistakes: 'challenge_mistakes',
  challengeHistory: 'daily_challenge_history',
  virtualProgress: 'virtual_case_progress',
} as const;

const SNAPSHOTS_KEY = 'watani_backup_snapshots';

export interface BackupData {
  version: 1;
  exportedAt: string;
  app: string;
  data: Record<string, string | null>;
}

export interface BackupSnapshot {
  at: string; // ISO
  size: number; // أحرف
}

/** تصدير كل البيانات إلى كائن JSON */
export async function exportBackup(): Promise<BackupData> {
  const data: Record<string, string | null> = {};
  for (const k of Object.values(KEYS)) {
    try {
      data[k] = await AsyncStorage.getItem(k);
    } catch {
      data[k] = null;
    }
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'medpro-watani',
    data,
  };
}

/** استيراد نسخة احتياطية — يكتب كل المفاتيح (يستبدل الحالي) */
export async function importBackup(backup: BackupData): Promise<void> {
  if (!backup || backup.app !== 'medpro-watani' || !backup.data) {
    throw new Error('ملف النسخة غير صالح');
  }
  const pairs: [string, string][] = [];
  for (const [k, v] of Object.entries(backup.data)) {
    if (typeof v === 'string') pairs.push([k, v]);
  }
  if (pairs.length === 0) throw new Error('النسخة فارغة');
  for (const [k, v] of pairs) {
    await AsyncStorage.setItem(k, v);
  }
}

/** حفظ لقطة في التخزين المحلي */
export async function saveSnapshot(): Promise<BackupSnapshot> {
  const backup = await exportBackup();
  const json = JSON.stringify(backup);
  const snap: BackupSnapshot = {
    at: backup.exportedAt,
    size: json.length,
  };
  let list: BackupSnapshot[] = [];
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOTS_KEY);
    if (raw) list = JSON.parse(raw);
  } catch {
    /* تجاهل */
  }
  // الاحتفاظ بآخر 5 لقطات (البيانات الكاملة في اللقطة نفسها غير محفوظة لتوفير المساحة —
  // نحفظ اللقطة الأخيرة فقط كنص)
  await AsyncStorage.setItem(
    SNAPSHOTS_KEY + '_latest',
    json.slice(0, 500000), // حد أمان 500KB
  );
  list = [snap, ...list].slice(0, 5);
  await AsyncStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(list));
  return snap;
}

/** آخر لقطة محفوظة كنص JSON (للاستعادة السريعة) */
export async function getLatestSnapshotJson(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SNAPSHOTS_KEY + '_latest');
  } catch {
    return null;
  }
}

export async function getSnapshots(): Promise<BackupSnapshot[]> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** تحويل النسخة إلى نص للمشاركة */
export function backupToText(backup: BackupData): string {
  return JSON.stringify(backup);
}

/** تحليل نص مستورد إلى نسخة */
export function parseBackupText(text: string): BackupData {
  const obj = JSON.parse(text.trim());
  if (!obj || obj.app !== 'medpro-watani' || typeof obj.data !== 'object') {
    throw new Error('ملف النسخة غير صالح');
  }
  return obj as BackupData;
}
