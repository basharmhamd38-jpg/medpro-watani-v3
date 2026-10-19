// هياكل التحميل (Skeletons) — نبض خفيف بمحرك أصلي على الشفافية فقط (صفر تهنيج)
// تُستخدم بدل مؤشرات التحميل الباهتة في الشاشات الرئيسية
import React, { useEffect, useRef , useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../theme';

function usePulse(): Animated.Value {
  const opacity = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 750, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return opacity;
}

export function SkeletonBlock({
  width,
  height,
  borderRadius = 8,
  style,
}: {
  width?: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const opacity = usePulse();
  return (
    <Animated.View
      style={[styles.block, { opacity, width: width as any, height, borderRadius }, style]}
    />
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  block: { backgroundColor: colors.skeletonBg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
    ...shadows.card,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.skeletonBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  col: { flex: 1, marginHorizontal: 10, gap: 7 },
  numBadge: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.skeletonBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { padding: 14, paddingBottom: 24 },
  footBlock: { marginTop: 12 },
  optCard: { borderRadius: 14, padding: 13, marginBottom: 9 },
  optCol: { marginHorizontal: 0, marginEnd: 10 },
  topicRowCard: {
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  topicCol: { marginHorizontal: 0 },
  gapTop6: { marginTop: 6 },
  gapTop8: { marginTop: 8 },
  gapTop10: { marginTop: 10 },
  gapTop18: { marginTop: 18 },
  qCardPad: { borderRadius: 18, padding: 16, marginBottom: 12 },
});

// هيكل بطاقة كورس — يطابق CoursesListScreen
export function CourseCardSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <SkeletonBlock width={22} height={22} borderRadius={6} />
        </View>
        <View style={styles.col}>
          <SkeletonBlock width="75%" height={16} />
          <SkeletonBlock width="45%" height={12} />
        </View>
      </View>
      <SkeletonBlock width={120} height={30} borderRadius={radius.md} style={styles.footBlock} />
    </View>
  );
}

// هيكل صف وحدة — يطابق CourseDetailScreen
export function UnitRowSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.numBadge}>
          <SkeletonBlock width={18} height={18} borderRadius={6} />
        </View>
        <View style={styles.col}>
          <SkeletonBlock width="85%" height={15} />
          <SkeletonBlock width="55%" height={12} />
        </View>
        <SkeletonBlock width={64} height={24} borderRadius={999} />
      </View>
      <SkeletonBlock width="100%" height={8} borderRadius={999} style={styles.footBlock} />
    </View>
  );
}

// هيكل شاشة سؤال — يطابق CourseQuestionScreen / بنك الأسئلة
export function QuestionSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.list}>
      <View style={[styles.card, styles.qCardPad]}>
        <SkeletonBlock width="100%" height={15} />
        <SkeletonBlock width="92%" height={15} style={styles.gapTop8} />
        <SkeletonBlock width="60%" height={15} style={styles.gapTop8} />
      </View>
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={[styles.card, styles.optCard]}>
          <View style={styles.row}>
            <SkeletonBlock width={30} height={30} borderRadius={10} />
            <View style={[styles.col, styles.optCol]}>
              <SkeletonBlock width="85%" height={14} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// هيكل صف موضوع — يطابق SubjectTopicsScreen
export function TopicRowSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={[styles.card, styles.topicRowCard]}>
      <View style={styles.row}>
        <View style={[styles.col, styles.topicCol]}>
          <SkeletonBlock width="70%" height={14} />
          <SkeletonBlock width="35%" height={11} style={styles.gapTop6} />
        </View>
        <SkeletonBlock width={18} height={18} borderRadius={9} />
      </View>
    </View>
  );
}

// هيكل صفحة الخلاصة — أسطر نصية بعرض متفاوت تحاكي المتن
export function SummarySkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.list}>
      <SkeletonBlock width="55%" height={20} borderRadius={10} />
      {[90, 100, 95, 70, 100, 88, 60].map((w, i) => (
        <SkeletonBlock key={i} width={`${w}%`} height={14} style={styles.gapTop10} />
      ))}
      <SkeletonBlock width="45%" height={20} borderRadius={10} style={styles.gapTop18} />
      {[100, 92, 75].map((w, i) => (
        <SkeletonBlock key={`b-${i}`} width={`${w}%`} height={14} style={styles.gapTop10} />
      ))}
    </View>
  );
}

// قائمة هياكل جاهزة بعدد قابل للتخصيص
export function SkeletonList({
  count = 4,
  render,
}: {
  count?: number;
  render: () => React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <React.Fragment key={i}>{render()}</React.Fragment>
      ))}
    </View>
  );
}
