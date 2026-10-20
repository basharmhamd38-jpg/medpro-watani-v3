// دورات الوطني — المواد والجلسات والأسئلة من SQLite المحلية أولًا (أوفلاين)
// المواد: subjects (kind='dawrat') — الجلسات: sessions (الأحدث أولًا)
// Firestore احتياطي فقط عند غياب البيانات محليًا — ليس مصدرًا أساسيًا
import { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, FlatList, type ListRenderItem } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { Calendar, ChevronDown, Layers, Lock } from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import Badge from '../../components/Badge';
import EmptyStateCard from '../../components/EmptyStateCard';
import { SkeletonBlock } from '../../components/Skeleton';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import {
  getBankSubjects,
  getSubjectSessions,
  toBankSession,
} from '../../db/bankRead';
import { canOpenSession } from '../../payment/gates';
import { isActivated } from '../../auth/auth';
import LockView from './LockView';
import {
  type BankSession,
} from '../../bank/firestore';

const SECTION_NAMES = [
  'القلبية',
  'الجلدية',
  'الهضمية والكبد',
  'الدموية',
  'الكلية والشوارد',
  'العصبية',
  'النسائية والتوليد',
  'الأطفال',
  'الصدرية',
  'الرثوية',
  'الجراحة العامة',
  'مواد أخرى',
];

// توزيع المواد الـ27 على الأقسام حسب الاسم (معرفات Firestore هي الأسماء العربية نفسها)
const SECTION_OF: Record<string, number> = {
  'القلبية': 0, 'جراحة القلب': 0, 'جراحة الأوعية': 0,
  'الجلدية': 1,
  'الهضمية والكبد': 2, 'الغدية والسكري': 2,
  'الدموية': 3,
  'الكلية والشوارد': 4,
  'العصبية': 5, 'الجراحة العصبية': 5,
  'النسائية': 6, 'التوليد': 6,
  'الأطفال 1': 7, 'الأطفال 2': 7, 'جراحة الأطفال': 7,
  'الصدرية': 8, 'جراحة الصدر': 8,
  'الرثوية': 9,
  'الجراحة العامة': 10, 'جراحة الأورام': 10, 'الجراحة العظمية': 10,
  'الجراحة التجميلية': 10, 'الجراحة البولية': 10,
  'الأذنية': 11, 'العينية': 11, 'الخمجية': 11, 'الطب النفسي': 11,
};

type Subject = { id: string; name: string };

// ارتفاع ثابت لصف الجلسة (56) + الفاصل (6) — يطابق getItemLayout بدقة
// لمنع أي قفزات تمرير. أسماء الجلسات قصيرة (سطر واحد) فالارتفاع ثابت آمن.
const SESSION_ROW_HEIGHT = 56;
const SESSION_ROW_GAP = 6;
const SESSION_ITEM_LENGTH = SESSION_ROW_HEIGHT + SESSION_ROW_GAP;

function arCount(n: number): string {
  if (n === 1) return 'سؤال واحد';
  if (n === 2) return 'سؤالان';
  if (n >= 3 && n <= 10) return `${n} أسئلة`;
  return `${n} سؤالًا`;
}

// هيكل تحميل لقائمة المواد (يطابق صفوف المواد)
function SubjectsSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.skelList}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.acc}>
          <View style={styles.accHead}>
            <SkeletonBlock width="35%" height={16} />
            <SkeletonBlock width={60} height={24} borderRadius={20} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function NationalSections({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [openSection, setOpenSection] = useState<number | null>(0);
  const [lock, setLock] = useState<{ title: string; message: string } | null>(null);
  // وضع التصفح: حسب السنوات (افتراضي) أو حسب المواضيع — قرار الدكتور 9 أكتوبر
  const [mode, setMode] = useState<'years' | 'topics'>('years');

  // المواد: الـseed يظهر فورًا، ثم تُستبدل بنتائج Firestore الحية عند وصولها
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);

  // التنقيب للجلسات: المادة المختارة ← جلساتها من Firestore
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  const [sessions, setSessions] = useState<BankSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // المواد: SQLite أولًا — Firestore مهجورة (تُعاد قائمة فارغة عند غياب البيانات)
  const loadSubjects = async (): Promise<Subject[]> => {
    const local = await getBankSubjects('dawrat');
    if (local.length > 0) return local.map((s) => ({ id: s.id, name: s.name }));
    return [];
  };

  // الجلسات: SQLite أولًا — Firestore مهجورة
  const loadSessionsData = async (subjectId: string): Promise<BankSession[]> => {
    const local = await getSubjectSessions(subjectId);
    if (local.length > 0) {
      // الأحدث أولًا — year تنازليًا ثم الاسم
      return local
        .map(toBankSession)
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.name.localeCompare(b.name, 'ar'));
    }
    return [];
  };

  useEffect(() => {
    let alive = true;
    loadSubjects()
      .then((list) => {
        if (!alive) return;
        setSubjects(list);
        setSubjectsLoading(false);
      })
      .catch(() => {
        if (alive) setSubjectsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const sections = useMemo(() => {
    const buckets: Subject[][] = SECTION_NAMES.map(() => []);
    for (const s of subjects) {
      const i = SECTION_OF[s.name] ?? 11;
      buckets[i].push(s);
    }
    return buckets.map((list, i) => ({ name: SECTION_NAMES[i], subjects: list }));
  }, [subjects]);

  // أسماء الجلسات معالَجة بـ bidi مرة واحدة لكل تحميل — لا معالجة داخل العرض
  const sessionsBidi = useMemo(
    () => sessions.map((s) => ({ ...s, nameBidi: bidi(s.name) })),
    [sessions],
  );

  if (lock) {
    return (
      <LockView
        title={lock.title}
        message={lock.message}
        backLabel="رجوع إلى الدورات"
        onBack={() => setLock(null)}
      />
    );
  }

  const loadSessions = (s: Subject) => {
    setActiveSubject(s);
    setSessions([]);
    setSessionsLoading(true);
    loadSessionsData(s.id)
      .then((list) => {
        setSessions(list);
        setSessionsLoading(false);
      })
      .catch(() => {
        // بلا catch كان الهيكل يبقى للأبد — الآن تُعرض بطاقة "لا توجد جلسات" مع زر إعادة المحاولة
        setSessionsLoading(false);
      });
  };

  const openSession = (session: BankSession, sessionIndex: number) => {
    if (!activeSubject) return;
    const gate = canOpenSession(sessionIndex);
    if (gate.open) {
      navigation.navigate('BankQuestion', {
        source: 'watani',
        subjectId: activeSubject.id,
        sessionId: session.id,
        title: `${activeSubject.name} — ${session.name}`,
      });
    } else {
      setLock({
        title: `${activeSubject.name} — ${session.name}`,
        message: 'هذه الدورة مقفلة — فعّل حسابك لفتح جميع الدورات والأسئلة',
      });
    }
  };

  const openTopicMode = (s: Subject) => {
    navigation.navigate('SubjectTopics', {
      subjectId: s.id,
      title: s.name,
      kind: 'dawrat',
    });
  };

  // ─── عرض الجلسات (التنقيب) — FlatList افتراضية بلا ScrollView متداخلة ───
  if (activeSubject) {
    const activated = isActivated();

    const renderSession: ListRenderItem<(typeof sessionsBidi)[number]> = ({ item: sess, index: i }) => {
      const gate = canOpenSession(i);
      const locked = !gate.open;
      const isFree = i < 2 && !activated;
      return (
        <TouchableOpacity
          style={[styles.round, styles.sessionRow, locked && styles.roundLocked]}
          activeOpacity={0.7}
          onPress={() => openSession(sess, i)}>
          <Text style={[styles.roundName, locked && styles.roundNameLocked, rtlTextStyle]} numberOfLines={1}>
            {sess.nameBidi}
          </Text>
          <View style={styles.roundMeta}>
            <Text style={styles.roundCount}>{arCount(sess.questionCount ?? 0)}</Text>
            {locked ? (
              <Lock size={14} color={colors.textMuted} />
            ) : isFree ? (
              <Badge kind="free" label="مجاني" />
            ) : null}
          </View>
        </TouchableOpacity>
      );
    };

    const sessionsHeader = (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.backRow}
          activeOpacity={0.7}
          onPress={() => setActiveSubject(null)}>
          <Text style={styles.backRowText}>› رجوع إلى المواد</Text>
        </TouchableOpacity>
        <Text style={[styles.cardTitle, rtlTextStyle]}>{bidi(activeSubject.name)}</Text>
        <Text style={styles.note}>الجلسات مرتبة من الأحدث إلى الأقدم</Text>
      </View>
    );

    const sessionsEmpty = sessionsLoading ? (
      <View style={[styles.card, styles.skelListTop]}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.round, styles.sessionRow]}>
            <SkeletonBlock width="55%" height={15} />
            <SkeletonBlock width={70} height={20} borderRadius={20} />
          </View>
        ))}
      </View>
    ) : (
      <EmptyStateCard
        icon={Calendar}
        title="لا توجد جلسات"
        message="تعذّر تحميل جلسات هذه المادة — تحقق من الاتصال وحاول مجددًا"
        actionLabel="إعادة المحاولة"
        onAction={() => loadSessions(activeSubject)}
      />
    );

    return (
      <FlatList
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        data={sessionsBidi}
        keyExtractor={(s) => s.id}
        renderItem={renderSession}
        ListHeaderComponent={sessionsHeader}
        ListEmptyComponent={sessionsEmpty}
        ItemSeparatorComponent={() => <View style={{ height: SESSION_ROW_GAP }} />}
        getItemLayout={(_, index) => ({
          length: SESSION_ITEM_LENGTH,
          offset: SESSION_ITEM_LENGTH * index,
          index,
        })}
        windowSize={7}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        removeClippedSubviews={true}
      />
    );
  }

  // ─── عرض المواد ───
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {subjects.length > 0 ? `${subjects.length} مادة في ${SECTION_NAMES.length} قسمًا` : 'دورات الوطني'}
        </Text>
        <View style={styles.noteRow}>
          <Text style={styles.note}>آخر دورتين </Text>
          <Badge kind="free" label="مجاني" />
          <Text style={styles.note}> ومفتوحتان بالكامل — الدورات الأقدم ظاهرة للتصفح ومقفلة بالتفعيل</Text>
        </View>
      </View>

      {/* مفتاح وضع التصفح — بأسلوب الموقع: بطاقة بيضاء والنشط عنابي مصمت */}
      <View style={[styles.modeCard, shadows.card]}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'topics' && styles.modeBtnActive]}
          activeOpacity={0.7}
          onPress={() => setMode('topics')}>
          <Layers size={15} color={mode === 'topics' ? colors.white : colors.burgundy} strokeWidth={2.2} />
          <Text style={[styles.modeText, mode === 'topics' && styles.modeTextActive]}>المواضيع</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'years' && styles.modeBtnActive]}
          activeOpacity={0.7}
          onPress={() => setMode('years')}>
          <Calendar size={15} color={mode === 'years' ? colors.white : colors.burgundy} strokeWidth={2.2} />
          <Text style={[styles.modeText, mode === 'years' && styles.modeTextActive]}>الجلسات والدورات</Text>
        </TouchableOpacity>
      </View>

      {subjectsLoading && subjects.length === 0 ? (
        <SubjectsSkeleton />
      ) : subjects.length === 0 ? (
        <EmptyStateCard
          icon={Layers}
          title="لا توجد مواد"
          message="تعذّر تحميل مواد الدورات الوطنية — تحقق من الاتصال وحاول مجددًا"
          actionLabel="إعادة المحاولة"
          onAction={() => {
            setSubjectsLoading(true);
            loadSubjects()
              .then((list) => {
                setSubjects(list);
                setSubjectsLoading(false);
              })
              .catch(() => {
                // فشل إعادة المحاولة ← إيقاف الهيكل وإبقاء بطاقة الخطأ
                setSubjectsLoading(false);
              });
          }}
        />
      ) : (
        <View style={styles.card}>
          {sections.map((sec, si) => {
            const open = openSection === si;
            return (
              <View key={sec.name} style={styles.acc}>
                <TouchableOpacity
                  style={styles.accHead}
                  activeOpacity={0.7}
                  onPress={() => setOpenSection(open ? null : si)}>
                  <Text style={[styles.accName, rtlTextStyle]}>{bidi(sec.name)}</Text>
                  <View style={styles.accMeta}>
                    <View style={styles.countPill}>
                      <Text style={styles.countText}>{sec.subjects.length} مواد</Text>
                    </View>
                    <ChevronDown
                      size={18}
                      color={colors.burgundy}
                      style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
                    />
                  </View>
                </TouchableOpacity>

                {open && (
                  <View style={styles.accBody}>
                    {sec.subjects.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={styles.round}
                        activeOpacity={0.7}
                        onPress={() => (mode === 'topics' ? openTopicMode(s) : loadSessions(s))}>
                        <Text style={[styles.roundName, rtlTextStyle]}>{bidi(s.name)}</Text>
                        <View style={styles.roundMeta}>
                          <Text style={styles.backGlyph}>‹</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                    {sec.subjects.length === 0 && (
                      <Text style={styles.emptyNote}>لا توجد مواد في هذا القسم بعد</Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
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
    textAlign: 'left',
    marginBottom: 8,
    writingDirection: 'ltr',
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
  noteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 12,
  },
  modeCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    padding: 4,
    gap: 4,
    marginBottom: 12,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modeBtnActive: {
    backgroundColor: colors.burgundy,
  },
  modeText: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.burgundy,
  },
  modeTextActive: {
    fontFamily: 'tajawal',
    color: colors.white,
  },
  backGlyph: {
    fontFamily: 'tajawal',
    fontSize: 20,
    color: colors.burgundy,
    fontWeight: '700',
  },
  note: {
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  acc: {
    backgroundColor: colors.accordionBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 8,
    overflow: 'hidden',
  },
  accHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  accName: {
    fontFamily: 'tajawal',
    fontSize: 15,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  accMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countPill: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  countText: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.burgundy,
  },
  accBody: { paddingHorizontal: 12, paddingBottom: 12 },
  round: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  // صف الجلسة في FlatList: ارتفاع ثابت يطابق getItemLayout (الفاصل عبر ItemSeparatorComponent)
  sessionRow: { height: SESSION_ROW_HEIGHT, marginBottom: 0 },
  roundLocked: { opacity: 0.85 },
  roundName: {
    fontFamily: 'tajawal',
    fontSize: 13.5,
    fontWeight: '400',
    color: colors.text,
    textAlign: 'left',
    flex: 1,
    writingDirection: 'ltr',
  },
  roundNameLocked: { color: colors.textSecondary },
  roundMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundCount: {
    fontFamily: 'tajawal',
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyNote: {
    fontFamily: 'tajawal',
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 10,
  },
});
