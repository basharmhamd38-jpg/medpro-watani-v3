import { View, StyleSheet } from 'react-native';
import AppButton from '../../components/AppButton';
import { useMemo } from 'react';
import LockScreen from '../../components/LockScreen';
import { useTheme, type ThemeColors } from '../../theme';

// شاشة قفل موحدة: مكوّن LockScreen + زر شبحي للرجوع (حسب المواصفة 6.2 و6.3)
type Props = {
  title: string;
  message: string;
  backLabel: string;
  onBack: () => void;
};

export default function LockView({ title, message, backLabel, onBack }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.root}>
      <LockScreen message={`${title} — ${message}`} />
      <AppButton
        title={`› ${backLabel}`}
        onPress={onBack}
        variant="ghost"
        style={{ alignSelf: 'center', marginTop: 20, paddingHorizontal: 28 }}
      />
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
});
