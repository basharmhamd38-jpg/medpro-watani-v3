// طبقة «أوفلاين-أول» لتطبيق وطني — نموذج التحميل بأمر الدكتور (21 أكتوبر 2026):
// - لا بوابة تحميل عند الدخول إطلاقًا: التطبيق يفتح مباشرة دائمًا.
// - المحتوى يصل فقط من زر تحميل داخل كل قسم (downloadSection) — بنطاق القسم:
//   بنك الوطني questions/ | دورات الوطني dawrat/ | الجامعات dawrat_jami3at/
//   الحالات cases.json | النماذج practice_models/ | بنك UWorld الحقيقي uworld/
// - اكتمال أي قسم يُتحقق منه فعليًا من التخزين المحلي (SQLite/الكاش المشفّر):
//   عدد محفوظ ≥ 95٪ من عدد الـmanifest — لا حالة نجاح شكلية أبدًا.
// - firstLaunchDownload باقية للتوافق فقط (لا منادي لها من الواجهة بعد الآن)،
//   وbackgroundSync لم تعد تُستدعى عند الإقلاع — لا تنزيل محتوى تلقائيًا أبدًا.
// المصدر: Cloudflare CDN للقراءة فقط — لا كتابة ولا حذف في Firestore.
// التخزين: SQLite المشفرة (INSERT OR REPLACE داخل transaction لكل ملف).
// الـids ثابتة عبر المزامنات (انظر normalize.ts) فيعمل الـupsert بأمان.

import { getDB } from '../db/database';
import {
  fetchManifest,
  discoverFiles,
  downloadFile,
  getQuestionsIndex,
  getUWorldBankIndex,
  getDawratSubjects,
  getUnivSubjects,
  primeDownloadedFile,
  type CancelToken,
  type CdnManifest,
} from '../content/cloudflare';
import { setLocalContentVersion } from '../content/contentVersion';
import { secureGet } from '../content/secureCache';
import {
  normalizeFile,
  normalizeCasesFile,
  isContentPath,
  type NormalizedFile,
  type NormalizedCaseRow,
} from './normalize';

export type { CancelToken } from '../content/cloudflare';

export type FirstLaunchError = 'no-internet' | 'cancelled' | 'failed';

export interface FirstLaunchResult {
  ok: boolean;
  error?: FirstLaunchError;
  /** مسارات الملفات التي فشل تحميلها (لإعادة محاولتها فقط عند الاستئناف) */
  failed?: string[];
}

/** (done, total, label, questionsSoFar, failedSoFar) — label: اسم المادة/الملف الحالي */
export type ProgressCallback = (
  done: number,
  total: number,
  label: string,
  questionsSoFar?: number,
  failedSoFar?: number,
) => void;

const READY_KEY = 'offline_ready_v2'; // user_progress: اكتمال التحميل الأول
const SYNC_STATE_KEY = 'cdn_manifest'; // sync_state: {version, files:{path:hash}}
const FILE_SUBJECTS_KEY = 'cdn_file_subjects'; // sync_state: {path: subjectId} للحذف لاحقًا
const DONE_FILES_KEY = 'cdn_done_files'; // sync_state: {path: hash} — سجل الاستئناف لكل ملف
const SECTION_EXPECTED_KEY = 'cdn_section_expected'; // sync_state: {section: count} — آخر متوقَّع موثّق لكل قسم (للحكم على الاكتمال أوفلاين بلا ادعاء وهمي)
/** علامة fileSubjects لملف cases.json (بلا subjectId — جدول مستقل) */
const CASES_SUBJECT_MARKER = '__virtual_cases__';

interface ManifestToken {
  version: string;
  files: Record<string, string>;
}

interface ContentFile {
  path: string;
  label: string;
  /** بصمة الإصدار الحالي للملف (من الـmanifest أو عدّ النموذج) — مفتاح الاستئناف */
  hash: string;
  /** الحجم بالبايت من الـmanifest (لمهلات أطول للملفات الكبيرة) */
  size: number;
  /** عدد الأسئلة المتوقع من الـmanifest (لتحقق الاكتمال) */
  count: number;
}

function labelForPath(path: string): string {
  const base = path.split('/').pop() || path;
  return base.replace(/\.json$/i, '');
}

/** هل التطبيق جاهز للعمل أوفلاين (اكتمل التحميل الأول)؟ */
export async function isOfflineReady(): Promise<boolean> {
  try {
    const db = getDB();
    const r = await db.execute('SELECT value FROM user_progress WHERE key = ?', [
      READY_KEY,
    ]);
    const rows = (r.rows || []) as any[];
    return String(rows[0]?.value) === '1';
  } catch {
    return false;
  }
}

/** بناء ContentFile من معلومات الـmanifest */
function toContentFile(manifest: CdnManifest, path: string, label: string): ContentFile {
  const info = manifest.files[path];
  return {
    path,
    label,
    hash: info?.hash ?? '',
    size: info?.size ?? 0,
    count: info?.count ?? 0,
  };
}

/** شاردات بنك الوطني (questions/*.json) من فهرس questions.json */
async function collectBankFiles(manifest: CdnManifest): Promise<ContentFile[]> {
  const out: ContentFile[] = [];
  try {
    const idx = await getQuestionsIndex();
    for (const sh of idx?.shards ?? []) {
      const p = sh?.file;
      if (
        typeof p === 'string' &&
        p.startsWith('questions/') &&
        manifest.files[p] &&
        (manifest.files[p].count ?? 0) > 0
      ) {
        out.push(toContentFile(manifest, p, sh.subject_name || labelForPath(p)));
      }
    }
  } catch {
    /* تجاهل — قسم بلا ملفات */
  }
  return out;
}

/** شاردات بنك UWorld الحقيقي (uworld/*.json) من فهرس uworld.json — نفس نمط بنك الوطني */
async function collectUWorldFiles(manifest: CdnManifest): Promise<ContentFile[]> {
  const out: ContentFile[] = [];
  try {
    const idx = await getUWorldBankIndex();
    for (const sh of idx?.shards ?? []) {
      const p = sh?.file;
      if (
        typeof p === 'string' &&
        p.startsWith('uworld/') &&
        manifest.files[p] &&
        (manifest.files[p].count ?? 0) > 0
      ) {
        out.push(toContentFile(manifest, p, sh.subject_name || labelForPath(p)));
      }
    }
  } catch {
    /* تجاهل — قسم بلا ملفات */
  }
  return out;
}

/** ملفات بادئة كاملة باكتشاف ديناميكي من الـmanifest (dawrat/ أو dawrat_jami3at/) */
async function collectPrefixFiles(manifest: CdnManifest, prefix: string): Promise<ContentFile[]> {
  const paths = await discoverFiles(prefix).catch(() => [] as string[]);
  return paths.map((p) => toContentFile(manifest, p, labelForPath(p)));
}

/**
 * النماذج التدريبية — ليست في الـmanifest: تُكتشف من فهرسها الخاص
 * (practice_models/index.json). بصمة كل نموذج = عدده المعلن في الفهرس.
 */
async function collectPracticeFiles(): Promise<ContentFile[]> {
  const out: ContentFile[] = [];
  try {
    const pmIdx = await downloadFile('practice_models/index.json');
    if (Array.isArray(pmIdx) && pmIdx.length > 0) {
      out.push({
        path: 'practice_models/index.json',
        label: 'فهرس النماذج التدريبية',
        hash: `pm:${pmIdx.length}`,
        size: 0,
        count: 0,
      });
      for (const m of pmIdx) {
        const id = String((m as any)?.model_id ?? '');
        if (!id) continue;
        out.push({
          path: `practice_models/${id}.json`,
          label: String((m as any)?.model_name ?? id),
          hash: `pm:${id}:${Number((m as any)?.count ?? 0)}`,
          size: 0,
          count: Number((m as any)?.count ?? 0),
        });
      }
    }
  } catch {
    /* تجاهل — النماذج تُكمل لاحقًا عبر الاستئناف */
  }
  return out;
}

/** ملف الحالات السريرية (إن وُجد بالـmanifest بعدّ موجب) */
function collectCasesFiles(manifest: CdnManifest): ContentFile[] {
  if (manifest.files['cases.json'] && (manifest.files['cases.json'].count ?? 0) > 0) {
    return [toContentFile(manifest, 'cases.json', 'الحالات السريرية')];
  }
  return [];
}

/**
 * تعداد كل ملفات المحتوى من الـCDN (للتوافق مع firstLaunchDownload):
 * شاردات بنك الوطني + dawrat/* + dawrat_jami3at/* + النماذج + الحالات أخيرًا.
 * ملاحظة: cases_de.json (ألمانية) لا تُدخَل أبدًا.
 */
async function collectContentFiles(manifest: CdnManifest): Promise<ContentFile[]> {
  const seen = new Set<string>();
  const out: ContentFile[] = [];
  const add = (files: ContentFile[]) => {
    for (const f of files) {
      if (!seen.has(f.path)) {
        seen.add(f.path);
        out.push(f);
      }
    }
  };
  add(await collectBankFiles(manifest));
  add(await collectPrefixFiles(manifest, 'dawrat'));
  add(await collectPrefixFiles(manifest, 'dawrat_jami3at'));
  add(await collectPracticeFiles());
  add(collectCasesFiles(manifest));
  return out;
}

// ─── أقسام المحتوى (نطاقات التحميل المستقلة) ───

/** قسم محتوى = تبويب في بنك الأسئلة له زر تحميله الخاص */
export type SectionId = 'bank' | 'dawrat' | 'university' | 'cases' | 'practice' | 'uworld';

/** نطاق القسم من بادئة المسار — dawrat_jami3at تسبق dawrat (الأطول أولًا) */
export function sectionOfPath(path: string): SectionId | null {
  if (path.startsWith('questions/')) return 'bank';
  if (path.startsWith('dawrat_jami3at/')) return 'university';
  if (path.startsWith('dawrat/')) return 'dawrat';
  if (path === 'cases.json') return 'cases';
  if (path.startsWith('practice_models/')) return 'practice';
  if (path.startsWith('uworld/')) return 'uworld';
  return null;
}

/** ملفات قسم واحد فقط — أساس زر تحميل القسم */
async function collectSectionFiles(
  manifest: CdnManifest,
  section: SectionId,
): Promise<ContentFile[]> {
  switch (section) {
    case 'bank':
      return collectBankFiles(manifest);
    case 'dawrat':
      return collectPrefixFiles(manifest, 'dawrat');
    case 'university':
      return collectPrefixFiles(manifest, 'dawrat_jami3at');
    case 'cases':
      return collectCasesFiles(manifest);
    case 'practice':
      return collectPracticeFiles();
    case 'uworld':
      return collectUWorldFiles(manifest);
  }
}

/** كتابة ملف مُطبَّع في SQLite — transaction واحدة لكل ملف */
async function upsertNormalizedFile(nf: NormalizedFile): Promise<void> {
  const db = getDB();
  const now = Date.now();
  const counts = new Map<string, number>();
  for (const q of nf.questions) {
    counts.set(q.sessionId, (counts.get(q.sessionId) ?? 0) + 1);
  }
  await db.transaction(async (tx) => {
    await tx.execute(
      'INSERT OR REPLACE INTO subjects (id, name_ar, kind, section, question_count, downloaded, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
      [
        nf.subject.id,
        nf.subject.nameAr,
        nf.subject.kind,
        nf.subject.kind,
        nf.questions.length,
        now,
      ],
    );
    for (const s of nf.sections) {
      await tx.execute(
        'INSERT OR REPLACE INTO sessions (id, subject_id, name, year, month, term, is_free, question_count) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
        [
          s.id,
          nf.subject.id,
          s.name,
          s.year,
          s.month,
          s.term,
          counts.get(s.id) ?? 0,
        ],
      );
    }
    for (const q of nf.questions) {
      await tx.execute(
        'INSERT OR REPLACE INTO questions (id, subject_id, session_id, code, q, options, correct_index, correct_indices, explanation, explanation_source, session_label, topic, class_topic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          q.id,
          q.subjectId,
          q.sessionId,
          q.code,
          q.q,
          JSON.stringify(q.options),
          q.correctIndex,
          JSON.stringify(q.correctIndices),
          q.explanation,
          q.explanationSource,
          q.sessionLabel,
          q.topic,
          q.classTopic,
        ],
      );
    }
  });
}

/** كتابة الحالات المُطبَّعة في SQLite — الملف هو المجموعة الكاملة (استبدال كامل) */
async function upsertVirtualCases(rows: NormalizedCaseRow[]): Promise<void> {
  const db = getDB();
  const now = Date.now();
  await db.transaction(async (tx) => {
    await tx.execute('DELETE FROM virtual_cases');
    for (const c of rows) {
      await tx.execute(
        'INSERT OR REPLACE INTO virtual_cases (id, title, specialty, source, source_note, difficulty, presentation, history, examinations, tests, diagnosis_options, correct_diagnosis, explanation, learning_points, xp_reward, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          c.id,
          c.title,
          c.specialty,
          c.source,
          c.sourceNote,
          c.difficulty,
          c.presentation,
          c.history,
          c.examinations,
          c.tests,
          c.diagnosisOptions,
          c.correctDiagnosis,
          c.explanation,
          c.learningPoints,
          c.xpReward,
          now,
        ],
      );
    }
  });
}

/** حذف الحالات (ملف cases.json اختفى من الـmanifest) */
async function deleteVirtualCases(): Promise<void> {
  const db = getDB();
  await db.execute('DELETE FROM virtual_cases');
}

/** حذف محتوى مادة كاملة (ملف اختفى من الـmanifest) + tombstone محلي */
async function deleteSubjectContent(subjectId: string): Promise<void> {
  const db = getDB();
  await db.transaction(async (tx) => {
    await tx.execute('DELETE FROM questions WHERE subject_id = ?', [subjectId]);
    await tx.execute('DELETE FROM sessions WHERE subject_id = ?', [subjectId]);
    await tx.execute('DELETE FROM subjects WHERE id = ?', [subjectId]);
    await tx.execute(
      'INSERT OR REPLACE INTO tombstones (id, collection, doc_id, deleted_at) VALUES (?, ?, ?, ?)',
      [`cdn:${subjectId}`, 'cdn_questions', subjectId, Date.now()],
    );
  });
}

async function readSyncState(key: string): Promise<string | null> {
  try {
    const db = getDB();
    const r = await db.execute('SELECT last_token FROM sync_state WHERE collection = ?', [
      key,
    ]);
    const rows = (r.rows || []) as any[];
    const v = rows[0]?.last_token;
    return typeof v === 'string' && v ? v : null;
  } catch {
    return null;
  }
}

async function readManifestToken(): Promise<ManifestToken | null> {
  const raw = await readSyncState(SYNC_STATE_KEY);
  if (!raw) return null;
  try {
    const t = JSON.parse(raw);
    if (t && typeof t.version === 'string' && t.files && typeof t.files === 'object') {
      return t as ManifestToken;
    }
  } catch {
    /* توكن فاسد — يُعامل كغير موجود */
  }
  return null;
}

async function readFileSubjects(): Promise<Record<string, string>> {
  const raw = await readSyncState(FILE_SUBJECTS_KEY);
  if (!raw) return {};
  try {
    const m = JSON.parse(raw);
    return m && typeof m === 'object' ? m : {};
  } catch {
    return {};
  }
}

async function writeSyncState(key: string, value: string): Promise<void> {
  const db = getDB();
  await db.execute('INSERT OR REPLACE INTO sync_state (collection, last_token) VALUES (?, ?)', [
    key,
    value,
  ]);
}

function buildManifestToken(manifest: CdnManifest): ManifestToken {
  const files: Record<string, string> = {};
  for (const [p, info] of Object.entries(manifest.files)) {
    files[p] = info.hash;
  }
  return { version: manifest.version, files };
}

async function readDoneFiles(): Promise<Record<string, string>> {
  const raw = await readSyncState(DONE_FILES_KEY);
  if (!raw) return {};
  try {
    const m = JSON.parse(raw);
    return m && typeof m === 'object' ? m : {};
  } catch {
    return {};
  }
}

/**
 * تعبئة فهارس القوائم في الكاش المشفّر (مواد الدورات/الجامعات) — القارئات
 * تسقط إليها أوفلاين عند غياب الـmanifest. أفضل جهد: أي فشل يُتجاهل.
 */
async function primeIndexCaches(manifest: CdnManifest): Promise<void> {
  try {
    await getQuestionsIndex().catch(() => null);
    await getUWorldBankIndex().catch(() => null);
    await getDawratSubjects().catch(() => []);
    const univs = new Set<string>();
    for (const p of Object.keys(manifest.files)) {
      if (p.startsWith('dawrat_jami3at/')) {
        const u = p.split('/')[1];
        if (u) univs.add(u);
      }
    }
    for (const u of univs) {
      await getUnivSubjects(u).catch(() => []);
    }
  } catch {
    /* أفضل جهد */
  }
}

/** عدد الأسئلة والحالات المحفوظة فعليًا في SQLite — أساس تحقق الاكتمال */
async function countStoredContent(): Promise<{ questions: number; cases: number }> {
  try {
    const db = getDB();
    const qr = await db.execute('SELECT COUNT(*) AS c FROM questions');
    const cr = await db.execute('SELECT COUNT(*) AS c FROM virtual_cases');
    return {
      questions: Number((qr.rows as any[])?.[0]?.c ?? 0),
      cases: Number((cr.rows as any[])?.[0]?.c ?? 0),
    };
  } catch {
    return { questions: 0, cases: 0 };
  }
}

/**
 * عدد أسئلة قسم محفوظة فعليًا على الجهاز — من التخزين نفسه لا من أي علامة:
 * - bank/dawrat/university: صفوف questions المنسوبة لمواد النوع عبر JOIN subjects.
 * - cases: صفوف virtual_cases.
 * - practice: النماذج لا تدخل SQLite — تُعدّ أسئلة ملفاتها المحفوظة بالكاش المشفّر
 *   (pm_model_<id>) مقابل فهرسها المحفوظ (pm_index).
 */
export async function countSectionStored(section: SectionId): Promise<number> {
  try {
    const db = getDB();
    if (section === 'cases') {
      const r = await db.execute('SELECT COUNT(*) AS c FROM virtual_cases');
      return Number((r.rows as any[])?.[0]?.c ?? 0);
    }
    if (section === 'practice') {
      const idx = await secureGet<any>('pm_index').catch(() => null);
      if (!Array.isArray(idx)) return 0;
      let n = 0;
      for (const m of idx) {
        const id = String((m as any)?.model_id ?? '');
        if (!id) continue;
        const doc = await secureGet<any>(`pm_model_${id}`).catch(() => null);
        if (doc && Array.isArray((doc as any).questions)) {
          n += (doc as any).questions.length;
        }
      }
      return n;
    }
    const r = await db.execute(
      'SELECT COUNT(*) AS c FROM questions q JOIN subjects s ON s.id = q.subject_id WHERE s.kind = ?',
      [section],
    );
    return Number((r.rows as any[])?.[0]?.c ?? 0);
  } catch {
    return 0;
  }
}

export type SectionState = 'empty' | 'partial' | 'complete' | 'outdated';

export interface SectionStatus {
  section: SectionId;
  /** أسئلة محفوظة فعليًا على الجهاز */
  stored: number;
  /** أسئلة القسم المتوقعة من الـmanifest — null عند تعذّر جلب الـmanifest (أوفلاين) */
  expected: number | null;
  /** ملفات تغيّرت بصمتها على الـCDN ولم تُحدَّث محليًا بعد */
  outdated: number;
  state: SectionState;
}

/** آخر متوقَّع موثّق لكل قسم (يُحفظ عند كل فحص/تحميل بمانيفست حاضر) */
async function readSectionExpected(): Promise<Record<string, number>> {
  try {
    const raw = await readSyncState(SECTION_EXPECTED_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function persistSectionExpected(section: SectionId, expected: number): Promise<void> {
  if (!(expected > 0)) return;
  try {
    const all = await readSectionExpected();
    if (all[section] !== expected) {
      all[section] = expected;
      await writeSyncState(SECTION_EXPECTED_KEY, JSON.stringify(all));
    }
  } catch {
    /* غير قاتل — الحكم يبقى متحفظًا بلا متوقَّع */
  }
}

/**
 * حالة قسم حقيقية: مخزون الجهاز من التخزين نفسه + المتوقع من الـmanifest.
 * الاكتمال (complete) يتطلب مخزونًا ≥ 95٪ من متوقَّع معروف — تمامًا كتحقق التحميل.
 * عند غياب الـmanifest (أوفلاين) يُقارَن بآخر متوقَّع موثّق محفوظ محليًا؛
 * وبلا أي متوقَّع معروف لا يُعلَن اكتمال أبدًا (stored>0 ← 'partial' متحفظًا) —
 * إصلاح المشرف الخبير 21 أكتوبر: الحكم بالمخزون وحده كان إنجازًا وهميًا
 * (تحميل جزئي 10٪ يظهر «مكتمل — يعمل أوفلاين» متى فُتح القسم بلا اتصال).
 */
export async function getSectionStatus(section: SectionId): Promise<SectionStatus> {
  const stored = await countSectionStored(section);
  const manifest = await fetchManifest().catch(() => null);
  let expected: number | null = null;
  let outdated = 0;
  if (manifest && manifest.files) {
    const files = await collectSectionFiles(manifest, section);
    expected = files.reduce((s, f) => s + f.count, 0);
    const doneMap = await readDoneFiles();
    outdated = files.filter((f) => f.hash && doneMap[f.path] !== f.hash).length;
    await persistSectionExpected(section, expected);
  }
  if (expected === null) {
    const persisted = await readSectionExpected();
    if (typeof persisted[section] === 'number' && persisted[section] > 0) {
      expected = persisted[section];
    }
  }
  let state: SectionState;
  if (stored === 0) {
    state = 'empty';
  } else if (expected === null || expected === 0) {
    state = 'partial'; // مخزون موجود والاكتمال غير متحقَّق منه — لا ادعاء اكتمال
  } else if (stored < Math.floor(expected * 0.95)) {
    state = 'partial';
  } else if (outdated > 0) {
    state = 'outdated';
  } else {
    state = 'complete';
  }
  return { section, stored, expected, outdated, state };
}

/**
 * حلقة تنزيل ملفات مشتركة (التحميل الكلي وأزرار الأقسام) — الضمانات:
 * - **استئناف:** كل ملف ناجح يُسجَّل فورًا في cdn_done_files (مسار←بصمة)؛
 *   إعادة المحاولة تتخطى المنجز بنفس البصمة — لا إعادة تنزيل قسرية أبدًا.
 * - **فشل ملف لا يقتل الباقي:** يُجمع في failed ويُستكمل الباقي.
 * - **مهلات واقعية:** الملفات الكبيرة (>2MB) بمهلة 240s و3 محاولات.
 * - كل ملف ناجح: تطبيع ← SQLite + تعبئة كاش القراءة (primeDownloadedFile)
 *   فتقرأه الشاشات أوفلاين فورًا.
 * تتوقف الحلقة عند الإلغاء وتُعيد ما أُنجز في failed/questionsSoFar.
 */
async function runFileLoop(
  files: ContentFile[],
  onProgress?: ProgressCallback,
  cancel?: CancelToken,
  force = false,
): Promise<{ failed: string[]; questionsSoFar: number; fileSubjects: Record<string, string> }> {
  const doneMap = await readDoneFiles();
  const fileSubjects = await readFileSubjects();
  const failed: string[] = [];
  let done = 0;
  let questionsSoFar = 0;

  for (const f of files) {
    if (cancel?.cancelled) break;
    // استئناف: ملف اكتمل بنفس البصمة — لا يُعاد تنزيله
    // (force = إصلاح حالة قديمة: يُتجاهَل السجل وتُعاد كتابة كل الملفات نظيفة)
    if (!force && f.hash && doneMap[f.path] === f.hash) {
      done++;
      onProgress?.(done, files.length, f.label, questionsSoFar, failed.length);
      continue;
    }
    const timeoutMs = f.size > 2_000_000 ? 240_000 : 90_000;
    let data: any = null;
    for (let attempt = 0; attempt < 3 && !data; attempt++) {
      if (cancel?.cancelled) break;
      data = await downloadFile(f.path, cancel, timeoutMs);
    }
    if (cancel?.cancelled) break;
    if (!data) {
      failed.push(f.path);
      done++;
      onProgress?.(done, files.length, f.label, questionsSoFar, failed.length);
      continue;
    }
    try {
      // ابتلاع صارم (إصلاح المشرف الخبير 21 أكتوبر): ملف يُنزَّل لكنه لا يُنتج
      // محتوًى فعليًا — تطبيع null أو صفر أسئلة/حالات — = فشل صريح: لا يُسجَّل
      // منجزًا في cdn_done_files (فيُعاد تنزيله لاحقًا) ويُحسَب ضمن failed.
      // تسجيله «منجزًا» كان يبتلع خسارته بصمت داخل هامش الـ95٪.
      let ingested = false;
      if (f.path === 'cases.json') {
        const rows = normalizeCasesFile(data);
        if (rows && rows.length > 0) {
          await upsertVirtualCases(rows);
          fileSubjects[f.path] = CASES_SUBJECT_MARKER;
          questionsSoFar += rows.length;
          ingested = true;
        }
      } else if (f.path.startsWith('practice_models/')) {
        // النماذج لا تدخل SQLite — تُحفظ بالكاش المشفّر عبر primeDownloadedFile.
        // ملف الفهرس (index.json) بلا مصفوفة أسئلة بطبيعته — يكفي كونه كائنًا؛
        // ملف نموذج بلا أسئلة فعلية = تالف ← فشل.
        if (f.path.endsWith('index.json')) {
          ingested = !!data && typeof data === 'object';
        } else if (Array.isArray((data as any)?.questions) && (data as any).questions.length > 0) {
          questionsSoFar += (data as any).questions.length;
          ingested = true;
        }
      } else {
        const nf = normalizeFile(f.path, data);
        if (nf && nf.questions.length > 0) {
          await upsertNormalizedFile(nf);
          fileSubjects[f.path] = nf.subject.id;
          questionsSoFar += nf.questions.length;
          ingested = true;
        }
      }
      if (!ingested) {
        failed.push(f.path);
      } else {
        // توحيد الطبقات: الكاش المشفّر الذي تقرأ منه الشاشات يُعبَّأ من نفس التنزيل
        await primeDownloadedFile(f.path, data);
        doneMap[f.path] = f.hash || 'done';
        await writeSyncState(DONE_FILES_KEY, JSON.stringify(doneMap));
        await writeSyncState(FILE_SUBJECTS_KEY, JSON.stringify(fileSubjects));
      }
    } catch {
      failed.push(f.path);
    }
    done++;
    onProgress?.(done, files.length, f.label, questionsSoFar, failed.length);
  }

  return { failed, questionsSoFar, fileSubjects };
}

export interface SectionDownloadResult {
  ok: boolean;
  error?: FirstLaunchError;
  /** مسارات الملفات التي فشل تحميلها (للاستئناف لاحقًا) */
  failed?: string[];
  /** أسئلة القسم المحفوظة فعليًا بعد المحاولة — من التخزين نفسه */
  stored: number;
  /** أسئلة القسم المتوقعة من الـmanifest */
  expected: number | null;
}

/**
 * تحميل قسم واحد من زرّه داخل تبويبه — النموذج المعتمد بأمر الدكتور:
 * ملفات القسم فقط (بنطاق بادئته) ← تطبيع ← تخزين محلي + كاش القراءة.
 * النجاح (ok) لا يُعلَن إلا بعد تحقق فعلي: صفر ملفات فاشلة + مخزون القسم
 * في التخزين المحلي ≥ 95٪ من عدد الـmanifest. أي نقص ← 'failed' + failed[]
 * ويُستأنف لاحقًا من حيث توقف (سجل cdn_done_files).
 */
export async function downloadSection(
  section: SectionId,
  onProgress?: ProgressCallback,
  cancel?: CancelToken,
): Promise<SectionDownloadResult> {
  const manifest = await fetchManifest().catch(() => null);
  if (!manifest || !manifest.files) {
    return { ok: false, error: 'no-internet', stored: 0, expected: null };
  }
  const files = await collectSectionFiles(manifest, section);
  if (files.length === 0) {
    // القسم غائب من الـmanifest أصلًا — ليس عطل اتصال (إصلاح المشرف: تمييز الحالتين)
    return { ok: false, error: 'failed', stored: 0, expected: null };
  }

  // إصلاح الحالة القديمة الفاسدة (21 أكتوبر 2026 — شكوى «الأسئلة مكررة»):
  // سجلّ البصمات يدّعي اكتمال كل ملفات القسم، لكن عدّ التخزين الفعلي يكذّبه
  // (نقصٌ دون 95٪ أو زيادةٌ فوق 105٪ — صفوف موروثة من أجيال بناء أقدم بقيت
  // لأن السجل قال «منجز» فلم تُعَد كتابتها أبدًا). عندها لا ثقة بالسجل:
  // إعادة إدخال نظيفة كاملة لملفات القسم (force) تشفي الصفوف وتجدّد السجل.
  // أما التحميل المتقطع (سجلّ ناقص أصلًا) فيبقى استئنافه الطبيعي كما هو.
  const expected = files.reduce((s, f) => s + f.count, 0);
  const storedBefore = await countSectionStored(section);
  let force = false;
  if (
    storedBefore > 0 &&
    expected > 0 &&
    (storedBefore < Math.floor(expected * 0.95) ||
      storedBefore > Math.ceil(expected * 1.05))
  ) {
    const doneMap = await readDoneFiles();
    force = files.every((f) => !f.hash || doneMap[f.path] === f.hash);
  }

  const { failed } = await runFileLoop(files, onProgress, cancel, force);
  const stored = await countSectionStored(section);
  await persistSectionExpected(section, expected);

  if (cancel?.cancelled) return { ok: false, error: 'cancelled', failed, stored, expected };
  if (failed.length > 0) return { ok: false, error: 'failed', failed, stored, expected };

  // تحقق الاكتمال الفعلي من التخزين — لا نجاح شكليًا أبدًا:
  // متوقَّع صفري = لا أساس للتحقق ← فشل صريح لا نجاح متجاوِز (إصلاح المشرف الخبير)
  if (expected === 0) {
    return { ok: false, error: 'failed', failed, stored, expected };
  }
  if (stored < Math.floor(expected * 0.95)) {
    return { ok: false, error: 'failed', failed, stored, expected };
  }

  await primeIndexCaches(manifest);
  await writeSyncState(SYNC_STATE_KEY, JSON.stringify(buildManifestToken(manifest)));
  await setLocalContentVersion(manifest.version);
  return { ok: true, stored, expected };
}

/**
 * التحميل الكامل دفعة واحدة — باقٍ للتوافق فقط: بعد نموذج «زر لكل قسم»
 * (أمر الدكتور 21 أكتوبر 2026) لا تستدعيه أي شاشة، والدخول لا ينتظره أبدًا.
 * يحتفظ بضمانات الاستئناف/التحقق نفسها عبر runFileLoop المشتركة.
 */
export async function firstLaunchDownload(
  onProgress?: ProgressCallback,
  cancel?: CancelToken,
): Promise<FirstLaunchResult> {
  const manifest = await fetchManifest().catch(() => null);
  if (!manifest || !manifest.files) return { ok: false, error: 'no-internet' };
  const files = await collectContentFiles(manifest);
  if (files.length === 0) return { ok: false, error: 'no-internet' };

  const db = getDB();
  const { failed, fileSubjects } = await runFileLoop(files, onProgress, cancel);

  if (cancel?.cancelled) return { ok: false, error: 'cancelled', failed };
  if (failed.length > 0) return { ok: false, error: 'failed', failed };

  // تحقق الاكتمال الفعلي من القاعدة — لا جاهزية شكلية
  const expected = files
    .filter((f) => !f.path.startsWith('practice_models/') && f.path !== 'cases.json')
    .reduce((s, f) => s + f.count, 0);
  const stored = await countStoredContent();
  const expectedCases = manifest.files['cases.json']?.count ?? 0;
  if (expected > 0 && stored.questions < Math.floor(expected * 0.95)) {
    return { ok: false, error: 'failed', failed };
  }
  if (expectedCases > 0 && stored.cases === 0) {
    return { ok: false, error: 'failed', failed };
  }

  await primeIndexCaches(manifest);
  await writeSyncState(SYNC_STATE_KEY, JSON.stringify(buildManifestToken(manifest)));
  await writeSyncState(FILE_SUBJECTS_KEY, JSON.stringify(fileSubjects));
  await setLocalContentVersion(manifest.version);
  await db.execute('INSERT OR REPLACE INTO user_progress (key, value) VALUES (?, ?)', [
    READY_KEY,
    '1',
  ]);
  return { ok: true };
}

/**
 * مزامنة صامتة بالخلفية: تقارن الـmanifest مع البصمة المخزنة.
 * - نفس الإصدار ← {updated:0}
 * - ملفات تغيّر hashها أو ظهرت ← تحميل + upsert
 * - ملفات اختفت ← حذف أسئلتها + tombstone محلي
 * تلتقط كل الأخطاء داخليًا — لا ترمي استثناءً أبدًا.
 *
 * ⚠️ لم تعد تُستدعى عند إقلاع التطبيق (أمر الدكتور 21 أكتوبر 2026):
 * لا تنزيل/رفع محتوى تلقائيًا عند الدخول أبدًا — تحديث المحتوى يتم حصرًا
 * من أزرار تحميل الأقسام (downloadSection) بمبادرة المستخدم.
 */
export async function backgroundSync(): Promise<{ updated: number }> {
  try {
    const manifest = await fetchManifest();
    if (!manifest || !manifest.files) return { updated: 0 };
    const stored = await readManifestToken();
    if (!stored) return { updated: 0 }; // لم يكتمل التحميل الأول بعد
    if (stored.version === manifest.version) return { updated: 0 };

    const files = await collectContentFiles(manifest);
    const storedFiles = stored.files || {};
    const fileSubjects = await readFileSubjects();
    // cases.json يُعاد تحميله إن لم يُحمَّل من قبل أبدًا (ترقية تثبيتات قديمة
    // نُزِّلَت قبل دخول الحالات في التحميل الأول — إصلاح ذاتي لمرة واحدة).
    const changed = files.filter(
      (f) =>
        storedFiles[f.path] !== manifest.files[f.path]?.hash ||
        (f.path === 'cases.json' && fileSubjects['cases.json'] !== CASES_SUBJECT_MARKER),
    );
    const vanished = Object.keys(storedFiles).filter(
      (p) => (isContentPath(p) || p === 'cases.json') && !manifest.files[p],
    );
    let updated = 0;

    const doneMap = await readDoneFiles();
    for (const f of changed) {
      const data = await downloadFile(f.path);
      if (!data) continue; // صامت — تُعاد المحاولة في المزامنة القادمة
      if (f.path === 'cases.json') {
        const rows = normalizeCasesFile(data);
        if (!rows || rows.length === 0) continue;
        await upsertVirtualCases(rows);
        fileSubjects[f.path] = CASES_SUBJECT_MARKER;
      } else {
        const nf = normalizeFile(f.path, data);
        if (!nf) continue;
        await upsertNormalizedFile(nf);
        fileSubjects[f.path] = nf.subject.id;
      }
      // توحيد الطبقات: عبّئ كاش القراءة + سجّل الاكتمال للاستئناف
      await primeDownloadedFile(f.path, data);
      doneMap[f.path] = manifest.files[f.path]?.hash ?? 'done';
      updated++;
    }
    await writeSyncState(DONE_FILES_KEY, JSON.stringify(doneMap));

    for (const p of vanished) {
      if (p === 'cases.json') {
        await deleteVirtualCases();
        delete fileSubjects[p];
        continue;
      }
      const sid = fileSubjects[p];
      if (sid) {
        await deleteSubjectContent(sid);
        delete fileSubjects[p];
      }
    }

    await writeSyncState(SYNC_STATE_KEY, JSON.stringify(buildManifestToken(manifest)));
    await writeSyncState(FILE_SUBJECTS_KEY, JSON.stringify(fileSubjects));
    await setLocalContentVersion(manifest.version);
    return { updated };
  } catch {
    return { updated: 0 };
  }
}
