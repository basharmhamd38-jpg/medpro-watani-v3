// تحقق من طبقة bankRead: تطبيع ملف حقيقي ← إدخال صفوف (نفس SQL الخاص بـofflineSync)
// ← قراءة عبر دوال bankRead — والعدد الخارج يجب أن يطابق الداخل.
// bankRead يُجمَّع من TS، وgetDB يُستبدل بقاعدة وهمية داخل الذاكرة.
const path = require('path');
const Module = require('module');

// ─── 1) تجميع TS إلى /tmp ───
const { execSync } = require('child_process');
const SRC = '/tmp/bankread-verify';
require('fs').writeFileSync(`${SRC}/tsconfig.json`, JSON.stringify({
  compilerOptions: {
    outDir: `${SRC}/out`, module: 'commonjs', target: 'es2020',
    esModuleInterop: true, skipLibCheck: true, strict: false,
  },
  include: [`${SRC}/normalize.ts`, `${SRC}/db/bankRead.ts`, `${SRC}/db/database.ts`],
}));
execSync(`npx tsc -p ${SRC}/tsconfig.json`, { cwd: '/home/hatch/workspace/watani-native-app/app', stdio: 'pipe' });

// ─── 2) حجب الاعتماديات الأصلية (op-sqlite) ───
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@op-engineering/op-sqlite') {
    return { open: () => { throw new Error('native sqlite stubbed'); } };
  }
  if (request.endsWith('secureCache') || request === '../content/secureCache') {
    return { deriveContentKey: async () => 'test-key' };
  }
  return origLoad.call(this, request, parent, isMain);
};

const normalize = require(`${SRC}/out/normalize.js`);
const bankRead = require(`${SRC}/out/db/bankRead.js`);
const database = require(`${SRC}/out/db/database.js`);

// ─── 3) قاعدة وهمية داخل الذاكرة ───
const tables = { subjects: [], sessions: [], questions: [] };

function insertOrReplace(table, row, pk) {
  const i = tables[table].findIndex((r) => r[pk] === row[pk]);
  if (i >= 0) tables[table][i] = row; else tables[table].push(row);
}

const fakeDB = {
  async execute(sql, params = []) {
    const s = String(sql).replace(/\s+/g, ' ');
    // INSERT subjects
    if (s.includes('INSERT') && s.includes('INTO subjects')) {
      const [id, name_ar, kind, section, question_count, downloaded, updated_at] = params;
      insertOrReplace('subjects', { id, name_ar, kind, section, question_count, downloaded, updated_at }, 'id');
      return { rows: [] };
    }
    if (s.includes('INSERT') && s.includes('INTO sessions')) {
      const [id, subject_id, name, year, month, term, is_free, question_count] = params;
      insertOrReplace('sessions', { id, subject_id, name, year, month, term, is_free, question_count }, 'id');
      return { rows: [] };
    }
    if (s.includes('INSERT') && s.includes('INTO questions')) {
      const [id, subject_id, session_id, code, q, options, correct_index, correct_indices,
             explanation, explanation_source, session_label, topic] = params;
      insertOrReplace('questions', { id, subject_id, session_id, code, q, options, correct_index,
        correct_indices, explanation, explanation_source, session_label, topic, _rowid: tables.questions.length }, 'id');
      return { rows: [] };
    }
    // SELECT COUNT total
    if (s.includes('SELECT COUNT(*) AS c FROM questions') && !s.includes('JOIN')) {
      return { rows: [{ c: tables.questions.length }] };
    }
    // SELECT COUNT by kind
    if (s.includes('JOIN subjects s ON')) {
      const byKind = {};
      for (const q of tables.questions) {
        const sub = tables.subjects.find((x) => x.id === q.subject_id);
        const k = sub ? sub.kind : '?';
        byKind[k] = (byKind[k] || 0) + 1;
      }
      return { rows: Object.entries(byKind).map(([kind, c]) => ({ kind, c })) };
    }
    // topics group
    if (s.includes('GROUP BY topic')) {
      const [subjectId] = params;
      const m = {};
      for (const q of tables.questions) {
        if (q.subject_id === subjectId && q.topic) m[q.topic] = (m[q.topic] || 0) + 1;
      }
      const rows = Object.entries(m).map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count);
      return { rows };
    }
    // FROM sessions
    if (s.includes('FROM sessions')) {
      const [subjectId] = params;
      const rows = tables.sessions.filter((x) => x.subject_id === subjectId)
        .sort((a, b) => (b.year < a.year ? -1 : b.year > a.year ? 1 : 0) || (a.name < b.name ? -1 : 1));
      return { rows };
    }
    // FROM questions
    if (s.includes('FROM questions')) {
      let rows = [...tables.questions];
      if (s.includes('subject_id = ?')) {
        const subjectId = params[0];
        rows = rows.filter((x) => x.subject_id === subjectId);
      }
      if (s.includes('session_id = ?')) {
        const sessionId = params[s.includes('subject_id = ?') ? 1 : 0];
        rows = rows.filter((x) => x.session_id === sessionId);
      }
      if (s.includes('topic = ?')) {
        const topic = params[params.length - 1];
        rows = rows.filter((x) => x.topic === topic);
      }
      rows.sort((a, b) => a._rowid - b._rowid);
      const lm = /LIMIT (\d+)/.exec(s);
      if (lm) rows = rows.slice(0, Number(lm[1]));
      return { rows };
    }
    // FROM subjects
    if (s.includes('FROM subjects')) {
      let rows = [...tables.subjects];
      if (s.includes("kind = 'university'") && s.includes('id LIKE ?')) {
        const like = params[0]; // uni_<clean>_%
        const prefix = like.replace(/%$/, '');
        rows = rows.filter((x) => x.kind === 'university' && x.id.startsWith(prefix));
      } else if (s.includes('kind = ?')) {
        rows = rows.filter((x) => x.kind === params[0]);
      } else if (s.includes("kind = 'university'")) {
        rows = rows.filter((x) => x.kind === 'university');
      }
      rows.sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar'));
      return { rows };
    }
    throw new Error('SQL غير مدعوم في الوهمية: ' + s.slice(0, 80));
  },
};
database.getDB = () => fakeDB;

// ─── 4) نسخة من منطق upsertNormalizedFile في offlineSync (نفس SQL والمعاملات) ───
async function upsertNormalizedFile(nf) {
  const counts = new Map();
  for (const q of nf.questions) counts.set(q.sessionId, (counts.get(q.sessionId) ?? 0) + 1);
  const now = Date.now();
  await fakeDB.execute(
    'INSERT OR REPLACE INTO subjects (id, name_ar, kind, section, question_count, downloaded, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
    [nf.subject.id, nf.subject.nameAr, nf.subject.kind, nf.subject.kind, nf.questions.length, now]
  );
  for (const sec of nf.sections) {
    await fakeDB.execute(
      'INSERT OR REPLACE INTO sessions (id, subject_id, name, year, month, term, is_free, question_count) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
      [sec.id, nf.subject.id, sec.name, sec.year, sec.month, sec.term, counts.get(sec.id) ?? 0]
    );
  }
  for (const q of nf.questions) {
    await fakeDB.execute(
      'INSERT OR REPLACE INTO questions (id, subject_id, session_id, code, q, options, correct_index, correct_indices, explanation, explanation_source, session_label, topic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [q.id, q.subjectId, q.sessionId, q.code, q.q, JSON.stringify(q.options), q.correctIndex,
       JSON.stringify(q.correctIndices), q.explanation, q.explanationSource, q.sessionLabel, q.topic]
    );
  }
}

// ─── 5) الاختبارات ───
const fs = require('fs');
const V1 = '/home/hatch/workspace/watani-content/public/v1';
const FILES = [
  'questions/الجلدية.json',
  'dawrat/الأذنية.json',
  'dawrat_jami3at/aleppo/أذن أنف حنجرة.json',
];

let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log('  ✓', msg); }
  else { failures++; console.log('  ✗ فشل:', msg); }
}

(async () => {
  let totalIn = 0;
  const byKindIn = { bank: 0, dawrat: 0, university: 0 };
  const univOf = {};

  for (const f of FILES) {
    console.log('\nملف:', f);
    const data = JSON.parse(fs.readFileSync(path.join(V1, f), 'utf8'));
    const nf = normalize.normalizeFile(f, data);
    assert(nf !== null, 'normalizeFile أعاد بنية (ليس null)');
    if (!nf) continue;
    await upsertNormalizedFile(nf);
    // ملاحظة: ملفات المحتوى قد تحوي أسئلة مكررة الـid — وINSERT OR REPLACE
    // (سلوك offlineSync الإنتاجي) يُبقي نسخة واحدة؛ المتوقع = الـids الفريدة
    const uniqueIds = new Set(nf.questions.map((q) => q.id));
    const expectedRows = uniqueIds.size;
    if (expectedRows !== nf.questions.length) {
      console.log(`  ⚠ ${nf.questions.length - expectedRows} سؤالًا مكرر الـid في الملف — تُدمج عند الكتابة (سلوك الإنتاج)`);
    }
    totalIn += expectedRows;
    byKindIn[nf.subject.kind] += expectedRows;
    console.log(`  داخل: ${nf.questions.length} سؤالًا — id المادة: ${nf.subject.id} — kind: ${nf.subject.kind}`);

    // المواد
    const subs = await bankRead.getBankSubjects(nf.subject.kind);
    const mine = subs.find((s) => s.id === nf.subject.id);
    assert(!!mine, `المادة موجودة في getBankSubjects('${nf.subject.kind}')`);
    assert(mine && mine.name === nf.subject.nameAr, 'اسم المادة مطابق');

    // الأقسام
    const sessions = await bankRead.getSubjectSessions(nf.subject.id);
    assert(sessions.length === nf.sections.length,
      `عدد الأقسام: ${sessions.length} = ${nf.sections.length}`);

    // الأسئلة لكل قسم — المجموع يجب أن يطابق الصفوف المكتوبة (ids فريدة)
    let readBack = 0;
    for (const sec of nf.sections) {
      const qs = await bankRead.getSessionQuestions(nf.subject.id, sec.id);
      readBack += qs.length;
    }
    assert(readBack === expectedRows,
      `أسئلة الأقسام: خارج ${readBack} = صفوف مكتوبة ${expectedRows}`);

    // فحص عينة: آخر نسخة لكل id مكرر هي ما تبقى بعد REPLACE — تطابق الحقول
    const lastById = new Map();
    for (const q of nf.questions) lastById.set(q.id, q);
    const q0in = [...lastById.values()][0];
    const qs0 = await bankRead.getSessionQuestions(nf.subject.id, q0in.sessionId);
    const q0out = qs0.find((q) => q.id === q0in.id);
    assert(!!q0out, 'السؤال الأول موجود بنفس الـid');
    if (q0out) {
      assert(q0out.text === q0in.q && q0out.q === q0in.q, 'نص السؤال مطابق');
      assert(JSON.stringify(q0out.options) === JSON.stringify(q0in.options), 'الخيارات مطابقة');
      assert(q0out.correctIndex === q0in.correctIndex && q0out.correct_index === q0in.correctIndex,
        `correctIndex مطابق (${q0in.correctIndex})`);
      assert(JSON.stringify(q0out.correctIndices) === JSON.stringify(q0in.correctIndices), 'correctIndices مطابقة');
      assert(q0out.explanation === q0in.explanation, 'الشرح مطابق');
      assert(q0out.topic === q0in.topic && q0out.sessionId === q0in.sessionId, 'الموضوع والقسم مطابقان');
    }

    // المواضيع: مجموع الأعداد = الصفوف المكتوبة ذات الموضوع (ids فريدة)
    const topics = await bankRead.getSubjectTopics(nf.subject.id);
    const tSum = topics.reduce((a, t) => a + t.count, 0);
    const withTopic = new Set(nf.questions.filter((q) => q.topic).map((q) => q.id)).size;
    assert(tSum === withTopic, `مجموع مواضيع: ${tSum} = ${withTopic}`);

    // أسئلة المادة كاملة + موضوع واحد
    const all = await bankRead.getSubjectQuestions(nf.subject.id);
    assert(all.length === expectedRows, `getSubjectQuestions: ${all.length} = ${expectedRows}`);
    if (topics.length > 0) {
      const tq = await bankRead.getTopicQuestions(nf.subject.id, topics[0].topic);
      assert(tq.length === topics[0].count, `getTopicQuestions: ${tq.length} = ${topics[0].count}`);
    }

    if (nf.subject.kind === 'university') {
      const u = bankRead.univIdOfSubjectId(nf.subject.id);
      assert(!!u, `استخراج univId: ${u}`);
      univOf[u] = (univOf[u] || 0) + nf.questions.length;
    }
  }

  console.log('\n── إحصائيات ──');
  const counts = await bankRead.getQuestionCounts();
  assert(counts.total === totalIn, `الإجمالي: ${counts.total} = ${totalIn}`);
  for (const k of ['bank', 'dawrat', 'university']) {
    assert(counts.byKind[k] === byKindIn[k], `byKind.${k}: ${counts.byKind[k]} = ${byKindIn[k]}`);
  }

  console.log('\n── الجامعات ──');
  const unis = await bankRead.getLocalUniversities();
  for (const [u, c] of Object.entries(univOf)) {
    const found = unis.find((x) => x.id === u);
    assert(!!found, `الجامعة ${u} موجودة`);
    assert(found && found.count === c, `عدد أسئلة ${u}: ${found && found.count} = ${c}`);
    const usubs = await bankRead.getUniversitySubjects(u);
    assert(usubs.length > 0, `مواد الجامعة ${u}: ${usubs.length} مادة`);
  }

  console.log('\n── المحوّلات ──');
  const dSess = await bankRead.getSubjectSessions('dawrat_الأذنية');
  const qs = dSess.length > 0
    ? await bankRead.getSessionQuestions('dawrat_الأذنية', dSess[0].id)
    : [];
  if (qs.length > 0) {
    const bq = bankRead.toBankQuestion(qs[0]);
    assert(bq.text === qs[0].text && bq.correctIndex === qs[0].correctIndex &&
           Array.isArray(bq.options) && typeof bq.explanation === 'string',
      'toBankQuestion بنفس شكل BankQuestion');
  } else {
    console.log('  (تخطي: لم توجد أسئلة للتحقق من المحوّل)');
  }

  // فشل مُتعمَّد: getDB ترمي → يجب أن تعيد مصفوفات فارغة بلا استثناء
  database.getDB = () => { throw new Error('db down'); };
  const e1 = await bankRead.getBankSubjects('bank');
  const e2 = await bankRead.getQuestionCounts();
  assert(Array.isArray(e1) && e1.length === 0, 'عند فشل القاعدة: مصفوفة فارغة');
  assert(e2.total === 0, 'عند فشل القاعدة: أعداد صفرية');

  console.log(failures === 0 ? '\n✅ كل الفحوصات نجحت' : `\n❌ ${failures} فحص فشل`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('خطأ غير متوقع:', e); process.exit(2); });
