// حارس الحصة — تراجع أسّي + كسر دائرة (circuit breaker) عند 429
//
// المشكلة: عند استنفاد حصة Firestore/CDN (429) كانت كل شاشة تُعيد ضرب الشبكة
// بملفات multi-MB — أسوأ سلوك ممكن أثناء العطل (يُطيل الاستنفاد).
//
// القاعدة:
// - كل استجابة 429 تُسجَّل للمصدر (firestore / cloudflare / ...).
// - بعد 3 استجابات 429 متتالية لنفس المصدر: يُتخطَّى المصدر 5 دقائق
//   (أي محاولة تُرمى فورًا بـQuotaExhaustedError — بلا أي طلب شبكة).
// - قبل ذلك: إعادة محاولة عند 429 بتأخير أسّي (1s ثم 2s).
// - أي نتيجة أخرى (نجاح أو خطأ مختلف) تصفّر عدّاد الـ429.
//
// الرسالة الودّية للواجهة: «الحصة مستنفدة مؤقتًا» (QUOTA_MESSAGE).

/** الرسالة الودّية التي تعرضها الواجهة عند استنفاد الحصة */
export const QUOTA_MESSAGE = 'الحصة مستنفدة مؤقتًا';

/** يُرمى عندما يكون المصدر في فترة تبريد (يُتخطَّى بلا طلب شبكة) */
export class QuotaExhaustedError extends Error {
  readonly source: string;
  constructor(source: string) {
    super(QUOTA_MESSAGE);
    this.name = 'QuotaExhaustedError';
    this.source = source;
  }
}

const MAX_CONSECUTIVE_429 = 3; // بعدها: تبريد
const COOLDOWN_MS = 5 * 60_000; // 5 دقائق
const MAX_RETRIES_429 = 2; // محاولتان إضافيتان بتأخير أسّي

interface SourceState {
  consecutive429: number;
  cooldownUntil: number; // طابع زمني — 0 = بلا تبريد
}

const states = new Map<string, SourceState>();

function stateOf(source: string): SourceState {
  let s = states.get(source);
  if (!s) {
    s = { consecutive429: 0, cooldownUntil: 0 };
    states.set(source, s);
  }
  return s;
}

/** هل المصدر في فترة تبريد الآن؟ (للاستعلام من الواجهة قبل العرض) */
export function isSourceBlocked(source: string): boolean {
  return Date.now() < stateOf(source).cooldownUntil;
}

/** الرسالة الودّية إن كان المصدر محظورًا الآن، وإلا null */
export function quotaMessage(source: string): string | null {
  return isSourceBlocked(source) ? QUOTA_MESSAGE : null;
}

/**
 * تسجيل نتيجة طلب لشبكة مصدر:
 * - 429 → يرفع العدّاد، وبعد 3 متتالية يبدأ تبريد 5 دقائق.
 * - غير ذلك (بما فيه فشل الشبكة) → يصفّر عدّاد الـ429.
 */
export function recordResult(source: string, status: number | null): void {
  const s = stateOf(source);
  if (status === 429) {
    s.consecutive429 += 1;
    if (s.consecutive429 >= MAX_CONSECUTIVE_429) {
      s.cooldownUntil = Date.now() + COOLDOWN_MS;
      s.consecutive429 = 0;
    }
  } else {
    s.consecutive429 = 0;
    // فترة التبريد النشطة لا تُلغى هنا — تنتهي بانقضاء وقتها فقط
  }
}

/** تأخير التراجع الأسّي للمحاولة رقم attempt (0-based): 1s، 2s، 4s… بحد 30s */
export function backoffDelayMs(attempt: number): number {
  return Math.min(1000 * 2 ** Math.max(0, attempt), 30_000);
}

const sleep = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface QuotaFetchOptions {
  /** مهلة كل محاولة بالميلي ثانية (افتراضي 15s) */
  timeoutMs?: number;
  /** عدد إعادات المحاولة عند 429 (افتراضي 2) */
  retries429?: number;
}

/**
 * fetch محمي بحارس الحصة:
 * 1) إن كان المصدر في تبريد → يرمي QuotaExhaustedError فورًا (بلا شبكة).
 * 2) مهلة عبر AbortController لكل محاولة.
 * 3) عند 429: تراجع أسّي ثم إعادة (حتى retries429).
 * 4) كل نتيجة تُسجَّل — 3 متتالية من 429 تُشغّل التبريد.
 *
 * الأخطاء: QuotaExhaustedError عند التبريد، أو Error('‎<source> network: timeout/failed')
 * عند فشل الشبكة. الاستجابات غير الناجحة (غير 429) تُعاد كما هي للمنادي.
 */
export async function fetchWithQuota(
  source: string,
  url: string,
  init?: RequestInit,
  opts: QuotaFetchOptions = {},
): Promise<Response> {
  if (isSourceBlocked(source)) throw new QuotaExhaustedError(source);
  const timeoutMs = opts.timeoutMs ?? 15000;
  const retries = opts.retries429 ?? MAX_RETRIES_429;

  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: ctrl.signal });
    } catch (e: any) {
      clearTimeout(timer);
      recordResult(source, null);
      throw new Error(
        `${source} network: ${e?.name === 'AbortError' ? 'timeout' : 'failed'}`,
      );
    }
    clearTimeout(timer);
    recordResult(source, res.status);
    if (res.status === 429 && attempt < retries) {
      await sleep(backoffDelayMs(attempt));
      continue;
    }
    return res;
  }
}
