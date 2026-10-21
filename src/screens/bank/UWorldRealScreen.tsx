// أسئلة UWorld — بنك UWorld العالمي 2025 بالعربية (uworld/ shards)
// تبويب مستقل عن بنك الوطني (قرار الدكتور 21 أكتوبر 2026).
// التدفق: مواد ← أسئلة (موضوع وحيد «UWorld 2025» يُخترق تلقائيًا) ← نتيجة
// البيانات: SQLite أولًا ← Cloudflare احتياطيًا — التحميل من زر القسم هنا.
import { useEffect, useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { Inbox, Lock } from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import Badge from '../../components/Badge';
import EmptyStateCard from '../../components/EmptyStateCard';
import SectionDownloadCard from '../../components/SectionDownloadCard';
import { SkeletonBlock } from '../../components/Skeleton';
import QuizRunner, { arCount } from './QuizRunner';
import LockView from './LockView';
import { canOpenBankSubject } from '../../payment/gates';
import { isActivated } from '../../auth/auth';
import {
  fetchRealUWorldSubjects,
  fetchRealUWorldTopics,
  fetchRealUWorldQuestions,
  subjectIcon,
  type QuizSubject,
  type QuizTopic,
  type QuizQuestion,
} from '../../bank/quizBank';

type Step = 'subjects' | 'topics' | 'quiz';

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

export default function UWorldRealScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [step, setStep] = useState<Step>('subjects');
  const [lock, setLock] = useState<{ title: string; message: string } | null>(null);
  const [subjects, setSubjects] = useState<QuizSubject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subject, setSubject] = useState<QuizSubject | null>(null);
  const [topics, setTopics] = useState<QuizTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topic, setTopic] = useState<QuizTopic | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  // يُزاد بعد اكتمال تحميل القسم لإعادة جلب المواد
  const [dlTick, setDlTick] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchRealUWorldSubjects()
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
  }, [dlTick]);

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
    fetchRealUWorldTopics(s.id)
      .then((list) => {
        setTopics(list);
        setTopicsLoading(false);
        // موضوع واحد فقط («UWorld 2025») ← انتقال مباشر للأسئلة
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
    fetchRealUWorldQuestions(subj.id, t.id)
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
          <Text style={[styles.heading, rtlTextStyle]}>{bidi('أسئلة UWorld')}</Text>
          <Text style={[styles.sub, rtlTextStyle]}>
            بنك UWorld العالمي 2025 مترجمًا للعربية — اختر المادة لبدء الاختبار
          </Text>
          {/* تحميل القسم من زرّه هنا — لا تحميل عند دخول التطبيق (أمر الدكتور) */}
          <SectionDownloadCard section="uworld" onCompleted={() => setDlTick((t) => t + 1)} />
          {subjectsLoading ? (
            <ListSkeleton />
          ) : subjects.length === 0 ? (
            <EmptyStateCard
              icon={Inbox}
              title="لا توجد مواد محمّلة"
              message="أسئلة UWorld غير محمّلة على جهازك بعد — استخدم زر التحميل بالأعلى لتحميلها مرة واحدة والعمل دون اتصال"
              actionLabel="إعادة المحاولة"
              onAction={() => {
                setSubjectsLoading(true);
                fetchRealUWorldSubjects()
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
                            : 'أسئلة UWorld',
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
          <Text style={[styles.sub, rtlTextStyle]}>اختر الموضوع</Text>
          {topicsLoading ? (
            <ListSkeleton />
          ) : topics.length === 0 ? (
            <EmptyStateCard
              icon={Inbox}
              title="لا توجد مواضيع"
              message="أسئلة هذه المادة غير محمّلة على جهازك بعد — ارجع واستخدم زر تحميل القسم"
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
