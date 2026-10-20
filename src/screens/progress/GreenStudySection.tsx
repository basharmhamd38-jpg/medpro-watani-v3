// قسم «الدراسة الخضراء» داخل تبويب «تقدمي»
// جلسة تركيز 30 دقيقة أوفلاين + عدادات بيئية حقيقية + نصائح بيئية
// بلا نبتة/شجرة — بقرار الدكتور. يعمل أوفلاين بالكامل.
import React, { useCallback, useEffect, useRef, useState , useMemo } from 'react';
import { AppState, AppStateStatus, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { Droplets, Zap, Wind, Play, Square, Leaf, Info } from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { haptics } from '../../utils/haptics';
import {
  SESSION_SECONDS,
  SOURCES,
  ECO_TIPS,
  GreenStudyStats,
  loadStats,
  recordCompletedSession,
  formatCountdown,
  sessionProgress,
  liveSessionValues,
  fmt,
} from '../../utils/greenStudy';

type Phase = 'idle' | 'running' | 'done';

export default function GreenStudySection() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [remaining, setRemaining] = useState(SESSION_SECONDS);
  const [stats, setStats] = useState<GreenStudyStats | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(
    (AppState.currentState as AppStateStatus) || 'active',
  );

  // تحميل الإحصائيات + تدوير النصائح
  useEffect(() => {
    loadStats().then(setStats);
    const tipTimer = setInterval(() => {
      setTipIndex((i) => (i + 1) % ECO_TIPS.length);
    }, 12000);
    return () => clearInterval(tipTimer);
  }, []);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // إنهاء الجلسة عند الخروج من التطبيق — بقرار الدكتور
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const wasActive =
        appStateRef.current === 'active' || appStateRef.current === 'unknown';
      appStateRef.current = next;
      if (wasActive && (next === 'background' || next === 'inactive')) {
        // خرج من التطبيق أثناء جلسة جارية → الجلسة تنتهي بلا احتساب
        setPhase((p) => {
          if (p === 'running') {
            haptics.warn();
            return 'idle';
          }
          return p;
        });
      }
    });
    return () => sub.remove();
  }, []);

  // تنظيف المؤقت عند إلغاء التحميل
  useEffect(() => clearTimer, [clearTimer]);

  const startSession = useCallback(() => {
    haptics.tap();
    setRemaining(SESSION_SECONDS);
    setPhase('running');
    clearTimer();
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearTimer();
          // اكتملت الجلسة → سجّلها
          recordCompletedSession().then((next) => {
            setStats(next);
            setPhase('done');
            haptics.complete();
          });
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }, [clearTimer]);

  const stopSession = useCallback(() => {
    haptics.warn();
    clearTimer();
    setPhase('idle');
    setRemaining(SESSION_SECONDS);
  }, [clearTimer]);

  const backToIdle = useCallback(() => {
    haptics.tap();
    setPhase('idle');
    setRemaining(SESSION_SECONDS);
  }, []);

  const elapsed = SESSION_SECONDS - remaining;
  const live = liveSessionValues(elapsed);
  const progress = sessionProgress(elapsed);

  return (
    <View style={[styles.card, shadows.card]}>
      {/* العنوان */}
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Leaf size={20} color={colors.burgundy} strokeWidth={2.2} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>الدراسة الخضراء</Text>
          <Text style={styles.subtitle}>
            30 دقيقة تركيز أوفلاين — دراستك تحمي البيئة
          </Text>
        </View>
      </View>

      {/* المؤقت */}
      <View style={styles.timerBox}>
        <Text style={styles.timerText}>{formatCountdown(remaining)}</Text>
        {/* شريط التقدم */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.timerHint}>
          {phase === 'running'
            ? 'الجلسة جارية — الخروج من التطبيق ينهيها'
            : phase === 'done'
              ? 'أحسنت! اكتملت الجلسة وسُجّل أثرك البيئي'
              : 'ابدأ الجلسة وادرس من موادك المحمّلة — بلا إنترنت'}
        </Text>
      </View>

      {/* العدادات البيئية الحية */}
      <View style={styles.countersRow}>
        <View style={styles.counter}>
          <Wind size={18} color={colors.burgundy} strokeWidth={2.2} />
          <Text style={styles.counterValue}>{fmt(live.co2G, 1)}غ</Text>
          <Text style={styles.counterLabel}>CO₂ موفّر</Text>
        </View>
        <View style={styles.counter}>
          <Droplets size={18} color={colors.burgundy} strokeWidth={2.2} />
          <Text style={styles.counterValue}>{fmt(live.waterL, 2)} لتر</Text>
          <Text style={styles.counterLabel}>ماء موفّر</Text>
        </View>
        <View style={styles.counter}>
          <Zap size={18} color={colors.burgundy} strokeWidth={2.2} />
          <Text style={styles.counterValue}>{fmt(live.energyWh, 0)} Wh</Text>
          <Text style={styles.counterLabel}>طاقة موفّرة</Text>
        </View>
      </View>
      <Text style={styles.estimateTag}>تقدير مبني على أبحاث منشورة</Text>

      {/* زر التحكم */}
      {phase === 'running' ? (
        <TouchableOpacity
          style={[styles.btn, styles.btnStop]}
          onPress={stopSession}
          activeOpacity={0.85}>
          <Square size={16} color={colors.card} strokeWidth={2.4} />
          <Text style={styles.btnTextLight}>إنهاء الجلسة</Text>
        </TouchableOpacity>
      ) : phase === 'done' ? (
        <TouchableOpacity
          style={[styles.btn, styles.btnStart]}
          onPress={backToIdle}
          activeOpacity={0.85}>
          <Play size={16} color={colors.card} strokeWidth={2.4} />
          <Text style={styles.btnTextLight}>جلسة جديدة</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.btn, styles.btnStart]}
          onPress={startSession}
          activeOpacity={0.85}>
          <Play size={16} color={colors.card} strokeWidth={2.4} />
          <Text style={styles.btnTextLight}>ابدأ جلسة خضراء</Text>
        </TouchableOpacity>
      )}

      {/* الإحصائيات التراكمية */}
      {stats && stats.totalSessions > 0 && (
        <View style={styles.statsBox}>
          <Text style={styles.statsTitle}>أثرك التراكمي</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{stats.totalSessions}</Text>
              <Text style={styles.statLabel}>جلسة</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{fmt(stats.totalCo2G, 0)}غ</Text>
              <Text style={styles.statLabel}>CO₂</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{fmt(stats.totalWaterL, 2)}</Text>
              <Text style={styles.statLabel}>لتر ماء</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{fmt(stats.totalEnergyWh, 0)}</Text>
              <Text style={styles.statLabel}>Wh طاقة</Text>
            </View>
          </View>
        </View>
      )}

      {/* نصيحة بيئية دوّارة */}
      <View style={styles.tipBox}>
        <View style={styles.tipHeader}>
          <Info size={15} color={colors.burgundy} strokeWidth={2.2} />
          <Text style={styles.tipTitle}>نصيحة بيئية</Text>
        </View>
        <Text style={styles.tipText}>{ECO_TIPS[tipIndex]}</Text>
      </View>

      {/* المراجع */}
      <Text style={styles.sourcesTitle}>مصادر الأرقام:</Text>
      {SOURCES.map((s) => (
        <Text key={s} style={styles.sourceLine}>
          • {s}
        </Text>
      ))}
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 18,
    direction: 'rtl',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.featureTile,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: 12,
  },
  headerText: { flex: 1 },
  title: {
    fontFamily: 'tajawal',
    fontSize: 18,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'left',
  },
  subtitle: {
    fontFamily: 'tajawal',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'left',
    marginTop: 2,
  },
  timerBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  timerText: {
    fontFamily: 'tajawal',
    fontSize: 44,
    fontWeight: '700',
    color: colors.burgundy,
    letterSpacing: 2,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.segBg,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.burgundy,
  },
  timerHint: {
    fontFamily: 'tajawal',
    fontSize: 12.5,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  countersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  counter: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.optionBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    marginHorizontal: 4,
  },
  counterValue: {
    fontFamily: 'tajawal',
    fontSize: 15,
    fontWeight: '700',
    color: colors.burgundy,
    marginTop: 4,
  },
  counterLabel: {
    fontFamily: 'tajawal',
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  estimateTag: {
    fontFamily: 'tajawal',
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 12,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    paddingVertical: 14,
    marginBottom: 14,
  },
  btnStart: { backgroundColor: colors.burgundy },
  btnStop: { backgroundColor: colors.rose },
  btnTextLight: {
    fontFamily: 'tajawal',
    fontSize: 15,
    fontWeight: '700',
    color: colors.card,
    marginEnd: 8,
  },
  statsBox: {
    backgroundColor: colors.successBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 12,
  },
  statsTitle: {
    fontFamily: 'tajawal',
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.success,
    textAlign: 'left',
    marginBottom: 8,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: {
    fontFamily: 'tajawal',
    fontSize: 15,
    fontWeight: '700',
    color: colors.title,
  },
  statLabel: {
    fontFamily: 'tajawal',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tipBox: {
    backgroundColor: colors.explainBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.explainBorder,
    padding: 12,
    marginBottom: 12,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  tipTitle: {
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 13,
    fontWeight: '700',
    color: colors.burgundy,
    marginEnd: 6,
  },
  tipText: {
    fontFamily: 'tajawal',
    fontSize: 13,
    color: colors.explainText,
    textAlign: 'left',
    lineHeight: 22,
  },
  sourcesTitle: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'left',
    marginBottom: 4,
  },
  sourceLine: {
    fontFamily: 'tajawal',
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'left',
    lineHeight: 18,
  },
});
