// أسماء الشاشات المعتمدة — يلتزم بها الجميع
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// الجذر: Onboarding (أول تشغيل) → Welcome → Main
export type RootStackParamList = {
  Onboarding: undefined;
  Welcome: undefined;
  Main: undefined;
};

// Main = Drawer (من اليمين) — يحتوي التبويبات + الشاشات الإضافية
// الكورسات/التحدي اليومي/البطاقات/دليل الدراسة: شاشات درج (نُقلت من الشريط السفلي)
export type DrawerParamList = {
  Tabs: undefined;
  CoursesTab: undefined;
  ChallengeTab: undefined;
  FlashcardsTab: undefined;
  GuideTab: undefined;
  SubjectDetail: { subjectId: string; title: string; kind: string };
  SubjectTopics: { subjectId: string; title: string; kind: string };
  Question: { subjectId: string; title: string; topic?: string };
  BankQuestion: {
    source: 'watani' | 'jami3at';
    subjectId: string;
    sessionId: string;
    univId?: string;
    title: string;
  };
  Activation: undefined;
  Notifications: undefined;
  FlashcardsViewer: undefined;
  Profile: undefined;
  Privacy: undefined;
  Contact: undefined;
  SocialLinks: undefined;
  Search: undefined;
  Favorites: undefined;
  Notes: undefined;
  Badges: undefined;
  MockExam: undefined;
  Pomodoro: undefined;
  WeakPoints: undefined;
};

// التبويبات السفلية — 5 تبويبات ثابتة (بالترتيب من اليمين لليسار)
// الكورسات/التحدي اليومي/البطاقات/دليل الدراسة نُقلت لشاشات درج
export type TabParamList = {
  HomeTab: undefined;
  BankTab: undefined;
  LeaderboardTab: undefined;
  VirtualPatientTab: undefined;
  ProgressTab: { initialSubTab?: 'tests' | 'sr' } | undefined;
};

export type RootStackProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;
export type DrawerProps<T extends keyof DrawerParamList> = DrawerScreenProps<
  DrawerParamList,
  T
>;
export type TabProps<T extends keyof TabParamList> = BottomTabScreenProps<
  TabParamList,
  T
>;
