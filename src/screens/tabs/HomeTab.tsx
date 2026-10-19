// الرئيسية — المحتوى الحقيقي (مرجعية AI Studio: App.tsx شاشة home)
// بطاقة الترحيب + الإحصائيات + الاختصارات + التحدي اليومي + اقتباس تحفيزي
import React, { useCallback, useState , useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  BookOpen,
  Brain,
  Calendar,
  Zap,
} from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import LockScreen from '../../components/LockScreen';
import MascotCard from '../../components/MascotCard';
import ExamCountdownCard from '../../components/ExamCountdownCard';
import RecommendationCard from '../../components/RecommendationCard';
import { buildRecommendations, type Recommendation } from '../../utils/recommendations';
import { canAccessTab } from '../../payment/gates';
import { getAuth } from '../../auth/auth';
import { getProfile, getActivityStats, isChallengeDoneToday } from '../../gamification/profile';
import { shadows, useTheme, type ThemeColors } from '../../theme';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import { formatNumber } from '../../utils/numbers';

export default function HomeTab() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const [authName, setAuthName] = useState('');
  const [activated, setActivated] = useState(false);
  // بيانات حقيقية — تُقرأ من نظام التحفيز المحلي (لا أرقام وهمية)
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [questionsSolved, setQuestionsSolved] = useState(0);
  const [coursesDone, setCoursesDone] = useState(0);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  // بوابة القسم: الرئيسية مقفلة لغير المفعّلين (مثل ChallengeTab/ProgressTab)
  const [open, setOpen] = useState(true);
  const [gateReason, setGateReason] = useState('');

  useFocusEffect(
    useCallback(() => {
      const gate = canAccessTab('home');
      setOpen(gate.open);
      setGateReason(gate.reason || '');
      if (!gate.open) return;
      const a = getAuth();
      if (a.type === 'user') {
        setAuthName(a.name || a.email);
        setActivated(a.activated && a.expiresAt > Date.now());
      } else {
        setAuthName('');
        setActivated(false);
      }
      // تحميل الإحصائيات الحقيقية
      getProfile().then((p) => {
        setXp(p.totalXP);
        setLevel(p.level);
        setStreak(p.currentStreak);
        // بناء التوصيات الذكية
        isChallengeDoneToday().then((done) => {
          setRecommendations(
            buildRecommendations({ profile: p, challengeDoneToday: done })
          );
        }).catch(() => {
          setRecommendations(buildRecommendations({ profile: p }));
        });
      }).catch(() => {});
      getActivityStats().then((s) => {
        setQuestionsSolved(s.questionsAnswered);
        setCoursesDone(s.coursesCompleted);
      }).catch(() => {});
    }, []),
  );

  const isActive = activated;
  const displayName = authName ? `د. ${authName}` : 'زميلي الطبيب';

  const goTo = (route: string) => {
    try {
      navigation.navigate(route);
    } catch {
      // تجاهل
    }
  };

  // بوابة القسم: غير المفعّلين يرون شاشة القفل بدل المحتوى (B3)
  if (!open) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader />
        <LockScreen message={gateReason || 'يتطلب التفعيل'} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* عدّاد الامتحان الوطني */}
        <ExamCountdownCard />

        {/* بطاقة الترحيب */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeRow}>
            <Text style={styles.university}>{'جامعة دمشق — الطب البشري'}</Text>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>
                {isActive ? 'حساب فعال' : 'زائر'}
              </Text>
            </View>
          </View>
          <Text style={styles.welcomeTitle}>{bidi(`أهلًا ${displayName}`)}</Text>
          <Text style={styles.welcomeSub}>
            {'استمر في وتيرة المذاكرة — الامتحان الوطني يقترب!'}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{'الدورات المنجزة'}</Text>
              <Text style={styles.statValue}>{formatNumber(coursesDone)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{'الأسئلة المحلولة'}</Text>
              <Text style={styles.statValue}>{formatNumber(questionsSolved)}</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{bidi('نقاط XP')}</Text>
              <Text style={styles.statValue}>{formatNumber(xp)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>{'السلسلة اليومية'}</Text>
              <Text style={styles.statValue}>{`🔥 ${formatNumber(streak)}`}</Text>
            </View>
          </View>
        </View>

        {/* التوصيات الذكية */}
        {recommendations.length > 0 && (
          <View style={{ marginVertical: 4 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: colors.title,
                textAlign: 'right',
                writingDirection: 'rtl',
                marginBottom: 4,
                paddingHorizontal: 4,
              }}>
              {'💡 مقترح لك اليوم'}
            </Text>
            {recommendations.map((r) => (
              <RecommendationCard
                key={r.id}
                recommendation={r}
                onPress={goTo}
              />
            ))}
          </View>
        )}

        {/* التميمة المحفزة — نصيحة اليوم */}
        <MascotCard variant="daily" />

        {/* اختصارات سريعة */}
        <View style={styles.shortcutsRow}>
          <TouchableOpacity
            style={styles.shortcutPrimary}
            onPress={() => goTo('BankTab')}
            activeOpacity={0.85}>
            <BookOpen size={24} color={colors.burgundyLight} />
            <Text style={styles.shortcutPrimaryTitle}>{'بنك الأسئلة'}</Text>
            <Text style={styles.shortcutPrimarySub}>
              {'٢٧ مادة طبية · نظري وسريري'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shortcutSecondary}
            onPress={() => goTo('GuideTab')}
            activeOpacity={0.85}>
            <Calendar size={24} color={colors.burgundy} />
            <Text style={styles.shortcutSecondaryTitle}>{'دليل الدراسة'}</Text>
            <Text style={styles.shortcutSecondarySub}>
              {'نصائح وطرق المذاكرة الفعالة'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* المراجعة الذكية */}
        <View style={styles.srCard}>
          <View style={styles.srTextWrap}>
            <View style={styles.srHeader}>
              <Text style={styles.srKicker}>{'المراجعة الذكية'}</Text>
              <Brain size={18} color={colors.gold} />
            </View>
            <Text style={styles.srTitle}>
              {'جدولة الأسئلة الخاطئة لمنع النسيان'}
            </Text>
            <Text style={styles.srSub}>
              {'راجع أخطاءك بذكاء عبر قسم دليل الدراسة'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.srButton}
            onPress={() => goTo('GuideTab')}
            activeOpacity={0.85}>
            <Text style={styles.srButtonText}>{'عرض الدليل'}</Text>
          </TouchableOpacity>
        </View>

        {/* التحدي اليومي */}
        <View style={styles.challengeCard}>
          <View style={styles.srTextWrap}>
            <View style={styles.srHeader}>
              <Text style={[styles.srKicker, { color: colors.burgundy }]}>
                {bidi('التحدي اليومي (+30 XP)')}
              </Text>
              <Zap size={18} color={colors.amber} />
            </View>
            <Text style={[styles.srTitle, { color: colors.title }]}>
              {'١٠ أسئلة مختلطة لتثبيت معلوماتك'}
            </Text>
            <Text style={styles.challengeSub}>
              {'فرصة يومية لكسب النقاط والحفاظ على السلسلة'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.challengeButton}
            onPress={() => goTo('ChallengeTab')}
            activeOpacity={0.85}>
            <Text style={styles.challengeButtonText}>{'ابدأ التحدي'}</Text>
          </TouchableOpacity>
        </View>

        {/* اقتباس تحفيزي — استُبدل ببطاقة التميمة أعلاه */}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  welcomeCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    ...shadows.card,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  university: {
    flex: 1,
    fontSize: 12,
    fontWeight: '400',
    color: colors.burgundyLight,
    ...rtlTextStyle,
    textAlign: 'right',
  },
  activeBadge: {
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.emerald,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.burgundy,
    ...rtlTextStyle,
    textAlign: 'right',
    marginBottom: 4,
  },
  welcomeSub: {
    fontSize: 12,
    color: colors.burgundyLight,
    opacity: 0.8,
    ...rtlTextStyle,
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderBurgundy,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: colors.burgundyLight,
    marginBottom: 4,
    ...rtlTextStyle,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.burgundy,
  },
  shortcutsRow: { flexDirection: 'row', gap: 12 },
  shortcutPrimary: {
    flex: 1,
    backgroundColor: colors.burgundy,
    borderRadius: 16,
    padding: 16,
    ...shadows.card,
  },
  shortcutPrimaryTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
    marginTop: 8,
    ...rtlTextStyle,
    textAlign: 'right',
  },
  shortcutPrimarySub: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    ...rtlTextStyle,
    textAlign: 'right',
  },
  shortcutSecondary: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    borderRadius: 16,
    padding: 16,
    ...shadows.card,
  },
  shortcutSecondaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.burgundy,
    marginTop: 8,
    ...rtlTextStyle,
    textAlign: 'right',
  },
  shortcutSecondarySub: {
    fontSize: 11,
    color: colors.burgundyLight,
    marginTop: 4,
    ...rtlTextStyle,
    textAlign: 'right',
  },
  srCard: {
    backgroundColor: colors.burgundy,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.burgundy,
    ...shadows.card,
  },
  srTextWrap: { flex: 1 },
  srHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  srKicker: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gold,
    ...rtlTextStyle,
    textAlign: 'right',
  },
  srTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
    marginTop: 6,
    ...rtlTextStyle,
    textAlign: 'right',
  },
  srSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    lineHeight: 16,
    ...rtlTextStyle,
    textAlign: 'right',
  },
  srButton: {
    backgroundColor: colors.amber,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  srButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.burgundy,
  },
  challengeCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    ...shadows.card,
  },
  challengeSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
    ...rtlTextStyle,
    textAlign: 'right',
  },
  challengeButton: {
    backgroundColor: colors.burgundy,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  challengeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
});
