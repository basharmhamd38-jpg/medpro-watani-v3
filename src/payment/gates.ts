// بوابات نموذج الدفع المعتمد
// آخر دورتين وطني مجانيتان • الأقدم مقفلة تشويقيًا • الجامعات بنية بلا أسئلة
// UWorld والحالات والبطاقات والدليل: مجانية
// وضع الدفع (مجاني/مدفوع) يُقرأ ديناميكيًا من app_config/payment في Firestore
// ويتحكم به الدكتور من حساب الإدارة — لا قيم ثابتة هنا
import { isActivated } from '../auth/auth';
import { PAYMENT } from '../config';
import { isFreeMode } from './paymentMode';

export type GateResult = { open: boolean; reason?: string };

export function canOpenSession(sessionIndexInSection: number): GateResult {
  if (isFreeMode()) return { open: true };
  // الجلسات مرتبة من الأحدث للأقدم؛ أول جلستين مجانيتان
  if (sessionIndexInSection < PAYMENT.freeSessionsPerSection) return { open: true };
  if (isActivated()) return { open: true };
  return { open: false, reason: 'مقفلة — فعّل حسابك لفتح جميع الدورات' };
}

export function canOpenUniversityQuestions(): GateResult {
  if (isFreeMode()) return { open: true };
  if (isActivated()) return { open: true };
  return { open: false, reason: 'تصفح البنية مجاني — فتح أسئلة الجامعات يتطلب التفعيل' };
}

export function canAccessTab(tab: string): GateResult {
  if (isFreeMode()) return { open: true };
  // الكورسات: الدخول للقسم مجاني (أول 3 وحدات من كل كورس مجانية للتجربة) — القفل على مستوى الوحدة
  // المريض الافتراضي: محتوى تعليمي مجاني مثل بنك الأسئلة والبطاقات
  const free = ['bank', 'flashcards', 'guide', 'courses', 'virtual'];
  if (free.includes(tab)) return { open: true };
  if (isActivated()) return { open: true };
  const reasons: Record<string, string> = {
    home: 'قسم «الرئيسية» متاح حصريًا للحسابات المفعلة. يمكنك تصفح قسم «دورات الوطن» مجانًا، أو إدخال كود التفعيل الخاص بك للاستفادة من كامل الأقسام والتحديات.',
    challenge: 'قسم «التحدي اليومي» متاح حصريًا للحسابات المفعلة لكسب نقاط XP والمنافسة اليومية. يمكنك إدخال كود التفعيل للاستفادة من كامل التحديات.',
    leaderboard: 'قسم «الصدارة» متاح حصريًا للحسابات المفعلة للمنافسة على ترتيب طلاب الطب. يمكنك إدخال كود التفعيل.',
    progress: 'قسم «تقدمي» متاح حصريًا للحسابات المفعلة لحفظ سجل أخطائك وجدولة الأسئلة بنظام Anki. يمكنك إدخال كود التفعيل.',
  };
  return { open: false, reason: reasons[tab] || 'يتطلب التفعيل' };
}

// الكورسات: أول 3 وحدات من كل كورس مجانية للتجربة، والباقي يتطلب التفعيل
export function canOpenCourseUnit(unitOrder: number): GateResult {
  if (isFreeMode()) return { open: true };
  if (unitOrder <= 3) return { open: true };
  if (isActivated()) return { open: true };
  return { open: false, reason: 'الوحدات 1–3 مجانية للتجربة — فعّل حسابك لفتح باقي وحدات الكورس' };
}

// UWorld والحالات والنماذج والبطاقات والدليل: مجانية دائمًا
export function isFreeContent(kind: string): boolean {
  return ['uworld', 'clinical', 'training', 'flashcards', 'guide'].includes(kind);
}
