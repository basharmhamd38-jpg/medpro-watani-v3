// شاشة السؤال — خيارات + كشف الجواب + الشرح الخماسي القابل للطي
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, ChevronDown } from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import Badge from '../../components/Badge';
import { QuestionSkeleton } from '../../components/Skeleton';
import { haptics } from '../../utils/haptics';
import { getLocalQuestions, markQuestionDone } from '../../courses/store';
import { parseExplanation } from '../../courses/explain';
import type { CourseQuestion, ExplanationParts } from '../../courses/types';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import { ScreenHeader } from './ui';
import EmptyStateCard from '../../components/EmptyStateCard';
import { FileQuestion } from 'lucide-react-native';
import type { CoursesStackNav, CoursesStackRoute } from '../tabs/CoursesTab';

function Section({
  index,
  title,
  children,
  defaultOpen,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <View style={styles.section}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setOpen(o => !o)}
        style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>
          {index}. {title}
        </Text>
        <ChevronDown
          size={18}
          color={colors.textSecondary}
          style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
        />
      </TouchableOpacity>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

const OptionRow = React.memo(function OptionRow({
  label,
  text,
  state,
  onPress,
  disabled,
}: {
  label: string;
  text: string;
  state: 'idle' | 'correct' | 'wrong' | 'dim';
  onPress: () => void;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.option,
        state === 'correct' && styles.optionCorrect,
        state === 'wrong' && styles.optionWrong,
        state === 'dim' && styles.optionDim,
      ]}>
      <View
        style={[
          styles.optBadge,
          state === 'correct' && styles.optBadgeCorrect,
          state === 'wrong' && styles.optBadgeWrong,
        ]}>
        <Text
          style={[
            styles.optBadgeText,
            (state === 'correct' || state === 'wrong') && styles.optBadgeTextActive,
          ]}>
          {label}
        </Text>
      </View>
      <Text
        style={[
          styles.optText,
          (state === 'correct' || state === 'wrong') && styles.optTextActive,
        ]}>
        {bidi(text)}
      </Text>
    </TouchableOpacity>
  );
});

export default function CourseQuestionScreen({
  navigation,
  route,
}: {
  navigation: CoursesStackNav;
  route: CoursesStackRoute<'CourseQuestion'>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  // حماية: معاملات التنقل قد تكون ناقصة — لا ننهار أبدًا
  const params = route.params ?? ({} as { courseId?: string; unitId?: string; index?: number; title?: string });
  const courseId = params.courseId ?? '';
  const unitId = params.unitId ?? '';
  const initialIndex = typeof params.index === 'number' ? params.index : 0;
  const title = params.title ?? 'سؤال';
  const [questions, setQuestions] = useState<CourseQuestion[]>([]);
  const [index, setIndex] = useState(initialIndex);
  const [picked, setPicked] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    setLoadError(false);
    if (!courseId || !unitId) {
      setLoading(false);
      setLoadError(true);
      return;
    }
    getLocalQuestions(courseId, unitId)
      .then(qs => {
        if (!cancelled.current) setQuestions(Array.isArray(qs) ? qs : []);
      })
      .catch(() => {
        // أي فشل في القراءة المحلية — لا ننهار، نعرض حالة فراغ
        if (!cancelled.current) {
          setQuestions([]);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled.current) setLoading(false);
      });
    return () => {
      cancelled.current = true;
    };
  }, [courseId, unitId]);

  const rawQ = questions[index];
  // تحقق صارم من سلامة السؤال قبل العرض — أي بيانات ناقصة = شاشة فراغ لا انهيار
  const q: CourseQuestion | undefined =
    rawQ &&
    typeof rawQ.text === 'string' &&
    Array.isArray(rawQ.options) &&
    rawQ.options.length > 0
      ? {
          ...rawQ,
          options: rawQ.options.map(o => String(o ?? '')),
          optionLabels: Array.isArray(rawQ.optionLabels) ? rawQ.optionLabels : [],
          correctIndex:
            typeof rawQ.correctIndex === 'number' &&
            rawQ.correctIndex >= 0 &&
            rawQ.correctIndex < rawQ.options.length
              ? rawQ.correctIndex
              : 0,
        }
      : undefined;

  const parts: ExplanationParts | null = useMemo(() => {
    if (!q?.explanation) return null;
    try {
      return parseExplanation(q.explanation);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawQ]);

  useEffect(() => {
    setPicked(null);
  }, [index]);

  const reveal = useCallback(
    (i: number) => {
      if (picked !== null || !q) return;
      setPicked(i);
      try {
        haptics.answer(i === q.correctIndex);
      } catch {
        // تجاهل فشل الاهتزاز
      }
      markQuestionDone(unitId).catch(() => {});
    },
    [picked, q, unitId],
  );

  const go = useCallback(
    (dir: 1 | -1) => {
      const n = index + dir;
      if (n >= 0 && n < questions.length) setIndex(n);
      else navigation.goBack();
    },
    [index, questions.length, navigation],
  );

  if (loading)
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={title} onBack={() => navigation.goBack()} />
        <QuestionSkeleton />
      </SafeAreaView>
    );

  if (!q)
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title={title} onBack={() => navigation.goBack()} />
        <EmptyStateCard
          icon={FileQuestion}
          title="لا يوجد سؤال هنا"
          message={
            loadError
              ? 'تعذر تحميل الأسئلة — تحقق من الاتصال ثم أعد تحميل الكورس'
              : 'يبدو أن أسئلة هذه الوحدة لم تُحمَّل بعد — أعد تحميل الكورس ثم حاول مجددًا'
          }
        />
      </SafeAreaView>
    );

  const revealed = picked !== null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title={`سؤال ${index + 1} / ${questions.length}`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        key={q.id}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}>
        <View style={styles.qCard}>
          <Text style={styles.qText}>{bidi(q.text)}</Text>
          <View style={styles.badges}>
            {q.difficulty ? <Badge kind="soon" label={q.difficulty} /> : null}
            {q.years?.length ? (
              <View style={styles.yearBadge}>
                <CalendarDays size={12} color={colors.burgundy} />
                <Text style={styles.yearText}>{q.years.join('، ')}</Text>
              </View>
            ) : null}
            {q.keyCorrected ? <Badge kind="trial" label="مفتاح مصحح" /> : null}
          </View>
        </View>

        {q.options.map((opt, i) => {
          const state = !revealed
            ? 'idle'
            : i === q.correctIndex
              ? 'correct'
              : i === picked
                ? 'wrong'
                : 'dim';
          return (
            <OptionRow
              key={`${q.id}-${i}`}
              label={q.optionLabels[i] ?? String(i + 1)}
              text={opt}
              state={state}
              disabled={revealed}
              onPress={() => reveal(i)}
            />
          );
        })}

        {revealed && (
          <View style={styles.answerLine}>
            <Text style={styles.answerText}>✓ الإجابة الصحيحة: {bidi(q.correct)}</Text>
          </View>
        )}

        {revealed && parts && (
          <View style={styles.explainWrap}>
            <Section index={1} title={parts.titles[0]} defaultOpen>
              <Text style={styles.bodyText}>{bidi(parts.whyCorrect)}</Text>
            </Section>
            <Section index={2} title={parts.titles[1]} defaultOpen>
              {parts.wrongOptions.length ? (
                parts.wrongOptions.map((w, i) => (
                  <View key={i} style={styles.wrongRow}>
                    {w.option ? <Text style={styles.wrongOpt}>{bidi(w.option)}:</Text> : null}
                    <Text style={styles.wrongReason}>{bidi(w.reason)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.bodyText}>{bidi(parts.whyOthersWrong)}</Text>
              )}
            </Section>
            {parts.takeaway ? (
              <Section index={3} title={parts.titles[2]}>
                <Text style={styles.bodyText}>{bidi(parts.takeaway)}</Text>
              </Section>
            ) : null}
            {parts.why ? (
              <Section index={4} title={parts.titles[3]}>
                <Text style={styles.bodyText}>{bidi(parts.why)}</Text>
              </Section>
            ) : null}
            {parts.visual ? (
              <Section index={5} title={parts.titles[4]}>
                <Text style={styles.bodyText}>{bidi(parts.visual)}</Text>
              </Section>
            ) : null}
            {q.sourceRef ? <Text style={styles.src}>المصدر: {bidi(q.sourceRef)}</Text> : null}
          </View>
        )}

        <View style={styles.navRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => go(-1)}
            style={[styles.navBtn, styles.navBtnGhost]}>
            <Text style={styles.navBtnGhostText}>السابق</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.85} onPress={() => go(1)} style={styles.navBtn}>
            <Text style={styles.navBtnText}>{index === questions.length - 1 ? 'إنهاء' : 'التالي'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { padding: 14, paddingBottom: 28 },
  qCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
    ...shadows.card,
  },
  badges: { flexDirection: 'row', marginTop: 10, gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' },
  yearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.skeletonBg,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
  },
  yearText: { fontFamily: 'tajawal', fontSize: 10.5, fontWeight: '700', color: colors.burgundy, marginEnd: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.optionBg,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 13,
    marginBottom: 9,
    direction: 'rtl',
  },
  optionCorrect: { backgroundColor: colors.successBg, borderColor: colors.success },
  optionWrong: { backgroundColor: colors.errorBg, borderColor: colors.error },
  optionDim: { opacity: 0.55 },
  optBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.segBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optBadgeCorrect: { backgroundColor: colors.success },
  optBadgeWrong: { backgroundColor: colors.error },
  optBadgeText: { fontFamily: 'tajawal', fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  optBadgeTextActive: { color: colors.white },
  optTextActive: {
                   fontFamily: 'tajawal', fontWeight: '700', color: colors.title },
  answerLine: {
    backgroundColor: colors.successBg,
    borderRadius: 12,
    padding: 12,
    marginTop: 2,
    marginBottom: 10,
  },
  explainWrap: { marginTop: 4 },
  section: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 9,
    overflow: 'hidden',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 13,
  },
  sectionTitle: { fontFamily: 'tajawal', fontSize: 14.5, fontWeight: '700', color: colors.burgundy },
  sectionBody: { paddingHorizontal: 13, paddingBottom: 13, borderTopWidth: 1, borderTopColor: colors.borderFaint, paddingTop: 10 },
  wrongRow: { marginBottom: 10, backgroundColor: colors.accordionBg, borderRadius: 10, padding: 10 },
  navRow: { flexDirection: 'row', marginTop: 14, gap: 10 },
  navBtn: {
    flex: 1,
    backgroundColor: colors.burgundy,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  navBtnText: { fontFamily: 'tajawal', fontSize: 15, fontWeight: '700', color: colors.card },
  navBtnGhost: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.ghostBorder },
  navBtnGhostText: { fontFamily: 'tajawal', fontSize: 15, fontWeight: '700', color: colors.burgundy },
  answerText: {},
  bodyText: {},
  optText: {},
  qText: {},
  src: {},
  wrongOpt: {},
  wrongReason: {},
});
