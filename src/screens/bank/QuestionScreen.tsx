import { useEffect, useRef, useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import LinearGradient from 'react-native-linear-gradient';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import Badge, { OfflineBadge } from '../../components/Badge';
import EmptyStateCard from '../../components/EmptyStateCard';
import { QuestionSkeleton } from '../../components/Skeleton';
import { haptics } from '../../utils/haptics';
import { rtlTextStyle } from '../../utils/bidi';
import { formatNumber } from '../../utils/numbers';
import { Inbox } from 'lucide-react-native';
import RichText from '../../components/RichText';
import { getSubjectQuestions, getTopicQuestions } from '../../db/bankRead';
import { enableSecureFlag, disableSecureFlag } from '../../secure';
import { recordActivity } from '../../gamification/profile';
import { gradeQuizResults } from '../../study/spacedRepetition';

const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'];

type OptionState = 'normal' | 'selected' | 'correct' | 'wrong';

// حد أقصى لطول الشرح المعالَج في مسار العرض — القاعدة الذهبية:
// صفر تهنيج حتى لو على حساب الزينة (يُقصّ الشرح الطويل بدل معالجته كاملًا كل render)
const MAX_EXPLANATION_CHARS = 4000;

// شاشة السؤال (المواصفة 6.8 حرفيًا) — حماية FLAG_SECURE ضد لقطة الشاشة
// route.params: { subjectId, title, topic?, kind? } — topic: فلتر وضع «التصفح حسب المواضيع»
export default function QuestionScreen({ navigation, route }: { navigation: any; route: any }) {
  const { colors, primaryGradient } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { subjectId, title, topic, kind } = route?.params ?? {};

  useEffect(() => {
    enableSecureFlag();
    return () => {
      disableSecureFlag();
    };
  }, []);

  const [questions, setQuestions] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  // W45: أسئلة سُجّلت في النشاط/SM-2 (مرة واحدة لكل سؤال — منع تضخيم XP بالتكرار)
  const recordedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    (async () => {
      // دورات الوطني: الأسئلة من ملفات Cloudflare (المواضيع ليست في SQLite)
      if (kind === 'dawrat' && topic) {
        try {
          const { getDawratSubjects, getDawratSubjectData } = await import('../../content/cloudflare');
          const subjects = await getDawratSubjects();
          const subj = subjects.find((s: any) => s.id === subjectId || s.subject_id === subjectId);
          if (subj?.file) {
            const data = await getDawratSubjectData(subj.file);
            const tps = Array.isArray(data?.topics) ? data.topics : [];
            const tp = tps.find((t: any) => String(t.name || t.id) === String(topic));
            const qs = Array.isArray(tp?.questions) ? tp.questions : [];
            if (alive && qs.length > 0) {
              setQuestions(qs);
              recordedRef.current.clear();
              setLoadingQuestions(false);
              return;
            }
          }
        } catch { /* أكمل لـSQLite */ }
      }
      const loader = topic
        ? getTopicQuestions(subjectId, topic)
        : getSubjectQuestions(subjectId);
      loader
        .then(rows => {
          if (alive) {
            setQuestions(rows);
            recordedRef.current.clear();
            setLoadingQuestions(false);
          }
        })
        .catch(() => {
          if (alive) setLoadingQuestions(false);
        });
    })();
    return () => {
      alive = false;
    };
  }, [subjectId, topic]);

  const total = questions.length;
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const q = total > 0 ? questions[index % total] : null;
  const options: string[] = q?.options ?? [];
  const correctIndex: number = typeof q?.correct_index === 'number' ? q.correct_index : 0;

  // الشرح يُقصّ مرة واحدة لكل سؤال — يُعرض النص مباشرة كما هو (بدون معالجة bidi)
  const explanationBidi = useMemo(() => {
    const raw = String(q?.explanation ?? '');
    if (!raw) return '';
    const clipped = raw.length > MAX_EXPLANATION_CHARS;
    const out = clipped ? raw.slice(0, MAX_EXPLANATION_CHARS) : raw;
    return clipped ? `${out}\n(تم اختصار الشرح لطوله)` : out;
  }, [q?.explanation]);

  const reset = (next: number) => {
    setIndex(((next % total) + total) % total);
    setSelected(null);
    setRevealed(false);
  };

  const reveal = () => {
    if (selected === null || revealed) return;
    try {
      haptics.answer(selected === correctIndex);
    } catch {
      // تجاهل فشل الاهتزاز
    }
    setRevealed(true);
    // W45: نفس خط أنابيب QuizRunner — recordActivity + SM-2 عند كشف كل سؤال.
    // اقتصادية XP مطابقة لـ QuizRunner (صحيح: 2+1، خاطئ: 1) — وبلا testsCompleted
    // لأن تصفح سؤال واحد ليس اختبارًا مكتملًا.
    if (q) {
      const correct = selected === correctIndex;
      const qid = `${title ?? subjectId}::${q?.id ?? `${subjectId}::${index}`}`;
      if (!recordedRef.current.has(qid)) {
        recordedRef.current.add(qid);
        recordActivity('bank_question', correct ? 3 : 1, { questionsAnswered: 1 }, {
          perfectScore: correct,
          subjectId: String(subjectId ?? title ?? 'bank'),
          correct: correct ? 1 : 0,
          total: 1,
        }).catch(() => {});
        gradeQuizResults([{ id: qid, correct }]).catch(() => {});
      }
    }
  };

  const pick = (i: number) => {
    if (revealed) return;
    try {
      haptics.tap();
    } catch {
      // تجاهل فشل الاهتزاز — لا يعطل اختيار الإجابة
    }
    setSelected(i);
  };

  const optionState = (i: number): OptionState => {
    if (revealed) {
      if (i === correctIndex) return 'correct';
      if (i === selected) return 'wrong';
      return 'normal';
    }
    return i === selected ? 'selected' : 'normal';
  };

  const letterColors: Record<OptionState, string> = {
    normal: colors.textSecondary,
    selected: colors.burgundy,
    correct: colors.white,
    wrong: colors.white,
  };

  const letterBg: Record<OptionState, string> = {
    normal: colors.white,
    selected: colors.optionSelectedBg,
    correct: colors.emerald,
    wrong: colors.rose,
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backGlyph}>›</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, rtlTextStyle]} numberOfLines={1}>
          {topic ? `${title ?? ''} — ${topic}` : (title ?? 'الحل التدريبي')}
        </Text>
        <OfflineBadge />
      </View>

      {loadingQuestions ? (
        <QuestionSkeleton />
      ) : total === 0 ? (
        <EmptyStateCard
          icon={Inbox}
          title="لا توجد أسئلة بعد"
          message="لم تُحمَّل أسئلة هذه المادة على الجهاز بعد — ارجع واستخدم زر «تحميل للعمل أوفلاين»"
        />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <Text style={[styles.counter, rtlTextStyle]}>
              {`السؤال ${formatNumber(index + 1)} من ${formatNumber(total)}`}
            </Text>
            <Badge kind="trial" label="تجريبي" />
          </View>

          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(((index + 1) / total) * 100)}%` }]} />
          </View>

          <View style={styles.card}>
            <Text style={[styles.qText, rtlTextStyle]}>{q?.q ?? ''}</Text>

            <View style={styles.options}>
              {options.map((opt, i) => {
                const st = optionState(i);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.option, styles[`opt_${st}`]]}
                    activeOpacity={0.7}
                    disabled={revealed}
                    onPress={() => pick(i)}
                  >
                    <View
                      style={[
                        styles.letter,
                        styles[`letter_${st}`],
                        { backgroundColor: letterBg[st] },
                      ]}>
                      <Text style={[styles.letterText, { color: letterColors[st] }]}>
                        {LETTERS[i] ?? `${i + 1}`}
                      </Text>
                    </View>
                    <Text style={[styles.optText, rtlTextStyle]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {revealed && (
              <View style={styles.explain}>
                <Text style={[styles.explainTitle, rtlTextStyle]}>التفسير والشرح السريري:</Text>
                {q?.explanation ? (
                  <RichText text={explanationBidi} style={styles.explainText} />
                ) : (
                  <Text style={[styles.explainText, rtlTextStyle]}>{`الجواب الصحيح هو الخيار ${LETTERS[correctIndex]}.`}</Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.7} onPress={() => reset(index - 1)}>
              <Text style={[styles.ghostText, rtlTextStyle]}>› السابق</Text>
            </TouchableOpacity>

            {!revealed ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={reveal}
                disabled={selected === null}
                style={[styles.revealWrap, selected === null && styles.revealDisabled]}
              >
                <LinearGradient
                  colors={[...primaryGradient]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.revealBtn}
                >
                  <Text style={[styles.revealText, rtlTextStyle]}>إظهار الجواب والشرح</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View style={styles.revealPlaceholder} />
            )}

            <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.7} onPress={() => reset(index + 1)}>
              <Text style={[styles.ghostText, rtlTextStyle]}>التالي ‹</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: { fontFamily: 'tajawal', fontSize: 22, fontWeight: '700', color: colors.burgundy, marginTop: -3 },
  headerTitle: {
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  counter: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
    marginBottom: 14,
  },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.burgundy },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
    ...shadows.card,
  },
  qText: {
    fontFamily: 'tajawal',
    fontSize: 15,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'right',
    lineHeight: 32,
    marginBottom: 14,
    writingDirection: 'rtl',
  },
  options: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 12,
    direction: 'rtl',
  },
  opt_normal: { borderColor: colors.optionBorder, backgroundColor: colors.optionBg },
  opt_selected: { borderColor: colors.burgundyLight, backgroundColor: colors.optionSelectedBg },
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
  letter_normal: { borderColor: colors.letterBorder },
  letter_selected: { borderColor: colors.burgundy },
  letter_correct: { borderColor: colors.emerald },
  letter_wrong: { borderColor: colors.rose },
  letterText: { fontFamily: 'tajawal', fontSize: 15, fontWeight: '800' },
  optText: {
    flexShrink: 1,
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 13.5,
    fontWeight: '400',
    color: colors.text,
    textAlign: 'right',
    lineHeight: 22,
    writingDirection: 'rtl',
  },
  explain: {
    backgroundColor: colors.explainBg,
    borderWidth: 1,
    borderColor: colors.explainBorder,
    borderRadius: radius.sm,
    padding: 14,
    marginTop: 14,
  },
  explainTitle: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.amberText,
    textAlign: 'right',
    marginBottom: 6,
    writingDirection: 'rtl',
  },
  explainText: {
    fontFamily: 'tajawal',
    fontSize: 13.5,
    color: colors.explainText,
    textAlign: 'right',
    lineHeight: 26,
    writingDirection: 'rtl',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    marginTop: 14,
  },
  ghostBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.ghostBorder,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.burgundy,
  },
  revealWrap: { flex: 1 },
  revealDisabled: { opacity: 0.45 },
  revealBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealText: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.card,
    textAlign: 'center',
  },
  revealPlaceholder: { flex: 1 },
});
