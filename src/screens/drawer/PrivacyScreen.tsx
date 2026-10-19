// الخصوصية والشروط — سياسة حماية البيانات (مرجعية AI Studio: شاشة privacy)
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck } from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import { useToast } from '../../components/Toast';
import { signOut } from '../../auth/auth';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { bidi, rtlTextStyle } from '../../utils/bidi';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '١. جمع البيانات المحدود:',
    body: 'نجمع فقط الاسم والجامعة (جامعة دمشق) والتقدم الدراسي ونتائج الأسئلة بهدف توفير الإحصائيات وتحسين تجربة التحضير.',
  },
  {
    title: '٢. أمان كلمات المرور:',
    body: 'لا نطلب ولا نقوم بجمع أو تخزين أي كلمة مرور على خوادمنا نهائيًا، حيث تتم إدارة الدخول بأمان كامل عبر موفّر الهوية Google OAuth الموثوق.',
  },
  {
    title: '٣. عدم بيع أو مشاركة البيانات:',
    body: 'نلتزم التزامًا مطلقًا بعدم بيع أو تأجير أو مشاركة أي بيانات شخصية أو دراسية مع أي أطراف ثالثة أو شركات إعلانية.',
  },
  {
    title: '٤. حق الحذف النهائي:',
    body: 'يحق للمستخدم في أي وقت طلب الحذف الكامل والنهائي لحسابه ولكافة سجلات تقدمه الدراسي — أرسل طلبك عبر قناة التليجرام @medprowatain وسيُنفَّذ خلال ٧ أيام عمل.',
  },
  {
    title: '٥. خصوصية ربط تليجرام:',
    body: 'ربط تليجرام اختياري ومطلوب فقط للاشتراك المدفوع. البوت يستلم: رقم هوية تليجرام والاسم واليوزرنيم فقط — رقم هاتفك لا يصل إلينا أبدًا.',
  },
  {
    title: '٦. خدمات Firebase:',
    body: 'نستخدم خدمات Google Firebase: المصادقة (تسجيل الدخول عبر Google)، قاعدة البيانات (حفظ تقدمك)، التنبيهات (الإشعارات)، وتتبع الأعطال (تحسين الاستقرار). تخضع هذه الخدمات لسياسة خصوصية Google.',
  },
  {
    title: '٧. شبكة توصيل المحتوى:',
    body: 'نستخدم شبكة Cloudflare لتوصيل المحتوى الدراسي (الأسئلة والحالات) بسرعة وكفاءة. لا تُجمع أي بيانات شخصية عبر هذه الشبكة.',
  },
  {
    title: '٨. لا إعلانات:',
    body: 'التطبيق خالٍ تمامًا من الإعلانات ولا يحتوي أي أدوات تتبع إعلانية أو ملفات تعريف تسويقية.',
  },
  {
    title: '٩. الاحتفاظ بالبيانات:',
    body: 'نحتفظ ببيانات تقدمك الدراسي طالما حسابك نشط. يمكنك طلب حذفها نهائيًا في أي وقت عبر التواصل معنا على قناة التليجرام @medprowatain.',
  },
  {
    title: '١٠. تواصل معنا:',
    body: 'لأي استفسار حول الخصوصية: قناة التليجرام @medprowatain — نرد على جميع الاستفسارات المتعلقة ببياناتك.',
  },
];

export default function PrivacyScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const toast = useToast();

  // الزر لا يحذف شيئًا من الخادم — هو تسجيل خروج فقط، والتسمية صادقة بذلك
  const onSignOut = () => {
    signOut();
    toast('تم تسجيل الخروج — لطلب حذف بياناتك نهائيًا تواصل معنا عبر @medprowatain');
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
            <ShieldCheck size={22} color={colors.burgundy} strokeWidth={2.2} />
            <View style={styles.headText}>
              <Text style={styles.title}>الخصوصية والشروط</Text>
              <Text style={styles.sub}>
                سياسة حماية البيانات الصارمة لطلاب الامتحان الوطني
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {SECTIONS.map((s, i) => (
            <View key={i} style={styles.section}>
              <Text style={styles.secTitle}>{bidi(s.title)}</Text>
              <Text style={styles.secBody}>{bidi(s.body)}</Text>
              {i === 3 ? (
                <TouchableOpacity
                  style={styles.signOutBtn}
                  activeOpacity={0.8}
                  onPress={onSignOut}>
                  <Text style={styles.signOutText}>
                    تسجيل الخروج من الحساب
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
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
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headText: { flex: 1, alignItems: 'flex-end' },
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
  divider: {
    height: 1,
    backgroundColor: 'rgba(122,31,43,0.1)',
    marginVertical: 14,
  },
  section: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(122,31,43,0.08)',
  },
  secTitle: {
    fontFamily: 'tajawal',
    color: colors.burgundy,
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 4,
    ...rtlTextStyle,
  },
  secBody: {
    fontFamily: 'tajawal',
    color: 'rgba(122,31,43,0.9)',
    fontSize: 12.5,
    lineHeight: 22,
    ...rtlTextStyle,
  },
  signOutBtn: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  signOutText: {
    fontFamily: 'tajawal',
    color: '#BE123C',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
