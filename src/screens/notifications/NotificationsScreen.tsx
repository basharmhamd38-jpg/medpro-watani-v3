// شاشة الإشعارات: التذكير اليومي + الإشعارات الذكية + صندوق الوارد
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { useFocusEffect } from '@react-navigation/native';
import { BellRing, Sparkles } from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { bidi } from '../../utils/bidi';
import { storage } from '../../auth/auth';
import {
  getSmartSettings,
  saveSmartSettings,
  getSmartInbox,
  REMINDER_TIMES,
  type SmartSettings,
  type SmartInboxItem,
} from '../../notifications/smart';

function Toggle({
  on,
  onPress,
}: {
  on: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={[styles.toggle, on ? styles.toggleOn : styles.toggleOff]}
      activeOpacity={0.8}
      onPress={onPress}>
      <View style={[styles.knob, on ? styles.knobOn : styles.knobOff]} />
    </TouchableOpacity>
  );
}

const SMART_ROWS: {
  key: keyof Omit<SmartSettings, 'reminderTime'>;
  title: string;
  sub: string;
}[] = [
  {
    key: 'reviewReminder',
    title: 'تذكير المراجعات المستحقة',
    sub: 'تنبيه عند وجود أسئلة أو بطاقات بانتظار المراجعة',
  },
  {
    key: 'streakWarning',
    title: 'تحذير انقطاع السلسلة',
    sub: 'تنبيه مسائي عندما تكون سلسلة أيامك في خطر',
  },
  {
    key: 'achievementAlerts',
    title: 'تنبيهات الإنجازات',
    sub: 'إشعار عند فتح وسام جديد',
  },
  {
    key: 'weeklySummary',
    title: 'الملخص الأسبوعي',
    sub: 'ملخص إنجازك الدراسي كل يوم جمعة',
  },
];

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [reminderOn, setReminderOn] = useState<boolean>(
    storage.getBoolean('daily_reminder') ?? true,
  );
  const [smart, setSmart] = useState<SmartSettings | null>(null);
  const [inbox, setInbox] = useState<SmartInboxItem[]>([]);

  const load = useCallback(async () => {
    try {
      const [s, items] = await Promise.all([
        getSmartSettings(),
        getSmartInbox(),
      ]);
      setSmart(s);
      setInbox(items);
    } catch {
      // تجاهل
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggleReminder = () => {
    const v = !reminderOn;
    setReminderOn(v);
    storage.set('daily_reminder', v);
  };

  const toggleSmart = (key: keyof Omit<SmartSettings, 'reminderTime'>) => {
    if (!smart) return;
    const updated = { ...smart, [key]: !smart[key] };
    setSmart(updated);
    saveSmartSettings(updated).catch(() => {});
  };

  const setTime = (t: string) => {
    if (!smart) return;
    const updated = { ...smart, reminderTime: t };
    setSmart(updated);
    saveSmartSettings(updated).catch(() => {});
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{'الإشعارات'}</Text>

      {/* بطاقة التذكير اليومي (FCM) */}
      <View style={[styles.card, shadows.card]}>
        <View style={styles.reminderRow}>
          <View style={styles.iconBox}>
            <BellRing size={22} color={colors.burgundy} strokeWidth={2.2} />
          </View>
          <View style={styles.reminderTextCol}>
            <Text style={styles.reminderTitle}>{'التذكير اليومي'}</Text>
            <Text style={styles.reminderSub}>
              {bidi(`${smart?.reminderTime ?? '09:00'} بتوقيت دمشق`)}
            </Text>
          </View>
          <Toggle on={reminderOn} onPress={toggleReminder} />
        </View>

        {/* وقت التذكير المفضل */}
        <Text style={styles.timeLabel}>{'وقت التذكير المفضل'}</Text>
        <View style={styles.timeRow}>
          {REMINDER_TIMES.map((t) => {
            const active = smart?.reminderTime === t;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.timeChip, active && styles.timeChipActive]}
                activeOpacity={0.8}
                onPress={() => setTime(t)}>
                <Text
                  style={[
                    styles.timeChipText,
                    active && styles.timeChipTextActive,
                  ]}>
                  {t}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* الإشعارات الذكية */}
      <View style={styles.smartHeader}>
        <Sparkles size={18} color={colors.burgundy} />
        <Text style={styles.sectionTitle}>{'الإشعارات الذكية'}</Text>
      </View>
      <View style={[styles.list, shadows.card]}>
        {SMART_ROWS.map((row, i) => (
          <View
            key={row.key}
            style={[styles.row, i < SMART_ROWS.length - 1 && styles.rowBorder]}>
            <View style={styles.textCol}>
              <Text style={styles.rowTitle}>{bidi(row.title)}</Text>
              <Text style={styles.rowMeta}>{bidi(row.sub)}</Text>
            </View>
            <Toggle
              on={!!smart?.[row.key]}
              onPress={() => toggleSmart(row.key)}
            />
          </View>
        ))}
      </View>

      {/* صندوق الوارد */}
      <Text style={[styles.sectionTitle, styles.inboxTitle]}>
        {'صندوق الوارد'}
      </Text>
      <View style={[styles.list, shadows.card]}>
        {inbox.length === 0 ? (
          <View style={styles.row}>
            <View style={styles.textCol}>
              <Text style={styles.rowTitle}>
                {'لا توجد إشعارات بعد'}
              </Text>
              <Text style={styles.rowMeta}>
                {'ستظهر هنا التذكيرات الذكية والتنبيهات'}
              </Text>
            </View>
          </View>
        ) : (
          inbox.map((item, i) => (
            <View
              key={item.id}
              style={[styles.row, i < inbox.length - 1 && styles.rowBorder]}>
              <Text style={styles.rowIcon}>{item.icon}</Text>
              <View style={styles.textCol}>
                <Text style={styles.rowTitle}>{bidi(item.title)}</Text>
                {item.body ? (
                  <Text style={styles.rowMeta}>{bidi(item.body)}</Text>
                ) : null}
                <Text style={styles.rowMetaSmall}>{bidi(item.meta)}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontFamily: 'tajawal',
    fontSize: 19,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'left',
    writingDirection: 'ltr',
    marginBottom: 14,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 18,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#F9F0F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTextCol: {
    flex: 1,
    marginHorizontal: 12,
  },
  reminderTitle: {
    fontFamily: 'tajawal',
    fontSize: 15,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  reminderSub: {
    fontFamily: 'tajawal',
    fontSize: 12.5,
    color: colors.textSecondary,
    textAlign: 'left',
    writingDirection: 'ltr',
    marginTop: 2,
  },
  timeLabel: {
    fontFamily: 'tajawal',
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'left',
    writingDirection: 'ltr',
    marginTop: 14,
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  timeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginStart: 8,
    marginBottom: 8,
    backgroundColor: colors.bg,
  },
  timeChipActive: {
    backgroundColor: colors.burgundy,
    borderColor: colors.burgundy,
  },
  timeChipText: {
    fontFamily: 'tajawal',
    fontSize: 13,
    fontWeight: '700',
    color: colors.title,
  },
  timeChipTextActive: {
    color: colors.white,
  },
  toggle: {
    width: 52,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    padding: 3, // إزاحة داخلية محايدة الاتجاه بدل هوامش يدوية
  },
  toggleOn: {
    backgroundColor: colors.success,
  },
  toggleOff: {
    backgroundColor: colors.ghostBorder,
  },
  knob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  // منطقية RTL: flex-start = اليمين (إيقاف)، flex-end = اليسار (تشغيل)
  knobOn: {
    alignSelf: 'flex-end',
  },
  knobOff: {
    alignSelf: 'flex-start',
  },
  smartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'left',
    writingDirection: 'ltr',
    marginEnd: 6,
  },
  inboxTitle: {
    marginTop: 18,
    marginBottom: 10,
    marginEnd: 0,
  },
  list: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderFaint,
  },
  rowIcon: {
    fontSize: 22,
    marginStart: 12,
  },
  textCol: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rowMeta: {
    fontFamily: 'tajawal',
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'left',
    writingDirection: 'ltr',
    marginTop: 3,
  },
  rowMetaSmall: {
    fontFamily: 'tajawal',
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'left',
    writingDirection: 'ltr',
    marginTop: 2,
    opacity: 0.8,
  },
});
