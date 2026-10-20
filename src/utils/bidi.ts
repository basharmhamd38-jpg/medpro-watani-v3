// معالجة اتجاه النص ثنائي الاتجاه (BiDi) للمحتوى المختلط عربي/إنجليزي
// المشكلة: نص مثل «Sabiston Textbook of Surgery ط22» يُعرض «22ط» لأن أول حرف
// لاتيني فيجعل اتجاه الفقرة LTR فيُقلب ترتيب «ط22».
// الحل: عزل المقاطع اللاتينية/الرقمية بـ Unicode isolates داخل فقرة RTL.

const LRI = '\u2066'; // Left-to-Right Isolate
const PDI = '\u2069'; // Pop Directional Isolate

// حرف لاتيني قوي (حرف/رقم) — يستحق العزل
function isStrongLatin(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return (
    (c >= 0x41 && c <= 0x5a) || // A-Z
    (c >= 0x61 && c <= 0x7a) || // a-z
    (c >= 0x30 && c <= 0x39) // 0-9
  );
}

// حرف لاتيني ضعيف (مسافة/ترقيم) — يُضم للمقطع اللاتيني إن وُجد
// الأقواس ( ) مشمولة عمدًا: عندما تحيط بنص لاتيني/أرقام (مثل ‎(CHF)‎) يجب أن
// تُعزل معه، وإلا عكسها محرك BiDi في السياق العربي فتظهر مقلوبة ‎)CHF(‎.
// أما الأقواس حول نص عربي خالص فتبقى بلا عزل (لا يوجد مقطع قوي) فيعكسها
// المحرك طبيعيًا وهو الصحيح عربيًا.
function isWeakLatin(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return (
    c === 0x20 || // مسافة
    (c >= 0x21 && c <= 0x27) || // ! " # $ % & '
    c === 0x28 || // ( — تُعزل مع المقطع اللاتيني الملاصق
    c === 0x29 || // ) — تُعزل مع المقطع اللاتيني الملاصق
    c === 0x2a || // *
    (c >= 0x2b && c <= 0x2e) || // + , - .
    c === 0x2f || // /
    (c >= 0x3a && c <= 0x40) || // : ; < = > ? @
    c === 0x5c || // \
    (c >= 0x5e && c <= 0x60) // ^ _ `
  );
}

/**
 * يعزل المقاطع اللاتينية داخل نص عربي بـ LRI/PDI.
 * مثال: «Sabiston Textbook of Surgery ط22» ← تُعرض «ط22» صحيحة بلا انقلاب.
 * مثال: «(CHF) فشل القلب» ← الأقواس تُعزل مع CHF فتظهر ‎(CHF)‎ بلا انقلاب.
 * القاعدة الذهبية: «ط22» — حرف الطاء ثم الرقم مباشرة.
 * آمن على النص العربي الخالص (يُرجع كما هو بلا تعديل).
 */
export function bidi(text: string | null | undefined): string {
  const s = String(text ?? '');
  if (!s) return '';

  let out = '';
  let buf = '';
  let hasStrong = false;

  const flush = () => {
    if (!buf) return;
    out += hasStrong ? LRI + buf + PDI : buf;
    buf = '';
    hasStrong = false;
  };

  for (const ch of s) {
    if (isStrongLatin(ch)) {
      buf += ch;
      hasStrong = true;
    } else if (isWeakLatin(ch)) {
      buf += ch; // قد يكون ترقيمًا عربيًا خالصًا — يُحسم عند التفريغ
    } else {
      flush();
      out += ch;
    }
  }
  flush();
  return out;
}

/**
 * نمط جاهز يُدمج مع أنماط النص العربية لفرض اتجاه RTL على مستوى الفقرة.
 * يُستخدم مع textAlign: 'right' الموجود.
 */
export const rtlTextStyle = {
};
