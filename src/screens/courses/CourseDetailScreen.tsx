// تفاصيل الكورس — الوحدات متسلسلة مع التقدم والقفل التسلسلي
import React, { useCallback, useEffect, useRef, useState , useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { Lock, PackageOpen } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, type ThemeColors } from '../../theme';
import { useToast } from '../../components/Toast';
import EmptyStateCard from '../../components/EmptyStateCard';
import { SkeletonList, UnitRowSkeleton } from '../../components/Skeleton';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import { formatNumber } from '../../utils/numbers';
import { getLocalUnits, getProgressMap, unitProgressPct } from '../../courses/store';
import type { CourseUnit, UnitStatus, UnitWithProgress } from '../../courses/types';
import { canOpenCourseUnit } from '../../payment/gates';
import { ProgressBar, ScreenHeader, StatusChip, getCourseCard } from './ui';
import type { CoursesStackNav, CoursesStackRoute } from '../tabs/CoursesTab';

type UnitWithLock = UnitWithProgress & { lockReason?: 'sequence' | 'payment' };

const PASS = 70;

export default function CourseDetailScreen({
  navigation,
  route,
}: {
  navigation: CoursesStackNav;
  route: CoursesStackRoute<'CourseDetail'>;
}) {
  const { colors } = useTheme();
  const courseCard = useMemo(() => getCourseCard(colors), [colors]);
  const styles = useMemo(() => getStyles(colors), [colors]);
  const toast = useToast();
  const { courseId, title } = route.params;
  const [units, setUnits] = useState<UnitWithLock[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overall, setOverall] = useState(0);
  const cancelled = useRef(false);

  const load = useCallback(async () => {
    try {
      const [us, pmap] = await Promise.all([getLocalUnits(courseId), getProgressMap(courseId)]);
      const list: UnitWithLock[] = us.map((u: CourseUnit, idx: number) => {
        const p = pmap[u.id] ?? null;
        // بوابة الدفع: الوحدات 1–3 مجانية للتجربة، الرابعة فما فوق تتطلب التفعيل
        const gate = canOpenCourseUnit(u.order);
        if (!gate.open) {
          return { ...u, progress: p, status: 'locked' as UnitStatus, progressPct: 0, lockReason: 'payment' as const };
        }
        const prevDone = idx === 0 || us[idx - 1] === undefined ? true : (pmap[us[idx - 1].id]?.status === 'completed');
        const status: UnitStatus = !prevDone ? 'locked' : p ? p.status : 'not_started';
        const pct = unitProgressPct(p, PASS);
        return { ...u, progress: p, status, progressPct: pct, lockReason: !prevDone ? ('sequence' as const) : undefined };
      });
      if (!cancelled.current) {
        setUnits(list);
        setOverall(
          list.length ? Math.round(list.reduce((s, u) => s + u.progressPct, 0) / list.length) : 0,
        );
      }
    } catch {
      if (!cancelled.current) setUnits([]);
    } finally {
      if (!cancelled.current) {
        setLoading(false);
        setRefreshing(false);
      }
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const openUnit = (u: UnitWithLock) => {
    if (u.status === 'locked') {
      if (u.lockReason === 'payment') {
        toast('الوحدات 1–3 مجانية للتجربة — فعّل حسابك لفتح باقي وحدات الكورس');
      } else {
        toast('أكمل الوحدة السابقة أولًا لفتح هذه الوحدة');
      }
      return;
    }
    navigation.navigate('UnitDetail', { courseId, unitId: u.id, title: u.title });
  };

  const renderItem = useCallback(
    ({ item, index }: { item: UnitWithLock; index: number }) => (
      <TouchableOpacity
        activeOpacity={item.status === 'locked' ? 1 : 0.85}
        onPress={() => openUnit(item)}
        disabled={item.status === 'locked'}>
        <View style={[courseCard.card, item.status === 'locked' && styles.lockedCard]}>
          <View style={styles.row}>
            <View style={[styles.numBadge, item.status === 'locked' && styles.numBadgeLocked]}>
              {item.status === 'locked' ? (
                <Lock size={16} color={colors.textMuted} />
              ) : (
                <Text style={styles.numText}>{index + 1}</Text>
              )}
            </View>
            <View style={styles.info}>
              <Text style={[styles.uTitle, item.status === 'locked' && styles.dim, rtlTextStyle]} numberOfLines={2}>
                {bidi(item.title)}
              </Text>
              <Text style={[styles.uMeta, rtlTextStyle]} numberOfLines={1}>
                {bidi(`${(item.topics || []).slice(0, 3).join(' • ')}${item.questionCount ? ` — ${formatNumber(item.questionCount)} سؤالًا` : ''}`)}
              </Text>
            </View>
            <StatusChip status={item.status} pct={item.progressPct} />
          </View>
          {item.status !== 'locked' && (
            <View style={styles.barWrap}>
              <ProgressBar pct={item.progressPct} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title={title}
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('CourseProgress', { courseId, title })}>
            <Text style={styles.progressLink}>تقدمي</Text>
          </TouchableOpacity>
        }
      />
      {loading ? (
        <SkeletonList count={5} render={() => <UnitRowSkeleton />} />
      ) : (
        <FlatList
          data={units}
          keyExtractor={u => u.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.burgundy]}
            />
          }
          ListHeaderComponent={
            <View style={courseCard.card}>
              <View style={styles.overRow}>
                <Text style={styles.overLabel}>إتمام الكورس</Text>
                <Text style={styles.overPct}>{overall}%</Text>
              </View>
              <ProgressBar pct={overall} height={10} />
              <Text style={styles.hint}>الوحدات تُفتح بالتسلسل — أتقن كل وحدة لفتح التالية</Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyStateCard
              icon={PackageOpen}
              title="لا توجد وحدات محمّلة"
              message="وحدات هذا الكورس لم تُحمَّل على جهازك بعد — ارجع للقائمة وأعد تحميل الكورس"
            />
          }
          removeClippedSubviews
          maxToRenderPerBatch={8}
          windowSize={7}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 14, paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center' },
  numBadge: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.skeletonBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numBadgeLocked: { backgroundColor: colors.segBg },
  numText: { fontFamily: 'tajawal', fontSize: 17, fontWeight: '700', color: colors.burgundy },
  info: { flex: 1, marginHorizontal: 10 },
  uTitle: { fontFamily: 'tajawal', fontSize: 15, fontWeight: '700', color: colors.title, textAlign: 'right', writingDirection: 'rtl' },
  uMeta: { fontFamily: 'tajawal', fontSize: 12, color: colors.textSecondary, textAlign: 'right', writingDirection: 'rtl', marginTop: 2 },
  dim: { color: colors.textMuted },
  lockedCard: { opacity: 0.75 },
  barWrap: { marginTop: 10 },
  overRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  overLabel: { fontFamily: 'tajawal', fontSize: 14, fontWeight: '700', color: colors.title },
  overPct: { fontFamily: 'tajawal', fontSize: 14, fontWeight: '700', color: colors.burgundy },
  hint: { fontFamily: 'tajawal', fontSize: 12, color: colors.textSecondary, textAlign: 'right', writingDirection: 'rtl', marginTop: 8, lineHeight: 20 },
  progressLink: { fontFamily: 'tajawal', fontSize: 13, fontWeight: '700', color: colors.burgundy },
});
