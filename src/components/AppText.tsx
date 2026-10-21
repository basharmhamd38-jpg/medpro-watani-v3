/**
 * AppText — بديل Text الافتراضي لكل التطبيق
 *
 * السبب: React 19 (مع RN 0.87) أزال دعم `defaultProps` لمكوّنات الدوال نهائيًا،
 * فصار `Text.defaultProps.style = [...]` في App.tsx بلا أي أثر (يُتجاهل بصمت).
 * هذا المكوّن يطبّق نفس النية صراحةً.
 *
 * الطريقة: كل نص يُحاذى لليمين افتراضيًا واتجاه فقرته الأساسي مفروض RTL
 * صراحةً (writingDirection) — لا «تلقائيًا»: الوضع التلقائي يحسم الاتجاه
 * بأول حرف قوي فينعكس أي نص يبدأ برقم/لاتيني (أعمار، جرعات، مصطلحات)، وهو
 * ما ظهر فعليًا للمستخدم «اتجاه عكسي» بكل الصفحات (إصلاح 21 أكتوبر 2026).
 * تشكيل الحروف العربية نفسه يتولاه محرك النظام ولا يتأثر باتجاه الفقرة.
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
    // اتجاه الفقرة الأساسي مفروض RTL — يمنع انعكاس النصوص بادئة الأرقام/اللاتيني
    writingDirection: 'rtl',
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
