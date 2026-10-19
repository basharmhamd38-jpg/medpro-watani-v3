// نافذة تأكيد قبل الإجراءات المهمة — بهوية التطبيق (عنابي/أبيض)، بلا blur ثقيل
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppModal } from './AppModal';
import { AppText as Text } from './AppText';
import AppButton from './AppButton';
import { AlertTriangle, CircleHelp } from 'lucide-react-native';
import { shadows, useTheme, type ThemeColors } from '../theme';

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'تراجع',
  danger = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <AppModal visible={visible} onClose={onCancel}>
        <View style={styles.card}>
          <View style={[styles.iconBadge, danger && styles.iconBadgeDanger]}>
            {danger ? (
              <AlertTriangle size={26} color={colors.error} strokeWidth={2} />
            ) : (
              <CircleHelp size={26} color={colors.burgundy} strokeWidth={2} />
            )}
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.row}>
            <AppButton
              title={confirmLabel}
              onPress={onConfirm}
              variant="primary"
              style={[styles.flex1, danger && { backgroundColor: colors.error }]}
            />
            <AppButton
              title={cancelLabel}
              onPress={onCancel}
              variant="secondary"
              style={styles.flex1}
            />
          </View>
        </View>
    </AppModal>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    ...shadows.card,
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: colors.skeletonBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconBadgeDanger: { backgroundColor: colors.errorBg },
  title: {
    fontFamily: 'tajawal',
    fontSize: 16.5,
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
  row: { flexDirection: 'row', gap: 10, width: '100%' },
  flex1: { flex: 1 },
});
