// نتيجة الحالة الافتراضية — التقييم + الشرح + النقاط التعليمية + منح XP
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import {
  Award,
  CheckCircle2,
  Lightbulb,
  RotateCcw,
  Trophy,
  XCircle,
} from 'lucide-react-native';
import { radius, useTheme, type ThemeColors } from '../../theme';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import { formatNumber } from '../../utils/numbers';
import type { CaseScore, VirtualCase } from '../../virtual/types';
import { saveCaseResult } from '../../virtual/store';
import { recordActivity } from '../../gamification/profile';

function gradeOf(
  colors: ThemeColors,
  total: number,
): { label: string; color: string } {
  if (total >= 85) return { label: 'ممتاز', color: colors.emerald };
  if (total >= 70) return { label: 'جيد جدًا', color: colors.success };
  if (total >= 50) return { label: 'مقبول', color: colors.amber };
  return { label: 'يحتاج مراجعة', color: colors.error };
}

export default function VirtualCaseResult({
  caseData,
  score,
  onReplay,
  onBack,
}: {
  caseData: VirtualCase;
  score: CaseScore;
  onReplay: () => void;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [saved, setSaved] = useState(false);
  const awarded = useRef(false);
  const grade = gradeOf(colors, score.total);

  useEffect(() => {
    if (awarded.current) return;
    awarded.current = true;
    (async () => {
      try {
        await saveCaseResult(caseData.id, score.total);
        await recordActivity('virtual_case', score.xpEarned, {
          casesCompleted: 1,
          questionsAnswered: score.keyHistoryAsked,
        });
        setSaved(true);
      } catch {
        setSaved(true);
      }
    })();
  }, [caseData.id, score]);

  const rows: { label: string; value: string; ok: boolean }[] = [
    {
      label: 'الأسئلة المحورية',
      value: `${formatNumber(score.keyHistoryAsked)}/${formatNumber(score.keyHistoryTotal)}`,
      ok: score.keyHistoryAsked === score.keyHistoryTotal,
    },
    {
      label: 'الفحوصات المحورية',
      value: `${formatNumber(score.keyExamsDone)}/${formatNumber(score.keyExamsTotal)}`,
      ok: score.keyExamsDone === score.keyExamsTotal,
    },
    {
      label: 'الاستقصاءات المحورية',
      value: `${formatNumber(score.keyTestsOrdered)}/${formatNumber(score.keyTestsTotal)}`,
      ok: score.keyTestsOrdered === score.keyTestsTotal,
    },
    {
      label: 'التشخيص الصحيح',
      value: score.diagnosisCorrect ? 'نعم' : 'لا',
      ok: score.diagnosisCorrect,
    },
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={[styles.scoreCard, { borderColor: grade.color }]}>
        <Trophy size={40} color={grade.color} />
        <Text style={[styles.scoreNum, { color: grade.color }, rtlTextStyle]}>
          {`${formatNumber(score.total)}٪`}
        </Text>
        <Text style={[styles.scoreLabel, rtlTextStyle]}>
          {bidi(grade.label)}
        </Text>
        <View style={styles.xpRow}>
          <Award size={16} color={colors.burgundy} />
          <Text style={[styles.xpText, rtlTextStyle]}>
            {bidi(`+${formatNumber(score.xpEarned)} XP`)}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={[styles.cardTitle, rtlTextStyle]}>{'تفصيل التقييم'}</Text>
        {rows.map((r) => (
          <View key={r.label} style={styles.row}>
            <View style={styles.rowLabel}>
              {r.ok ? (
                <CheckCircle2 size={16} color={colors.success} />
              ) : (
                <XCircle size={16} color={colors.error} />
              )}
              <Text style={[styles.rowLabelText, rtlTextStyle]}>
                {r.label}
              </Text>
            </View>
            <Text style={[styles.rowValue, rtlTextStyle]}>{r.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={[styles.cardTitle, rtlTextStyle]}>
          {'التشخيص الصحيح'}
        </Text>
        <View style={styles.dxBox}>
          <CheckCircle2 size={18} color={colors.emerald} />
          <Text style={[styles.dxText, rtlTextStyle]}>
            {bidi(caseData.correctDiagnosis)}
          </Text>
        </View>
        <Text style={[styles.cardTitle2, rtlTextStyle]}>
          {'لماذا هذا التشخيص؟'}
        </Text>
        <Text style={[styles.body, rtlTextStyle]}>{bidi(caseData.explanation)}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.lpHeader}>
          <Lightbulb size={18} color={colors.burgundy} />
          <Text style={[styles.cardTitle, rtlTextStyle]}>
            {'نقاط تعليمية'}
          </Text>
        </View>
        {caseData.learningPoints.map((p, i) => (
          <View key={i} style={styles.lpRow}>
            <View style={styles.lpDot} />
            <Text style={[styles.lpText, rtlTextStyle]}>{bidi(p)}</Text>
          </View>
        ))}
      </View>

      {saved ? null : (
        <Text style={[styles.saving, rtlTextStyle]}>
          {'جارٍ حفظ النتيجة...'}
        </Text>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.replayBtn}
          onPress={onReplay}
          activeOpacity={0.8}>
          <RotateCcw size={18} color={colors.white} />
          <Text style={styles.replayText}>{'إعادة المحاولة'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          activeOpacity={0.8}>
          <Text style={[styles.backText, rtlTextStyle]}>
            {'عودة للحالات'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: 14, paddingBottom: 28 },
    scoreCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 2,
      padding: 22,
      alignItems: 'center',
      marginBottom: 12,
    },
    scoreNum: { fontSize: 44, fontWeight: '700', marginTop: 8 },
    scoreLabel: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      writingDirection: 'ltr',
      marginTop: 4,
    },
    xpRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
    },
    xpText: { fontSize: 15, color: colors.burgundy, fontWeight: '700', marginEnd: 4 },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: 16,
      marginBottom: 12,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'left',
      writingDirection: 'ltr',
      marginBottom: 10,
    },
    cardTitle2: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'left',
      writingDirection: 'ltr',
      marginTop: 14,
      marginBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.bg,
    },
    rowLabel: { flexDirection: 'row', alignItems: 'center' },
    rowLabelText: {
      fontSize: 14,
      color: colors.text,
      marginEnd: 6,
      fontWeight: '400',
    },
    rowValue: { fontSize: 14, color: colors.textMuted, fontWeight: '700' },
    dxBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#16A34A1A',
      borderRadius: radius.md,
      padding: 12,
    },
    dxText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.emerald,
      marginEnd: 8,
      flex: 1,
      textAlign: 'left',
      writingDirection: 'ltr',
    },
    body: {
      fontSize: 14,
      color: colors.text,
      textAlign: 'left',
      writingDirection: 'ltr',
      lineHeight: 25,
    },
    lpHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    lpRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    lpDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.burgundy,
      marginTop: 7,
      marginStart: 8,
    },
    lpText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      textAlign: 'left',
      writingDirection: 'ltr',
      lineHeight: 24,
    },
    saving: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      writingDirection: 'ltr',
      marginBottom: 8,
    },
    actions: { flexDirection: 'row', marginTop: 4 },
    replayBtn: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: colors.burgundy,
      borderRadius: radius.lg,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginStart: 8,
    },
    replayText: { color: colors.white, fontSize: 15, fontWeight: '700', marginEnd: 6 },
    backBtn: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backText: { fontSize: 15, fontWeight: '700', color: colors.text },
  });
