// الملاحظات الشخصية: كل ملاحظات المستخدم في مكان واحد — تعديل/حذف
import React, { useCallback, useState , useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppModal } from '../../components/AppModal';
import { AppTextInput as TextInput } from '../../components/AppText';
import { AppText as Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Pencil, StickyNote, Trash2, X } from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import EmptyStateCard from '../../components/EmptyStateCard';
import { QuestionSkeleton } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import { formatNumber } from '../../utils/numbers';
import {
  deleteNote,
  getNotes,
  saveNote,
  type NoteItem,
} from '../../notes/store';

export default function NotesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NoteItem[]>([]);
  const [editing, setEditing] = useState<NoteItem | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getNotes());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openEdit = (n: NoteItem) => {
    setEditing(n);
    setDraft(n.note);
  };

  const closeEdit = () => {
    setEditing(null);
    setDraft('');
  };

  const onSave = async () => {
    // حماية من الضغط المزدوج أثناء الحفظ
    if (!editing || saving) return;
    if (!draft.trim()) {
      toast('اكتب ملاحظة أولًا — أو احذفها');
      return;
    }
    setSaving(true);
    try {
      await saveNote(editing.qid, editing.questionText, editing.subjectName, draft);
      toast('تم حفظ الملاحظة');
      closeEdit();
      load();
    } catch {
      toast('تعذّر حفظ الملاحظة — حاول مجددًا');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (n: NoteItem) => {
    Alert.alert('حذف الملاحظة', 'هل تريد حذف هذه الملاحظة نهائيًا؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          await deleteNote(n.qid);
          toast('تم حذف الملاحظة');
          load();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <StickyNote size={20} color={colors.burgundy} strokeWidth={2.2} />
          <Text style={[styles.title, rtlTextStyle]}>
            {`ملاحظاتي (${formatNumber(items.length)})`}
          </Text>
        </View>

        {loading ? (
          <QuestionSkeleton />
        ) : items.length === 0 ? (
          <EmptyStateCard
            icon={StickyNote}
            title="لا توجد ملاحظات"
            message="اضغط على أيقونة الملاحظة في أي سؤال لكتابة ملاحظتك الخاصة"
          />
        ) : (
          items.map((n) => (
            <View key={n.qid} style={[styles.card, shadows.card]}>
              <Text style={[styles.qText, rtlTextStyle]} numberOfLines={2}>
                {bidi(n.questionText)}
              </Text>
              <Text style={[styles.meta, rtlTextStyle]}>{bidi(n.subjectName)}</Text>
              <View style={styles.noteBox}>
                <Text style={[styles.noteText, rtlTextStyle]}>{bidi(n.note)}</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.editBtn]}
                  activeOpacity={0.7}
                  onPress={() => openEdit(n)}>
                  <Pencil size={14} color={colors.burgundy} strokeWidth={2.2} />
                  <Text style={[styles.editText, rtlTextStyle]}>تعديل</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn]}
                  activeOpacity={0.7}
                  onPress={() => onDelete(n)}>
                  <Trash2 size={14} color={colors.rose} strokeWidth={2.2} />
                  <Text style={[styles.deleteText, rtlTextStyle]}>حذف</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* نافذة التعديل */}
      <AppModal visible={editing !== null} onClose={closeEdit} avoidKeyboard>
            <View style={[styles.sheet, shadows.card]}>
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, rtlTextStyle]}>تعديل الملاحظة</Text>
                <TouchableOpacity onPress={closeEdit} activeOpacity={0.7} style={styles.closeBtn}>
                  <X size={20} color={colors.textSecondary} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
              {editing && (
                <Text style={[styles.sheetQ, rtlTextStyle]} numberOfLines={2}>
                  {bidi(editing.questionText)}
                </Text>
              )}
              <TextInput
                style={[styles.textArea, rtlTextStyle]}
                placeholder="اكتب ملاحظتك هنا..."
                placeholderTextColor={colors.textMuted}
                value={draft}
                onChangeText={setDraft}
                multiline
                textAlign="right"
                textAlignVertical="top"
                autoCorrect={false}
              />
              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  activeOpacity={0.8}
                  onPress={onSave}
                  disabled={saving}>
                  <Text style={[styles.saveText, rtlTextStyle]}>
                    {saving ? 'جارٍ الحفظ...' : 'حفظ'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.7} onPress={closeEdit}>
                  <Text style={[styles.cancelText, rtlTextStyle]}>إلغاء</Text>
                </TouchableOpacity>
              </View>
            </View>
      </AppModal>
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
    textAlign: 'right',
    writingDirection: 'rtl',
    includeFontPadding: false,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
  },
  qText: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'right',
    writingDirection: 'rtl',
    includeFontPadding: false,
    lineHeight: 21,
  },
  meta: {
    fontFamily: 'tajawal',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
    writingDirection: 'rtl',
    includeFontPadding: false,
    marginTop: 3,
  },
  noteBox: {
    backgroundColor: colors.explainBg,
    borderWidth: 1,
    borderColor: colors.explainBorder,
    borderRadius: radius.md,
    padding: 10,
    marginTop: 8,
  },
  noteText: {
    fontFamily: 'tajawal',
    fontSize: 13.5,
    color: colors.title,
    textAlign: 'right',
    writingDirection: 'rtl',
    includeFontPadding: false,
    lineHeight: 21,
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  editBtn: { borderColor: colors.borderBurgundy, backgroundColor: colors.optionSelectedBg },
  deleteBtn: { borderColor: colors.errorBorder, backgroundColor: colors.errorBg },
  editText: {
    fontFamily: 'tajawal',
    fontSize: 13,
    fontWeight: '700',
    color: colors.burgundy,
    includeFontPadding: false,
  },
  deleteText: {
    fontFamily: 'tajawal',
    fontSize: 13,
    fontWeight: '700',
    color: colors.rose,
    includeFontPadding: false,
  },
  sheet: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: {
    fontFamily: 'tajawal',
    fontSize: 16,
    fontWeight: '700',
    color: colors.title,
    textAlign: 'right',
    writingDirection: 'rtl',
    includeFontPadding: false,
  },
  closeBtn: { padding: 4 },
  sheetQ: {
    fontFamily: 'tajawal',
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'right',
    writingDirection: 'rtl',
    includeFontPadding: false,
    marginBottom: 10,
    lineHeight: 19,
  },
  textArea: {
    fontFamily: 'tajawal',
    fontSize: 14.5,
    color: colors.title,
    textAlign: 'right',
    writingDirection: 'rtl',
    includeFontPadding: false,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    minHeight: 120,
    lineHeight: 22,
  },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.burgundy,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
    includeFontPadding: false,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.segBg,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    includeFontPadding: false,
  },
});
