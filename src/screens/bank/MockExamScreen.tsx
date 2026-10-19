// محاكاة الامتحان — إعداد + تنفيذ
// الخطوات: اختيار المادة ← اختيار العدد (20/40/60) ← بدء المحاكاة
// يعمل أوفلاين: الأسئلة تُجلب من الكاش أولًا (نفس طبقات quizBank)
// وضع المحاكاة: مؤقت صارم + بلا كشف فوري + بلا شروحات حتى النهاية
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { AppText as Text } from '../../components/AppText';
import AppButton from '../../components/AppButton';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Timer, ListChecks, ChevronRight, Shuffle, AlertCircle } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppHeader from '../../components/AppHeader';
import EmptyStateCard from '../../components/EmptyStateCard';
import QuizRunner from './QuizRunner';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import { formatNumber } from '../../utils/numbers';
import {
  fetchUWorldSubjects,
  fetchUWorldSubjectPool,
  subjectIcon,
  type QuizSubject,
  type QuizQuestion,
} from '../../bank/quizBank';

const COUNTS = [20, 40, 60];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Step = 'setup' | 'running';

export default function MockExamScreen() {
  const { colors, primaryGradient } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const navigation = useNavigation<any>();

  const [step, setStep] = useState<Step>('setup');
  const [subjects, setSubjects] = useState<QuizSubject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subject, setSubject] = useState<QuizSubject | null>(null);
  const [count, setCount] = useState(40);
  const [pool, setPool] = useState<QuizQuestion[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolError, setPoolError] = useState(false);
  const [examQuestions, setExamQuestions] = useState<QuizQuestion[]>([]);

  // تحميل المواد (كاش أولًا — يعمل أوفلاين)
  useEffect(() => {
    let alive = true;
    fetchUWorldSubjects()
      .then((list) => {
        if (alive) {
          setSubjects(list);
          setSubjectsLoading(false);
        }
      })
      .catch(() => {
        if (alive) setSubjectsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // حارس الطلبات المتزامنة (W18): آخر طلب اختيار مادة هو الفائز فقط
  const poolReqRef = useRef(0);

  // عند اختيار مادة: جمع أسئلة كل المواضيع (جلب منطقي واحد + إزالة تكرار)
  const selectSubject = (s: QuizSubject) => {
    setSubject(s);
    setPool([]);
    setPoolError(false);
    setPoolLoading(true);
    const reqId = ++poolReqRef.current;
    fetchUWorldSubjectPool(s.id)
      .then((all) => {
        if (poolReqRef.current !== reqId) return; // طلب قديم — تجاهل
        setPool(all);
        setPoolLoading(false);
      })
      .catch(() => {
        if (poolReqRef.current !== reqId) return;
        setPoolError(true);
        setPoolLoading(false);
      });
  };

  const startExam = () => {
    if (pool.length === 0) return;
    const picked = shuffle(pool).slice(0, Math.min(count, pool.length));
    setExamQuestions(picked);
    setStep('running');
  };

  const exitExam = () => {
    setStep('setup');
    setExamQuestions([]);
  };

  // ─── وضع التنفيذ: QuizRunner بمحاكاة ───
  if (step === 'running') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader />
        <QuizRunner
          title={`محاكاة — ${subject?.name ?? ''}`}
          subjectId={subject?.id}
          questions={examQuestions}
          loading={false}
          onExit={exitExam}
          onRetry={exitExam}
          mode="mock"
        />
      </SafeAreaView>
    );
  }

  // ─── شاشة الإعداد ───
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* ترويسة */}
        <View style={[styles.hero, shadows.card]}>
          <LinearGradient
            colors={[colors.burgundy, colors.burgundyLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBg}>
            <Timer size={30} color={colors.white} />
            <Text style={[styles.heroTitle, rtlTextStyle]}>
              {'محاكاة الامتحان'}
            </Text>
            <Text style={[styles.heroSub, rtlTextStyle]}>
              {'تجربة واقعية: عدد ثابت من الأسئلة، مؤقت صارم، ولا تُكشف الإجابات أو الشروحات إلا بعد الإنهاء.'}
            </Text>
          </LinearGradient>
        </View>

        {/* اختيار المادة */}
        <Text style={[styles.sectionTitle, rtlTextStyle]}>{'١. اختر المادة'}</Text>
        {subjectsLoading ? (
          <ActivityIndicator size="large" color={colors.burgundy} style={styles.loader} />
        ) : subjects.length === 0 ? (
          <EmptyStateCard
            icon={AlertCircle}
            title="لا توجد مواد"
            message="تعذّر تحميل المواد. تحقق من الاتصال أو حمّل المحتوى مسبقًا للعمل أوفلاين."
          />
        ) : (
          <View style={styles.subjectGrid}>
            {subjects.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.subjectChip,
                  subject?.id === s.id && styles.subjectChipActive,
                ]}
                activeOpacity={0.7}
                onPress={() => selectSubject(s)}>
                <Text style={styles.subjectIcon}>{subjectIcon(s.name)}</Text>
                <Text
                  style={[
                    styles.subjectName,
                    subject?.id === s.id && styles.subjectNameActive,
                    rtlTextStyle,
                  ]}
                  numberOfLines={2}>
                  {bidi(s.name)}
                </Text>
                {s.questionCount != null && (
                  <Text
                    style={[
                      styles.subjectCount,
                      subject?.id === s.id && styles.subjectCountActive,
                      rtlTextStyle,
                    ]}>
                    {`${formatNumber(s.questionCount)} سؤال`}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* اختيار العدد */}
        {subject && (
          <>
            <Text style={[styles.sectionTitle, rtlTextStyle]}>
              {'٢. اختر عدد الأسئلة'}
            </Text>
            {poolLoading ? (
              <ActivityIndicator size="small" color={colors.burgundy} style={styles.loader} />
            ) : poolError ? (
              <View style={styles.errorRow}>
                <AlertCircle size={16} color={colors.error} />
                <Text style={[styles.errorText, rtlTextStyle]}>
                  {'تعذّر تحميل الأسئلة لهذه المادة.'}
                </Text>
              </View>
            ) : (
              <>
                <Text style={[styles.poolInfo, rtlTextStyle]}>
                  {`متاح: ${formatNumber(pool.length)} سؤالًا في هذه المادة`}
                </Text>
                <View style={styles.countRow}>
                  {COUNTS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.countBtn,
                        count === c && styles.countBtnActive,
                        pool.length < c && styles.countBtnDisabled,
                      ]}
                      activeOpacity={0.7}
                      disabled={pool.length < c}
                      onPress={() => setCount(c)}>
                      <ListChecks
                        size={18}
                        color={count === c ? colors.white : colors.burgundy}
                      />
                      <Text
                        style={[
                          styles.countText,
                          count === c && styles.countTextActive,
                          rtlTextStyle,
                        ]}>
                        {`${formatNumber(c)} سؤالًا`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {/* زر البدء */}
        {subject && pool.length > 0 && !poolLoading && (
          <TouchableOpacity activeOpacity={0.85} onPress={startExam}>
            <LinearGradient
              colors={[...primaryGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.startBtn}>
              <Shuffle size={18} color={colors.white} />
              <Text style={[styles.startText, rtlTextStyle]}>
                {`ابدأ المحاكاة — ${formatNumber(Math.min(count, pool.length))} سؤالًا`}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* ملاحظة الأوفلاين */}
        <View style={styles.noteCard}>
          <Text style={[styles.noteText, rtlTextStyle]}>
            {'تعمل المحاكاة أوفلاين بالكامل إذا سبق تحميل أسئلة المادة. تُسجَّل النتيجة في تقدمك ونقاط ضعفك تلقائيًا.'}
          </Text>
        </View>

        <AppButton
          title={'رجوع'}
          onPress={() => navigation.goBack()}
          variant="ghost"
          icon={<ChevronRight size={16} color={colors.textMuted} />}
          style={styles.backBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 40, gap: 14 },
    loader: { marginVertical: 24 },
    hero: { borderRadius: radius.lg, overflow: 'hidden' },
    heroBg: { padding: 20, gap: 8, alignItems: 'flex-start' },
    heroTitle: {
      fontFamily: 'tajawal',
      fontSize: 22,
      fontWeight: '700',
      color: colors.white,
    },
    heroSub: {
      fontFamily: 'tajawal',
      fontSize: 13,
      color: 'rgba(255,255,255,0.85)',
      lineHeight: 20,
    },
    sectionTitle: {
      fontFamily: 'tajawal',
      fontSize: 16,
      fontWeight: '700',
      color: colors.burgundy,
      marginTop: 4,
    },
    subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    subjectChip: {
      width: '31%',
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: 12,
      alignItems: 'center',
      gap: 6,
    },
    subjectChipActive: { borderColor: colors.burgundy, backgroundColor: colors.optionSelectedBg },
    subjectIcon: { fontSize: 24 },
    subjectName: {
      fontFamily: 'tajawal',
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    subjectNameActive: { color: colors.burgundy },
    subjectCount: {
      fontFamily: 'tajawal',
      fontSize: 10,
      color: colors.textSecondary,
    },
    subjectCountActive: { color: colors.burgundyLight },
    poolInfo: {
      fontFamily: 'tajawal',
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    countRow: { flexDirection: 'row', gap: 10 },
    countBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingVertical: 14,
    },
    countBtnActive: { backgroundColor: colors.burgundy, borderColor: colors.burgundy },
    countBtnDisabled: { opacity: 0.4 },
    countText: {
      fontFamily: 'tajawal',
      fontSize: 14,
      fontWeight: '700',
      color: colors.burgundy,
    },
    countTextActive: { color: colors.white },
    startBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderRadius: radius.md,
      paddingVertical: 16,
      marginTop: 4,
    },
    startText: {
      fontFamily: 'tajawal',
      fontSize: 16,
      fontWeight: '700',
      color: colors.white,
    },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    errorText: { fontFamily: 'tajawal', fontSize: 13, color: colors.error },
    noteCard: {
      backgroundColor: colors.accordionBg,
      borderRadius: radius.md,
      padding: 12,
    },
    noteText: {
      fontFamily: 'tajawal',
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 19,
    },
    backBtn: {
      alignSelf: 'center',
      paddingHorizontal: 24,
    },
  });
