// تتبع الأعطال عبر Firebase Crashlytics — مع حماية كاملة:
// إن لم تكن الوحدة الأصلية مربوطة (أو فشل التهيئة) تُتجاهل كل الاستدعاءات بصمت.
import { getAuth } from '../auth/auth';

let crashlytics: any | null = null;
let attempted = false;

function getCrashlytics(): any | null {
  if (attempted) return crashlytics;
  attempted = true;
  try {
    // require ديناميكي حتى لا ينهار التطبيق إن لم تُربط الوحدة أصلًا
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-firebase/crashlytics');
    crashlytics = mod.default ? mod.default() : null;
  } catch {
    crashlytics = null;
  }
  return crashlytics;
}

/** تهيئة التتبع عند إقلاع التطبيق — تُستدعى مرة واحدة من App.tsx */
export function initCrashReporting(): void {
  try {
    const c = getCrashlytics();
    if (!c) return;
    // تفعيل الجمع (يحترم إعدادات المستخدم مستقبلًا)
    c.setCrashlyticsCollectionEnabled(true).catch(() => {});
    // ربط هوية المستخدم (بريد أو زائر) لتسهيل تشخيص الأعطال
    try {
      const a = getAuth();
      const uid =
        a.type === 'user' ? `email_${a.email.toLowerCase()}` : 'guest';
      c.setUserId(uid).catch(() => {});
      if (a.type === 'user') {
        c.setAttribute('user_email', a.email).catch(() => {});
      }
    } catch {
      /* تجاهل */
    }
    c.log('app_started').catch(() => {});
  } catch {
    /* لا يعطل الإقلاع أبدًا */
  }
}

/** تحديث هوية المستخدم بعد تسجيل الدخول/الخروج */
export function setCrashUser(): void {
  try {
    const c = getCrashlytics();
    if (!c) return;
    const a = getAuth();
    const uid = a.type === 'user' ? `email_${a.email.toLowerCase()}` : 'guest';
    c.setUserId(uid).catch(() => {});
  } catch {
    /* تجاهل */
  }
}

/**
 * أثر تنقّل (breadcrumb) — يُسجَّل مع أي عطل لاحق في Firebase Console.
 * أمثلة: 'question_answered', 'test_completed', 'challenge_started'
 */
export function logEvent(name: string, params?: Record<string, string | number | boolean>): void {
  try {
    const c = getCrashlytics();
    if (!c) return;
    const suffix = params
      ? ' ' +
        Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(' ')
      : '';
    c.log(`${name}${suffix}`.slice(0, 200)).catch(() => {});
  } catch {
    /* تجاهل */
  }
}

/** تسجيل خطأ غير قاتل مع سياق — يظهر في Crashlytics كـ non-fatal */
export function reportError(error: unknown, context?: string): void {
  try {
    const c = getCrashlytics();
    if (!c) return;
    const err = error instanceof Error ? error : new Error(String(error));
    if (context) {
      c.setAttribute('error_context', String(context).slice(0, 100)).catch(() => {});
    }
    c.recordError(err).catch(() => {});
  } catch {
    /* تجاهل */
  }
}
