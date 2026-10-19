// نافذة الاحتفال بفتح وسام جديد + المضيف العام (يُزرع في App.tsx)
import React, { useEffect, useRef, useState , useMemo } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppModal } from './AppModal';
import { AppText as Text } from './AppText';
import { PartyPopper, Share2 } from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../theme';
import { bidi } from '../utils/bidi';
import { onBadgesUnlocked, type BadgeDef } from '../gamification/achievements';
import ShareBadgeModal from './ShareBadgeModal';

function CelebrationCard({
  badge,
  onClose,
  onShare,
}: {
  badge: BadgeDef;
  onClose: () => void;
  onShare: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const scale = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const Icon = badge.icon;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [badge.id]);

  return (
    <Animated.View
      style={[
        styles.card,
        shadows.card,
        { transform: [{ scale }], opacity: fade },
      ]}>
      <View style={styles.popperRow}>
        <PartyPopper size={26} color={colors.burgundy} />
        <Text style={styles.congrats}>{'وسام جديد! 🎉'}</Text>
      </View>

      <View style={[styles.badgeCircle, { backgroundColor: badge.bg }]}>
        <Icon size={52} color={badge.color} strokeWidth={1.8} />
      </View>

      <Text style={styles.badgeTitle}>{bidi(badge.title)}</Text>
      <Text style={styles.badgeDesc}>{bidi(badge.description)}</Text>

      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.button, styles.shareButton]}
          activeOpacity={0.85}
          onPress={onShare}>
          <Share2 size={16} color={colors.burgundy} />
          <Text style={[styles.buttonText, styles.shareButtonText]}>
            {'مشاركة'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.85}
          onPress={onClose}>
          <Text style={styles.buttonText}>{'رائع!'}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

/** مضيف عام — يستمع لفتح الأوسمة ويعرضها واحدًا تلو الآخر */
export function BadgeCelebrationHost() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [queue, setQueue] = useState<BadgeDef[]>([]);
  const [current, setCurrent] = useState<BadgeDef | null>(null);
  const [shareBadge, setShareBadge] = useState<BadgeDef | null>(null);

  useEffect(() => {
    return onBadgesUnlocked((badges) => {
      if (badges.length > 0) {
        setQueue((q) => [...q, ...badges]);
      }
    });
  }, []);

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [queue, current]);

  const close = () => setCurrent(null);

  return (
    <AppModal visible={!!current} onClose={close}>
        {current && (
          <CelebrationCard
            key={current.id}
            badge={current}
            onClose={close}
            onShare={() => setShareBadge(current)}
          />
        )}
      <ShareBadgeModal
        badge={shareBadge}
        visible={!!shareBadge}
        onClose={() => setShareBadge(null)}
      />
    </AppModal>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
  },
  popperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  congrats: {
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 20,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'right',
    marginEnd: 8,
    writingDirection: 'rtl',
  },
  badgeCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  badgeTitle: {
    fontFamily: 'tajawal',
    fontSize: 19,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: 6,
  },
  badgeDesc: {
    fontFamily: 'tajawal',
    fontSize: 13.5,
    color: colors.textSecondary,
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: 20,
    marginBottom: 18,
  },
  button: {
    backgroundColor: colors.burgundy,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 48,
  },
  buttonText: {
    fontFamily: 'tajawal',
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  shareButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.burgundy,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shareButtonText: {
    color: colors.burgundy,
  },
});
