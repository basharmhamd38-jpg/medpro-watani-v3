// مؤقت التركيز (بومودورو) — يعمل أوفلاين بالكامل
// دورة: 25 دقيقة تركيز / 5 دقائق راحة + إحصائيات الجلسات
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Play, Pause, RotateCcw, SkipForward, Timer, Flame, ChevronRight } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppHeader from '../../components/AppHeader';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { rtlTextStyle } from '../../utils/bidi';
import { formatNumber } from '../../utils/numbers';
import {
  recordFocusSession,
  getTodayFocus,
  getWeekFocus,
  type DayFocus,
} from '../../focus/pomodoro';

type Phase = 'focus' | 'break';

const FOCUS_MIN = 25;
const BREAK_MIN = 5;

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

function fmtMinutes(secs: number): string {
  const m = Math.round(secs / 60);
  if (m < 60) return `${m} دقيقة`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h} س ${rm} د` : `${h} ساعة`;
}

const AR_DAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export default function PomodoroScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const navigation = useNavigation<any>();

  const [phase, setPhase] = useState<Phase>('focus');
  const [remaining, setRemaining] = useState(FOCUS_MIN * 60);
  const [running, setRunning] = useState(false);
  const [cycle, setCycle] = useState(1);
  const [today, setToday] = useState<DayFocus>({ sessions: 0, focusSeconds: 0, date: '' });
  const [week, setWeek] = useState<DayFocus[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // W20: deadline على الساعة الحقيقية — المؤقت لا يتجمد عند دخول التطبيق الخلفية
  const deadlineRef = useRef(0);
  const remainingRef = useRef(FOCUS_MIN * 60);

  const refreshStats = useCallback(() => {
    getTodayFocus().then(setToday).catch(() => {});
    getWeekFocus().then(setWeek).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshStats();
    }, [refreshStats]),
  );

  // إيقاف المؤقت عند مغادرة الشاشة
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // إنهاء المرحلة والانتقال للتالية — كل الآثار الجانبية خارج الـupdater (W23)
  const finishPhase = useCallback(
    (completedPhase: Phase) => {
      clearTimer();
      setRunning(false);
      if (completedPhase === 'focus') {
        // سجّل الجلسة ثم انتقل للراحة
        recordFocusSession(FOCUS_MIN * 60)
          .then(() => refreshStats())
          .catch(() => {});
        setPhase('break');
        remainingRef.current = BREAK_MIN * 60;
        setRemaining(BREAK_MIN * 60);
      } else {
        // انتهت الراحة → دورة جديدة
        setCycle((c) => c + 1);
        setPhase('focus');
        remainingRef.current = FOCUS_MIN * 60;
        setRemaining(FOCUS_MIN * 60);
      }
    },
    [refreshStats],
  );

  const stopTimer = () => {
    const wasRunning = timerRef.current !== null;
    clearTimer();
    setRunning(false);
    if (wasRunning) {
      // تثبيت المتبقي المحسوب من الـdeadline لحظة الإيقاف المؤقت
      const left = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      remainingRef.current = left;
      setRemaining(left);
    }
  };

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    // W20: deadline مبني على Date.now() — الفجوات الزمنية (خلفية/نوم) تُحتسب تلقائيًا
    deadlineRef.current = Date.now() + remainingRef.current * 1000;
    setRunning(true);
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      remainingRef.current = left;
      setRemaining(left);
      if (left <= 0) finishPhase(phase);
    }, 500);
  }, [phase, finishPhase]);

  const toggle = () => {
    if (running) stopTimer();
    else startTimer();
  };

  const reset = () => {
    stopTimer();
    setPhase('focus');
    remainingRef.current = FOCUS_MIN * 60;
    setRemaining(FOCUS_MIN * 60);
  };

  const skip = () => {
    stopTimer();
    if (phase === 'focus') {
      setPhase('break');
      remainingRef.current = BREAK_MIN * 60;
      setRemaining(BREAK_MIN * 60);
    } else {
      setCycle((c) => c + 1);
      setPhase('focus');
      remainingRef.current = FOCUS_MIN * 60;
      setRemaining(FOCUS_MIN * 60);
    }
  };

  const progress = phase === 'focus'
    ? 1 - remaining / (FOCUS_MIN * 60)
    : 1 - remaining / (BREAK_MIN * 60);

  const maxWeekSecs = Math.max(1, ...week.map((d) => d.focusSeconds));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* المؤقت */}
        <View style={[styles.timerCard, shadows.card]}>
          <LinearGradient
            colors={phase === 'focus' ? [colors.burgundy, colors.burgundyLight] : [colors.success, colors.emerald]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.timerBg}>
            <View style={styles.phaseRow}>
              <Timer size={18} color={colors.white} />
              <Text style={[styles.phaseText, rtlTextStyle]}>
                {phase === 'focus' ? `تركيز عميق — الدورة ${formatNumber(cycle)}` : 'راحة — خذ نفسًا ☕'}
              </Text>
            </View>
            <Text style={styles.clock}>{fmt(remaining)}</Text>
            {/* شريط التقدم */}
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            {/* الأزرار */}
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={reset}>
                <RotateCcw size={20} color={colors.white} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.playBtn} activeOpacity={0.8} onPress={toggle}>
                {running ? (
                  <Pause size={30} color={colors.burgundy} />
                ) : (
                  <Play size={30} color={colors.burgundy} />
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={skip}>
                <SkipForward size={20} color={colors.white} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.hintText, rtlTextStyle]}>
              {phase === 'focus' ? 'ركّز على الدراسة — تُسجَّل الجلسة عند اكتمالها' : 'استرح قليلًا ثم عُد أقوى 💪'}
            </Text>
          </LinearGradient>
        </View>

        {/* إحصائيات اليوم */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, shadows.card]}>
            <Flame size={20} color={colors.burgundy} />
            <Text style={[styles.statNum, rtlTextStyle]}>{today.sessions}</Text>
            <Text style={[styles.statLbl, rtlTextStyle]}>{'جلسات اليوم'}</Text>
          </View>
          <View style={[styles.statCard, shadows.card]}>
            <Timer size={20} color={colors.burgundy} />
            <Text style={[styles.statNum, rtlTextStyle]}>
              {fmtMinutes(today.focusSeconds)}
            </Text>
            <Text style={[styles.statLbl, rtlTextStyle]}>{'تركيز اليوم'}</Text>
          </View>
        </View>

        {/* الرسم الأسبوعي */}
        <View style={[styles.weekCard, shadows.card]}>
          <Text style={[styles.weekTitle, rtlTextStyle]}>{'تركيز آخر ٧ أيام'}</Text>
          <View style={styles.barsRow}>
            {week.map((d, i) => {
              const dt = new Date(d.date + 'T12:00:00');
              const dayName = AR_DAYS[dt.getDay()] ?? '';
              const h = Math.max(4, Math.round((d.focusSeconds / maxWeekSecs) * 90));
              const isToday = i === week.length - 1;
              return (
                <View key={d.date || i} style={styles.barCol}>
                  <View
                    style={[
                      styles.bar,
                      { height: h, backgroundColor: isToday ? colors.burgundy : '#E7C9CD' },
                    ]}
                  />
                  <Text style={[styles.barDay, isToday && styles.barDayActive, rtlTextStyle]}>
                    {dayName.slice(0, 4)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

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
    timerCard: { borderRadius: radius.lg, overflow: 'hidden' },
    timerBg: { padding: 24, alignItems: 'center', gap: 14 },
    phaseRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    phaseText: {
      fontFamily: 'tajawal',
      fontSize: 15,
      fontWeight: '700',
      color: colors.white,
    },
    clock: {
      fontFamily: 'tajawal',
      fontSize: 64,
      fontWeight: '700',
      color: colors.white,
      fontVariant: ['tabular-nums'],
    },
    progressTrack: {
      width: '100%',
      height: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.25)',
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: '#FFFFFF',
    },
    btnRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 4 },
    playBtn: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    hintText: {
      fontFamily: 'tajawal',
      fontSize: 12,
      color: 'rgba(255,255,255,0.85)',
      textAlign: 'center',
    },
    statsRow: { flexDirection: 'row', gap: 12 },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderBurgundy,
      padding: 16,
      alignItems: 'center',
      gap: 6,
    },
    statNum: {
      fontFamily: 'tajawal',
      fontSize: 20,
      fontWeight: '700',
      color: colors.burgundy,
    },
    statLbl: { fontFamily: 'tajawal', fontSize: 12, color: colors.textSecondary },
    weekCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderBurgundy,
      padding: 16,
      gap: 12,
    },
    weekTitle: {
      fontFamily: 'tajawal',
      fontSize: 15,
      fontWeight: '700',
      color: colors.burgundy,
    },
    barsRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-around',
      height: 130,
    },
    barCol: { alignItems: 'center', gap: 6, flex: 1 },
    bar: { width: 26, borderRadius: 8 },
    barDay: { fontFamily: 'tajawal', fontSize: 10, color: colors.textSecondary },
    barDayActive: { color: colors.burgundy, fontWeight: '700' },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 10,
    },
    backText: { fontFamily: 'tajawal', fontSize: 13, color: colors.textSecondary },
  });
