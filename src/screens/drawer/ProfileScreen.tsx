// الملف الشخصي — بيانات المستخدم الأكاديمية (مرجعية AI Studio: شاشة profile)
import React, { useEffect, useState , useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppTextInput as TextInput } from '../../components/AppText';
import { AppText as Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, User as UserIcon } from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import { useToast } from '../../components/Toast';
import { getAuth, storage } from '../../auth/auth';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { bidi, rtlTextStyle } from '../../utils/bidi';

const SYRIAN_UNIVERSITIES = [
  'جامعة دمشق',
  'جامعة حلب',
  'جامعة اللاذقية',
  'جامعة حمص',
  'جامعة حماة',
  'جامعة الفرات',
  'جامعة طرطوس',
  'جامعة إدلب',
  'جامعات خاصة',
];

const PROFILE_KEY = 'user_profile';

interface ProfileData {
  name: string;
  university: string;
  faculty: string;
  targetExam: string;
  phone: string;
}

function loadProfile(): ProfileData {
  const auth = getAuth();
  const saved = storage.getString(PROFILE_KEY);
  let parsed: Partial<ProfileData> = {};
  try {
    parsed = saved ? JSON.parse(saved) : {};
  } catch {
    parsed = {};
  }
  return {
    name: parsed.name || (auth.type === 'user' ? auth.name : ''),
    university: parsed.university || 'جامعة دمشق',
    faculty: parsed.faculty || 'كلية الطب البشري',
    targetExam: parsed.targetExam || 'الامتحان الوطني الموحد — 2026',
    phone: parsed.phone || '',
  };
}

export default function ProfileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const toast = useToast();
  const auth = getAuth();
  const [form, setForm] = useState<ProfileData>(loadProfile);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 4000);
      return () => clearTimeout(t);
    }
  }, [saved]);

  const set = (k: keyof ProfileData) => (v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const onSave = () => {
    storage.set(PROFILE_KEY, JSON.stringify(form));
    setSaved(true);
    toast('تم حفظ الملف الشخصي بنجاح ✨');
  };

  const displayName =
    form.name.trim() || (auth.type === 'user' ? auth.name : 'طالب الطب');
  const avatarLetter = displayName.replace(/^د\.\s*/, '').charAt(0) || 'ط';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* بطاقة الترويسة */}
        <View style={[styles.hero, shadows.card]}>
          <View style={styles.heroRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarLetter}</Text>
            </View>
            <View style={styles.heroText}>
              <Text style={styles.heroName} numberOfLines={1}>
                {bidi(`د. ${displayName}`)}
              </Text>
              <Text style={styles.heroSub} numberOfLines={1}>
                {bidi(`${form.university} • ${form.faculty}`)}
              </Text>
              {auth.type === 'user' ? (
                <Text style={styles.heroMail} numberOfLines={1}>
                  {auth.email}
                </Text>
              ) : null}
            </View>
          </View>
          {saved ? (
            <View style={styles.savedBanner}>
              <CheckCircle2 size={14} color={colors.success} strokeWidth={2.4} />
              <Text style={styles.savedText}>
                تم حفظ التعديلات في ملفك الشخصي بنجاح ✨
              </Text>
            </View>
          ) : null}
        </View>

        {/* نموذج التعديل */}
        <View style={[styles.card, shadows.card]}>
          <View style={styles.cardHead}>
            <UserIcon size={18} color={colors.burgundy} strokeWidth={2.2} />
            <Text style={styles.cardTitle}>تعديل البيانات الشخصية والأكاديمية</Text>
          </View>

          <Text style={styles.label}>الاسم الكامل (المعروض في المنصة):</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={set('name')}
            placeholder="مثال: د. محمد الأحمد"
            placeholderTextColor={colors.textMuted}
            textAlign="right"
          />
          <Text style={styles.hint}>
            يُملأ تلقائيًا من حساب Google ويمكنك تعديله في أي وقت.
          </Text>

          <Text style={styles.label}>الجامعة:</Text>
          <View style={styles.chipsWrap}>
            {SYRIAN_UNIVERSITIES.map(u => {
              const active = form.university === u;
              return (
                <TouchableOpacity
                  key={u}
                  style={[styles.chip, active && styles.chipActive]}
                  activeOpacity={0.8}
                  onPress={() => setForm(p => ({ ...p, university: u }))}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {u}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>الكلية والتخصص:</Text>
          <TextInput
            style={styles.input}
            value={form.faculty}
            onChangeText={set('faculty')}
            placeholder="كلية الطب البشري"
            placeholderTextColor={colors.textMuted}
            textAlign="right"
          />

          <Text style={styles.label}>دورة الامتحان المستهدفة:</Text>
          <TextInput
            style={styles.input}
            value={form.targetExam}
            onChangeText={set('targetExam')}
            placeholder="الامتحان الوطني الموحد — 2026"
            placeholderTextColor={colors.textMuted}
            textAlign="right"
          />

          <Text style={styles.label}>رقم الهاتف / الواتساب (اختياري):</Text>
          <TextInput
            style={styles.input}
            value={form.phone}
            onChangeText={set('phone')}
            placeholder="09xxxxxxxx"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            textAlign="right"
          />

          <TouchableOpacity
            style={styles.saveBtn}
            activeOpacity={0.85}
            onPress={onSave}>
            <Text style={styles.saveText}>حفظ الملف الشخصي</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  content: { padding: 14, gap: 14, paddingBottom: 28 },
  hero: {
    backgroundColor: colors.burgundy,
    borderRadius: radius.xl,
    padding: 16,
    gap: 12,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'tajawal',
    color: colors.burgundy,
    fontSize: 24,
    fontWeight: '700',
  },
  heroText: { flex: 1, alignItems: 'flex-end' },
  heroName: {
    fontFamily: 'tajawal',
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
    ...rtlTextStyle,
  },
  heroSub: {
    fontFamily: 'tajawal',
    color: colors.explainBorder,
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
    ...rtlTextStyle,
  },
  heroMail: {
    fontFamily: 'tajawal',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 2,
  },
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successBg,
    borderRadius: radius.md,
    padding: 10,
  },
  savedText: {
    fontFamily: 'tajawal',
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    ...rtlTextStyle,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(122,31,43,0.12)',
    padding: 16,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: 'tajawal',
    color: colors.burgundy,
    fontSize: 15,
    fontWeight: '700',
    ...rtlTextStyle,
  },
  label: {
    fontFamily: 'tajawal',
    color: colors.burgundy,
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 6,
    ...rtlTextStyle,
  },
  input: {
    fontFamily: 'tajawal',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 13,
    fontWeight: '400',
    color: colors.text,
    ...rtlTextStyle,
  },
  hint: {
    fontFamily: 'tajawal',
    color: colors.textMuted,
    fontSize: 10.5,
    marginTop: 4,
    ...rtlTextStyle,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.burgundy, borderColor: colors.burgundy },
  chipText: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  chipTextActive: { color: colors.white },
  saveBtn: {
    backgroundColor: colors.burgundy,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  saveText: {
    fontFamily: 'tajawal',
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
