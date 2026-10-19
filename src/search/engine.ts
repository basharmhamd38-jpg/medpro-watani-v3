// محرك البحث الشامل: بطاقات + دليل الدراسة (محلي فوري) + مواد/مواضيع البنوك (Firestore)
// ملاحظة: Firestore لا يدعم البحث النصي الكامل — نبحث في أسماء المواد والمواضيع
// والبطاقات محليًا (4,658 بطاقة). البحث في نصوص الأسئلة يتطلب فهرسًا خارجيًا.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FLASHCARDS } from '../data/flashcards-data';
import { REVIEW_CARDS } from '../data/review-cards-data';
import {
  fetchUWorldSubjects,
  fetchClinicalSubjects,
  fetchPracticeModels,
} from '../bank/quizBank';
import { fetchWataniSubjects } from '../bank/firestore';

export type SearchResultType =
  | 'flashcard'
  | 'guide'
  | 'subject'
  | 'topic';

export interface SearchResult {
  type: SearchResultType;
  title: string; // العنوان الرئيسي
  snippet: string; // مقتطف توضيحي
  meta: string; // المادة/المصدر
  // بيانات التنقل
  nav?: {
    subjectId?: string;
    subjectName?: string;
    source?: string;
  };
  // للبطاقات: البيانات الكاملة للعرض
  card?: { f: string; b: string };
}

export interface SearchGroup {
  type: SearchResultType;
  label: string;
  results: SearchResult[];
}

const RECENT_KEY = 'watani_recent_searches';
const MAX_RECENT = 10;

/** تطبيع النص العربي للبحث: إزالة التشكيل وتوحيد الهمزات */
export function normalizeArabic(s: string): string {
  return String(s ?? '')
    .replace(/[\u064B-\u0652\u0670]/g, '') // تشكيل
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .trim();
}

/** هل يحتوي النص على كلمات البحث (كل الكلمات مطلوبة) */
function matches(haystack: string, queryWords: string[]): boolean {
  const norm = normalizeArabic(haystack);
  return queryWords.every((w) => norm.includes(w));
}

/** إبراز كلمات البحث في النص — يعيد مقاطع {text, highlight} */
export function highlightParts(
  text: string,
  query: string,
): { text: string; highlight: boolean }[] {
  const words = normalizeArabic(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [{ text, highlight: false }];
  // بحث بسيط: نقسم على أول كلمة مطابقة (تقريبي للعرض)
  const norm = normalizeArabic(text);
  let bestIdx = -1;
  let bestWord = '';
  for (const w of words) {
    const i = norm.indexOf(w);
    if (i >= 0 && (bestIdx < 0 || i < bestIdx)) {
      bestIdx = i;
      bestWord = w;
    }
  }
  if (bestIdx < 0) return [{ text, highlight: false }];
  // نحاول إيجاد الموضع التقريبي في النص الأصلي
  // (التطبيع قد يغير الأطوال — نستخدم بحثًا مرنًا)
  const lower = text.toLowerCase();
  let idx = lower.indexOf(bestWord);
  if (idx < 0) {
    // بحث عن الكلمة بدون همزات في النص الأصلي
    return [{ text, highlight: false }];
  }
  return [
    { text: text.slice(0, idx), highlight: false },
    { text: text.slice(idx, idx + bestWord.length), highlight: true },
    { text: text.slice(idx + bestWord.length), highlight: false },
  ];
}

// ─── فهرس دليل الدراسة (ثابت) ───
const GUIDE_INDEX: { key: string; label: string; keywords: string }[] = [
  { key: 'tips', label: 'النصائح', keywords: 'نصائح ذهبية تحضير امتحان وطني دراسة' },
  { key: 'focus', label: 'التركيز', keywords: 'تركيز عميق جلسات انتباه تشتت' },
  { key: 'pomodoro', label: 'بومودورو', keywords: 'بومودورو جولات استراحة تنظيم وقت' },
  { key: 'checklist', label: 'قائمة التحقق', keywords: 'قائمة تحقق إنجاز مهام يومية' },
  { key: 'learningStyle', label: 'اختبار نمط التعلم', keywords: 'نمط تعلم بصري سمعي حركي اختبار' },
  { key: 'breathing', label: 'التنفس', keywords: 'تنفس هدوء امتحان توتر قلق 4-7-8' },
  { key: 'memory', label: 'الذاكرة', keywords: 'ذاكرة قصر ذهني تثبيت معلومات طويلة الأمد' },
  { key: 'spacedRep', label: 'المراجعة الذكية', keywords: 'مراجعة ذكية تكرار متباعد نسيان anki' },
];

/** بحث محلي فوري: البطاقات + دليل الدراسة */
export function searchLocal(query: string, limitPerGroup = 8): SearchGroup[] {
  const q = normalizeArabic(query);
  if (!q) return [];
  const words = q.split(/\s+/).filter(Boolean);
  const groups: SearchGroup[] = [];

  // 1) البطاقات الأساسية
  const cardResults: SearchResult[] = [];
  outer1: for (const subj of FLASHCARDS) {
    for (const topic of subj.topics) {
      for (const card of topic.cards) {
        if (matches(card.f + ' ' + card.b, words)) {
          cardResults.push({
            type: 'flashcard',
            title: card.f.slice(0, 120),
            snippet: card.b.slice(0, 160),
            meta: `${subj.s} • ${topic.t}`,
            card: { f: card.f, b: card.b },
          });
          if (cardResults.length >= limitPerGroup) break outer1;
        }
      }
    }
  }
  if (cardResults.length > 0) {
    groups.push({ type: 'flashcard', label: 'البطاقات التعليمية', results: cardResults });
  }

  // 2) بطاقات المراجعة
  const reviewResults: SearchResult[] = [];
  outer2: for (const subj of REVIEW_CARDS) {
    for (const topic of subj.topics) {
      for (const card of topic.cards) {
        if (matches(card.f + ' ' + card.b, words)) {
          reviewResults.push({
            type: 'flashcard',
            title: card.f.slice(0, 120),
            snippet: card.b.slice(0, 160),
            meta: `${subj.s} • ${topic.t} (مراجعة)`,
            card: { f: card.f, b: card.b },
          });
          if (reviewResults.length >= limitPerGroup) break outer2;
        }
      }
    }
  }
  if (reviewResults.length > 0) {
    // دمج مع مجموعة البطاقات
    const existing = groups.find((g) => g.type === 'flashcard');
    if (existing) {
      existing.results.push(...reviewResults.slice(0, Math.max(0, limitPerGroup - existing.results.length)));
    } else {
      groups.push({ type: 'flashcard', label: 'البطاقات التعليمية', results: reviewResults });
    }
  }

  // 3) دليل الدراسة
  const guideResults: SearchResult[] = GUIDE_INDEX.filter((g) =>
    matches(g.label + ' ' + g.keywords, words),
  ).map((g) => ({
    type: 'guide' as SearchResultType,
    title: g.label,
    snippet: 'قسم من دليل الدراسة',
    meta: 'دليل الدراسة',
    nav: { subjectName: g.label },
  }));
  if (guideResults.length > 0) {
    groups.push({ type: 'guide', label: 'دليل الدراسة', results: guideResults });
  }

  return groups;
}

/** بحث أسماء المواد في Firestore (دورات الوطني، UWorld، الحالات، النماذج) */
export async function searchSubjects(query: string): Promise<SearchGroup[]> {
  const words = normalizeArabic(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const results: SearchResult[] = [];
  try {
    const [watani, uworld, clinical, models] = await Promise.all([
      fetchWataniSubjects().catch(() => []),
      fetchUWorldSubjects().catch(() => []),
      fetchClinicalSubjects().catch(() => []),
      fetchPracticeModels().catch(() => []),
    ]);
    for (const s of watani) {
      if (matches(s.name, words)) {
        results.push({
          type: 'subject',
          title: s.name,
          snippet: 'دورات الامتحان الوطني',
          meta: 'بنك الأسئلة',
          nav: { subjectId: s.id, subjectName: s.name, source: 'watani' },
        });
      }
    }
    for (const s of uworld) {
      if (matches(s.name, words)) {
        results.push({
          type: 'subject',
          title: s.name,
          snippet: 'أسئلة UWorld',
          meta: 'بنك الأسئلة',
          nav: { subjectId: s.id, subjectName: s.name, source: 'uworld' },
        });
      }
    }
    for (const s of clinical) {
      if (matches(s.name, words)) {
        results.push({
          type: 'subject',
          title: s.name,
          snippet: 'الحالات السريرية',
          meta: 'بنك الأسئلة',
          nav: { subjectId: s.id, subjectName: s.name, source: 'clinical' },
        });
      }
    }
    for (const s of models) {
      if (matches(s.name, words)) {
        results.push({
          type: 'subject',
          title: s.name,
          snippet: 'النماذج التدريبية',
          meta: 'بنك الأسئلة',
          nav: { subjectId: s.id, subjectName: s.name, source: 'models' },
        });
      }
    }
  } catch {
    // تجاهل فشل الشبكة
  }
  if (results.length === 0) return [];
  return [{ type: 'subject', label: 'المواد والأقسام', results: results.slice(0, 10) }];
}

// ─── سجل البحث الأخير ───
export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export async function addRecentSearch(query: string): Promise<void> {
  const q = query.trim();
  if (!q) return;
  try {
    const recent = await getRecentSearches();
    const updated = [q, ...recent.filter((s) => s !== q)].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // تجاهل
  }
}

export async function clearRecentSearches(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENT_KEY);
  } catch {
    // تجاهل
  }
}
