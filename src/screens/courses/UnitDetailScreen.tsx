// تفاصيل الوحدة — تبويبات: الخلاصة / الأسئلة / الاختبار
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View, ScrollView } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Clock, FileText, ListChecks, Play } from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { getLocalQuestions, getLocalUnits, getProgressMap, markSummaryRead } from '../../courses/store';
import type { CourseQuestion, CourseUnit } from '../../courses/types';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import Markdown from './Markdown';
import { ScreenHeader, getCourseCard } from './ui';
import EmptyStateCard from '../../components/EmptyStateCard';
import ConfirmDialog from '../../components/ConfirmDialog';
import { SkeletonList, SummarySkeleton, UnitRowSkeleton } from '../../components/Skeleton';
import { haptics } from '../../utils/haptics';
import type { CoursesStackNav, CoursesStackRoute } from '../tabs/CoursesTab';

type Tab = 'summary' | 'questions' | 'test';

const getDiffStyle = (
  colors: ThemeColors,
): Record<string, { bg: string; fg: string; label: string }> => ({
  'سهل': { bg: colors.successBg, fg: colors.success, label: 'سهل' },
  'متوسط': { bg: colors.amberBg, fg: colors.amberText, label: 'متوسط' },
  'صعب': { bg: colors.errorBg, fg: colors.error, label: 'صعب' },
});

export default function UnitDetailScreen({
  navigation,
  route,
}: {
  navigation: CoursesStackNav;
  route: CoursesStackRoute<'UnitDetail'>;
}) {
  const { colors, primaryGradient } = useTheme();
  const courseCard = useMemo(() => getCourseCard(colors), [colors]);
  const styles = useMemo(() => getStyles(colors), [colors]);
  const DIFF_STYLE = useMemo(() => getDiffStyle(colors), [colors]);
  const { courseId, unitId, title } = route.params;
  const [tab, setTab] = useState<Tab>('summary');
  const [unit, setUnit] = useState<CourseUnit | null>(null);
  const [questions, setQuestions] = useState<CourseQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [testTaken, setTestTaken] = useState(false);
  const [testScore, setTestScore] = useState<number | null>(null);
  const [confirmRetake, setConfirmRetake] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    (async () => {
      try {
        const [units, qs, pmap] = await Promise.all([
          getLocalUnits(courseId),
          getLocalQuestions(courseId, unitId),
          getProgressMap(courseId),
        ]);
        if (cancelled.current) return;
        setUnit(units.find(u => u.id === unitId) ?? null);
        setQuestions(qs);
        const p = pmap[unitId];
        if (p) {
          setTestTaken(p.testTaken);
          setTestScore(p.testScore);
        }
        // تسجيل قراءة الخلاصة عند فتح تبويبها أول مرة
        markSummaryRead(unitId).catch(() => {});
      } finally {
        if (!cancelled.current) setLoading(false);
      }
    })();
    const unsub = navigation.addListener('focus', () => {
      getProgressMap(courseId).then(pmap => {
        if (cancelled.current) return;
        const p = pmap[unitId];
        if (p) {
          setTestTaken(p.testTaken);
          setTestScore(p.testScore);
        }
      }).catch(() => {});
    });
    return () => {
      cancelled.current = true;
      unsub();
    };
  }, [courseId, unitId, navigation]);

  const openQuestion = useCallback(
    (index: number) => {
      navigation.navigate('CourseQuestion', { courseId, unitId, index, title });
    },
    [navigation, courseId, unitId, title],
  );

  const renderQ = useCallback(
    ({ item, index }: { item: CourseQuestion; index: number }) => {
      const d = DIFF_STYLE[item.difficulty];
      return (
        <TouchableOpacity activeOpacity={0.85} onPress={() => openQuestion(index)}>
          <View style={courseCard.card}>
            <View style={styles.qRow}>
              <View style={styles.qNum}>
                <Text style={styles.qNumText}>{index + 1}</Text>
              </View>
              <Text style={styles.qText} numberOfLines={2}>
                {bidi(item.text)}
              </Text>
              <ChevronLeft size={18} color={colors.textMuted} />
            </View>
            <View style={styles.qMeta}>
              {d && (
                <View style={[styles.diff, { backgroundColor: d.bg }]}>
                  <Text style={[styles.diffText, { color: d.fg }]}>{d.label}</Text>
                </View>
              )}
              {item.topic ? <Text style={styles.topic}>{item.topic}</Text> : null}
              {item.keyCorrected && <Text style={styles.corrected}>مفتاح مصحح</Text>}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [openQuestion, DIFF_STYLE, courseCard],
  );

  const test = unit?.unitTest;
  const passThreshold = test?.passThreshold ?? 70;
  const passedBefore = testTaken && (testScore ?? 0) >= passThreshold;

  // بدء الاختبار — مع تأكيد عند إعادة اختبار ناجح سابقًا (النتيجة ستُستبدل)
  const startTest = useCallback(() => {
    if (passedBefore) {
      haptics.warn();
      setConfirmRetake(true);
      return;
    }
    navigation.navigate('CourseTest', { courseId, unitId, title });
  }, [passedBefore, navigation, courseId, unitId, title]);
  const tabs: { key: Tab; label: string }[] = useMemo(
    () => [
      { key: 'summary', label: 'الخلاصة' },
      { key: 'questions', label: `الأسئلة (${questions.length})` },
      { key: 'test', label: 'الاختبار' },
    ],
    [questions.length],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />
      <View style={styles.segWrap}>
        <View style={styles.seg}>
          {tabs.map(t => (
            <TouchableOpacity
              key={t.key}
              activeOpacity={0.8}
              onPress={() => setTab(t.key)}
              style={[styles.segBtn, tab === t.key && styles.segBtnActive]}>
              <Text style={[styles.segText, tab === t.key && styles.segTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        tab === 'questions' ? (
          <SkeletonList count={6} render={() => <UnitRowSkeleton />} />
        ) : (
          <SummarySkeleton />
        )
      ) : tab === 'summary' ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          {unit?.summary ? (
            <Markdown text={unit.summary} />
          ) : (
            <EmptyStateCard
              icon={FileText}
              title="لا توجد خلاصة بعد"
              message="خلاصة هذه الوحدة لم تُحمَّل على جهازك — أعد تحميل الكورس ثم عاود المحاولة"
            />
          )}
        </ScrollView>
      ) : tab === 'questions' ? (
        <FlatList
          data={questions}
          keyExtractor={q => q.id}
          renderItem={renderQ}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyStateCard
              icon={ListChecks}
              title="لا توجد أسئلة محمّلة"
              message="أسئلة هذه الوحدة لم تُحمَّل على جهازك بعد — أعد تحميل الكورس ثم عاود المحاولة"
            />
          }
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={7}
        />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={courseCard.card}>
            <Text style={styles.testTitle}>اختبار نهاية الوحدة</Text>
            <Text style={styles.testDesc}>
              أسئلة متداخلة بأسلوب الامتحان — تُحسب النتيجة فور الانتهاء، وعتبة الاجتياز{' '}
              {test?.passThreshold ?? 70}%
            </Text>
            <View style={styles.testMeta}>
              <View style={styles.testMetaItem}>
                <Text style={styles.testMetaNum}>{test?.questions.length ?? 0}</Text>
                <Text style={styles.testMetaLabel}>سؤالًا</Text>
              </View>
              <View style={styles.testMetaItem}>
                <Clock size={16} color={colors.burgundy} />
                <Text style={styles.testMetaLabel}>{test?.timeMinutes ?? 15} دقيقة</Text>
              </View>
              {testTaken && testScore !== null && (
                <View style={styles.testMetaItem}>
                  <Text style={[styles.testMetaNum, { color: testScore >= (test?.passThreshold ?? 70) ? colors.success : colors.error }]}>
                    {Math.round(testScore)}%
                  </Text>
                  <Text style={styles.testMetaLabel}>آخر نتيجة</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!test?.questions.length}
              onPress={startTest}>
              <LinearGradient
                colors={[...primaryGradient]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0, y: 0 }}
                style={[styles.startBtn, !test?.questions.length && styles.disabledBtn]}>
                <Play size={17} color={colors.card} />
                <Text style={styles.startText}>{testTaken ? 'إعادة الاختبار' : 'ابدأ الاختبار'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          <Text style={styles.note}>
            اجتياز الاختبار ({test?.passThreshold ?? 70}% فأعلى) يفتح الوحدة التالية
          </Text>
        </ScrollView>
      )}

      <ConfirmDialog
        visible={confirmRetake}
        title="إعادة اختبار ناجح؟"
        message={`نتيجتك الحالية ${Math.round(testScore ?? 0)}% — إعادة الاختبار ستستبدلها بالنتيجة الجديدة، وإن رسبت ستعود الوحدة «جارية»`}
        confirmLabel="أعد الاختبار"
        cancelLabel="احتفظ بنتيجتي"
        onConfirm={() => {
          setConfirmRetake(false);
          navigation.navigate('CourseTest', { courseId, unitId, title });
        }}
        onCancel={() => setConfirmRetake(false)}
      />
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  segWrap: { paddingHorizontal: 14, paddingTop: 10 },
  seg: {
    flexDirection: 'row',
    backgroundColor: colors.segBg,
    borderRadius: radius.md,
    padding: 4,
  },
  segBtn: { flex: 1, borderRadius: 12, paddingVertical: 9, alignItems: 'center' },
  segBtnActive: { backgroundColor: colors.card, ...shadows.card },
  segText: { fontFamily: 'tajawal', fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  segTextActive: {
                   fontFamily: 'tajawal', color: colors.burgundy, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: 14, paddingBottom: 28 },
  list: { padding: 14, paddingBottom: 24 },
  qRow: { flexDirection: 'row', alignItems: 'center' },
  qNum: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.skeletonBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qNumText: { fontFamily: 'tajawal', fontSize: 14, fontWeight: '700', color: colors.burgundy },
  qText: { flex: 1, fontFamily: 'tajawal', fontSize: 13.5, color: colors.text, textAlign: 'left', marginHorizontal: 8, lineHeight: 21, ...rtlTextStyle },
  qMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8, justifyContent: 'flex-end' },
  diff: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginStart: 6 },
  diffText: { fontFamily: 'tajawal', fontSize: 10.5, fontWeight: '700' },
  topic: { fontFamily: 'tajawal', fontSize: 11, color: colors.textSecondary },
  corrected: { fontFamily: 'tajawal', fontSize: 10.5, fontWeight: '700', color: colors.amberText, marginEnd: 6 },
  testTitle: { fontFamily: 'tajawal', fontSize: 16, fontWeight: '700', color: colors.title, textAlign: 'left', writingDirection: 'ltr', marginBottom: 6 },
  testDesc: { fontFamily: 'tajawal', fontSize: 13.5, color: colors.text, textAlign: 'left', writingDirection: 'ltr', lineHeight: 22, marginBottom: 12 },
  testMeta: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 },
  testMetaItem: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  testMetaNum: { fontFamily: 'tajawal', fontSize: 18, fontWeight: '700', color: colors.burgundy },
  testMetaLabel: { fontFamily: 'tajawal', fontSize: 12, color: colors.textSecondary },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingVertical: 13 },
  startText: { fontFamily: 'tajawal', fontSize: 15, fontWeight: '700', color: colors.card, marginEnd: 8 },
  disabledBtn: { opacity: 0.5 },
  note: { fontFamily: 'tajawal', fontSize: 12.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, marginTop: 4 },
});
