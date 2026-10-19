// AppModal — النافذة المنبثقة الموحدة لكل التطبيق (W15)
// تستبدل ~7 نوافذ ad-hoc مكررة (ConfirmDialog/BackupModal/ShareBadgeModal/
// BadgeCelebration/ExamCountdownCard/QuizRunner/NotesScreen) بغلاف واحد:
// Modal شفاف + حجاب scrim من الثيم + توسيط. محتوى البطاقة يبقى عند المستدعي.
import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '../theme';

export function AppModal({
  visible,
  onClose,
  children,
  avoidKeyboard = false,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** للنوافذ التي تحتوي حقول إدخال — يرفع المحتوى فوق لوحة المفاتيح */
  avoidKeyboard?: boolean;
}) {
  const { colors } = useTheme();
  const body = (
    <View style={[styles.backdrop, { backgroundColor: colors.scrim }]}>
      {children}
    </View>
  );
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}>
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  kav: { flex: 1 },
});

export default AppModal;
