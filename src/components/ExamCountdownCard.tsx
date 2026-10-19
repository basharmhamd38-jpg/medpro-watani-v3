// بطاقة العد التنازلي للامتحان الوطني — أعلى الرئيسية (ليست تبويبًا مستقلًا)
// الموعد من app_config/exam (لوحة المالك). الضغط يفتح خطة دراسية مقترحة.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppModal } from './AppModal';
import { AppText as Text } from './AppText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import { CalendarClock, Target, X } from 'lucide-react-native';
import { usePulseLoop } from '../utils/animations';
import { rtlTextStyle } from '../utils/bidi';
import { formatNumber } from '../utils/numbers';
import { useTheme, type ThemeColors } from '../theme';
import {
  arabicDaysLabel,
  arabicDaysUnit,
  daysUntil,
  fetchExamDate,
  formatArabicDate,
  type ExamDateInfo,
} from '../exam/examDate';
import { getActivityStats } from '../gamification/profile';
import {
  fetchClinicalSubjects,
  fetchPracticeModels,
  fetchUWorldSubjects,
} from '../bank/quizBank';

const TOTAL_CACHE_KEY = 'exam_total_questions';
const TOTAL_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 ساعة
const PREP_YEAR_DAYS = 365;

async function getTotalQuestions(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(TOTAL_CACHE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p.total === 'number' && Date.now() - p.at < TOTAL_CACHE_TTL) {
        return p.total;
      }
    }
  } catch {
    /* تجاهل */
  }
  try {
    const [uw, clin, models] = await Promise.all([
      fetchUWorldSubjects(),
      fetchClinicalSubjects(),
      fetchPracticeModels(),
    ]);
    const sum = (arr: { questionCount: number | null }[]) =>
      arr.reduce((a, s) => a + (s.questionCount || 0), 0);
    const total = sum(uw) + sum(clin) + sum(models);
    if (total > 0) {
      AsyncStorage.setItem(
        TOTAL_CACHE_KEY,
        JSON.stringify({ total, at: Date.now() }),
      ).catch(() => {});
    }
    return total;
  } catch {
    return 0;
  }
}

export default function ExamCountdownCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const pulse = usePulseLoop(0.92, 1, 1100);

  const [info, setInfo] = useState<ExamDateInfo | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loadingPlan, setLoadingPlan] = useState(false);

  useEffect(() => {
    fetchExamDate().then(setInfo).catch(() => {});
    getActivityStats().then((s) => setAnswered(s.questionsAnswered || 0)).catch(() => {});
    getTotalQuestions().then(setTotalQuestions).catch(() => {});
  }, []);

  const daysLeft = info && info.isConfigured ? daysUntil(info.iso) : null;

  const openPlan = useCallback(() => {
    if (!info || !info.isConfigured || daysLeft === null || daysLeft <= 0) return;
    setLoadingPlan(true);
    Promise.all([getActivityStats(), getTotalQuestions()])
      .then(([s, total]) => {
        setAnswered(s.questionsAnswered || 0);
        setTotalQuestions(total);
      })
      .catch(() => {})
      .finally(() => {
        setLoadingPlan(false);
        setModalOpen(true);
      });
  }, [info, daysLeft]);

  const remaining = Math.max(0, totalQuestions - answered);
  const dailyTarget =
    daysLeft !== null && daysLeft > 0 && remaining > 0
      ? Math.ceil(remaining / daysLeft)
      : 0;
  const progress =
    daysLeft !== null && daysLeft > 0
      ? Math.min(1, Math.max(0, (PREP_YEAR_DAYS - daysLeft) / PREP_YEAR_DAYS))
      : 1;

  const cardBody = (
    <LinearGradient
      colors={[colors.burgundy, colors.burgundyLight]}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.card}>
      {info === null ? (
        <ActivityIndicator size="small" color={colors.white} style={{ marginVertical: 18 }} />
      ) : !info.isConfigured ? (
        <View style={styles.row}>
          <CalendarClock size={30} color={colors.gold} strokeWidth={2} />
          <View style={styles.textCol}>
            <Text style={[styles.title, rtlTextStyle]}>
              {'الامتحان الوطني الموحد'}
            </Text>
            <Text style={[styles.sub, rtlTextStyle]}>
              {'موعد الامتحان يُعلن قريبًا — تابعنا!'}
            </Text>
          </View>
        </View>
      ) : daysLeft !== null && daysLeft <= 0 ? (
        <View style={styles.row}>
          <Target size={30} color={colors.gold} strokeWidth={2} />
          <View style={styles.textCol}>
            <Text style={[styles.title, rtlTextStyle]}>
              {'حان وقت الامتحان!'}
            </Text>
            <Text style={[styles.sub, rtlTextStyle]}>
              {'بالتوفيق يا بطل — ثق بتحضيرك 🩺'}
            </Text>
          </View>
        </View>
      ) : (
        <View>
          <View style={styles.row}>
            <View style={styles.textCol}>
              <Text style={[styles.kicker, rtlTextStyle]}>
                {'الامتحان الوطني الموحد'}
              </Text>
              <View style={styles.daysRow}>
                <Animated.View style={{ transform: [{ scale: pulse }] }}>
                  <Text style={[styles.bigNumber, rtlTextStyle]}>
                    {formatNumber(daysLeft)}
                  </Text>
                </Animated.View>
                <Text style={[styles.daysUnit, rtlTextStyle]}>
                  {arabicDaysUnit(daysLeft || 0)}
                </Text>
              </View>
              <Text style={[styles.sub, rtlTextStyle]}>
                {`بقي ${arabicDaysLabel(daysLeft || 0)} على الامتحان`}
              </Text>
            </View>
            <CalendarClock size={40} color={colors.gold} strokeWidth={1.8} />
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <View style={styles.footerRow}>
            <Text style={[styles.footerText, rtlTextStyle]}>
              {formatArabicDate(info.iso)}
            </Text>
            <Text style={[styles.footerText, rtlTextStyle]}>
              {'اضغط لعرض خطتك 📋'}
            </Text>
          </View>
        </View>
      )}
    </LinearGradient>
  );

  return (
    <View style={styles.wrap}>
      {info && info.isConfigured && daysLeft !== null && daysLeft > 0 ? (
        <TouchableOpacity onPress={openPlan} activeOpacity={0.9} disabled={loadingPlan}>
          {cardBody}
        </TouchableOpacity>
      ) : (
        cardBody
      )}

      <AppModal visible={modalOpen} onClose={() => setModalOpen(false)}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, rtlTextStyle]}>
                {'📋 خطتك للحاق بالامتحان'}
              </Text>
              <TouchableOpacity onPress={() => setModalOpen(false)} hitSlop={12}>
                <X size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalLine, rtlTextStyle]}>
              {`⏳ المتبقي: ${arabicDaysLabel(daysLeft || 0)}`}
            </Text>
            {totalQuestions > 0 ? (
              <>
                <Text style={[styles.modalLine, rtlTextStyle]}>
                  {`📚 أسئلة البنك المتبقية: ${formatNumber(remaining)}`}
                </Text>
                <View style={styles.targetBox}>
                  <Text style={[styles.targetLabel, rtlTextStyle]}>
                    {'هدفك اليومي'}
                  </Text>
                  <Text style={[styles.targetValue, rtlTextStyle]}>
                    {`${formatNumber(dailyTarget)} سؤال`}
                  </Text>
                  <Text style={[styles.targetHint, rtlTextStyle]}>
                    {'كل يوم — لتصل للامتحان وقد غطيت البنك كاملًا'}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={[styles.modalLine, rtlTextStyle]}>
                {'💡 حافظ على وتيرة يومية ثابتة — الاستمرارية تصنع الفرق!'}
              </Text>
            )}
            <Text style={[styles.modalMotivation, rtlTextStyle]}>
              {'الثبات على الوتيرة أهم من الحماس المؤقت. ابدأ اليوم! 💪'}
            </Text>
            <TouchableOpacity
              style={styles.modalBtn}
              activeOpacity={0.85}
              onPress={() => setModalOpen(false)}>
              <Text style={[styles.modalBtnText, rtlTextStyle]}>{'حسنًا، لنبدأ!'}</Text>
            </TouchableOpacity>
          </View>
      </AppModal>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { marginBottom: 12 },
    card: {
      borderRadius: 18,
      padding: 16,
      elevation: 4,
      shadowColor: colors.burgundy,
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    textCol: { flex: 1 },
    kicker: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.gold,
      textAlign: 'right',
      writingDirection: 'rtl',
      marginBottom: 2,
    },
    daysRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    bigNumber: {
      fontSize: 44,
      fontWeight: '700',
      color: colors.white,
      textAlign: 'right',
      writingDirection: 'rtl',
      includeFontPadding: false,
    },
    daysUnit: {
      fontSize: 18,
      fontWeight: '700',
      color: '#F8D7DA',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.white,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    sub: {
      fontSize: 14,
      fontWeight: '400',
      color: '#F3D9DC',
      textAlign: 'right',
      writingDirection: 'rtl',
      marginTop: 4,
    },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.25)',
      marginTop: 12,
      overflow: 'hidden',
    },
    progressFill: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.gold,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    footerText: {
      fontSize: 12,
      fontWeight: '400',
      color: '#F3D9DC',
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    modalCard: {
      width: '100%',
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.title,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    modalLine: {
      fontSize: 15,
      fontWeight: '400',
      color: colors.text,
      textAlign: 'right',
      writingDirection: 'rtl',
      marginBottom: 8,
    },
    targetBox: {
      backgroundColor: colors.bg,
      borderRadius: 14,
      padding: 14,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: colors.borderBurgundy,
    },
    targetLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    targetValue: {
      fontSize: 30,
      fontWeight: '700',
      color: colors.burgundy,
      textAlign: 'right',
      writingDirection: 'rtl',
      marginVertical: 4,
      includeFontPadding: false,
    },
    targetHint: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    modalMotivation: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.burgundy,
      textAlign: 'right',
      writingDirection: 'rtl',
      marginTop: 8,
    },
    modalBtn: {
      backgroundColor: colors.burgundy,
      borderRadius: 12,
      paddingVertical: 12,
      marginTop: 14,
      alignItems: 'center',
    },
    modalBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  });
