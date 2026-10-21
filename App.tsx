/**
 * Med pro - وطني — نقطة الدخول
 * RTL مفروض قبل التسجيل، تهيئة قاعدة البيانات والبذور عند الإقلاع.
 */
import { I18nManager, StyleSheet, View } from 'react-native';

// يُفرض RTL قبل أي تسجيل/عرض — يُنفَّذ عند استيراد الوحدة (قبل registerComponent)
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

// ملاحظة: محاذاة RTL الافتراضية لكل النصوص تتم عبر مكوّن `AppText`
// (src/components/AppText.tsx) — كل ملف يستورد `Text` منه.
// (لا تستخدم Text.defaultProps — React 19 أزال دعمه نهائيًا فيُتجاهل بصمت)

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { ToastProvider } from './src/components/Toast';
import { RootNavigator } from './src/navigation';
import { initDatabase, ensureDatabaseKey } from './src/db/database';
import { initAuthStorage } from './src/auth/auth';
import { verifyDeviceBinding } from './src/activation/codes';
import { refreshPaymentMode } from './src/payment/paymentMode';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { evaluateSmartNotifications } from './src/notifications/smart';
import { BadgeCelebrationHost } from './src/components/BadgeCelebration';
import SplashScreen from './src/screens/SplashScreen';
import { selfTestSecureCache } from './src/content/secureCache';
import { ThemeProvider, useTheme } from './src/theme';

const MIN_SPLASH_MS = 2600; // مدة دنيا لظهور الشاشة الافتتاحية المتحركة — الحركة ~1.25ث ثم استقرار مريح للشعار والسلوغن (كانت 1600 فتومض)

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />;
}

// ثيم التنقل — يمنع الوميض الأبيض عند الإقلاع/التنقل في الوضع الليلي
// لا بوابة تحميل هنا أبدًا (أمر الدكتور 21 أكتوبر 2026): بعد الافتتاحية
// يفتح التطبيق على واجهته مباشرة — المحتوى يُحمَّل من أزرار الأقسام فقط.
function ThemedNavigator({ ready }: { ready: boolean }) {
  const { isDark, colors } = useTheme();
  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: colors.bg,
      card: colors.card,
      border: colors.border,
      text: colors.text,
      primary: colors.burgundy,
    },
  };
  return (
    <NavigationContainer theme={navTheme}>
      {ready ? (
        <ErrorBoundary>
          <RootNavigator />
        </ErrorBoundary>
      ) : (
        <SplashScreen />
      )}
    </NavigationContainer>
  );
}

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const bootStart = Date.now();
    (async () => {
      try {
        // مفتاح تشفير القاعدة (مشتق لكل جهاز) قبل فتحها — ترقية تلقائية للقديم
        await ensureDatabaseKey();
        await initDatabase();
        // لا فحص جاهزية/تحميل محتوى عند الإقلاع إطلاقًا — الدخول مباشر دائمًا،
        // والمحتوى يصل فقط من أزرار تحميل الأقسام داخل بنك الأسئلة.
        // ملاحظة: seedBundledData أُزيلت — البيانات المدمجة القديمة (kind='watani')
        // لم تعد تُقرأ من أي شاشة بعد الترحيل لـbankRead.
        await initAuthStorage();
        // فحص ربط كود التفعيل بالجهاز — صامت ولا يعطل الإقلاع أبدًا:
        // بلا إنترنت يُبقي التفعيل المحلي، وربطٌ لجهاز آخر يُلغي التفعيل
        // محليًا فيُعاد توجيه المستخدم لطلب كود جديد.
        verifyDeviceBinding().catch(() => {});
        // وضع الدفع من الإدارة (app_config/payment) — يُنتظر فعليًا قبل أول عرض
        // حتى لا تُبنى الأقفال على القيمة الافتراضية طوال الجلسة (W2).
        // مهلة أمان 5 ثوانٍ حتى لا يعلَق الإقلاع عند شبكة معطوبة.
        await Promise.race([
          refreshPaymentMode().catch(() => {}),
          new Promise(resolve => setTimeout(() => resolve(undefined), 5000)),
        ]);
        // الإشعارات الذكية المحلية — تقييم المراجعات والسلسلة والملخص الأسبوعي
        evaluateSmartNotifications().catch(() => {});
        // فحص ذاتي لطبقة التخزين المشفّر — يسجّل النتيجة فقط ولا يعطل الإقلاع عند الفشل
        selfTestSecureCache()
          .then((ok) => console.log('[boot] selfTestSecureCache:', ok ? 'OK' : 'FAILED'))
          .catch(() => {});
        // ملاحظة: FLAG_SECURE يُفعّل لكل شاشة أسئلة/محتوى على حدة (Question/FlashcardsViewer)
      } catch {
        // التطبيق يقلع بالحد الأدنى حتى لو فشلت التهيئة
      } finally {
        // ضمان مدة دنيا للشاشة الافتتاحية المتحركة حتى تُرى الحركة كاملة
        const elapsed = Date.now() - bootStart;
        const wait = Math.max(0, MIN_SPLASH_MS - elapsed);
        setTimeout(() => {
          // دخول مباشر دائمًا — بلا أي بوابة أو تنزيل محتوى عند الإقلاع
          setReady(true);
        }, wait);
      }
    })();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <ThemedStatusBar />
            <ThemedNavigator ready={ready} />
            <BadgeCelebrationHost />
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default App;
