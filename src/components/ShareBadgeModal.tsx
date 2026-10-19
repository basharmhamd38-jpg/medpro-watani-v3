// نافذة مشاركة الوسام — عرض البطاقة الفاخرة + التقاطها ومشاركتها كصورة
import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Share as RNShare, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppModal } from './AppModal';
import { AppText as Text } from './AppText';
import { Share2, X } from 'lucide-react-native';
import { captureRef } from 'react-native-view-shot';
import Share from 'react-native-share';
import AchievementShareCard, {
  type ShareCardData,
} from './AchievementShareCard';
import type { BadgeDef } from '../gamification/achievements';
import { getProfile, damascusDate } from '../gamification/profile';
import { getAuth } from '../auth/auth';
import { useTheme, type ThemeColors } from '../theme';

const APP_NAME = 'Med pro - وطني';

function userName(): string {
  try {
    const a = getAuth();
    return a.type === 'user' ? a.name || 'طالب طب' : 'طالب طب';
  } catch {
    return 'طالب طب';
  }
}

function todayLabel(): string {
  try {
    const d = damascusDate();
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  } catch {
    return '';
  }
}

/** مشاركة نصية احتياطية عند فشل التقاط الصورة */
async function shareBadgeText(badge: BadgeDef): Promise<void> {
  try {
    const profile = await getProfile().catch(
      () => ({ totalXP: 0, level: 1, currentStreak: 0 } as any),
    );
    const message =
      `🏆 فتحت وسام «${badge.title}» في ${APP_NAME}!\n` +
      `👨‍⚕️ ${userName()}\n` +
      `${badge.description}\n` +
      `⚡ المستوى ${profile.level} • ${profile.totalXP} XP • 🔥 ${profile.currentStreak} أيام\n\n` +
      `انضم إليّ واستعد للامتحان الوطني! 🩺`;
    await RNShare.share({ message, title: APP_NAME });
  } catch {
    /* ألغى المستخدم */
  }
}

export default function ShareBadgeModal({
  badge,
  visible,
  onClose,
}: {
  badge: BadgeDef | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const cardRef = useRef<any>(null);
  const [sharing, setSharing] = useState(false);
  const [cardData, setCardData] = useState<ShareCardData | null>(null);

  React.useEffect(() => {
    if (visible && badge) {
      getProfile()
        .then((p) =>
          setCardData({
            badge,
            userName: userName(),
            date: todayLabel(),
            totalXP: p.totalXP || 0,
            level: p.level || 1,
            streak: p.currentStreak || 0,
          }),
        )
        .catch(() =>
          setCardData({
            badge,
            userName: userName(),
            date: todayLabel(),
            totalXP: 0,
            level: 1,
            streak: 0,
          }),
        );
    } else {
      setCardData(null);
    }
  }, [visible, badge]);

  const doShare = async () => {
    if (!badge || sharing) return;
    setSharing(true);
    try {
      // التقاط البطاقة كصورة
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 0.9,
        result: 'tmpfile',
      });
      await Share.open({
        url: uri,
        type: 'image/png',
        title: `وسام ${badge.title} — ${APP_NAME}`,
        message: `🏆 فتحت وسام «${badge.title}» في ${APP_NAME}! انضم إليّ 🩺`,
        failOnCancel: false,
      });
    } catch {
      // احتياطي: مشاركة نصية
      await shareBadgeText(badge);
    } finally {
      setSharing(false);
    }
  };

  return (
    <AppModal visible={visible} onClose={onClose}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{'مشاركة الوسام'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <X size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.cardWrap}>
            {cardData && (
              <View ref={cardRef} collapsable={false} style={styles.captureBox}>
                <AchievementShareCard data={cardData} />
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.shareBtn}
            activeOpacity={0.85}
            onPress={doShare}
            disabled={sharing}>
            {sharing ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Share2 size={18} color={colors.white} />
                <Text style={styles.shareText}>{'مشاركة كصورة'}</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.hint}>
            {'ستُشارك بطاقة الوسام كصورة جميلة مع أصدقائك'}
          </Text>
        </View>
    </AppModal>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sheet: {
      backgroundColor: colors.bg,
      borderRadius: 24,
      padding: 18,
      width: '100%',
      maxWidth: 400,
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      marginBottom: 14,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
    },
    cardWrap: {
      borderRadius: 24,
      overflow: 'hidden',
      marginBottom: 16,
      // تصغير طفيف ليناسب الشاشات الصغيرة
      transform: [{ scale: 0.92 }],
    },
    captureBox: {
      borderRadius: 24,
      overflow: 'hidden',
    },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.burgundy,
      borderRadius: 14,
      paddingVertical: 13,
      paddingHorizontal: 28,
    },
    shareText: {
      color: colors.white,
      fontSize: 15,
      fontWeight: '700',
    },
    hint: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 10,
      textAlign: 'center',
    },
  });
