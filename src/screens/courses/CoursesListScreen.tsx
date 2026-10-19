// قائمة الكورسات — تُقرأ ديناميكيًا من Firestore (مع fallback محلي أوفلاين)
import React, { useCallback, useEffect, useRef, useState , useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import LinearGradient from 'react-native-linear-gradient';
import { BookOpenCheck, Download, RefreshCw, WifiOff } from 'lucide-react-native';
import { gradients, radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { useToast } from '../../components/Toast';
import Badge from '../../components/Badge';
import { CourseCardSkeleton, SkeletonList } from '../../components/Skeleton';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import { formatNumber } from '../../utils/numbers';
import { fetchCourses, isCoursesSyncAvailable } from '../../courses/firestore';
import {
  downloadCourse,
  getLocalCourses,
  isCourseDownloaded,
} from '../../courses/store';
import type { CourseMeta } from '../../courses/types';
import { getCourseCard } from './ui';
import type { CoursesStackNav } from '../tabs/CoursesTab';

interface Item extends CourseMeta {
  downloaded: boolean;
}

// رسالة عربية واضحة حسب سبب فشل مزامنة الكورسات
function describeSyncError(e: any): string {
  const m = String(e?.message || '');
  if (/network|fetch|Failed to fetch|Network request failed|timed out|timeout/i.test(m)) {
    return 'تعذر الاتصال بالإنترنت — تحقق من اتصالك ثم أعد المحاولة';
  }
  if (/403|PERMISSION_DENIED/i.test(m)) {
    return 'تعذر الوصول إلى بيانات الكورسات حاليًا — أعد المحاولة لاحقًا';
  }
  return 'حدث خطأ أثناء تحميل الكورسات — أعد المحاولة';
}

export default function CoursesListScreen({ navigation }: { navigation: CoursesStackNav }) {
  const { colors } = useTheme();
  const courseCard = useMemo(() => getCourseCard(colors), [colors]);
  const styles = useMemo(() => getStyles(colors), [colors]);
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dlId, setDlId] = useState<string | null>(null);
  const [dlPct, setDlPct] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const cancelled = useRef(false);

  const load = useCallback(async (withRemote: boolean) => {
    if (withRemote && !cancelled.current) setSyncError(null);
    try {
      const local = await getLocalCourses();
      const map = new Map<string, Item>(local.map(c => [c.id, { ...c, downloaded: true }]));
      if (withRemote && isCoursesSyncAvailable()) {
        try {
          const remote = await fetchCourses();
          for (const c of remote) {
            if (!map.has(c.id)) {
              const dl = await isCourseDownloaded(c.id);
              map.set(c.id, { ...c, downloaded: dl });
            }
          }
        } catch (e) {
          // فشل المزامنة — نعرض رسالة عربية واضحة مع زر إعادة المحاولة
          if (!cancelled.current) setSyncError(describeSyncError(e));
        }
      } else if (withRemote && !isCoursesSyncAvailable()) {
        if (!cancelled.current) setSyncError('المزامنة غير متاحة — تحقق من الاتصال ثم أعد المحاولة');
      }
      if (!cancelled.current) setItems([...map.values()]);
    } catch {
      if (!cancelled.current) setItems([]);
    } finally {
      if (!cancelled.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    cancelled.current = false;
    load(true);
    const unsub = navigation.addListener('focus', () => load(false));
    return () => {
      cancelled.current = true;
      unsub();
    };
  }, [load, navigation]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  // إعادة المحاولة بزر واضح عند الفراغ أو فشل المزامنة
  const onRetry = useCallback(() => {
    setLoading(true);
    load(true);
  }, [load]);

  const startDownload = async (course: Item) => {
    if (dlId) return;
    setDlId(course.id);
    setDlPct(0);
    try {
      await downloadCourse(course, (d, t) => {
        if (!cancelled.current) setDlPct(Math.round((d / Math.max(t, 1)) * 100));
      });
      toast('تم تحميل الكورس — يعمل أوفلاين الآن');
      load(false);
    } catch (e: any) {
      toast(e?.message || 'تعذر التحميل — تحقق من الاتصال');
    } finally {
      if (!cancelled.current) {
        setDlId(null);
        setDlPct(0);
      }
    }
  };

  const openCourse = (course: Item) => {
    if (!course.downloaded) {
      toast('حمّل الكورس أولًا للاطلاع على وحداته');
      return;
    }
    navigation.navigate('CourseDetail', { courseId: course.id, title: course.title });
  };

  const renderItem = useCallback(
    ({ item }: { item: Item }) => {
      const downloading = dlId === item.id;
      return (
        <TouchableOpacity activeOpacity={0.85} onPress={() => openCourse(item)}>
          <View style={courseCard.card}>
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <BookOpenCheck size={22} color={colors.burgundy} strokeWidth={2.2} />
              </View>
              <View style={styles.info}>
                <Text style={[styles.title, rtlTextStyle]}>{bidi(item.title)}</Text>
                <Text style={[styles.meta, rtlTextStyle]}>
                  {`${formatNumber(item.unitCount)} وحدات • ${formatNumber(item.questionCount)} سؤالًا`}
                </Text>
              </View>
            </View>
            <View style={styles.footer}>
              {item.downloaded ? (
                <Badge kind="offline" label="محمّل — يعمل أوفلاين" />
              ) : downloading ? (
                <View style={styles.dlRow}>
                  <View style={styles.track}>
                    <LinearGradient
                      colors={[...gradients.download]}
                      start={{ x: 1, y: 0 }}
                      end={{ x: 0, y: 0 }}
                      style={[styles.fill, { width: `${dlPct}%` }]}
                    />
                  </View>
                  <Text style={styles.pct}>{dlPct}%</Text>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => startDownload(item)}
                  style={styles.dlBtnWrap}>
                  <LinearGradient
                    colors={[...gradients.download]}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0, y: 0 }}
                    style={styles.dlBtn}>
                    <Download size={15} color={colors.card} />
                    <Text style={styles.dlText}>تحميل الكورس</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dlId, dlPct],
  );

  // هيكل التحميل يحاكي شكل البطاقات الفعلية — أنعم من مؤشر الدوران
  if (loading) return <SkeletonList count={4} render={() => <CourseCardSkeleton />} />;

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        {syncError ? (
          <WifiOff size={30} color={colors.burgundy} strokeWidth={1.8} />
        ) : (
          <BookOpenCheck size={30} color={colors.burgundy} strokeWidth={1.8} />
        )}
      </View>
      <Text style={styles.emptyTitle}>
        {syncError ? 'تعذر تحميل الكورسات' : 'لا توجد كورسات بعد'}
      </Text>
      <Text style={styles.emptyText}>
        {syncError ?? 'اسحب للتحديث عند توفر اتصال بالإنترنت'}
      </Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.85}>
        <RefreshCw size={16} color={colors.card} strokeWidth={2.4} />
        <Text style={styles.retryText}>إعادة المحاولة</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <FlatList
      data={items}
      keyExtractor={i => i.id}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.burgundy]} />
      }
      ListHeaderComponent={
        syncError && items.length > 0 ? (
          <View style={styles.warnBanner}>
            <WifiOff size={15} color={colors.amberText} strokeWidth={2.2} />
            <Text style={styles.warnText}>{syncError}</Text>
            <TouchableOpacity onPress={onRetry} activeOpacity={0.7}>
              <Text style={styles.warnRetry}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : undefined
      }
      ListEmptyComponent={renderEmpty()}
      // الأداء: عناصر ثابتة الارتفاع تقريبًا
      removeClippedSubviews
      maxToRenderPerBatch={8}
      windowSize={7}
    />
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  list: { padding: 14, paddingBottom: 24, backgroundColor: colors.bg, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.skeletonBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, marginHorizontal: 10 },
  title: { fontFamily: 'tajawal', fontSize: 16, fontWeight: '700', color: colors.title, textAlign: 'right', writingDirection: 'rtl' },
  meta: { fontFamily: 'tajawal', fontSize: 12.5, color: colors.textSecondary, textAlign: 'right', writingDirection: 'rtl', marginTop: 2 },
  footer: { marginTop: 10 },
  dlBtnWrap: { alignSelf: 'flex-start' },
  dlBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 9 },
  dlText: { fontFamily: 'tajawal', fontSize: 13, fontWeight: '700', color: colors.card, marginEnd: 6 },
  dlRow: { flexDirection: 'row', alignItems: 'center' },
  track: { flex: 1, height: 8, backgroundColor: colors.segBg, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  pct: { fontFamily: 'tajawal', fontSize: 12, fontWeight: '700', color: colors.success, marginEnd: 8, minWidth: 38, textAlign: 'right' },
  // حالة الفراغ + زر إعادة المحاولة
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.skeletonBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: 'tajawal',
    fontSize: 17,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: 'tajawal',
    fontSize: 13.5,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.burgundy,
    borderRadius: radius.md,
    paddingHorizontal: 22,
    paddingVertical: 12,
    ...shadows.card,
  },
  retryText: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.card,
    marginEnd: 8,
  },
  // شريط تحذير المزامنة أعلى القائمة عند وجود عناصر محلية
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.amberBg,
    borderWidth: 1,
    borderColor: colors.explainBorder,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  warnText: {
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 12.5,
    fontWeight: '400',
    color: colors.amberText,
    textAlign: 'right',
    marginHorizontal: 8,
    writingDirection: 'rtl',
  },
  warnRetry: {
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.burgundy,
  },
});
