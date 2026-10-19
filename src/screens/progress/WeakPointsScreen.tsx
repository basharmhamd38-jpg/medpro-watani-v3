// نقاط الضعف — تحليل الدقة لكل مادة من سجل الاختبارات المحلي
// تُحسب أوفلاين بالكامل من getSubjectMastery() (تُحدَّث عند كل إنهاء اختبار)
import { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { TrendingDown, Target, ChevronRight, Brain, CheckCircle2 } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppHeader from '../../components/AppHeader';
import EmptyStateCard from '../../components/EmptyStateCard';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import { formatNumber } from '../../utils/numbers';
import { getSubjectMastery, type SubjectMastery } from '../../gamification/profile';

interface Row {
  subject: string;
  answered: number;
  correct: number;
  pct: number;
}

// حد أدنى للإجابات حتى تُعرض المادة (تجنّب الضجيج الإحصائي)
const MIN_ANSWERED = 5;

function levelFor(
  colors: ThemeColors,
  pct: number,
): { label: string; color: string; bg: string } {
  // W24: بيانات فاسدة (NaN/∞) كانت تسقط لـ«ممتازة» — اعرض «لا بيانات» بدلًا منها
  if (!Number.isFinite(pct)) {
    return { label: 'لا بيانات', color: colors.textSecondary, bg: colors.segBg };
  }
  if (pct < 50) return { label: 'نقطة ضعف حرجة', color: colors.error, bg: colors.errorBg };
  if (pct < 70) return { label: 'تحتاج مراجعة', color: colors.amber, bg: colors.explainBg };
  if (pct < 85) return { label: 'جيدة', color: colors.emerald, bg: colors.successBg };
  return { label: 'ممتازة', color: colors.burgundy, bg: colors.optionSelectedBg };
}

export default function WeakPointsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    getSubjectMastery()
      .then((m: Record<string, SubjectMastery>) => {
        const list: Row[] = Object.entries(m)
          .filter(([, v]) => v.answered >= MIN_ANSWERED)
          .map(([subject, v]) => ({
            subject,
            answered: v.answered,
            correct: v.correct,
            pct: v.answered > 0 ? Math.round((v.correct / v.answered) * 100) : 0,
          }))
          .sort((a, b) => a.pct - b.pct); // الأضعف أولًا
        setRows(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const overall = useMemo(() => {
    const answered = rows.reduce((s, r) => s + r.answered, 0);
    const correct = rows.reduce((s, r) => s + r.correct, 0);
    return {
      answered,
      correct,
      pct: answered > 0 ? Math.round((correct / answered) * 100) : 0,
    };
  }, [rows]);

  const weakest = rows[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* الترويسة */}
        <View style={[styles.hero, shadows.card]}>
          <LinearGradient
            colors={[colors.burgundy, colors.burgundyLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBg}>
            <TrendingDown size={30} color={colors.white} />
            <Text style={[styles.heroTitle, rtlTextStyle]}>{'نقاط الضعف'}</Text>
            <Text style={[styles.heroSub, rtlTextStyle]}>
              {'دقّتك في كل مادة محسوبة من سجل اختباراتك على جهازك — ركّز مراجعتك على الأضعف.'}
            </Text>
          </LinearGradient>
        </View>

        {loading ? (
          <Text style={[styles.loadingText, rtlTextStyle]}>{'جارٍ التحليل...'}</Text>
        ) : rows.length === 0 ? (
          <EmptyStateCard
            icon={Target}
            title="لا توجد بيانات كافية بعد"
            message={`أجب ${MIN_ANSWERED} أسئلة على الأقل في أي مادة لتظهر هنا تحليلات الدقة.`}
          />
        ) : (
          <>
            {/* الملخص */}
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, shadows.card]}>
                <Target size={20} color={colors.burgundy} />
                <Text style={[styles.summaryNum, rtlTextStyle]}>{overall.pct}%</Text>
                <Text style={[styles.summaryLbl, rtlTextStyle]}>{'الدقة العامة'}</Text>
              </View>
              <View style={[styles.summaryCard, shadows.card]}>
                <Brain size={20} color={colors.burgundy} />
                <Text style={[styles.summaryNum, rtlTextStyle]}>{overall.answered}</Text>
                <Text style={[styles.summaryLbl, rtlTextStyle]}>{'سؤال محلول'}</Text>
              </View>
              <View style={[styles.summaryCard, shadows.card]}>
                <CheckCircle2 size={20} color={colors.burgundy} />
                <Text style={[styles.summaryNum, rtlTextStyle]}>{rows.length}</Text>
                <Text style={[styles.summaryLbl, rtlTextStyle]}>{'مادة محللة'}</Text>
              </View>
            </View>

            {/* أضعف مادة — توصية */}
            {weakest && weakest.pct < 70 && (
              <View style={styles.tipCard}>
                <Text style={[styles.tipText, rtlTextStyle]}>
                  {bidi(
                    `💡 توصية: أضعف مادة لديك هي «${weakest.subject}» بدقة ${formatNumber(weakest.pct)}٪. راجعها أولًا وكرر أسئلتها.`,
                  )}
                </Text>
              </View>
            )}

            {/* القائمة — الأضعف أولًا */}
            {rows.map((r) => {
              const lvl = levelFor(colors, r.pct);
              return (
                <View key={r.subject} style={[styles.rowCard, shadows.card]}>
                  <View style={styles.rowHead}>
                    <Text style={[styles.rowSubject, rtlTextStyle]} numberOfLines={2}>
                      {bidi(r.subject)}
                    </Text>
                    <View style={[styles.levelBadge, { backgroundColor: lvl.bg }]}>
                      <Text style={[styles.levelText, { color: lvl.color }, rtlTextStyle]}>
                        {lvl.label}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Number.isFinite(r.pct) ? r.pct : 0}%`, backgroundColor: lvl.color },
                      ]}
                    />
                  </View>
                  <View style={styles.rowMeta}>
                    <Text style={[styles.pctText, { color: lvl.color }, rtlTextStyle]}>
                      {`${formatNumber(r.pct)}٪`}
                    </Text>
                    <Text style={[styles.metaText, rtlTextStyle]}>
                      {`${formatNumber(r.correct)} صحيحة من ${formatNumber(r.answered)}`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}>
          <ChevronRight size={16} color={colors.textSecondary} />
          <Text style={[styles.backText, rtlTextStyle]}>{'رجوع'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 40, gap: 14 },
    loadingText: {
      fontFamily: 'tajawal',
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 40,
    },
    hero: { borderRadius: radius.lg, overflow: 'hidden' },
    heroBg: { padding: 20, gap: 8, alignItems: 'flex-start' },
    heroTitle: {
      fontFamily: 'tajawal',
      fontSize: 22,
      fontWeight: '700',
      color: colors.white,
    },
    heroSub: {
      fontFamily: 'tajawal',
      fontSize: 13,
      color: 'rgba(255,255,255,0.85)',
      lineHeight: 20,
    },
    summaryRow: { flexDirection: 'row', gap: 10 },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderBurgundy,
      padding: 14,
      alignItems: 'center',
      gap: 4,
    },
    summaryNum: {
      fontFamily: 'tajawal',
      fontSize: 20,
      fontWeight: '700',
      color: colors.burgundy,
    },
    summaryLbl: { fontFamily: 'tajawal', fontSize: 11, color: colors.textSecondary },
    tipCard: {
      backgroundColor: colors.explainBg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.explainBorder,
      padding: 12,
    },
    tipText: {
      fontFamily: 'tajawal',
      fontSize: 13,
      color: colors.explainText,
      lineHeight: 20,
    },
    rowCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderBurgundy,
      padding: 14,
      gap: 10,
    },
    rowHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
    },
    rowSubject: {
      fontFamily: 'tajawal',
      fontSize: 14,
      fontWeight: '700',
      color: colors.title,
      flex: 1,
    },
    levelBadge: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
    levelText: { fontFamily: 'tajawal', fontSize: 11, fontWeight: '700' },
    barTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: colors.segBg,
      overflow: 'hidden',
    },
    barFill: { height: '100%', borderRadius: 999 },
    rowMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    pctText: { fontFamily: 'tajawal', fontSize: 16, fontWeight: '700' },
    metaText: { fontFamily: 'tajawal', fontSize: 12, color: colors.textSecondary },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 10,
    },
    backText: { fontFamily: 'tajawal', fontSize: 13, color: colors.textSecondary },
  });
