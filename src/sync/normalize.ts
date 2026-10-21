// تطبيع ملفات محتوى الـCDN إلى صفوف SQLite — دوال خالصة بلا أي اعتماد خارجي.
// تُستخدم من offlineSync.ts للكتابة في القاعدة، وتُختبر مباشرة عبر node.
//
// الصيغ المدعومة (كلها متسامحة مع الحقول الناقصة):
// - شارد بنك الأسئلة   questions/*.json      → kind='bank'
//   {subject_id, subject_name, topics:[{id,name,questions:[...]}]}
// - دورات الوطني        dawrat/*.json         → kind='dawrat'
//   {subject_id, subject_name, sessions:[{id,name,year,term,questions:[...]}]}
// - دورات الجامعات      dawrat_jami3at/<univ>/*.json → kind='university'
//   نفس بنية الدورات (sessions أو topics)
// - الحالات cases.json  → NormalizedCaseRow[] (عربية فقط — الألمانية cases_de.json لا تُدخَل أبدًا)

export type SubjectKind = 'bank' | 'dawrat' | 'university';

export interface NormalizedSubject {
  id: string;
  nameAr: string;
  kind: SubjectKind;
}

export interface NormalizedSection {
  /** `<subjectId>__<sessionId|index>` — مستقر عبر المزامنات */
  id: string;
  name: string;
  year: string;
  month: string;
  term: string;
  topic: string;
}

export interface NormalizedQuestionRow {
  /** ثابت عبر المزامنات: `<subjectId>__<q.id|q.code>` وإلا `<sessionId>#<index>` */
  id: string;
  subjectId: string;
  sessionId: string;
  code: string | null;
  q: string;
  options: string[];
  correctIndex: number;
  correctIndices: number[];
  explanation: string;
  explanationSource: string;
  sessionLabel: string;
  topic: string;
  /** موضوع التصنيف الطرفي من سلاسل q.topics (عرض «حسب المواضيع») — '' عند غيابه */
  classTopic: string;
}

export interface NormalizedFile {
  subject: NormalizedSubject;
  sections: NormalizedSection[];
  questions: NormalizedQuestionRow[];
}

function str(v: any): string {
  return v === null || v === undefined ? '' : String(v);
}

function baseName(path: string): string {
  return (path.split('/').pop() || '').replace(/\.json$/i, '');
}

/**
 * حلّ الفهرس الصحيح من الحقول المختلفة:
 * - `correct` رقمًا (index) أو مصفوفة (أول عنصر) أو حرفًا ('A'→0) أو نص الخيار
 * - وإلا `correctIndices[0]` — وإلا 0. يُقصَّر ضمن حدود الخيارات.
 */
export function resolveCorrectIndex(raw: any, options: string[]): number {
  const r = raw && typeof raw === 'object' ? raw : {};
  let idx = 0;
  const c = r.correct ?? r.correctIndex;
  if (typeof c === 'number' && Number.isFinite(c)) {
    idx = Math.trunc(c);
  } else if (Array.isArray(c) && c.length > 0) {
    const n = Number(c[0]);
    if (Number.isFinite(n)) idx = Math.trunc(n);
  } else if (typeof c === 'string') {
    const t = c.trim();
    if (/^[A-Za-z]$/.test(t)) {
      idx = t.toUpperCase().charCodeAt(0) - 65;
    } else {
      const n = parseInt(t, 10);
      if (!Number.isNaN(n)) {
        idx = n;
      } else {
        const oi = options.findIndex((o) => o === t);
        if (oi >= 0) idx = oi;
      }
    }
  } else if (Array.isArray(r.correctIndices) && r.correctIndices.length > 0) {
    const n = Number(r.correctIndices[0]);
    if (Number.isFinite(n)) idx = Math.trunc(n);
  }
  if (!Number.isInteger(idx)) idx = 0;
  if (options.length > 0) idx = Math.min(Math.max(idx, 0), options.length - 1);
  else if (idx < 0) idx = 0;
  return idx;
}

/**
 * الموضوع الطرفي لعرض «حسب المواضيع»: آخر مقطع من أول سلسلة تصنيف
 * (مثل «القلبية > قصور القلب» ← «قصور القلب»). الأسئلة المعلَّمة متفرقة
 * (topic_source ينتهي بـmisc أو نهاية السلسلة «متفرقة») تؤول إلى «متفرقة».
 */
export function classTopicOf(raw: any): string {
  const r = raw && typeof raw === 'object' ? raw : {};
  const src = str(r.topic_source ?? r.topicSource);
  if (/(^|_)misc$/i.test(src.trim())) return 'متفرقة';
  const chains: string[] = Array.isArray(r.topics)
    ? r.topics.map((x: any) => str(x).trim()).filter(Boolean)
    : [];
  if (chains.length === 0) return '';
  const leaf = (chains[0].split('>').pop() || '').trim();
  if (!leaf) return '';
  return leaf === 'متفرقة' ? 'متفرقة' : leaf;
}

function normalizeQuestion(
  q: any,
  index: number,
  subjectId: string,
  sessionId: string,
  topic: string,
  defaultSessionLabel: string,
): NormalizedQuestionRow {
  const raw = q && typeof q === 'object' ? q : {};
  const rawId = raw.id ?? raw.code;
  const id =
    rawId !== null && rawId !== undefined && String(rawId).trim() !== ''
      ? `${subjectId}__${String(rawId).trim()}`
      : `${sessionId}#${index}`;
  const options: string[] = Array.isArray(raw.options)
    ? raw.options.map((o: any) => str(o))
    : [];
  const correctIndex = resolveCorrectIndex(raw, options);
  let correctIndices: number[] = [];
  const ci = raw.correctIndices ?? raw.correct_indices;
  if (Array.isArray(ci)) {
    correctIndices = ci
      .map((n: any) => Number(n))
      .filter((n: number) => Number.isInteger(n));
  }
  if (correctIndices.length === 0) correctIndices = [correctIndex];
  return {
    id,
    subjectId,
    sessionId,
    code: raw.code !== null && raw.code !== undefined ? String(raw.code) : null,
    q: str(raw.text ?? raw.question),
    options,
    correctIndex,
    correctIndices,
    explanation: str(raw.explanation),
    explanationSource: str(raw.explanationSource ?? raw.explanation_source),
    sessionLabel: str(raw.sessionLabel ?? raw.session_label ?? defaultSessionLabel),
    topic: str(topic),
    classTopic: classTopicOf(raw),
  };
}

/**
 * يبني أقسام الملف (جلسات أو مواضيع) — id كل قسم:
 * `<subjectId>__<sessionId|topicId|index>` مع year/term عند توفرهما.
 */
function buildSections(subjectId: string, data: any): NormalizedSection[] {
  const raw: any[] = Array.isArray(data.sessions)
    ? data.sessions
    : Array.isArray(data.topics)
      ? data.topics
      : [];
  return raw.map((s: any, i: number) => {
    const r = s && typeof s === 'object' ? s : {};
    const sid =
      r.id !== null && r.id !== undefined && String(r.id).trim() !== ''
        ? String(r.id).trim()
        : `s${i}`;
    return {
      id: `${subjectId}__${sid}`,
      name: str(r.name) || `جلسة ${i + 1}`,
      year: str(r.year),
      month: str(r.month),
      term: str(r.term),
      topic: str(r.name),
    };
  });
}

function collectQuestions(
  subjectId: string,
  sections: NormalizedSection[],
  data: any,
  defaultSessionLabel: string,
): NormalizedQuestionRow[] {
  const raw: any[] = Array.isArray(data.sessions)
    ? data.sessions
    : Array.isArray(data.topics)
      ? data.topics
      : [];
  const out: NormalizedQuestionRow[] = [];
  // إزالة التكرار داخل الملف: نفس السؤال يظهر في موضوعه المحدد + «أسئلة عامة».
  // عند التعارض نُبقي النسخة ذات الموضوع المحدد (حتمي ومستقر عبر المزامنات).
  const seenId = new Map<string, number>();
  const isGeneralTopic = (t: string) => t.includes('عامة');
  raw.forEach((s: any, si: number) => {
    const r = s && typeof s === 'object' ? s : {};
    const sec = sections[si];
    if (!sec) return;
    const qs: any[] = Array.isArray(r.questions) ? r.questions : [];
    qs.forEach((q: any, qi: number) => {
      const row = normalizeQuestion(q, qi, subjectId, sec.id, sec.topic, defaultSessionLabel);
      const prevIdx = seenId.get(row.id);
      if (prevIdx === undefined) {
        seenId.set(row.id, out.length);
        out.push(row);
      } else if (isGeneralTopic(out[prevIdx].topic) && !isGeneralTopic(row.topic)) {
        out[prevIdx] = row;
      }
    });
  });
  return out;
}

/**
 * طبّع ملف CDN واحد (أسئلة). يُعيد null للملفات المُتجاهَلة (الحالات لها
 * normalizeCasesFile؛ الألمانية لا تُدخَل أبدًا) أو البنية الفارغة —
 * ولا يرمي استثناءً أبدًا مهما كانت البنية.
 */
export function normalizeFile(path: string, data: any): NormalizedFile | null {
  try {
    if (!data || typeof data !== 'object') return null;
    if (path === 'cases.json' || path === 'cases_de.json') return null;
    const base = baseName(path) || 'subject';

    if (path.startsWith('questions/')) {
      const sid = str(data.subject_id) || base;
      const subjectId = `bank_${sid}`;
      const sections = buildSections(subjectId, data);
      return {
        subject: { id: subjectId, nameAr: str(data.subject_name) || sid, kind: 'bank' },
        sections,
        questions: collectQuestions(subjectId, sections, data, ''),
      };
    }

    if (path.startsWith('dawrat_jami3at/')) {
      const univ = path.split('/')[1] || 'univ';
      const subjectId = `uni_${univ}_${base}`;
      const sections = buildSections(subjectId, data);
      return {
        subject: {
          id: subjectId,
          nameAr: str(data.subject_name) || base,
          kind: 'university',
        },
        sections,
        questions: collectQuestions(subjectId, sections, data, ''),
      };
    }

    if (path.startsWith('dawrat/')) {
      const sid = str(data.subject_id) || base;
      const subjectId = `dawrat_${sid}`;
      const sections = buildSections(subjectId, data);
      return {
        subject: {
          id: subjectId,
          nameAr: str(data.subject_name) || sid,
          kind: 'dawrat',
        },
        sections,
        questions: collectQuestions(subjectId, sections, data, ''),
      };
    }

    return null; // بادئة غير معروفة — تُتجاهَل بلا استثناء
  } catch {
    return null;
  }
}

/** هل هذا المسار ملف محتوى أسئلة تُديره هذه الطبقة؟ */
export function isContentPath(path: string): boolean {
  return (
    path.startsWith('questions/') ||
    path.startsWith('dawrat/') ||
    path.startsWith('dawrat_jami3at/')
  );
}

// ─── الحالات السريرية (cases.json) ───

/** صف حالة مُطبَّع — الحقول النصية المركبة تُخزَّن JSON */
export interface NormalizedCaseRow {
  id: string;
  title: string;
  specialty: string;
  source: string;
  sourceNote: string;
  difficulty: 'easy' | 'medium' | 'hard';
  presentation: string;
  /** JSON: {id,text,answer,isKey}[] */
  history: string;
  /** JSON: {id,text,finding,isKey}[] */
  examinations: string;
  /** JSON: {id,text,result,isKey}[] */
  tests: string;
  /** JSON: string[] */
  diagnosisOptions: string;
  correctDiagnosis: string;
  explanation: string;
  /** JSON: string[] */
  learningPoints: string;
  xpReward: number;
}

function arrOfStr(v: any): string[] {
  return Array.isArray(v) ? v.map((x: any) => (x === null || x === undefined ? '' : String(x))) : [];
}

function normalizeCaseItem(raw: any): NormalizedCaseRow | null {
  try {
    if (!raw || typeof raw !== 'object') return null;
    const id = str(raw.id).trim();
    const title = str(raw.title).trim();
    if (!id || !title) return null;
    const hist = (Array.isArray(raw.history) ? raw.history : [])
      .filter((x: any) => x && typeof x === 'object' && typeof x.text === 'string')
      .map((x: any, i: number) => ({
        id: x.id !== null && x.id !== undefined ? String(x.id) : `i${i}`,
        text: String(x.text),
        answer: x.answer ? String(x.answer) : '',
        isKey: !!x.isKey,
      }));
    const exams = (Array.isArray(raw.examinations) ? raw.examinations : [])
      .filter((x: any) => x && typeof x === 'object' && typeof x.text === 'string')
      .map((x: any, i: number) => ({
        id: x.id !== null && x.id !== undefined ? String(x.id) : `i${i}`,
        text: String(x.text),
        finding: x.finding ? String(x.finding) : '',
        isKey: !!x.isKey,
      }));
    const tests = (Array.isArray(raw.tests) ? raw.tests : [])
      .filter((x: any) => x && typeof x === 'object' && typeof x.text === 'string')
      .map((x: any, i: number) => ({
        id: x.id !== null && x.id !== undefined ? String(x.id) : `i${i}`,
        text: String(x.text),
        result: x.result ? String(x.result) : '',
        isKey: !!x.isKey,
      }));
    return {
      id,
      title,
      specialty: str(raw.specialty) || 'عام',
      source: str(raw.source) || 'Med Pro',
      sourceNote: str(raw.sourceNote),
      difficulty:
        raw.difficulty === 'easy' || raw.difficulty === 'hard' ? raw.difficulty : 'medium',
      presentation: str(raw.presentation),
      history: JSON.stringify(hist),
      examinations: JSON.stringify(exams),
      tests: JSON.stringify(tests),
      diagnosisOptions: JSON.stringify(arrOfStr(raw.diagnosisOptions)),
      correctDiagnosis: str(raw.correctDiagnosis),
      explanation: str(raw.explanation),
      learningPoints: JSON.stringify(arrOfStr(raw.learningPoints)),
      xpReward:
        typeof raw.xpReward === 'number' && !isNaN(raw.xpReward) ? raw.xpReward : 40,
    };
  } catch {
    return null;
  }
}

/**
 * طبّع ملف الحالات (cases.json — عربية فقط).
 * يقبل الغلاف {cases:[...]} أو مصفوفة مباشرة. يُعيد null للبنية الفارغة أو الفاسدة —
 * ولا يرمي استثناءً أبدًا مهما كانت البنية.
 */
export function normalizeCasesFile(data: any): NormalizedCaseRow[] | null {
  try {
    if (!data || typeof data !== 'object') return null;
    const list = Array.isArray(data) ? data : Array.isArray(data.cases) ? data.cases : null;
    if (!list || list.length === 0) return null;
    const out: NormalizedCaseRow[] = [];
    for (const raw of list) {
      const row = normalizeCaseItem(raw);
      if (row) out.push(row);
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}
