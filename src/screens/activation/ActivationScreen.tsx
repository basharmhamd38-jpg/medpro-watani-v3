// شاشة الاشتراك والتفعيل: دخول Google إلزامي + إدخال كود التفعيل ← تفعيل فوري
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { AppTextInput as TextInput } from '../../components/AppText';
import { AppText as Text } from '../../components/AppText';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { Check, CheckCircle2, LogIn, Ticket } from 'lucide-react-native';
import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { getAuth, setAuth, storage } from '../../auth/auth';
import { GOOGLE } from '../../config';
import { useToast } from '../../components/Toast';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import { registerDeviceForPush } from '../../notifications/fcm';
import { normalizeCode, quotaMessage, redeemCode, type RedeemError } from '../../activation/codes';

const PERKS = [
  '27 مادة دراسية كاملة',
  'بنك الدورات الامتحانية',
  'محطات OSCE العملية',
  'المكتبة الطبية',
];

const REDEEM_ERRORS: Record<RedeemError, string> = {
  not_found: 'الكود غير صحيح — تحقق من الكود وحاول مجددًا',
  used: 'هذا الكود مستخدم مسبقًا',
  expired: 'انتهت صلاحية هذا الكود',
  quota: quotaMessage(),
  network: 'تعذر الاتصال — تحقق من الإنترنت وحاول مجددًا',
  auth: 'يلزم تسجيل الدخول بحساب Google أولًا',
};

// تهيئة Google Sign-In
let googleConfigured = false;
function ensureGoogleConfigured(): void {
  if (googleConfigured) return;
  try {
    GoogleSignin.configure({
      webClientId: GOOGLE.webClientId,
      scopes: ['email', 'profile'],
    });
    googleConfigured = true;
  } catch {
    // لا يعطل الشاشة
  }
}

export default function ActivationScreen() {
  const { colors, primaryGradient } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const navigation = useNavigation();
  const [code, setCode] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [done, setDone] = useState(false);
  const showToast = useToast();

  const auth = getAuth();
  const isLoggedIn = auth.type === 'user';

  const onGoogleLogin = async () => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      ensureGoogleConfigured();
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
        registerDeviceForPush(u.email).catch(() => {});
        showToast(`أهلًا ${u.givenName ?? u.name ?? 'بك'} — أدخل كود التفعيل الآن`);
      } else {
        showToast('تم إلغاء تسجيل الدخول');
      }
    } catch (err) {
      if (isErrorWithCode(err)) {
        switch (err.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            showToast('تم إلغاء تسجيل الدخول');
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            showToast('خدمات Google Play غير متوفرة على هذا الجهاز');
            break;
          default:
            showToast(`تعذر تسجيل الدخول (رمز ${err.code}) — حاول مجددًا`);
        }
      } else {
        showToast('تعذر تسجيل الدخول — تحقق من اتصال الإنترنت');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const redeem = async () => {
    if (!isLoggedIn || auth.type !== 'user') {
      showToast('سجل دخول بحساب Google أولًا');
      return;
    }
    const normalized = normalizeCode(code);
    if (!normalized) {
      showToast('أدخل كود التفعيل أولًا');
      return;
    }
    if (redeeming) return;
    setRedeeming(true);
    try {
      const result = await redeemCode(normalized, auth.email);
      if (!result.ok) {
        showToast(REDEEM_ERRORS[result.error]);
        return;
      }
      // تفعيل الحساب محليًا
      setAuth({
        type: 'user',
        email: auth.email,
        name: auth.name,
        activated: true,
        expiresAt: result.expiresAt,
      });
      storage.set('activation_code_used', normalized);
      setDone(true);
      setCode('');
      showToast(`تم تفعيل حسابك بنجاح — ${result.durationMonths} شهر 🎉`);
    } finally {
      setRedeeming(false);
    }
  };

  // ─── بوابة الدخول: التفعيل يتطلب حساب Google ───
  if (!isLoggedIn) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={[styles.title, rtlTextStyle]}>الاشتراك وتفعيل الحساب</Text>
        <View style={[styles.card, shadows.card]}>
          <LogIn size={44} color={colors.burgundy} strokeWidth={1.8} />
          <Text style={[styles.gateTitle, rtlTextStyle]}>سجل دخولك أولًا</Text>
          <Text style={[styles.gateText, rtlTextStyle]}>
            {bidi('التفعيل مرتبط بحساب Google الخاص بك — بهذا يُحفظ تقدمك في الاختبارات والصدارة وكل الأقسام.')}
          </Text>
          <TouchableOpacity activeOpacity={0.85} onPress={onGoogleLogin} disabled={signingIn}>
            <LinearGradient
              colors={[...primaryGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButton}>
              {signingIn ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>تسجيل الدخول بحساب Google</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
        <Text style={[styles.flowLine, rtlTextStyle]}>
          {bidi('التفعيل: دخول Google ← كود التفعيل ← تفعيل فوري • جهاز واحد فقط')}
        </Text>
      </ScrollView>
    );
  }

  // ─── نجاح التفعيل ───
  if (done) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={[styles.card, shadows.card]}>
          <CheckCircle2 size={56} color={colors.success} strokeWidth={1.8} />
          <Text style={[styles.gateTitle, rtlTextStyle]}>تم تفعيل حسابك بنجاح 🎉</Text>
          <Text style={[styles.gateText, rtlTextStyle]}>
            {'أصبحت كل أقسام التطبيق متاحة لك الآن. بالتوفيق في الامتحان الوطني!'}
          </Text>
          <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.goBack()}>
            <LinearGradient
              colors={[...primaryGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>العودة للتطبيق</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[styles.title, rtlTextStyle]}>الاشتراك وتفعيل الحساب</Text>

      {/* المستخدم الحالي */}
      <View style={[styles.userCard, shadows.card]}>
        <Text style={[styles.userCardText, rtlTextStyle]}>
          {bidi(`مسجل كـ: ${auth.type === 'user' ? auth.name : ''}`)}
        </Text>
        <Text style={[styles.userCardEmail, rtlTextStyle]}>
          {bidi(auth.type === 'user' ? auth.email : '')}
        </Text>
      </View>

      {/* بطاقة الباقة */}
      <LinearGradient
        colors={[...primaryGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.planCard, shadows.card]}>
        <Text style={[styles.planTitle, rtlTextStyle]}>👑 باقة الامتحان الوطني الشاملة</Text>
        {PERKS.map((p) => (
          <View key={p} style={styles.perkRow}>
            <Check size={18} color="#4ADE80" strokeWidth={2.5} />
            <Text style={[styles.perkText, rtlTextStyle]}>{bidi(p)}</Text>
          </View>
        ))}
      </LinearGradient>

      {/* بطاقة كود التفعيل */}
      <View style={[styles.card, shadows.card]}>
        <Ticket size={34} color={colors.burgundy} strokeWidth={2} />
        <Text style={[styles.cardTitle, rtlTextStyle]}>أدخل كود التفعيل</Text>
        <Text style={[styles.codeHint, rtlTextStyle]}>
          {'اطلب كود التفعيل من الإدارة ثم أدخله هنا — يُفعَّل حسابك فورًا ويرتبط الكود بهذا الجهاز فقط.'}
        </Text>
        <TextInput
          style={styles.codeInput}
          placeholder="WATANI-XXXXXXXX"
          placeholderTextColor={colors.textMuted}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={20}
        />
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={redeem}
          disabled={redeeming}
          style={styles.fullWidth}>
          <LinearGradient
            colors={[...primaryGradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.primaryButton, redeeming && styles.primaryButtonDisabled]}>
            {redeeming ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryButtonText}>تفعيل الآن</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* سطر التوضيح */}
      <Text style={[styles.flowLine, rtlTextStyle]}>
        {'التفعيل: كود التفعيل ← تفعيل فوري • جهاز واحد فقط'}
      </Text>
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      padding: 16,
    },
    title: {
      fontFamily: 'tajawal',
      fontSize: 19,
      fontWeight: '700',
      color: colors.burgundy,
      textAlign: 'left',
      marginBottom: 14,
      writingDirection: 'ltr',
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      marginBottom: 14,
      alignItems: 'center',
    },
    gateTitle: {
      fontFamily: 'tajawal',
      fontSize: 17,
      fontWeight: '700',
      color: colors.title,
      textAlign: 'center',
      marginTop: 12,
      marginBottom: 8,
      writingDirection: 'ltr',
    },
    gateText: {
      fontFamily: 'tajawal',
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 18,
      writingDirection: 'ltr',
    },
    userCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 14,
    },
    userCardText: {
      fontFamily: 'tajawal',
      fontSize: 14,
      fontWeight: '700',
      color: colors.title,
      textAlign: 'left',
      writingDirection: 'ltr',
    },
    userCardEmail: {
      fontFamily: 'tajawal',
      fontSize: 12.5,
      color: colors.textSecondary,
      textAlign: 'left',
      marginTop: 2,
      writingDirection: 'ltr',
    },
    planCard: {
      borderRadius: radius.xl,
      padding: 20,
      marginBottom: 14,
    },
    planTitle: {
      fontFamily: 'tajawal',
      fontSize: 17,
      fontWeight: '700',
      color: colors.white,
      textAlign: 'left',
      marginBottom: 14,
      writingDirection: 'ltr',
    },
    perkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    perkText: {
      fontFamily: 'tajawal',
      fontSize: 14,
      fontWeight: '700',
      color: colors.white,
      textAlign: 'left',
      marginEnd: 8,
      writingDirection: 'ltr',
    },
    cardTitle: {
      fontFamily: 'tajawal',
      fontSize: 15,
      fontWeight: '700',
      color: colors.title,
      textAlign: 'center',
      marginTop: 10,
      marginBottom: 8,
      writingDirection: 'ltr',
    },
    codeHint: {
      fontFamily: 'tajawal',
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 14,
      writingDirection: 'ltr',
    },
    codeInput: {
      borderWidth: 1.5,
      borderColor: colors.burgundy,
      backgroundColor: colors.optionBg,
      borderRadius: radius.lg,
      paddingVertical: 14,
      paddingHorizontal: 16,
      fontSize: 18,
      fontWeight: '700',
      color: colors.title,
      textAlign: 'center',
      letterSpacing: 2,
      marginBottom: 14,
      alignSelf: 'stretch',
    },
    fullWidth: {
      alignSelf: 'stretch',
    },
    primaryButton: {
      borderRadius: radius.lg,
      paddingVertical: 15,
      marginTop: 2,
      alignItems: 'center',
    },
    primaryButtonDisabled: {
      opacity: 0.7,
    },
    primaryButtonText: {
      fontFamily: 'tajawal',
      color: colors.white,
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
      writingDirection: 'ltr',
    },
    flowLine: {
      fontFamily: 'tajawal',
      fontSize: 12.5,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 14,
      marginBottom: 8,
      writingDirection: 'ltr',
    },
  });
