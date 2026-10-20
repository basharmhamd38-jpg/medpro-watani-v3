// محتوى الدرج — بأسلوب درج الموقع الحي:
// خلفية #FBF3F4، ترويسة ب أفاتار دائري، عناصر rounded-xl والنشط عنابي مصمت
import React, { useState , useMemo } from 'react';
import { ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from './AppText';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { DrawerActions } from '@react-navigation/native';
import {
  AlarmClock,
  Award,
  Bell,
  Compass,
  Database,
  FileText,
  Globe,
  GraduationCap,
  Heart,
  Key,
  Layers,
  LogOut,
  MessageCircle,
  Moon,
  RefreshCw,
  Search,
  Stethoscope,
  StickyNote,
  Sun,
  Target,
  Timer,
  TrendingDown,
  User,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import BackupModal from './BackupModal';
import { haptics } from '../utils/haptics';
import { APP_VERSION } from '../version';
import { getAuth, setAuth, signOutGoogle, signOut } from '../auth/auth';
import { APP } from '../config';
import { useTheme, type ThemeColors } from '../theme';
import type { DrawerParamList } from '../navigation/types';
import type { TabParamList } from '../navigation/types';

type DrawerTarget = keyof DrawerParamList;
type TabTarget = keyof TabParamList;

interface DrawerItem {
  key: string;
  label: string;
  sub?: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  target?: DrawerTarget;
  tabTarget?: TabTarget;
  tabParams?: Record<string, any>;
}

const ITEMS: DrawerItem[] = [
  {
    key: 'profile',
    label: 'الملف الشخصي',
    sub: 'الجامعة، السنة الدراسية، الصورة',
    icon: User,
    target: 'Profile',
  },
  {
    key: 'activation',
    label: 'الاشتراك وتفعيل الحساب',
    icon: Key,
    target: 'Activation',
  },
  // نُقلت من الشريط السفلي — شاشات درج الآن (UI1)
  {
    key: 'courses',
    label: 'الكورسات',
    sub: 'دروس منهجية + أسئلة متدرجة',
    icon: GraduationCap,
    target: 'CoursesTab',
  },
  {
    key: 'challenge',
    label: 'التحدي اليومي',
    sub: '10 أسئلة • مكافأة XP يومية',
    icon: Target,
    target: 'ChallengeTab',
  },
  {
    key: 'flashcards',
    label: 'البطاقات',
    sub: 'مراجعة ذكية للبطاقات',
    icon: Layers,
    target: 'FlashcardsTab',
  },
  {
    key: 'guide',
    label: 'دليل الدراسة',
    sub: 'أدلة المواد الدراسية',
    icon: Compass,
    target: 'GuideTab',
  },
  {
    key: 'errors',
    label: 'سجل أخطائي والاختبارات',
    icon: FileText,
    tabTarget: 'ProgressTab',
    tabParams: { initialSubTab: 'tests' },
  },
  {
    key: 'anki',
    label: 'المراجعة الذكية Anki',
    icon: RefreshCw,
    tabTarget: 'ProgressTab',
    tabParams: { initialSubTab: 'sr' },
  },
  {
    key: 'mockexam',
    label: 'محاكاة الامتحان',
    sub: 'مؤقت صارم • بلا كشف فوري',
    icon: Timer,
    target: 'MockExam',
  },
  {
    key: 'virtualpatient',
    label: 'المريض الافتراضي',
    sub: 'حالات سريرية تفاعلية • تعمل بلا إنترنت',
    icon: Stethoscope,
    tabTarget: 'VirtualPatientTab',
  },
  {
    key: 'weakpoints',
    label: 'نقاط الضعف',
    sub: 'دقتك لكل مادة — ركّز على الأضعف',
    icon: TrendingDown,
    target: 'WeakPoints',
  },
  {
    key: 'pomodoro',
    label: 'مؤقت التركيز',
    sub: 'بومودورو 25/5 مع إحصائيات',
    icon: AlarmClock,
    target: 'Pomodoro',
  },
  {
    key: 'badges',
    label: 'الإنجازات والأوسمة',
    sub: 'شاراتك وإنجازاتك الدراسية',
    icon: Award,
    target: 'Badges',
  },
  {
    key: 'search',
    label: 'البحث الشامل',
    sub: 'بطاقات • دليل الدراسة • المواد',
    icon: Search,
    target: 'Search',
  },
  {
    key: 'favorites',
    label: 'المفضلة',
    sub: 'أسئلتك المحفوظة للمراجعة',
    icon: Heart,
    target: 'Favorites',
  },
  {
    key: 'notes',
    label: 'ملاحظاتي',
    sub: 'ملاحظاتك الشخصية على الأسئلة',
    icon: StickyNote,
    target: 'Notes',
  },
  {
    key: 'notifications',
    label: 'إعدادات وسجل الإشعارات',
    sub: 'التذكير اليومي 09:00 دمشق',
    icon: Bell,
    target: 'Notifications',
  },
  {
    key: 'privacy',
    label: 'الخصوصية والشروط',
    icon: FileText,
    target: 'Privacy',
  },
  {
    key: 'contact',
    label: 'التواصل مع الإدارة',
    icon: MessageCircle,
    target: 'Contact',
  },
  {
    key: 'follow',
    label: 'روابط التواصل',
    sub: 'تيليجرام • فيسبوك • إنستغرام • يوتيوب',
    icon: Globe,
    target: 'SocialLinks',
  },
];

// تجميع الدرج بأقسام (UI4) — RTL صحيح عبر textAlign:right
interface DrawerSection {
  title: string;
  keys: string[];
}

const SECTIONS: DrawerSection[] = [
  { title: 'حسابي', keys: ['profile', 'activation'] },
  {
    title: 'أدوات الدراسة',
    keys: [
      'courses',
      'challenge',
      'flashcards',
      'guide',
      'errors',
      'anki',
      'mockexam',
      'virtualpatient',
      'weakpoints',
      'pomodoro',
      'badges',
      'search',
      'favorites',
      'notes',
    ],
  },
  { title: 'التطبيق', keys: ['notifications', 'privacy', 'contact', 'follow'] },
];

const ITEM_BY_KEY: Record<string, DrawerItem> = Object.fromEntries(
  ITEMS.map(item => [item.key, item]),
);

export default function DrawerContent(props: DrawerContentComponentProps) {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { navigation } = props;
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const auth = getAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [showBackup, setShowBackup] = useState(false);

  // الاسم المعروض — احتياطي عند الاسم الفارغ حتى لا يظهر «د. undefined»
  const userName =
    auth.type === 'user' && typeof auth.name === 'string' ? auth.name.trim() : '';
  const displayName = userName ? `د. ${userName}` : 'د. زائر';
  const displaySub =
    auth.type === 'user' ? auth.email : 'جامعة دمشق — حساب ضيف';
  const avatarLetter =
    (userName || 'زائر').replace(/^د\.\s*/, '').charAt(0) || 'ز';

  const closeDrawer = () => navigation.dispatch(DrawerActions.closeDrawer());

  const onItemPress = (item: DrawerItem) => {
    if (item.tabTarget) {
      closeDrawer();
      navigation.navigate('Tabs', {
        screen: item.tabTarget,
        params: item.tabParams,
      } as never);
      return;
    }
    if (item.target) {
      closeDrawer();
      navigation.navigate(item.target);
      return;
    }
    toast(`«${item.label}» — قيد البناء في المرحلة القادمة`);
  };

  const onLogout = () => {
    haptics.warn();
    setConfirmLogout(true);
  };

  const doLogout = async () => {
    setConfirmLogout(false);
    closeDrawer();
    // الخروج من حساب Google فعليًا ثم العودة لشاشة الترحيب —
    // المستخدم يختار: الدخول عبر Google أو الدخول كزائر
    await signOutGoogle();
    signOut();
    try {
      const { setCrashUser } = require('../utils/crashReporting');
      setCrashUser();
    } catch { /* تجاهل */ }
    toast('تم تسجيل الخروج');
  };

  const renderItem = (item: DrawerItem) => {
    const Icon = item.icon;
    const isActive =
      item.target !== undefined &&
      props.state.routeNames[props.state.index] === item.target;
    const fg = isActive ? colors.white : colors.burgundy;
    return (
      <TouchableOpacity
        key={item.key}
        style={[styles.item, isActive && styles.itemActive]}
        activeOpacity={0.8}
        onPress={() => onItemPress(item)}>
        <View style={styles.itemTextWrap}>
          <Text style={[styles.itemLabel, isActive && styles.itemLabelActive]}>
            {item.label}
          </Text>
          {item.sub ? (
            <Text
              style={[styles.itemSub, isActive && styles.itemSubActive]}>
              {item.sub}
            </Text>
          ) : null}
        </View>
        <Icon size={18} color={fg} strokeWidth={2.2} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]}>
      {/* الترويسة: أفاتار + الاسم + زر إغلاق */}
      <View style={styles.header}>
        <View style={styles.idRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <View style={styles.idText}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {displaySub}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.closeBtn}
          activeOpacity={0.7}
          onPress={closeDrawer}
          accessibilityLabel="إغلاق القائمة">
          <X size={20} color={colors.burgundy} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}>
        {SECTIONS.map((section, sIdx) => (
          <View key={section.title}>
            <Text style={[styles.sectionTitle, sIdx === 0 && styles.sectionTitleFirst]}>
              {section.title}
            </Text>
            {section.keys.map(key => {
              const item = ITEM_BY_KEY[key];
              return item ? renderItem(item) : null;
            })}
          </View>
        ))}

        {/* تسجيل الخروج — بأسلوب الموقع */}
        <TouchableOpacity
          style={styles.logout}
          activeOpacity={0.8}
          onPress={onLogout}>
          <View style={styles.logoutInner}>
            <Text style={styles.logoutLabel}>تسجيل الخروج</Text>
            <LogOut size={18} color={colors.rose} strokeWidth={2.2} />
          </View>
          <Text style={styles.logoutPill}>إنهاء الجلسة</Text>
        </TouchableOpacity>

        {/* الوضع الليلي */}
        <View style={styles.themeRow}>
          <View style={styles.logoutInner}>
            {isDark ? (
              <Moon size={18} color={colors.burgundy} strokeWidth={2.2} />
            ) : (
              <Sun size={18} color={colors.burgundy} strokeWidth={2.2} />
            )}
            <Text style={styles.logoutLabel}>الوضع الليلي</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.segBg, true: colors.burgundy }}
            thumbColor={isDark ? colors.white : colors.textMuted}
            accessibilityLabel="تبديل الوضع الليلي"
          />
        </View>

        {/* النسخ الاحتياطي */}
        <TouchableOpacity
          style={styles.themeRow}
          activeOpacity={0.8}
          onPress={() => setShowBackup(true)}>
          <View style={styles.logoutInner}>
            <Database size={18} color={colors.burgundy} strokeWidth={2.2} />
            <Text style={styles.logoutLabel}>النسخ الاحتياطي</Text>
          </View>
          <Text style={styles.backupPill}>حفظ / استعادة</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* التذييل */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Text style={styles.footerText}>Med pro - وطني • الإصدار {APP_VERSION}</Text>
      </View>

      <ConfirmDialog
        visible={confirmLogout}
        title="تسجيل الخروج؟"
        message="سيتم إنهاء جلستك الحالية — يمكنك تسجيل الدخول مجددًا في أي وقت"
        confirmLabel="تسجيل الخروج"
        onConfirm={doLogout}
        onCancel={() => setConfirmLogout(false)}
      />

      <BackupModal visible={showBackup} onClose={() => setShowBackup(false)} />
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderBurgundy,
    backgroundColor: colors.cardGlassHeader,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'tajawal',
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  idText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: 'tajawal',
    color: colors.burgundy,
    fontSize: 14,
    fontWeight: '700',
  },
  sub: {
    fontFamily: 'tajawal',
    color: colors.burgundyLight,
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
  },
  itemActive: {
    backgroundColor: colors.burgundy,
  },
  itemTextWrap: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  itemLabel: {
    fontFamily: 'tajawal',
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.text,
  },
  itemLabelActive: {
    color: colors.white,
  },
  itemSub: {
    fontFamily: 'tajawal',
    fontSize: 11,
    fontWeight: '400',
    color: colors.textMuted,
    marginTop: 2,
  },
  itemSubActive: {
    color: 'rgba(255,255,255,0.75)',
  },
  // عناوين أقسام الدرج (UI4) — بسيطة بألوان الثيم، RTL صحيح
  sectionTitle: {
    fontFamily: 'tajawal',
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.burgundy,
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 12,
  },
  sectionTitleFirst: {
    marginTop: 2,
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  logoutInner: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoutLabel: {
    fontFamily: 'tajawal',
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.error,
  },
  logoutPill: {
    fontFamily: 'tajawal',
    fontSize: 10,
    fontWeight: '400',
    color: colors.rose,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  backupPill: {
    fontFamily: 'tajawal',
    fontSize: 10,
    fontWeight: '400',
    color: colors.burgundy,
    backgroundColor: colors.burgundy + '14',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  footer: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderFaint,
    alignItems: 'center',
    backgroundColor: colors.cardGlassFooter,
  },
  footerText: {
    fontFamily: 'tajawal',
    fontSize: 11,
    fontWeight: '400',
    color: colors.textMuted,
  },
});
