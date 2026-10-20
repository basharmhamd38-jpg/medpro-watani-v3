// المفضلة: الأسئلة المحفوظة للمراجعة — منظمة حسب المادة
import React, { useCallback, useState , useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronDown, Heart, Trash2 } from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import EmptyStateCard from '../../components/EmptyStateCard';
import { QuestionSkeleton } from '../../components/Skeleton';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import { formatNumber } from '../../utils/numbers';
import {
  getFavorites,
  groupBySubject,
  removeFavorite,
  type FavoriteItem,
} from '../../favorites/store';
import { getNote } from '../../notes/store';

const AR_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'];

export default function FavoritesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<{ subject: string; items: FavoriteItem[] }[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getFavorites();
      setGroups(groupBySubject(items));
      // تحميل الملاحظات المرتبطة — متوازيًا بدل التسلسل
      const notesArr = await Promise.all(
        items.map((f) => getNote(f.qid).catch(() => null)),
      );
      const map: Record<string, string> = {};
      notesArr.forEach((n, i) => {
        if (n) map[items[i].qid] = n.note;
      });
      setNotes(map);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRemove = (item: FavoriteItem) => {
    Alert.alert('إزالة من المفضلة', 'هل تريد إزالة هذا السؤال من المفضلة؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'إزالة',
        style: 'destructive',
        onPress: async () => {
          await removeFavorite(item.qid);
          load();
        },
      },
    ]);
  };

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Heart size={20} color={colors.burgundy} strokeWidth={2.2} fill={colors.burgundy} />
          <Text style={[styles.title, rtlTextStyle]}>
            {`المفضلة (${formatNumber(total)})`}
          </Text>
        </View>

        {loading ? (
          <QuestionSkeleton />
        ) : total === 0 ? (
          <EmptyStateCard
            icon={Heart}
            title="لا توجد أسئلة محفوظة"
            message="اضغط على أيقونة القلب في أي سؤال لحفظه هنا للمراجعة اللاحقة"
          />
        ) : (
          groups.map((g) => (
            <View key={g.subject} style={styles.group}>
              <Text style={[styles.groupLabel, rtlTextStyle]}>
                {`${g.subject} (${formatNumber(g.items.length)})`}
              </Text>
              {g.items.map((f) => {
                const isOpen = expanded === f.qid;
                return (
                  <View key={f.qid} style={[styles.card, shadows.card]}>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => setExpanded(isOpen ? null : f.qid)}>
                      <View style={styles.qHeader}>
                        <Text style={[styles.qText, rtlTextStyle]} numberOfLines={isOpen ? 0 : 2}>
                          {bidi(f.text)}
                        </Text>
                        <ChevronDown
                          size={18}
                          color={colors.textSecondary}
                          strokeWidth={2.2}
                          style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                        />
                      </View>
                      <Text style={[styles.meta, rtlTextStyle]}>{bidi(f.source)}</Text>
                    </TouchableOpacity>

                    {isOpen && (
                      <View style={styles.detail}>
                        {f.options.map((opt, i) => {
                          const isCorrect = i === f.correctIndex;
                          return (
                            <View
                              key={i}
                              style={[
                                styles.option,
                                isCorrect && styles.optionCorrect,
                              ]}>
                              <Text
                                style={[
                                  styles.optText,
                                  rtlTextStyle,
                                  isCorrect && styles.optTextCorrect,
                                ]}>
                                {bidi(`${AR_LETTERS[i] ?? ''} — ${opt.text}`)}
                              </Text>
                            </View>
                          );
                        })}
                        {f.explanation ? (
                          <View style={styles.explain}>
                            <Text style={[styles.explainTitle, rtlTextStyle]}>الشرح:</Text>
                            <Text style={[styles.explainText, rtlTextStyle]}>
                              {bidi(f.explanation)}
                            </Text>
                          </View>
                        ) : null}
                        {notes[f.qid] ? (
                          <View style={styles.noteBox}>
                            <Text style={[styles.noteLabel, rtlTextStyle]}>ملاحظتي:</Text>
                            <Text style={[styles.noteText, rtlTextStyle]}>
                              {bidi(notes[f.qid])}
                            </Text>
                          </View>
                        ) : null}
                        <TouchableOpacity
                          style={styles.removeBtn}
                          activeOpacity={0.7}
                          onPress={() => onRemove(f)}>
                          <Trash2 size={15} color={colors.rose} strokeWidth={2.2} />
                          <Text style={[styles.removeText, rtlTextStyle]}>إزالة من المفضلة</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 14, gap: 12 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  title: {
    fontFamily: 'tajawal',
    fontSize: 19,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'left',
    writingDirection: 'ltr',
    includeFontPadding: false,
  },
  group: { gap: 8 },
  groupLabel: {
    fontFamily: 'tajawal',
    fontSize: 15,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'left',
    writingDirection: 'ltr',
    includeFontPadding: false,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
  },
  qHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  qText: {
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'left',
    writingDirection: 'ltr',
    includeFontPadding: false,
    lineHeight: 22,
  },
  meta: {
    fontFamily: 'tajawal',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'left',
    writingDirection: 'ltr',
    includeFontPadding: false,
    marginTop: 4,
  },
  detail: { marginTop: 10, gap: 6 },
  option: {
    backgroundColor: colors.optionBg,
    borderWidth: 1,
    borderColor: colors.optionBorder,
    borderRadius: radius.md,
    padding: 10,
  },
  optionCorrect: { backgroundColor: colors.successBg, borderColor: colors.success },
  optText: {
    fontFamily: 'tajawal',
    fontSize: 13.5,
    color: colors.text,
    textAlign: 'left',
    writingDirection: 'ltr',
    includeFontPadding: false,
    lineHeight: 20,
  },
  optTextCorrect: { color: colors.success, fontWeight: '700' },
  explain: {
    backgroundColor: colors.accordionBg,
    borderRadius: radius.md,
    padding: 10,
  },
  explainTitle: {
    fontFamily: 'tajawal',
    fontSize: 13,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'left',
    writingDirection: 'ltr',
    includeFontPadding: false,
  },
  explainText: {
    fontFamily: 'tajawal',
    fontSize: 13,
    color: colors.text,
    textAlign: 'left',
    writingDirection: 'ltr',
    includeFontPadding: false,
    lineHeight: 20,
    marginTop: 2,
  },
  noteBox: {
    backgroundColor: colors.explainBg,
    borderWidth: 1,
    borderColor: colors.explainBorder,
    borderRadius: radius.md,
    padding: 10,
  },
  noteLabel: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.amberText,
    textAlign: 'left',
    writingDirection: 'ltr',
    includeFontPadding: false,
  },
  noteText: {
    fontFamily: 'tajawal',
    fontSize: 13,
    color: colors.title,
    textAlign: 'left',
    writingDirection: 'ltr',
    includeFontPadding: false,
    lineHeight: 20,
    marginTop: 2,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  removeText: {
    fontFamily: 'tajawal',
    fontSize: 13,
    fontWeight: '700',
    color: colors.rose,
    textAlign: 'left',
    writingDirection: 'ltr',
    includeFontPadding: false,
  },
});
