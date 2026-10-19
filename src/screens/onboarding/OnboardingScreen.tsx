// شاشة التعريف — 4 شرائح تمريرية عند أول تشغيل فقط
import React, { useMemo, useRef, useState } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { BookOpen, Brain, ChevronLeft, Trophy } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme, type ThemeColors } from '../../theme';
import { completeOnboarding } from '../../onboarding/store';
import { bidi, rtlTextStyle } from '../../utils/bidi';

const { width: SCREEN_W } = Dimensions.get('window');

interface Slide {
  key: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  title: string;
  desc: string;
  points: string[];
}

const SLIDES: Slide[] = [
  {
    key: 'welcome',
    icon: BookOpen,
    title: 'أهلاً بك في Med pro - وطني',
    desc: 'رفيقك الذكي للتحضير للامتحان الطبي الوطني الموحد',
    points: ['بنك أسئلة ضخم مصنّف', 'يعمل أوفلاين بالكامل', 'تتبع تقدمك أولًا بأول'],
  },
  {
    key: 'banks',
    icon: BookOpen,
    title: 'بنوك الأسئلة',
    desc: '27 مادة طبية بآلاف الأسئلة المصنفة بعناية',
    points: ['دورات الوطني السابقة', 'أسئلة UWorld المترجمة', 'حالات سريرية ونماذج تدريبية'],
  },
  {
    key: 'challenge',
    icon: Trophy,
    title: 'التحدي اليومي والصدارة',
    desc: '10 أسئلة يوميًا لاختبار معلوماتك وكسب النقاط',
    points: ['+30 XP يوميًا للتحدي', 'نافس زملاءك في الصدارة', 'حافظ على سلسلة أيامك'],
  },
  {
    key: 'review',
    icon: Brain,
    title: 'المراجعة الذكية',
    desc: 'نظام التكرار المتباعد يثبّت المعلومة في ذاكرتك',
    points: ['بطاقات تعليمية تفاعلية', 'جدولة مراجعة ذكية', 'دليل دراسي متكامل'],
  },
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const scrollRef = useRef<any>(null);
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const isLast = index === SLIDES.length - 1;

  const goTo = (i: number) => {
    setIndex(i);
    scrollRef.current?.scrollTo({ x: i * SCREEN_W, animated: true });
  };

  const finish = () => {
    if (finishing) return;
    setFinishing(true);
    // انتقال فوري احتياطي لشاشة الترحيب — يعمل حتى لو تأخر اشتراك الحالة
    // (إعادة تركيب الملاح بعد إشعار الإتمام تبقي المستخدم على الترحيب أيضًا)
    try {
      navigation.replace('Welcome');
    } catch {
      // تجاهل — الإشعار عبر completeOnboarding يتولى الانتقال
    }
    completeOnboarding().catch(() => {});
  };

  const onMomentumEnd = (e: any) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (i >= 0 && i < SLIDES.length) setIndex(i);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* زر التخطي */}
      <View style={styles.topBar}>
        {!isLast && (
          <TouchableOpacity onPress={finish} activeOpacity={0.7} accessibilityLabel="تخطي التعريف">
            <Text style={styles.skip}>تخطي</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}>
        {SLIDES.map((s, i) => (
          <View key={s.key} style={styles.slide}>
            {i === 0 ? (
              <Image source={require('../../assets/app-icon.jpg')} style={styles.logo} resizeMode="cover" />
            ) : (
              <LinearGradient
                colors={[colors.burgundy, colors.burgundyLight]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.iconWrap}>
                <s.icon size={56} color={colors.white} strokeWidth={1.8} />
              </LinearGradient>
            )}
            <Text style={[styles.title, rtlTextStyle]}>{bidi(s.title)}</Text>
            <Text style={[styles.desc, rtlTextStyle]}>{bidi(s.desc)}</Text>
            <View style={styles.points}>
              {s.points.map(p => (
                <View key={p} style={styles.pointRow}>
                  <View style={styles.dot} />
                  <Text style={[styles.point, rtlTextStyle]}>{bidi(p)}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* النقاط */}
      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View key={s.key} style={[styles.dotItem, i === index && styles.dotActive]} />
        ))}
      </View>

      {/* الأزرار */}
      <View style={styles.bottom}>
        {isLast ? (
          <TouchableOpacity style={styles.primary} onPress={finish} activeOpacity={0.85} accessibilityLabel="ابدأ الآن">
            <Text style={styles.primaryText}>ابدأ الآن</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.primary}
            onPress={() => goTo(index + 1)}
            activeOpacity={0.85}
            accessibilityLabel="التالي">
            <Text style={styles.primaryText}>التالي</Text>
            <ChevronLeft size={20} color={colors.white} strokeWidth={2.4} />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    topBar: {
      height: 44,
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    skip: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textSecondary,
      writingDirection: 'rtl',
    },
    slide: {
      width: SCREEN_W,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    logo: {
      width: 120,
      height: 120,
      borderRadius: 28,
      marginBottom: 28,
    },
    iconWrap: {
      width: 120,
      height: 120,
      borderRadius: 60,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 28,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.title,
      textAlign: 'center',
      marginBottom: 10,
      writingDirection: 'rtl',
    },
    desc: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 24,
      writingDirection: 'rtl',
    },
    points: {
      alignSelf: 'stretch',
      gap: 10,
    },
    pointRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.burgundy,
    },
    point: {
      fontSize: 14,
      fontWeight: '400',
      color: colors.text,
      writingDirection: 'rtl',
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginVertical: 18,
    },
    dotItem: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: {
      width: 24,
      backgroundColor: colors.burgundy,
    },
    bottom: {
      paddingHorizontal: 32,
      paddingBottom: 24,
    },
    primary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.burgundy,
      borderRadius: 16,
      paddingVertical: 15,
    },
    primaryText: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.white,
      writingDirection: 'rtl',
    },
  });
