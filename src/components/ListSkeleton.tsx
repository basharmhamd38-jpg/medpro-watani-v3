// هيكل قائمة عام — صفوف بطاقات نابضة تُستخدم أثناء تحميل القوائم
// (الصدارة، نتائج البحث، حالات المريض الافتراضي...)
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../theme';
import { SkeletonBlock } from './Skeleton';

function RowSkeleton({ withBadge = false }: { withBadge?: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <SkeletonBlock width={22} height={22} borderRadius={6} />
        </View>
        <View style={styles.col}>
          <SkeletonBlock width="70%" height={15} />
          <SkeletonBlock width="45%" height={12} style={styles.mt6} />
        </View>
        {withBadge && <SkeletonBlock width={52} height={24} borderRadius={999} />}
      </View>
    </View>
  );
}

export default function ListSkeleton({
  count = 5,
  withBadge = false,
}: {
  count?: number;
  withBadge?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.wrap}>
      {Array.from({ length: count }, (_, i) => (
        <RowSkeleton key={i} withBadge={withBadge} />
      ))}
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { padding: 14, paddingBottom: 24 },
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
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 14,
      backgroundColor: colors.skeletonBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    col: { flex: 1, marginHorizontal: 10, gap: 7 },
    mt6: { marginTop: 6 },
  });
