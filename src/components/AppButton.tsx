// AppButton — زر موحّد لكل التطبيق (UI2)
// مبني على Pressable (وليس TouchableOpacity):
// تغذية ضغط مرئية (scale 0.97) + اهتزاز خفيف + حالات موحدة.
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { AppText as Text } from './AppText';
import { radius, useTheme } from '../theme';
import { haptics } from '../utils/haptics';

export type AppButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface AppButtonProps {
  /** نص الزر */
  title: string;
  /** يُستدعى عند الضغط (بعد الاهتزاز) */
  onPress: () => void;
  /** المظهر: primary (عنابي) | secondary (إطار عنابي) | ghost (نص باهت) */
  variant?: AppButtonVariant;
  /** معطّل: شفافية منخفضة وبلا اهتزاز وبلا onPress */
  disabled?: boolean;
  /** تحميل: مؤشر دوّار بدل الأيقونة، ويُعطّل الزر */
  loading?: boolean;
  /** أيقونة اختيارية بجانب النص */
  icon?: React.ReactNode;
  /** تنسيق إضافي يُطبَّق فوق الافتراضي (مثل flex أو margin) */
  style?: StyleProp<ViewStyle>;
  /** للاختبارات */
  testID?: string;
}

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  style,
  testID,
}: AppButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(), []);
  const inactive = disabled || loading;

  const handlePress = useCallback(() => {
    if (inactive) return;
    haptics.tap(); // اهتزاز خفيف بمعايير التطبيق (Vibration مدمجة)
    onPress();
  }, [inactive, onPress]);

  const textColor =
    variant === 'primary'
      ? colors.white
      : variant === 'secondary'
        ? colors.burgundy
        : colors.textMuted;

  return (
    <Pressable
      onPress={handlePress}
      disabled={inactive}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && { backgroundColor: colors.burgundy },
        variant === 'secondary' && {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: colors.burgundy,
        },
        variant === 'ghost' && { backgroundColor: 'transparent' },
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.title, { color: textColor }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

const getStyles = () =>
  StyleSheet.create({
    base: {
      flexDirection: 'row', // يُعكَس تلقائيًا في RTL — آمن للعربية
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: radius.md,
      paddingVertical: 13,
      paddingHorizontal: 20,
      minHeight: 48,
    },
    pressed: {
      transform: [{ scale: 0.97 }],
    },
    disabled: {
      opacity: 0.5,
    },
    title: {
      fontFamily: 'tajawal',
      fontSize: 14.5,
      fontWeight: '700',
      textAlign: 'center',
    },
  });

export default AppButton;
