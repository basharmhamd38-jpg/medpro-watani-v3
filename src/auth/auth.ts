// حالة المستخدم والتفعيل — تخزين عبر AsyncStorage مع ذاكرة مؤقتة متزامنة
// (استُبدل MMKV بـAsyncStorage لتفادي مشاكل البناء الأصلي)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GOOGLE } from '../config';

export type AuthState =
  | { type: 'guest' }
  | { type: 'user'; email: string; name: string; activated: boolean; expiresAt: number };

const KEY = 'auth_state';
const DEVICE_KEY = 'watani_device_id';

// ذاكرة مؤقتة في الذاكرة للوصول المتزامن
const cache = new Map<string, string>();
let initialized = false;

// يُستدعى عند بدء التطبيق لتحميل القيم المحفوظة
export async function initAuthStorage(): Promise<void> {
  if (initialized) return;
  try {
    const values = await AsyncStorage.getMany([KEY, DEVICE_KEY, 'daily_reminder']);
    for (const [k, v] of Object.entries(values)) {
      if (v != null) cache.set(k, v);
    }
  } catch {
    // تجاهل أخطاء التخزين — القيم الافتراضية آمنة
  }
  initialized = true;
  // إعلام المشتركين بالحالة المستعادة من التخزين —
  // إصلاح: كان الملاح (RootNavigator) يبقى على guest بعد إعادة التشغيل
  // فيطلب التفعيل من جديد رغم وجود جلسة مخزنة.
  notifyAuth(getAuth());
}

function persist(key: string, value: string): void {
  cache.set(key, value);
  // حفظ غير متزامن (fire-and-forget)
  AsyncStorage.setItem(key, value).catch(() => {});
}

function removePersist(key: string): void {
  cache.delete(key);
  AsyncStorage.removeItem(key).catch(() => {});
}

export function getAuth(): AuthState {
  const raw = cache.get(KEY);
  if (!raw) return { type: 'guest' };
  try {
    return JSON.parse(raw);
  } catch {
    return { type: 'guest' };
  }
}

export function setAuth(state: AuthState): void {
  persist(KEY, JSON.stringify(state));
  notifyAuth(state);
}

export function signOut(): void {
  removePersist(KEY);
  notifyAuth({ type: 'guest' });
}

/**
 * إلغاء التفعيل محليًا مع بقاء الدخول — يُستخدم عند كشف ربط كود التفعيل
 * بجهاز آخر (سياسة: الكود يعمل على جهاز واحد فقط).
 * يُعلِم المشتركين فيُعيد الملاح توجيه المستخدم لطلب كود جديد.
 */
export function deactivateLocal(): void {
  const a = getAuth();
  if (a.type !== 'user') return;
  setAuth({ type: 'user', email: a.email, name: a.name, activated: false, expiresAt: 0 });
}

// تهيئة Google Sign-In للخروج (تُستدعى مرة واحدة فقط)
let googleConfigured = false;
function ensureGoogleConfigured(): void {
  if (googleConfigured) return;
  try {
    GoogleSignin.configure({
      webClientId: GOOGLE.webClientId,
      scopes: ['email', 'profile'],
    });
    googleConfigured = true;
  } catch {
    // لا يعطل تسجيل الخروج — المهم إتمام الخروج المحلي
  }
}

// تسجيل الخروج من حساب Google فعليًا — آمن دائمًا ولا يرمي استثناءً.
// يُستخدم عند تسجيل الخروج ليعود المستخدم لوضع الزائر داخل التطبيق.
export async function signOutGoogle(): Promise<void> {
  try {
    ensureGoogleConfigured();
    await GoogleSignin.signOut();
  } catch {
    // تجاهل أي فشل — الخروج المحلي يتم على أي حال
  }
}

// نظام اشتراك — يُعلِم الملاح تلقائيًا بتغيّر حالة الدخول
// (يُستخدم من RootNavigator للانتقال بين Welcome و Main بلا reset يدوي)
type AuthListener = (state: AuthState) => void;
const authListeners = new Set<AuthListener>();

export function subscribeAuth(listener: AuthListener): () => void {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

function notifyAuth(state: AuthState): void {
  for (const listener of authListeners) {
    try {
      listener(state);
    } catch {
      // لا يُعطَّل إقلاع التطبيق بسبب مستمع معطوب
    }
  }
}

export function isActivated(): boolean {
  const a = getAuth();
  if (a.type === 'guest') return false;
  return a.activated && a.expiresAt > Date.now();
}

// واجهة تخزين متوافقة مع الاستخدام السابق (للمكونات التي تستورد storage مباشرة)
export const storage = {
  getString(key: string): string | undefined {
    return cache.get(key);
  },
  getBoolean(key: string): boolean | undefined {
    const v = cache.get(key);
    if (v == null) return undefined;
    return v === 'true' || v === '1';
  },
  set(key: string, value: string | boolean | number): void {
    persist(key, String(value));
  },
  remove(key: string): void {
    removePersist(key);
  },
};

// حد الأجهزة: معرّف جهاز محلي + سجل
export function getDeviceId(): string {
  let id = cache.get(DEVICE_KEY);
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    persist(DEVICE_KEY, id);
  }
  return id;
}
