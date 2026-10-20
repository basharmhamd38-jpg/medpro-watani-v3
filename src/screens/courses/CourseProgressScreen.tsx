// لوحة تقدم الكورس — حلقة الإتمام + أشرطة الوحدات + تحليل الفجوات
import React, { useCallback, useEffect, useRef, useState , useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { AlertTriangle, TrendingUp } from 'lucide-react-native';
import { useTheme, type ThemeColors } from '../../theme';
import { getLocalUnits, getProgressMap, unitProgressPct } from '../../courses/store';
import type { UnitWithProgress } from '../../courses/types';
import { ProgressBar, ScreenHeader, getCourseCard } from './ui';
import EmptyStateCard from '../../components/EmptyStateCard';
import { SkeletonBlock } from '../../components/Skeleton';
import type { CoursesStackNav, CoursesStackRoute } from '../tabs/CoursesTab';

const PASS = 70;
const R = 52;
const CIRC = 2 * Math.PI * R;

function Ring({ pct }: { pct: number }) {
  const { colors } = useTheme();
  const off = CIRC * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <Svg width={130} height={130} viewBox="0 0 130 130">
      <Circle cx={65} cy={65} r={R} stroke={colors.segBg} strokeWidth={11} fill="none" />
      <Circle
        cx={65}
        cy={65}
        r={R}
        stroke={colors.burgundy}
        strokeWidth={11}
        fill="none"
        strokeDasharray={`${CIRC} ${CIRC}`}
        strokeDashoffset={off}
        strokeLinecap="round"
        rotation={-90}
        origin="65, 65"
      />
    </Svg>
  );
}

export default function CourseProgressScreen({
  navigation,
  route,
}: {
  navigation: CoursesStackNav;
  route: CoursesStackRoute<'CourseProgress'>;
}) {
  const { colors } = useTheme();
  const courseCard = useMemo(() => getCourseCard(colors), [colors]);
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { courseId, title } = route.params;
  const [units, setUnits] = useState<UnitWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [overall, setOverall] = useState(0);
  const cancelled = useRef(false);

  const load = useCallback(async () => {
    try {
      const [us, pmap] = await Promise.all([getLocalUnits(courseId), getProgressMap(courseId)]);
      const list: UnitWithProgress[] = us.map(u => {
        const p = pmap[u.id] ?? null;
        const status = p ? p.status : 'not_started';
        return { ...u, progress: p, status, progressPct: unitProgressPct(p, PASS) };
      });
      if (!cancelled.current) {
        setUnits(list);
        setOverall(list.length ? Math.round(list.reduce((s, u) => s + u.progressPct, 0) / list.length) : 0);
      }
    } catch {
      if (!cancelled.current) setUnits([]);
    } finally {
      if (!cancelled.current) setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    cancelled.current = false;
    load();
    const unsub = navigation.addListener('focus', load);
    return () => {
      cancelled.current = true;
      unsub();
    };
  }, [load, navigation]);

  // الفجوات: أضعف 3 وحدات بدأها الطالب (أدنى تقدم، مع أولوية للراسبة بالاختبار)
  const gaps = [...units]
    .filter(u => u.status !== 'not_started' && u.status !== 'locked')
    .sort((a, b) => {
      const aFail = a.progress?.testTaken && (a.progress.testScore ?? 100) < PASS ? -1000 : 0;
      const bFail = b.progress?.testTaken && (b.progress.testScore ?? 100) < PASS ? -1000 : 0;
      return aFail + a.progressPct - (bFail + b.progressPct);
    })
    .slice(0, 3);

  const completedCount = units.filter(u => u.status === 'completed').length;

  // متوسط نتائج الاختبارات المجراة — إحصائية إضافية بأسلوب التطبيقات العالمية
  const tested = units.filter(u => u.progress?.testTaken && u.progress.testScore !== null);
  const avgScore =
    tested.length > 0
      ? Math.round(tested.reduce((s, u) => s + (u.progress?.testScore ?? 0), 0) / tested.length)
      : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="تقدمي بالكورس" onBack={() => navigation.goBack()} />
      {loading ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={courseCard.card}>
            <SkeletonBlock width="45%" height={18} borderRadius={9} />
            <View style={styles.skelRow}>
              <SkeletonBlock width={110} height={110} borderRadius={55} />
              <View style={styles.skelCol}>
                <SkeletonBlock width="90%" height={14} />
                <SkeletonBlock width="75%" height={14} />
                <SkeletonBlock width="85%" height={14} />
              </View>
            </View>
          </View>
          <View style={courseCard.card}>
            <SkeletonBlock width="40%" height={16} borderRadius={8} />
            {[0, 1, 2].map(i => (
              <View key={i} style={styles.skelBar}>
                <SkeletonBlock width="100%" height={7} borderRadius={999} />
              </View>
            ))}
          </View>
        </ScrollView>
      ) : units.length === 0 ? (
        <EmptyStateCard
          icon={TrendingUp}
          title="لا توجد بيانات تقدم بعد"
          message="ابدأ أول وحدة في الكورس وستظهر هنا إحصائياتك: الإتمام، الأسئلة المنجزة، ومتوسط نتائج اختباراتك"
        />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={courseCard.card}>
            <Text style={styles.cardTitle}>{title}</Text>
            <View style={styles.ringRow}>
              <View style={styles.ringWrap}>
                <Ring pct={overall} />
                <Text style={styles.ringPct}>{overall}%</Text>
              </View>
              <View style={styles.ringInfo}>
                <Text style={styles.statLine}>
                  الوحدات المكتملة: <Text style={styles.statBold}>{completedCount} / {units.length}</Text>
                </Text>
                <Text style={styles.statLine}>
                  الأسئلة المنجزة:{' '}
                  <Text style={styles.statBold}>
                    {units.reduce((s, u) => s + (u.progress?.questionsDone ?? 0), 0)}
                  </Text>
                </Text>
                <Text style={styles.statLine}>
                  متوسط نتائج الاختبارات:{' '}
                  <Text
                    style={[
                      styles.statBold,
                      avgScore !== null && { color: avgScore >= PASS ? colors.success : colors.error },
                    ]}>
                    {avgScore !== null ? `${avgScore}%` : '—'}
                  </Text>
                </Text>
              </View>
            </View>
          </View>

          {gaps.length > 0 && (
            <View style={[courseCard.card, styles.gapCard]}>
              <View style={styles.gapHead}>
                <AlertTriangle size={17} color={colors.amberText} />
                <Text style={styles.gapTitle}>نقاط تحتاج تقوية</Text>
              </View>
              {gaps.map(g => (
                <TouchableOpacity
                  key={g.id}
                  activeOpacity={0.8}
                  onPress={() =>
                    navigation.navigate('UnitDetail', { courseId, unitId: g.id, title: g.title })
                  }>
                  <View style={styles.gapRow}>
                    <Text style={styles.gapName} numberOfLines={1}>
                      {g.title}
                    </Text>
                    <Text style={styles.gapPct}>{Math.round(g.progressPct)}%</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={courseCard.card}>
            <Text style={styles.cardTitle}>تقدم الوحدات</Text>
            {units.map(u => (
              <View key={u.id} style={styles.unitRow}>
                <View style={styles.unitHead}>
                  <Text style={styles.unitName} numberOfLines={1}>
                    {u.order + 1}. {u.title}
                  </Text>
                  <Text style={styles.unitPct}>{Math.round(u.progressPct)}%</Text>
                </View>
                <ProgressBar pct={u.progressPct} height={7} />
                {u.progress?.testTaken && u.progress.testScore !== null && (
                  <Text
                    style={[
                      styles.testNote,
                      { color: u.progress.testScore >= PASS ? colors.success : colors.error },
                    ]}>
                    درجة الاختبار: {Math.round(u.progress.testScore)}%
                  </Text>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 14, paddingBottom: 28 },
  ringRow: { flexDirection: 'row', alignItems: 'center' },
  ringWrap: { alignItems: 'center', justifyContent: 'center', width: 130, height: 130 },
  ringPct: { position: 'absolute', fontFamily: 'tajawal', fontSize: 22, fontWeight: '700', color: colors.burgundy },
  ringInfo: { flex: 1, marginEnd: 12 },
  statBold: {
              fontFamily: 'tajawal', fontWeight: '700', color: colors.title },
  gapCard: { backgroundColor: colors.explainBg, borderColor: colors.explainBorder },
  gapHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: 'flex-start' },
  gapTitle: { fontFamily: 'tajawal', fontSize: 14, fontWeight: '700', color: colors.amberText, marginEnd: 6 },
  gapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 6,
  },
  gapPct: { fontFamily: 'tajawal', fontSize: 13, fontWeight: '700', color: colors.error, marginEnd: 8 },
  unitRow: { marginBottom: 12 },
  unitHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  unitPct: { fontFamily: 'tajawal', fontSize: 12.5, fontWeight: '700', color: colors.burgundy, marginEnd: 8 },
  // هيكل التحميل
  skelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  skelCol: { flex: 1, marginEnd: 14, gap: 10 },
  skelBar: { marginTop: 14 },
  cardTitle: {},
  gapName: {},
  statLine: {},
  testNote: {},
  unitName: {},
});
