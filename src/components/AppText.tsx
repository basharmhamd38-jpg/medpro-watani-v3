/**
 * AppText — بديل Text الافتراضي لكل التطبيق
 *
 * السبب: React 19 (مع RN 0.87) أزال دعم `defaultProps` لمكوّنات الدوال نهائيًا،
 * فصار `Text.defaultProps.style = [...]` في App.tsx بلا أي أثر (يُتجاهل بصمت).
 * هذا المكوّن يطبّق نفس النية صراحةً.
 *
 * وضع تشخيصي LTR: النصوص تبدأ من اليسار افتراضيًا (اختبار فرضية أن RTL
 * يسبب مشاكل التنسيق/التعليق). المحتوى العربي يبقى عربيًا كما هو.
 *
 * أي `textAlign` صريح يُمرَّر في `style` يتجاوزه (مثل 'right' أو 'center')
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
  ltrDefault: {
    textAlign: 'left',
    writingDirection: 'ltr',
    // الخط الموحد لكل التطبيق — يمنع رجوع النظام لخط افتراضي مختلف
    fontFamily: fontFamily.regular,
  },
});

export function AppText(props: TextProps) {
  const { style, ...rest } = props;
  return <RNText style={[styles.ltrDefault, style]} {...rest} />;
}

export function AppTextInput(props: TextInputProps) {
  const { style, ...rest } = props;
  return <RNTextInput style={[styles.ltrDefault, style]} {...rest} />;
}

export default AppText;
