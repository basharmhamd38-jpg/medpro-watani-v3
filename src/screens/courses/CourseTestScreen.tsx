// اختبار نهاية الوحدة — مؤقت + تصحيح فوري + حفظ النتيجة
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, ClipboardList, Timer, XCircle } from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { getLocalUnits, saveTestScore } from '../../courses/store';
import { haptics } from '../../utils/haptics';
import { recordActivity } from '../../gamification/profile';
import { QuestionSkeleton } from '../../components/Skeleton';
import type { CourseQuestion } from '../../courses/types';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import { ProgressBar, ScreenHeader } from './ui';
import EmptyStateCard from '../../components/EmptyStateCard';
import type { CoursesStackNav, CoursesStackRoute } from '../tabs/CoursesTab';

export default function CourseTestScreen({
  navigation,
  route,
}: {
  navigation: CoursesStackNav;
  route: CoursesStackRoute<'CourseTest'>;
}) {
  const { colors, primaryGradient } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  // حماية: معاملات التنقل قد تكون ناقصة — لا ننهار أبدًا
  const params = route.params ?? ({} as { courseId?: string; unitId?: string; title?: string });
  const courseId = params.courseId ?? '';
  const unitId = params.unitId ?? '';
  const title = params.title ?? 'الاختبار';
  const [questions, setQuestions] = useState<CourseQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [passThreshold, setPassThreshold] = useState(70);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelled = useRef(false);
  // مرجع لأحدث نسخة من finish — المؤقت يستدعيه عند نفاد الوقت
  // (الإغلاق الملتقط لحظة إنشاء الـinterval يرى answers = {} القديمة)
  const finishRef = useRef<() => void>(() => {});
  // حارس منع الإنهاء المزدوج — حفظ النقاط/XP يجب أن يحدث مرة واحدة فقط
  const didFinishRef = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    (async () => {
      try {
        if (!courseId || !unitId) return;
        const units = await getLocalUnits(courseId);
        const u = units.find(x => x.id === unitId);
        if (cancelled.current) return;
        const raw = u?.unitTest?.questions ?? [];
        // تنقية أسئلة الاختبار — أي سؤال ناقص يُستبعد بدل أن ينهار التطبيق
        const qs = (Array.isArray(raw) ? raw : []).filter(
          qq =>
            qq &&
            typeof qq.text === 'string' &&
            Array.isArray(qq.options) &&
            qq.options.length > 0,
        );
        setQuestions(qs);
        setPassThreshold(u?.unitTest?.passThreshold ?? 70);
        setSecondsLeft((u?.unitTest?.timeMinutes ?? 15) * 60);
      } catch {
        if (!cancelled.current) setQuestions([]);
      } finally {
        if (!cancelled.current) setLoading(false);
      }
    })();
    return () => {
      cancelled.current = true;
    };
  }, [courseId, unitId]);

  useEffect(() => {
    if (loading || finished || !questions.length) return;
    timer.current = setInterval(() => {
      // إنقاص العدّاد فقط — لا منطق إنهاء داخل مُحدِّث الحالة،
      // فمُحدِّثات setState قد تُستدعى مرتين في StrictMode (نقاط/XP مضاعفة)
      setSecondsLeft(s => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [loading, finished, questions.length]);

  // إنهاء تلقائي عند نفاد الوقت — في effect منفصل خارج مُحدِّث الحالة،
  // و finishRef.current() يستدعي أحدث نسخة من finish (بأحدث الإجابات)
  useEffect(() => {
    if (!loading && !finished && questions.length > 0 && secondsLeft === 0) {
      if (timer.current) clearInterval(timer.current);
      finishRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, finished, questions.length, secondsLeft]);

  const score = useMemo(() => {
    if (!questions.length) return 0;
    let ok = 0;
    for (const q of questions) if (answers[q.id] === q.correctIndex) ok++;
    return Math.round((ok / questions.length) * 100);
  }, [answers, questions]);

  const finish = () => {
    if (didFinishRef.current) return;
    didFinishRef.current = true;
    if (timer.current) clearInterval(timer.current);
    setFinished(true);
    const s = (() => {
      let ok = 0;
      for (const q of questions) if (answers[q.id] === q.correctIndex) ok++;
      return questions.length ? Math.round((ok / questions.length) * 100) : 0;
    })();
    // اهتزاز احتفالي عند اجتياز الوحدة — وخفيف محبط عند الرسوب
    try {
      if (s >= passThreshold) haptics.complete();
      else haptics.answer(false);
    } catch {
      // تجاهل فشل الاهتزاز
    }
    saveTestScore(unitId, s, passThreshold).catch(() => {});
    // تسجيل النشاط المركزي: نقاط + مزامنة الصدارة
    const answered = Object.keys(answers).length;
    let correctCount = 0;
    for (const q of questions) if (answers[q.id] === q.correctIndex) correctCount++;
    recordActivity('course_unit', correctCount * 2 + (s >= passThreshold ? 20 : 0), {
      questionsAnswered: answered,
      coursesCompleted: s >= passThreshold ? 1 : 0,
      testsCompleted: 1,
    }, {
      perfectScore: questions.length > 0 && correctCount === questions.length,
      subjectId: `course_${courseId}`,
    }).catch(() => {});
  };

  // تحديث المرجع لأحدث نسخة من finish بعد كل render —
  // المؤقت يستدعي finishRef.current() فيرى أحدث الإجابات لا الإغلاق القديم
  finishRef.current = finish;

  const pick = (qi: number) => {
    const q = questions[index];
    if (!q || finished) return;
    try {
      haptics.tap();
    } catch {
      // تجاهل فشل الاهتزاز — لا يعطل اختيار الإجابة
    }
    setAnswers(a => ({ ...a, [q.id]: qi }));
  };

  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;
  const q = questions[index];
  const picked = q ? answers[q.id] : undefined;
  const passed = score >= passThreshold;

  if (loading)
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="الاختبار" onBack={() => navigation.goBack()} />
        <QuestionSkeleton />
      </SafeAreaView>
    );

  if (!questions.length)
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="الاختبار" onBack={() => navigation.goBack()} />
        <EmptyStateCard
          icon={ClipboardList}
          title="لا يوجد اختبار لهذه الوحدة"
          message="لم تُحمَّل أسئلة الاختبار بعد — أعد تحميل الكورس ثم عاود المحاولة"
        />
      </SafeAreaView>
    );

  if (finished)
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="نتيجة الاختبار" onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.resultWrap} showsVerticalScrollIndicator={false}>
          <View style={styles.resultCard}>
            {passed ? (
              <CheckCircle2 size={54} color={colors.success} />
            ) : (
              <XCircle size={54} color={colors.error} />
            )}
            <Text style={styles.scoreNum}>{score}%</Text>
            <Text style={[styles.scoreLabel, { color: passed ? colors.success : colors.error }]}>
              {passed ? 'أحسنت — اجتزت الاختبار' : 'لم تصل لعتبة الاجتياز'}
            </Text>
            <Text style={styles.scoreHint}>
              {passed
                ? 'الوحدة التالية أصبحت مفتوحة'
                : `عتبة الاجتياز ${passThreshold}% — راجع الخلاصة والأسئلة ثم أعد المحاولة`}
            </Text>
            <ProgressBar pct={score} height={10} />
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => navigation.goBack()}
              style={styles.doneBtnWrap}>
              <LinearGradient
                colors={[...primaryGradient]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0, y: 0 }}
                style={styles.doneBtn}>
                <Text style={styles.doneText}>عودة للوحدة</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />
      <View style={styles.topBar}>
        <Text style={styles.counter}>
          سؤال {index + 1} / {questions.length}
        </Text>
        <View style={[styles.timer, secondsLeft < 120 && styles.timerUrgent]}>
          <Timer size={14} color={secondsLeft < 120 ? colors.error : colors.burgundy} />
          <Text style={[styles.timerText, secondsLeft < 120 && styles.timerTextUrgent]}>
            {mm}:{String(ss).padStart(2, '0')}
          </Text>
        </View>
      </View>
      <View style={styles.barWrap}>
        <ProgressBar pct={((index + 1) / questions.length) * 100} height={6} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.qCard}>
          <Text style={styles.qText}>{bidi(q.text)}</Text>
        </View>
        {q.options.map((opt, i) => {
          const active = picked === i;
          return (
            <TouchableOpacity
              key={`${q.id}-${i}`}
              activeOpacity={0.85}
              onPress={() => pick(i)}
              style={[styles.option, active && styles.optionActive]}>
              <View style={[styles.optBadge, active && styles.optBadgeActive]}>
                <Text style={[styles.optBadgeText, active && styles.optBadgeTextActive]}>
                  {q.optionLabels[i] ?? i + 1}
                </Text>
              </View>
              <Text style={styles.optText}>{bidi(opt)}</Text>
            </TouchableOpacity>
          );
        })}
        <View style={styles.navRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={index === 0}
            onPress={() => setIndex(i => Math.max(0, i - 1))}
            style={[styles.navBtn, styles.navGhost, index === 0 && styles.disabled]}>
            <Text style={styles.navGhostText}>السابق</Text>
          </TouchableOpacity>
          {index === questions.length - 1 ? (
            <TouchableOpacity activeOpacity={0.85} onPress={finish} style={styles.navBtnWrap}>
              <LinearGradient
                colors={[...primaryGradient]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0, y: 0 }}
                style={styles.navBtn}>
                <Text style={styles.navBtnText}>إنهاء الاختبار</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setIndex(i => Math.min(questions.length - 1, i + 1))}
              style={styles.navBtnWrap}>
              <LinearGradient
                colors={[...primaryGradient]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0, y: 0 }}
                style={styles.navBtn}>
                <Text style={styles.navBtnText}>التالي</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10 },
  counter: { fontFamily: 'tajawal', fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  timer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.skeletonBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  timerUrgent: { backgroundColor: colors.errorBg },
  timerText: { fontFamily: 'tajawal', fontSize: 13, fontWeight: '700', color: colors.burgundy, marginEnd: 4 },
  timerTextUrgent: { color: colors.error },
  barWrap: { paddingHorizontal: 14, marginTop: 8 },
  scroll: { flex: 1 },
  content: { padding: 14, paddingBottom: 28 },
  qCard: {
    backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    padding: 16, marginBottom: 12, ...shadows.card,
  },
  qText: { fontFamily: 'tajawal', fontSize: 16, fontWeight: '700', color: colors.title, textAlign: 'left', lineHeight: 26, ...rtlTextStyle },
  option: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.optionBg,
    borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, padding: 13, marginBottom: 9,
    direction: 'rtl',
  },
  optionActive: { backgroundColor: colors.optionSelectedBg, borderColor: colors.burgundy },
  optBadge: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.segBg, alignItems: 'center', justifyContent: 'center' },
  optBadgeActive: { backgroundColor: colors.burgundy },
  optBadgeText: { fontFamily: 'tajawal', fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  optBadgeTextActive: { color: colors.white },
  optText: { flex: 1, fontFamily: 'tajawal', fontSize: 14.5, color: colors.text, textAlign: 'left', marginEnd: 10, lineHeight: 23, ...rtlTextStyle },
  navRow: { flexDirection: 'row', marginTop: 12, gap: 10 },
  navBtnWrap: { flex: 1 },
  navBtn: { borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', flex: 1 },
  navBtnText: { fontFamily: 'tajawal', fontSize: 15, fontWeight: '700', color: colors.card },
  navGhost: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.ghostBorder },
  navGhostText: { fontFamily: 'tajawal', fontSize: 15, fontWeight: '700', color: colors.burgundy },
  disabled: { opacity: 0.4 },
  resultWrap: { padding: 16, flexGrow: 1, justifyContent: 'center' },
  resultCard: {
    backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.border,
    padding: 26, alignItems: 'center', ...shadows.card,
  },
  scoreNum: { fontFamily: 'tajawal', fontSize: 44, fontWeight: '700', color: colors.title, marginTop: 10 },
  scoreLabel: { fontFamily: 'tajawal', fontSize: 16, fontWeight: '700', marginTop: 4 },
  scoreHint: { fontFamily: 'tajawal', fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginTop: 8, marginBottom: 14 },
  doneBtnWrap: { marginTop: 16, width: '100%' },
  doneBtn: { borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  doneText: { fontFamily: 'tajawal', fontSize: 15, fontWeight: '700', color: colors.card },
});
