// دليل الدراسة — تبويب مستقل في الشريط السفلي (التنفيذ الحقيقي: 8 أقسام)
// نُقل من داخل بنك الأسئلة إلى تبويب سفلي بأمر الدكتور
import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../../components/AppHeader';
import StudyGuideScreen from '../bank/StudyGuideScreen';
import { useTheme, type ThemeColors } from '../../theme';

export default function GuideTab() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <StudyGuideScreen />
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
