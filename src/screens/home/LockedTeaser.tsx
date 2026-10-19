// بطاقة «محتويات هذا القسم» التشويقية + شاشة القفل — مشتركة للتبويبات المقفلة
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { Lock } from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import LockScreen from '../../components/LockScreen';

export interface TeaserItem {
  name: string;
  desc: string;
}

interface Props {
  title: string;
  message: string;
  items: TeaserItem[];
  /** محتوى إضافي يُعرض أعلى البطاقة التشويقية داخل نفس التمرير (اختياري) */
  header?: React.ReactNode;
}

export default function LockedTeaser({ title, message, items, header }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {header}
      {/* بطاقة المعاينة التشويقية */}
      <View style={[styles.card, shadows.card]}>
        <Text style={styles.cardTitle}>محتويات هذا القسم</Text>
        {items.map((item, i) => (
          <View
            key={item.name}
            style={[styles.row, i === items.length - 1 && styles.rowLast]}>
            <View style={styles.textCol}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowDesc}>{item.desc}</Text>
            </View>
            <Lock size={16} color="#C0A3A8" strokeWidth={2.2} />
          </View>
        ))}
      </View>

      {/* شاشة القفل */}
      <LockScreen message={`${title} — ${message}`} />
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    direction: 'rtl',
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 18,
  },
  cardTitle: {
    fontFamily: 'tajawal',
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'right',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderFaint,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  textCol: {
    flex: 1,
    marginStart: 10,
  },
  rowName: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'right',
  },
  rowDesc: {
    fontFamily: 'tajawal',
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 2,
  },
});
