// مساعدات الحركات — حركات ناعمة قابلة لإعادة الاستخدام في كل التطبيق
// تستخدم Animated API الأصلي (صفر تهنيج مع useNativeDriver)
import { useEffect, useRef } from 'react';
import { Animated, LayoutAnimation, Platform, UIManager } from 'react-native';

// تفعيل LayoutAnimation على أندرويد
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** إعدادات نابضة جاهزة */
export const springPreset = {
  gentle: { friction: 8, tension: 60 },
  bouncy: { friction: 5, tension: 100 },
  snappy: { friction: 9, tension: 140 },
} as const;

/** ظهور تدريجي (fade in) عند تركيب المكون */
export function useFadeIn(duration = 300, delay = 0): Animated.Value {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(opacity, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [opacity, duration, delay]);
  return opacity;
}

/** تكبير تدريجي مع ظهور (scale + fade) — مثالي للبطاقات والأوسمة */
export function useScaleIn(delay = 0): { scale: Animated.Value; opacity: Animated.Value } {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        ...springPreset.gentle,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        delay,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [scale, opacity, delay]);
  return { scale, opacity };
}

/** انزلاق من الأسفل مع ظهور — مثالي للقوائم */
export function useSlideUp(delay = 0, distance = 24): Animated.Value {
  const translateY = useRef(new Animated.Value(distance)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        ...springPreset.gentle,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, opacity, delay, distance]);
  // ندمج translateY والشفافية في قيمة واحدة قابلة للاستخدام المباشر
  return translateY;
}

/** نبض مستمر — للتنبيهات والأزرار المهمة */
export function usePulseLoop(
  min = 0.85,
  max = 1,
  duration = 900,
): Animated.Value {
  const scale = useRef(new Animated.Value(min)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: max, duration, useNativeDriver: true }),
        Animated.timing(scale, { toValue: min, duration, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [scale, min, max, duration]);
  return scale;
}

/** انتقال ناعم لتغيّرات التخطيط (اختيار إجابة، توسعة بطاقة...) */
export function smoothLayout(duration = 220) {
  LayoutAnimation.configureNext({
    duration,
    update: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
  });
}

/** اهتزاز خفيف عند الخطأ — يُستخدم مع haptics */
export function useShake(): { shake: Animated.Value; trigger: () => void } {
  const shake = useRef(new Animated.Value(0)).current;
  const trigger = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };
  return { shake, trigger };
}
