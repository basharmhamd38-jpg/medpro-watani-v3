// حالة الفراغ المصممة — أيقونة + عنوان + نص عربي لطيف + زر اختياري
import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from './AppText';
import type { LucideIcon } from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../theme';

export default function EmptyStateCard({
  icon: Icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.wrap}>
      <View style={styles.iconBadge}>
        <Icon size={30} color={colors.burgundy} strokeWidth={1.8} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.btn} activeOpacity={0.85} onPress={onAction}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingVertical: 64,
  },
  iconBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: colors.skeletonBg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontFamily: 'tajawal',
    fontSize: 17,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontFamily: 'tajawal',
    fontSize: 13.5,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 20,
  },
  btn: {
    backgroundColor: colors.burgundy,
    borderRadius: radius.md,
    paddingHorizontal: 26,
    paddingVertical: 12,
    ...shadows.card,
  },
  btnText: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.card,
  },
});
