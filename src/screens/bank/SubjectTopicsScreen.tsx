// شاشة مواضيع المادة — وضع «التصفح حسب المواضيع»
// route.params: { subjectId, title } — المواضيع من SQLite المحلية أولًا (أوفلاين)
import { useEffect, useState, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, FlatList, type ListRenderItem } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { ChevronLeft, Tags } from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { OfflineBadge } from '../../components/Badge';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import EmptyStateCard from '../../components/EmptyStateCard';
import { SkeletonList, TopicRowSkeleton } from '../../components/Skeleton';
import { getSubjectTopics } from '../../db/bankRead';

// ارتفاع ثابت لصف الموضوع (58) + الفاصل (8) — يطابق getItemLayout بدقة.
// الاسم سطر واحد مضمون (numberOfLines=1) فالارتفاع ثابت آمن.
const TOPIC_ROW_HEIGHT = 66;
const TOPIC_ROW_GAP = 8;
const TOPIC_ITEM_LENGTH = TOPIC_ROW_HEIGHT + TOPIC_ROW_GAP;

export default function SubjectTopicsScreen({ navigation, route }: { navigation: any; route: any }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { subjectId, title, kind } = route?.params ?? {};
  const [topics, setTopics] = useState<{ topic: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      // دورات الوطني: المواضيع من ملفات Cloudflare (ليست في SQLite)
      if (kind === 'dawrat') {
        try {
          const { getDawratSubjects, getDawratSubjectData } = await import('../../content/cloudflare');
          const subjects = await getDawratSubjects();
          const subj = subjects.find((s: any) => s.id === subjectId || s.subject_id === subjectId);
          if (subj?.file) {
            const data = await getDawratSubjectData(subj.file);
            const tps = Array.isArray(data?.topics) ? data.topics : [];
            if (alive) {
              setTopics(tps.map((t: any) => ({
                topic: String(t.name || t.id || ''),
                count: Array.isArray(t.questions) ? t.questions.length : 0,
              })).filter((t: any) => t.topic));
              setLoading(false);
              return;
            }
          }
        } catch { /* أكمل لـSQLite */ }
      }
      getSubjectTopics(subjectId)
        .then(rows => {
        if (alive) {
          setTopics(rows);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) setLoading(false);
      });
    })();
    return () => {
      alive = false;
    };
  }, [subjectId]);

  const openTopic = (topic: string) => {
    navigation.navigate('Question', { subjectId, title, topic, kind });
  };

  // أسماء المواضيع معالَجة بـ bidi مرة واحدة — لا معالجة داخل العرض
  const topicsBidi = useMemo(
    () => topics.map((t) => ({ ...t, nameBidi: bidi(t.topic) })),
    [topics],
  );

  const renderTopic: ListRenderItem<(typeof topicsBidi)[number]> = ({ item: t }) => (
    <TouchableOpacity
      style={[styles.row, styles.topicRow]}
      activeOpacity={0.7}
      onPress={() => openTopic(t.topic)}>
      <View style={styles.rowText}>
        <Text style={[styles.topicName, rtlTextStyle]} numberOfLines={1}>
          {t.nameBidi}
        </Text>
        <Text style={styles.topicCount}>{t.count} سؤالًا</Text>
      </View>
      <ChevronLeft size={18} color={colors.burgundy} />
    </TouchableOpacity>
  );

  const topicsHeader = (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>التصفح حسب المواضيع</Text>
      <Text style={styles.note}>اختر موضوعًا لعرض أسئلته</Text>
    </View>
  );

  const topicsEmpty = loading ? (
    <SkeletonList count={6} render={() => <TopicRowSkeleton />} />
  ) : (
    <EmptyStateCard
      icon={Tags}
      title="لا توجد مواضيع مصنفة بعد"
      message="لم تُصنَّف مواضيع هذه المادة بعد — جرّب الحل التدريبي المباشر من صفحة المادة"
    />
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backGlyph}>›</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, rtlTextStyle]} numberOfLines={1}>
          {bidi(title ?? 'مواضيع المادة')}
        </Text>
        <OfflineBadge />
      </View>

      <FlatList
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        data={topicsBidi}
        keyExtractor={(t) => t.topic}
        renderItem={renderTopic}
        ListHeaderComponent={topicsHeader}
        ListEmptyComponent={topicsEmpty}
        ItemSeparatorComponent={() => <View style={{ height: TOPIC_ROW_GAP }} />}
        getItemLayout={(_, index) => ({
          length: TOPIC_ITEM_LENGTH,
          offset: TOPIC_ITEM_LENGTH * index,
          index,
        })}
        windowSize={7}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        removeClippedSubviews={true}
      />
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
               fontFamily: 'tajawal', fontSize: 22, color: colors.burgundy, fontWeight: '700' },
  headerTitle: {
    fontFamily: 'tajawal',
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
  },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 8 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    ...shadows.card,
  },
  cardTitle: {
    fontFamily: 'tajawal',
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
    marginBottom: 4,
  },
  note: {
          fontFamily: 'tajawal', fontSize: 13, color: colors.textSecondary, },
  emptyNote: {
               fontFamily: 'tajawal', fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: 13,
    paddingHorizontal: 14,
    ...shadows.card,
  },
  // صف الموضوع في FlatList: ارتفاع ثابت يطابق getItemLayout (الفاصل عبر ItemSeparatorComponent)
  topicRow: { height: TOPIC_ROW_HEIGHT },
  rowText: { flex: 1, alignItems: 'flex-end', marginStart: 8 },
  topicName: {
               fontFamily: 'tajawal', fontSize: 14, fontWeight: '700', color: colors.text, },
  topicCount: {
                fontFamily: 'tajawal', fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
