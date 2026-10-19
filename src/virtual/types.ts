// المريض الافتراضي — أنواع البيانات
// سيناريوهات سريرية تفاعلية (شجرة قرارات) بدون AI — كل المحتوى مُعدّ مسبقًا

export type CaseDifficulty = 'easy' | 'medium' | 'hard';

export interface CaseHistoryItem {
  id: string;
  text: string; // نص السؤال: «أين الألم؟»
  answer: string; // إجابة المريض الجاهزة
  isKey: boolean; // سؤال محوري للتقييم
}

export interface CaseExamination {
  id: string;
  text: string; // «قياس العلامات الحيوية»
  finding: string; // النتيجة الجاهزة
  isKey: boolean;
}

export interface CaseTest {
  id: string;
  text: string; // «تخطيط القلب الكهربائي»
  result: string; // النتيجة الجاهزة
  isKey: boolean;
}

export interface VirtualCase {
  id: string;
  title: string; // «رجل 58 سنة بألم صدر»
  specialty: string; // «القلبية»
  source: string; // «AHA» / «Harvard Medical School»...
  sourceNote?: string; // ملاحظة عن المصدر
  difficulty: CaseDifficulty;
  presentation: string; // العرض الأولي للمريض
  history: CaseHistoryItem[];
  examinations: CaseExamination[];
  tests: CaseTest[];
  diagnosisOptions: string[];
  correctDiagnosis: string;
  explanation: string; // لماذا هذا التشخيص
  learningPoints: string[]; // نقاط تعليمية
  xpReward: number; // مكافأة الإكمال
  createdAt?: string;
  // حقول ألمانية اختيارية (غير مستخدمة في الواجهة حاليًا)
  title_de?: string;
  presentation_de?: string;
  history_de?: CaseHistoryItem[];
  examinations_de?: CaseExamination[];
  tests_de?: CaseTest[];
  diagnosisOptions_de?: string[];
  correctDiagnosis_de?: string;
  explanation_de?: string;
  learningPoints_de?: string[];
}

export interface CaseScore {
  keyHistoryAsked: number;
  keyHistoryTotal: number;
  keyExamsDone: number;
  keyExamsTotal: number;
  keyTestsOrdered: number;
  keyTestsTotal: number;
  diagnosisCorrect: boolean;
  total: number; // 0-100
  xpEarned: number;
}

export interface CaseProgress {
  completedIds: string[];
  bestScores: Record<string, number>; // caseId -> best score
}

export const DIFFICULTY_LABEL: Record<CaseDifficulty, string> = {
  easy: 'سهلة',
  medium: 'متوسطة',
  hard: 'صعبة',
};

export const VIRTUAL_CASES_COLLECTION = 'virtual_cases';

