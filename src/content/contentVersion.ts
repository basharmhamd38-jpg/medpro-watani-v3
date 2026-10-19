// إدارة إصدار المحتوى — من Cloudflare (بلا Firestore)
// التطبيق يقارن إصدار manifest.json البعيد بالمخزّن محليًا:
//   - متطابقان → الكاش المشفّر صالح (يعمل أوفلاين)
//   - مختلفان → الكاش قديم → يُجلب الجديد من Cloudflare
//   - تعذّر الفحص (أوفلاين) → يُفترض الصلاحية (لا نكسر التطبيق)

import AsyncStorage from '@react-native-async-storage/async-storage';

const CDN_BASE = 'https://watani-content.pages.dev/v1';
const LOCAL_VERSION_KEY = 'content_version_local';

// ذاكرة الجلسة لفحص الإصدار — 5 دقائق
let memVersion: { at: number; version: string | null } | null = null;
const MEM_VERSION_TTL_MS = 5 * 60_000;

/** قراءة إصدار المحتوى من Cloudflare manifest — null عند الفشل */
export async function getRemoteContentVersion(): Promise<string | null> {
  if (memVersion && Date.now() - memVersion.at < MEM_VERSION_TTL_MS) {
    return memVersion.version;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    let res: Response;
    try {
      res = await fetch(`${CDN_BASE}/manifest.json`, { signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      memVersion = { at: Date.now(), version: null };
      return null;
    }
    const manifest = await res.json();
    const version = typeof manifest?.version === 'string' ? manifest.version : null;
    memVersion = { at: Date.now(), version };
    return version;
  } catch {
    memVersion = { at: Date.now(), version: null };
    return null;
  }
}

/** الإصدار المحلي المخزّن (آخر إصدار جُلب بنجاح) */
export async function getLocalContentVersion(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LOCAL_VERSION_KEY);
  } catch {
    return null;
  }
}

/** حفظ الإصدار المحلي بعد جلب ناجح */
export async function setLocalContentVersion(v: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCAL_VERSION_KEY, v);
  } catch {
    /* تجاهل */
  }
}

/**
 * هل الكاش المحلي محدّث؟
 *  - تعذّر الفحص (أوفلاين) → true (نستخدم الكاش ولا نكسر التطبيق)
 *  - لا إصدار محلي مسجّل → false (أول جلب)
 *  - وإلا: مقارنة البعيد بالمحلي
 */
export async function isCacheFresh(): Promise<boolean> {
  try {
    const [remote, local] = await Promise.all([
      getRemoteContentVersion(),
      getLocalContentVersion(),
    ]);
    if (remote === null) return true;
    if (local === null) return false;
    return remote === local;
  } catch {
    return true;
  }
}

/** إبطال ذاكرة فحص الإصدار (للاختبار/التشخيص) */
export function invalidateVersionMemory(): void {
  memVersion = null;
}
