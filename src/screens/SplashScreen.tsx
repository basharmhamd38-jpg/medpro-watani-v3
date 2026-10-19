// شاشة البداية المتحركة — شعار M يتكبّر مع توهج ثم ينتقل للتطبيق
// تُعرض أثناء تهيئة قاعدة البيانات والتحقق من الجلسة
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Image, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme, type ThemeColors } from '../theme';
import { bidi } from '../utils/bidi';

const { width: W } = Dimensions.get('window');
const LOGO_SIZE = Math.min(W * 0.32, 128);

export default function SplashScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const textY = useRef(new Animated.Value(16)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // 1) الشعار يظهر بتكبير ناعم
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // 2) توهج خفيف حول الشعار
      Animated.timing(glow, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      // 3) اسم التطبيق ينزلق من الأسفل
      Animated.parallel([
        Animated.spring(textY, {
          toValue: 0,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [scale, opacity, glow, textY, textOpacity]);

  return (
    <LinearGradient
      colors={[colors.burgundy, colors.burgundyDeep, '#3D0F16']}
      style={styles.container}>
      {/* توهج خلف الشعار */}
      <Animated.View
        style={[
          styles.glow,
          {
            opacity: glow,
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] }) }],
          },
        ]}
      />
      {/* الشعار */}
      <Animated.View
        style={[
          styles.logoWrap,
          { opacity, transform: [{ scale }] },
        ]}>
        <Image
          source={require('../../assets/app-icon.jpg')}
          style={styles.logo}
          resizeMode="cover"
        />
      </Animated.View>
      {/* اسم التطبيق */}
      <Animated.View
        style={{
          opacity: textOpacity,
          transform: [{ translateY: textY }],
          alignItems: 'center',
        }}>
        <Text style={styles.title}>{bidi('Med pro - وطني')}</Text>
        <Text style={styles.subtitle}>
          {'رفيقك للامتحان الطبي الوطني'}
        </Text>
      </Animated.View>
    </LinearGradient>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    glow: {
      position: 'absolute',
      width: LOGO_SIZE * 2.4,
      height: LOGO_SIZE * 2.4,
      borderRadius: LOGO_SIZE * 1.2,
      backgroundColor: 'rgba(217, 165, 168, 0.18)',
    },
    logoWrap: {
      width: LOGO_SIZE,
      height: LOGO_SIZE,
      borderRadius: LOGO_SIZE / 2,
      overflow: 'hidden',
      borderWidth: 3,
      borderColor: 'rgba(255,255,255,0.25)',
      // ظل ناعم
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 12,
    },
    logo: { width: '100%', height: '100%' },
    title: {
      marginTop: 24,
      fontSize: 26,
      fontWeight: '700',
      color: colors.white,
      textAlign: 'center',
    },
    subtitle: {
      marginTop: 8,
      fontSize: 14,
      color: colors.burgundyLight,
      textAlign: 'center',
    },
  });
