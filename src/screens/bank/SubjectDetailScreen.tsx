import { useEffect, useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import LinearGradient from 'react-native-linear-gradient';
import { Check } from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import Badge, { OfflineBadge } from '../../components/Badge';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import { isOfflineReady } from '../../sync/offlineSync';

// شاشة تفاصيل المادة/الدورة (المواصفة 6.7)
// route.params: { subjectId, title, kind, sessionLabel? }
export default function SubjectDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const { colors, primaryGradient } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { subjectId, title, sessionLabel } = route?.params ?? {};

  // الحالة الحقيقية: التحميل الكامل يتم مرة واحدة عند أول تشغيل (أوفلاين-أول) —
  // لا زر تحميل ولا محاكاة هنا؛ الشاشة تعرض الشارة فقط عند اكتمال التحميل.
  const [offlineReady, setOfflineReady] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    isOfflineReady()
      .then(v => {
        if (alive) setOfflineReady(v);
      })
      .catch(() => {
        if (alive) setOfflineReady(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const startPractice = () => {
    navigation.navigate('Question', { subjectId, title });
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backGlyph}>›</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, rtlTextStyle]} numberOfLines={1}>
          {bidi(title ?? 'تفاصيل المادة')}
        </Text>
        <OfflineBadge />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={[styles.name, rtlTextStyle]}>{bidi(title ?? '')}</Text>
          <Text style={styles.desc}>{sessionLabel ? `${sessionLabel} • أسئلة + شروحات` : 'أسئلة + شروحات'}</Text>
        </View>

        <View style={styles.dlZone}>
          {offlineReady ? (
            <View style={styles.doneWrap}>
              <Badge kind="offline" label="✓ تم التحميل — يعمل أوفلاين" />
              <Text style={styles.doneNote}>يمكنك الآن حل الأسئلة بلا إنترنت</Text>
            </View>
          ) : (
            <Text style={styles.pendingNote}>
              يُحمَّل بنك الأسئلة تلقائيًا عند أول تشغيل للتطبيق
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>محتويات التحميل</Text>
          <View style={styles.contentRow}>
            <Text style={[styles.contentName, rtlTextStyle]}>{bidi(sessionLabel ?? title ?? '')}</Text>
            {offlineReady === true ? (
              <View style={styles.donePill}>
                <Check size={13} color={colors.success} />
                <Text style={styles.donePillText}>تم التحميل</Text>
              </View>
            ) : (
              <Text style={styles.readyText}>بانتظار التحميل الكامل</Text>
            )}
          </View>
        </View>

        <TouchableOpacity activeOpacity={0.85} onPress={startPractice} style={styles.practiceWrap}>
          <LinearGradient
            colors={[...primaryGradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.practiceBtn}
          >
            <Text style={styles.practiceText}>ابدأ الحل التدريبي</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: { fontFamily: 'tajawal', fontSize: 22, fontWeight: '700', color: colors.burgundy, marginTop: -3 },
  headerTitle: {
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    ...shadows.card,
  },
  name: {
    fontFamily: 'tajawal',
    fontSize: 17,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'left',
    marginBottom: 6,
    writingDirection: 'ltr',
  },
  desc: {
    fontFamily: 'tajawal',
    fontSize: 13.5,
    color: colors.textSecondary,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  dlZone: { marginVertical: 4 },
  pendingNote: {
    fontFamily: 'tajawal',
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    writingDirection: 'ltr',
    paddingVertical: 6,
  },
  doneWrap: { alignItems: 'center', gap: 8, paddingVertical: 6 },
  doneNote: {
    fontFamily: 'tajawal',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cardTitle: {
    fontFamily: 'tajawal',
    fontSize: 15,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'left',
    marginBottom: 10,
    writingDirection: 'ltr',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contentName: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '400',
    color: colors.text,
    textAlign: 'left',
    flex: 1,
    writingDirection: 'ltr',
  },
  readyText: { fontFamily: 'tajawal', fontSize: 13, color: colors.textMuted },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successBg,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  donePillText: { fontFamily: 'tajawal', fontSize: 12.5, fontWeight: '700', color: colors.success },
  practiceWrap: { marginTop: 4 },
  practiceBtn: {
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceText: {
    fontFamily: 'tajawal',
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
    textAlign: 'center',
  },
});
