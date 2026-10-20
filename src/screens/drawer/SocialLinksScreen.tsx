// روابط التواصل — قنوات Med Pro الاجتماعية (مرجعية AI Studio)
// تُقرأ من Firestore: app_config/contact (قراءة عامة) مع قيم افتراضية
import React, { useEffect, useState , useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AtSign,
  Camera,
  Globe,
  MessageCircle,
  Phone,
  Play,
  Send,
} from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import { useToast } from '../../components/Toast';
import { FIREBASE } from '../../config';
import { parseValue } from '../../courses/firestore';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { rtlTextStyle } from '../../utils/bidi';

const BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/${FIREBASE.databaseId}/documents`;

interface LinkDef {
  key: string;
  label: string;
  sub: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

const LINKS: LinkDef[] = [
  { key: 'telegram', label: 'قناة تيليجرام', sub: 'آخر الأخبار والتحديثات', icon: Send },
  { key: 'whatsapp', label: 'واتساب', sub: 'تواصل مباشر', icon: MessageCircle },
  { key: 'facebook', label: 'فيسبوك', sub: 'صفحة Med Pro', icon: AtSign },
  { key: 'instagram', label: 'إنستغرام', sub: 'محتوى بصري يومي', icon: Camera },
  { key: 'youtube', label: 'يوتيوب', sub: 'شروحات مرئية', icon: Play },
  { key: 'phone', label: 'اتصال هاتفي', sub: 'الدعم المباشر', icon: Phone },
];

const FALLBACK: Record<string, string> = {
  telegram: 'https://t.me/medprowatain',
  whatsapp: '',
  facebook: '',
  instagram: '',
  youtube: '',
  phone: '',
};

async function fetchContactLinks(): Promise<Record<string, string>> {
  const url = `${BASE}/app_config/contact?key=${FIREBASE.apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
  const doc = await res.json();
  const out: Record<string, string> = { ...FALLBACK };
  const fields = doc.fields || {};
  for (const k of Object.keys(FALLBACK)) {
    const v = parseValue(fields[k]);
    if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return out;
}

export default function SocialLinksScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const toast = useToast();
  const [links, setLinks] = useState<Record<string, string>>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchContactLinks()
      .then(d => {
        if (alive) setLinks(d);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const onOpen = async (key: string, label: string) => {
    const url = links[key];
    if (!url) {
      toast(`رابط «${label}» غير متوفر حاليًا`);
      return;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        toast('تعذر فتح الرابط');
      }
    } catch {
      toast('تعذر فتح الرابط');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Globe size={22} color={colors.burgundy} strokeWidth={2.2} />
          <View style={styles.headText}>
            <Text style={styles.title}>روابط التواصل</Text>
            <Text style={styles.sub}>
              {'تيليجرام • فيسبوك • إنستغرام • يوتيوب'}
            </Text>
          </View>
        </View>

        {loading ? (
          <Text style={styles.loading}>جارٍ تحميل الروابط...</Text>
        ) : (
          LINKS.map(l => {
            const Icon = l.icon;
            const has = Boolean(links[l.key]);
            return (
              <TouchableOpacity
                key={l.key}
                style={[styles.item, shadows.card, !has && styles.itemDisabled]}
                activeOpacity={0.8}
                onPress={() => onOpen(l.key, l.label)}>
                <View style={styles.iconBox}>
                  <Icon size={20} color={colors.burgundy} strokeWidth={2.2} />
                </View>
                <View style={styles.itemText}>
                  <Text style={styles.itemLabel}>{l.label}</Text>
                  <Text style={styles.itemSub}>{l.sub}</Text>
                </View>
                <Text style={styles.arrow}>‹</Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  content: { padding: 14, gap: 10, paddingBottom: 28 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
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
  loading: {
    fontFamily: 'tajawal',
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(122,31,43,0.1)',
    padding: 14,
    gap: 12,
  },
  itemDisabled: { opacity: 0.55 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(122,31,43,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { flex: 1, alignItems: 'flex-start' },
  itemLabel: {
    fontFamily: 'tajawal',
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    ...rtlTextStyle,
  },
  itemSub: {
    fontFamily: 'tajawal',
    color: colors.textMuted,
    fontSize: 11.5,
    marginTop: 2,
    ...rtlTextStyle,
  },
  arrow: { fontSize: 22, color: colors.burgundyLight, fontWeight: '700' },
});
