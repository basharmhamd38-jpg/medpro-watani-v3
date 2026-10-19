// التخزين المؤقت المشفّر — طبقة حماية المحتوى المحمّل
// ─────────────────────────────────────────────────────────────
// 1) التشفير: XOR بمفتاح مشتق من معرّف التثبيت + سرّ التطبيق (جهاز-محدد)
// 2) لا JSON مكشوف: كل شيء مخزّن ككتل base64 مشفّرة
// 3) التمويه: تقسيم الكتل وخلط ترتيبها + ترويسة سحرية
// 4) السلامة: بصمة SHA-256 للنص الأصلي تُتحقق عند القراءة (تكشف العبث)
//
// ملاحظة: لا حماية مثالية على جهاز مروّت — الهدف تصعيب النسخ العادي
// (نسخ الملفات لجهاز آخر لن يفك التشفير لاختلاف معرّف التثبيت).

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── SHA-256 (تطبيق خالص بلا اعتماديات) ───

const SHA_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function sha256Bytes(msg: Uint8Array): Uint8Array {
  const l = msg.length;
  const bitLen = l * 8;
  const total = l + 1 + ((64 - ((l + 1 + 8) % 64)) % 64) + 8;
  const m = new Uint8Array(total);
  m.set(msg);
  m[l] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(total - 8, 0);
  dv.setUint32(total - 4, bitLen >>> 0);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4) >>> 0;
    for (let i = 16; i < 64; i++) {
      const s0 = (rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
      const s1 = (rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (h + S1 + ch + SHA_K[i] + w[i]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const od = new DataView(out.buffer);
  od.setUint32(0, h0); od.setUint32(4, h1); od.setUint32(8, h2); od.setUint32(12, h3);
  od.setUint32(16, h4); od.setUint32(20, h5); od.setUint32(24, h6); od.setUint32(28, h7);
  return out;
}

function sha256Hex(data: Uint8Array): string {
  const h = sha256Bytes(data);
  let s = '';
  for (let i = 0; i < h.length; i++) {
    s += h[i].toString(16).padStart(2, '0');
  }
  return s;
}

// ─── UTF-8 يدوي (لا اعتماد على TextEncoder) ───

function utf8Encode(str: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let cp = str.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < str.length) {
      const lo = str.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      }
    }
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return Uint8Array.from(out);
}

function utf8Decode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i];
    if (b < 0x80) { s += String.fromCharCode(b); i++; }
    else if ((b & 0xe0) === 0xc0) {
      s += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2;
    } else if ((b & 0xf0) === 0xe0) {
      s += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3;
    } else {
      const cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      const v = cp - 0x10000;
      s += String.fromCharCode(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff)); i += 4;
    }
  }
  return s;
}

// ─── Base64 يدوي ───

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64Encode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = i + 1 < bytes.length ? bytes[i + 1] : 0, b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    s += B64[b0 >> 2] + B64[((b0 & 3) << 4) | (b1 >> 4)];
    s += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    s += i + 2 < bytes.length ? B64[b2 & 63] : '=';
  }
  return s;
}

function base64Decode(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/=]/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64.indexOf(clean[i]), c1 = B64.indexOf(clean[i + 1]);
    const c2 = clean[i + 2] === '=' ? 0 : B64.indexOf(clean[i + 2]);
    const c3 = clean[i + 3] === '=' ? 0 : B64.indexOf(clean[i + 3]);
    out.push((c0 << 2) | (c1 >> 4));
    if (clean[i + 2] !== '=') out.push(((c1 & 15) << 4) | (c2 >> 2));
    if (clean[i + 3] !== '=') out.push(((c2 & 3) << 6) | c3);
  }
  return Uint8Array.from(out);
}

function base64UrlEncode(bytes: Uint8Array): string {
  return base64Encode(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(s: string): Uint8Array {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  return base64Decode(t);
}

// ─── أدوات ───

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a); out.set(b, a.length);
  return out;
}

function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

function randomHex(n: number): string {
  const b = randomBytes(n);
  let s = '';
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
  return s;
}

// مولد أرقام حتمي (xorshift32) لخلط الكتل — يُعاد إنتاجه من المفتاح+الـnonce
function shuffledOrder(n: number, seedBytes: Uint8Array): number[] {
  let s = ((seedBytes[0] << 24) | (seedBytes[1] << 16) | (seedBytes[2] << 8) | seedBytes[3]) >>> 0;
  if (s === 0) s = 0x9e3779b9;
  const order: number[] = [];
  for (let i = 0; i < n; i++) order.push(i);
  for (let i = n - 1; i > 0; i--) {
    s ^= (s << 13) >>> 0; s >>>= 0;
    s ^= s >>> 17;
    s ^= (s << 5) >>> 0; s >>>= 0;
    const j = s % (i + 1);
    const t = order[i]; order[i] = order[j]; order[j] = t;
  }
  return order;
}

// دفق المفتاح: SHA-256(key || nonce || counter) — نمط عدّاد
function keystream(keyHex: string, nonce: Uint8Array, length: number): Uint8Array {
  const keyBytes = hexToBytes(keyHex);
  const out = new Uint8Array(length);
  const ctr = new Uint8Array(4);
  let counter = 0;
  let offset = 0;
  while (offset < length) {
    ctr[0] = (counter >>> 24) & 0xff;
    ctr[1] = (counter >>> 16) & 0xff;
    ctr[2] = (counter >>> 8) & 0xff;
    ctr[3] = counter & 0xff;
    const block = sha256Bytes(concatBytes(concatBytes(keyBytes, nonce), ctr));
    const n = Math.min(32, length - offset);
    out.set(block.subarray(0, n), offset);
    offset += n;
    counter++;
  }
  return out;
}

// ─── معرّف التثبيت والمفتاح المشتق ───

const INSTALL_KEY = 'watani_install_id';
const STORE_PREFIX = 'wsec_';
// سرّ التطبيق (تمويه بسيط — السر الحقيقي هو معرّف التثبيت الفريد لكل جهاز)
const APP_SECRET = ['wtn', 'cdn', '9f3', 'k7x', '2m'].join('-');

let memInstallId: string | null = null;

export async function getInstallId(): Promise<string> {
  if (memInstallId) return memInstallId;
  try {
    let id = await AsyncStorage.getItem(INSTALL_KEY);
    if (!id) {
      id = randomHex(16);
      try {
        await AsyncStorage.setItem(INSTALL_KEY, id);
      } catch { /* تجاهل */ }
    }
    memInstallId = id;
    return id;
  } catch {
    if (!memInstallId) memInstallId = 'mem-' + randomHex(12);
    return memInstallId;
  }
}

let keyCache: string | null = null;

/** المفتاح المشتق: SHA-256(معرّف التثبيت : سر التطبيق : إصدار) — فريد لكل جهاز */
export async function deriveContentKey(): Promise<string> {
  if (keyCache) return keyCache;
  const id = await getInstallId();
  keyCache = sha256Hex(utf8Encode(id + ':' + APP_SECRET + ':watani-v1'));
  return keyCache;
}

// ─── التخزين المشفّر ───

const MAGIC = 'WTN1';
const CHUNK_CHARS = 32768; // ~24KB خام لكل كتلة

/** تخزين قيمة مشفّرة ومموّهة — لا يُكتب أي JSON مكشوف على القرص */
export async function secureSet(key: string, data: any): Promise<void> {
  const plaintext = JSON.stringify(data);
  const ptBytes = utf8Encode(plaintext);
  const keyHex = await deriveContentKey();
  const nonce = randomBytes(16);
  const cipher = xorBytes(ptBytes, keystream(keyHex, nonce, ptBytes.length));
  const b64 = base64Encode(cipher);

  const chunks: string[] = [];
  for (let i = 0; i < b64.length; i += CHUNK_CHARS) {
    chunks.push(b64.slice(i, i + CHUNK_CHARS));
  }
  const seed = sha256Bytes(concatBytes(hexToBytes(keyHex), nonce));
  const order = shuffledOrder(chunks.length, seed);
  const shuffled = order.map(i => chunks[i]);

  const hash = sha256Hex(ptBytes);
  const payload = [MAGIC, base64UrlEncode(nonce), hash, ...shuffled].join('.');
  await AsyncStorage.setItem(STORE_PREFIX + key, payload);
}

/** قراءة قيمة مشفّرة — null عند الغياب أو الفساد أو العبث */
export async function secureGet<T = any>(key: string): Promise<T | null> {
  let payload: string | null = null;
  try {
    payload = await AsyncStorage.getItem(STORE_PREFIX + key);
  } catch {
    return null;
  }
  if (!payload) return null;
  try {
    const parts = payload.split('.');
    if (parts[0] !== MAGIC || parts.length < 4) return null;
    const nonce = base64UrlDecode(parts[1]);
    const hash = parts[2];
    if (!/^[0-9a-f]{64}$/.test(hash)) return null;
    const shuffled = parts.slice(3);

    const keyHex = await deriveContentKey();
    const seed = sha256Bytes(concatBytes(hexToBytes(keyHex), nonce));
    const order = shuffledOrder(shuffled.length, seed);
    const chunks = new Array<string>(shuffled.length);
    // عكس التبديل: بما أن الترميز فعل shuffled[i] = chunks[order[i]]
    // فالاستعادة الصحيحة هي chunks[order[j]] = shuffled[j]
    for (let j = 0; j < order.length; j++) chunks[order[j]] = shuffled[j];

    const cipher = base64Decode(chunks.join(''));
    const ptBytes = xorBytes(cipher, keystream(keyHex, nonce, cipher.length));
    if (sha256Hex(ptBytes) !== hash) return null; // عبث مكتشف
    return JSON.parse(utf8Decode(ptBytes)) as T;
  } catch {
    return null;
  }
}

export async function secureRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORE_PREFIX + key);
  } catch { /* تجاهل */ }
}

/** فحص ذاتي سريع — يُستخدم في التطوير للتحقق من سلامة الخوارزمية */
export async function selfTestSecureCache(): Promise<boolean> {
  try {
    const sample = { a: 'نص عربي للاختبار', n: 12345, arr: [1, 2, 3] };
    await secureSet('__selftest__', sample);
    const back = await secureGet<any>('__selftest__');
    await secureRemove('__selftest__');
    return !!back && back.a === sample.a && back.n === sample.n;
  } catch {
    return false;
  }
}
