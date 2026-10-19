// النماذج التدريبية — مرجعية AI Studio (PracticeModelsSection.tsx)
// التدفق: نماذج ← أسئلة ← نتيجة — كل البيانات من Firestore
// sources/practice_models/models/{id}/questions
import { useEffect, useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { Award, Inbox } from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import EmptyStateCard from '../../components/EmptyStateCard';
import { SkeletonBlock } from '../../components/Skeleton';
import QuizRunner, { arCount } from './QuizRunner';
import {
  fetchPracticeModels,
  fetchPracticeQuestions,
  type QuizSubject,
  type QuizQuestion,
} from '../../bank/quizBank';

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

export default function PracticeModelsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [models, setModels] = useState<QuizSubject[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [model, setModel] = useState<QuizSubject | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchPracticeModels()
      .then((list) => {
        if (alive) {
          setModels(list);
          setModelsLoading(false);
        }
      })
      .catch(() => {
        if (alive) setModelsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const openModel = (m: QuizSubject) => {
    setModel(m);
    setQuestions([]);
    setQuestionsLoading(true);
    fetchPracticeQuestions(m.id)
      .then((list) => {
        setQuestions(list);
        setQuestionsLoading(false);
      })
      .catch(() => setQuestionsLoading(false));
  };

  const backToModels = () => {
    setModel(null);
  };

  if (model) {
    return (
      <QuizRunner
        title={model.name}
        subjectId={model.id}
        questions={questions}
        loading={questionsLoading}
        onExit={backToModels}
        onRetry={() => openModel(model)}
      />
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <Text style={[styles.heading, rtlTextStyle]}>{'النماذج التدريبية'}</Text>
      <Text style={[styles.sub, rtlTextStyle]}>
        {bidi('نماذج USMLE وNBME الرسمية — اختر النموذج لبدء الاختبار')}
      </Text>
      {modelsLoading ? (
        <ListSkeleton />
      ) : models.length === 0 ? (
        <EmptyStateCard
          icon={Inbox}
          title="لا توجد نماذج"
          message="تعذّر تحميل النماذج التدريبية — تحقق من الاتصال وحاول مجددًا"
          actionLabel="إعادة المحاولة"
          onAction={() => {
            setModelsLoading(true);
            fetchPracticeModels()
              .then((l) => {
                setModels(l);
                setModelsLoading(false);
              })
              .catch(() => setModelsLoading(false));
          }}
        />
      ) : (
        <View style={styles.list}>
          {models.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.row, shadows.card]}
              activeOpacity={0.7}
              onPress={() => openModel(m)}>
              <View style={styles.rowBody}>
                <Text style={[styles.rowName, rtlTextStyle]}>{bidi(m.name)}</Text>
                <Text style={[styles.rowMeta, rtlTextStyle]}>
                  {m.questionCount !== null ? arCount(m.questionCount) : 'نموذج تدريبي'}
                </Text>
              </View>
              <View style={styles.iconBox}>
                <Award size={22} color={colors.burgundy} />
              </View>
              <Text style={styles.go}>‹</Text>
            </TouchableOpacity>
          ))}
        </View>
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
    textAlign: 'right',
    marginBottom: 4,
    writingDirection: 'rtl',
  },
  sub: {
    fontFamily: 'tajawal',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: 14,
    writingDirection: 'rtl',
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
  rowBody: { flex: 1 },
  rowName: {
    fontFamily: 'tajawal',
    fontSize: 15.5,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'right',
    marginBottom: 2,
    writingDirection: 'rtl',
  },
  rowMeta: {
    fontFamily: 'tajawal',
    fontSize: 12.5,
    color: colors.textSecondary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  go: { fontSize: 22, color: colors.burgundyLight, fontWeight: '700' },
});
