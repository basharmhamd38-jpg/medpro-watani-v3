// المفضلة: حفظ الأسئلة المهمة للمراجعة اللاحقة
// التخزين محلي (AsyncStorage) + مزامنة Firestore للمسجلين (fire-and-forget)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE } from '../config';

export interface FavoriteItem {
  qid: string; // معرف فريد للسؤال
  text: string; // نص السؤال
  options: { letter: string; text: string }[];
  correctIndex: number;
  explanation: string;
  subjectName: string; // اسم المادة/الموضوع
  source: string; // مصدر السؤال (بنك الأسئلة، الكورسات، التحدي...)
  addedAt: string; // ISO date
}

const KEY = 'watani_favorites';

async function readAll(): Promise<FavoriteItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function writeAll(items: FavoriteItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // تجاهل أخطاء التخزين
  }
  // مزامنة Firestore (لا تحجب الواجهة)
  syncToFirestore(items).catch(() => {});
}

/** مزامنة المفضلة إلى users/{uid}/favorites/list */
async function syncToFirestore(items: FavoriteItem[]): Promise<void> {
  try {
    const { getAuth, getDeviceId } = await import('../auth/auth');
    const a = getAuth();
    let uid = '';
    if (a.type === 'user') {
      uid = `email_${a.email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    } else {
      uid = getDeviceId();
    }
    if (!uid) return;
    const docPath =
      `projects/${FIREBASE.projectId}/databases/${FIREBASE.databaseId}` +
      `/documents/users/${encodeURIComponent(uid)}/favorites/list`;
    const url = `https://firestore.googleapis.com/v1/${docPath}?key=${FIREBASE.apiKey}`;
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          items: {
            arrayValue: {
              values: items.slice(0, 500).map((f) => ({
                mapValue: {
                  fields: {
                    qid: { stringValue: f.qid },
                    text: { stringValue: f.text.slice(0, 2000) },
                    subjectName: { stringValue: f.subjectName },
                    source: { stringValue: f.source },
                    addedAt: { stringValue: f.addedAt },
                  },
                },
              })),
            },
          },
          updatedAt: { stringValue: new Date().toISOString() },
        },
      }),
    });
  } catch {
    // تجاهل فشل المزامنة
  }
}

export async function getFavorites(): Promise<FavoriteItem[]> {
  return readAll();
}

export async function isFavorite(qid: string): Promise<boolean> {
  const items = await readAll();
  return items.some((f) => f.qid === qid);
}

export async function toggleFavorite(item: FavoriteItem): Promise<boolean> {
  const items = await readAll();
  const idx = items.findIndex((f) => f.qid === item.qid);
  let nowFav: boolean;
  if (idx >= 0) {
    items.splice(idx, 1);
    nowFav = false;
  } else {
    items.unshift({ ...item, addedAt: new Date().toISOString() });
    nowFav = true;
  }
  await writeAll(items);
  return nowFav;
}

export async function removeFavorite(qid: string): Promise<void> {
  const items = await readAll();
  await writeAll(items.filter((f) => f.qid !== qid));
}

export async function clearFavorites(): Promise<void> {
  await writeAll([]);
}

/** تجميع المفضلة حسب المادة للعرض */
export function groupBySubject(
  items: FavoriteItem[],
): { subject: string; items: FavoriteItem[] }[] {
  const map = new Map<string, FavoriteItem[]>();
  for (const f of items) {
    const key = f.subjectName || 'عام';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }
  return Array.from(map.entries()).map(([subject, list]) => ({
    subject,
    items: list,
  }));
}
