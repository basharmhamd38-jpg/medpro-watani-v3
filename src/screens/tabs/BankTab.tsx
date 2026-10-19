// بنك الأسئلة — التبويب الافتراضي (مجاني/مفتوح)
// المحتوى الحقيقي من فريق البنك — يُمرَّر له تنقل الدرج (SubjectDetail/Question)
import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import AppHeader from '../../components/AppHeader';
import BankScreen from '../bank/BankScreen';
import { useTheme, type ThemeColors } from '../../theme';
import type { DrawerParamList } from '../../navigation/types';

export default function BankTab() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const navigation = useNavigation();
  const drawer =
    (navigation.getParent() as
      | DrawerNavigationProp<DrawerParamList>
      | undefined) ?? (navigation as unknown as DrawerNavigationProp<DrawerParamList>);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <BankScreen navigation={drawer} />
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
