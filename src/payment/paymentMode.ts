// وضع الدفع الديناميكي — يُقرأ من app_config/payment في Firestore
// الدكتور يتحكم به من حساب الإدارة (مجاني/مدفوع) — لا قيم ثابتة
// مطابقة لمنطق الموقع الحي: mode === 'free' → مجاني ومفتوح بالكامل
import { FIREBASE } from '../config';
import { useEffect, useState } from 'react';

export type PaymentMode = 'paid' | 'free';

// القيمة الافتراضية: مجاني (القاعدة مضبوطة على free) — يُحدَّث من Firestore عند بدء التطبيق
let cachedMode: PaymentMode = 'free';
let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 دقائق

/** القراءة المتزامنة للوضع الحالي (تُستخدم في البوابات) */
export function isFreeMode(): boolean {
  return cachedMode === 'free';
}

export function getPaymentMode(): PaymentMode {
  return cachedMode;
}

// ── الاشتراك في تغييرات الوضع (W2) ──
// تُستخدم من الشاشات التي تعرض حالة الأقفال لتحديث واجهتها فور تغيّر الوضع.
// مثال:
//   useEffect(() => subscribePaymentMode(() => setMode(getPaymentMode())), []);
export type PaymentModeListener = (mode: PaymentMode) => void;

const listeners = new Set<PaymentModeListener>();

function emitIfChanged(prev: PaymentMode): void {
  if (cachedMode !== prev) {
    listeners.forEach(listener => {
      try {
        listener(cachedMode);
      } catch {
        /* مستمع واحد فاشل لا يكسر الباقي */
      }
    });
  }
}

/**
 * الاشتراك في تغييرات وضع الدفع — تُعيد دالة إلغاء الاشتراك.
 * يُستدعى المستمع كلما تغيّر الوضع فعليًا (refresh أو تعيين مباشر).
 */
export function subscribePaymentMode(listener: PaymentModeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * تعيين الوضع مباشرة (يُستخدم بعد تبديل الإدارة — يُحدّث الكاش فورًا بلا انتظار)
 * يُستدعى من لوحة المالك بعد كتابة القيمة في Firestore
 */
export function setPaymentModeDirect(mode: PaymentMode): void {
  const prev = cachedMode;
  cachedMode = mode;
  lastFetch = Date.now();
  emitIfChanged(prev);
}

/** تحديث الوضع من Firestore — تُستدعى عند بدء التطبيق ودوريًا */
export async function refreshPaymentMode(): Promise<PaymentMode> {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL) return cachedMode;
  lastFetch = now;
  const prev = cachedMode;
  try {
    if (!FIREBASE.apiKey) return cachedMode;
    const url =
      `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}` +
      `/databases/${FIREBASE.databaseId}/documents/app_config/payment?key=${FIREBASE.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return cachedMode;
    const doc = await res.json();
    const mode = doc?.fields?.mode?.stringValue;
    cachedMode = mode === 'free' ? 'free' : 'paid';
  } catch {
    // عند الفشل يبقى الوضع السابق — لا نكسر التطبيق
  }
  emitIfChanged(prev);
  return cachedMode;
}

// ── خطاف React اختياري للشاشات (W2) ──

/**
 * خطاف يعيد وضع الدفع الحالي ويعيد العرض تلقائيًا عند تغيّره.
 * يُستخدم في الشاشات التي تعرض أقفالًا أو حالات مرتبطة بالوضع.
 */
export function usePaymentMode(): PaymentMode {
  const [mode, setMode] = useState<PaymentMode>(cachedMode);
  useEffect(() => subscribePaymentMode(setMode), []);
  return mode;
}
