// البطاقات التعليمية — مرجعية AI Studio (FlashCardsSection.tsx)
// بطاقات محلية مدمجة (لا تعتمد على Firestore): البطاقات الأساسية + بطاقات المراجعة
// التدفق: تبويب (أساسية/مراجعة) ← مادة ← محور ← بطاقة (قلب بالنقر) ← تنقل
import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { Brain, Layers, RotateCcw, Sparkles, CalendarClock } from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import { formatNumber } from '../../utils/numbers';
import { gradeItem, getDueCount } from '../../study/spacedRepetition';
import { useFocusEffect } from '@react-navigation/native';
import {
  FLASHCARDS,
  type FlashCard,
  type FlashSubject,
} from '../../data/flashcards-data';
import {
  REVIEW_CARDS,
  type ReviewSubject,
} from '../../data/review-cards-data';
import { recordActivity } from '../../gamification/profile';

type DatasetTab = 'main' | 'review';

// توحيد النوعين (متطابقان بنيويًا)
type AnySubject = FlashSubject | ReviewSubject;

function countCards(dataset: AnySubject[]): number {
  let n = 0;
  for (const s of dataset)
    for (const t of s.topics) n += t.cards.length;
  return n;
}

const MAIN_COUNT = countCards(FLASHCARDS);
const REVIEW_COUNT = countCards(REVIEW_CARDS);

export default function FlashCardsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [tab, setTab] = useState<DatasetTab>('main');
  const [subjectIdx, setSubjectIdx] = useState(0);
  const [topicIdx, setTopicIdx] = useState(0);
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  // البطاقات المحسوبة في هذه الجلسة (لتفادي التكرار)
  const countedRef = useRef<Set<string>>(new Set());
  // عدد البطاقات المستحقة للمراجعة اليوم (SM-2)
  const [dueCount, setDueCount] = useState(0);

  const refreshDue = useCallback(() => {
    getDueCount().then(setDueCount).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshDue();
    }, [refreshDue]),
  );

  const dataset: AnySubject[] = tab === 'main' ? FLASHCARDS : REVIEW_CARDS;
  const subject = dataset[subjectIdx] ?? dataset[0];
  const topic = subject?.topics[topicIdx] ?? subject?.topics[0];
  const cards: FlashCard[] = useMemo(
    () => (topic?.cards ?? []) as FlashCard[],
    [topic],
  );
  const card: FlashCard = cards[cardIdx] ?? {
    f: 'لا توجد بطاقات',
    b: 'يرجى اختيار مادة ومحور آخر.',
  };

  const resetCard = () => {
    setCardIdx(0);
    setFlipped(false);
  };

  // قلب البطاقة + تسجيل المراجعة في النظام المركزي (مرة واحدة لكل بطاقة)
  // W23: الآثار الجانبية خارج الـupdater — يُقرأ flipped مباشرة من الحالة
  const flipCard = () => {
    if (!flipped) {
      // كان مغلقًا → سيُفتح الآن (رأى الإجابة)
      const key = `${tab}-${subjectIdx}-${topicIdx}-${cardIdx}`;
      if (!countedRef.current.has(key)) {
        countedRef.current.add(key);
        recordActivity('flashcard', 1, { flashcardsReviewed: 1 }, {
          subjectId: `flashcard_${subject?.s || subjectIdx}`,
        }).catch(() => {});
      }
    }
    setFlipped(!flipped);
  };

  const changeTab = (t: DatasetTab) => {
    setTab(t);
    setSubjectIdx(0);
    setTopicIdx(0);
    resetCard();
  };

  const selectSubject = (i: number) => {
    setSubjectIdx(i);
    setTopicIdx(0);
    resetCard();
  };

  const selectTopic = (i: number) => {
    setTopicIdx(i);
    resetCard();
  };

  const prevCard = () => {
    setFlipped(false);
    setCardIdx((p) => (p > 0 ? p - 1 : cards.length - 1));
  };

  const nextCard = () => {
    setFlipped(false);
    setCardIdx((p) => (p < cards.length - 1 ? p + 1 : 0));
  };

  // تقييم SM-2 للبطاقة الحالية ثم الانتقال للتالية
  const gradeCurrent = (quality: number) => {
    const key = `fc-${tab}-${subjectIdx}-${topicIdx}-${cardIdx}`;
    gradeItem(key, quality)
      .then(() => refreshDue())
      .catch(() => {});
    nextCard();
  };

  const GRADE_BUTTONS = [
    { q: 1, label: 'نسيت', bg: colors.error },
    { q: 2, label: 'صعب', bg: '#F59E0B' },
    { q: 4, label: 'جيد', bg: colors.emerald },
    { q: 5, label: 'سهل', bg: colors.burgundy },
  ] as const;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      {/* الترويسة */}
      <View style={[styles.headerCard, shadows.card]}>
        {/* شارة المراجعة الذكية SM-2 */}
        {dueCount > 0 && (
          <View style={styles.dueBanner}>
            <CalendarClock size={15} color={colors.white} />
            <Text style={[styles.dueBannerText, rtlTextStyle]}>
              {`${formatNumber(dueCount)} بطاقة مستحقة للمراجعة اليوم (تكرار متباعد)`}
            </Text>
          </View>
        )}
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <Brain size={22} color={colors.burgundyLight} />
            <Text style={[styles.title, rtlTextStyle]}>
              {'بنك البطاقات السريرية الشامل'}
            </Text>
          </View>
          <View style={styles.subjectBadge}>
            <Text style={[styles.subjectBadgeText, rtlTextStyle]}>
              {bidi(subject?.s ?? '')}
            </Text>
          </View>
        </View>
        <Text style={[styles.hint, rtlTextStyle]}>
          {'انقر على البطاقة لقلبها ومعرفة الإجابة التشخيصية السريرية والتفريقية الدقيقة.'}
        </Text>

        {/* تبويبا الأساسية / المراجعة */}
        <View style={styles.datasetTabs}>
          <TouchableOpacity
            style={[styles.datasetBtn, tab === 'main' && styles.datasetBtnActive]}
            activeOpacity={0.7}
            onPress={() => changeTab('main')}>
            <Sparkles
              size={14}
              color={tab === 'main' ? colors.gold : colors.textSecondary}
            />
            <Text
              style={[
                styles.datasetText,
                tab === 'main' && styles.datasetTextActive,
                rtlTextStyle,
              ]}>
              {`البطاقات الأساسية (${formatNumber(MAIN_COUNT)} بطاقة)`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.datasetBtn, tab === 'review' && styles.datasetBtnActive]}
            activeOpacity={0.7}
            onPress={() => changeTab('review')}>
            <Layers
              size={14}
              color={tab === 'review' ? colors.gold : colors.textSecondary}
            />
            <Text
              style={[
                styles.datasetText,
                tab === 'review' && styles.datasetTextActive,
                rtlTextStyle,
              ]}>
              {`بطاقات المراجعة (${formatNumber(REVIEW_COUNT)} بطاقة)`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* المواد */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          // RTL: اعكس اتجاه التمرير ليبدأ من اليمين
          style={styles.chipScroller}>
          {dataset.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.subjectChip, subjectIdx === i && styles.subjectChipActive]}
              activeOpacity={0.7}
              onPress={() => selectSubject(i)}>
              <Text
                style={[
                  styles.subjectChipText,
                  subjectIdx === i && styles.subjectChipTextActive,
                  rtlTextStyle,
                ]}>
                {bidi(s.s)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* المحاور */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={[styles.chipScroller, styles.topicScroller]}>
          {(subject?.topics ?? []).map((t, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.topicChip, topicIdx === i && styles.topicChipActive]}
              activeOpacity={0.7}
              onPress={() => selectTopic(i)}>
              <Text
                style={[
                  styles.topicChipText,
                  topicIdx === i && styles.topicChipTextActive,
                  rtlTextStyle,
                ]}>
                {bidi(`${t.t} (${t.cards.length})`)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* البطاقة */}
      <TouchableOpacity
        style={[styles.card, shadows.card]}
        activeOpacity={0.85}
        onPress={flipCard}>
        <View style={styles.cardBadge}>
          <Text style={[styles.cardBadgeText, rtlTextStyle]}>
            {bidi(
              `بطاقة ${cardIdx + 1} من ${cards.length} ${flipped ? '— (الإجابة 💡)' : '— (السؤال ❓)'}`,
            )}
          </Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardText, rtlTextStyle]}>
            {bidi(flipped ? card.b : card.f)}
          </Text>
        </View>
        <View style={styles.flipHint}>
          <RotateCcw size={14} color={colors.burgundyLight} />
          <Text style={[styles.flipHintText, rtlTextStyle]}>
            {'انقر في أي مكان لقلب البطاقة'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* أزرار تقييم SM-2 — تظهر بعد قلب البطاقة */}
      {flipped && (
        <View style={styles.gradeWrap}>
          <Text style={[styles.gradeTitle, rtlTextStyle]}>
            {'كيف كانت سهولة التذكر؟ (للجدولة الذكية)'}
          </Text>
          <View style={styles.gradeRow}>
            {GRADE_BUTTONS.map((g) => (
              <TouchableOpacity
                key={g.q}
                style={[styles.gradeBtn, { backgroundColor: g.bg }]}
                activeOpacity={0.7}
                onPress={() => gradeCurrent(g.q)}>
                <Text style={[styles.gradeBtnText, rtlTextStyle]}>
                  {bidi(g.label)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* التنقل */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.prevBtn}
          activeOpacity={0.7}
          onPress={prevCard}>
          <Text style={[styles.prevBtnText, rtlTextStyle]}>{'› السابق'}</Text>
        </TouchableOpacity>
        <Text style={[styles.counter, rtlTextStyle]}>
          {`${formatNumber(cardIdx + 1)} / ${formatNumber(cards.length)}`}
        </Text>
        <TouchableOpacity
          style={styles.nextBtn}
          activeOpacity={0.7}
          onPress={nextCard}>
          <Text style={[styles.nextBtnText, rtlTextStyle]}>{'التالي ‹'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  title: {
    fontFamily: 'tajawal',
    fontSize: 17,
    fontWeight: '700',
    color: colors.burgundy,
    flexShrink: 1,
  },
  subjectBadge: {
    backgroundColor: colors.burgundy + '1A',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  subjectBadgeText: {
    fontFamily: 'tajawal',
    fontSize: 11,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'center',
  },
  hint: {
    fontFamily: 'tajawal',
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  datasetTabs: {
    flexDirection: 'row',
    backgroundColor: colors.accordionBg,
    borderRadius: radius.md,
    padding: 4,
    gap: 6,
  },
  datasetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  datasetBtnActive: { backgroundColor: colors.burgundy },
  datasetText: {
    fontFamily: 'tajawal',
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  datasetTextActive: { color: colors.white },
  chipScroller: { marginHorizontal: -4 },
  chipRow: { gap: 8, paddingHorizontal: 4, flexDirection: 'row' },
  topicScroller: {
    borderTopWidth: 1,
    borderTopColor: colors.borderBurgundy,
    paddingTop: 10,
  },
  subjectChip: {
    backgroundColor: colors.accordionBg,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  subjectChipActive: { backgroundColor: colors.burgundy },
  subjectChipText: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'center',
  },
  subjectChipTextActive: { color: colors.white },
  topicChip: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  topicChipActive: { backgroundColor: colors.burgundyLight, borderColor: colors.burgundyLight },
  topicChipText: {
    fontFamily: 'tajawal',
    fontSize: 11,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'center',
  },
  topicChipTextActive: { color: colors.white },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.borderBurgundy,
    minHeight: 260,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadge: {
    position: 'absolute',
    top: 14,
    end: 14,
    backgroundColor: colors.burgundy + '1A',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  cardBadgeText: {
    fontFamily: 'tajawal',
    fontSize: 10,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'center',
  },
  cardBody: { flex: 1, justifyContent: 'center', paddingTop: 16 },
  cardText: {
    fontFamily: 'tajawal',
    fontSize: 17,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'center',
    lineHeight: 28,
  },
  flipHint: {
    position: 'absolute',
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flipHintText: {
    fontFamily: 'tajawal',
    fontSize: 11,
    fontWeight: '700',
    color: colors.burgundyLight,
    textAlign: 'center',
  },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // شارة المراجعة الذكية SM-2
  dueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.burgundy,
    borderRadius: radius.md,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  dueBannerText: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
  // أزرار تقييم SM-2
  gradeWrap: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    padding: 12,
    gap: 10,
  },
  gradeTitle: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  gradeRow: { flexDirection: 'row', gap: 8 },
  gradeBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  gradeBtnText: {
    fontFamily: 'tajawal',
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  prevBtn: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  prevBtnText: {
    fontFamily: 'tajawal',
    fontSize: 13,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'center',
  },
  counter: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  nextBtn: {
    flex: 1,
    backgroundColor: colors.burgundy,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  nextBtnText: {
    fontFamily: 'tajawal',
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
  },
});
