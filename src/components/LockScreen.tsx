// شاشة القفل — مطابقة لبطاقة LockedSectionCard في الموقع الحي:
// بطاقة بيضاء + أيقونة قفل في مربع + عنوان ثابت + زر عنابي مصمت مع ✨
import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from './AppText';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { Lock, Sparkles } from 'lucide-react-native';
import { shadows, useTheme, type ThemeColors } from '../theme';
import type { DrawerParamList } from '../navigation/types';

export default function LockScreen({ message }: { message: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const navigation = useNavigation();

  const openActivation = () => {
    const drawer = navigation.getParent() as
      | DrawerNavigationProp<DrawerParamList>
      | undefined;
    drawer?.navigate('Activation');
  };

  return (
    <View style={[styles.card, shadows.card]}>
      <View style={styles.iconBox}>
        <Lock size={32} color={colors.burgundy} strokeWidth={2.2} />
      </View>
      <Text style={styles.title}>هذا القسم يتطلب تفعيل الحساب</Text>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity
        style={styles.btn}
        activeOpacity={0.85}
        onPress={openActivation}>
        <Sparkles size={16} color={colors.gold} />
        <Text style={styles.btnText}>فعّل حسابك الآن (رفع إيصال الدفع)</Text>
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    padding: 24,
    alignItems: 'center',
    marginVertical: 16,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(122,31,43,0.1)',
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'tajawal',
    fontSize: 20,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '400',
    color: colors.burgundyLight,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.burgundy,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
  },
  btnText: {
    fontFamily: 'tajawal',
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
});
