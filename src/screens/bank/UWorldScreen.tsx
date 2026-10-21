// أسئلة UWorld — مرجعية AI Studio (UWorldSection.tsx)
// التدفق: مواد ← مواضيع ← أسئلة ← نتيجة — كل البيانات من Firestore
// sources/uworld_bank/subjects → topics → questions
import { useEffect, useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { Calendar, Inbox, Layers, Lock } from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import Badge from '../../components/Badge';
import EmptyStateCard from '../../components/EmptyStateCard';
import { SkeletonBlock } from '../../components/Skeleton';
import QuizRunner, { arCount } from './QuizRunner';
import LockView from './LockView';
import { canOpenBankSubject } from '../../payment/gates';
import { isActivated } from '../../auth/auth';
import {
  fetchUWorldSubjects,
  fetchUWorldTopics,
  fetchUWorldQuestions,
  fetchBankClassTopics,
  fetchBankClassQuestions,
  subjectIcon,
  type QuizSubject,
  type QuizTopic,
  type QuizQuestion,
} from '../../bank/quizBank';

type Step = 'subjects' | 'topics' | 'quiz';
// وضع تصفح بنك الوطني: حسب الجلسات (الافتراضي) أو حسب المواضيع — قرار الدكتور
type BrowseMode = 'sessions' | 'topics';

function ListSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.list}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.row}>
          <SkeletonBlock width={40} height={40} borderRadius={20} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonBlock width="60%" height={15} />
            <SkeletonBlock width="40%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function UWorldScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [step, setStep] = useState<Step>('subjects');
  const [mode, setMode] = useState<BrowseMode>('sessions');
  const [lock, setLock] = useState<{ title: string; message: string } | null>(null);
  const [subjects, setSubjects] = useState<QuizSubject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subject, setSubject] = useState<QuizSubject | null>(null);
  const [topics, setTopics] = useState<QuizTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topic, setTopic] = useState<QuizTopic | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchUWorldSubjects()
      .then((list) => {
        if (alive) {
          setSubjects(list);
          setSubjectsLoading(false);
        }
      })
      .catch(() => {
        if (alive) setSubjectsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const openSubject = (s: QuizSubject) => {
    // قفل البنك الوحيد: المادة الأولى مجانية وباقي المواد بالتفعيل
    const gate = canOpenBankSubject(subjects.map((x) => x.id), s.id);
    if (!gate.open) {
      setLock({
        title: s.name,
        message: gate.reason || 'هذه المادة مقفلة — فعّل حسابك لفتح جميع المواد',
      });
      return;
    }
    setSubject(s);
    setTopics([]);
    setTopicsLoading(true);
    setStep('topics');
    const load = mode === 'topics' ? fetchBankClassTopics : fetchUWorldTopics;
    load(s.id)
      .then((list) => {
        setTopics(list);
        setTopicsLoading(false);
        // موضوع واحد فقط ← انتقال مباشر للأسئلة
        if (list.length === 1) openTopic(list[0], s);
      })
      .catch(() => setTopicsLoading(false));
  };

  const openTopic = (t: QuizTopic, s?: QuizSubject) => {
    const subj = s ?? subject;
    if (!subj) return;
    setTopic(t);
    setQuestions([]);
    setQuestionsLoading(true);
    setStep('quiz');
    const load = mode === 'topics' ? fetchBankClassQuestions : fetchUWorldQuestions;
    load(subj.id, t.id)
      .then((list) => {
        setQuestions(list);
        setQuestionsLoading(false);
      })
      .catch(() => setQuestionsLoading(false));
  };

  const backToSubjects = () => {
    setStep('subjects');
    setSubject(null);
    setTopic(null);
  };
  const backToTopics = () => {
    setStep('topics');
    setTopic(null);
  };

  if (lock) {
    return (
      <LockView
        title={lock.title}
        message={lock.message}
        backLabel="رجوع إلى المواد"
        onBack={() => setLock(null)}
      />
    );
  }

  if (step === 'quiz' && topic) {
    return (
      <QuizRunner
        title={`${subject?.name ?? ''} — ${topic.name}`}
        subjectId={subject?.id}
        questions={questions}
        loading={questionsLoading}
        onExit={backToTopics}
        onRetry={() => openTopic(topic)}
      />
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      {step === 'subjects' && (
        <>
          <Text style={[styles.heading, rtlTextStyle]}>{bidi('بنك الوطني')}</Text>
          <Text style={[styles.sub, rtlTextStyle]}>
            {mode === 'topics'
              ? 'اختر المادة ثم الموضوع لبدء الاختبار'
              : 'اختر المادة ثم الجلسة لبدء الاختبار'}
          </Text>

          {/* مدخل ثنائي: حسب الجلسات | حسب المواضيع — قرار الدكتور */}
          <View style={[styles.modeCard, shadows.card]}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'sessions' && styles.modeBtnActive]}
              activeOpacity={0.7}
              onPress={() => setMode('sessions')}>
              <Calendar size={15} color={mode === 'sessions' ? colors.white : colors.burgundy} strokeWidth={2.2} />
              <Text style={[styles.modeText, mode === 'sessions' && styles.modeTextActive]}>حسب الجلسات</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'topics' && styles.modeBtnActive]}
              activeOpacity={0.7}
              onPress={() => setMode('topics')}>
              <Layers size={15} color={mode === 'topics' ? colors.white : colors.burgundy} strokeWidth={2.2} />
              <Text style={[styles.modeText, mode === 'topics' && styles.modeTextActive]}>حسب المواضيع</Text>
            </TouchableOpacity>
          </View>
          {subjectsLoading ? (
            <ListSkeleton />
          ) : subjects.length === 0 ? (
            <EmptyStateCard
              icon={Inbox}
              title="لا توجد مواد"
              message="تعذّر تحميل مواد بنك الوطني — تحقق من الاتصال وحاول مجددًا"
              actionLabel="إعادة المحاولة"
              onAction={() => {
                setSubjectsLoading(true);
                fetchUWorldSubjects()
                  .then((l) => {
                    setSubjects(l);
                    setSubjectsLoading(false);
                  })
                  .catch(() => setSubjectsLoading(false));
              }}
            />
          ) : (
            <View style={styles.list}>
              {subjects.map((s, si) => {
                const gate = canOpenBankSubject(subjects.map((x) => x.id), s.id);
                const locked = !gate.open;
                const isFree = si === 0 && !isActivated();
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.row, shadows.card]}
                    activeOpacity={0.7}
                    onPress={() => openSubject(s)}>
                    <View style={styles.iconBox}>
                      <Text style={styles.icon}>{subjectIcon(s.name)}</Text>
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowName, rtlTextStyle]}>{bidi(s.name)}</Text>
                      <Text style={[styles.rowMeta, rtlTextStyle]}>
                        {bidi(
                          s.questionCount !== null
                            ? arCount(s.questionCount)
                            : 'أسئلة بنك الوطني',
                        )}
                      </Text>
                    </View>
                    {locked ? (
                      <Lock size={15} color={colors.textMuted} />
                    ) : isFree ? (
                      <Badge kind="free" label="مجاني" />
                    ) : null}
                    <Text style={styles.go}>‹</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </>
      )}

      {step === 'topics' && (
        <>
          <TouchableOpacity style={styles.backLink} activeOpacity={0.7} onPress={backToSubjects}>
            <Text style={[styles.backLinkText, rtlTextStyle]}>{'› رجوع للمواد'}</Text>
          </TouchableOpacity>
          <Text style={[styles.heading, rtlTextStyle]}>{bidi(subject?.name ?? '')}</Text>
          <Text style={[styles.sub, rtlTextStyle]}>
            {mode === 'topics' ? 'اختر الموضوع' : 'اختر الجلسة'}
          </Text>
          {topicsLoading ? (
            <ListSkeleton />
          ) : topics.length === 0 ? (
            <EmptyStateCard
              icon={Inbox}
              title={mode === 'topics' ? 'لا توجد مواضيع' : 'لا توجد جلسات'}
              message={
                mode === 'topics'
                  ? 'لا توجد مواضيع مصنفة لهذه المادة بعد'
                  : 'تعذّر تحميل الجلسات — تحقق من الاتصال وحاول مجددًا'
              }
            />
          ) : (
            <View style={styles.list}>
              {topics.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.row, shadows.card]}
                  activeOpacity={0.7}
                  onPress={() => openTopic(t)}>
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowName, rtlTextStyle]}>{bidi(t.name)}</Text>
                    {t.questionCount !== null && (
                      <Text style={[styles.rowMeta, rtlTextStyle]}>
                        {arCount(t.questionCount)}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.go}>‹</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  heading: {
    fontFamily: 'tajawal',
    fontSize: 18,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 4,
  },
  sub: {
    fontFamily: 'tajawal',
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  // مدخل التصفح الثنائي (نفس نمط NationalSections)
  modeCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    padding: 5,
    gap: 6,
    marginBottom: 14,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radius.sm,
  },
  modeBtnActive: { backgroundColor: colors.burgundy },
  modeText: {
    fontFamily: 'tajawal',
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.burgundy,
  },
  modeTextActive: { color: colors.white },
  // رابط الرجوع عند بداية السطر (اليمين في RTL) مثل NationalSections — كان flex-end فيدفعه لليسار
  backLink: { marginBottom: 8, alignSelf: 'flex-start' },
  backLinkText: {
    fontFamily: 'tajawal',
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.burgundy,
  },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accordionBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 24 },
  rowBody: { flex: 1 },
  rowName: {
    fontFamily: 'tajawal',
    fontSize: 15.5,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 2,
  },
  rowMeta: {
    fontFamily: 'tajawal',
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  go: { fontSize: 22, color: colors.burgundyLight, fontWeight: '700' },
});
