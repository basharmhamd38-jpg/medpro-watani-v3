// التبويبات السفلية — شريط ثابت من 5 تبويبات (أمر الدكتور: بلا تمرير أفقي)
// الترتيب RTL من اليمين لليسار: الرئيسية، بنك الأسئلة، المريض الافتراضي، الصدارة، تقدمي.
// بنك الأسئلة هو الافتراضي.
// النشط #7A1F2B مع مؤشر سفلي، غير النشط #9CA3AF، والمقفل شارة كهرمانية.
// الضغط على تبويب مقفل (لغير المفعّلين): يُمنع الدخول ويُوجَّه المستخدم لشاشة التفعيل.
import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import {
  BookOpen,
  Home,
  Stethoscope,
  TrendingUp,
  Trophy,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { canAccessTab, type GateResult } from '../payment/gates';
import { useToast } from '../components/Toast';
import { useTheme, type ThemeColors } from '../theme';
import type { DrawerParamList, TabParamList } from './types';
import BankTab from '../screens/tabs/BankTab';
import HomeTab from '../screens/tabs/HomeTab';
import LeaderboardTab from '../screens/tabs/LeaderboardTab';
import ProgressTab from '../screens/tabs/ProgressTab';
import VirtualPatientTab from '../screens/tabs/VirtualPatientTab';

const Tab = createBottomTabNavigator<TabParamList>();

type TabKey = 'home' | 'bank' | 'leaderboard' | 'virtual' | 'progress';

interface TabDef {
  name: keyof TabParamList;
  tabKey: TabKey;
  label: string;
  icon: React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
  }>;
  component: React.ComponentType;
  renderIcon: (props: { focused: boolean; color: string }) => React.ReactNode;
}

function makeTabDef(def: Omit<TabDef, 'renderIcon'>): TabDef {
  return {
    ...def,
    renderIcon: ({ focused, color }) => (
      <TabIcon def={def} focused={focused} color={color} />
    ),
  };
}

// الترتيب من اليمين لليسار (RTL تلقائي عبر I18nManager.forceRTL)
const TABS: TabDef[] = [
  makeTabDef({ name: 'HomeTab', tabKey: 'home', label: 'الرئيسية', icon: Home, component: HomeTab }),
  makeTabDef({ name: 'BankTab', tabKey: 'bank', label: 'بنك الأسئلة', icon: BookOpen, component: BankTab }),
  makeTabDef({ name: 'VirtualPatientTab', tabKey: 'virtual', label: 'المريض الافتراضي', icon: Stethoscope, component: VirtualPatientTab }),
  makeTabDef({ name: 'LeaderboardTab', tabKey: 'leaderboard', label: 'الصدارة', icon: Trophy, component: LeaderboardTab }),
  makeTabDef({ name: 'ProgressTab', tabKey: 'progress', label: 'تقدمي', icon: TrendingUp, component: ProgressTab }),
];

const tabDefByName: Record<string, TabDef> = Object.fromEntries(
  TABS.map(def => [def.name, def]),
);

function TabIcon({
  def,
  focused,
  color,
}: {
  def: Pick<TabDef, 'icon' | 'tabKey'>;
  focused: boolean;
  color: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const Icon = def.icon;
  const locked = !canAccessTab(def.tabKey).open;
  return (
    <View style={styles.iconWrap}>
      <Icon size={23} color={color} strokeWidth={focused ? 2.5 : 2.1} />
      {locked ? (
        <View style={styles.lockBadge}>
          <Text style={styles.lockGlyph}>🔒</Text>
        </View>
      ) : null}
    </View>
  );
}

// شريط ثابت: 5 تبويبات بعرض متساوٍ — بلا تمرير أفقي
function FixedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const openActivation = () => {
    const drawer = navigation.getParent() as
      | DrawerNavigationProp<DrawerParamList>
      | undefined;
    drawer?.navigate('Activation');
  };

  return (
    <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      <View style={styles.barRow}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const color = focused ? colors.burgundy : colors.tabInactive;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : route.name;
          const def = tabDefByName[route.name];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (focused || event.defaultPrevented) {
              return;
            }
            // تبويب مقفل لغير المفعّلين: منع الدخول + رسالة التفعيل + توجيه لشاشة التفعيل
            const gate: GateResult = def
              ? canAccessTab(def.tabKey)
              : { open: true };
            if (!gate.open) {
              event.preventDefault();
              toast(gate.reason || 'هذا القسم يتطلب تفعيل الحساب');
              openActivation();
              return;
            }
            navigation.navigate(route.name);
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.65}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              style={styles.tab}>
              {options.tabBarIcon?.({ focused, color, size: 23 })}
              <Text
                style={[styles.label, focused && styles.labelActive]}
                numberOfLines={1}>
                {label}
              </Text>
              <View
                style={[
                  styles.indicator,
                  focused && styles.indicatorActive,
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="BankTab"
      tabBar={props => <FixedTabBar {...props} />}
      screenOptions={{ headerShown: false }}>
      {TABS.map(def => (
        <Tab.Screen
          key={def.name}
          name={def.name}
          component={def.component}
          options={{
            tabBarLabel: def.label,
            tabBarIcon: def.renderIcon,
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  barWrap: {
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(122,31,43,0.12)',
    paddingTop: 8,
  },
  barRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    alignItems: 'stretch',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 2,
    marginHorizontal: 1,
  },
  label: {
    fontFamily: 'tajawal',
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.tabInactive,
    textAlign: 'center',
    marginTop: 5,
  },
  labelActive: {
    color: colors.burgundy,
    fontWeight: '700',
  },
  indicator: {
    height: 3,
    width: 26,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginTop: 5,
  },
  indicatorActive: {
    backgroundColor: colors.burgundy,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // شارة القفل الكهرمانية فوق الأيقونة (أسلوب الموقع)
  lockBadge: {
    position: 'absolute',
    top: -4,
    end: -6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockGlyph: {
    fontSize: 8,
    lineHeight: 10,
  },
});
