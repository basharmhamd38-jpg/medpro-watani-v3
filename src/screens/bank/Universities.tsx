// دورات الجامعات — تصفح البنية ثم التنقيب للأسئلة من SQLite المحلية أولًا (أوفلاين)
// مواد الجامعات: subjects (kind='university') — ids بصيغة uni_<univ>_<base>
// المستوى الوسيط: sessions (مواضيع) — الأسئلة: questions
// Firestore احتياطي فقط عند غياب البيانات محليًا — ليس مصدرًا أساسيًا.
// نموذج التفعيل: تصفح الجامعات حر — المادة الأولى في البنك مجانية وباقي المواد بالتفعيل.
import { useEffect, useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { Building2, Lock } from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import Badge from '../../components/Badge';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import EmptyStateCard from '../../components/EmptyStateCard';
import SectionDownloadCard from '../../components/SectionDownloadCard';
import { SkeletonBlock } from '../../components/Skeleton';
import { canOpenBankSubject } from '../../payment/gates';
import { isActivated } from '../../auth/auth';
import LockView from './LockView';
import {
  FALLBACK_UNIVERSITIES,
  fetchUniversities,
  formatCount,
  type University,
} from './universities';
import {
  getLocalUniversities,
  getUniversitySubjects,
  getSubjectSessions,
  getBankSubjects,
  toBankSubject,
  toBankSession,
} from '../../db/bankRead';
import {
  fetchUnivSubjects,
  fetchUnivSessions,
  type BankSubject,
  type BankSession,
} from '../../bank/firestore';

type BankView =
  | { kind: 'list' }
  | { kind: 'subjects'; uni: University }
  | { kind: 'sessions'; uni: University; subject: BankSubject };

export default function Universities({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [lock, setLock] = useState<{ title: string; message?: string } | null>(null);
  // ترتيب مواد البنك كاملًا (لحساب المادة الأولى المجانية)
  const [bankSubjectIds, setBankSubjectIds] = useState<string[]>([]);
  // الأعداد تُقرأ ديناميكيًا من SQLite المحلية — والاحتياطي معروض فورًا بلا انتظار
  const [unis, setUnis] = useState<University[]>(FALLBACK_UNIVERSITIES);

  const [view, setView] = useState<BankView>({ kind: 'list' });
  const [items, setItems] = useState<(BankSubject | BankSession)[]>([]);
  const [loading, setLoading] = useState(false);
  // يُزاد بعد اكتمال تحميل القسم لإعادة جلب الجامعات/المواد من SQLite
  const [dlTick, setDlTick] = useState(0);

  useEffect(() => {
    let alive = true;
    getBankSubjects('university')
      .then((list) => {
        if (alive) setBankSubjectIds(list.map((s) => s.id));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [dlTick]);

  useEffect(() => {
    let alive = true;
    // SQLite أولًا — Firestore احتياطي فقط عند غياب البيانات محليًا
    getLocalUniversities()
      .then((local) => {
        if (!alive) return;
        if (local.length > 0) {
          setUnis(local);
        } else {
          fetchUniversities().then((u) => {
            if (alive) setUnis(u);
          });
        }
      })
      .catch(() => {
        fetchUniversities().then((u) => {
          if (alive) setUnis(u);
        });
      });
    return () => {
      alive = false;
    };
  }, [dlTick]);

  if (lock) {
    return (
      <LockView
        title={lock.title}
        message={
          lock.message ||
          'هذه المادة مقفلة — المادة الأولى في دورات الجامعات مجانية، وفتح باقي المواد يتطلب التفعيل'
        }
        backLabel="رجوع إلى الجامعات"
        onBack={() => setLock(null)}
      />
    );
  }

  // المواد: SQLite أولًا — Firestore احتياطي فقط عند غياب البيانات محليًا
  const loadUniSubjects = async (uniId: string): Promise<BankSubject[]> => {
    const local = await getUniversitySubjects(uniId);
    if (local.length > 0) return local.map((s, i) => toBankSubject(s, i));
    return fetchUnivSubjects(uniId);
  };

  // الجلسات/المواضيع: SQLite أولًا — Firestore احتياطي فقط عند غياب البيانات محليًا
  const loadUniSessions = async (uniId: string, subjectId: string): Promise<BankSession[]> => {
    const local = await getSubjectSessions(subjectId);
    if (local.length > 0) {
      // الأحدث أولًا — year تنازليًا ثم الاسم
      return local
        .map(toBankSession)
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.name.localeCompare(b.name, 'ar'));
    }
    return fetchUnivSessions(uniId, subjectId);
  };

  // تصفح الجامعات والمواد حر للجميع — القفل عند فتح المادة المقفلة فقط
  const openUni = (u: University) => {
    // لا مواد مرفوعة بعد لهذه الجامعة
    if (u.count == null) return;
    const next: BankView = { kind: 'subjects', uni: u };
    setView(next);
    setItems([]);
    setLoading(true);
    loadUniSubjects(u.id).then((list) => {
      setItems(list);
      setLoading(false);
    });
  };

  const openSubject = (v: { kind: 'subjects'; uni: University }, s: BankSubject) => {
    // قفل البنك الوحيد: المادة الأولى مجانية وباقي المواد بالتفعيل
    const gate = canOpenBankSubject(bankSubjectIds, s.id);
    if (!gate.open) {
      setLock({ title: s.name, message: gate.reason });
      return;
    }
    const next: BankView = { kind: 'sessions', uni: v.uni, subject: s };
    setView(next);
    setItems([]);
    setLoading(true);
    loadUniSessions(v.uni.id, s.id).then((list) => {
      setItems(list);
      setLoading(false);
    });
  };

  const openSession = (v: { kind: 'sessions'; uni: University; subject: BankSubject }, sess: BankSession) => {
    navigation.navigate('BankQuestion', {
      source: 'jami3at',
      univId: v.uni.id,
      subjectId: v.subject.id,
      sessionId: sess.id,
      title: `${v.uni.name} — ${v.subject.name} — ${sess.name}`,
    });
  };

  const retry = () => {
    if (view.kind === 'subjects') {
      setLoading(true);
      loadUniSubjects(view.uni.id).then((list) => {
        setItems(list);
        setLoading(false);
      });
    } else if (view.kind === 'sessions') {
      setLoading(true);
      loadUniSessions(view.uni.id, view.subject.id).then((list) => {
        setItems(list);
        setLoading(false);
      });
    }
  };

  const backFrom = () => {
    if (view.kind === 'sessions') {
      // رجوع لمستوى المواد — إعادة جلبها سريعة
      openUni(view.uni);
    } else {
      setView({ kind: 'list' });
    }
  };

  // ─── التنقيب: المواد / المواضيع ───
  if (view.kind !== 'list') {
    const title =
      view.kind === 'subjects'
        ? `${view.uni.name} — المواد`
        : `${view.subject.name} — المواضيع`;
    const pressItem = (it: BankSubject | BankSession) =>
      view.kind === 'subjects'
        ? openSubject(view, it as BankSubject)
        : openSession(view, it as BankSession);
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.backRow} activeOpacity={0.7} onPress={backFrom}>
            <Text style={styles.backRowText}>
              › رجوع إلى {view.kind === 'subjects' ? 'الجامعات' : 'المواد'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.cardTitle}>{title}</Text>

          {loading ? (
            <View style={[styles.skelList, styles.skelListTop]}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.row}>
                  <SkeletonBlock width="50%" height={15} />
                  <SkeletonBlock width={70} height={20} borderRadius={20} />
                </View>
              ))}
            </View>
          ) : items.length === 0 ? (
            <EmptyStateCard
              icon={Building2}
              title="لا توجد بيانات"
              message="لا توجد بيانات محفوظة على الجهاز هنا — حمّل أسئلة دورات الجامعات بزر التحميل في أعلى صفحة القسم ثم أعد المحاولة"
              actionLabel="إعادة المحاولة"
              onAction={retry}
            />
          ) : (
            items.map((it) => {
              const isSubjectRow = view.kind === 'subjects';
              const locked =
                isSubjectRow && !canOpenBankSubject(bankSubjectIds, it.id).open;
              const isFree =
                isSubjectRow && bankSubjectIds[0] === it.id && !isActivated();
              return (
                <TouchableOpacity
                  key={it.id}
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => pressItem(it)}>
                  <Text style={[styles.rowName, rtlTextStyle]}>{bidi(it.name)}</Text>
                  <View style={styles.rowMeta}>
                    {it.questionCount != null && (
                      <Text style={styles.rowCount}>{formatCount(it.questionCount)}</Text>
                    )}
                    {locked ? (
                      <Lock size={14} color={colors.textMuted} />
                    ) : isFree ? (
                      <Badge kind="free" label="مجاني" />
                    ) : null}
                    <Text style={styles.go}>‹</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    );
  }

  // ─── قائمة الجامعات ───
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      {/* تحميل القسم من زرّه هنا — لا تحميل عند دخول التطبيق (أمر الدكتور) */}
      <SectionDownloadCard section="university" onCompleted={() => setDlTick((t) => t + 1)} />
      <View style={styles.card}>
        <Text style={styles.cardTitle}>تصفح البنية — {unis.length} جامعات</Text>
        <Text style={styles.note}>
          استعرض الجامعات والمواد وأعداد الأسئلة —{' '}
          <Text style={styles.noteBold}>المادة الأولى مجانية بالكامل وباقي المواد بالتفعيل</Text>
        </Text>

        {unis.map((u) => (
          <TouchableOpacity
            key={u.id}
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => openUni(u)}>
            <Text style={[styles.rowName, rtlTextStyle]}>{bidi(u.name)}</Text>
            <View style={styles.rowMeta}>
              {u.count != null ? (
                <Text style={styles.rowCount}>{formatCount(u.count)}</Text>
              ) : (
                <Badge kind="soon" label="قيد التجهيز" />
              )}
              <Text style={styles.go}>‹</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  skelList: { gap: 8 },
  skelListTop: { marginTop: 8 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    padding: 14,
    ...shadows.card,
  },
  cardTitle: {
    fontFamily: 'tajawal',
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 8,
  },
  backRow: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingVertical: 4,
  },
  backRowText: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.burgundy,
  },
  note: {
    fontFamily: 'tajawal',
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 22,
  },
  noteBold: {
    fontFamily: 'tajawal',
    fontWeight: '700',
    color: colors.title,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accordionBg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  rowName: {
    fontFamily: 'tajawal',
    fontSize: 15,
    fontWeight: '700',
    color: colors.title,
  },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowCount: {
    fontFamily: 'tajawal',
    fontSize: 13,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  go: {
    fontFamily: 'tajawal',
    fontSize: 20,
    fontWeight: '700',
    color: colors.burgundyLight,
    marginTop: -2,
  },
});
