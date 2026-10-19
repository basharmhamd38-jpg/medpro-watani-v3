// المقارنة مع متوسط المستخدمين — مرتبة مئوية حقيقية من صدارة Firestore
import { FIREBASE, APP } from '../config';

export interface ComparisonResult {
  rank: number; // ترتيب المستخدم (1 = الأعلى)
  total: number; // عدد المستخدمين المقارَنين
  percentile: number; // النسبة المئوية لمن هم تحته (0-100)
  avgXP: number; // متوسط XP
  avgLevel: number; // متوسط المستوى
  myXP: number;
}

type LBUser = { xp: number; email: string };

async function fetchUsers(): Promise<LBUser[]> {
  const url =
    `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}` +
    `/databases/${FIREBASE.databaseId}/documents/users?pageSize=200&key=${FIREBASE.apiKey}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    const docs: any[] = data.documents ?? [];
    const adminEmail = APP.adminEmail.toLowerCase();
    const num = (f: any, k: string) => {
      const v = f?.[k];
      return v?.integerValue != null
        ? parseInt(v.integerValue, 10)
        : v?.doubleValue ?? 0;
    };
    return docs
      .map((d) => {
        const f = d.fields ?? {};
        const email = String(f.email?.stringValue ?? '').toLowerCase();
        return { xp: num(f, 'totalXP') || num(f, 'xp'), email };
      })
      .filter((u) => u.email && u.email !== adminEmail && u.xp >= 0);
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

/**
 * حساب المرتبة المئوية للمستخدم مقارنة بصدارة Firestore.
 * يُرجع null عند غياب البيانات (يُخفى القسم بواجهة أنيقة).
 */
export async function getComparison(
  myXP: number,
  myEmail: string,
): Promise<ComparisonResult | null> {
  try {
    const users = await fetchUsers();
    if (users.length < 2) return null;
    const email = myEmail.toLowerCase().trim();
    const sorted = [...users].sort((a, b) => b.xp - a.xp);
    // ترتيب المستخدم: الأول لمن لا يوجد في القائمة يُحسب بإدخاله افتراضيًا
    let rank = sorted.findIndex((u) => u.email === email) + 1;
    if (rank === 0) {
      rank = sorted.filter((u) => u.xp > myXP).length + 1;
    }
    const below = sorted.filter((u) => u.xp < myXP).length;
    const percentile = Math.round((below / sorted.length) * 100);
    const avgXP = Math.round(
      sorted.reduce((s, u) => s + u.xp, 0) / sorted.length,
    );
    const avgLevel =
      Math.round(
        (sorted.reduce((s, u) => s + Math.floor(Math.sqrt(u.xp / 100)) + 1, 0) /
          sorted.length) *
          10,
      ) / 10;
    return { rank, total: sorted.length, percentile, avgXP, avgLevel, myXP };
  } catch {
    return null;
  }
}
