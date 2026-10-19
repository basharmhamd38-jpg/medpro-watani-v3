// أنواع قسم «الكورسات» — بنية Firestore: courses/{id} ← units/{unitId} ← questions/{qid}
export interface CourseMeta {
  id: string;
  title: string;
  unitCount: number;
  questionCount: number;
  version: number;
}

export interface UnitTest {
  questions: CourseQuestion[];
  timeMinutes: number;
  passThreshold: number;
}

export interface CourseUnit {
  id: string;
  courseId: string;
  order: number;
  title: string;
  topics: string[];
  summary: string;
  questionCount: number;
  unitTest?: UnitTest;
}

export interface CourseQuestion {
  id: string;
  text: string;
  options: string[];
  optionLabels: string[];
  correct: string;
  correctIndex: number;
  explanation: string;
  difficulty: string;
  source: string;
  sourceRef: string;
  years: string[];
  topic: string;
  order: number;
  keyCorrected?: boolean;
  needsReview?: boolean;
}

// أقسام الشرح الخماسي بعد التفكيك
export interface WrongOption {
  option: string;
  reason: string;
}

export interface ExplanationParts {
  titles: string[]; // عناوين الأقسام الخمسة كما وردت (لدعم صيغتي خاطئة/صحيحة)
  whyCorrect: string;
  whyOthersWrong: string; // نص خام احتياطي
  wrongOptions: WrongOption[]; // مفككة كل خيار بسطر مستقل
  takeaway: string;
  why: string;
  visual: string;
}

export type UnitStatus = 'not_started' | 'in_progress' | 'completed' | 'locked';

export interface UnitProgress {
  unitId: string;
  summaryRead: boolean;
  questionsDone: number;
  questionsTotal: number;
  testScore: number | null; // نسبة مئوية
  testTaken: boolean;
  status: Exclude<UnitStatus, 'locked'>;
  updatedAt: number;
}

export interface UnitWithProgress extends CourseUnit {
  progress: UnitProgress | null;
  status: UnitStatus;
  progressPct: number; // 0..100
}
