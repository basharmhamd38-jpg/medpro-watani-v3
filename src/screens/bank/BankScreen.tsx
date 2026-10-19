// بنك الأسئلة — التبويب الافتراضي (مجاني/مفتوح)
// المحتوى الحقيقي من فريق البنك — يُمرَّر له تنقل الدرج (SubjectDetail/Question)
// ملاحظة: البطاقات ودليل الدراسة تبويبان مستقلان في الشريط السفلي (بأمر الدكتور)
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { useState, useMemo } from 'react';
import { Award, BookOpen, Building2, Globe, Stethoscope } from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import NationalSections from './NationalSections';
import Universities from './Universities';
import UWorldScreen from './UWorldScreen';
import ClinicalCasesScreen from './ClinicalCasesScreen';
import PracticeModelsScreen from './PracticeModelsScreen';

const TABS = [
  { label: 'دورات الوطني', icon: BookOpen },
  { label: 'دورات الجامعات', icon: Building2 },
  { label: 'أسئلة UWorld', icon: Globe },
  { label: 'حالات سريرية', icon: Stethoscope },
  { label: 'نماذج تدريبية', icon: Award },
];

// صفّان: 3 + 2 — النص كامل بلا قص (قرار الدكتور)
const ROWS = [TABS.slice(0, 3), TABS.slice(3)];

function TabButton({
  t,
  active,
  onPress,
}: {
  t: (typeof TABS)[number];
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const Icon = t.icon;
  const tint = active ? colors.white : colors.burgundy;
  return (
    <TouchableOpacity
      key={t.label}
      style={[styles.segBtn, active && styles.segBtnActive]}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}>
      <Text style={[styles.segText, active && styles.segTextActive]}>{t.label}</Text>
      <Icon size={16} color={tint} strokeWidth={2.2} />
    </TouchableOpacity>
  );
}

export default function BankScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [tab, setTab] = useState(0);

  return (
    <View style={styles.root}>
      <View style={styles.segWrap}>
        <View style={[styles.seg, shadows.card]}>
          {ROWS.map((row, ri) => (
            <View key={ri} style={styles.segRow}>
              {row.map(t => {
                const i = TABS.indexOf(t);
                return (
                  <TabButton
                    key={t.label}
                    t={t}
                    active={tab === i}
                    onPress={() => setTab(i)}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.body}>
        {tab === 0 && <NationalSections navigation={navigation} />}
        {tab === 1 && <Universities navigation={navigation} />}
        {tab === 2 && <UWorldScreen />}
        {tab === 3 && <ClinicalCasesScreen />}
        {tab === 4 && <PracticeModelsScreen />}
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  segWrap: { paddingHorizontal: 16, paddingTop: 12 },
  seg: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    padding: 6,
    gap: 6,
  },
  segRow: {
    flexDirection: 'row',
    gap: 4,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segBtnActive: {
    backgroundColor: colors.burgundy,
  },
  segText: {
    fontFamily: 'tajawal',
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'center',
    flexShrink: 1,
  },
  segTextActive: { color: colors.white },
  body: { flex: 1 },
});
