export { colors, darkColors, gradients } from './colors';
export type { ThemeColors } from './colors';
export { ThemeProvider, useTheme } from './ThemeContext';
export type { ThemeMode } from './ThemeContext';

export const radius = {
  sm: 13,
  md: 16,
  lg: 18,
  xl: 24,
} as const;

// خطا tajawal وtajawal_bold فقط على أندرويد — أي وزن آخر يُزيَّف من النظام.
// لذلك تنهار مقاييس الأوزان إلى طبقتين حقيقيتين فقط:
// normal/400/500/600 →‏ '400' (tajawal العادي) • bold/700/800/900 →‏ '700' (tajawal_bold)
export const fontWeight = {
  normal: '400',
  regular: '400',
  medium: '400',
  semibold: '400',
  bold: '700',
  extrabold: '700',
  black: '700',
} as const;

// أسماء الخطوط المسجلة (android/app/src/main/assets/fonts)
export const fontFamily = {
  regular: 'tajawal',
  bold: 'tajawal_bold',
} as const;

// الأداء أولوية قصوى: ممنوع blur الثقيل على العناصر المتحركة
export const shadows = {
  card: {
    shadowColor: '#7A1F2B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;
