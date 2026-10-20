// الرسوم البيانية للتقدم — خط XP الأسبوعي + دونات إتقان المواد
// خفيف: react-native-svg فقط (مثبت مسبقًا)
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText as Text } from './AppText';
import Svg, { Polyline, Circle, G, Line, Text as SvgText } from 'react-native-svg';
import { TrendingUp, PieChart } from 'lucide-react-native';
import { useTheme, type ThemeColors } from '../theme';
import { rtlTextStyle } from '../utils/bidi';
import { formatNumber } from '../utils/numbers';

// ─── مخطط خطي: XP آخر 4 أسابيع ───
interface LineChartProps {
  weeklyXP: number[]; // 4 قيم
}

function WeeklyLineChart({ weeklyXP }: LineChartProps) {
  const { colors } = useTheme();
  const W = 300;
  const H = 120;
  const PAD = 24;

  const { points, maxVal } = useMemo(() => {
    const max = Math.max(...weeklyXP, 10);
    const stepX = (W - PAD * 2) / Math.max(weeklyXP.length - 1, 1);
    const pts = weeklyXP.map((v, i) => {
      const x = PAD + i * stepX;
      const y = H - PAD - (v / max) * (H - PAD * 2);
      return `${x},${y}`;
    });
    return { points: pts.join(' '), maxVal: max };
  }, [weeklyXP]);

  const areaPoints = `${PAD},${H - PAD} ${points} ${W - PAD},${H - PAD}`;

  const weekLabels = ['قبل 3 أسابيع', 'قبل أسبوعين', 'الأسبوع الماضي', 'هذا الأسبوع'];

  return (
    <View>
      <Svg width={W} height={H + 18} viewBox={`0 0 ${W} ${H + 18}`}>
        {/* خطوط الشبكة */}
        {[0.25, 0.5, 0.75].map((f) => {
          const y = PAD + f * (H - PAD * 2);
          return (
            <Line
              key={f}
              x1={PAD}
              x2={W - PAD}
              y1={y}
              y2={y}
              stroke={colors.border}
              strokeWidth={0.5}
              strokeDasharray="3,3"
            />
          );
        })}
        {/* منطقة التعبئة */}
        <Polyline
          points={areaPoints}
          fill={colors.burgundy}
          fillOpacity={0.08}
          stroke="none"
        />
        {/* الخط */}
        <Polyline
          points={points}
          fill="none"
          stroke={colors.burgundy}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* النقاط */}
        {weeklyXP.map((v, i) => {
          const stepX = (W - PAD * 2) / Math.max(weeklyXP.length - 1, 1);
          const x = PAD + i * stepX;
          const y = H - PAD - (v / maxVal) * (H - PAD * 2);
          return (
            <G key={i}>
              <Circle cx={x} cy={y} r={4} fill={colors.burgundy} />
              <Circle cx={x} cy={y} r={7} fill={colors.burgundy} fillOpacity={0.15} />
            </G>
          );
        })}
        {/* التسميات */}
        {weekLabels.slice(0, weeklyXP.length).map((label, i) => {
          const stepX = (W - PAD * 2) / Math.max(weeklyXP.length - 1, 1);
          const x = PAD + i * stepX;
          return (
            <SvgText
              key={i}
              x={x}
              y={H + 14}
              fontSize={8}
              fontFamily="tajawal"
              fill={colors.textMuted}
              textAnchor="middle">
              {label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

// ─── دونات: إتقان المواد ───
interface DonutProps {
  segments: { label: string; value: number; color: string }[];
}

function MasteryDonut({ segments }: DonutProps) {
  const { colors } = useTheme();
  const SIZE = 130;
  const R = 50;
  const CIRC = 2 * Math.PI * R;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;

  let acc = 0;
  const arcs = segments.map((seg) => {
    const frac = seg.value / total;
    const dash = frac * CIRC;
    const offset = acc * CIRC;
    acc += frac;
    return { ...seg, dash, offset, frac };
  });

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <G rotation={-90} origin={`${SIZE / 2}, ${SIZE / 2}`}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={colors.border}
            strokeWidth={18}
          />
          {arcs.map((a, i) => (
            <Circle
              key={i}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth={18}
              strokeDasharray={`${a.dash} ${CIRC - a.dash}`}
              strokeDashoffset={-a.offset}
              strokeLinecap="butt"
            />
          ))}
        </G>
        <SvgText
          x={SIZE / 2}
          y={SIZE / 2 - 2}
          fontSize={20}
          fontWeight="bold"
          fontFamily="tajawal"
          fill={colors.burgundy}
          textAnchor="middle">
          {`${formatNumber(Math.round((arcs[0]?.frac || 0) * 100))}٪`}
        </SvgText>
        <SvgText
          x={SIZE / 2}
          y={SIZE / 2 + 16}
          fontSize={10}
          fontFamily="tajawal"
          fill={colors.textSecondary}
          textAnchor="middle">
          إتقان
        </SvgText>
      </Svg>
      {/* مفتاح الألوان */}
      <View style={{ marginTop: 8, gap: 4 }}>
        {segments.map((s, i) => (
          <View
            key={i}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: s.color,
              }}
            />
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>
              {s.label} ({formatNumber(s.value)})
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── المكوّن الرئيسي ───
interface Props {
  weeklyXP: number[];
  subjectMastery: { label: string; value: number; color: string }[];
}

export default function ProgressCharts({ weeklyXP, subjectMastery }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View>
      {/* مخطط XP الأسبوعي */}
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <TrendingUp size={18} color={colors.burgundy} />
          <Text style={[styles.title, rtlTextStyle]}>نقاط XP الأسبوعية</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <WeeklyLineChart weeklyXP={weeklyXP} />
        </View>
      </View>

      {/* دونات إتقان المواد */}
      {subjectMastery.length > 0 && (
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <PieChart size={18} color={colors.burgundy} />
            <Text style={[styles.title, rtlTextStyle]}>إتقان المواد</Text>
          </View>
          <MasteryDonut segments={subjectMastery} />
        </View>
      )}
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
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.title,
    },
  });

// ألوان مقترحة لشرائح الدونات — مشتقة من الثيم (تتبع الوضع الليلي)
export function getDonutColors(c: ThemeColors): string[] {
  return [
    c.burgundy,
    c.burgundyLight,
    '#C4747F',
    c.amber,
    c.success,
    '#6366F1',
  ];
}
