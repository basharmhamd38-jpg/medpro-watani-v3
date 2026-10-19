// نظام أكواد التفعيل — بديل الإيصال: المالك يولّد كودًا، المستخدم يدخله فيُفعَّل فورًا
// Firestore: مجموعة activation_codes — معرّف المستند هو الكود نفسه (مثال: WATANI-A1B2C3)
//
// المصادقة: تستخدم Firebase Auth ID token (مربوط من Google Sign-In) بدل مفتاح API
// المجهول — قواعد Firestore تمنع الوصول المجهول (403).
import { getAuth, GoogleAuthProvider, signInWithCredential } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { FIREBASE, GOOGLE } from '../config';
// حالة الدخول المحلية + معرّف الجهاز (auth.ts لا يستورد من هنا — لا دورة استيراد)
import { getAuth as getLocalAuth, deactivateLocal, getDeviceId, storage } from '../auth/auth';

export const ACTIVATION_CODES_COLLECTION = 'activation_codes';
const CODE_PREFIX = 'WATANI';

export interface ActivationCode {
  id: string; // = الكود نفسه
  code: string;
  isUsed: boolean;
  usedBy: string | null;
  usedByDevice: string | null; // معرّف الجهاز المرتبط — الكود يعمل على جهاز واحد فقط
  usedAt: string | null; // ISO
  expiresAt: string | null; // ISO — صلاحية الكود نفسه (اختياري)
  note: string;
  durationMonths: number; // مدة التفعيل الممنوحة عند استخدام الكود
  createdAt: string; // ISO
  createdBy: string;
  updateTime?: string; // توقيت آخر تعديل من Firestore — يُستخدم لقفل التفاؤل عند الاستبدال
}

export type RedeemError = 'not_found' | 'used' | 'expired' | 'quota' | 'network' | 'auth';
export type RedeemResult =
  | { ok: true; durationMonths: number; expiresAt: number }
  | { ok: false; error: RedeemError };

export class QuotaExceededError extends Error {
  constructor() {
    super('QUOTA_EXCEEDED');
    this.name = 'QuotaExceededError';
  }
}

export function quotaMessage(): string {
  return 'انتهت حصة الكتابة اليومية في قاعدة البيانات — ستتجدد تلقائيًا خلال 24 ساعة. لا يمكن إتمام التفعيل الآن.';
}

// أحرف غير ملتبسة: بلا 0/O و 1/I/L — 31 حرفًا
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// 8 أحرف ⇒ 31^8 ≈ 850 مليار احتمال — مستحيل التخمين عمليًا
const CODE_LENGTH = 8;

/** توليد كود عشوائي قوي: WATANI-XXXXXXXX */
export function generateCode(): string {
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `${CODE_PREFIX}-${s}`;
}

/** توحيد إدخال المستخدم: إزالة المسافات + أحرف كبيرة */
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s_]+/g, '');
}

// ─── Firestore REST ───

const BASE =
  `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}` +
  `/databases/${FIREBASE.databaseId}/documents`;

// ─── المصادقة: Firebase Auth ID token ───
// قواعد Firestore تمنع الوصول المجهول (403) — نستخدم رمز Firebase للمستخدم
// الحالي، مربوطًا من Google Sign-In تلقائيًا عند الحاجة.

let googleConfigured = false;
function ensureGoogleConfigured(): void {
  if (googleConfigured) return;
  try {
    GoogleSignin.configure({
      webClientId: GOOGLE.webClientId,
      scopes: ['email', 'profile'],
    });
    googleConfigured = true;
  } catch {
    // لا يعطل — سيُرمى خطأ مصادقة واضح لاحقًا
  }
}

/**
 * ترويسات المصادقة لـ Firestore REST API.
 * - إن كان المستخدم مسجلًا في Firebase Auth: يُستخدم رمزه مباشرة.
 * - وإلا: يُربط Google Sign-In الحالي بـ Firebase Auth تلقائيًا.
 * - يرمي Error('NOT_AUTHENTICATED') إن لم يكن هناك دخول Google.
 *
 * مُصدَّرة لإعادة الاستخدام (مثل: شاشة الصدارة) — القراءات المحمية
 * في Firestore ترفض المفتاح المجهول (403) وتتطلب هذا الرمز.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  ensureGoogleConfigured();

  const fbAuth = getAuth();
  let user = fbAuth.currentUser;
  if (!user) {
    // ربط Google Sign-In بـ Firebase Auth — يتطلب دخول Google مسبقًا
    // (لوحة المالك وشاشة التفعيل تشترطان دخول Google)
    let idToken: string | null = null;
    try {
      const tokens = await GoogleSignin.getTokens();
      idToken = tokens.idToken ?? null;
    } catch {
      idToken = null;
    }
    if (!idToken) {
      throw new Error('NOT_AUTHENTICATED');
    }
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(fbAuth, credential);
    user = result.user;
  }
  if (!user) {
    throw new Error('NOT_AUTHENTICATED');
  }
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/** هل الخطأ بسبب غياب المصادقة؟ */
export function isAuthError(e: unknown): boolean {
  return e instanceof Error && e.message === 'NOT_AUTHENTICATED';
}

function encodeField(value: any): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number')
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  return { stringValue: String(value) };
}

function throwIfQuota(res: Response, bodyText: string): void {
  if (res.status === 429 || bodyText.includes('Quota exceeded') || bodyText.includes('quota')) {
    throw new QuotaExceededError();
  }
}

function parseCodeDoc(id: string, fields: any): ActivationCode {
  const str = (v: any, fb = ''): string => (typeof v === 'string' ? v : fb);
  const num = (v: any, fb = 0): number => (typeof v === 'number' && !isNaN(v) ? v : fb);
  const bool = (v: any, fb = false): boolean => (typeof v === 'boolean' ? v : fb);
  const code = str(fields?.code, id);
  return {
    id,
    code,
    isUsed: bool(fields?.isUsed, false),
    usedBy: typeof fields?.usedBy === 'string' ? fields.usedBy : null,
    usedByDevice: typeof fields?.usedByDevice === 'string' ? fields.usedByDevice : null,
    usedAt: typeof fields?.usedAt === 'string' ? fields.usedAt : null,
    expiresAt: typeof fields?.expiresAt === 'string' ? fields.expiresAt : null,
    note: str(fields?.note),
    durationMonths: num(fields?.durationMonths, 12),
    createdAt: str(fields?.createdAt),
    createdBy: str(fields?.createdBy),
  };
}

/** جلب كود واحد — null إن لم يوجد */
export async function fetchCode(code: string): Promise<ActivationCode | null> {
  const id = normalizeCode(code);
  if (!id) return null;
  const url = `${BASE}/${ACTIVATION_CODES_COLLECTION}/${encodeURIComponent(id)}`;
  let headers: Record<string, string>;
  try {
    headers = await getAuthHeaders();
  } catch (e) {
    if (isAuthError(e)) throw new Error('NOT_AUTHENTICATED');
    throw e;
  }
  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch {
    throw new Error('NETWORK');
  }
  if (res.status === 404) return null;
  const text = await res.text();
  if (!res.ok) {
    throwIfQuota(res, text);
    throw new Error(`Firestore ${res.status}`);
  }
  const doc = JSON.parse(text);
  const fields: any = {};
  for (const k of Object.keys(doc.fields || {})) {
    const v = doc.fields[k];
    if (v.stringValue !== undefined) fields[k] = v.stringValue;
    else if (v.booleanValue !== undefined) fields[k] = v.booleanValue;
    else if (v.integerValue !== undefined) fields[k] = Number(v.integerValue);
    else if (v.doubleValue !== undefined) fields[k] = v.doubleValue;
    else if (v.timestampValue !== undefined) fields[k] = v.timestampValue;
    else if (v.nullValue !== undefined) fields[k] = null;
  }
  const parsed = parseCodeDoc(doc.name.split('/').pop() || id, fields);
  if (typeof doc.updateTime === 'string') parsed.updateTime = doc.updateTime;
  return parsed;
}

/**
 * استبدال الكود — ذري وآمن ضد الاستخدام المزدوج، ومربوط بجهاز واحد.
 *
 * الآلية (قفل تفاؤلي = compare-and-swap عبر REST):
 * 1. نقرأ المستند ونلتقط updateTime.
 * 2. نتحقق محليًا: موجود؟ غير منتهي؟ غير مربوط بجهاز آخر؟
 * 3. نرسل PATCH مع شرط currentDocument.updateTime — الكتابة تنجح فقط
 *    إذا لم يتغير المستند منذ قراءتنا. مستخدمان متزامنان: الأول ينجح،
 *    والثاني يفشل بشرط FAILED_PRECONDITION فيعيد القراءة فيرى
 *    usedByDevice لجهاز آخر فيُرفض برسالة "مستخدم مسبقًا".
 *
 * سياسة الجهاز الواحد:
 * - كود جديد → يُربط usedByDevice بجهازك الحالي.
 * - كود مربوط بجهاز آخر → مرفوض ('used').
 * - كود مستخدم لكن ربطه فارغ (أُعيد تعيينه من اللوحة أو كود قديم)
 *   → يُقبل ويُربط بجهازك (claim).
 * - كود مربوط بجهازك → يُقبل (إعادة تفعيل بعد حذف التطبيق مثلًا).
 */
export async function redeemCode(code: string, email: string): Promise<RedeemResult> {
  // معرّف هذا الجهاز — يُربط بالكود عند نجاح الاستبدال
  const deviceId = getDeviceId();
  let doc: ActivationCode | null;
  try {
    doc = await fetchCode(code);
  } catch (e) {
    if (e instanceof QuotaExceededError) return { ok: false, error: 'quota' };
    if (e instanceof Error && e.message === 'NOT_AUTHENTICATED') return { ok: false, error: 'auth' };
    return { ok: false, error: 'network' };
  }
  const localCheck = checkRedeemable(doc, deviceId);
  if (localCheck) return localCheck;

  // المحاولة الأولى مع قفل التفاؤل
  const attempt = await patchRedeem(doc!, email, deviceId);
  if (attempt === 'ok') return successResult(doc!);
  if (attempt === 'quota') return { ok: false, error: 'quota' };
  if (attempt === 'network') return { ok: false, error: 'network' };

  // فشل الشرط ⇒ شخص آخر عدّل المستند — أعد القراءة
  let fresh: ActivationCode | null;
  try {
    fresh = await fetchCode(code);
  } catch (e) {
    if (e instanceof QuotaExceededError) return { ok: false, error: 'quota' };
    return { ok: false, error: 'network' };
  }
  const recheck = checkRedeemable(fresh, deviceId);
  if (recheck) return recheck; // غالبًا: مربوط بجهاز آخر

  // ما زال متاحًا (تعديل إداري مثلًا) — محاولة أخيرة واحدة
  const retry = await patchRedeem(fresh!, email, deviceId);
  if (retry === 'ok') return successResult(fresh!);
  if (retry === 'quota') return { ok: false, error: 'quota' };
  if (retry === 'conflict') {
    const final = await fetchCode(code).catch(() => null);
    // كتابتي نجحت فعلًا لكن الرد ضاع؟ الربط بجهازي هو الدليل
    if (final && final.usedByDevice === deviceId) return successResult(final);
    if (final && final.isUsed) return { ok: false, error: 'used' };
  }
  return { ok: false, error: 'network' };
}

/** فحص محلي سريع: هل الكود صالح للاستبدال على هذا الجهاز؟ يُرجع الخطأ أو null إن كان صالحًا */
function checkRedeemable(doc: ActivationCode | null, deviceId: string): RedeemResult | null {
  if (!doc) return { ok: false, error: 'not_found' };
  if (doc.isUsed) {
    // الكود مستخدم: يُقبل فقط إن كان مربوطًا بهذا الجهاز (إعادة تفعيل)
    // أو كان الربط فارغًا (أُعيد تعيينه من اللوحة أو كود قديم) فيُربط بجهازك
    if (doc.usedByDevice && doc.usedByDevice !== deviceId) {
      return { ok: false, error: 'used' };
    }
  }
  if (doc.expiresAt && new Date(doc.expiresAt).getTime() < Date.now()) {
    return { ok: false, error: 'expired' };
  }
  return null;
}

function successResult(doc: ActivationCode): RedeemResult {
  const months = doc.durationMonths > 0 ? doc.durationMonths : 12;
  const expiresAt = Date.now() + months * 30 * 24 * 3600 * 1000;
  return { ok: true, durationMonths: months, expiresAt };
}

/**
 * محاولة تعليم الكود كمستخدم وربطه بهذا الجهاز، مع شرط updateTime.
 * تُرجع: 'ok' | 'conflict' (تغيّر المستند) | 'quota' | 'network'
 */
async function patchRedeem(
  doc: ActivationCode,
  email: string,
  deviceId: string,
): Promise<'ok' | 'conflict' | 'quota' | 'network'> {
  let url =
    `${BASE}/${ACTIVATION_CODES_COLLECTION}/${encodeURIComponent(doc.id)}` +
    `?updateMask.fieldPaths=isUsed&updateMask.fieldPaths=usedBy&updateMask.fieldPaths=usedAt` +
    `&updateMask.fieldPaths=usedByDevice`;
  // قفل التفاؤل: لا تكتب إلا إذا لم يتغير المستند منذ قراءته
  if (doc.updateTime) {
    url += `&currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`;
  }
  const nowIso = new Date().toISOString();
  let headers: Record<string, string>;
  try {
    headers = await getAuthHeaders();
  } catch {
    return 'network';
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        fields: {
          isUsed: encodeField(true),
          usedBy: encodeField(email),
          usedAt: encodeField(nowIso),
          usedByDevice: encodeField(deviceId),
        },
      }),
    });
  } catch {
    return 'network';
  }
  if (res.ok) return 'ok';
  const text = await res.text();
  if (res.status === 429 || text.includes('Quota exceeded') || text.includes('quota')) {
    return 'quota';
  }
  // 400 + FAILED_PRECONDITION ⇒ المستند تغيّر بعد قراءتنا (استخدام متزامن)
  if (text.includes('FAILED_PRECONDITION')) return 'conflict';
  return 'network';
}

// ─── ربط الكود بجهاز واحد: فحص الإقلاع ───

/** نتيجة فحص الربط عند الإقلاع */
export type BindingCheckResult = 'ok' | 'revoked' | 'skipped';

/**
 * فحص ربط الجهاز عند الإقلاع — يُستدعى بعد initAuthStorage (لا يعطل الإقلاع).
 *
 * - المستخدم غير مفعّل محليًا → 'skipped'
 * - بلا إنترنت / بلا مصادقة / حصة منتهية → 'skipped'
 *   (لا نعاقب المستخدم على غياب الشبكة — يبقى التفعيل المحلي)
 * - usedByDevice فارغ (كود قديم أو أُعيد تعيين الربط من اللوحة)
 *   → ربط صامت بجهازك الحالي → 'ok'
 * - usedByDevice يطابق جهازك → 'ok'
 * - usedByDevice لجهاز آخر → إلغاء التفعيل محليًا (يبقى الدخول)
 *   فيُعاد توجيه المستخدم لطلب كود جديد → 'revoked'
 */
export async function verifyDeviceBinding(): Promise<BindingCheckResult> {
  const local = getLocalAuth();
  if (local.type === 'guest' || !local.activated || local.expiresAt <= Date.now()) {
    return 'skipped';
  }
  const savedCode = storage.getString('activation_code_used');
  if (!savedCode) return 'skipped'; // لا كود محفوظ — لا يمكن التحقق
  const deviceId = getDeviceId();
  let doc: ActivationCode | null;
  try {
    doc = await fetchCode(savedCode);
  } catch {
    // شبكة / مصادقة / حصة — أبقِ التفعيل المحلي كما هو
    return 'skipped';
  }
  if (!doc) return 'skipped'; // الكود غير موجود — لا نعاقب محليًا
  if (!doc.usedByDevice) {
    // ترقية صامتة: الكود بلا ربط (قديم أو أُعيد تعيينه) — اربطه بهذا الجهاز
    await patchDeviceOnly(doc, deviceId);
    return 'ok';
  }
  if (doc.usedByDevice !== deviceId) {
    // الكود مربوط بجهاز آخر — ألغِ التفعيل محليًا واطلب كودًا جديدًا
    deactivateLocal();
    return 'revoked';
  }
  return 'ok';
}

/**
 * ربط صامت: تعيين usedByDevice فقط (للترقية الصامتة للأكواد القديمة
 * أو الأكواد التي أُعيد تعيين ربطها من اللوحة).
 */
async function patchDeviceOnly(doc: ActivationCode, deviceId: string): Promise<boolean> {
  let url =
    `${BASE}/${ACTIVATION_CODES_COLLECTION}/${encodeURIComponent(doc.id)}` +
    `?updateMask.fieldPaths=usedByDevice`;
  if (doc.updateTime) {
    url += `&currentDocument.updateTime=${encodeURIComponent(doc.updateTime)}`;
  }
  let headers: Record<string, string>;
  try {
    headers = await getAuthHeaders();
  } catch {
    return false;
  }
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields: { usedByDevice: encodeField(deviceId) } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface NewCodeInput {
  durationMonths: number;
  note: string;
  validityDays?: number; // صلاحية الكود نفسه — فارغ = بلا انتهاء
}

/** إنشاء كود جديد (يُستخدم من لوحة المالك) */
export async function createCode(input: NewCodeInput, createdBy: string): Promise<ActivationCode> {
  const code = generateCode();
  const nowIso = new Date().toISOString();
  const fields: Record<string, any> = {
    code: encodeField(code),
    isUsed: encodeField(false),
    usedBy: encodeField(null),
    usedByDevice: encodeField(null),
    usedAt: encodeField(null),
    note: encodeField(input.note || ''),
    durationMonths: encodeField(input.durationMonths),
    createdAt: encodeField(nowIso),
    createdBy: encodeField(createdBy),
  };
  if (input.validityDays && input.validityDays > 0) {
    fields.expiresAt = encodeField(
      new Date(Date.now() + input.validityDays * 24 * 3600 * 1000).toISOString(),
    );
  } else {
    fields.expiresAt = encodeField(null);
  }
  const url = `${BASE}/${ACTIVATION_CODES_COLLECTION}/${encodeURIComponent(code)}`;
  let headers: Record<string, string>;
  try {
    headers = await getAuthHeaders();
  } catch (e) {
    if (isAuthError(e)) throw new Error('NOT_AUTHENTICATED');
    throw e;
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields }),
    });
  } catch {
    throw new Error('NETWORK');
  }
  const text = await res.text();
  if (!res.ok) {
    throwIfQuota(res, text);
    throw new Error(`Firestore ${res.status}`);
  }
  return {
    id: code,
    code,
    isUsed: false,
    usedBy: null,
    usedByDevice: null,
    usedAt: null,
    expiresAt:
      input.validityDays && input.validityDays > 0
        ? new Date(Date.now() + input.validityDays * 24 * 3600 * 1000).toISOString()
        : null,
    note: input.note || '',
    durationMonths: input.durationMonths,
    createdAt: nowIso,
    createdBy,
  };
}

/** اسم المورد الكامل لمستند كود */
function docName(code: string): string {
  return `projects/${FIREBASE.projectId}/databases/${FIREBASE.databaseId}/documents/${ACTIVATION_CODES_COLLECTION}/${code}`;
}

/** حقول مستند كود جديد */
function newCodeFields(input: NewCodeInput, code: string, createdBy: string, nowIso: string) {
  const fields: Record<string, any> = {
    code: encodeField(code),
    isUsed: encodeField(false),
    usedBy: encodeField(null),
    usedByDevice: encodeField(null),
    usedAt: encodeField(null),
    note: encodeField(input.note || ''),
    durationMonths: encodeField(input.durationMonths),
    createdAt: encodeField(nowIso),
    createdBy: encodeField(createdBy),
  };
  if (input.validityDays && input.validityDays > 0) {
    fields.expiresAt = encodeField(
      new Date(Date.now() + input.validityDays * 24 * 3600 * 1000).toISOString(),
    );
  } else {
    fields.expiresAt = encodeField(null);
  }
  return fields;
}

function localCodeDoc(code: string, input: NewCodeInput, createdBy: string, nowIso: string): ActivationCode {
  return {
    id: code,
    code,
    isUsed: false,
    usedBy: null,
    usedByDevice: null,
    usedAt: null,
    expiresAt:
      input.validityDays && input.validityDays > 0
        ? new Date(Date.now() + input.validityDays * 24 * 3600 * 1000).toISOString()
        : null,
    note: input.note || '',
    durationMonths: input.durationMonths,
    createdAt: nowIso,
    createdBy,
  };
}

export const MAX_BATCH_CODES = 100;

/**
 * توليد دفعة أكواد تلقائيًا وكتابتها بطلب HTTP واحد (batchWrite).
 * - الأكواد تُولّد محليًا (عشوائية قوية WATANI-XXXXXXXX) — المالك لا يكتب شيئًا يدويًا.
 * - كل كتابة تحمل شرط currentDocument.exists=false ⇒ تصادم الكود مستحيل عمليًا،
 *   وإن حدث يُعاد توليد الكود المتصادم ويُعاد إرساله مرة واحدة.
 * - ملاحظة الحصة: batchWrite يوفّر طلبات الشبكة (طلب واحد بدل N) لكن كل مستند
 *   يُحتسب كتابة واحدة في حصة Firestore اليومية — هذا هو الحد الأدنى الممكن.
 */
export async function createCodesBatch(
  count: number,
  input: NewCodeInput,
  createdBy: string,
): Promise<ActivationCode[]> {
  const n = Math.max(1, Math.min(MAX_BATCH_CODES, Math.floor(count) || 1));
  const nowIso = new Date().toISOString();

  // توليد أكواد فريدة محليًا
  const seen = new Set<string>();
  const codes: string[] = [];
  while (codes.length < n) {
    const c = generateCode();
    if (!seen.has(c)) {
      seen.add(c);
      codes.push(c);
    }
  }

  const pending = [...codes];
  const created: ActivationCode[] = [];

  // ترويسات المصادقة مرة واحدة للدفعة
  let batchHeaders: Record<string, string>;
  try {
    batchHeaders = await getAuthHeaders();
  } catch (e) {
    if (isAuthError(e)) throw new Error('NOT_AUTHENTICATED');
    throw e;
  }

  for (let attempt = 0; attempt < 2 && pending.length > 0; attempt++) {
    const writes = pending.map((code) => ({
      update: { name: docName(code), fields: newCodeFields(input, code, createdBy, nowIso) },
      // إنشاء فقط: يفشل إن وُجد المستند مسبقًا (تصادم)
      currentDocument: { exists: false },
    }));
    const url = `${BASE}:batchWrite`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: batchHeaders,
        body: JSON.stringify({ writes }),
      });
    } catch {
      throw new Error('NETWORK');
    }
    const text = await res.text();
    if (!res.ok) {
      throwIfQuota(res, text);
      throw new Error(`Firestore ${res.status}`);
    }
    const body = JSON.parse(text);
    // status[i].code: 0=OK, 6=ALREADY_EXISTS (تصادم), 8=RESOURCE_EXHAUSTED (حصة)
    const statuses: Array<{ code?: number; message?: string }> = body.status || [];
    const collided: string[] = [];
    for (let i = 0; i < pending.length; i++) {
      const st = statuses[i] || { code: 0 };
      if (st.code === 0 || st.code === undefined) {
        created.push(localCodeDoc(pending[i], input, createdBy, nowIso));
      } else if (st.code === 6) {
        collided.push(pending[i]); // تصادم نادر — يُعاد توليده
      } else if (st.code === 8 || (st.message || '').toLowerCase().includes('quota')) {
        throw new QuotaExceededError();
      } else {
        throw new Error(`Firestore write failed: ${st.message || st.code}`);
      }
    }
    pending.length = 0;
    // إعادة توليد المتصادم فقط
    for (const old of collided) {
      let c = generateCode();
      while (seen.has(c)) c = generateCode();
      seen.add(c);
      pending.push(c);
    }
  }

  if (pending.length > 0) {
    throw new Error('تعذر إنشاء بعض الأكواد بعد محاولتين — حاول مجددًا');
  }
  return created;
}

/** قائمة كل الأكواد — الأحدث أولًا */
export async function listCodes(): Promise<ActivationCode[]> {
  const url = `${BASE}:runQuery`;
  let headers: Record<string, string>;
  try {
    headers = await getAuthHeaders();
  } catch (e) {
    if (isAuthError(e)) throw new Error('NOT_AUTHENTICATED');
    throw e;
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        structuredQuery: { from: [{ collectionId: ACTIVATION_CODES_COLLECTION }], limit: 200 },
      }),
    });
  } catch {
    throw new Error('NETWORK');
  }
  const text = await res.text();
  if (!res.ok) {
    throwIfQuota(res, text);
    throw new Error(`Firestore ${res.status}`);
  }
  const rows: any[] = JSON.parse(text);
  const out: ActivationCode[] = [];
  for (const r of rows) {
    if (!r.document) continue;
    const id = String(r.document.name).split('/').pop() || '';
    const raw = r.document.fields || {};
    const fields: any = {};
    for (const k of Object.keys(raw)) {
      const v = raw[k];
      if (v.stringValue !== undefined) fields[k] = v.stringValue;
      else if (v.booleanValue !== undefined) fields[k] = v.booleanValue;
      else if (v.integerValue !== undefined) fields[k] = Number(v.integerValue);
      else if (v.doubleValue !== undefined) fields[k] = v.doubleValue;
      else if (v.timestampValue !== undefined) fields[k] = v.timestampValue;
      else if (v.nullValue !== undefined) fields[k] = null;
    }
    out.push(parseCodeDoc(id, fields));
  }
  out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return out;
}

/** حذف/سحب كود */
export async function deleteCode(code: string): Promise<void> {
  const id = normalizeCode(code);
  const url = `${BASE}/${ACTIVATION_CODES_COLLECTION}/${encodeURIComponent(id)}`;
  let headers: Record<string, string>;
  try {
    headers = await getAuthHeaders();
  } catch (e) {
    if (isAuthError(e)) throw new Error('NOT_AUTHENTICATED');
    throw e;
  }
  let res: Response;
  try {
    res = await fetch(url, { method: 'DELETE', headers });
  } catch {
    throw new Error('NETWORK');
  }
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throwIfQuota(res, text);
    throw new Error(`Firestore ${res.status}`);
  }
}
