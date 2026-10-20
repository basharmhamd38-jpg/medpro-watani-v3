// مشغّل الحالة الافتراضية — سيناريو تفاعلي بخطوات:
// العرض ← الأسئلة ← الفحص السريري ← الاستقصاءات ← التشخيص
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  HelpCircle,
  MessageCircleQuestion,
  Stethoscope,
} from 'lucide-react-native';
import { radius, useTheme, type ThemeColors } from '../../theme';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import type { CaseScore, VirtualCase } from '../../virtual/types';

type Step = 'presentation' | 'history' | 'examinations' | 'tests' | 'diagnosis';

const STEPS: { key: Step; label: string; icon: any }[] = [
  { key: 'presentation', label: 'العرض', icon: ClipboardList },
  { key: 'history', label: 'القصة', icon: MessageCircleQuestion },
  { key: 'examinations', label: 'الفحص', icon: Stethoscope },
  { key: 'tests', label: 'الاستقصاءات', icon: FlaskConical },
  { key: 'diagnosis', label: 'التشخيص', icon: HelpCircle },
];

const ORDER: Step[] = ['presentation', 'history', 'examinations', 'tests', 'diagnosis'];

const AR_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز'];

export default function VirtualCasePlayer({
  caseData,
  onBack,
  onFinish,
}: {
  caseData: VirtualCase;
  onBack: () => void;
  onFinish: (score: CaseScore) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [step, setStep] = useState<Step>('presentation');
  const [askedIds, setAskedIds] = useState<Set<string>>(new Set());
  const [examIds, setExamIds] = useState<Set<string>>(new Set());
  const [testIds, setTestIds] = useState<Set<string>>(new Set());
  const [diagnosis, setDiagnosis] = useState<string | null>(null);

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const toggle = (
    id: string,
    set: Set<string>,
    setter: (s: Set<string>) => void,
  ) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const computeScore = (): CaseScore => {
    const keyH = caseData.history.filter((q) => q.isKey);
    const keyE = caseData.examinations.filter((e) => e.isKey);
    const keyT = caseData.tests.filter((t) => t.isKey);
    const h = keyH.filter((q) => askedIds.has(q.id)).length;
    const e = keyE.filter((x) => examIds.has(x.id)).length;
    const t = keyT.filter((x) => testIds.has(x.id)).length;
    const dxOk = diagnosis === caseData.correctDiagnosis;
    // التقييم: القصة 25% + الفحص 15% + الاستقصاءات 25% + التشخيص 35%
    const hScore = keyH.length ? (h / keyH.length) * 25 : 25;
    const eScore = keyE.length ? (e / keyE.length) * 15 : 15;
    const tScore = keyT.length ? (t / keyT.length) * 25 : 25;
    const dxScore = dxOk ? 35 : 0;
    const total = Math.round(hScore + eScore + tScore + dxScore);
    const xpEarned = Math.round((caseData.xpReward * total) / 100);
    return {
      keyHistoryAsked: h,
      keyHistoryTotal: keyH.length,
      keyExamsDone: e,
      keyExamsTotal: keyE.length,
      keyTestsOrdered: t,
      keyTestsTotal: keyT.length,
      diagnosisCorrect: dxOk,
      total,
      xpEarned,
    };
  };

  const next = () => {
    const i = ORDER.indexOf(step);
    if (i < ORDER.length - 1) setStep(ORDER[i + 1]);
  };

  const prev = () => {
    const i = ORDER.indexOf(step);
    if (i > 0) setStep(ORDER[i - 1]);
  };

  const renderRevealItem = (
    id: string,
    title: string,
    revealed: string,
    opened: boolean,
    onToggle: () => void,
    isKey: boolean,
  ) => (
    <View key={id} style={styles.item}>
      <TouchableOpacity
        style={styles.itemBtn}
        onPress={onToggle}
        activeOpacity={0.7}>
        <View style={styles.itemRow}>
          <View style={[styles.check, opened && styles.checkOn]}>
            {opened ? <CheckCircle2 size={18} color={colors.white} /> : null}
          </View>
          <View style={styles.itemTextWrap}>
            <Text style={[styles.itemTitle, rtlTextStyle]}>{bidi(title)}</Text>
            {isKey ? (
              <Text style={[styles.keyTag, rtlTextStyle]}>
                {'سؤال محوري'}
              </Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
      {opened ? (
        <View style={styles.answerBox}>
          <Text style={[styles.answerText, rtlTextStyle]}>{bidi(revealed)}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowRight size={20} color={colors.text} />
          <Text style={[styles.backText, rtlTextStyle]}>{'الحالات'}</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, rtlTextStyle]} numberOfLines={1}>
          {bidi(caseData.title)}
        </Text>
      </View>

      <View style={styles.stepper}>
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === stepIndex;
          const done = i < stepIndex;
          return (
            <View key={s.key} style={styles.stepItem}>
              <View
                style={[
                  styles.stepDot,
                  active && styles.stepDotActive,
                  done && styles.stepDotDone,
                ]}>
                <Icon
                  size={15}
                  color={active || done ? colors.white : colors.textMuted}
                />
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  active && styles.stepLabelActive,
                  rtlTextStyle,
                ]}>
                {bidi(s.label)}
              </Text>
            </View>
          );
        })}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {step === 'presentation' && (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, rtlTextStyle]}>
              {'عرض الحالة'}
            </Text>
            <Text style={[styles.body, rtlTextStyle]}>
              {bidi(caseData.presentation)}
            </Text>
            {caseData.sourceNote ? (
              <Text style={[styles.sourceNote, rtlTextStyle]}>
                {bidi(`المصدر: ${caseData.source} — ${caseData.sourceNote}`)}
              </Text>
            ) : null}
          </View>
        )}

        {step === 'history' && (
          <View>
            <Text style={[styles.sectionHint, rtlTextStyle]}>
              {'اختر الأسئلة التي تريد طرحها على المريض — الأسئلة المحورية تؤثر في تقييمك'}
            </Text>
            {caseData.history.map((q) =>
              renderRevealItem(
                q.id,
                q.text,
                q.answer,
                askedIds.has(q.id),
                () => toggle(q.id, askedIds, setAskedIds),
                q.isKey,
              ),
            )}
          </View>
        )}

        {step === 'examinations' && (
          <View>
            <Text style={[styles.sectionHint, rtlTextStyle]}>
              {'اختر الفحوصات السريرية التي تريد إجراءها'}
            </Text>
            {caseData.examinations.map((e) =>
              renderRevealItem(
                e.id,
                e.text,
                e.finding,
                examIds.has(e.id),
                () => toggle(e.id, examIds, setExamIds),
                e.isKey,
              ),
            )}
          </View>
        )}

        {step === 'tests' && (
          <View>
            <Text style={[styles.sectionHint, rtlTextStyle]}>
              {'اطلب الاستقصاءات المخبرية والشعاعية اللازمة'}
            </Text>
            {caseData.tests.map((t) =>
              renderRevealItem(
                t.id,
                t.text,
                t.result,
                testIds.has(t.id),
                () => toggle(t.id, testIds, setTestIds),
                t.isKey,
              ),
            )}
          </View>
        )}

        {step === 'diagnosis' && (
          <View>
            <Text style={[styles.sectionHint, rtlTextStyle]}>
              {'بناءً على القصة والفحص والاستقصاءات — ما تشخيصك؟'}
            </Text>
            {caseData.diagnosisOptions.map((opt, i) => {
              const selected = diagnosis === opt;
              return (
                <TouchableOpacity
                  key={`dx-${i}`}
                  style={[styles.opt, selected && styles.optSelected]}
                  onPress={() => setDiagnosis(opt)}
                  activeOpacity={0.7}>
                  <View style={styles.optRow}>
                    <View
                      style={[styles.optLetter, selected && styles.optLetterOn]}>
                      <Text
                        style={[
                          styles.optLetterText,
                          selected && styles.optLetterTextOn,
                        ]}>
                        {AR_LETTERS[i] || '•'}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.optText,
                        selected && styles.optTextOn,
                        rtlTextStyle,
                      ]}>
                      {bidi(opt)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {stepIndex > 0 && (
          <TouchableOpacity
            style={styles.prevBtn}
            onPress={prev}
            activeOpacity={0.8}
            accessibilityLabel="الخطوة السابقة">
            <Text style={[styles.prevText, rtlTextStyle]}>{'› السابق'}</Text>
          </TouchableOpacity>
        )}
        {step === 'diagnosis' ? (
          <TouchableOpacity
            style={[styles.nextBtn, styles.nextBtnFlex, !diagnosis && styles.nextBtnDisabled]}
            onPress={() => diagnosis && onFinish(computeScore())}
            disabled={!diagnosis}
            activeOpacity={0.8}>
            <Text style={styles.nextText}>{'إظهار النتيجة'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, styles.nextBtnFlex]}
            onPress={next}
            activeOpacity={0.8}>
            <Text style={styles.nextText}>
              {bidi(
                step === 'presentation'
                  ? 'ابدأ بأخذ القصة'
                  : step === 'history'
                    ? 'انتقل للفحص السريري'
                    : step === 'examinations'
                      ? 'اطلب الاستقصاءات'
                      : 'ضع التشخيص',
              )}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { flex: 1 },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center' },
    backText: { fontSize: 14, color: colors.text, marginEnd: 4, fontWeight: '400' },
    topTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: colors.textMuted,
      textAlign: 'center',
    },
    stepper: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 10,
      paddingHorizontal: 8,
      backgroundColor: colors.card,
      marginHorizontal: 14,
      borderRadius: radius.lg,
    },
    stepItem: { alignItems: 'center', flex: 1 },
    stepDot: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepDotActive: { backgroundColor: colors.burgundy },
    stepDotDone: { backgroundColor: colors.emerald },
    stepLabel: { fontSize: 10, color: colors.textMuted, marginTop: 4 },
    stepLabelActive: { color: colors.burgundy, fontWeight: '700' },
    scroll: { flex: 1 },
    content: { padding: 14, paddingBottom: 20 },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: 16,
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 10,
    },
    body: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 26,
    },
    sourceNote: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 12,
      fontStyle: 'italic',
    },
    sectionHint: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 10,
      lineHeight: 20,
    },
    item: { marginBottom: 10 },
    itemBtn: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: 13,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    itemTextWrap: { flex: 1 },
    itemTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    keyTag: {
      fontSize: 10,
      color: colors.burgundy,
      marginTop: 3,
      fontWeight: '700',
    },
    check: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.textMuted,
      marginStart: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: colors.emerald, borderColor: colors.emerald },
    answerBox: {
      backgroundColor: colors.bg,
      borderRadius: radius.md,
      padding: 12,
      marginTop: 6,
      borderRightWidth: 3,
      borderRightColor: colors.burgundy,
    },
    answerText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 24,
    },
    opt: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: 13,
      marginBottom: 10,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    optSelected: { borderColor: colors.burgundy },
    optRow: { flexDirection: 'row', alignItems: 'center' },
    optLetter: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      marginStart: 10,
    },
    optLetterOn: { backgroundColor: colors.burgundy },
    optLetterText: { fontSize: 14, fontWeight: '700', color: colors.text },
    optLetterTextOn: { color: colors.white },
    optText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      fontWeight: '400',
    },
    optTextOn: { color: colors.burgundy },
    footer: { flexDirection: 'row', padding: 14, paddingBottom: 20, gap: 10 },
    nextBtn: {
      backgroundColor: colors.burgundy,
      borderRadius: radius.lg,
      paddingVertical: 14,
      alignItems: 'center',
    },
    nextBtnFlex: { flex: 1 },
    prevBtn: {
      borderRadius: radius.lg,
      paddingVertical: 14,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    prevText: {
      color: colors.burgundy,
      fontSize: 15,
      fontWeight: '800',
      fontFamily: 'tajawal',
    },
    nextBtnDisabled: { opacity: 0.45 },
    nextText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  });
