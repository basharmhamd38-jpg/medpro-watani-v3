// طبقة «أوفلاين-أول» لتطبيق وطني.
// - التحميل الكامل عند أول تشغيل (firstLaunchDownload) مع تقدم وإلغاء.
// - مزامنة صامتة بالخلفية (backgroundSync) عند تغيّر الـmanifest.
// المصدر: Cloudflare CDN للقراءة فقط — لا كتابة ولا حذف في Firestore.
// التخزين: SQLite المشفرة (INSERT OR REPLACE داخل transaction لكل ملف).
// الـids ثابتة عبر المزامنات (انظر normalize.ts) فيعمل الـupsert بأمان.

import { getDB } from '../db/database';
import {
  fetchManifest,
  discoverFiles,
  downloadFile,
  getQuestionsIndex,
  getDawratSubjects,
  getUnivSubjects,
  primeDownloadedFile,
  type CancelToken,
  type CdnManifest,
} from '../content/cloudflare';
import { setLocalContentVersion } from '../content/contentVersion';
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

/**
 * تعداد ملفات المحتوى من الـCDN:
 * شاردات الأسئلة (من questions.json) + dawrat/* + dawrat_jami3at/* باكتشاف ديناميكي
 * + الحالات السريرية cases.json (آخر القائمة — تُحمَّل بعد الأسئلة).
 * ملاحظة: cases_de.json (ألمانية) لا تُدخَل أبدًا.
 */
async function collectContentFiles(manifest: CdnManifest): Promise<ContentFile[]> {
  const seen = new Set<string>();
  const out: ContentFile[] = [];
  const push = (path: string, label: string) => {
    if (!seen.has(path)) {
      seen.add(path);
      const info = manifest.files[path];
      out.push({
        path,
        label,
        hash: info?.hash ?? '',
        size: info?.size ?? 0,
        count: info?.count ?? 0,
      });
    }
  };
  // 1) شاردات بنك الأسئلة
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
        push(p, sh.subject_name || labelForPath(p));
      }
    }
  } catch {
    /* تجاهل — تُكمل الدورات */
  }
  // 2) دورات الوطني ودورات الجامعات — اكتشاف ديناميكي من الـmanifest
  const dawrat = await discoverFiles('dawrat').catch(() => [] as string[]);
  const univ = await discoverFiles('dawrat_jami3at').catch(() => [] as string[]);
  for (const p of [...dawrat, ...univ]) push(p, labelForPath(p));
  // 3) النماذج التدريبية — ليست في الـmanifest: تُكتشف من فهرسها الخاص
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
  // 4) الحالات السريرية (آخرًا — لا تؤخر الأسئلة الحرجة)
  if (manifest.files['cases.json'] && (manifest.files['cases.json'].count ?? 0) > 0) {
    push('cases.json', 'الحالات السريرية');
  }
  return out;
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
        'INSERT OR REPLACE INTO questions (id, subject_id, session_id, code, q, options, correct_index, correct_indices, explanation, explanation_source, session_label, topic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
 * التحميل الكامل عند أول تشغيل — بمعيار «زر تحميل» صريح:
 * manifest ← كل الملفات ← تطبيع ← SQLite + تعبئة كاش القراءة.
 * ضمانات (تشخيص 20 أكتوبر 2026):
 * - **استئناف:** كل ملف ناجح يُسجَّل فورًا (مسار←بصمة)؛ إعادة المحاولة تتخطى المنجز.
 * - **فشل ملف لا يقتل الباقي:** يُجمع في قائمة الفاشلة ويُستكمل التحميل.
 * - **مهلات واقعية:** الملفات الكبيرة (>2MB) بمهلة 240s و3 محاولات.
 * - **تحقق اكتمال:** الجاهزية لا تُضبط إلا بصفر فاشلة + أسئلة محفوظة ≥ 95٪ من المتوقع.
 * - فشل الـmanifest ← 'no-internet'؛ إلغاء ← 'cancelled'؛ نقص ← 'failed' + failed[].
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
  const doneMap = await readDoneFiles();
  const fileSubjects = await readFileSubjects();
  const failed: string[] = [];
  let done = 0;
  let questionsSoFar = 0;

  for (const f of files) {
    if (cancel?.cancelled) return { ok: false, error: 'cancelled', failed };
    // استئناف: ملف اكتمل بنفس البصمة — لا يُعاد تنزيله
    if (f.hash && doneMap[f.path] === f.hash) {
      done++;
      onProgress?.(done, files.length, f.label, questionsSoFar, failed.length);
      continue;
    }
    const timeoutMs = f.size > 2_000_000 ? 240_000 : 90_000;
    let data: any = null;
    for (let attempt = 0; attempt < 3 && !data; attempt++) {
      if (cancel?.cancelled) return { ok: false, error: 'cancelled', failed };
      data = await downloadFile(f.path, cancel, timeoutMs);
    }
    if (cancel?.cancelled) return { ok: false, error: 'cancelled', failed };
    if (!data) {
      failed.push(f.path);
      done++;
      onProgress?.(done, files.length, f.label, questionsSoFar, failed.length);
      continue;
    }
    try {
      if (f.path === 'cases.json') {
        const rows = normalizeCasesFile(data);
        if (rows && rows.length > 0) {
          await upsertVirtualCases(rows);
          fileSubjects[f.path] = CASES_SUBJECT_MARKER;
        }
      } else if (!f.path.startsWith('practice_models/')) {
        const nf = normalizeFile(f.path, data);
        if (nf) {
          await upsertNormalizedFile(nf);
          fileSubjects[f.path] = nf.subject.id;
          questionsSoFar += nf.questions.length;
        }
      }
      // توحيد الطبقات: الكاش المشفّر الذي تقرأ منه الشاشات يُعبَّأ من نفس التنزيل
      await primeDownloadedFile(f.path, data);
      doneMap[f.path] = f.hash || 'done';
      await writeSyncState(DONE_FILES_KEY, JSON.stringify(doneMap));
      await writeSyncState(FILE_SUBJECTS_KEY, JSON.stringify(fileSubjects));
    } catch {
      failed.push(f.path);
    }
    done++;
    onProgress?.(done, files.length, f.label, questionsSoFar, failed.length);
  }

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
