// بطاقة تحميل القسم الموحّدة — زر تحميل حقيقي داخل كل قسم (أمر الدكتور 21 أكتوبر 2026).
// الحالة معروضة من التخزين المحلي نفسه (getSectionStatus): عدد محفوظ فعلي مقابل
// عدد الـmanifest؛ شارة «تم التحميل» لا تظهر إلا عند مخزون ≥ 95٪ من المتوقع.
// أثناء التحميل: تقدم حقيقي (ملفات منجزة/الكل + أسئلة مُدخلة) مع إيقاف/استئناف —
// الاستئناف يكمل من سجل cdn_done_files فلا يُعاد تنزيل المنجز أبدًا.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from './AppText';
import LinearGradient from 'react-native-linear-gradient';
import { AlertTriangle, Check, Download, RefreshCw } from 'lucide-react-native';
import { gradients, radius, shadows, useTheme, type ThemeColors } from '../theme';
import { bidi, rtlTextStyle } from '../utils/bidi';
import { formatNumber } from '../utils/numbers';
import Badge from './Badge';
import {
  downloadSection,
  getSectionStatus,
  type CancelToken,
  type SectionId,
  type SectionStatus,
} from '../sync/offlineSync';

interface Progress {
  done: number;
  total: number;
  label: string;
  questions: number;
  failed: number;
}

export default function SectionDownloadCard({
  section,
  onCompleted,
}: {
  section: SectionId;
  /** تُستدعى بعد تحميل موثّق الاكتمال — لإعادة جلب قوائم الشاشة المضيفة */
  onCompleted?: () => void;
}) {
  const { colors, primaryGradient } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [status, setStatus] = useState<SectionStatus | null>(null);
  const [phase, setPhase] = useState<'idle' | 'downloading' | 'failed'>('idle');
  const [failMsg, setFailMsg] = useState('');
  const [prog, setProg] = useState<Progress>({ done: 0, total: 0, label: '', questions: 0, failed: 0 });
  const tokenRef = useRef<CancelToken>({ cancelled: false });
  const aliveRef = useRef(true);

  const refresh = useCallback(async () => {
    const s = await getSectionStatus(section).catch(() => null);
    if (aliveRef.current && s) setStatus(s);
  }, [section]);

  useEffect(() => {
    aliveRef.current = true;
    void refresh();
    return () => {
      aliveRef.current = false;
      tokenRef.current.cancelled = true;
    };
  }, [refresh]);

  const start = useCallback(() => {
    tokenRef.current = { cancelled: false };
    setPhase('downloading');
    setFailMsg('');
    setProg({ done: 0, total: 0, label: '', questions: 0, failed: 0 });
    void downloadSection(
      section,
      (d, t, label, questionsSoFar, failedSoFar) => {
        if (!aliveRef.current) return;
        setProg({
          done: d,
          total: t,
          label,
          questions: questionsSoFar ?? 0,
          failed: failedSoFar ?? 0,
        });
      },
      tokenRef.current,
    )
      .then(async (res) => {
        if (!aliveRef.current) return;
        await refresh();
        if (res.ok) {
          setPhase('idle');
          onCompleted?.();
        } else if (res.error === 'cancelled') {
          setPhase('idle');
        } else if (res.error === 'no-internet') {
          setFailMsg('لا يوجد اتصال بالإنترنت — تحقق من الاتصال ثم أعد المحاولة');
          setPhase('failed');
        } else {
          setFailMsg(
            res.failed && res.failed.length > 0
              ? `تعذّر تحميل ${formatNumber(res.failed.length)} ملف — الاستئناف يكمل الناقص فقط`
              : 'التحميل لم يكتمل — الاستئناف يكمل الناقص فقط دون إعادة ما اكتمل',
          );
          setPhase('failed');
        }
      })
      .catch(() => {
        if (aliveRef.current) {
          setFailMsg('حدث خطأ أثناء التحميل — الاستئناف يكمل الناقص فقط');
          setPhase('failed');
        }
      });
  }, [section, refresh, onCompleted]);

  const stop = useCallback(() => {
    tokenRef.current.cancelled = true;
  }, []);

  // ─── أثناء التحميل: تقدم حقيقي ───
  if (phase === 'downloading') {
    const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
    return (
      <View style={[styles.card, shadows.card]}>
        <View style={styles.headRow}>
          <ActivityIndicator size="small" color={colors.burgundy} />
          <Text style={[styles.title, rtlTextStyle]}>{bidi('جارٍ تحميل أسئلة هذا القسم…')}</Text>
        </View>
        <View style={styles.track}>
          <LinearGradient
            colors={[...gradients.download]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.fill, { width: `${pct}%` }]}
          />
        </View>
        <Text style={styles.meta}>
          {formatNumber(prog.done)} / {formatNumber(prog.total)} {bidi('ملف')} •{' '}
          {formatNumber(prog.questions)} {bidi('سؤال مُدخل')}
          {prog.failed > 0 ? ` • ${formatNumber(prog.failed)} ${bidi('فشل')}` : ''}
        </Text>
        {!!prog.label && (
          <Text style={[styles.label, rtlTextStyle]} numberOfLines={1}>
            {bidi(prog.label)}
          </Text>
        )}
        <TouchableOpacity style={styles.stopBtn} activeOpacity={0.7} onPress={stop}>
          <Text style={styles.stopText}>{bidi('إيقاف — يُستأنف لاحقًا من حيث توقف')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── فحص الحالة الأول ───
  if (!status) {
    return (
      <View style={[styles.card, styles.rowCenter]}>
        <ActivityIndicator size="small" color={colors.burgundy} />
        <Text style={styles.meta}>{bidi('جارٍ فحص حالة تحميل هذا القسم…')}</Text>
      </View>
    );
  }

  // ─── مكتمل وموثّق من التخزين ───
  if (status.state === 'complete' && phase !== 'failed') {
    return (
      <View style={[styles.card, styles.doneCard]}>
        <View style={styles.headRow}>
          <View style={styles.doneIcon}>
            <Check size={14} color={colors.success} strokeWidth={3} />
          </View>
          <Text style={[styles.title, rtlTextStyle]}>{bidi('أسئلة هذا القسم محمّلة')}</Text>
          <Badge kind="offline" label="يعمل أوفلاين" />
        </View>
        <Text style={[styles.meta, rtlTextStyle]}>
          {bidi(`${formatNumber(status.stored)} سؤال محفوظ على جهازك — يعمل دون اتصال`)}
        </Text>
      </View>
    );
  }

  // ─── غير محمّل / ناقص / يحتاج تحديث / فشلت محاولة ───
  const isUpdate = status.state === 'outdated';
  const buttonLabel =
    phase === 'failed' || status.state === 'partial'
      ? 'استئناف التحميل'
      : isUpdate
        ? 'تحديث أسئلة القسم'
        : 'تحميل أسئلة هذا القسم';
  const headline =
    phase === 'failed'
      ? 'التحميل لم يكتمل'
      : status.state === 'partial'
        ? 'تحميل هذا القسم غير مكتمل'
        : isUpdate
          ? 'يوجد تحديث لأسئلة هذا القسم'
          : 'أسئلة هذا القسم غير محمّلة بعد';
  const detail =
    phase === 'failed'
      ? failMsg
      : status.state === 'partial' && status.expected
        ? `محفوظ على جهازك ${formatNumber(status.stored)} من ${formatNumber(status.expected)} سؤالًا — أكمل الباقي بالاستئناف`
        : isUpdate
          ? 'نزّل النسخة الأحدث من الأسئلة — المنجز عندك يبقى كما هو ولا يُعاد تنزيله'
          : 'حمّل أسئلة هذا القسم مرة واحدة على جهازك — بعدها تعمل دون اتصال، ولن تنتظر أي تحميل عند فتح التطبيق';

  return (
    <View style={[styles.card, shadows.card]}>
      <View style={styles.headRow}>
        {phase === 'failed' ? (
          <AlertTriangle size={17} color={colors.amberText} strokeWidth={2.2} />
        ) : isUpdate ? (
          <RefreshCw size={17} color={colors.burgundy} strokeWidth={2.2} />
        ) : (
          <Download size={17} color={colors.burgundy} strokeWidth={2.2} />
        )}
        <Text style={[styles.title, rtlTextStyle]}>{bidi(headline)}</Text>
      </View>
      <Text style={[styles.meta, rtlTextStyle]}>{bidi(detail)}</Text>
      {status.stored > 0 && status.state !== 'partial' && phase !== 'failed' && (
        <Text style={[styles.meta, rtlTextStyle]}>
          {bidi(`المحفوظ حاليًا على جهازك: ${formatNumber(status.stored)} سؤال`)}
        </Text>
      )}
      <TouchableOpacity activeOpacity={0.85} onPress={start} style={styles.btnWrap}>
        <LinearGradient
          colors={[...primaryGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btn}>
          <Download size={17} color={colors.white} strokeWidth={2.4} />
          <Text style={styles.btnText}>{bidi(buttonLabel)}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderBurgundy,
      padding: 14,
      marginBottom: 12,
      gap: 8,
    },
    doneCard: { borderColor: colors.borderLight },
    rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    doneIcon: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.successBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontFamily: 'tajawal',
      fontSize: 15,
      fontWeight: '700',
      color: colors.title,
      flexShrink: 1,
    },
    meta: {
      fontFamily: 'tajawal',
      fontSize: 12.5,
      color: colors.textSecondary,
      lineHeight: 19,
    },
    label: {
      fontFamily: 'tajawal',
      fontSize: 12.5,
      color: colors.burgundyLight,
    },
    track: {
      width: '100%',
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.segBg,
      overflow: 'hidden',
    },
    fill: { height: '100%', borderRadius: 5 },
    btnWrap: { marginTop: 4 },
    btn: {
      flexDirection: 'row',
      borderRadius: radius.md,
      paddingVertical: 13,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    btnText: {
      fontFamily: 'tajawal',
      fontSize: 15,
      fontWeight: '700',
      color: colors.white,
      textAlign: 'center',
    },
    stopBtn: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 10 },
    stopText: {
      fontFamily: 'tajawal',
      fontSize: 13,
      fontWeight: '700',
      color: colors.burgundy,
    },
  });
