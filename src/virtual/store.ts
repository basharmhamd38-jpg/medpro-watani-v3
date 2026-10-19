// مخزن المريض الافتراضي — أوفلاين-أول:
// 1) ذاكرة الجلسة (أسرع) ← 2) SQLite المحلية (جدول virtual_cases — تُملأ من cases.json
//    عند التحميل الأول/المزامنة الخلفية) ← 3) Firestore (تحديثات لوحة المالك، عند توفر
//    الشبكة — تُدمج فوق المحلي) ← 4) Cloudflare (احتياطي) ← 5) البذرة المحلية
//    (احتياطي أخير قبل أول تحميل).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE } from '../config';
import { parseValue } from '../courses/firestore';
import { getContent } from '../content/cloudflare';
import { getRemoteContentVersion, setLocalContentVersion } from '../content/contentVersion';
import { getDB } from '../db/database';
import {
  VIRTUAL_CASES_COLLECTION,
  type CaseProgress,
  type VirtualCase,
} from './types';
import { SEED_CASES } from './seedCases';
import { SEED_CASES_2 } from './seedCases2';

const PROGRESS_KEY = 'virtual_case_progress';

const DEFAULT_PROGRESS: CaseProgress = { completedIds: [], bestScores: {} };

/**
 * نسخة جديدة دائمًا من التقدم الافتراضي — الكائن المشترك DEFAULT_PROGRESS
 * لا يُسلَّم لأي منادٍ أبدًا (كان يُطوَّع عبر push في saveCaseResult فيتسرب
 * التلوث لكل منادٍ لاحق).
 */
function freshProgress(): CaseProgress {
  return {
    completedIds: [...DEFAULT_PROGRESS.completedIds],
    bestScores: { ...DEFAULT_PROGRESS.bestScores },
  };
}

// ذاكرة الجلسة — الطبقة 1: أسرع، تمنع إعادة الجلب عند كل فتح للتبويب
let memCases: { at: number; list: VirtualCase[] } | null = null;
const MEM_CASES_TTL_MS = 60_000;

/** إبطال ذاكرة الحالات (يُستدعى بعد حفظ/حذف حالة من لوحة المالك) */
export function invalidateCasesMemory(): void {
  memCases = null;
}

const num = (v: any, fb = 0): number =>
  typeof v === 'number' && !isNaN(v) ? v : fb;
const str = (v: any, fb = ''): string => (typeof v === 'string' ? v : fb);
const bool = (v: any, fb = false): boolean =>
  typeof v === 'boolean' ? v : fb;
const strArr = (v: any): string[] =>
  Array.isArray(v) ? v.map((x) => String(x)) : [];

function parseCase(id: string, fields: any): VirtualCase | null {
  try {
    const f = parseValue({ mapValue: { fields } }) as any;
    if (!f || typeof f.title !== 'string') return null;
    const mapHistory = (arr: any[]): VirtualCase['history'] =>
      (Array.isArray(arr) ? arr : [])
        .filter((x) => x && typeof x.text === 'string')
        .map((x, i) => ({
          id: String(x.id || `i${i}`),
          text: String(x.text),
          answer: String(x.answer || ''),
          isKey: bool(x.isKey, false),
        }));
    const mapExams = (arr: any[]): VirtualCase['examinations'] =>
      (Array.isArray(arr) ? arr : [])
        .filter((x) => x && typeof x.text === 'string')
        .map((x, i) => ({
          id: String(x.id || `i${i}`),
          text: String(x.text),
          finding: String(x.finding || ''),
          isKey: bool(x.isKey, false),
        }));
    const mapTests = (arr: any[]): VirtualCase['tests'] =>
      (Array.isArray(arr) ? arr : [])
        .filter((x) => x && typeof x.text === 'string')
        .map((x, i) => ({
          id: String(x.id || `i${i}`),
          text: String(x.text),
          result: String(x.result || ''),
          isKey: bool(x.isKey, false),
        }));
    return {
      id,
      title: str(f.title),
      specialty: str(f.specialty, 'عام'),
      source: str(f.source, 'Med Pro'),
      sourceNote: str(f.sourceNote),
      difficulty:
        f.difficulty === 'easy' || f.difficulty === 'hard'
          ? f.difficulty
          : 'medium',
      presentation: str(f.presentation),
      history: mapHistory(f.history),
      examinations: mapExams(f.examinations),
      tests: mapTests(f.tests),
      diagnosisOptions: strArr(f.diagnosisOptions),
      correctDiagnosis: str(f.correctDiagnosis),
      explanation: str(f.explanation),
      learningPoints: strArr(f.learningPoints),
      xpReward: num(f.xpReward, 40),
    };
  } catch {
    return null;
  }
}

/** تحليل حالة من صيغة Cloudflare (JSON خام — نفس الحقول بلا تغليف Firestore) */
function parseCdnCase(raw: any): VirtualCase | null {
  try {
    if (!raw || typeof raw.id !== 'string' || typeof raw.title !== 'string') return null;
    const toHistory = (arr: any): VirtualCase['history'] =>
      (Array.isArray(arr) ? arr : [])
        .filter((x: any) => x && typeof x.text === 'string')
        .map((x: any, i: number) => ({
          id: String(x.id || `i${i}`),
          text: String(x.text),
          answer: String(x.answer || ''),
          isKey: !!x.isKey,
        }));
    const toExams = (arr: any): VirtualCase['examinations'] =>
      (Array.isArray(arr) ? arr : [])
        .filter((x: any) => x && typeof x.text === 'string')
        .map((x: any, i: number) => ({
          id: String(x.id || `i${i}`),
          text: String(x.text),
          finding: String(x.finding || ''),
          isKey: !!x.isKey,
        }));
    const toTests = (arr: any): VirtualCase['tests'] =>
      (Array.isArray(arr) ? arr : [])
        .filter((x: any) => x && typeof x.text === 'string')
        .map((x: any, i: number) => ({
          id: String(x.id || `i${i}`),
          text: String(x.text),
          result: String(x.result || ''),
          isKey: !!x.isKey,
        }));
    const strArr = (v: any): string[] =>
      Array.isArray(v) ? v.map((x: any) => String(x)) : [];
    return {
      id: String(raw.id),
      title: String(raw.title),
      specialty: String(raw.specialty || 'عام'),
      source: String(raw.source || 'Med Pro'),
      sourceNote: String(raw.sourceNote || ''),
      difficulty:
        raw.difficulty === 'easy' || raw.difficulty === 'hard'
          ? raw.difficulty
          : 'medium',
      presentation: String(raw.presentation || ''),
      history: toHistory(raw.history),
      examinations: toExams(raw.examinations),
      tests: toTests(raw.tests),
      diagnosisOptions: strArr(raw.diagnosisOptions),
      correctDiagnosis: String(raw.correctDiagnosis || ''),
      explanation: String(raw.explanation || ''),
      learningPoints: strArr(raw.learningPoints),
      xpReward: typeof raw.xpReward === 'number' ? raw.xpReward : 40,
    };
  } catch {
    return null;
  }
}

/** تحليل صف من جدول virtual_cases المحلي (الحقول المركبة مخزنة JSON) */
function parseStoredCase(row: any): VirtualCase | null {
  try {
    if (!row || typeof row.id !== 'string' || typeof row.title !== 'string') return null;
    const parseArr = (v: any): any[] => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string' && v) {
        try {
          const p = JSON.parse(v);
          return Array.isArray(p) ? p : [];
        } catch {
          return [];
        }
      }
      return [];
    };
    const toHistory = (arr: any[]): VirtualCase['history'] =>
      arr
        .filter((x: any) => x && typeof x.text === 'string')
        .map((x: any, i: number) => ({
          id: String(x.id || `i${i}`),
          text: String(x.text),
          answer: String(x.answer || ''),
          isKey: !!x.isKey,
        }));
    const toExams = (arr: any[]): VirtualCase['examinations'] =>
      arr
        .filter((x: any) => x && typeof x.text === 'string')
        .map((x: any, i: number) => ({
          id: String(x.id || `i${i}`),
          text: String(x.text),
          finding: String(x.finding || ''),
          isKey: !!x.isKey,
        }));
    const toTests = (arr: any[]): VirtualCase['tests'] =>
      arr
        .filter((x: any) => x && typeof x.text === 'string')
        .map((x: any, i: number) => ({
          id: String(x.id || `i${i}`),
          text: String(x.text),
          result: String(x.result || ''),
          isKey: !!x.isKey,
        }));
    return {
      id: row.id,
      title: row.title,
      specialty: typeof row.specialty === 'string' && row.specialty ? row.specialty : 'عام',
      source: typeof row.source === 'string' && row.source ? row.source : 'Med Pro',
      sourceNote: typeof row.source_note === 'string' ? row.source_note : '',
      difficulty:
        row.difficulty === 'easy' || row.difficulty === 'hard' ? row.difficulty : 'medium',
      presentation: typeof row.presentation === 'string' ? row.presentation : '',
      history: toHistory(parseArr(row.history)),
      examinations: toExams(parseArr(row.examinations)),
      tests: toTests(parseArr(row.tests)),
      diagnosisOptions: parseArr(row.diagnosis_options).map((x: any) => String(x)),
      correctDiagnosis: typeof row.correct_diagnosis === 'string' ? row.correct_diagnosis : '',
      explanation: typeof row.explanation === 'string' ? row.explanation : '',
      learningPoints: parseArr(row.learning_points).map((x: any) => String(x)),
      xpReward: typeof row.xp_reward === 'number' ? row.xp_reward : 40,
    };
  } catch {
    return null;
  }
}

/**
 * الطبقة المحلية: الحالات من SQLite (تُملأ من cases.json عند التحميل الأول).
 * تُعيد null إن لم تُحمَّل بعد — تعمل بلا إنترنت متى وُجدت.
 */
async function fetchLocalCases(): Promise<VirtualCase[] | null> {
  try {
    const db = getDB();
    const r = await db.execute(
      'SELECT id, title, specialty, source, source_note, difficulty, presentation, history, examinations, tests, diagnosis_options, correct_diagnosis, explanation, learning_points, xp_reward FROM virtual_cases ORDER BY id',
    );
    const rows = (r.rows || []) as any[];
    if (rows.length === 0) return null;
    const out: VirtualCase[] = [];
    for (const row of rows) {
      const c = parseStoredCase(row);
      if (c) out.push(c);
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * جلب الحالات: ذاكرة الجلسة ← SQLite المحلية (أوفلاين-أول) ← Firestore
 * (تحديثات لوحة المالك تُدمج فوق المحلي عند توفر الشبكة) ← Cloudflare (احتياطي)
 * ← البذرة المحلية (احتياطي أخير قبل أول تحميل).
 */
export async function fetchVirtualCases(): Promise<VirtualCase[]> {
  if (memCases && Date.now() - memCases.at < MEM_CASES_TTL_MS) {
    return memCases.list;
  }
  const byId = new Map<string, VirtualCase>();
  const local = await fetchLocalCases();
  if (local && local.length > 0) {
    for (const c of local) byId.set(c.id, c);
  } else {
    // لم تُحمَّل الحالات بعد — البذرة احتياطي أخير
    for (const c of SEED_CASES) byId.set(c.id, c);
    for (const c of SEED_CASES_2) byId.set(c.id, c);
  }

  // 1) Firestore (تحديثات لوحة المالك — تُدمج فوق المحلي عند توفر الشبكة)
  let firestoreOk = false;
  try {
    const url =
      `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}` +
      `/databases/${FIREBASE.databaseId}/documents:runQuery?key=${FIREBASE.apiKey}`;
    // مهلة 20 ثانية — تمنع تعليق الواجهة إن تجمّدت الشبكة
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: VIRTUAL_CASES_COLLECTION }],
            limit: 1000,
          },
        }),
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.ok) {
      const data = await res.json();
      const docs = Array.isArray(data) ? data : [];
      let added = 0;
      for (const d of docs) {
        const name: string = d?.document?.name || '';
        const id = name.split('/').pop() || '';
        const parsed = parseCase(id, d?.document?.fields || {});
        if (parsed) {
          byId.set(id, parsed);
          added++;
        }
      }
      if (added > 0) {
        firestoreOk = true;
        // سجّل الإصدار البعيد كـ"محلي" — الكاش محدّث
        try {
          const v = await getRemoteContentVersion();
          if (v) await setLocalContentVersion(v);
        } catch {
          /* تجاهل */
        }
      }
    }
  } catch {
    // السقوط لـCloudflare
  }

  // 2) Cloudflare CDN (احتياطي — بفحص إصدار الكاش)
  if (!firestoreOk) {
    try {
      const { data } = await getContent('cases');
      const list = Array.isArray(data?.cases) ? data.cases : [];
      for (const raw of list) {
        const parsed = parseCdnCase(raw);
        if (parsed) byId.set(parsed.id, parsed);
      }
    } catch {
      /* السقوط للبذرة المحلية */
    }
  }

  const out = [...byId.values()];
  memCases = { at: Date.now(), list: out };
  return out;
}

/** حالة واحدة بالمعرّف — تُستخدم من شاشات التنقل (تعمل أوفلاين من SQLite) */
export async function getVirtualCase(caseId: string): Promise<VirtualCase | null> {
  try {
    const list = await fetchVirtualCases();
    return list.find((c) => c.id === caseId) ?? null;
  } catch {
    return null;
  }
}

export async function getCaseProgress(): Promise<CaseProgress> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    if (!raw) return freshProgress();
    const p = JSON.parse(raw);
    return {
      completedIds: Array.isArray(p.completedIds) ? p.completedIds : [],
      bestScores:
        p.bestScores && typeof p.bestScores === 'object' ? p.bestScores : {},
    };
  } catch {
    return freshProgress();
  }
}

export async function saveCaseResult(
  caseId: string,
  score: number,
): Promise<CaseProgress> {
  const p = await getCaseProgress();
  if (!p.completedIds.includes(caseId)) p.completedIds.push(caseId);
  const prev = p.bestScores[caseId] || 0;
  if (score > prev) p.bestScores[caseId] = score;
  try {
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* تجاهل */
  }
  return p;
}

