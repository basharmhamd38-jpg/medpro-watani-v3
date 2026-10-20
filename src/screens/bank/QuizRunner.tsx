// عدّاء الاختبار المشترك: عرض الأسئلة + كشف فوري + شاشة النتائج
// النمط مطابق لـ PracticeModelsSection في AI Studio:
// الضغط على خيار يكشف الصح/الخطأ فورًا ويعرض الشرح — ثم التالي/السابق — ثم النتيجة.
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Modal, PanResponder, FlatList, type ListRenderItem } from 'react-native';
import { AppModal } from '../../components/AppModal';
import { AppTextInput as TextInput } from '../../components/AppText';
import { AppText as Text } from '../../components/AppText';
import LinearGradient from 'react-native-linear-gradient';
import { Focus, Heart, Inbox, RotateCcw, Share2, StickyNote, Timer, X } from 'lucide-react-native';
import { gradients, radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { rtlTextStyle } from '../../utils/bidi';
import { formatNumber } from '../../utils/numbers';
import EmptyStateCard from '../../components/EmptyStateCard';
import MascotCard from '../../components/MascotCard';
import RichText from '../../components/RichText';
import { QuestionSkeleton } from '../../components/Skeleton';
import { smoothLayout } from '../../utils/animations';
import { recordActivity } from '../../gamification/profile';
import { shareTestResult } from '../../utils/shareProgress';
import { isFavorite, toggleFavorite } from '../../favorites/store';
import { getNote, saveNote } from '../../notes/store';
import { gradeQuizResults } from '../../study/spacedRepetition';
import type { QuizQuestion } from '../../bank/quizBank';

const AR_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'];

type Props = {
  title: string;
  /** معرّف مستقر للمادة — يُستخدم لنقاط الضعف وSM-2 والسجل (W22) */
  subjectId?: string;
  questions: QuizQuestion[];
  loading: boolean;
  onExit: () => void;
  onRetry: () => void;
  /** وضع محاكاة الامتحان: عدد ثابت + مؤقت صارم + بلا كشف فوري ولا شروحات */
  mode?: 'practice' | 'mock';
  /** مدة المحاكاة بالدقائق (الافتراضي: 1.5 دقيقة لكل سؤال) */
  mockMinutes?: number;
};

function shuffleOrder(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function arCount(n: number): string {
  if (n === 1) return 'سؤال واحد';
  if (n === 2) return 'سؤالان';
  if (n >= 3 && n <= 10) return `${formatNumber(n)} أسئلة`;
  return `${formatNumber(n)} سؤالًا`;
}

// حد أقصى لطول الشرح المعالَج في مسار العرض — شروحات البنك المدمجة تصل
// لآلاف الأحرف، وقصّها في كل render يعلّق الواجهة.
// القاعدة الذهبية: صفر تهنيج حتى لو على حساب الزينة.
// ملاحظة: يُعرض النص مباشرة كما هو (بدون معالجة bidi) — مثل شاشة الترحيب.
const MAX_EXPLANATION_CHARS = 4000;

/** يقصّ الشرح مرة واحدة عند الحد — لا يُستدعى داخل JSX أبدًا */
function processExplanation(raw: string | null | undefined): string {
  const s = String(raw ?? '');
  if (!s) return '';
  const clipped = s.length > MAX_EXPLANATION_CHARS;
  const out = clipped ? s.slice(0, MAX_EXPLANATION_CHARS) : s;
  return clipped ? `${out}\n(تم اختصار الشرح لطوله)` : out;
}

export default function QuizRunner({ title, subjectId, questions, loading, onExit, onRetry, mode = 'practice', mockMinutes }: Props) {
  const { colors, primaryGradient } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const isMock = mode === 'mock';
  // مفتاح المادة المستقر (W22): بدل العنوان المعروض المتغير («محاكاة — X» مقابل «X»)
  const subjectKey = subjectId ?? title;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [finished, setFinished] = useState(false);
  const recordedRef = useRef(false);
  // ترتيب الأسئلة (W21): إعادة خلط حقيقية عند كل إعادة في وضع المحاكاة
  const [qOrder, setQOrder] = useState<number[]>(() => questions.map((_, i) => i));

  // مؤقت وضع المحاكاة: توقيت مبني على deadline (W20) — لا يتوقف في الخلفية
  const totalMockSecs = useMemo(() => {
    if (!isMock) return 0;
    if (mockMinutes && mockMinutes > 0) return Math.round(mockMinutes * 60);
    return Math.max(60, Math.round(questions.length * 90)); // 1.5 دقيقة لكل سؤال
  }, [isMock, mockMinutes, questions.length]);
  const [mockSecsLeft, setMockSecsLeft] = useState(totalMockSecs);
  const mockDeadlineRef = useRef(0);

  useEffect(() => {
    if (!isMock || finished || totalMockSecs <= 0) return;
    mockDeadlineRef.current = Date.now() + totalMockSecs * 1000;
    setMockSecsLeft(totalMockSecs);
    const t = setInterval(() => {
      // W23: كل الآثار الجانبية خارج الـupdater
      const left = Math.max(0, Math.ceil((mockDeadlineRef.current - Date.now()) / 1000));
      setMockSecsLeft(left);
      if (left <= 0) {
        clearInterval(t);
        setFinished(true); // انتهاء الوقت → إنهاء تلقائي
      }
    }, 500);
    return () => clearInterval(t);
  }, [isMock, finished, totalMockSecs]);

  const mockTimerText = useMemo(() => {
    const m = Math.floor(mockSecsLeft / 60);
    const s = mockSecsLeft % 60;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return h > 0
      ? `${h}:${mm < 10 ? '0' : ''}${mm}:${s < 10 ? '0' : ''}${s}`
      : `${mm}:${s < 10 ? '0' : ''}${s}`;
  }, [mockSecsLeft]);

  // وضع التركيز: ملء الشاشة بلا مشتتات + مؤقت
  const [focusMode, setFocusMode] = useState(false);
  const [focusSecs, setFocusSecs] = useState(0);

  // مؤقت وضع التركيز
  useEffect(() => {
    if (!focusMode) return;
    setFocusSecs(0);
    const t = setInterval(() => setFocusSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [focusMode]);

  // الخروج من وضع التركيز عند إنهاء الاختبار
  useEffect(() => {
    if (finished) setFocusMode(false);
  }, [finished]);

  const exitFocus = useCallback(() => setFocusMode(false), []);

  // السحب للأسفل على ترويسة وضع التركيز يخرج منه
  const focusPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 14 && Math.abs(g.dy) > Math.abs(g.dx) * 1.4,
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90) setFocusMode(false);
      },
    }),
  ).current;

  const focusTimerText = useMemo(() => {
    const m = Math.floor(focusSecs / 60);
    const s = focusSecs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }, [focusSecs]);

  // المفضلة والملاحظات للسؤال الحالي
  const [favved, setFavved] = useState(false);
  const [hasNoteFlag, setHasNoteFlag] = useState(false);
  const [noteModal, setNoteModal] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  const total = questions.length;
  const q = total > 0 ? questions[qOrder[Math.min(index, total - 1)] ?? 0] ?? null : null;
  const chosen = q ? answers[index] : undefined;
  // في وضع المحاكاة: لا كشف فوري ولا شروحات حتى النهاية
  const revealed = isMock ? false : chosen !== undefined;

  // نصوص السؤال الحالي تُجهَّز مرة واحدة لكل سؤال — تُعرض مباشرة كما هي
  // (بدون معالجة bidi) مثل شاشة الترحيب
  const qBidi = useMemo(() => {
    if (!q) return null;
    return {
      text: q.text,
      options: q.options.map((o) => o.text),
      explanation: processExplanation(q.explanation),
    };
  }, [q]);

  // معرّف مستقر للسؤال الحالي (للمفضلة والملاحظات) — بمفتاح المادة المستقر
  const qid = q ? `${subjectKey}::${q.id}` : '';

  // تحميل حالة المفضلة/الملاحظة عند تغيّر السؤال
  useEffect(() => {
    if (!q) {
      setFavved(false);
      setHasNoteFlag(false);
      return;
    }
    let cancelled = false;
    isFavorite(qid).then((v) => { if (!cancelled) setFavved(v); }).catch(() => {});
    getNote(qid).then((n) => { if (!cancelled) setHasNoteFlag(!!n); }).catch(() => {});
    return () => { cancelled = true; };
  }, [qid, q]);

  // الإحصائيات تُحسب فقط عند الإنهاء — لا تُنفَّذ أي عملية
  // تكرارية عند كل إجابة (حماية من التجميد مع بنوك كبيرة)
  const stats = useMemo(() => {
    if (!finished) {
      return { correct: 0, wrong: 0, unanswered: total, pct: 0, wrongList: [] as { q: QuizQuestion; userChoice: number; qIndex: number }[] };
    }
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    const wrongList: { q: QuizQuestion; userChoice: number; qIndex: number }[] = [];
    qOrder.forEach((qi, i) => {
      const qq = questions[qi];
      if (!qq) return;
      const a = answers[i];
      if (a === undefined) unanswered += 1;
      else if (a === qq.correctIndex) correct += 1;
      else {
        wrong += 1;
        wrongList.push({ q: qq, userChoice: a, qIndex: i });
      }
    });
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { correct, wrong, unanswered, pct, wrongList };
  }, [finished, answers, questions, qOrder, total]);

  // عناصر «مراجعة الأخطاء» تُجهَّز مرة واحدة عند الإنهاء — النصوص تُعرض
  // مباشرة كما هي (بدون معالجة bidi)
  const wrongListBidi = useMemo(
    () =>
      stats.wrongList.map(({ q: wq, userChoice, qIndex }) => ({
        key: `${wq.id}::${qIndex}`,
        qText: `${qIndex + 1}. ${wq.text}`,
        userAnswer:
          `إجابتك: ${AR_LETTERS[userChoice] ?? ''} — ${wq.options[userChoice]?.text ?? ''}`,
        rightAnswer:
          `الصحيحة: ${AR_LETTERS[wq.correctIndex] ?? ''} — ${wq.options[wq.correctIndex]?.text ?? ''}`,
        explanation: processExplanation(wq.explanation),
      })),
    [stats],
  );

  const pick = (i: number) => {
    if (!q) return;
    if (i < 0 || i >= q.options.length) return;
    // في المحاكاة يُسمح بتغيير الإجابة (بلا قفل)
    if (!isMock && revealed) return;
    smoothLayout(200); // انتقال ناعم لتحديد الإجابة
    setAnswers((prev) => ({ ...prev, [index]: i }));
  };

  const go = (next: number) => {
    if (next < 0 || next >= total) return;
    smoothLayout(220); // انتقال ناعم بين الأسئلة
    setIndex(next);
  };

  // تبديل المفضلة للسؤال الحالي
  const onToggleFav = useCallback(async () => {
    if (!q) return;
    try {
      const nowFav = await toggleFavorite({
        qid,
        text: q.text,
        options: q.options.map((o) => ({ letter: o.letter, text: o.text })),
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        subjectName: title,
        source: 'بنك الأسئلة',
        addedAt: new Date().toISOString(),
      });
      setFavved(nowFav);
    } catch {
      // تجاهل
    }
  }, [q, qid, title]);

  // فتح نافذة الملاحظة
  const openNoteModal = useCallback(async () => {
    if (!q) return;
    try {
      const existing = await getNote(qid);
      setNoteDraft(existing?.note ?? '');
    } catch {
      setNoteDraft('');
    }
    setNoteModal(true);
  }, [q, qid]);

  // حفظ الملاحظة
  const onSaveNote = useCallback(async () => {
    if (!q) return;
    try {
      await saveNote(qid, q.text, title, noteDraft);
      setHasNoteFlag(noteDraft.trim().length > 0);
    } catch {
      // تجاهل
    }
    setNoteModal(false);
  }, [q, qid, title, noteDraft]);

  const restart = () => {
    setIndex(0);
    setAnswers({});
    setFinished(false);
    recordedRef.current = false;
    if (isMock) {
      setQOrder(shuffleOrder(questions.length)); // W21: ترتيب جديد عند كل إعادة
      setMockSecsLeft(totalMockSecs);
    }
  };

  // تسجيل النشاط المركزي: عند إنهاء الاختبار تُضاف النقاط وتُزامن الصدارة
  useEffect(() => {
    if (finished && !recordedRef.current && total > 0) {
      recordedRef.current = true;
      const answered = Object.keys(answers).length;
      const correctCount = stats.correct;
      recordActivity('bank_question', correctCount * 2 + answered, {
        questionsAnswered: answered,
        testsCompleted: 1,
      }, {
        perfectScore: total > 0 && correctCount === total,
        subjectId: subjectKey,
        correct: correctCount,
        total,
      }).catch(() => {});
      // التكرار المتباعد SM-2: الصحيح → 4، الخاطئ → 2 (fire-and-forget)
      gradeQuizResults(
        qOrder.flatMap((qi, i) => {
          const qq = questions[qi];
          if (!qq || answers[i] === undefined) return [];
          return [
            { id: `${subjectKey}::${qq.id}`, correct: answers[i] === qq.correctIndex },
          ];
        }),
      ).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const optionState = (i: number): 'normal' | 'selected' | 'correct' | 'wrong' => {
    if (!q) return 'normal';
    // وضع المحاكاة: إبراز المحدد فقط (بلا كشف)
    if (isMock) return i === chosen ? 'selected' : 'normal';
    if (!revealed) return 'normal';
    if (i === q.correctIndex) return 'correct';
    if (i === chosen) return 'wrong';
    return 'normal';
  };

  // ─── النتائج — FlatList افتراضية: بطاقة النتيجة ترويسة + مراجعة الأخطاء عناصر ───
  if (finished) {
    const renderWrong: ListRenderItem<(typeof wrongListBidi)[number]> = ({ item }) => (
      <View style={[styles.card, shadows.card]}>
        <Text style={[styles.wrongQ, rtlTextStyle]}>{item.qText}</Text>
        <Text style={[styles.wrongA, rtlTextStyle]}>{item.userAnswer}</Text>
        <Text style={[styles.rightA, rtlTextStyle]}>{item.rightAnswer}</Text>
        {item.explanation ? (
          <View style={styles.wrongExplainBox}>
            <Text style={[styles.wrongExplainTitle, rtlTextStyle]}>الشرح:</Text>
            <RichText text={item.explanation} style={styles.wrongExplainText} />
          </View>
        ) : null}
      </View>
    );

    const resultsHeader = (
      <>
        {/* تهنئة التميمة بعد الاختبار */}
        <MascotCard variant="congrats" scorePct={stats.pct} />
        <View style={[styles.card, shadows.card]}>
          <Text style={[styles.pctText, rtlTextStyle]}>{stats.pct}%</Text>
          <Text style={[styles.pctLabel, rtlTextStyle]}>النسبة المئوية</Text>
          <View style={styles.statRow}>
            <View style={[styles.statBox, { backgroundColor: colors.successBg }]}>
              <Text style={[styles.statNum, { color: colors.success }, rtlTextStyle]}>
                {stats.correct}
              </Text>
              <Text style={[styles.statLbl, rtlTextStyle]}>صحيحة</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.errorBg }]}>
              <Text style={[styles.statNum, { color: colors.error }, rtlTextStyle]}>
                {stats.wrong}
              </Text>
              <Text style={[styles.statLbl, rtlTextStyle]}>خاطئة</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.accordionBg }]}>
              <Text style={[styles.statNum, { color: colors.textSecondary }, rtlTextStyle]}>
                {stats.unanswered}
              </Text>
              <Text style={[styles.statLbl, rtlTextStyle]}>متروكة</Text>
            </View>
          </View>
          <TouchableOpacity activeOpacity={0.85} onPress={restart}>
            <LinearGradient
              colors={[...primaryGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtn}>
              <Text style={[styles.primaryText, rtlTextStyle]}>إعادة الاختبار</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareBtn}
            activeOpacity={0.8}
            onPress={() => shareTestResult(title, stats.correct, total)}>
            <Text style={[styles.shareBtnText, rtlTextStyle]}>مشاركة النتيجة</Text>
            <Share2 size={15} color={colors.burgundy} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.7} onPress={onExit}>
            <Text style={[styles.ghostText, rtlTextStyle]}>رجوع للقائمة</Text>
          </TouchableOpacity>
        </View>

        {wrongListBidi.length > 0 && (
          <Text style={[styles.cardTitle, styles.reviewTitle, rtlTextStyle]}>
            {`مراجعة الأخطاء (${formatNumber(wrongListBidi.length)})`}
          </Text>
        )}
      </>
    );

    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onExit} activeOpacity={0.7}>
            <Text style={styles.backGlyph}>›</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, rtlTextStyle]} numberOfLines={1}>
            {`نتيجة: ${title}`}
          </Text>
          {isMock && (
            <View style={styles.mockBadge}>
              <Text style={[styles.mockBadgeText, rtlTextStyle]}>
                {'محاكاة امتحان'}
              </Text>
            </View>
          )}
        </View>
        <FlatList
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          data={wrongListBidi}
          keyExtractor={(item) => item.key}
          renderItem={renderWrong}
          ListHeaderComponent={resultsHeader}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          windowSize={7}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          removeClippedSubviews={true}
        />
      </View>
    );
  }


  // محتوى السؤال — يُستخدم في العرض العادي ووضع التركيز
  const renderQuestionBody = (inFocus: boolean) => {
    if (!q) return null;
    return (
    <>
          <View style={styles.topRow}>
            <Text style={[styles.counter, rtlTextStyle]}>
              {`السؤال ${formatNumber(index + 1)} من ${formatNumber(total)}`}
            </Text>
            <View style={styles.qActions}>
              {isMock ? (
                <View
                  style={[
                    styles.focusTimerChip,
                    mockSecsLeft < 300 && styles.mockTimerUrgent,
                  ]}>
                  <Timer
                    size={14}
                    color={mockSecsLeft < 300 ? colors.white : colors.burgundy}
                    strokeWidth={2.2}
                  />
                  <Text
                    style={[
                      styles.focusTimerText,
                      mockSecsLeft < 300 && styles.mockTimerUrgentText,
                      rtlTextStyle,
                    ]}>
                    {mockTimerText}
                  </Text>
                </View>
              ) : inFocus ? (
                <View style={styles.focusTimerChip}>
                  <Timer size={14} color={colors.burgundy} strokeWidth={2.2} />
                  <Text style={[styles.focusTimerText, rtlTextStyle]}>{focusTimerText}</Text>
                </View>
              ) : (
                <>
              <TouchableOpacity
                style={styles.qActionBtn}
                activeOpacity={0.7}
                onPress={onToggleFav}
                accessibilityLabel={favved ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}>
                <Heart
                  size={19}
                  color={favved ? colors.burgundy : colors.textSecondary}
                  strokeWidth={2.2}
                  fill={favved ? colors.burgundy : 'transparent'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.qActionBtn}
                activeOpacity={0.7}
                onPress={openNoteModal}
                accessibilityLabel="ملاحظتي على السؤال">
                <StickyNote
                  size={19}
                  color={hasNoteFlag ? colors.amberText : colors.textSecondary}
                  strokeWidth={2.2}
                  fill={hasNoteFlag ? colors.explainBorder : 'transparent'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.qActionBtn}
                activeOpacity={0.7}
                onPress={() => setFocusMode(true)}
                accessibilityLabel="وضع التركيز">
                <Focus size={19} color={colors.textSecondary} strokeWidth={2.2} />
              </TouchableOpacity>
                </>
              )}
            </View>
          </View>
          <View style={styles.track}>
            <View
              style={[styles.fill, { width: `${Math.round(((index + 1) / total) * 100)}%` }]}
            />
          </View>

          <View style={[styles.card, shadows.card]}>
            <Text style={[styles.qText, rtlTextStyle]}>{qBidi?.text}</Text>
            <View style={styles.options}>
              {q.options.map((opt, i) => {
                const st = optionState(i);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.option, styles[`opt_${st}`]]}
                    activeOpacity={0.7}
                    disabled={revealed}
                    onPress={() => pick(i)}>
                    <View style={[styles.letter, styles[`letter_${st}`]]}>
                      <Text style={[styles.letterText, styles[`letterText_${st}`]]}>
                        {AR_LETTERS[i] ?? `${i + 1}`}
                      </Text>
                    </View>
                    <Text style={[styles.optText, rtlTextStyle]}>{qBidi?.options[i]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {revealed && (
              <View style={styles.explain}>
                <Text style={[styles.explainTitle, rtlTextStyle]}>الشرح:</Text>
                {q.explanation ? (
                  <Text style={[styles.explainText, rtlTextStyle]}>{qBidi?.explanation}</Text>
                ) : (
                  <Text style={[styles.explainText, rtlTextStyle]}>
                    {`الجواب الصحيح هو الخيار ${AR_LETTERS[q.correctIndex] ?? ''}.`}
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity
              style={[styles.ghostBtn, index === 0 && styles.navDisabled]}
              activeOpacity={0.7}
              disabled={index === 0}
              onPress={() => go(index - 1)}>
              <Text style={[styles.ghostText, rtlTextStyle]}>› السابق</Text>
            </TouchableOpacity>
            {index < total - 1 ? (
              <TouchableOpacity activeOpacity={0.85} onPress={() => go(index + 1)}>
                <LinearGradient
                  colors={[...primaryGradient]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryBtn}>
                  <Text style={[styles.primaryText, rtlTextStyle]}>التالي ‹</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : !isMock ? (
              // وضع المحاكاة له زر إنهاء دائم أسفل (mockFinishWrap) — لا داعي لمكرر هنا
              <TouchableOpacity activeOpacity={0.85} onPress={() => setFinished(true)}>
                <LinearGradient
                  colors={[...gradients.download]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryBtn}>
                  <Text style={[styles.primaryText, rtlTextStyle]}>إنهاء وعرض النتيجة</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}
          </View>
          {/* زر إنهاء الامتحان — بارز دائمًا في وضع المحاكاة */}
          {isMock && !inFocus && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setFinished(true)}
              style={styles.mockFinishWrap}>
              <LinearGradient
                colors={[colors.burgundy, colors.burgundyLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryBtn}>
                <Text style={[styles.primaryText, rtlTextStyle]}>
                  {`إنهاء الامتحان (${formatNumber(Object.keys(answers).length)}/${formatNumber(total)} مجاب)`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          {!inFocus && !isMock && (
          <View style={styles.retryRow}>
            <TouchableOpacity
              style={styles.retryBtn}
              activeOpacity={0.7}
              onPress={restart}>
              <RotateCcw size={14} color={colors.textSecondary} />
              <Text style={[styles.retryText, rtlTextStyle]}>إعادة من البداية</Text>
            </TouchableOpacity>
          </View>
          )}
    </>
    );
  };

  // ─── الأسئلة ───
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onExit} activeOpacity={0.7}>
          <Text style={styles.backGlyph}>›</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, rtlTextStyle]} numberOfLines={1}>
          {title}
        </Text>
      </View>

      {loading ? (
        <QuestionSkeleton />
      ) : total === 0 || !q ? (
        <EmptyStateCard
          icon={Inbox}
          title="لا توجد أسئلة"
          message="تعذّر تحميل الأسئلة — تحقق من الاتصال وحاول مجددًا"
          actionLabel="إعادة المحاولة"
          onAction={onRetry}
        />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          {renderQuestionBody(false)}
        </ScrollView>
      )}

      {/* وضع التركيز — ملء الشاشة بلا مشتتات */}
      <Modal
        visible={focusMode}
        animationType="slide"
        onRequestClose={exitFocus}>
        <View style={styles.focusRoot}>
          <View style={styles.focusHeader} {...focusPan.panHandlers}>
            <TouchableOpacity
              style={styles.focusCloseBtn}
              onPress={exitFocus}
              activeOpacity={0.7}
              accessibilityLabel="الخروج من وضع التركيز">
              <X size={22} color={colors.title} strokeWidth={2.4} />
            </TouchableOpacity>
            <View style={styles.focusTimerChip}>
              <Timer size={14} color={colors.burgundy} strokeWidth={2.2} />
              <Text style={[styles.focusTimerText, rtlTextStyle]}>{focusTimerText}</Text>
            </View>
            <Text style={[styles.focusCounter, rtlTextStyle]}>
              {`السؤال ${formatNumber(index + 1)} من ${formatNumber(total)}`}
            </Text>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            {renderQuestionBody(true)}
          </ScrollView>
          <Text style={[styles.focusHint, rtlTextStyle]}>اسحب للأسفل للخروج من وضع التركيز</Text>
        </View>
      </Modal>

      {/* نافذة الملاحظة الشخصية */}
      <AppModal visible={noteModal} onClose={() => setNoteModal(false)}>
          <View style={[styles.noteSheet, shadows.card]}>
            <View style={styles.noteSheetHeader}>
              <Text style={[styles.noteSheetTitle, rtlTextStyle]}>ملاحظتي على السؤال</Text>
              <TouchableOpacity onPress={() => setNoteModal(false)} activeOpacity={0.7} style={styles.noteCloseBtn}>
                <X size={20} color={colors.textSecondary} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
            {q && (
              <Text style={[styles.noteSheetQ, rtlTextStyle]} numberOfLines={2}>
                {qBidi?.text}
              </Text>
            )}
            <TextInput
              style={[styles.noteTextArea, rtlTextStyle]}
              placeholder="اكتب ملاحظتك هنا... (اتركها فارغة للحذف)"
              placeholderTextColor={colors.textMuted}
              value={noteDraft}
              onChangeText={setNoteDraft}
              multiline
              textAlign="right"
              textAlignVertical="top"
              autoCorrect={false}
            />
            <View style={styles.noteSheetActions}>
              <TouchableOpacity style={styles.noteSaveBtn} activeOpacity={0.8} onPress={onSaveNote}>
                <Text style={[styles.noteSaveText, rtlTextStyle]}>حفظ</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.noteCancelBtn} activeOpacity={0.7} onPress={() => setNoteModal(false)}>
                <Text style={[styles.noteCancelText, rtlTextStyle]}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
      </AppModal>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: { fontSize: 22, color: colors.burgundy, fontWeight: '700', marginTop: -2 },
  // ─── وضع التركيز ───
  focusRoot: { flex: 1, backgroundColor: colors.bg },
  focusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  focusCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusTimerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.optionSelectedBg,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
  },
  focusTimerText: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.burgundy,
  },
  // وضع محاكاة الامتحان
  mockTimerUrgent: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  mockTimerUrgentText: { color: colors.white },
  mockFinishWrap: { marginTop: 4 },
  mockBadge: {
    backgroundColor: colors.burgundy,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginStart: 8,
  },
  mockBadgeText: {
    fontFamily: 'tajawal',
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  focusCounter: {
    fontFamily: 'tajawal',
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  focusHint: {
    textAlign: 'center',
    fontFamily: 'tajawal',
    fontSize: 11.5,
    fontWeight: '400',
    color: colors.textMuted,
    paddingVertical: 8,
  },
  headerTitle: {
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  qActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteSheet: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
  },
  noteSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  noteSheetTitle: {
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'left',
    writingDirection: 'ltr',
    includeFontPadding: false,
  },
  noteCloseBtn: { padding: 4 },
  noteSheetQ: {
    fontFamily: 'tajawal',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'left',
    writingDirection: 'ltr',
    includeFontPadding: false,
    marginBottom: 10,
    lineHeight: 19,
  },
  noteTextArea: {
    fontFamily: 'tajawal',
    fontSize: 14.5,
    color: colors.title,
    textAlign: 'left',
    writingDirection: 'ltr',
    includeFontPadding: false,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    minHeight: 120,
    lineHeight: 22,
  },
  noteSheetActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  noteSaveBtn: {
    flex: 1,
    backgroundColor: colors.burgundy,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  noteSaveText: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
    includeFontPadding: false,
  },
  noteCancelBtn: {
    flex: 1,
    backgroundColor: colors.segBg,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  noteCancelText: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    includeFontPadding: false,
  },
  counter: {
    fontFamily: 'tajawal',
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  track: {
    height: 8,
    borderRadius: 8,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  fill: { height: '100%', borderRadius: 8, backgroundColor: colors.burgundy },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: 'tajawal',
    fontSize: 15,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'left',
    marginBottom: 10,
    writingDirection: 'ltr',
  },
  // عنوان «مراجعة الأخطاء» فوق عناصر FlatList
  reviewTitle: { marginBottom: 4 },
  qText: {
    fontFamily: 'tajawal',
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
    lineHeight: 26,
    textAlign: 'left',
    marginBottom: 14,
    writingDirection: 'ltr',
  },
  options: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.optionBg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.optionBorder,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
    direction: 'rtl',
  },
  opt_normal: {},
  opt_selected: { borderColor: colors.burgundy, backgroundColor: colors.optionSelectedBg },
  opt_correct: { borderColor: colors.success, backgroundColor: colors.successBg },
  opt_wrong: { borderColor: colors.error, backgroundColor: colors.errorBg },
  letter: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.letterBg,
    borderWidth: 1,
    borderColor: colors.letterBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  letter_normal: {},
  letter_selected: { backgroundColor: colors.burgundy, borderColor: colors.burgundy },
  letter_correct: { backgroundColor: colors.success, borderColor: colors.success },
  letter_wrong: { backgroundColor: colors.error, borderColor: colors.error },
  letterText: { fontFamily: 'tajawal', fontSize: 15, fontWeight: '800', color: colors.title },
  letterText_normal: {},
  letterText_selected: { color: colors.white },
  letterText_correct: { color: colors.white },
  letterText_wrong: { color: colors.white },
  optText: {
    flexShrink: 1,
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 14.5,
    color: colors.text,
    lineHeight: 22,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  explain: {
    marginTop: 14,
    backgroundColor: colors.explainBg,
    borderWidth: 1,
    borderColor: colors.explainBorder,
    borderRadius: radius.md,
    padding: 12,
  },
  explainTitle: {
    fontFamily: 'tajawal',
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.explainText,
    textAlign: 'left',
    marginBottom: 6,
    writingDirection: 'ltr',
  },
  explainText: {
    fontFamily: 'tajawal',
    fontSize: 13.5,
    color: colors.explainText,
    lineHeight: 22,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  primaryBtn: {
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontFamily: 'tajawal', fontSize: 14, fontWeight: '700', color: colors.white, textAlign: 'center' },
  ghostBtn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.ghostBorder,
    backgroundColor: colors.card,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { fontFamily: 'tajawal', fontSize: 13.5, fontWeight: '700', color: colors.burgundy, textAlign: 'center' },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#7A1F2B22',
    backgroundColor: '#7A1F2B0D',
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginTop: 8,
  },
  shareBtnText: { fontFamily: 'tajawal', fontSize: 13.5, fontWeight: '700', color: colors.burgundy, textAlign: 'center' },
  navDisabled: { opacity: 0.4 },
  retryRow: { alignItems: 'center', marginTop: 12 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 },
  retryText: { fontFamily: 'tajawal', fontSize: 12.5, color: colors.textSecondary, textAlign: 'left', writingDirection: 'ltr' },
  pctText: {
    fontFamily: 'tajawal',
    fontSize: 44,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'center',
  },
  pctLabel: {
    fontFamily: 'tajawal',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 14,
  },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statBox: { flex: 1, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  statNum: { fontFamily: 'tajawal', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  statLbl: { fontFamily: 'tajawal', fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  wrongQ: {
    fontFamily: 'tajawal',
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'left',
    lineHeight: 21,
    marginBottom: 4,
    writingDirection: 'ltr',
  },
  wrongA: {
    fontFamily: 'tajawal',
    fontSize: 12.5,
    color: colors.error,
    textAlign: 'left',
    lineHeight: 20,
    writingDirection: 'ltr',
  },
  rightA: {
    fontFamily: 'tajawal',
    fontSize: 12.5,
    color: colors.success,
    fontWeight: '700',
    textAlign: 'left',
    lineHeight: 20,
    writingDirection: 'ltr',
  },
  wrongExplainBox: {
    marginTop: 8,
    backgroundColor: colors.explainBg,
    borderWidth: 1,
    borderColor: colors.explainBorder,
    borderRadius: radius.md,
    padding: 10,
  },
  wrongExplainTitle: {
    fontFamily: 'tajawal',
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.explainText,
    textAlign: 'left',
    marginBottom: 4,
    writingDirection: 'ltr',
  },
  wrongExplainText: {
    fontFamily: 'tajawal',
    fontSize: 12.5,
    color: colors.explainText,
    lineHeight: 20,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
});

export { arCount };
