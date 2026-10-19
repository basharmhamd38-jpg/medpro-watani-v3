// نافذة النسخ الاحتياطي — تصدير/استيراد/استعادة
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppModal } from './AppModal';
import { AppTextInput as TextInput } from './AppText';
import { AppText as Text } from './AppText';
import {
  Database,
  Download,
  History,
  Upload,
  X,
} from 'lucide-react-native';
import {
  backupToText,
  exportBackup,
  getLatestSnapshotJson,
  getSnapshots,
  importBackup,
  parseBackupText,
  saveSnapshot,
  type BackupSnapshot,
} from '../utils/backup';
import { useTheme, type ThemeColors } from '../theme';
import { bidi } from '../utils/bidi';

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} — ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

export default function BackupModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [busy, setBusy] = useState(false);
  const [snaps, setSnaps] = useState<BackupSnapshot[]>([]);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    if (visible) {
      getSnapshots().then(setSnaps).catch(() => {});
    }
  }, [visible]);

  const doExport = async () => {
    setBusy(true);
    try {
      const backup = await exportBackup();
      const text = backupToText(backup);
      await Share.share({
        message: text,
        title: 'نسخة احتياطية — Med pro وطني',
      });
    } catch {
      /* ألغى المستخدم */
    } finally {
      setBusy(false);
    }
  };

  const doSnapshot = async () => {
    setBusy(true);
    try {
      const snap = await saveSnapshot();
      setSnaps(await getSnapshots());
      Alert.alert('تم', `حُفظت نسخة بتاريخ ${fmtDate(snap.at)}`);
    } catch {
      Alert.alert('خطأ', 'تعذّر حفظ النسخة');
    } finally {
      setBusy(false);
    }
  };

  const doRestoreLatest = async () => {
    Alert.alert(
      'استعادة النسخة؟',
      'سيتم استبدال بياناتك الحالية بالنسخة المحفوظة. هل أنت متأكد؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'استعادة',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const json = await getLatestSnapshotJson();
              if (!json) throw new Error('empty');
              await importBackup(parseBackupText(json));
              Alert.alert('تم', 'استُعيدت النسخة بنجاح — أعد فتح التطبيق');
            } catch {
              Alert.alert('خطأ', 'لا توجد نسخة محفوظة أو أنها تالفة');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const doImport = async () => {
    if (!importText.trim()) {
      Alert.alert('تنبيه', 'الصق نص النسخة الاحتياطية أولًا');
      return;
    }
    Alert.alert(
      'استيراد النسخة؟',
      'سيتم استبدال بياناتك الحالية. هل أنت متأكد؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'استيراد',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await importBackup(parseBackupText(importText));
              setImportText('');
              setShowImport(false);
              Alert.alert('تم', 'استُوردت النسخة بنجاح — أعد فتح التطبيق');
            } catch {
              Alert.alert('خطأ', 'نص النسخة غير صالح');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <AppModal visible={visible} onClose={onClose}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <Database size={18} color={colors.burgundy} />
              <Text style={styles.title}>{'النسخ الاحتياطي'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <X size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>
            <Text style={styles.desc}>
              {'احفظ تقدمك وأوسمتك وملاحظاتك ومفضلتك في نسخة آمنة، واستعدها في أي وقت.'}
            </Text>

            <TouchableOpacity
              style={styles.btn}
              activeOpacity={0.85}
              onPress={doSnapshot}
              disabled={busy}>
              <Download size={18} color={colors.white} />
              <Text style={styles.btnText}>{'حفظ نسخة الآن'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              activeOpacity={0.85}
              onPress={doExport}
              disabled={busy}>
              <Upload size={18} color={colors.burgundy} />
              <Text style={[styles.btnText, styles.btnGhostText]}>
                {'مشاركة النسخة كنص'}
              </Text>
            </TouchableOpacity>

            {snaps.length > 0 && (
              <View style={styles.snapBox}>
                <View style={styles.snapHeader}>
                  <History size={15} color={colors.textMuted} />
                  <Text style={styles.snapTitle}>{'النسخ المحفوظة'}</Text>
                </View>
                {snaps.map((s, i) => (
                  <Text key={i} style={styles.snapItem}>
                    {bidi(`• ${fmtDate(s.at)}`)}
                  </Text>
                ))}
                <TouchableOpacity
                  style={[styles.btn, styles.btnSmall]}
                  onPress={doRestoreLatest}
                  disabled={busy}>
                  <Text style={styles.btnText}>{'استعادة آخر نسخة'}</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.importToggle}
              onPress={() => setShowImport((v) => !v)}>
              <Text style={styles.importToggleText}>
                {showImport ? 'إخفاء الاستيراد' : 'استيراد من نص'}
              </Text>
            </TouchableOpacity>
            {showImport && (
              <View>
                <TextInput
                  style={styles.input}
                  multiline
                  numberOfLines={4}
                  placeholder="الصق نص النسخة الاحتياطية هنا…"
                  placeholderTextColor={colors.textMuted}
                  value={importText}
                  onChangeText={setImportText}
                  textAlign="right"
                />
                <TouchableOpacity
                  style={[styles.btn, styles.btnSmall]}
                  onPress={doImport}
                  disabled={busy}>
                  <Text style={styles.btnText}>{'استيراد'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {busy && <ActivityIndicator style={{ marginTop: 12 }} color={colors.burgundy} />}
          </ScrollView>
        </View>
    </AppModal>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sheet: {
      backgroundColor: colors.bg,
      borderRadius: 24,
      width: '100%',
      maxWidth: 420,
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 18,
      paddingBottom: 8,
    },
    headerTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
    },
    body: {
      padding: 18,
      paddingTop: 4,
    },
    desc: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 20,
      marginBottom: 14,
    },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.burgundy,
      borderRadius: 14,
      paddingVertical: 13,
      marginBottom: 10,
    },
    btnGhost: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.burgundy,
    },
    btnGhostText: {
      color: colors.burgundy,
    },
    btnText: {
      color: colors.white,
      fontSize: 15,
      fontWeight: '700',
    },
    btnSmall: {
      paddingVertical: 10,
      marginTop: 8,
      marginBottom: 0,
    },
    snapBox: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 12,
      marginTop: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    snapHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    snapTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    snapItem: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 2,
    },
    importToggle: {
      marginTop: 12,
      alignItems: 'center',
      paddingVertical: 8,
    },
    importToggleText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.burgundy,
    },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      fontSize: 12,
      color: colors.text,
      minHeight: 90,
      textAlignVertical: 'top',
      marginBottom: 4,
    },
  });
