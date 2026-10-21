// بوابات نموذج التفعيل المعتمد (قرار الدكتور — 21 أكتوبر 2026)
// كود واحد يفتح كل المدفوع • كل بنك فيه المادة الأولى مجانية للتجربة والباقي مدفوع
// الصدارة والمريض الافتراضي وباقي الأقسام والتبويبات: مفتوحة كاملة بلا كود
// القفل الوحيد المتبقي: مواد بنوك الأسئلة بعد المادة الأولى
// وضع الدفع (مجاني/مدفوع) يُقرأ ديناميكيًا من app_config/payment في Firestore
// ويتحكم به الدكتور من حساب الإدارة — عند «مجاني» يُفتح كل شيء كما هو
import { isActivated } from '../auth/auth';
import { isFreeMode } from './paymentMode';

export type GateResult = { open: boolean; reason?: string };

// كل التبويبات والأقسام مفتوحة للجميع — لا أقفال خارج بنوك الأسئلة
export function canAccessTab(_tab: string): GateResult {
  return { open: true };
}

// وحدات الكورسات مفتوحة بالكامل (القفل الوحيد داخل بنوك الأسئلة)
export function canOpenCourseUnit(_unitOrder: number): GateResult {
  return { open: true };
}

/**
 * قفل بنوك الأسئلة الوحيد: المادة الأولى بترتيب قائمة مواد البنك مجانية
 * بالكامل، وباقي المواد تتطلب التفعيل. orderedSubjectIds = قائمة مواد
 * البنك بالترتيب المعروض نفسه.
 */
export function canOpenBankSubject(
  orderedSubjectIds: string[],
  subjectId: string,
): GateResult {
  if (isFreeMode()) return { open: true };
  if (isActivated()) return { open: true };
  if (orderedSubjectIds.length > 0 && orderedSubjectIds[0] === subjectId) {
    return { open: true };
  }
  return {
    open: false,
    reason: 'هذه المادة مقفلة — المادة الأولى في البنك مجانية للتجربة، فعّل حسابك لفتح جميع المواد',
  };
}

// UWorld والحالات والنماذج والبطاقات والدليل: مجانية دائمًا
export function isFreeContent(kind: string): boolean {
  return ['uworld', 'clinical', 'training', 'flashcards', 'guide'].includes(kind);
}
