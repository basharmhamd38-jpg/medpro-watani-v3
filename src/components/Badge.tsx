// الشارات — حسب مواصفة 10.4
// الاستخدام: <Badge kind="free" label="مجاني" />
// icon اختياري (مثل أيقونة wifi-off لشارة «يعمل أوفلاين» — مواصفة 6.7)
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { WifiOff } from 'lucide-react-native';
import { useTheme, type ThemeColors } from '../theme';

export type BadgeKind = 'free' | 'trial' | 'locked' | 'offline' | 'soon';

const getBadgeColors = (colors: ThemeColors): Record<BadgeKind, { bg: string; fg: string }> => ({
  free: { bg: colors.successBg, fg: colors.success }, // مجاني/FREE — أخضر
  trial: { bg: colors.amberBg, fg: colors.amberText }, // تجريبي — كهرماني
  locked: { bg: colors.optionSelectedBg, fg: colors.burgundy }, // مقفل — وردي
  offline: { bg: colors.successBg, fg: colors.success }, // يعمل أوفلاين — أخضر فاتح
  soon: { bg: colors.segBg, fg: colors.textSecondary }, // قيد التجهيز — رمادي دافئ
});

export default function Badge({
  kind,
  label,
  icon,
}: {
  kind: BadgeKind;
  label: string;
  icon?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const c = getBadgeColors(colors)[kind];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, icon ? styles.withIcon : null]}>
      {icon}
      <Text style={[styles.label, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
  },
  withIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontFamily: 'tajawal',
    fontSize: 10.5,
    fontWeight: '700',
  },
});

// شارة «يعمل أوفلاين» الموحدة — خضراء مع أيقونة wifi-off (مواصفة 6.7)
export function OfflineBadge({ label = 'يعمل أوفلاين' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <Badge
      kind="offline"
      label={label}
      icon={<WifiOff size={12} color={colors.success} strokeWidth={2.2} />}
    />
  );
}
