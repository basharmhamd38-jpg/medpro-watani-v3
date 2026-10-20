/**
 * AppText — بديل Text الافتراضي لكل التطبيق
 *
 * السبب: React 19 (مع RN 0.87) أزال دعم `defaultProps` لمكوّنات الدوال نهائيًا،
 * فصار `Text.defaultProps.style = [...]` في App.tsx بلا أي أثر (يُتجاهل بصمت).
 * هذا المكوّن يطبّق نفس النية صراحةً.
 *
 * الطريقة الجديدة (RTL تلقائي): كل نص عربي يُحاذى لليمين افتراضيًا، واتجاه
 * الكتابة يُترك للنظام تلقائيًا (I18nManager RTL + bidi الخوارزمية الأصلية)
 * بدون أي writingDirection يدوي — هذا يمنع تفكك الحروف وانعكاس الترتيب.
 *
 * أي `textAlign` صريح يُمرَّر في `style` يتجاوزه (مثل 'center' للعناوين)
 * لأن style الممرَّر يأتي بعد الافتراضي.
 */
import React from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  StyleSheet,
  type TextProps,
  type TextInputProps,
} from 'react-native';
import { fontFamily } from '../theme';

const styles = StyleSheet.create({
  rtlDefault: {
    textAlign: 'right',
    // الخط الموحد لكل التطبيق — يمنع رجوع النظام لخط افتراضي مختلف
    fontFamily: fontFamily.regular,
  },
});

export function AppText(props: TextProps) {
  const { style, ...rest } = props;
  return <RNText style={[styles.rtlDefault, style]} {...rest} />;
}

export function AppTextInput(props: TextInputProps) {
  const { style, ...rest } = props;
  return <RNTextInput style={[styles.rtlDefault, style]} {...rest} />;
}

export default AppText;
