// طابور كتابة Firestore — تسلسل الكتابات لكل مسار مستند (mutex بسيط)
//
// المشكلة: كتابات PATCH لكامل المستند (SM-2، بومودورو) كانت تُرسل بتزامن —
// كل كتابة تحمل لقطة قديمة من الحالة، فالأخيرة تمحو ما كتبته الأولى (clobber).
//
// القاعدة: كل عمليات نفس المستند (docPath) تُنفَّذ واحدة تلو الأخرى بالترتيب.
// فشل عملية لا يكسر الطابور — العملية التالية تُنفَّذ على أي حال، والمنادي
// يرى خطأ عمليته الخاصة عبر الوعد المُعاد.
//
// نمط الاستخدام الصحيح مع PATCH متسلسل:
//   const next = await enqueueDocWrite(docPath, () => readModifyWriteLocal());
//   enqueueDocWrite(docPath, () => patchLatestFromLocal(docPath)).catch(() => {});
// أي أن الـPATCH نفسه يدخل الطابور ويعيد قراءة أحدث حالة محلية لحظة إرساله،
// فيحمل دائمًا لقطة أحدث من (أو مساوية لـ) الكتابات السابقة — لا محو متبادل.

const chains = new Map<string, Promise<unknown>>();

/**
 * نفّذ op بتسلسل مع باقي عمليات نفس المستند.
 * تُعاد نتيجة op للمنادي؛ السلسلة الداخلية تبلع الأخطاء لتبقى حية.
 */
export function enqueueDocWrite<T>(
  docPath: string,
  op: () => Promise<T>,
): Promise<T> {
  const prev = chains.get(docPath) ?? Promise.resolve();
  const next: Promise<T> = prev.then(op, op);
  // السلسلة تستمر مهما حدث — الخطأ يصل المنادي عبر next فقط
  chains.set(
    docPath,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}
