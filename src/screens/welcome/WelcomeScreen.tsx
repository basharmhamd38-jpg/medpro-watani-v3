// شاشة الترحيب/الدخول — مطابقة لشاشة الدخول في الموقع الحي
// (شعار + اسم + وصف + بطاقة الميزات + زر Google متدرج + دخول ضيف + تذييل)
import React, { useState , useMemo } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import AppButton from '../../components/AppButton';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
import { Zap } from 'lucide-react-native';
import { useToast } from '../../components/Toast';
import { setAuth } from '../../auth/auth';
import { GOOGLE } from '../../config';
import { registerDeviceForPush } from '../../notifications/fcm';
import { gradients, useTheme, type ThemeColors } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

// تهيئة Google Sign-In مرة واحدة.
// webClientId (عميل الويب من google-services.json) مطلوب لتحديد عميل OAuth
// الصحيح على أندرويد — بدونه يفشل الدخول بخطأ DEVELOPER_ERROR (10) عندما
// لا تكون بصمة SHA-1 مسجلة للعميل الافتراضي.
const WEB_CLIENT_ID = GOOGLE.webClientId;
let googleConfigured = false;
function ensureGoogleConfigured(): void {
  if (googleConfigured) return;
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    scopes: ['email', 'profile'],
  });
  googleConfigured = true;
}

// شعار Google الرسمي متعدد الألوان (كما في الموقع)
function GoogleLogo() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.gCircle}>
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <Path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <Path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        />
        <Path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        />
      </Svg>
    </View>
  );
}

const FEATURES = [
  { icon: '📚', label: 'بنك أسئلة الدورات الشامل' },
  { icon: '🧠', label: 'تكرار متباعد ذكي SM-2' },
  { icon: '🩺', label: 'محطات وحالات سريرية' },
  { icon: '🏆', label: 'لوحة صدارة وتنافس وطني' },
];

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const toast = useToast();
  const [signingIn, setSigningIn] = useState(false);

  const onGoogle = async () => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      ensureGoogleConfigured();
      // خدمات Play ضرورية لتسجيل Google على أندرويد
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      const response = await GoogleSignin.signIn();
      if (isSuccessResponse(response)) {
        const u = response.data.user;
        setAuth({
          type: 'user',
          email: u.email,
          name: u.name ?? u.givenName ?? u.email,
          activated: false,
          expiresAt: 0,
        });
        toast(`أهلًا ${u.givenName ?? u.name ?? 'بك'}`);
        // تسجيل الجهاز للإشعارات الفورية (FCM) — لا يعطل الدخول عند الفشل
        registerDeviceForPush(u.email).catch(() => {});
        // تحديث هوية تتبع الأعطال
        try {
          const { setCrashUser } = require('../../utils/crashReporting');
          setCrashUser();
        } catch { /* تجاهل */ }
        navigation.replace('Main');
      } else {
        // ألغى المستخدم نافذة اختيار الحساب
        toast('تم إلغاء تسجيل الدخول');
      }
    } catch (err) {
      if (isErrorWithCode(err)) {
        switch (err.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            toast('تم إلغاء تسجيل الدخول');
            break;
          case statusCodes.IN_PROGRESS:
            toast('عملية تسجيل الدخول جارية بالفعل');
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            toast('خدمات Google Play غير متوفرة على هذا الجهاز');
            break;
          default:
            // إظهار رمز الخطأ الفعلي للتشخيص بدل رسالة «إنترنت» المضللة:
            // 10 = DEVELOPER_ERROR (إعداد OAuth/SHA-1)، 7 = NETWORK_ERROR (شبكة فعلية)
            toast(`تعذر تسجيل الدخول (رمز ${err.code}) — حاول مجددًا`);
        }
      } else {
        toast('تعذر تسجيل الدخول — تحقق من اتصال الإنترنت وحاول مجددًا');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const onGuest = () => {
    setAuth({ type: 'guest' });
    registerDeviceForPush('guest').catch(() => {});
    navigation.replace('Main');
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          {/* قسم الهوية: خلفية عنابية متدرجة + الشعار الكبير بإطار ذهبي */}
          <LinearGradient
            colors={[colors.burgundyDeep, colors.burgundy, colors.burgundyDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}>
            <View style={styles.logoWrap}>
              <Image
                source={require('../../assets/app-icon.jpg')}
                style={styles.heroLogo}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.heroTitle}>
              <Text style={styles.heroMed}>Med pro</Text>
              <Text style={styles.heroDash}> - </Text>
              <Text style={styles.heroWatani}>وطني</Text>
            </Text>
            <Text style={styles.heroSub}>الامتحان الوطني الطبي الموحد</Text>
            <View style={styles.goldLine} />
            <Text style={styles.heroTag}>
              رفيقك المعتمد للتحضير للامتحان الوطني الطبي
            </Text>
          </LinearGradient>

          <View style={styles.body}>
          <Text style={styles.desc}>
            المنصة الشاملة المعتمدة للتحضير للامتحان الوطني الطبي لكليات الطب
            البشري بالجامعات السورية
          </Text>

          {/* بطاقة الميزات */}
          <View style={styles.featureCard}>
            <View style={styles.featureTop}>
              <View style={styles.pulseDot} />
              <Text style={styles.featureTopText}>
                27 مادة سريرية · دورات وطنية ومحطات OSCE · مكتبة طبية
              </Text>
            </View>
            <View style={styles.featureGrid}>
              {FEATURES.map(f => (
                <View key={f.label} style={styles.featureTile}>
                  <Text style={styles.featureIcon}>{f.icon}</Text>
                  <Text style={styles.featureLabel}>{f.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <Text style={styles.invite}>
            سجّل دخولك الآن لمتابعة خطتك الدراسية اليومية، حل الأسئلة
            التفاعلية، وحفظ تقدمك عبر جميع أجهزتك.
          </Text>

          {/* الأزرار */}
          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={onGoogle}
              disabled={signingIn}
              style={signingIn ? styles.btnDisabled : undefined}>
              <LinearGradient
                colors={[...gradients.google]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.googleBtn}>
                <GoogleLogo />
                <Text style={styles.googleText}>
                  {signingIn ? 'جارٍ التحقق...' : 'تسجيل الدخول بـ Google'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <AppButton
              title="دخول سريع كضيف (بدون حساب — تصفح دورات الوطن)"
              onPress={onGuest}
              variant="secondary"
              icon={<Zap size={15} color={colors.amber} fill={colors.amber} />}
              style={styles.guestBtn}
            />
          </View>
          </View>
        </ScrollView>

        <Text style={styles.footer}>
          Med pro - وطني © 2026 — تطبيق الامتحان الوطني الطبي الموحد لكليات
          الطب البشري بالجامعات السورية
        </Text>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  content: {
    paddingBottom: 12,
    alignItems: 'center',
  },
  // ─── قسم الهوية (Hero) ───
  hero: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    marginBottom: 20,
    // ظل ناعم تحت القسم
    shadowColor: colors.burgundyDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  logoWrap: {
    padding: 4,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: colors.amber, // إطار ذهبي يطابق الـ+ الذهبي بالأيقونة
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: 14,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  heroLogo: {
    width: 88,
    height: 88,
    borderRadius: 22,
  },
  heroTitle: {
    fontFamily: 'tajawal',
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.white,
    letterSpacing: 0.5,
  },
  heroMed: {
    color: colors.white,
  },
  heroDash: {
    color: colors.amber,
    fontWeight: '400',
  },
  heroWatani: {
    color: '#FFDFA8', // ذهبي فاتح
  },
  heroSub: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    marginTop: 6,
  },
  goldLine: {
    width: 64,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.amber,
    marginVertical: 12,
    opacity: 0.9,
  },
  heroTag: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
  },
  body: {
    width: '100%',
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  desc: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(122,31,43,0.85)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  featureCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.ghostBorder,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  featureTop: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.ghostBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.amberDot,
  },
  featureTopText: {
    fontFamily: 'tajawal',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: colors.burgundy,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureTile: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.featureTile,
    borderWidth: 1,
    borderColor: 'rgba(217,165,168,0.4)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  featureIcon: {
    fontSize: 16,
  },
  featureLabel: {
    fontFamily: 'tajawal',
    flex: 1,
    fontSize: 11,
    fontWeight: '400',
    color: colors.burgundy,
  },
  invite: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(122,31,43,0.8)',
    textAlign: 'center',
    lineHeight: 20,
    borderTopWidth: 1,
    borderTopColor: colors.ghostBorder,
    paddingTop: 12,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
  },
  gCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleText: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.ghostBorder,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  footer: {
    fontFamily: 'tajawal',
    fontSize: 11,
    fontWeight: '400',
    color: colors.burgundyLight,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.ghostBorder,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
});
