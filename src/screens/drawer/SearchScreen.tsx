// البحث الشامل: بطاقات + دليل الدراسة (محلي فوري) + مواد البنوك (Firestore)
// مع سجل البحث الأخير وإبراز الكلمات
import React, { useCallback, useEffect, useRef, useState , useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppTextInput as TextInput } from '../../components/AppText';
import { AppText as Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import ListSkeleton from '../../components/ListSkeleton';
import {
  BookOpen,
  Clock,
  Compass,
  Layers,
  Search as SearchIcon,
  Trash2,
  X,
} from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import EmptyStateCard from '../../components/EmptyStateCard';
import { useToast } from '../../components/Toast';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import { formatNumber } from '../../utils/numbers';
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  highlightParts,
  searchLocal,
  searchSubjects,
  type SearchGroup,
  type SearchResult,
} from '../../search/engine';
import type { DrawerParamList } from '../../navigation/types';

const GROUP_ICONS: Record<string, any> = {
  flashcard: Layers,
  guide: Compass,
  subject: BookOpen,
  topic: BookOpen,
};

export default function SearchScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const navigation = useNavigation<DrawerNavigationProp<DrawerParamList>>();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // معرّف متزايد لإبطال نتائج البحث القديمة (سباق الاستعلامات)
  const requestIdRef = useRef(0);

  // تنظيف مؤقت الـdebounce عند إزالة الشاشة
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = null;
    };
  }, []);

  const loadRecent = useCallback(() => {
    getRecentSearches().then(setRecent).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecent();
    }, [loadRecent]),
  );

  const runSearch = useCallback(async (q: string) => {
    const id = ++requestIdRef.current;
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setGroups([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    setSearched(true);
    // بحث محلي فوري
    const local = searchLocal(trimmed);
    if (requestIdRef.current === id) {
      setGroups(local);
    }
    // بحث المواد من Firestore (غير متزامن) — يبقى الهيكل ظاهرًا حتى اكتماله
    try {
      const remote = await searchSubjects(trimmed);
      // نتيجة قديمة لاستعلام تجاوزه المستخدم ← تجاهل (إصلاح سباق الاستعلامات)
      if (requestIdRef.current !== id) return;
      if (remote.length > 0) {
        setGroups((prev) => {
          const merged = [...prev];
          for (const g of remote) {
            const existing = merged.find((x) => x.type === g.type);
            if (existing) existing.results.push(...g.results);
            else merged.push(g);
          }
          return merged;
        });
      }
    } catch {
      // تجاهل
    } finally {
      if (requestIdRef.current === id) setSearching(false);
    }
    addRecentSearch(trimmed).catch(() => {});
    loadRecent();
  }, [loadRecent]);

  const onChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text), 400);
  };

  const onSubmit = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runSearch(query);
  };

  const clearQuery = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    requestIdRef.current++; // إبطال أي بحث جارٍ قبل مسح النتائج
    setQuery('');
    setGroups([]);
    setSearched(false);
    setSearching(false);
  };

  const onResultPress = (r: SearchResult) => {
    if (r.type === 'flashcard' && r.card) {
      // عرض البطاقة موسعة داخل الشاشة
      const key = `${r.title}-${r.meta}`;
      setExpandedCard(expandedCard === key ? null : key);
      return;
    }
    if (r.type === 'guide') {
      navigation.navigate('GuideTab' as never);
      return;
    }
    if (r.type === 'subject' && r.nav?.subjectId) {
      // التنقل لشاشة المادة حسب المصدر
      navigation.navigate('SubjectDetail', {
        subjectId: r.nav.subjectId,
        title: r.nav.subjectName ?? r.title,
        kind: r.nav.source ?? 'watani',
      });
      return;
    }
    toast('لا يوجد إجراء لهذه النتيجة');
  };

  const onClearRecent = async () => {
    await clearRecentSearches();
    setRecent([]);
  };

  const renderHighlighted = (text: string) => (
    <Text style={[styles.resultTitle, rtlTextStyle]}>
      {highlightParts(text, query).map((p, i) => (
        <Text key={i} style={p.highlight ? styles.highlight : undefined}>
          {bidi(p.text)}
        </Text>
      ))}
    </Text>
  );

  const totalResults = groups.reduce((n, g) => n + g.results.length, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <View style={styles.searchBar}>
        <SearchIcon size={20} color={colors.textSecondary} strokeWidth={2.2} />
        <TextInput
          style={[styles.input, rtlTextStyle]}
          placeholder="ابحث في البطاقات، الدليل، المواد..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          textAlign="right"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={clearQuery} activeOpacity={0.7} style={styles.clearBtn}>
            <X size={18} color={colors.textSecondary} strokeWidth={2.2} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* البحث الأخير */}
        {!searched && recent.length > 0 && (
          <View style={[styles.card, shadows.card]}>
            <View style={styles.recentHeader}>
              <Text style={[styles.groupLabel, rtlTextStyle]}>عمليات بحث سابقة</Text>
              <TouchableOpacity onPress={onClearRecent} activeOpacity={0.7}>
                <Trash2 size={16} color={colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <View style={styles.chips}>
              {recent.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={styles.chip}
                  activeOpacity={0.7}
                  onPress={() => {
                    setQuery(r);
                    runSearch(r);
                  }}>
                  <Clock size={13} color={colors.textSecondary} strokeWidth={2} />
                  <Text style={[styles.chipText, rtlTextStyle]} numberOfLines={1}>
                    {bidi(r)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* حالة التحميل — تظهر فقط قبل ظهور أي نتيجة */}
        {searching && totalResults === 0 && <ListSkeleton count={5} />}

        {/* النتائج */}
        {searched && !searching && totalResults === 0 && (
          <EmptyStateCard
            icon={SearchIcon}
            title="لا توجد نتائج"
            message="جرّب كلمات مختلفة — البحث يشمل البطاقات ودليل الدراسة وأسماء المواد"
          />
        )}

        {groups.map((g) => {
          const Icon = GROUP_ICONS[g.type] ?? BookOpen;
          return (
            <View key={g.type} style={styles.group}>
              <View style={styles.groupHeader}>
                <Icon size={17} color={colors.burgundy} strokeWidth={2.2} />
                <Text style={[styles.groupLabel, rtlTextStyle]}>
                  {bidi(`${g.label} (${formatNumber(g.results.length)})`)}
                </Text>
              </View>
              {g.results.map((r, i) => {
                const key = `${g.type}-${i}-${r.title.slice(0, 20)}`;
                const isExpanded = expandedCard === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.card, shadows.card]}
                    activeOpacity={0.75}
                    onPress={() => onResultPress({ ...r })}>
                    {renderHighlighted(r.title)}
                    <Text style={[styles.snippet, rtlTextStyle]} numberOfLines={isExpanded ? 0 : 2}>
                      {bidi(r.snippet)}
                    </Text>
                    {r.type === 'flashcard' && r.card && isExpanded && (
                      <View style={styles.cardBack}>
                        <Text style={[styles.cardBackLabel, rtlTextStyle]}>الإجابة:</Text>
                        <Text style={[styles.cardBackText, rtlTextStyle]}>
                          {bidi(r.card.b)}
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.meta, rtlTextStyle]}>{bidi(r.meta)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        {!searched && recent.length === 0 && (
          <EmptyStateCard
            icon={SearchIcon}
            title="البحث الشامل"
            message="ابحث في 4,658 بطاقة تعليمية، دليل الدراسة، وأسماء مواد بنوك الأسئلة"
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  input: {
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 15,
    color: colors.title,
    textAlign: 'right',
    writingDirection: 'rtl',
    includeFontPadding: false,
  },
  clearBtn: { padding: 4 },
  scroll: { flex: 1 },
  content: { padding: 14, paddingTop: 8, gap: 10 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  group: { gap: 8 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    marginTop: 6,
  },
  groupLabel: {
    fontFamily: 'tajawal',
    fontSize: 15,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'right',
    writingDirection: 'rtl',
    includeFontPadding: false,
  },
  resultTitle: {
    fontFamily: 'tajawal',
    fontSize: 15,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'right',
    writingDirection: 'rtl',
    includeFontPadding: false,
    marginBottom: 4,
  },
  highlight: { backgroundColor: colors.explainBorder, color: colors.title },
  snippet: {
    fontFamily: 'tajawal',
    fontSize: 13.5,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
    includeFontPadding: false,
    lineHeight: 20,
  },
  meta: {
    fontFamily: 'tajawal',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
    writingDirection: 'rtl',
    includeFontPadding: false,
    marginTop: 6,
  },
  cardBack: {
    marginTop: 8,
    padding: 10,
    backgroundColor: colors.successBg,
    borderRadius: radius.md,
  },
  cardBackLabel: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
    textAlign: 'right',
    writingDirection: 'rtl',
    includeFontPadding: false,
  },
  cardBackText: {
    fontFamily: 'tajawal',
    fontSize: 13.5,
    color: colors.title,
    textAlign: 'right',
    writingDirection: 'rtl',
    includeFontPadding: false,
    lineHeight: 20,
    marginTop: 2,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.segBg,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: '100%',
  },
  chipText: {
    fontFamily: 'tajawal',
    fontSize: 13,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
    includeFontPadding: false,
  },
  loadingWrap: { padding: 32, alignItems: 'center' },
});
