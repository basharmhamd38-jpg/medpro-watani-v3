// شاشة التحميل عند أول تشغيل — تُعرض بدل الملاح حتى يكتمل تحميل بنك الأسئلة
// إلى SQLite (أوفلاين-أول). RTL عبر rtlTextStyle فقط — ممنوع row-reverse.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import LinearGradient from 'react-native-linear-gradient';
import { gradients, radius, useTheme, type ThemeColors } from '../theme';
import { bidi, rtlTextStyle } from '../utils/bidi';
import {
  firstLaunchDownload,
  type CancelToken,
  type FirstLaunchError,
} from '../sync/offlineSync';

type Phase = 'loading' | 'no-internet' | 'failed' | 'done';

const ERROR_TEXT: Record<Exclude<FirstLaunchError, 'cancelled'>, string> = {
  'no-internet': 'لا يوجد اتصال بالإنترنت',
  failed: 'تعذّر إكمال التحميل',
};

const ERROR_HINT: Record<Exclude<FirstLaunchError, 'cancelled'>, string> = {
  'no-internet': 'تأكد من اتصالك بالإنترنت ثم أعد المحاولة',
  failed: 'حدث خطأ أثناء تحميل الملفات — أعد المحاولة',
};

export default function FirstLaunchDownloadScreen({ onDone }: { onDone: () => void }) {
  const { colors, primaryGradient } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorKind, setErrorKind] = useState<Exclude<FirstLaunchError, 'cancelled'> | null>(null);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [label, setLabel] = useState('');
  const [questions, setQuestions] = useState(0);
  const tokenRef = useRef<CancelToken>({ cancelled: false });
  const aliveRef = useRef(true);

  const run = useCallback(() => {
    tokenRef.current = { cancelled: false };
    setPhase('loading');
    setErrorKind(null);
    setDone(0);
    setTotal(0);
    setLabel('');
    setQuestions(0);
    void firstLaunchDownload(
      (d, t, fileLabel, questionsSoFar) => {
        if (!aliveRef.current) return;
        setDone(d);
        setTotal(t);
        setLabel(fileLabel);
        setQuestions(questionsSoFar ?? 0);
      },
      tokenRef.current,
    ).then((res) => {
      if (!aliveRef.current) return;
      if (res.ok) {
        setPhase('done');
        onDone();
      } else if (res.error === 'cancelled') {
        setPhase('loading');
      } else {
        setErrorKind(res.error ?? 'failed');
        setPhase(res.error === 'no-internet' ? 'no-internet' : 'failed');
      }
    });
  }, [onDone]);

  useEffect(() => {
    aliveRef.current = true;
    run();
    return () => {
      aliveRef.current = false;
      tokenRef.current.cancelled = true;
    };
  }, [run]);

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <LinearGradient
      colors={[colors.burgundy, colors.burgundyDeep, '#3D0F16']}
      style={styles.container}>
      <View style={styles.logoWrap}>
        <Image
          source={require('../../assets/app-icon.jpg')}
          style={styles.logo}
          resizeMode="cover"
        />
      </View>

      <Text style={[styles.title, rtlTextStyle]}>{bidi('تحميل بنك الأسئلة')}</Text>
      <Text style={[styles.subtitle, rtlTextStyle]}>
        {bidi('يُحمَّل مرة واحدة فقط — بعدها يعمل التطبيق كاملًا بلا إنترنت')}
      </Text>

      {phase === 'loading' || phase === 'done' ? (
        <View style={styles.progressZone}>
          <View style={styles.track}>
            <LinearGradient
              colors={[...gradients.download]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.fill, { width: `${pct}%` }]}
            />
          </View>
          <Text style={styles.pct}>{pct}٪</Text>
          <Text style={[styles.fileLabel, rtlTextStyle]} numberOfLines={1}>
            {label ? bidi(label) : ' '}
          </Text>
          <Text style={styles.count}>
            {done} / {total} {bidi('ملف')} • {questions} {bidi('سؤال')}
          </Text>
        </View>
      ) : (
        <View style={styles.errorZone}>
          <Text style={[styles.errorTitle, rtlTextStyle]}>
            {errorKind ? ERROR_TEXT[errorKind] : ''}
          </Text>
          <Text style={[styles.errorHint, rtlTextStyle]}>
            {errorKind ? ERROR_HINT[errorKind] : ''}
          </Text>
          <TouchableOpacity activeOpacity={0.85} onPress={run} style={styles.retryWrap}>
            <LinearGradient
              colors={[...primaryGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.retryBtn}>
              <Text style={styles.retryText}>{bidi('إعادة المحاولة')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </LinearGradient>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    logoWrap: {
      width: 112,
      height: 112,
      borderRadius: 56,
      overflow: 'hidden',
      borderWidth: 3,
      borderColor: 'rgba(255,255,255,0.25)',
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 12,
    },
    logo: { width: '100%', height: '100%' },
    title: {
      marginTop: 28,
      fontSize: 24,
      fontWeight: '700',
      color: colors.white,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    subtitle: {
      marginTop: 10,
      fontSize: 14,
      color: colors.burgundyLight,
      textAlign: 'center',
      writingDirection: 'rtl',
      lineHeight: 22,
    },
    progressZone: {
      width: '100%',
      marginTop: 36,
      alignItems: 'center',
      gap: 10,
    },
    track: {
      width: '100%',
      height: 12,
      borderRadius: 6,
      backgroundColor: 'rgba(255,255,255,0.16)',
      overflow: 'hidden',
    },
    fill: { height: '100%', borderRadius: 6 },
    pct: {
      fontSize: 30,
      fontWeight: '700',
      color: colors.white,
      textAlign: 'center',
    },
    fileLabel: {
      fontSize: 14,
      color: colors.burgundyLight,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    count: {
      fontSize: 12.5,
      color: 'rgba(255,255,255,0.6)',
      textAlign: 'center',
    },
    errorZone: {
      width: '100%',
      marginTop: 36,
      alignItems: 'center',
      gap: 10,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.white,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    errorHint: {
      fontSize: 13.5,
      color: colors.burgundyLight,
      textAlign: 'center',
      writingDirection: 'rtl',
      lineHeight: 21,
    },
    retryWrap: { marginTop: 12, width: '100%' },
    retryBtn: {
      borderRadius: radius.md,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.card,
      textAlign: 'center',
    },
  });
