// تنسيق الأرقام الموحد للواجهة العربية — أرقام عربية-هندية (٠١٢٣٤٥٦٧٨٩)
// القاعدة (W14): كل رقم يواجه المستخدم في الواجهة العربية يُعرض بهذا المساعد
// بدل التنقل بين 'en-US' و'ar-EG' والأرقام الخام في الشاشات المختلفة.

/**
 * ينسّق رقمًا للعرض في الواجهة العربية: فواصل آلاف + أرقام عربية-هندية.
 * مثال: formatNumber(1234567) ← «١٬٢٣٤٬٥٦٧»
 */
export function formatNumber(n: number | string | null | undefined): string {
  const num = typeof n === 'string' ? Number(n) : (n ?? 0);
  if (!Number.isFinite(num)) return '٠';
  return num.toLocaleString('ar-EG');
}

/**
 * اختصار للأعداد الكبيرة في الشارات الضيقة: 1.2K ← «١٫٢ ألف»
 * يُستخدم فقط حيث لا تتسع المساحة للرقم الكامل.
 */
export function formatCompact(n: number | null | undefined): string {
  const num = n ?? 0;
  if (!Number.isFinite(num)) return '٠';
  if (num < 1000) return formatNumber(num);
  if (num < 1_000_000) {
    const v = num / 1000;
    return `${v.toLocaleString('ar-EG', { maximumFractionDigits: 1 })} ألف`;
  }
  const v = num / 1_000_000;
  return `${v.toLocaleString('ar-EG', { maximumFractionDigits: 1 })} مليون`;
}
