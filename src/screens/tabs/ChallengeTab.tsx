// التحدي اليومي — مرجعية AI Studio (قسم التحدي اليومي في App.tsx)
// 10 أسئلة عشوائية من دورات الوطني • كشف فوري • مكافأة +30 XP عند الإكمال • فرصة واحدة يوميًا
import { useCallback, useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Zap, Target, CheckCircle2, RotateCcw, ChevronLeft, AlertTriangle, Flame } from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import LockScreen from '../../components/LockScreen';
import { QuestionSkeleton } from '../../components/Skeleton';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import { canAccessTab } from '../../payment/gates';
import { getAuth } from '../../auth/auth';
import {
  fetchWataniSubjects,
  fetchWataniSessions,
  fetchWataniQuestions,
  type BankQuestion,
} from '../../bank/firestore';
import {
  getProfile,
  recordActivity,
  isChallengeDoneToday,
  addChallengeRecord,
  addMistakes,
  damascusDate,
  type GamificationProfile,
} from '../../gamification/profile';

const AR_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'];
const BONUS_XP = 30;
const XP_PER_CORRECT = 10;

type Step = 'intro' | 'loading' | 'quiz' | 'finished' | 'done';

interface DCQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  subjectName: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ChallengeTab() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [open, setOpen] = useState(true);
  const [gateReason, setGateReason] = useState('');
  const [step, setStep] = useState<Step>('intro');
  const [questions, setQuestions] = useState<DCQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ correct: number; total: number; xpEarned: number } | null>(null);
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  // W5: حالة خطأ إنهاء التحدي + منع النقر المزدوج أثناء الحفظ
  const [finishError, setFinishError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const refresh = useCallback(() => {
    const gate = canAccessTab('challenge');
    setOpen(gate.open);
    setGateReason(gate.reason || '');
    getProfile().then(setProfile).catch(() => {});
    isChallengeDoneToday()
      .then((done) => {
        if (done) setStep('done');
        else setStep((s) => (s === 'done' ? 'intro' : s));
      })
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const start = async () => {
    setError(null);
    setFinishError(null);
    setStep('loading');
    try {
      const subjects = await fetchWataniSubjects();
      const pool: DCQuestion[] = [];
      const pickedSubjects = shuffle(subjects).slice(0, 5);
      for (const subj of pickedSubjects) {
        if (pool.length >= 20) break;
        try {
          const sessions = await fetchWataniSessions(subj.id);
          const pickedSessions = shuffle(sessions).slice(0, 2);
          for (const sess of pickedSessions) {
            if (pool.length >= 20) break;
            const qs: BankQuestion[] = await fetchWataniQuestions(subj.id, sess.id);
            for (const q of qs) {
              pool.push({
                id: q.id,
                text: q.text,
                options: q.options.length > 0 ? q.options : ['أ', 'ب', 'ج', 'د'],
                correctIndex: q.correctIndex,
                explanation: q.explanation,
                subjectName: subj.name,
              });
            }
          }
        } catch {
          // تجاوز المادة المعطوبة
        }
      }
      if (pool.length === 0) {
        setError('تعذر تجهيز أسئلة التحدي اليومي. تحقق من الاتصال وحاول مجددًا.');
        setStep('intro');
        return;
      }
      const picked = shuffle(pool).slice(0, 10);
      setQuestions(picked);
      setIndex(0);
      setAnswers({});
      setSelected(null);
      setRevealed(false);
      setResult(null);
      setStep('quiz');
    } catch {
      setError('تعذر الاتصال ببنك الأسئلة للبدء بالتحدي اليومي.');
      setStep('intro');
    }
  };

  const choose = (i: number) => {
    if (revealed) return;
    setSelected(i);
    setRevealed(true);
  };

  const next = async () => {
    if (selected === null || finishing) return;
    const updated = { ...answers, [index]: selected };
    setAnswers(updated);
    if (index < questions.length - 1) {
      setIndex(index + 1);
      setSelected(null);
      setRevealed(false);
      setFinishError(null);
    } else {
      // إنهاء التحدي — W5: محمي من الرفض غير المعالج؛ الفشل يبقي المستخدم
      // على شاشة الاختبار مع رسالة خطأ وزر إعادة المحاولة بدل التعليق.
      setFinishing(true);
      setFinishError(null);
      try {
        let correct = 0;
        const wrongItems: Parameters<typeof addMistakes>[0] = [];
        questions.forEach((q, qi) => {
          const ans = updated[qi];
          if (ans === q.correctIndex) {
            correct += 1;
          } else {
            wrongItems.push({
              qid: `dc-${damascusDate()}-${q.id}`,
              text: q.text,
              options: q.options.map((t, oi) => ({
                letter: AR_LETTERS[oi] || String(oi + 1),
                text: t,
              })),
              correctIndex: q.correctIndex,
              explanation: q.explanation,
              subjectName: q.subjectName,
            });
          }
        });
        const xpEarned = correct * XP_PER_CORRECT + BONUS_XP;
        const auth = getAuth();
        const updatedProfile = await recordActivity('daily_challenge', xpEarned, {
          questionsAnswered: questions.length,
          challengesDone: 1,
          testsCompleted: 1,
        }, {
          perfectScore: questions.length > 0 && correct === questions.length,
          subjectId: 'daily_challenge',
        });
        await addChallengeRecord({
          date: damascusDate(),
          correct,
          total: questions.length,
          xpEarned,
        });
        if (auth.type === 'user') {
          await addMistakes(wrongItems);
        }
        setProfile(updatedProfile);
        setResult({ correct, total: questions.length, xpEarned });
        setStep('finished');
      } catch {
        setFinishError('تعذّر حفظ نتيجة التحدي. تحقق من الاتصال ثم اضغط «إنهاء التحدي» مجددًا — إجاباتك محفوظة.');
      } finally {
        setFinishing(false);
      }
    }
  };

  if (!open) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader />
        <LockScreen message={gateReason || 'يتطلب التفعيل'} />
      </SafeAreaView>
    );
  }

  const q = questions.length > 0 ? questions[Math.min(index, questions.length - 1)] : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* بطاقة المقدمة */}
        <View style={[styles.card, shadows.card]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardLabel, rtlTextStyle]}>التحدي اليومي المباشر</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>+30 XP مكافأة إكمال</Text>
              <Zap size={14} color={colors.amberText} />
            </View>
          </View>
          <Text style={[styles.title, rtlTextStyle]}>تحدي الـ 10 أسئلة اليومي</Text>
          <Text style={[styles.desc, rtlTextStyle]}>
            10 أسئلة عشوائية من كافة المواد الطبية بفرصة واحدة يوميًا لتثبيت المعلومات والحفاظ على السلسلة.
          </Text>
          {profile && profile.currentStreak > 0 && (
            <View style={styles.streakRow}>
              <Text style={[styles.streakText, rtlTextStyle]}>
                سلسلتك الحالية: {profile.currentStreak} {profile.currentStreak === 1 ? 'يوم' : 'أيام'}
              </Text>
              <Flame size={14} color={colors.amberText} />
            </View>
          )}
        </View>

        {step === 'done' && (
          <View style={[styles.card, styles.doneCard, shadows.card]}>
            <CheckCircle2 size={44} color={colors.emerald} />
            <Text style={[styles.doneTitle, rtlTextStyle]}>أكملت تحدي اليوم بنجاح! 🎉</Text>
            <Text style={[styles.desc, rtlTextStyle]}>
              حصلت على مكافأة التحدي اليومي وحافظت على سلسلتك. عد غدًا لتحدٍ جديد!
            </Text>
            <View style={styles.xpChip}>
              <Text style={styles.xpChipText}>⚡ النقاط الإجمالية: {profile?.totalXP ?? 0} XP</Text>
            </View>
          </View>
        )}

        {step === 'intro' && (
          <View>
            {error && (
              <View style={[styles.card, styles.errorCard]}>
                <AlertTriangle size={24} color={colors.error} />
                <Text style={[styles.errorText, rtlTextStyle]}>{error}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.startBtn} onPress={start} activeOpacity={0.85}>
              <Target size={18} color={colors.white} />
              <Text style={styles.startBtnText}>ابدأ التحدي</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'loading' && <QuestionSkeleton />}

        {step === 'quiz' && q && (
          <View>
            {/* شريط التقدم */}
            <View style={[styles.card, shadows.card]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.progressLabel, rtlTextStyle]}>
                  سؤال {index + 1} من {questions.length}
                </Text>
                <View style={styles.tagRow}>
                  <Zap size={13} color={colors.amberText} />
                  <Text style={styles.tagText}>تحدي اليوم</Text>
                </View>
              </View>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${((index + 1) / questions.length) * 100}%` }]} />
              </View>
            </View>

            {/* بطاقة السؤال */}
            <View style={[styles.card, shadows.card]}>
              <Text style={[styles.qText, rtlTextStyle]}>{bidi(q.text)}</Text>
              <View style={styles.options}>
                {q.options.map((opt, oi) => {
                  const isSel = selected === oi;
                  const isCorrect = oi === q.correctIndex;
                  let optStyle: any = styles.opt;
                  let badgeStyle: any = styles.optBadge;
                  let badgeTextStyle: any = styles.optBadgeText;
                  if (revealed) {
                    if (isCorrect) {
                      optStyle = [styles.opt, styles.optCorrect];
                      badgeStyle = [styles.optBadge, styles.optBadgeCorrect];
                      badgeTextStyle = [styles.optBadgeText, styles.optBadgeTextLight];
                    } else if (isSel) {
                      optStyle = [styles.opt, styles.optWrong];
                      badgeStyle = [styles.optBadge, styles.optBadgeWrong];
                      badgeTextStyle = [styles.optBadgeText, styles.optBadgeTextLight];
                    }
                  }
                  return (
                    <TouchableOpacity
                      key={oi}
                      style={optStyle}
                      onPress={() => choose(oi)}
                      disabled={revealed}
                      activeOpacity={0.7}>
                      <View style={badgeStyle}>
                        <Text style={badgeTextStyle}>{AR_LETTERS[oi] || oi + 1}</Text>
                      </View>
                      <Text style={[styles.optText, rtlTextStyle]}>{bidi(opt)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {revealed && q.explanation ? (
                <View style={styles.expBox}>
                  <Text style={[styles.expTitle, rtlTextStyle]}>الشرح والتوضيح:</Text>
                  <Text style={[styles.expText, rtlTextStyle]}>{bidi(q.explanation)}</Text>
                </View>
              ) : null}
            </View>

            {finishError && (
              <View style={[styles.card, styles.errorCard, styles.finishErrorCard]}>
                <AlertTriangle size={20} color={colors.error} />
                <Text style={[styles.errorText, rtlTextStyle]}>{finishError}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={next} activeOpacity={0.8}>
                  <RotateCcw size={14} color={colors.white} />
                  <Text style={styles.retryBtnText}>إعادة محاولة الإنهاء</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[styles.nextBtn, (selected === null || finishing) && styles.nextBtnDisabled]}
              onPress={next}
              disabled={selected === null || finishing}
              activeOpacity={0.85}>
              <Text style={styles.nextBtnText}>
                {finishing
                  ? 'جارٍ حفظ النتيجة...'
                  : index === questions.length - 1
                    ? 'إنهاء التحدي وجني الـ XP'
                    : 'السؤال التالي'}
              </Text>
              {!finishing && <ChevronLeft size={16} color={colors.white} />}
            </TouchableOpacity>
          </View>
        )}

        {step === 'finished' && result && (
          <View style={[styles.card, shadows.card, styles.centerCard]}>
            <View style={styles.trophyWrap}>
              <Zap size={34} color={colors.amberText} />
            </View>
            <Text style={[styles.doneTitle, rtlTextStyle]}>تهانينا! أتممت التحدي اليومي ⚡</Text>
            <Text style={[styles.desc, rtlTextStyle]}>
              تمت إضافة النقاط لحسابك وتحديث سلسلتك اليومية بنجاح!
            </Text>
            <View style={styles.statsRow}>
              <View style={[styles.statBox, styles.statGreen]}>
                <Text style={styles.statLabel}>النتيجة</Text>
                <Text style={[styles.statValue, { color: colors.success }]}>
                  {result.correct} / {result.total}
                </Text>
              </View>
              <View style={[styles.statBox, styles.statAmber]}>
                <Text style={styles.statLabel}>المكافأة المكتسبة</Text>
                <Text style={[styles.statValue, { color: colors.amberText }]}>+{result.xpEarned} XP</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.startBtn}
              onPress={() => {
                setStep('done');
                refresh();
              }}
              activeOpacity={0.85}>
              <RotateCcw size={16} color={colors.white} />
              <Text style={styles.startBtnText}>تم</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 14, gap: 12, paddingBottom: 28 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    padding: 16,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.amberBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.amberText },
  cardLabel: { fontSize: 11, fontWeight: '700', color: colors.burgundyLight },
  title: { fontSize: 22, fontWeight: '700', color: colors.burgundy, marginTop: 8, textAlign: 'left' },
  desc: { fontSize: 12, color: colors.textSecondary, lineHeight: 20, marginTop: 6, textAlign: 'left' },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  streakText: { fontSize: 12, fontWeight: '700', color: colors.amberText, textAlign: 'left' },
  doneCard: { alignItems: 'center', gap: 8, borderColor: colors.successBorder },
  doneTitle: { fontSize: 17, fontWeight: '700', color: colors.burgundy, textAlign: 'center' },
  xpChip: { backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.successBorder, borderRadius: 12, padding: 10 },
  xpChipText: { fontSize: 12, fontWeight: '700', color: colors.success },
  centerCard: { alignItems: 'center', gap: 10, paddingVertical: 30 },
  errorCard: { alignItems: 'center', gap: 8, borderColor: colors.errorBorder, backgroundColor: colors.errorBg },
  errorText: { fontSize: 12, fontWeight: '700', color: colors.error, textAlign: 'center' },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.burgundy,
    borderRadius: radius.lg,
    paddingVertical: 14,
    marginTop: 4,
  },
  startBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  progressLabel: { fontSize: 12, fontWeight: '700', color: colors.burgundy, textAlign: 'left' },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagText: { fontSize: 11, fontWeight: '700', color: colors.amberText },
  bar: { height: 8, backgroundColor: colors.segBg, borderRadius: 999, marginTop: 10, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.amber, borderRadius: 999 },
  qText: { fontSize: 15, fontWeight: '700', color: colors.title, lineHeight: 26, textAlign: 'left' },
  options: { gap: 10, marginTop: 14 },
  opt: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.optionBg,
    borderWidth: 1,
    borderColor: colors.optionBorder,
    borderRadius: radius.md,
    padding: 13,
  },
  optCorrect: { backgroundColor: colors.successBg, borderColor: colors.success },
  optWrong: { backgroundColor: colors.errorBg, borderColor: colors.error },
  optBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.letterBg,
    borderWidth: 1,
    borderColor: colors.letterBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optBadgeCorrect: { backgroundColor: colors.success, borderColor: colors.success },
  optBadgeWrong: { backgroundColor: colors.error, borderColor: colors.error },
  optBadgeText: { fontSize: 12, fontWeight: '700', color: colors.text },
  optBadgeTextLight: { color: colors.white },
  optText: { flex: 1, fontSize: 13, lineHeight: 22, color: colors.text, textAlign: 'left' },
  expBox: { marginTop: 12, backgroundColor: colors.explainBg, borderWidth: 1, borderColor: colors.explainBorder, borderRadius: radius.md, padding: 12 },
  expTitle: { fontSize: 12, fontWeight: '700', color: colors.amberText, textAlign: 'left', marginBottom: 4 },
  expText: { fontSize: 12, color: colors.explainText, lineHeight: 20, textAlign: 'left' },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.burgundy,
    borderRadius: radius.lg,
    paddingVertical: 14,
    marginTop: 4,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  finishErrorCard: { marginTop: 4 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.error,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginTop: 4,
  },
  retryBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  trophyWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.amberBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 6 },
  statBox: { flex: 1, borderRadius: radius.md, borderWidth: 1, padding: 12, alignItems: 'center', gap: 4 },
  statGreen: { backgroundColor: colors.successBg, borderColor: colors.successBorder },
  statAmber: { backgroundColor: colors.explainBg, borderColor: colors.explainBorder },
  statLabel: { fontSize: 10, color: colors.textSecondary },
  statValue: { fontSize: 19, fontWeight: '700' },
});
