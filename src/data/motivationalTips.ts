// مكتبة النصائح التحفيزية — شخصية الروبوت المحفزة
// تُعرض نصيحة واحدة يوميًا بالتناوب حسب التاريخ

export type TipCategory = 'motivation' | 'study' | 'health' | 'success';
export type MascotExpression = 'main' | 'happy' | 'wink' | 'thinking';

export interface MotivationalTip {
  text: string;
  category: TipCategory;
}

export const CATEGORY_LABELS: Record<TipCategory, string> = {
  motivation: 'تحفيز',
  study: 'نصيحة دراسية',
  health: 'صحتك أولًا',
  success: 'طريق النجاح',
};

export const TIPS: MotivationalTip[] = [
  // ─── تحفيز (26) ───
  { text: 'النجاح في الطب يبدأ بخطوة واحدة يوميًا — المهم أن لا تتوقف.', category: 'motivation' },
  { text: 'كل سؤال تحله اليوم، هو مريض ستنقذه غدًا.', category: 'motivation' },
  { text: 'لا تقارن بدايتك بمنتصف طريق الآخرين.', category: 'motivation' },
  { text: 'الثبات على الوتيرة أهم من الحماس المؤقت.', category: 'motivation' },
  { text: 'التعب اليوم هو راحة الغد — استمر.', category: 'motivation' },
  { text: 'أنت لا تدرس للامتحان فقط، أنت تُبنى كطبيب.', category: 'motivation' },
  { text: 'الفشل في سؤال تدريبي أفضل ألف مرة من الفشل في الامتحان.', category: 'motivation' },
  { text: 'العقل مثل العضلة — كلما درّبته قوي.', category: 'motivation' },
  { text: 'تذكّر لماذا بدأت عندما تشعر بالرغبة في التوقف.', category: 'motivation' },
  { text: 'الأطباء العظماء كانوا يومًا طلابًا يشعرون بما تشعر به الآن.', category: 'motivation' },
  { text: 'الصبر على الدراسة اليوم يصنع الثقة في قاعة الامتحان.', category: 'motivation' },
  { text: 'لا يوجد طريق مختصر للتميز — لكن الطريق يستحق.', category: 'motivation' },
  { text: 'كل دقيقة مذاكرة هي استثمار في مستقبلك.', category: 'motivation' },
  { text: 'الشك جزء من الرحلة — تجاوزه بالعمل لا بالقلق.', category: 'motivation' },
  { text: 'أنت أقوى من كل لحظة يأس مررت بها.', category: 'motivation' },
  { text: 'النجاح ليس موهبة، بل عادة يومية.', category: 'motivation' },
  { text: 'عندما تتعب، تذكّر المريض الذي سيحتاجك يومًا.', category: 'motivation' },
  { text: 'الطريق الطويل يُقطع بخطوات قصيرة ثابتة.', category: 'motivation' },
  { text: 'لا تنتظر التحفيز لتبدأ — ابدأ وسيأتي التحفيز.', category: 'motivation' },
  { text: 'كل طبيب ناجح مرّ بليالٍ ظن فيها أنه لن ينجح.', category: 'motivation' },
  { text: 'اجعل هدفك واضحًا أمام عينيك كل صباح.', category: 'motivation' },
  { text: 'التقدم البطيء أفضل من التوقف الكامل.', category: 'motivation' },
  { text: 'أنت تزرع اليوم ما ستحصده في مستقبلك المهني.', category: 'motivation' },
  { text: 'القوة الحقيقية في الاستمرار عندما لا يراك أحد.', category: 'motivation' },
  { text: 'امتحان واحد لا يحدد قيمتك — لكن اجتهادك يحدد مستقبلك.', category: 'motivation' },
  { text: 'كُن فخورًا بكل يوم تلتزم فيه بخطتك.', category: 'motivation' },

  // ─── نصائح دراسية (28) ───
  { text: 'المراجعة اليومية القصيرة تهزم الحفظ المكثف في الليلة الأخيرة.', category: 'study' },
  { text: 'اشرح المعلومة بصوت عالٍ — إن استطعت شرحها فقد فهمتها.', category: 'study' },
  { text: 'ركّز على فهم الآلية لا حفظ النتيجة — الفهم يبقى والحفظ يتبخر.', category: 'study' },
  { text: 'حل الأسئلة أهم من إعادة قراءة الملخصات.', category: 'study' },
  { text: 'قسّم المادة الكبيرة إلى وحدات صغيرة — العقل يحب الإنجازات المتتالية.', category: 'study' },
  { text: 'ادرس في جلسات 25 دقيقة مع استراحة 5 دقائق (تقنية بومودورو).', category: 'study' },
  { text: 'اكتب ملاحظاتك بيدك — الكتابة تثبّت المعلومة أكثر من القراءة.', category: 'study' },
  { text: 'راجع أخطاءك أولًا قبل أن تبدأ مادة جديدة.', category: 'study' },
  { text: 'اربط المعلومة الجديدة بحالة سريرية — القصة لا تُنسى.', category: 'study' },
  { text: 'لا تدرس وأنت مرهق — ساعة بتركيز أفضل من ثلاث بلا تركيز.', category: 'study' },
  { text: 'استخدم الخرائط الذهنية لربط المواضيع المتشابكة.', category: 'study' },
  { text: 'ابدأ يومك بأصعب مادة — طاقتك في ذروتها صباحًا.', category: 'study' },
  { text: 'كرر المعلومة بعد ساعة، ثم بعد يوم، ثم بعد أسبوع — التكرار المتباعد سحر.', category: 'study' },
  { text: 'علّم زميلك ما تعلمته — التعليم أعمق طرق الفهم.', category: 'study' },
  { text: 'ضع هاتفك في غرفة أخرى أثناء الدراسة — التشتت عدو التركيز.', category: 'study' },
  { text: 'حدد هدفًا واضحًا لكل جلسة: "سأنهي 50 سؤال قلبية".', category: 'study' },
  { text: 'لا تقفز بين المواد — أنهِ وحدة كاملة ثم انتقل.', category: 'study' },
  { text: 'سجّل أسئلتك الصعبة في المفضلة وراجعها أسبوعيًا.', category: 'study' },
  { text: 'اقرأ السؤال مرتين قبل الإجابة — نصف الأخطاء من سوء القراءة.', category: 'study' },
  { text: 'في الخيارات المتشابهة ابحث عن الكلمة المفتاحية الفارقة.', category: 'study' },
  { text: 'نم جيدًا ليلة الامتحان — النوم يثبّت الذاكرة.', category: 'study' },
  { text: 'راجع الجداول والأرقام المهمة في آخر أسبوع.', category: 'study' },
  { text: 'لا تحفظ القوائم الطويلة — افهم المنطق وراءها.', category: 'study' },
  { text: 'استخدم الألوان في ملاحظاتك — البصر ذاكرة قوية.', category: 'study' },
  { text: 'اختبر نفسك باستمرار — الاختبار الذاتي أقوى من إعادة القراءة.', category: 'study' },
  { text: 'خذ يوم راحة أسبوعيًا — العقل المرهق لا يتعلم.', category: 'study' },
  { text: 'سجّل وقت دراستك الفعلي — ما يُقاس يتحسّن.', category: 'study' },
  { text: 'ابدأ بالأسئلة السهلة في الامتحان لبناء الثقة ثم عد للصعبة.', category: 'study' },

  // ─── صحتك أولًا (24) ───
  { text: 'اشرب الماء باستمرار — الجفاف يضعف التركيز بنسبة كبيرة.', category: 'health' },
  { text: 'تحرّك كل ساعة — المشي 5 دقائق ينشّط الدورة الدموية والعقل.', category: 'health' },
  { text: 'نم 7-8 ساعات — النوم الجيد أهم من ساعة مذاكرة إضافية.', category: 'health' },
  { text: 'تناول وجبة فطور حقيقية — عقلك يحتاج وقودًا.', category: 'health' },
  { text: 'قلل الكافيين مساءً — نومك أثمن من سهرك.', category: 'health' },
  { text: 'مارس رياضة خفيفة 20 دقيقة يوميًا — تحسّن المزاج والذاكرة.', category: 'health' },
  { text: 'خذ نفسًا عميقًا عند التوتر — 4 ثوانٍ شهيق، 4 ثوانٍ زفير.', category: 'health' },
  { text: 'لا تهمل وجباتك بحجة الدراسة — الجوع يسرق تركيزك.', category: 'health' },
  { text: 'اجلس بوضعية صحيحة — ظهرك سيشكرك بعد سنوات.', category: 'health' },
  { text: 'اخرج للشمس يوميًا — فيتامين د يحسّن المزاج.', category: 'health' },
  { text: 'تحدث مع أصدقائك — الدعم الاجتماعي يخفف ضغط الدراسة.', category: 'health' },
  { text: 'لا تقارن نفسك بالآخرين على السوشيال ميديا — كل له رحلته.', category: 'health' },
  { text: 'استمع لجسمك — الصداع المستمر إشارة للتوقف والراحة.', category: 'health' },
  { text: 'قلل السكريات — ترفع طاقتك سريعًا ثم تُسقطك.', category: 'health' },
  { text: 'المكسرات والفواكه وقود ممتاز لجلسات الدراسة الطويلة.', category: 'health' },
  { text: 'ابتعد عن الشاشة قبل النوم بساعة — نوم أعمق وتركيز أفضل.', category: 'health' },
  { text: 'الضحك دواء — شاهد شيئًا ممتعًا في استراحتك.', category: 'health' },
  { text: 'لا تدرس وأنت مريض — الراحة يومًا أفضل من أسبوع بلا تركيز.', category: 'health' },
  { text: 'نظّم مكان دراستك — الفوضى تشتت الذهن.', category: 'health' },
  { text: 'كافئ نفسك بعد كل إنجاز — التحفيز الذاتي وقود الاستمرار.', category: 'health' },
  { text: 'تذكّر: صحتك رأس مالك الحقيقي كطبيب مستقبلي.', category: 'health' },
  { text: 'الإرهاق ليس بطولة — الراحة الذكية جزء من الخطة.', category: 'health' },
  { text: 'اشرب شاي الأعشاب مساءً بدل المنبهات.', category: 'health' },
  { text: 'مدد عضلات رقبتك وكتفيك بين الجلسات.', category: 'health' },

  // ─── طريق النجاح (26) ───
  { text: 'الامتحان الوطني محطة — وليست نهاية الطريق.', category: 'success' },
  { text: 'كل الأطباء الذين تعجب بهم اجتازوا ما أنت فيه الآن.', category: 'success' },
  { text: 'الثقة تُبنى بالتحضير — كل ساعة دراسة تزيد ثقتك.', category: 'success' },
  { text: 'لا تخف من الأسئلة الصعبة — هي التي تميز المتفوقين.', category: 'success' },
  { text: 'خطط لأسوأ الاحتمالات واعمل لأفضلها.', category: 'success' },
  { text: 'النجاح في الطب = علم + أخلاق + إنسانية.', category: 'success' },
  { text: 'تخيّل نفسك يوم النتائج — هذا الشعور يستحق التعب.', category: 'success' },
  { text: 'اسأل من سبقوك — خبرتهم تختصر عليك الطريق.', category: 'success' },
  { text: 'ضع خطة واقعية والتزم بها — الخطة السيئة الملتزم بها أفضل من المثالية المهملة.', category: 'success' },
  { text: 'راجع امتحانات السنوات السابقة — الأنماط تتكرر.', category: 'success' },
  { text: 'لا تؤجل المراجعة النهائية لآخر لحظة.', category: 'success' },
  { text: 'ثق بتحضيرك يوم الامتحان — القلق لا يضيف معلومة.', category: 'success' },
  { text: 'اقرأ كل خيارات السؤال قبل الاختيار — الإجابة الصحيحة قد تكون الأخيرة.', category: 'success' },
  { text: 'إدارة الوقت في الامتحان مهارة تُتدرب عليها.', category: 'success' },
  { text: 'لا تغيّر إجابتك إلا إذا كنت متأكدًا — حدسك الأول غالبًا صحيح.', category: 'success' },
  { text: 'الطبيب الناجح يتعلم من كل مريض — ابدأ هذه العادة من الآن.', category: 'success' },
  { text: 'التميز في الطب رحلة عمر — الامتحان أول خطواتها.', category: 'success' },
  { text: 'احتفل بإنجازاتك الصغيرة — كل مادة تُنهيها انتصار.', category: 'success' },
  { text: 'تذكّر مرضاك المستقبليين عندما تضعف همتك.', category: 'success' },
  { text: 'العلم أمانة — ادرس بإتقان لأن حياة الناس ستكون بين يديك.', category: 'success' },
  { text: 'كن الطبيب الذي تتمنى أن يعالج أهلك.', category: 'success' },
  { text: 'التفوق ليس حظًا — بل تحضير يلتقي بالفرصة.', category: 'success' },
  { text: 'يومًا ما ستشكر نفسك لأنك لم تستسلم اليوم.', category: 'success' },
  { text: 'الطب مهنة الإنسانية الأولى — فخورون بك.', category: 'success' },
  { text: 'استمر — القمة تنتظر من لا يتوقف.', category: 'success' },
  { text: 'نجاحك سيلهم من بعدك — اجعله قصة تُروى.', category: 'success' },
];

/** نصيحة اليوم — تتناوب حسب التاريخ */
export function getTipOfDay(date: Date = new Date()): MotivationalTip {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return TIPS[dayOfYear % TIPS.length];
}

/** نصيحة عشوائية من فئة معينة */
export function getRandomTip(category?: TipCategory): MotivationalTip {
  const pool = category ? TIPS.filter((t) => t.category === category) : TIPS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** رسالة تهنئة بعد الاختبار حسب النسبة */
export function getCongratsMessage(pct: number): { text: string; expression: MascotExpression } {
  if (pct >= 90) {
    return { text: 'مذهل! أداء استثنائي يليق بطبيب المستقبل. استمر على هذا المستوى!', expression: 'happy' };
  }
  if (pct >= 75) {
    return { text: 'أحسنت! نتيجة رائعة تدل على تحضير جاد. واصل التقدم!', expression: 'happy' };
  }
  if (pct >= 60) {
    return { text: 'جيد جدًا! أنت على الطريق الصحيح — راجع أخطاءك وستتحسن أكثر.', expression: 'wink' };
  }
  if (pct >= 40) {
    return { text: 'بداية طيبة! راجع الأخطاء بالأسفل — كل خطأ درس يقربك من النجاح.', expression: 'thinking' };
  }
  return { text: 'لا بأس! المهم أنك تتدرب. راجع الشروحات وحاول مجددًا — النجاح يحتاج صبرًا.', expression: 'thinking' };
}
