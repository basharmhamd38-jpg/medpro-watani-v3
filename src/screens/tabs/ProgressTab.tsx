// تقدمي الأكاديمي — مرجعية AI Studio (قسم myProgress في App.tsx)
// تبويبا: النتائج والأخطاء + المراجعة الذكية • XP/المستوى/السلسلة • سجل التحديات
import { useCallback, useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { BarChart3, Brain, Flame, Trophy, Zap, ChevronLeft, Inbox, Trash2, Share2 } from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import LockScreen from '../../components/LockScreen';
import EmptyStateCard from '../../components/EmptyStateCard';
import { SkeletonList, QuestionSkeleton } from '../../components/Skeleton';
import ActivityHeatmap from '../../components/ActivityHeatmap';
import ProgressCharts, { getDonutColors } from '../../components/ProgressCharts';
import PercentileGauge from '../../components/PercentileGauge';
import AdvancedStatsCard from '../../components/AdvancedStatsCard';
import { getComparison, type ComparisonResult } from '../../gamification/comparison';
import { getAdvancedStats, type AdvancedStats } from '../../gamification/advancedStats';
import { getAuth } from '../../auth/auth';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import { canAccessTab } from '../../payment/gates';
import { shareProgress } from '../../utils/shareProgress';
import QuizRunner from '../bank/QuizRunner';
import type { QuizQuestion } from '../../bank/quizBank';
import {
  getProfile,
  getChallengeHistory,
  getMistakes,
  getDueMistakes,
  getSubjectMastery,
  markReviewed,
  clearMistake,
  damascusDate,
  type GamificationProfile,
  type ChallengeRecord,
  type MistakeItem,
  type SubjectMastery,
} from '../../gamification/profile';

type SubTab = 'tests' | 'sr';
type Mode = 'dashboard' | 'review';

function fmtDate(d: string): string {
  // YYYY-MM-DD → عرض مختصر
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default function ProgressTab() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const route = useRoute<any>();
  const [open, setOpen] = useState(true);
  const [gateReason, setGateReason] = useState('');
  const [subTab, setSubTab] = useState<SubTab>('tests');
  const [mode, setMode] = useState<Mode>('dashboard');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [history, setHistory] = useState<ChallengeRecord[]>([]);
  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [due, setDue] = useState<MistakeItem[]>([]);
  const [mastery, setMastery] = useState<Record<string, SubjectMastery>>({});
  const [reviewQuestions, setReviewQuestions] = useState<QuizQuestion[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [advStats, setAdvStats] = useState<AdvancedStats | null>(null);
  // W9: ترقيم سجل التحديات — لا يُرسم السجل كاملًا (ينمو بمعدل سجل/يوم بلا حد)
  const [histLimit, setHistLimit] = useState(30);

  const refresh = useCallback(() => {
    const gate = canAccessTab('progress');
    setOpen(gate.open);
    setGateReason(gate.reason || '');
    if (!gate.open) return;
    setLoading(true);
    Promise.all([getProfile(), getChallengeHistory(), getMistakes(), getDueMistakes(), getSubjectMastery()])
      .then(([p, h, m, d, sm]) => {
        setProfile(p);
        setHistory(h);
        setMistakes(m);
        setDue(d);
        setMastery(sm || {});
        // المقارنة مع المتوسط + الإحصائيات المتقدمة (لا تحجب الواجهة)
        getAdvancedStats().then(setAdvStats).catch(() => {});
        try {
          const a = getAuth();
          const email = a.type === 'user' ? a.email : '';
          getComparison(p.totalXP || 0, email).then(setComparison).catch(() => {});
        } catch {
          /* زائر */
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (mode === 'dashboard') refresh();
      // دعم التنقل من الدرج: «المراجعة الذكية» تفتح تبويب sr مباشرة
      const initial = route?.params?.initialSubTab;
      if (initial === 'sr' || initial === 'tests') {
        setSubTab(initial);
        // مسح البارامتر حتى لا يلتصق عند العودة للتبويب لاحقًا
        if (route?.params) {
          route.params.initialSubTab = undefined;
        }
      }
    }, [refresh, mode, route]),
  );

  const startReview = () => {
    const items = subTab === 'sr' ? due : mistakes;
    if (items.length === 0) return;
    setReviewLoading(true);
    const qs: QuizQuestion[] = items.map((m) => ({
      id: m.qid,
      text: m.text,
      options: m.options,
      correctIndex: m.correctIndex,
      explanation: m.explanation,
      n: null,
    }));
    setReviewQuestions(qs);
    setReviewLoading(false);
    setMode('review');
  };

  const exitReview = async () => {
    // حدّث جدولة المراجعة لكل سؤال (نفترض الإجابة الصحيحة إن كُشف — QuizRunner لا يصدّر الإجابات، نعيد الجدولة تقدميًا)
    for (const q of reviewQuestions) {
      await markReviewed(q.id, true);
    }
    setMode('dashboard');
    refresh();
  };

  if (!open) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader />
        <LockScreen message={gateReason || 'يتطلب التفعيل'} />
      </SafeAreaView>
    );
  }

  if (mode === 'review') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader />
        <QuizRunner
          title="المراجعة الذكية"
          subjectId="smart_review"
          questions={reviewQuestions}
          loading={reviewLoading}
          onExit={exitReview}
          onRetry={exitReview}
        />
      </SafeAreaView>
    );
  }

  const todayXP = profile ? profile.xpHistory[damascusDate()] || 0 : 0;

  // XP الأسبوعية لآخر 4 أسابيع (للرسم البياني)
  const weeklyXP = useMemo(() => {
    if (!profile) return [0, 0, 0, 0];
    const weeks: number[] = [0, 0, 0, 0];
    for (let w = 0; w < 4; w++) {
      let sum = 0;
      for (let d = 0; d < 7; d++) {
        const key = damascusDate(-(w * 7 + d));
        sum += profile.xpHistory[key] || 0;
      }
      weeks[3 - w] = sum;
    }
    return weeks;
  }, [profile]);

  // إتقان المواد — دقة حقيقية محسوبة من سجل الاختبارات المحلي (getSubjectMastery).
  // لا تُعرض أي قيم مخترعة: بلا بيانات كافية تُخفى الدونات وتظهر حالة فراغ.
  const MIN_MASTERY_ANSWERS = 5; // نفس حد WeakPointsScreen — تجنّب الضجيج الإحصائي
  const subjectMastery = useMemo(() => {
    const palette = getDonutColors(colors);
    const rows = Object.entries(mastery)
      .filter(([, v]) => (v?.answered ?? 0) >= MIN_MASTERY_ANSWERS)
      .map(([label, v]) => ({
        label,
        value: v.answered > 0 ? Math.round((v.correct / v.answered) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    return rows.map((r, i) => ({
      ...r,
      color: palette[i % palette.length],
    }));
  }, [mastery, colors]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* الترويسة */}
        <View style={[styles.card, shadows.card]}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.title, rtlTextStyle]}>تقدمي الأكاديمي</Text>
              <Text style={[styles.subtitle, rtlTextStyle]}>متابعة الأداء والمراجعة الذكية</Text>
            </View>
            <View style={styles.headerActions}>
              <View style={styles.xpBadge}>
                <Text style={styles.xpBadgeText}>⚡ {profile?.totalXP ?? 0} XP</Text>
              </View>
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={() => shareProgress()}
                activeOpacity={0.8}
                hitSlop={8}>
                <Text style={[styles.shareBtnText, rtlTextStyle]}>مشاركة</Text>
                <Share2 size={16} color={colors.burgundy} />
              </TouchableOpacity>
            </View>
          </View>
          {/* التبويبات الداخلية */}
          <View style={styles.segWrap}>
            <TouchableOpacity
              style={[styles.segBtn, subTab === 'sr' && styles.segBtnActive]}
              onPress={() => setSubTab('sr')}
              activeOpacity={0.8}>
              <Brain size={15} color={subTab === 'sr' ? colors.white : colors.burgundy} />
              <Text style={[styles.segText, subTab === 'sr' && styles.segTextActive]}>
                المراجعة الذكية
              </Text>
              {due.length > 0 && (
                <View style={styles.segCount}>
                  <Text style={styles.segCountText}>{due.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segBtn, subTab === 'tests' && styles.segBtnActive]}
              onPress={() => setSubTab('tests')}
              activeOpacity={0.8}>
              <BarChart3 size={15} color={subTab === 'tests' ? colors.white : colors.burgundy} />
              <Text style={[styles.segText, subTab === 'tests' && styles.segTextActive]}>
                النتائج والأخطاء
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <SkeletonList count={4} render={() => <QuestionSkeleton />} />
        ) : (
          <>
            {/* بطاقات الإحصائيات */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, shadows.card]}>
                <Trophy size={18} color={colors.amberText} />
                <Text style={styles.statValue}>{profile?.level ?? 1}</Text>
                <Text style={[styles.statLabel, rtlTextStyle]}>المستوى</Text>
              </View>
              <View style={[styles.statCard, shadows.card]}>
                <Flame size={18} color={colors.amberText} />
                <Text style={styles.statValue}>{profile?.currentStreak ?? 0}</Text>
                <Text style={[styles.statLabel, rtlTextStyle]}>سلسلة الأيام</Text>
              </View>
              <View style={[styles.statCard, shadows.card]}>
                <Zap size={18} color={colors.amberText} />
                <Text style={styles.statValue}>{todayXP}</Text>
                <Text style={[styles.statLabel, rtlTextStyle]}>نقاط اليوم</Text>
              </View>
              <View style={[styles.statCard, shadows.card]}>
                <Flame size={18} color={colors.burgundy} />
                <Text style={styles.statValue}>{profile?.longestStreak ?? 0}</Text>
                <Text style={[styles.statLabel, rtlTextStyle]}>أطول سلسلة</Text>
              </View>
            </View>

            {/* خريطة النشاط الحرارية */}
            {profile && (
              <ActivityHeatmap xpHistory={profile.xpHistory || {}} />
            )}

            {/* الرسوم البيانية */}
            {profile && (
              <ProgressCharts weeklyXP={weeklyXP} subjectMastery={subjectMastery} />
            )}

            {/* حالة فراغ إتقان المواد — بدل عرض نسب وهمية */}
            {profile && subjectMastery.length === 0 && (
              <View style={[styles.card, shadows.card]}>
                <Text style={[styles.sectionTitle, rtlTextStyle]}>إتقان المواد</Text>
                <EmptyStateCard
                  icon={BarChart3}
                  title="لا توجد بيانات كافية"
                  message="أجب المزيد من الأسئلة لعرض التحليل."
                />
              </View>
            )}

            {/* المقارنة مع متوسط المستخدمين */}
            {comparison && (
              <PercentileGauge
                percentile={comparison.percentile}
                rank={comparison.rank}
                total={comparison.total}
                avgXP={comparison.avgXP}
                myXP={comparison.myXP}
              />
            )}

            {/* الإحصائيات المتقدمة */}
            {advStats && <AdvancedStatsCard stats={advStats} />}

            {subTab === 'tests' && (
              <View style={styles.section}>
                {/* سجل التحديات */}
                <Text style={[styles.sectionTitle, rtlTextStyle]}>سجل التحديات اليومية</Text>
                {history.length === 0 ? (
                  <EmptyStateCard
                    icon={Inbox}
                    title="لا توجد تحديات بعد"
                    message="ابدأ التحدي اليومي من تبويب «التحدي اليومي» وستظهر نتائجك هنا."
                  />
                ) : (
                  <>
                    {history.slice(0, histLimit).map((h, i) => (
                      <View key={`${h.date}-${i}`} style={[styles.card, styles.histRow]}>
                        <View style={styles.histMain}>
                          <Text style={[styles.histDate, rtlTextStyle]}>{fmtDate(h.date)}</Text>
                          <Text style={[styles.histScore, rtlTextStyle]}>
                            {h.correct} / {h.total} صحيحة
                          </Text>
                        </View>
                        <View style={styles.xpChip}>
                          <Text style={styles.xpChipText}>+{h.xpEarned} XP</Text>
                        </View>
                      </View>
                    ))}
                    {history.length > histLimit && (
                      <TouchableOpacity
                        style={styles.moreBtn}
                        onPress={() => setHistLimit((l) => l + 30)}
                        activeOpacity={0.8}>
                        <Text style={[styles.moreBtnText, rtlTextStyle]}>
                          عرض تحديات أقدم ({history.length - histLimit} متبقٍ)
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}

                {/* الأخطاء */}
                <View style={styles.rowBetween}>
                  <Text style={[styles.sectionTitle, rtlTextStyle]}>أسئلة تحتاج تقوية ({mistakes.length})</Text>
                  {mistakes.length > 0 && (
                    <TouchableOpacity style={styles.reviewBtn} onPress={startReview} activeOpacity={0.8}>
                      <Text style={styles.reviewBtnText}>راجع الكل</Text>
                      <ChevronLeft size={14} color={colors.white} />
                    </TouchableOpacity>
                  )}
                </View>
                {mistakes.length === 0 ? (
                  <EmptyStateCard
                    icon={BarChart3}
                    title="لا أخطاء مسجلة"
                    message="الأخطاء من التحديات اليومية ستُحفظ هنا للمراجعة."
                  />
                ) : (
                  mistakes.slice(0, 15).map((m) => (
                    <View key={m.qid} style={[styles.card, styles.mistRow]}>
                      <Text style={[styles.mistText, rtlTextStyle]} numberOfLines={2}>
                        {bidi(m.text)}
                      </Text>
                      <Text style={[styles.mistMeta, rtlTextStyle]}>
                        {bidi(m.subjectName)} • مراجعات: {m.reviewCount}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            )}

            {subTab === 'sr' && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, rtlTextStyle]}>
                  المستحق مراجعته اليوم ({due.length})
                </Text>
                <Text style={[styles.desc, rtlTextStyle]}>
                  نظام التكرار المتباعد: الأسئلة الخاطئة تعود للمراجعة بعد 1 / 3 / 7 / 14 / 30 يومًا حتى تتقنها.
                </Text>
                {due.length === 0 ? (
                  <EmptyStateCard
                    icon={Brain}
                    title="لا شيء مستحق اليوم"
                    message="أنجزت كل مراجعاتك! عد غدًا أو راجع كل الأخطاء."
                  />
                ) : (
                  <>
                    <TouchableOpacity style={styles.startBtn} onPress={startReview} activeOpacity={0.85}>
                      <Brain size={18} color={colors.white} />
                      <Text style={styles.startBtnText}>ابدأ جلسة المراجعة ({due.length})</Text>
                    </TouchableOpacity>
                    {due.slice(0, 10).map((m) => (
                      <View key={m.qid} style={[styles.card, styles.mistRow]}>
                        <View style={styles.rowBetween}>
                          <Text style={[styles.mistText, rtlTextStyle]} numberOfLines={2}>
                            {bidi(m.text)}
                          </Text>
                          <TouchableOpacity
                            onPress={async () => {
                              await clearMistake(m.qid);
                              refresh();
                            }}
                            hitSlop={10}>
                            <Trash2 size={16} color={colors.tabInactive} />
                          </TouchableOpacity>
                        </View>
                        <Text style={[styles.mistMeta, rtlTextStyle]}>
                          {bidi(m.subjectName)} • مراجعات: {m.reviewCount}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 14, gap: 12, paddingBottom: 28 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    padding: 14,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '700', color: colors.burgundy, textAlign: 'right' },
  subtitle: { fontSize: 11, color: colors.burgundyLight, marginTop: 2, textAlign: 'right' },
  xpBadge: { backgroundColor: colors.burgundySoft, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  xpBadgeText: { fontSize: 12, fontWeight: '700', color: colors.burgundy },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.burgundySoft,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  shareBtnText: { fontSize: 11, fontWeight: '700', color: colors.burgundy },
  segWrap: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    padding: 5,
    marginTop: 12,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  segBtnActive: { backgroundColor: colors.burgundy },
  segText: { fontSize: 12, fontWeight: '700', color: colors.burgundy },
  segTextActive: { color: colors.white },
  segCount: { backgroundColor: colors.amber, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  segCountText: { fontSize: 9, fontWeight: '700', color: colors.white },
  centerBox: { alignItems: 'center', paddingVertical: 40 },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.burgundy },
  statLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center' },
  section: { gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.burgundy, textAlign: 'right' },
  desc: { fontSize: 11, color: colors.textSecondary, lineHeight: 18, textAlign: 'right' },
  histRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  histMain: { gap: 2 },
  histDate: { fontSize: 12, fontWeight: '700', color: colors.title, textAlign: 'right' },
  histScore: { fontSize: 11, color: colors.textSecondary, textAlign: 'right' },
  xpChip: { backgroundColor: colors.explainBg, borderWidth: 1, borderColor: colors.explainBorder, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  xpChipText: { fontSize: 11, fontWeight: '700', color: colors.amberText },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.burgundy,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  reviewBtnText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  mistRow: { gap: 4 },
  mistText: { fontSize: 12, fontWeight: '400', color: colors.text, lineHeight: 19, textAlign: 'right' },
  mistMeta: { fontSize: 10, color: colors.textSecondary, textAlign: 'right' },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.burgundy,
    borderRadius: radius.lg,
    paddingVertical: 14,
  },
  startBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  moreBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreBtnText: { fontSize: 12, fontWeight: '700', color: colors.burgundy, textAlign: 'center' },
});
