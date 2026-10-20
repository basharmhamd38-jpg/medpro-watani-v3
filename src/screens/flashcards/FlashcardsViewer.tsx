// عارض البطاقات — حاليًا «قريبًا»: لا توجد بيانات بطاقات حقيقية بعد،
// ولا يُعرض أي محتوى تجريبي وهمي (قرار الدكتور).
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { Layers } from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';

interface Props {
  navigation: { goBack: () => void };
}

export default function FlashcardsViewer({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* صف الرجوع */}
      <View style={styles.backRow}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backGlyph}>›</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>عارض البطاقات</Text>
      </View>

      {/* حالة «قريبًا» — بدل البيانات التجريبية الوهمية */}
      <View style={[styles.soonCard, shadows.card]}>
        <View style={styles.iconBox}>
          <Layers size={44} color={colors.burgundy} strokeWidth={2.2} />
        </View>
        <Text style={styles.soonTitle}>بنك البطاقات قيد التجهيز</Text>
        <Text style={styles.soonText}>
          نعمل على تجهيز البطاقات التعليمية من بنوك الأسئلة الحقيقية.{'\n'}
          ستتوفر هنا فور اكتمالها — تابعنا.
        </Text>
        <TouchableOpacity
          style={styles.backCta}
          activeOpacity={0.8}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backCtaText}>رجوع إلى البطاقات</Text>
        </TouchableOpacity>
      </View>
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
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    fontFamily: 'tajawal',
    fontSize: 22,
    fontWeight: '700',
    color: colors.burgundy,
    marginTop: -3,
  },
  screenTitle: {
    fontFamily: 'tajawal',
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'left',
    marginHorizontal: 10,
  },
  soonCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    padding: 28,
    alignItems: 'center',
    marginTop: 24,
  },
  iconBox: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  soonTitle: {
    fontFamily: 'tajawal',
    fontSize: 17,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'center',
    marginBottom: 10,
  },
  soonText: {
    fontFamily: 'tajawal',
    fontSize: 13.5,
    fontWeight: '400',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  backCta: {
    backgroundColor: colors.burgundy,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  backCtaText: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
});
