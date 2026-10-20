// بطاقة توصية ذكية — تُعرض في الرئيسية
import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText as Text } from './AppText';
import { Flame, BookOpen, Target, Zap, CalendarDays, Trophy, ChevronLeft } from 'lucide-react-native';
import { useTheme, type ThemeColors } from '../theme';
import { bidi } from '../utils/bidi';
import type { Recommendation } from '../utils/recommendations';

const ICONS: Record<Recommendation['icon'], React.ComponentType<{ size?: number; color?: string }>> = {
  flame: Flame,
  book: BookOpen,
  target: Target,
  zap: Zap,
  calendar: CalendarDays,
  trophy: Trophy,
};

function iconColors(colors: ThemeColors): Record<Recommendation['icon'], string> {
  return {
    flame: '#EA580C',
    book: colors.burgundy,
    target: colors.error,
    zap: colors.amber,
    calendar: colors.success,
    trophy: colors.amberText,
  };
}

interface Props {
  recommendation: Recommendation;
  onPress: (targetTab: string) => void;
}

export default function RecommendationCard({ recommendation, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const Icon = ICONS[recommendation.icon];
  const iconColor = iconColors(colors)[recommendation.icon];

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(recommendation.targetTab)}
      activeOpacity={0.85}>
      <View style={[styles.iconWrap, { backgroundColor: iconColor + '15' }]}>
        <Icon size={22} color={iconColor} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{bidi(recommendation.title)}</Text>
        <Text style={styles.body}>{bidi(recommendation.body)}</Text>
        <Text style={styles.action}>{bidi(recommendation.actionLabel)} ‹</Text>
      </View>
      <ChevronLeft size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginVertical: 6,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    iconWrap: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textWrap: {
      flex: 1,
    },
    title: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.title,
      textAlign: 'left',
      writingDirection: 'ltr',
      marginBottom: 2,
    },
    body: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'left',
      writingDirection: 'ltr',
      marginBottom: 4,
    },
    action: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.burgundy,
      textAlign: 'left',
      writingDirection: 'ltr',
    },
  });
