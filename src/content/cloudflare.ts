// عميل محتوى Cloudflare — **طبقة احتياطية** (fallback) للمحتوى الثابت
// المصدر الأساسي الآن: Firestore (لوحة المالك تكتب هناك مباشرة).
// الترتيب الجديد: ذاكرة الجلسة ← Firestore ← Cloudflare CDN ← البذرة المحلية.
//
// البنية: manifest ← فحص الإصدارات | download ← تحميل الملفات | cache ← تخزين محلي
// الاكتشاف ديناميكي: كل الملفات تُقرأ من manifest.json.
//
// الحماية: التخزين المحلي مشفّر ومموّه عبر secureCache (لا JSON مكشوف على القرص).
// صلاحية الكاش: تُفحص عبر app_config/content_version (contentVersion.ts) —
// عند تحديث اللوحة للمحتوى يُبطل الكاش تلقائيًا.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureSet, secureGet, secureRemove } from './secureCache';
import { isCacheFresh } from './contentVersion';
import { fetchWithQuota } from './quotaGuard';

export const CDN_BASE = 'https://watani-content.pages.dev/v1';

export type ContentType = 'questions' | 'cases' | 'cases_de';

// ─── طبقات التحميل (الأولوية) ───
// 1) ذاكرة الجلسة (أسرع — داخل التشغيل الحالي)
// 2) Firestore (المصدر الأساسي للشبكة — لوحة المالك تكتب هناك)
// 3) الكاش المحلي المشفّر (يعمل أوفلاين — صلاحيته تُفحص عبر content_version)
// 4) شبكة Cloudflare CDN (احتياطي فقط عند فشل Firestore)
const MEM_TTL_MS = 60_000; // دقيقة واحدة لذاكرة الجلسة

interface MemEntry<T> { at: number; data: T; }
let memManifest: MemEntry<CdnManifest | null> | null = null;

// مفاتيح الكاش المشفّر للفهارس (كانت تُجلب من الشبكة فقط — سبب "المحمّل يطلب إنترنت")
const QUESTIONS_INDEX_CACHE_KEY = 'cdn_questions_index';
const DAWRAT_SUBJECTS_CACHE_KEY = 'cdn_dawrat_subjects';
let memQIndex: MemEntry<QuestionShardIndex | null> | null = null;
let memDawratSubs: MemEntry<DawratSubjectMeta[]> | null = null;

const FILE_NAMES: Record<ContentType, string> = {
  questions: 'questions.json',
  cases: 'cases.json',
  cases_de: 'cases_de.json',
};

const HASH_KEYS: Record<ContentType, string> = {
  questions: 'cdn_hash_questions',
  cases: 'cdn_hash_cases',
  cases_de: 'cdn_hash_cases_de',
};

// مفاتيح التخزين المشفّر (wsec_ = watani secure)
const SECURE_CACHE_KEYS: Record<ContentType, string> = {
  questions: 'cdn_questions',
  cases: 'cdn_cases',
  cases_de: 'cdn_cases_de',
};

// مفاتيح التخزين القديمة (JSON مكشوف) — للترحيل لمرة واحدة ثم الحذف
const LEGACY_CACHE_KEYS: Record<ContentType, string> = {
  questions: 'cdn_cache_questions',
  cases: 'cdn_cache_cases',
  cases_de: 'cdn_cache_cases_de',
};

export interface CancelToken {
  cancelled: boolean;
}

export function createCancelToken(): CancelToken {
  return { cancelled: false };
}

interface ManifestFile {
  hash: string;
  size: number;
  count: number;
  version: string;
}

export interface CdnManifest {
  version: string;
  files: Record<string, ManifestFile>;
}

/**
 * fetch بمهلة (AbortController) + حارس الحصة:
 * تراجع أسّي عند 429، وكسر دائرة بعد 3 استجابات 429 متتالية —
 * عندها يُتخطَّى الـCDN لخمس دقائق (QuotaExhaustedError «الحصة مستنفدة مؤقتًا»)
 * بدل ضرب الشبكة بملفات multi-MB أثناء العطل. كل المنادين يلتقطون الفشل
 * ويعيدون null/[]، وللواجهة: isSourceBlocked('cloudflare') من quotaGuard.
 */
async function fetchWithTimeout(url: string, ms = 20000): Promise<Response> {
  return fetchWithQuota('cloudflare', url, undefined, { timeoutMs: ms });
}

/**
 * ترميز مسار CDN مقطعًا بمقطع — أسماء الملفات العربية
 * (مثل dawrat/القلبية.json) تُرمَّز دون المساس بالشرطات المائلة.
 */
function encodeCdnPath(path: string): string {
  return path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

/** جلب الـmanifest — يُعيد null عند أي فشل (بلا استثناءات)
 *  الطبقة 1: ذاكرة الجلسة (60 ثانية) — ثم الشبكة. */
export async function fetchManifest(): Promise<CdnManifest | null> {
  if (memManifest && Date.now() - memManifest.at < MEM_TTL_MS) {
    return memManifest.data;
  }
  try {
    const res = await fetchWithTimeout(`${CDN_BASE}/manifest.json`, 15000);
    if (!res.ok) throw new Error('manifest http');
    const data = await res.json();
    if (!data || typeof data.version !== 'string' || !data.files) throw new Error('manifest shape');
    const m = data as CdnManifest;
    memManifest = { at: Date.now(), data: m };
    return m;
  } catch {
    return memManifest?.data ?? null;
  }
}

/**
 * اكتشاف ديناميكي: كل الملفات تحت بادئة معينة من الـmanifest.
 * مثال: discoverFiles('dawrat') → ['dawrat/القلبية.json', ...]
 * لا قوائم مكتوبة يدويًا — أي ملف جديد يظهر تلقائيًا.
 */
export async function discoverFiles(prefix: string): Promise<string[]> {
  const manifest = await fetchManifest();
  if (!manifest) return [];
  const p = prefix.endsWith('/') ? prefix : prefix + '/';
  return Object.keys(manifest.files).filter(
    f => f.startsWith(p) && (manifest.files[f].count ?? 0) > 0,
  );
}

/** معلومات ملف من الـmanifest — null عند غيابه */
export async function getManifestFile(path: string): Promise<ManifestFile | null> {
  const manifest = await fetchManifest();
  return manifest?.files?.[path] ?? null;
}

async function getStoredHash(type: ContentType): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(HASH_KEYS[type]);
  } catch {
    return null;
  }
}

async function storeHash(type: ContentType, hash: string): Promise<void> {
  try {
    await AsyncStorage.setItem(HASH_KEYS[type], hash);
  } catch {
    /* تجاهل */
  }
}

/**
 * قراءة المحتوى المخزّن محليًا (مشفر) — null عند غيابه أو فساده أو العبث به.
 * ترحيل لمرة واحدة من مفاتيح JSON المكشوفة القديمة إن وُجدت.
 */
export async function getCachedContent(type: ContentType): Promise<any | null> {
  const hit = await secureGet(SECURE_CACHE_KEYS[type]);
  if (hit !== null && hit !== undefined) return hit;
  // ترحيل: مفتاح قديم مكشوف → تشفير وحذف القديم
  try {
    const raw = await AsyncStorage.getItem(LEGACY_CACHE_KEYS[type]);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        await secureSet(SECURE_CACHE_KEYS[type], data);
        await AsyncStorage.removeItem(LEGACY_CACHE_KEYS[type]).catch(() => {});
        return data;
      } catch {
        /* JSON قديم فاسد — تجاهل */
      }
    }
  } catch { /* تجاهل */ }
  return null;
}

async function cacheContent(type: ContentType, data: any): Promise<void> {
  try {
    await secureSet(SECURE_CACHE_KEYS[type], data);
  } catch {
    /* تجاهل — التخزين فشل لكن البيانات صالحة للاستخدام الفوري */
  }
}

/** تحميل ملف خام من الـCDN بمسار نسبي — يُعيد null عند أي فشل أو إلغاء */
export async function downloadFile(
  path: string,
  cancel?: CancelToken,
  timeoutMs = 60000,
): Promise<any | null> {
  try {
    if (cancel?.cancelled) return null;
    const res = await fetchWithTimeout(
      `${CDN_BASE}/${encodeCdnPath(path)}`,
      timeoutMs,
    );
    if (cancel?.cancelled) return null;
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

/** تحميل ملف من الـCDN — يُعيد null عند أي فشل */
async function downloadContent(type: ContentType): Promise<any | null> {
  return downloadFile(FILE_NAMES[type]);
}

// ─── الأسئلة المجزأة (shards) ───

export interface QuestionShardMeta {
  file: string;
  subject_id: string;
  subject_name: string;
  count: number;
  size: number;
}

export interface QuestionShardIndex {
  version: string;
  count: number;
  sharded: boolean;
  shards: QuestionShardMeta[];
}

/**
 * فهرس الأسئلة — الأولوية: ذاكرة الجلسة ← الشبكة (يُخزَّن مشفّرًا) ← الكاش المشفّر.
 * صلاحية الكاش تُفحص عبر content_version (تحديثات اللوحة تُبطله).
 */
export async function getQuestionsIndex(): Promise<QuestionShardIndex | null> {
  if (memQIndex && Date.now() - memQIndex.at < MEM_TTL_MS) {
    return memQIndex.data;
  }
  try {
    const data = await downloadFile('questions.json', undefined, 15000);
    if (data && Array.isArray(data.shards)) {
      const idx = data as QuestionShardIndex;
      memQIndex = { at: Date.now(), data: idx };
      await secureSet(QUESTIONS_INDEX_CACHE_KEY, idx).catch(() => {});
      return idx;
    }
  } catch {
    /* سقوط للكاش المشفّر */
  }
  try {
    if (await isCacheFresh()) {
      const cached = await secureGet<QuestionShardIndex>(QUESTIONS_INDEX_CACHE_KEY);
      if (cached && Array.isArray(cached.shards)) {
        memQIndex = { at: Date.now(), data: cached };
        return cached;
      }
    }
  } catch {
    /* تجاهل */
  }
  memQIndex = { at: Date.now(), data: null };
  return null;
}

function shardCacheKey(file: string): string {
  return 'cdn_shard_' + file.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * جلب شارد مادة واحدة (مشفر محليًا) — يُعيد null عند الفشل.
 * البنية: {subject_id, subject_name, count, topics:[{id,name,questions:[...]}]}
 * صلاحية الكاش تُفحص عبر content_version: عند تحديث اللوحة يُتجاهل الكاش القديم.
 */
export async function getQuestionShard(subjectFile: string): Promise<any | null> {
  const key = shardCacheKey(subjectFile);
  try {
    if (await isCacheFresh()) {
      const cached = await secureGet(key);
      if (cached) return cached;
    } else {
      // إصدار جديد في اللوحة — إبطال الكاش القديم
      await secureRemove(key).catch(() => {});
    }
  } catch {
    /* تجاهل — أكمل للشبكة */
  }
  const data = await downloadFile(subjectFile);
  if (data && Array.isArray((data as any).topics)) {
    await secureSet(key, data).catch(() => {});
    return data;
  }
  // فشل الشبكة: آخر محاولة — الكاش القديم (أفضل من لا شيء أوفلاين)
  try {
    const stale = await secureGet(key);
    if (stale) return stale;
  } catch {
    /* تجاهل */
  }
  return null;
}

/** حذف شارد مخزّن (للترقية/التنظيف) */
export async function clearQuestionShard(subjectFile: string): Promise<void> {
  await secureRemove(shardCacheKey(subjectFile));
}

// ─── دورات الوطني (dawrat/) — اكتشاف ديناميكي ───

export interface DawratSubjectMeta {
  id: string;
  name: string;
  file: string;
  count: number;
  size: number;
}

/**
 * مواد دورات الوطني من الـmanifest — تُكتشف ديناميكيًا.
 * الأولوية: ذاكرة الجلسة ← الشبكة (تُخزَّن مشفّرة) ← الكاش المشفّر (بفحص الإصدار) ← [].
 */
export async function getDawratSubjects(): Promise<DawratSubjectMeta[]> {
  if (memDawratSubs && Date.now() - memDawratSubs.at < MEM_TTL_MS) {
    return memDawratSubs.data;
  }
  const build = (files: string[], manifest: CdnManifest | null): DawratSubjectMeta[] => {
    const out: DawratSubjectMeta[] = [];
    for (const f of files) {
      const info = manifest?.files?.[f];
      // اسم المادة من اسم الملف: dawrat/القلبية.json → القلبية
      const base = f.split('/').pop() || '';
      const name = base.replace(/\.json$/i, '');
      out.push({
        id: name,
        name,
        file: f,
        count: info?.count ?? 0,
        size: info?.size ?? 0,
      });
    }
    return out;
  };
  try {
    const files = await discoverFiles('dawrat');
    if (files.length > 0) {
      const manifest = await fetchManifest();
      const out = build(files, manifest);
      memDawratSubs = { at: Date.now(), data: out };
      await secureSet(DAWRAT_SUBJECTS_CACHE_KEY, out).catch(() => {});
      return out;
    }
  } catch {
    /* سقوط للكاش المشفّر */
  }
  try {
    if (await isCacheFresh()) {
      const cached = await secureGet<DawratSubjectMeta[]>(DAWRAT_SUBJECTS_CACHE_KEY);
      if (Array.isArray(cached) && cached.length > 0) {
        memDawratSubs = { at: Date.now(), data: cached };
        return cached;
      }
    }
  } catch {
    /* تجاهل */
  }
  if (memDawratSubs) return memDawratSubs.data;
  return [];
}

function dawratShardKey(file: string): string {
  return 'cdn_dawrat_' + file.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * بيانات مادة دورات واحدة — بنية متسامحة:
 * {sessions:[...]} أو {topics:[...]} — كل جلسة: {id,name,year,questions:[...]}
 * صلاحية الكاش تُفحص عبر content_version.
 */
export async function getDawratSubjectData(file: string): Promise<any | null> {
  const key = dawratShardKey(file);
  try {
    if (await isCacheFresh()) {
      const cached = await secureGet(key);
      if (cached) return cached;
    } else {
      await secureRemove(key).catch(() => {});
    }
  } catch {
    /* تجاهل — أكمل للشبكة */
  }
  const data = await downloadFile(file);
  if (data && (Array.isArray((data as any).sessions) || Array.isArray((data as any).topics))) {
    await secureSet(key, data).catch(() => {});
    return data;
  }
  try {
    const stale = await secureGet(key);
    if (stale) return stale;
  } catch {
    /* تجاهل */
  }
  return null;
}

export async function clearDawratSubjectData(file: string): Promise<void> {
  await secureRemove(dawratShardKey(file));
}

// ─── دورات الجامعات (dawrat_jami3at/<univId>/) — اكتشاف ديناميكي ───

const memUnivSubs: Record<string, MemEntry<DawratSubjectMeta[]>> = {};

/**
 * مواد جامعة معينة من الـmanifest — تُكتشف ديناميكيًا.
 * الأولوية: ذاكرة الجلسة ← الشبكة (تُخزَّن مشفّرة) ← الكاش المشفّر (بفحص الإصدار) ← [].
 */
export async function getUnivSubjects(univId: string): Promise<DawratSubjectMeta[]> {
  const mem = memUnivSubs[univId];
  if (mem && Date.now() - mem.at < MEM_TTL_MS) {
    return mem.data;
  }
  const cacheKey = `cdn_univ_subjects_${univId}`;
  const build = (files: string[], manifest: CdnManifest | null): DawratSubjectMeta[] => {
    const out: DawratSubjectMeta[] = [];
    for (const f of files) {
      const info = manifest?.files?.[f];
      // اسم المادة من اسم الملف: dawrat_jami3at/homs/طب الأطفال1.json → طب الأطفال1
      const base = f.split('/').pop() || '';
      const name = base.replace(/\.json$/i, '');
      out.push({
        id: name,
        name,
        file: f,
        count: info?.count ?? 0,
        size: info?.size ?? 0,
      });
    }
    return out;
  };
  try {
    const files = await discoverFiles(`dawrat_jami3at/${univId}`);
    if (files.length > 0) {
      const manifest = await fetchManifest();
      const out = build(files, manifest);
      memUnivSubs[univId] = { at: Date.now(), data: out };
      await secureSet(cacheKey, out).catch(() => {});
      return out;
    }
  } catch {
    /* سقوط للكاش المشفّر */
  }
  try {
    if (await isCacheFresh()) {
      const cached = await secureGet<DawratSubjectMeta[]>(cacheKey);
      if (Array.isArray(cached) && cached.length > 0) {
        memUnivSubs[univId] = { at: Date.now(), data: cached };
        return cached;
      }
    }
  } catch {
    /* تجاهل */
  }
  if (mem) return mem.data;
  return [];
}

/**
 * بيانات مادة جامعية واحدة — بنية متسامحة:
 * {sessions:[...]} أو {topics:[...]} — كل موضوع: {id,name,year,questions:[...]}
 * صلاحية الكاش تُفحص عبر content_version.
 */
export async function getUnivSubjectData(file: string): Promise<any | null> {
  const key = 'cdn_univ_' + file.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    if (await isCacheFresh()) {
      const cached = await secureGet(key);
      if (cached) return cached;
    } else {
      await secureRemove(key).catch(() => {});
    }
  } catch {
    /* تجاهل — أكمل للشبكة */
  }
  const data = await downloadFile(file);
  if (data && (Array.isArray((data as any).sessions) || Array.isArray((data as any).topics))) {
    await secureSet(key, data).catch(() => {});
    return data;
  }
  try {
    const stale = await secureGet(key);
    if (stale) return stale;
  } catch {
    /* تجاهل */
  }
  return null;
}

export async function clearUnivSubjectData(file: string): Promise<void> {
  await secureRemove('cdn_univ_' + file.replace(/[^a-zA-Z0-9_-]/g, '_'));
}

// ─── المزامنة والحالة ───

/**
 * فحص التحديثات: يقارن hashes الـmanifest مع المخزّن محليًا.
 * يُعيد خريطة الأنواع التي تحتاج تحميلًا. فارغة عند فشل جلب الـmanifest.
 */
export async function checkForUpdates(): Promise<Record<ContentType, boolean>> {
  const result: Record<ContentType, boolean> = {
    questions: false,
    cases: false,
    cases_de: false,
  };
  const manifest = await fetchManifest();
  if (!manifest) return result;
  const types: ContentType[] = ['questions', 'cases', 'cases_de'];
  for (const t of types) {
    const file = manifest.files[FILE_NAMES[t]];
    // ملف غير موجود أو عدده صفر = لا يُحمَّل (عنصر نائب)
    if (!file || !file.hash || (file.count ?? 0) <= 0) continue;
    const stored = await getStoredHash(t);
    if (stored !== file.hash) result[t] = true;
  }
  return result;
}

/**
 * مزامنة نوع محتوى واحد: يتحقق من الـmanifest ويحمّل عند الحاجة.
 * يُعيد البيانات (جديدة أو مخزّنة) أو null عند الفشل الكامل.
 */
export async function syncContent(type: ContentType): Promise<any | null> {
  // 1) هل يوجد تحديث؟
  let needsDownload = false;
  const manifest = await fetchManifest();
  const file = manifest?.files?.[FILE_NAMES[type]];
  if (file && file.hash && (file.count ?? 0) > 0) {
    const stored = await getStoredHash(type);
    needsDownload = stored !== file.hash;
    if (needsDownload) {
      const data = await downloadContent(type);
      if (data) {
        await cacheContent(type, data);
        await storeHash(type, file.hash);
        return data;
      }
      // فشل التحميل رغم وجود تحديث → استخدم المخزّن
    }
  }
  // 2) لا تحديث أو فشل → المخزّن المحلي
  const cached = await getCachedContent(type);
  if (cached) return cached;
  // 3) لا مخزّن → محاولة أخيرة: تحميل مباشر (أول تشغيل)
  if (!manifest) {
    const data = await downloadContent(type);
    if (data) {
      await cacheContent(type, data);
      return data;
    }
  }
  return null;
}

/**
 * جلب المحتوى: المخزّن أولًا (فوري أوفلاين — بفحص الإصدار)، ثم مزامنة بالخلفية.
 * للاستخدام في الشاشات: عرض فوري من الكاش + تحديث صامت.
 */
export async function getContent(type: ContentType): Promise<{
  data: any | null;
  fromCache: boolean;
}> {
  try {
    if (await isCacheFresh()) {
      const cached = await getCachedContent(type);
      if (cached) {
        // تحديث صامت بالخلفية (بلا انتظار)
        syncContent(type).catch(() => {});
        return { data: cached, fromCache: true };
      }
    }
  } catch {
    /* تجاهل — أكمل للمزامنة */
  }
  const data = await syncContent(type);
  return { data, fromCache: false };
}

/**
 * تحميل أولي لكل المحتوى — للاستدعاء عند أول تشغيل مع مؤشر تقدم.
 * الأسئلة: تُحمّل الشاردات كلها (قد تكون كبيرة — تُخزّن مشفّرة لكل شارد).
 */
export async function prefetchAllContent(
  onProgress?: (done: number, total: number, type: ContentType) => void,
  cancel?: CancelToken,
): Promise<void> {
  // الحالات أولًا (سريعة وصغيرة)
  const quick: ContentType[] = ['cases', 'cases_de'];
  let done = 0;
  for (const t of quick) {
    if (cancel?.cancelled) return;
    try {
      await syncContent(t);
    } catch { /* نوع فشل — أكمل البقية */ }
    done += 1;
    onProgress?.(done, 99, t);
  }
  // الأسئلة: كل الشاردات
  if (!cancel?.cancelled) {
    await downloadAllQuestionShards(
      (d, total) => onProgress?.(done + d, done + total, 'questions'),
      cancel,
    );
  }
}

/**
 * تحميل كل شاردات الأسئلة مع تقدم وإلغاء.
 * يُعيد عدد الشاردات المحمّلة بنجاح.
 */
export async function downloadAllQuestionShards(
  onProgress?: (done: number, total: number, subjectName: string) => void,
  cancel?: CancelToken,
): Promise<number> {
  const index = await getQuestionsIndex();
  if (!index || cancel?.cancelled) return 0;
  let ok = 0;
  let done = 0;
  for (const sh of index.shards) {
    if (cancel?.cancelled) break;
    try {
      const data = await getQuestionShard(sh.file);
      if (data) ok++;
    } catch { /* شارد فشل — أكمل */ }
    done++;
    onProgress?.(done, index.shards.length, sh.subject_name);
  }
  // حفظ بصمة الفهرس بعد اكتمال التحميل
  if (ok > 0 && !cancel?.cancelled) {
    try {
      const manifest = await fetchManifest();
      const f = manifest?.files?.['questions.json'];
      if (f?.hash) await storeHash('questions', f.hash);
    } catch { /* تجاهل */ }
  }
  return ok;
}

/**
 * تحميل كل ملفات دورات الوطني مع تقدم وإلغاء.
 * تُكتشف الملفات من الـmanifest ديناميكيًا.
 */
export async function downloadAllDawrat(
  onProgress?: (done: number, total: number, subjectName: string) => void,
  cancel?: CancelToken,
): Promise<number> {
  const subjects = await getDawratSubjects();
  if (subjects.length === 0 || cancel?.cancelled) return 0;
  let ok = 0;
  let done = 0;
  for (const s of subjects) {
    if (cancel?.cancelled) break;
    try {
      const data = await getDawratSubjectData(s.file);
      if (data) ok++;
    } catch { /* ملف فشل — أكمل */ }
    done++;
    onProgress?.(done, subjects.length, s.name);
  }
  return ok;
}

/** أحجام المحتوى من الـmanifest (للعرض قبل التحميل) */
export async function getContentSizes(): Promise<{
  questions: number;
  dawrat: number;
  cases: number;
  cases_de: number;
  total: number;
} | null> {
  const manifest = await fetchManifest();
  if (!manifest) return null;
  let questions = 0;
  let dawrat = 0;
  for (const [path, info] of Object.entries(manifest.files)) {
    if (path === 'questions.json') continue; // الفهرس فقط
    if (path.startsWith('questions/')) questions += info.size || 0;
    // بنوك الجامعات (~14MB) كانت تُتجاهل — تُحسب ضمن الدورات
    else if (path.startsWith('dawrat/') || path.startsWith('dawrat_jami3at/'))
      dawrat += info.size || 0;
  }
  const cases = manifest.files['cases.json']?.size || 0;
  const casesDe = manifest.files['cases_de.json']?.size || 0;
  return { questions, dawrat, cases, cases_de: casesDe, total: questions + dawrat + cases + casesDe };
}

/** عدد العناصر من الـmanifest */
export async function getContentCounts(): Promise<{
  questions: number;
  dawrat: number;
  cases: number;
  cases_de: number;
} | null> {
  const manifest = await fetchManifest();
  if (!manifest) return null;
  let questions = 0;
  let dawrat = 0;
  for (const [path, info] of Object.entries(manifest.files)) {
    if (path === 'questions.json') questions = info.count || 0;
    // بنوك الجامعات كانت تُتجاهل — تُحسب ضمن الدورات
    else if (path.startsWith('dawrat/') || path.startsWith('dawrat_jami3at/'))
      dawrat += info.count || 0;
  }
  return {
    questions,
    dawrat,
    cases: manifest.files['cases.json']?.count || 0,
    cases_de: manifest.files['cases_de.json']?.count || 0,
  };
}

/** مسح ذاكرة الـCDN المحلية (للتشخيص) */
export async function clearCdnCache(): Promise<void> {
  memManifest = null;
  memQIndex = null;
  memDawratSubs = null;
  try {
    const keys = [...Object.values(HASH_KEYS)];
    for (const k of keys) {
      try {
        await AsyncStorage.removeItem(k);
      } catch { /* تجاهل */ }
    }
    for (const t of Object.values(SECURE_CACHE_KEYS)) {
      await secureRemove(t);
    }
    await secureRemove(QUESTIONS_INDEX_CACHE_KEY);
    await secureRemove(DAWRAT_SUBJECTS_CACHE_KEY);
    for (const t of Object.values(LEGACY_CACHE_KEYS)) {
      try {
        await AsyncStorage.removeItem(t);
      } catch { /* تجاهل */ }
    }
  } catch { /* تجاهل */ }
}
