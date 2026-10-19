// شاشة الأوسمة والإنجازات — عرض الشارات المفتوحة والمغلقة مع التقدم
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { useFocusEffect } from '@react-navigation/native';
import { Lock } from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { bidi } from '../../utils/bidi';
import { formatNumber } from '../../utils/numbers';
import {
  BADGES,
  getBadgesWithProgress,
  damascusHour,
  type BadgeDef,
} from '../../gamification/achievements';
import {
  getProfile,
  getActivityStats,
} from '../../gamification/profile';

interface BadgeRow {
  def: BadgeDef;
  unlocked: boolean;
  progress: number;
  unlockedAt?: string;
}

function BadgeCard({ row }: { row: BadgeRow }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { def, unlocked, progress } = row;
  const Icon = def.icon;
  const pct = def.target > 0 ? Math.min(100, Math.round((progress / def.target) * 100)) : 0;

  return (
    <View
      style={[
        styles.card,
        shadows.card,
        !unlocked && styles.cardLocked,
      ]}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: unlocked ? def.bg : '#F1F1F1' },
        ]}>
        <Icon
          size={34}
          color={unlocked ? def.color : '#B0B0B0'}
          strokeWidth={1.8}
        />
      </View>
      <Text style={[styles.title, !unlocked && styles.titleLocked]}>
        {bidi(def.title)}
      </Text>
      <Text style={styles.desc}>{bidi(def.description)}</Text>

      {unlocked ? (
        <View style={styles.unlockedPill}>
          <Text style={styles.unlockedText}>{'مفتوح ✓'}</Text>
        </View>
      ) : (
        <View style={styles.progressWrap}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${pct}%`,
                  backgroundColor: def.color,
                },
              ]}
            />
          </View>
          <View style={styles.progressRow}>
            <Lock size={12} color={colors.textMuted} />
            <Text style={styles.progressText}>
              {bidi(`${formatNumber(progress)} / ${formatNumber(def.target)}${def.unit ? ' ' + def.unit : ''}`)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

export default function BadgesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [rows, setRows] = useState<BadgeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [profile, stats] = await Promise.all([
        getProfile(),
        getActivityStats(),
      ]);
      const list = await getBadgesWithProgress({
        profile,
        stats,
        subjectsAttempted: profile.subjectsAttempted || [],
        perfectScores: 0,
        perfectScoreNow: false,
        hour: damascusHour(),
      });
      setRows(list);
    } catch {
      // إبقاء القائمة الفارغة
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const unlockedCount = rows.filter((r) => r.unlocked).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>{'الإنجازات والأوسمة'}</Text>
      <Text style={styles.sub}>
        {`فتحت ${formatNumber(unlockedCount)} من ${formatNumber(BADGES.length)} أوسمة — استمر!`}
      </Text>

      {loading ? (
        <Text style={styles.loadingText}>{'جارٍ التحميل...'}</Text>
      ) : (
        <View style={styles.grid}>
          {rows.map((row) => (
            <View key={row.def.id} style={styles.gridItem}>
              <BadgeCard row={row} />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    fontFamily: 'tajawal',
    fontSize: 20,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 4,
  },
  sub: {
    fontFamily: 'tajawal',
    fontSize: 13.5,
    color: colors.textSecondary,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 16,
  },
  loadingText: {
    fontFamily: 'tajawal',
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  gridItem: {
    width: '50%',
    padding: 6,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: 'center',
    minHeight: 210,
  },
  cardLocked: {
    opacity: 0.85,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontFamily: 'tajawal',
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: 4,
  },
  titleLocked: {
    color: colors.textSecondary,
  },
  desc: {
    fontFamily: 'tajawal',
    fontSize: 11.5,
    color: colors.textMuted,
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: 17,
    marginBottom: 10,
    flex: 1,
  },
  unlockedPill: {
    backgroundColor: colors.successBg,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  unlockedText: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  progressWrap: {
    width: '100%',
  },
  progressBar: {
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.borderFaint,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    fontFamily: 'tajawal',
    fontSize: 11.5,
    color: colors.textMuted,
    marginEnd: 4,
    writingDirection: 'rtl',
  },
});
