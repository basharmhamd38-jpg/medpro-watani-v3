// الحروف العربية لترقيم الخيارات — موحدة لكل التطبيق
// أ=A ب=B ج=C د=D هـ=E و=F ز=G ح=H
// بأمر الدكتور: الترقيم العربي الصحيح في كل الشاشات
export const ARABIC_OPTION_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'] as const;

/** حرف الخيار العربي بالفهرس (0=أ، 1=ب، 2=ج، 3=د...) */
export function arabicOptionLetter(index: number): string {
  return ARABIC_OPTION_LETTERS[index] ?? `${index + 1}`;
}
