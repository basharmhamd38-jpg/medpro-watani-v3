// بيانات الجامعات — تُقرأ ديناميكيًا من Cloudflare (الـmanifest) مع fallback محلي
// المصدر: https://watani-content.pages.dev/v1/manifest.json
// البنية: files['dawrat_jami3at/<uni>/<subject>.json'] = {count, ...}
import { CDN_BASE } from '../../content/cloudflare';
import { formatNumber } from '../../utils/numbers';

export interface University {
  id: string;
  name: string;
  /** عدد الأسئلة — null تعني «قيد التجهيز» (لا بنك مرفوع بعد) */
  count: number | null;
}

// القيم الاحتياطية (تُستخدم أوفلاين أو عند تعذر القراءة) — مطابقة لآخر أعداد معروفة على Cloudflare.
export const FALLBACK_UNIVERSITIES: University[] = [
  { id: 'damascus', name: 'جامعة دمشق', count: 26133 },
  { id: 'hama', name: 'جامعة حماة', count: 8273 },
  { id: 'homs', name: 'جامعة حمص', count: 2461 },
  { id: 'aleppo', name: 'جامعة حلب', count: 2446 },
  { id: 'lattakia', name: 'جامعة اللاذقية', count: 698 },
];

const UNI_NAMES: Record<string, string> = {
  damascus: 'جامعة دمشق',
  hama: 'جامعة حماة',
  homs: 'جامعة حمص',
  aleppo: 'جامعة حلب',
  lattakia: 'جامعة اللاذقية',
};

const UNI_ORDER = ['damascus', 'hama', 'homs', 'aleppo', 'lattakia'];

/** تنسيق العدد: 42581 ← «٤٢٬٥٨١ سؤالًا» */
export function formatCount(n: number): string {
  return `${formatNumber(n)} سؤالًا`;
}

/**
 * جلب الجامعات من Cloudflare manifest — الأعداد الحقيقية من الملفات.
 * عند أي فشل (بلا اتصال) تُعاد القيم الاحتياطية — لا رمي استثناء.
 */
export async function fetchUniversities(): Promise<University[]> {
  try {
    const res = await fetch(`${CDN_BASE}/manifest.json`);
    if (!res.ok) return FALLBACK_UNIVERSITIES;
    const m = await res.json();
    const files = m.files || {};
    const counts: Record<string, number> = {};
    for (const [path, info] of Object.entries(files)) {
      const mm = /^dawrat_jami3at\/([^/]+)\//.exec(path);
      if (!mm) continue;
      const uni = mm[1];
      const c = (info as any)?.count;
      if (typeof c === 'number') counts[uni] = (counts[uni] || 0) + c;
    }
    if (Object.keys(counts).length === 0) return FALLBACK_UNIVERSITIES;
    const result: University[] = [];
    for (const id of UNI_ORDER) {
      result.push({
        id,
        name: UNI_NAMES[id] || id,
        count: typeof counts[id] === 'number' ? counts[id] : null,
      });
    }
    // أي جامعة جديدة غير متوقعة تُلحق بالنهاية
    for (const id of Object.keys(counts)) {
      if (!UNI_ORDER.includes(id)) {
        result.push({ id, name: UNI_NAMES[id] || id, count: counts[id] });
      }
    }
    return result;
  } catch {
    return FALLBACK_UNIVERSITIES;
  }
}
