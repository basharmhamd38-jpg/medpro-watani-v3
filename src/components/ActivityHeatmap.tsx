// خريطة النشاط الحرارية — بأسلوب GitHub contributions
// تعرض نشاط الدراسة اليومي (XP) على شبكة أسابيع × أيام
import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText as Text } from './AppText';
import { Flame } from 'lucide-react-native';
import { useTheme, type ThemeColors } from '../theme';
import { rtlTextStyle } from '../utils/bidi';

const WEEKS = 16; // 16 أسبوعًا ≈ 4 أشهر
const DAY = 86400000;

function damascusDayStart(offsetDays: number): Date {
  // بداية اليوم بتوقيت دمشق
  const now = new Date();
  const damascus = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Damascus' })
  );
  damascus.setHours(0, 0, 0, 0);
  damascus.setDate(damascus.getDate() + offsetDays);
  return damascus;
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** شدة اللون الأخضر حسب XP اليومي */
function intensityColor(xp: number, colors: ThemeColors): string {
  if (xp <= 0) return colors.border;
  if (xp < 20) return '#C6E8C6';
  if (xp < 50) return '#93D493';
  if (xp < 100) return '#5CB85C';
  if (xp < 200) return '#2E9E44';
  return '#1A7A2E';
}

interface Props {
  xpHistory: Record<string, number>;
  onDayPress?: (date: string, xp: number) => void;
}

export default function ActivityHeatmap({ xpHistory, onDayPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const weeks = useMemo(() => {
    // نبني شبكة: 7 صفوف (أيام الأسبوع) × 16 عمودًا (أسابيع)
    const today = damascusDayStart(0);
    // نبدأ من يوم السبت قبل 16 أسبوعًا (محاذاة الشبكة)
    const startOffset = -(WEEKS * 7 - 1) - ((today.getDay() + 1) % 7);
    const grid: { date: string; xp: number; isFuture: boolean }[][] = [];
    for (let w = 0; w < WEEKS; w++) {
      const col: { date: string; xp: number; isFuture: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const dayDate = damascusDayStart(startOffset + w * 7 + d);
        const key = dateKey(dayDate);
        const isFuture = dayDate.getTime() > today.getTime() + DAY;
        col.push({ date: key, xp: isFuture ? 0 : xpHistory[key] || 0, isFuture });
      }
      grid.push(col);
    }
    return grid;
  }, [xpHistory]);

  const stats = useMemo(() => {
    let totalXP = 0;
    let activeDays = 0;
    let maxXP = 0;
    Object.values(xpHistory).forEach((xp) => {
      if (xp > 0) {
        totalXP += xp;
        activeDays++;
        if (xp > maxXP) maxXP = xp;
      }
    });
    return { totalXP, activeDays, maxXP };
  }, [xpHistory]);

  const monthLabels = useMemo(() => {
    // تسميات الأشهر فوق الأعمدة
    const labels: { week: number; label: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((col, w) => {
      const [y, m] = col[0].date.split('-').map(Number);
      if (m !== lastMonth) {
        lastMonth = m;
        const monthNames = [
          '', 'ينا', 'فبر', 'مار', 'أبر', 'ماي', 'يون',
          'يول', 'أغس', 'سبت', 'أكت', 'نوف', 'ديس',
        ];
        labels.push({ week: w, label: monthNames[m] || '' });
      }
    });
    return labels;
  }, [weeks]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Flame size={18} color={colors.amber} />
          <Text style={[styles.title, rtlTextStyle]}>خريطة النشاط</Text>
        </View>
        <Text style={[styles.subtitle, rtlTextStyle]}>
          {stats.activeDays} يوم نشط • {stats.totalXP} XP إجمالي
        </Text>
      </View>

      <View style={styles.gridWrap}>
        {/* تسميات الأشهر */}
        <View style={styles.monthRow}>
          {monthLabels.map((ml) => (
            <Text
              key={ml.week}
              style={[styles.monthLabel, { right: ml.week * 17 }]}>
              {ml.label}
            </Text>
          ))}
        </View>
        {/* الشبكة — RTL: الأحدث على اليمين */}
        <View style={styles.grid}>
          {[...weeks].reverse().map((col, wi) => (
            <View key={wi} style={styles.column}>
              {col.map((cell, di) => (
                <TouchableOpacity
                  key={di}
                  activeOpacity={cell.xp > 0 ? 0.7 : 1}
                  disabled={cell.isFuture || cell.xp === 0}
                  onPress={() => onDayPress?.(cell.date, cell.xp)}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: cell.isFuture
                        ? 'transparent'
                        : intensityColor(cell.xp, colors),
                      opacity: cell.isFuture ? 0 : 1,
                    },
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* مفتاح الألوان */}
      <View style={styles.legend}>
        <Text style={[styles.legendText, rtlTextStyle]}>أقل</Text>
        {[0, 10, 40, 90, 180].map((xp) => (
          <View
            key={xp}
            style={[
              styles.legendCell,
              { backgroundColor: intensityColor(xp, colors) },
            ]}
          />
        ))}
        <Text style={[styles.legendText, rtlTextStyle]}>أكثر</Text>
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      marginBottom: 12,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.title,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    subtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    gridWrap: {
      alignItems: 'center',
    },
    monthRow: {
      height: 16,
      width: WEEKS * 17,
      position: 'relative',
      marginBottom: 4,
      flexDirection: 'row',
    },
    monthLabel: {
      position: 'absolute',
      fontSize: 9,
      color: colors.textMuted,
    },
    grid: {
      flexDirection: 'row',
      gap: 3,
    },
    column: {
      gap: 3,
    },
    cell: {
      width: 14,
      height: 14,
      borderRadius: 3,
    },
    legend: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 3,
      marginTop: 10,
    },
    legendCell: {
      width: 11,
      height: 11,
      borderRadius: 2,
    },
    legendText: {
      fontSize: 10,
      color: colors.textMuted,
      marginHorizontal: 4,
    },
  });
