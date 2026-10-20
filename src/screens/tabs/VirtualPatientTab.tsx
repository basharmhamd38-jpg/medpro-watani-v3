// المريض الافتراضي — قائمة الحالات السريرية التفاعلية (بدون AI)
// حالات مُعدّة مسبقًا من مصادر مرموقة (AHA / IDSA / AHA-ASA...)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Award,
  CheckCircle2,
  ChevronLeft,
  FlaskConical,
  Stethoscope,
} from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import LockScreen from '../../components/LockScreen';
import EmptyStateCard from '../../components/EmptyStateCard';
import ListSkeleton from '../../components/ListSkeleton';
import { radius, useTheme, type ThemeColors } from '../../theme';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import { formatNumber } from '../../utils/numbers';
import { canAccessTab } from '../../payment/gates';
import {
  DIFFICULTY_LABEL,
  type CaseDifficulty,
  type VirtualCase,
} from '../../virtual/types';
import { fetchVirtualCases, getCaseProgress } from '../../virtual/store';
import { enableSecureFlag, disableSecureFlag } from '../../secure';
import VirtualCasePlayer from '../virtual/VirtualCasePlayer';
import VirtualCaseResult from '../virtual/VirtualCaseResult';
import type { CaseScore } from '../../virtual/types';

type VPView = 'list' | 'player' | 'result';

function diffColors(colors: ThemeColors): Record<CaseDifficulty, string> {
  return {
    easy: colors.emerald,
    medium: colors.amber,
    hard: colors.error,
  };
}

// بطاقة حالة واحدة — W9: عنصر FlatList (افتراضية بدل ScrollView+map غير المحدود)
function CaseCard({
  c,
  done,
  best,
  colors,
  styles,
  onPress,
}: {
  c: VirtualCase;
  done: boolean;
  best: number | undefined;
  colors: ThemeColors;
  styles: ReturnType<typeof getStyles>;
  onPress: (c: VirtualCase) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(c)}
      activeOpacity={0.75}>
      <View style={styles.cardTop}>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, rtlTextStyle]}>
            {bidi(c.title)}
          </Text>
          <View style={styles.badges}>
            <View
              style={[
                styles.badge,
                { backgroundColor: diffColors(colors)[c.difficulty] + '1A' },
              ]}>
              <Text
                style={[
                  styles.badgeText,
                  { color: diffColors(colors)[c.difficulty] },
                  rtlTextStyle,
                ]}>
                {DIFFICULTY_LABEL[c.difficulty]}
              </Text>
            </View>
            <View style={styles.badgeSrc}>
              <Award size={12} color={colors.burgundy} />
              <Text
                style={[styles.badgeSrcText, rtlTextStyle]}>
                {bidi(c.source)}
              </Text>
            </View>
          </View>
        </View>
        <ChevronLeft size={20} color={colors.textMuted} />
      </View>
      <Text
        style={[styles.cardMeta, rtlTextStyle]}
        numberOfLines={2}>
        {bidi(
          `${c.specialty} • ${formatNumber(c.history.length)} أسئلة • ${formatNumber(c.examinations.length)} فحوصات • ${formatNumber(c.tests.length)} تحاليل • +${formatNumber(c.xpReward)} XP`,
        )}
      </Text>
      {done ? (
        <View style={styles.doneRow}>
          <CheckCircle2 size={14} color={colors.emerald} />
          <Text style={[styles.doneText, rtlTextStyle]}>
            {`مكتملة — أفضل نتيجة ${formatNumber(best || 0)}٪`}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export default function VirtualPatientTab() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [open, setOpen] = useState(true);
  const [gateReason, setGateReason] = useState('');
  const [view, setView] = useState<VPView>('list');
  const [cases, setCases] = useState<VirtualCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [specialty, setSpecialty] = useState<string>('الكل');
  const [activeCase, setActiveCase] = useState<VirtualCase | null>(null);
  const [lastScore, setLastScore] = useState<CaseScore | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [bestScores, setBestScores] = useState<Record<string, number>>({});

  // حماية المحتوى: منع لقطة الشاشة أثناء عرض الحالة أو النتيجة (FLAG_SECURE)
  useEffect(() => {
    if (view === 'player' || view === 'result') {
      enableSecureFlag();
      return () => {
        disableSecureFlag();
      };
    }
  }, [view]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const list = await fetchVirtualCases();
      setCases(list);
      const prog = await getCaseProgress();
      setCompletedIds(prog.completedIds);
      setBestScores(prog.bestScores);
    } catch {
      /* يبقى الفراغ */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const gate = canAccessTab('virtual');
      setOpen(gate.open);
      setGateReason(gate.reason || '');
      if (view === 'list') load();
    }, [load, view]),
  );

  const specialties = useMemo(() => {
    const set = new Set<string>();
    cases.forEach((c) => set.add(c.specialty));
    return ['الكل', ...[...set].sort()];
  }, [cases]);

  const filtered = useMemo(
    () =>
      specialty === 'الكل'
        ? cases
        : cases.filter((c) => c.specialty === specialty),
    [cases, specialty],
  );

  const startCase = (c: VirtualCase) => {
    setActiveCase(c);
    setLastScore(null);
    setView('player');
  };

  const finishCase = (score: CaseScore) => {
    setLastScore(score);
    setView('result');
    load();
  };

  const backToList = () => {
    setActiveCase(null);
    setLastScore(null);
    setView('list');
  };

  if (!open) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader />
        <LockScreen message={gateReason} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      {view === 'player' && activeCase ? (
        <VirtualCasePlayer
          caseData={activeCase}
          onBack={backToList}
          onFinish={finishCase}
        />
      ) : view === 'result' && activeCase && lastScore ? (
        <VirtualCaseResult
          caseData={activeCase}
          score={lastScore}
          onReplay={() => {
            setLastScore(null);
            setView('player');
          }}
          onBack={backToList}
        />
      ) : (
        <FlatList
          style={styles.scroll}
          contentContainerStyle={styles.content}
          data={loading ? [] : filtered}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <CaseCard
              c={item}
              done={completedIds.includes(item.id)}
              best={bestScores[item.id]}
              colors={colors}
              styles={styles}
              onPress={startCase}
            />
          )}
          ListHeaderComponent={
            <>
              <View style={styles.hero}>
                <View style={styles.heroText}>
                  <Text style={[styles.heroTitle, rtlTextStyle]}>
                    {'المريض الافتراضي'}
                  </Text>
                  <Text style={[styles.heroSub, rtlTextStyle]}>
                    {'حالات سريرية تفاعلية من مصادر مرموقة — اسأل، افحص، اطلب التحاليل، ثم شخّص'}
                  </Text>
                </View>
                <View style={styles.heroIcon}>
                  <Stethoscope size={30} color={colors.white} strokeWidth={2.2} />
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipsRow}
                contentContainerStyle={styles.chipsContent}>
                {specialties.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.chip,
                      specialty === s && styles.chipActive,
                    ]}
                    onPress={() => setSpecialty(s)}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.chipText,
                        specialty === s && styles.chipTextActive,
                        rtlTextStyle,
                      ]}>
                      {bidi(s)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          }
          ListEmptyComponent={
            loading ? (
              <ListSkeleton count={6} withBadge />
            ) : (
              <EmptyStateCard
                icon={FlaskConical}
                title="لا توجد حالات"
                message="لم تُضف حالات لهذا الاختصاص بعد"
              />
            )
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
          }
          // W9: افتراضية بدل رسم مئات البطاقات دفعة واحدة.
          // getItemLayout غير ممكن بأمان: ارتفاع البطاقة متغير (سطرا العنوان + صف الإنجاز الشرطي).
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={7}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    content: { padding: 14, paddingBottom: 28 },
    center: { paddingVertical: 40, alignItems: 'center' },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: 14,
      marginBottom: 12,
    },
    heroIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.burgundy,
      alignItems: 'center',
      justifyContent: 'center',
      marginEnd: 12,
    },
    heroText: { flex: 1 },
    heroTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    heroSub: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 4,
      lineHeight: 20,
    },
    chipsRow: { marginBottom: 10 },
    chipsContent: { flexDirection: 'row', paddingVertical: 2 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.card,
      marginStart: 8,
    },
    chipActive: { backgroundColor: colors.burgundy },
    chipText: { fontSize: 13, color: colors.text, fontWeight: '400' },
    chipTextActive: { color: colors.white },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: 14,
      marginBottom: 10,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardInfo: { flex: 1 },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    badges: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      marginStart: 8,
    },
    badgeText: { fontSize: 11, fontWeight: '700' },
    badgeSrc: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bg,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    badgeSrcText: {
      fontSize: 11,
      color: colors.burgundy,
      fontWeight: '700',
      marginEnd: 4,
    },
    cardMeta: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 8,
      lineHeight: 18,
    },
    doneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
    },
    doneText: { fontSize: 12, color: colors.emerald, marginEnd: 4, fontWeight: '400' },
  });
