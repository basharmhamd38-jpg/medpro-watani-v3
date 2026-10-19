// البطاقات — تبويب مستقل في الشريط السفلي (التنفيذ الحقيقي: 4,658 بطاقة)
// نُقل من داخل بنك الأسئلة إلى تبويب سفلي بأمر الدكتور
import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../../components/AppHeader';
import FlashCardsScreen from '../bank/FlashCardsScreen';
import { useTheme, type ThemeColors } from '../../theme';

export default function FlashcardsTab() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <FlashCardsScreen />
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
