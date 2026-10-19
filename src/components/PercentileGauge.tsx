// عدّاد المرتبة المئوية — قوس SVG أنيق يعرض «أنت أفضل من X%»
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { Crown } from 'lucide-react-native';
import { useTheme, type ThemeColors } from '../theme';
import { formatNumber } from '../utils/numbers';

const W = 220;
const H = 130;
const R = 88;
const CX = W / 2;
const CY = 118;

function polar(angleDeg: number): [number, number] {
  const a = ((180 - angleDeg) * Math.PI) / 180;
  return [CX + R * Math.cos(a), CY - R * Math.sin(a)];
}

function arcPath(fromDeg: number, toDeg: number): string {
  const [x1, y1] = polar(fromDeg);
  const [x2, y2] = polar(toDeg);
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;
}

export default function PercentileGauge({
  percentile,
  rank,
  total,
  avgXP,
  myXP,
}: {
  percentile: number;
  rank: number;
  total: number;
  avgXP: number;
  myXP: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const pct = Math.max(0, Math.min(100, percentile));
  const filledTo = (pct / 100) * 180;

  const message =
    pct >= 90
      ? 'مذهل! أنت من النخبة'
      : pct >= 70
        ? 'أداء قوي جدًا'
        : pct >= 50
          ? 'فوق المتوسط — واصل'
          : pct >= 25
            ? 'بداية جيدة — استمر'
            : 'كل رحلة تبدأ بخطوة';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Crown size={18} color={colors.gold} />
        <Text style={styles.title}>مقارنة مع زملائك</Text>
      </View>

      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path
          d={arcPath(0, 180)}
          stroke={colors.border}
          strokeWidth={16}
          fill="none"
          strokeLinecap="round"
        />
        {filledTo > 2 && (
          <Path
            d={arcPath(0, filledTo)}
            stroke={colors.burgundy}
            strokeWidth={16}
            fill="none"
            strokeLinecap="round"
          />
        )}
        <SvgText
          x={CX}
          y={CY - 34}
          textAnchor="middle"
          fontSize={34}
          fontWeight="800"
          fontFamily="tajawal"
          fill={colors.burgundy}>
          {`${formatNumber(pct)}٪`}
        </SvgText>
        <SvgText
          x={CX}
          y={CY - 10}
          textAnchor="middle"
          fontSize={12}
          fontFamily="tajawal"
          fill={colors.textMuted}>
          أنت أفضل من
        </SvgText>
      </Svg>

      <Text style={styles.message}>{message}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          {`الترتيب: ${formatNumber(rank)} من ${formatNumber(total)}`}
        </Text>
        <Text style={styles.meta}>
          {`متوسط النقاط: ${formatNumber(avgXP)} — نقاطك: ${formatNumber(myXP)}`}
        </Text>
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    message: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.burgundy,
      marginTop: 2,
    },
    metaRow: {
      marginTop: 10,
      alignItems: 'center',
      gap: 2,
    },
    meta: {
      fontSize: 12,
      color: colors.textMuted,
    },
  });
