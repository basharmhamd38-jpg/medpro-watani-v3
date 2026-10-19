// الترويسة العلوية — مطابقة لترويسة الموقع الحي
// تدرج عنابي + زر قائمة أبيض + الاسم أبيض + رقاقة الإحصائيات + زر الجرس الأبيض
import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from './AppText';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import LinearGradient from 'react-native-linear-gradient';
import { Bell, Flame, Menu, Search, Zap } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gradients, useTheme, type ThemeColors } from '../theme';
import { formatNumber } from '../utils/numbers';
import { getProfile } from '../gamification/profile';
import type { DrawerParamList } from '../navigation/types';

export default function AppHeader() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const navigation = useNavigation<DrawerNavigationProp<DrawerParamList>>();
  const insets = useSafeAreaInsets();
  // إحصائيات حقيقية من ملف اللاعب المحلي (كانت قيمًا ثابتة: 0/0/المستوى 1)
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);

  useEffect(() => {
    let alive = true;
    getProfile()
      .then(p => {
        if (!alive) return;
        setStreak(p.currentStreak);
        setXp(p.totalXP);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const openLeaderboard = () => {
    // مطابقة للموقع: الرقاقة تنقل لشاشة الصدارة
    navigation.navigate('Tabs', { screen: 'LeaderboardTab' } as never);
  };

  return (
    <LinearGradient
      colors={[...gradients.header]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.bg, { paddingTop: insets.top + 6 }]}>
      <View style={styles.row}>
        <View style={styles.start}>
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.7}
            onPress={() => navigation.openDrawer()}
            accessibilityLabel="فتح القائمة">
            <Menu size={22} color={colors.white} strokeWidth={2.2} />
          </TouchableOpacity>
          <Image
            source={require('../../assets/app-icon.jpg')}
            style={styles.appIcon}
            resizeMode="cover"
          />
        </View>

        <View style={styles.end}>
          <TouchableOpacity
            style={styles.statsPill}
            activeOpacity={0.8}
            onPress={openLeaderboard}
            accessibilityLabel="الإحصائيات والصدارة">
            <View style={styles.statItem}>
              <Flame size={13} color={colors.gold} strokeWidth={2.5} />
              <Text style={styles.statText}>{formatNumber(streak)}</Text>
            </View>
            <Text style={styles.divider}>|</Text>
            <View style={styles.statItem}>
              <Zap size={13} color={colors.gold} strokeWidth={2.5} />
              <Text style={styles.statText}>{formatNumber(xp)}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Search')}
            accessibilityLabel="البحث الشامل">
            <Search size={20} color={colors.white} strokeWidth={2.2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Notifications')}
            accessibilityLabel="الإشعارات">
            <Bell size={20} color={colors.white} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  bg: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  start: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  end: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    marginStart: 4,
  },
  title: {
    fontFamily: 'tajawal',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'right',
  },
  statsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  statText: {
    fontFamily: 'tajawal',
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  divider: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
});
