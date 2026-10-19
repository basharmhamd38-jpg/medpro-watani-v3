// بطاقة الإحصائيات المتقدمة — تُعرض في تبويب «تقدمي»
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import {
  BarChart3,
  Clock,
  Crosshair,
  Flame,
  Timer,
} from 'lucide-react-native';
import type { AdvancedStats } from '../gamification/advancedStats';
import { useTheme, type ThemeColors } from '../theme';
import { bidi } from '../utils/bidi';
import { formatNumber } from '../utils/numbers';

function StatRow({
  icon,
  label,
  value,
  colors,
  styles,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  colors: ThemeColors;
  styles: any;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={styles.rowLabel}>{bidi(label)}</Text>
      <Text style={styles.rowValue}>{bidi(value)}</Text>
    </View>
  );
}

export default function AdvancedStatsCard({ stats }: { stats: AdvancedStats }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  if (!stats.hasData) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <BarChart3 size={18} color={colors.burgundy} />
          <Text style={styles.title}>{'إحصائيات متقدمة'}</Text>
        </View>
        <Text style={styles.empty}>
          {'ابدأ بحل الأسئلة وستظهر إحصائياتك التفصيلية هنا'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <BarChart3 size={18} color={colors.burgundy} />
        <Text style={styles.title}>{'إحصائيات متقدمة'}</Text>
      </View>

      <StatRow
        icon={<Clock size={16} color={colors.burgundy} />}
        label="أفضل وقت للدراسة"
        value={stats.bestPeriodLabel}
        colors={colors}
        styles={styles}
      />
      <StatRow
        icon={<Crosshair size={16} color={colors.burgundy} />}
        label="متوسط الدقة"
        value={
          stats.accuracy !== null ? `${stats.accuracy}٪` : 'لا توجد بيانات'
        }
        colors={colors}
        styles={styles}
      />
      <StatRow
        icon={<Timer size={16} color={colors.burgundy} />}
        label="وقت الدراسة (تقديري)"
        value={`${formatNumber(stats.estimatedMinutes)} دقيقة`}
        colors={colors}
        styles={styles}
      />
      <StatRow
        icon={<Flame size={16} color={colors.burgundy} />}
        label="أطول سلسلة"
        value={`${formatNumber(stats.longestStreak)} أيام`}
        colors={colors}
        styles={styles}
      />

      {stats.mastery.length > 0 && (
        <View style={styles.masteryBox}>
          <Text style={styles.masteryTitle}>{'إتقان المواد'}</Text>
          {stats.mastery.map((m) => (
            <View key={m.subject} style={styles.masteryRow}>
              <View style={styles.masteryHead}>
                <Text style={styles.masteryName} numberOfLines={1}>
                  {bidi(m.subject)}
                </Text>
                <Text style={styles.masteryPct}>{`${m.pct}٪`}</Text>
              </View>
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${m.pct}%`,
                      backgroundColor:
                        m.pct >= 70
                          ? colors.emerald
                          : m.pct >= 40
                            ? colors.amber
                            : colors.burgundy,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    empty: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      paddingVertical: 12,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: colors.burgundy + '14',
      alignItems: 'center',
      justifyContent: 'center',
      marginStart: 10,
    },
    rowLabel: {
      flex: 1,
      fontSize: 13,
      color: colors.textMuted,
    },
    rowValue: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    masteryBox: {
      marginTop: 14,
    },
    masteryTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    masteryRow: {
      marginBottom: 10,
    },
    masteryHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    masteryName: {
      fontSize: 12,
      color: colors.text,
      flex: 1,
    },
    masteryPct: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.burgundy,
    },
    barBg: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    barFill: {
      height: 8,
      borderRadius: 4,
    },
  });
