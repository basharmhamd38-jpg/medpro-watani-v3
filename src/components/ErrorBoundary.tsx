// حدّ الخطأ العام (W3) — يلتقط أي استثناء عرض ويمنع تجمّد التطبيق.
// واجهة بديلة بالعربية (RTL) مع زر إعادة المحاولة.
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from './AppText';
import { colors } from '../theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // يُسجَّل للتشخيص؛ crashReporting يُهيَّأ في الإقلاع وقد لا يكون جاهزًا بعد
    console.error('[ErrorBoundary] render error:', error, info.componentStack);
  }

  private retry = (): void => {
    this.setState({ hasError: false });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <View style={styles.wrap}>
        <Text style={styles.emoji}>⚠️</Text>
        <Text style={styles.title}>حدث خطأ غير متوقع</Text>
        <Text style={styles.subtitle}>
          عذرًا، تعذّر عرض هذه الشاشة. جرّب إعادة المحاولة — بياناتك محفوظة.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={this.retry}
          accessibilityRole="button"
          activeOpacity={0.8}>
          <Text style={styles.buttonText}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emoji: {
    fontSize: 44,
    marginBottom: 16,
  },
  title: {
    fontFamily: 'tajawal_bold',
    fontSize: 20,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: 'tajawal',
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: 26,
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.burgundy,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 13,
  },
  buttonText: {
    fontFamily: 'tajawal_bold',
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});

export default ErrorBoundary;
