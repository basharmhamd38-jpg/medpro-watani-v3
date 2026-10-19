// عناصر مشتركة لقسم «الكورسات» — ترويسة + شريط تقدم + شارة حالة
import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import LinearGradient from 'react-native-linear-gradient';
import { gradients, radius, shadows, useTheme, type ThemeColors } from '../../theme';
import type { UnitStatus } from '../../courses/types';

export function ScreenHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7} accessibilityLabel="رجوع">
        <Text style={styles.backGlyph}>›</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.rightSlot}>{right}</View>
    </View>
  );
}

export function ProgressBar({ pct, height = 8 }: { pct: number; height?: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={[styles.track, { height }]}>
      <LinearGradient
        colors={[...gradients.progress]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 0 }}
        style={[styles.fill, { width: `${Math.max(0, Math.min(100, Math.round(pct)))}%` }]}
      />
    </View>
  );
}

const STATUS_LABEL: Record<Exclude<UnitStatus, 'locked'>, string> = {
  not_started: 'لم تبدأ',
  in_progress: 'جارية',
  completed: 'مكتملة',
};

export function StatusChip({ status, pct }: { status: UnitStatus; pct?: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  if (status === 'locked')
    return (
      <View style={[styles.chip, styles.chipLocked]}>
        <Text style={[styles.chipText, styles.chipTextLocked]}>مقفل</Text>
      </View>
    );
  if (status === 'completed')
    return (
      <View style={[styles.chip, styles.chipDone]}>
        <Text style={[styles.chipText, styles.chipTextDone]}>مكتملة</Text>
      </View>
    );
  return (
    <View style={[styles.chip, styles.chipActive]}>
      <Text style={[styles.chipText, styles.chipTextActive]}>
        {status === 'in_progress' && pct !== undefined ? `${Math.round(pct)}%` : STATUS_LABEL[status]}
      </Text>
    </View>
  );
}

export function EmptyState({ text }: { text: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export const getCourseCard = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
    ...shadows.card,
  },
});

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderFaint,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
               fontFamily: 'tajawal', fontSize: 22, color: colors.burgundy, fontWeight: '700', marginTop: -2 },
  headerTitle: {
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 16.5,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  rightSlot: { width: 36, alignItems: 'flex-end' },
  track: {
    backgroundColor: colors.segBg,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 999 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  chipText: { fontFamily: 'tajawal', fontSize: 11, fontWeight: '700' },
  chipLocked: { backgroundColor: colors.segBg },
  chipTextLocked: { color: colors.textMuted },
  chipDone: { backgroundColor: colors.successBg },
  chipTextDone: { color: colors.success },
  chipActive: { backgroundColor: colors.skeletonBg },
  chipTextActive: { color: colors.burgundy },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontFamily: 'tajawal', fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 24 },
});
