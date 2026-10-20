// التواصل مع الإدارة — نموذج رسائل الدعم (مرجعية AI Studio: شاشة support)
// تُحفظ الرسائل في Firestore: support_messages (allow create: public)
import React, { useState , useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppTextInput as TextInput } from '../../components/AppText';
import { AppText as Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Headset } from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import { useToast } from '../../components/Toast';
import { getAuth } from '../../auth/auth';
import { FIREBASE } from '../../config';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { rtlTextStyle } from '../../utils/bidi';

const BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/${FIREBASE.databaseId}/documents`;

async function sendSupportMessage(subject: string, message: string): Promise<void> {
  const auth = getAuth();
  const url = `${BASE}/support_messages?key=${FIREBASE.apiKey}`;
  const body = {
    fields: {
      subject: { stringValue: subject },
      message: { stringValue: message },
      email: { stringValue: auth.type === 'user' ? auth.email : 'guest' },
      name: { stringValue: auth.type === 'user' ? auth.name : 'زائر' },
      createdAt: { timestampValue: new Date().toISOString() },
      status: { stringValue: 'new' },
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
}

export default function ContactScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const onSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast('يرجى ملء موضوع الرسالة ونصها');
      return;
    }
    if (sending) return;
    setSending(true);
    try {
      await sendSupportMessage(subject.trim(), message.trim());
      setSent(true);
      toast('تم إرسال رسالتك بنجاح');
    } catch {
      toast('تعذر الإرسال — تحقق من الاتصال وحاول مجددًا');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.card, shadows.card]}>
          <View style={styles.head}>
            <Headset size={22} color={colors.burgundy} strokeWidth={2.2} />
            <View style={styles.headText}>
              <Text style={styles.title}>التواصل مع الإدارة</Text>
              <Text style={styles.sub}>
                فريق الدعم الأكاديمي والتقني جاهز لمساعدتك في أي استفسار
              </Text>
            </View>
          </View>

          {sent ? (
            <View style={styles.successBox}>
              <CheckCircle2 size={28} color={colors.success} strokeWidth={2.2} />
              <Text style={styles.successText}>
                {'تم إرسال رسالتك بنجاح! سيقوم فريق الدعم بالرد خلال أقل من ١٢ ساعة.'}
              </Text>
              <TouchableOpacity
                style={styles.againBtn}
                activeOpacity={0.8}
                onPress={() => {
                  setSent(false);
                  setSubject('');
                  setMessage('');
                }}>
                <Text style={styles.againText}>إرسال رسالة أخرى</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.label}>موضوع الاستفسار:</Text>
              <TextInput
                style={styles.input}
                value={subject}
                onChangeText={setSubject}
                placeholder="استفسار علمي، مشكلة تقنية، اقتراح أو مساعدة..."
                placeholderTextColor={colors.textMuted}
                textAlign="right"
              />
              <Text style={styles.label}>نص الرسالة:</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={message}
                onChangeText={setMessage}
                placeholder="اكتب استفسارك بالتفصيل..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={5}
                textAlign="right"
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
                activeOpacity={0.85}
                onPress={onSend}
                disabled={sending}>
                <Text style={styles.sendText}>
                  {sending ? 'جارٍ الإرسال...' : 'إرسال الرسالة'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  content: { padding: 14, paddingBottom: 28 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(122,31,43,0.12)',
    padding: 18,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  // RTL: flex-start = اليمين (بداية النص العربي) — كان flex-end فيدفعه لليسار
  headText: { flex: 1, alignItems: 'flex-start' },
  title: {
    fontFamily: 'tajawal',
    color: colors.burgundy,
    fontSize: 20,
    fontWeight: '700',
    ...rtlTextStyle,
  },
  sub: {
    fontFamily: 'tajawal',
    color: colors.burgundyLight,
    fontSize: 12,
    marginTop: 2,
    ...rtlTextStyle,
  },
  form: { gap: 2 },
  label: {
    fontFamily: 'tajawal',
    color: colors.burgundy,
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
    ...rtlTextStyle,
  },
  input: {
    fontFamily: 'tajawal',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: 'rgba(122,31,43,0.2)',
    borderRadius: radius.md,
    padding: 12,
    fontSize: 13,
    color: colors.text,
    ...rtlTextStyle,
  },
  textarea: { minHeight: 120 },
  sendBtn: {
    backgroundColor: colors.burgundy,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendText: {
    fontFamily: 'tajawal',
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  successBox: {
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: radius.lg,
    padding: 24,
    marginTop: 8,
  },
  successText: {
    fontFamily: 'tajawal',
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 22,
    ...rtlTextStyle,
  },
  againBtn: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: radius.md,
  },
  againText: {
    fontFamily: 'tajawal',
    color: colors.success,
    fontSize: 12.5,
    fontWeight: '700',
  },
});
