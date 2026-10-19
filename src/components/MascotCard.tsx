// بطاقة التميمة المحفزة — شخصية الروبوت مع نصيحة يومية
// تصميم احترافي بهوية التطبيق (عنابي) — منفصلة تمامًا عن شعار التطبيق
import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText as Text } from './AppText';
import { X, Sparkles } from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../theme';
import { bidi, rtlTextStyle } from '../utils/bidi';
import {
  CATEGORY_LABELS,
  getTipOfDay,
  getCongratsMessage,
  type MascotExpression,
} from '../data/motivationalTips';

const MASCOT_IMAGES: Record<MascotExpression, any> = {
  main: require('../assets/mascot_main.webp'),
  happy: require('../assets/mascot_happy.webp'),
  wink: require('../assets/mascot_wink.webp'),
  thinking: require('../assets/mascot_thinking.webp'),
};

const DISMISS_KEY_PREFIX = 'mascot_dismissed_';

function todayKey(): string {
  const d = new Date();
  return `${DISMISS_KEY_PREFIX}${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

interface Props {
  /** daily: نصيحة اليوم (قابلة للإغلاق) | congrats: تهنئة بعد الاختبار */
  variant?: 'daily' | 'congrats';
  /** نسبة النتيجة — لنسخة التهنئة */
  scorePct?: number;
}

export default function MascotCard({ variant = 'daily', scorePct = 0 }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [dismissed, setDismissed] = useState(false);

  const isCongrats = variant === 'congrats';
  const tip = useMemo(() => getTipOfDay(), []);
  const congrats = useMemo(
    () => (isCongrats ? getCongratsMessage(scorePct) : null),
    [isCongrats, scorePct],
  );

  const expression: MascotExpression = isCongrats
    ? congrats!.expression
    : 'wink';
  const message = isCongrats ? congrats!.text : tip.text;
  const label = isCongrats
    ? 'تهنئة من رفيقك'
    : CATEGORY_LABELS[tip.category];

  useEffect(() => {
    if (isCongrats) return;
    AsyncStorage.getItem(todayKey())
      .then((v) => {
        if (v === '1') setDismissed(true);
      })
      .catch(() => {});
  }, [isCongrats]);

  const handleDismiss = () => {
    setDismissed(true);
    if (!isCongrats) {
      AsyncStorage.setItem(todayKey(), '1').catch(() => {});
    }
  };

  if (dismissed) return null;

  return (
    <View style={[styles.card, shadows.card]}>
      {/* زر الإغلاق */}
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={handleDismiss}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <X size={16} color={colors.textMuted} />
      </TouchableOpacity>

      <View style={styles.row}>
        {/* صورة التميمة — في بداية السطر (اليمين) */}
        <View style={styles.imageWrap}>
          <Image
            source={MASCOT_IMAGES[expression]}
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        {/* النص — يبدأ من اليمين */}
        <View style={styles.textCol}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{label}</Text>
            <Sparkles size={13} color={colors.burgundyLight} />
          </View>
          <Text style={styles.message}>{bidi(message)}</Text>
        </View>
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.borderBurgundy,
      padding: 14,
      position: 'relative',
      overflow: 'hidden',
    },
    closeBtn: {
      position: 'absolute',
      top: 8,
      start: 8,
      zIndex: 2,
      padding: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    imageWrap: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.borderBurgundy,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      flexShrink: 0,
    },
    image: {
      width: 68,
      height: 68,
    },
    textCol: {
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 5,
    },
    label: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.burgundyLight,
      ...rtlTextStyle,
      textAlign: 'right',
    },
    message: {
      fontSize: 13.5,
      fontWeight: '400',
      color: colors.title,
      lineHeight: 22,
      ...rtlTextStyle,
      textAlign: 'right',
    },
  });
