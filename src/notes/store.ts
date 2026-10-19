// الملاحظات الشخصية: ملاحظة حرة على أي سؤال
// التخزين محلي (AsyncStorage) + مزامنة Firestore للمسجلين (fire-and-forget)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE } from '../config';

export interface NoteItem {
  qid: string; // معرف السؤال
  questionText: string; // نص السؤال (للعرض)
  subjectName: string;
  note: string; // ملاحظة المستخدم
  createdAt: string;
  updatedAt: string;
}

const KEY = 'watani_notes';

async function readAll(): Promise<NoteItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function writeAll(items: NoteItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // تجاهل أخطاء التخزين
  }
  syncToFirestore(items).catch(() => {});
}

/** مزامنة الملاحظات إلى users/{uid}/notes/list */
async function syncToFirestore(items: NoteItem[]): Promise<void> {
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
      `/documents/users/${encodeURIComponent(uid)}/notes/list`;
    const url = `https://firestore.googleapis.com/v1/${docPath}?key=${FIREBASE.apiKey}`;
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          items: {
            arrayValue: {
              values: items.slice(0, 500).map((n) => ({
                mapValue: {
                  fields: {
                    qid: { stringValue: n.qid },
                    questionText: { stringValue: n.questionText.slice(0, 500) },
                    subjectName: { stringValue: n.subjectName },
                    note: { stringValue: n.note.slice(0, 2000) },
                    updatedAt: { stringValue: n.updatedAt },
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

export async function getNotes(): Promise<NoteItem[]> {
  const items = await readAll();
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getNote(qid: string): Promise<NoteItem | null> {
  const items = await readAll();
  return items.find((n) => n.qid === qid) ?? null;
}

export async function hasNote(qid: string): Promise<boolean> {
  return (await getNote(qid)) !== null;
}

export async function saveNote(
  qid: string,
  questionText: string,
  subjectName: string,
  note: string,
): Promise<void> {
  const trimmed = note.trim();
  const items = await readAll();
  const idx = items.findIndex((n) => n.qid === qid);
  const now = new Date().toISOString();
  if (!trimmed) {
    // ملاحظة فارغة = حذف
    if (idx >= 0) {
      items.splice(idx, 1);
      await writeAll(items);
    }
    return;
  }
  if (idx >= 0) {
    items[idx] = { ...items[idx], note: trimmed, updatedAt: now };
  } else {
    items.unshift({
      qid,
      questionText,
      subjectName,
      note: trimmed,
      createdAt: now,
      updatedAt: now,
    });
  }
  await writeAll(items);
}

export async function deleteNote(qid: string): Promise<void> {
  const items = await readAll();
  await writeAll(items.filter((n) => n.qid !== qid));
}
