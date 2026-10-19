// بطاقة مشاركة الوسام — تصميم فاخر للمشاركة كصورة
// تُستخدم مع react-native-view-shot لالتقاطها ثم مشاركتها
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import LinearGradient from 'react-native-linear-gradient';
import { Award } from 'lucide-react-native';
import type { BadgeDef } from '../gamification/achievements';
import { bidi } from '../utils/bidi';
import { formatNumber } from '../utils/numbers';
import { colors } from '../theme';

export interface ShareCardData {
  badge: BadgeDef;
  userName: string;
  date: string; // نص التاريخ المعروض
  totalXP: number;
  level: number;
  streak: number;
}

/**
 * بطاقة الوسام القابلة للمشاركة.
 * ملاحظة view-shot: العنصر الجذري collapsable={false}، والمرجع يُمرَّر كـ prop
 */
export default function AchievementShareCard({
  data,
}: {
  data: ShareCardData;
}) {
  const { badge, userName, date, totalXP, level, streak } = data;
  const Icon = badge.icon;

  return (
    <LinearGradient
      colors={['#4A0F18', '#7A1F2B', '#A63A4A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}>
        {/* زخرفة علوية */}
        <View style={styles.topOrnament}>
          <View style={styles.goldLine} />
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>M</Text>
          </View>
          <Text style={styles.appName}>{bidi('Med pro - وطني')}</Text>
          <View style={styles.goldLine} />
        </View>

        {/* الوسام */}
        <View style={styles.badgeCircle}>
          <View style={styles.badgeInner}>
            <Icon size={64} color={badge.color} strokeWidth={1.6} />
          </View>
        </View>

        <Text style={styles.congrats}>{'🏆 وسام جديد!'}</Text>
        <Text style={styles.badgeTitle}>{bidi(badge.title)}</Text>
        <Text style={styles.badgeDesc}>{bidi(badge.description)}</Text>

        {/* المستخدم والتاريخ */}
        <View style={styles.userRow}>
          <Text style={styles.userName}>{bidi(userName)}</Text>
          <Text style={styles.dateText}>{bidi(date)}</Text>
        </View>

        {/* الإحصائيات */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {formatNumber(totalXP)}
            </Text>
            <Text style={styles.statLabel}>{bidi('نقطة XP')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatNumber(level)}</Text>
            <Text style={styles.statLabel}>{'المستوى'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {formatNumber(streak)}
            </Text>
            <Text style={styles.statLabel}>{'أيام متتالية'}</Text>
          </View>
        </View>

        {/* التذييل */}
        <View style={styles.footer}>
          <Award size={14} color={colors.gold} />
          <Text style={styles.footerText}>
            {'استعد للامتحان الوطني بذكاء — حمّل التطبيق'}
          </Text>
        </View>
      </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 340,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  topOrnament: {
    alignItems: 'center',
    marginBottom: 18,
  },
  goldLine: {
    width: 120,
    height: 2,
    backgroundColor: colors.gold,
    opacity: 0.7,
    borderRadius: 1,
    marginVertical: 8,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  logoText: {
    fontSize: 30,
    fontWeight: '700',
    color: '#7A1F2B',
  },
  appName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    opacity: 0.95,
  },
  badgeCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: colors.gold,
  },
  badgeInner: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  congrats: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gold,
    marginBottom: 6,
  },
  badgeTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  badgeDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  userRow: {
    alignItems: 'center',
    marginBottom: 18,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dateText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 16,
    width: '100%',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
});
