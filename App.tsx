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

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import FirstLaunchDownloadScreen from './src/screens/FirstLaunchDownloadScreen';
import { isOfflineReady, backgroundSync } from './src/sync/offlineSync';
import { selfTestSecureCache } from './src/content/secureCache';
import { ThemeProvider, useTheme } from './src/theme';

const MIN_SPLASH_MS = 1600; // مدة دنيا لظهور الشاشة الافتتاحية المتحركة

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />;
}

// ثيم التنقل — يمنع الوميض الأبيض عند الإقلاع/التنقل في الوضع الليلي
function ThemedNavigator({
  ready,
  needsDownload,
  onDone,
}: {
  ready: boolean;
  needsDownload: boolean;
  onDone: () => void;
}) {
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
      {needsDownload && !ready ? (
        <FirstLaunchDownloadScreen onDone={onDone} />
      ) : ready ? (
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
  const [needsDownload, setNeedsDownload] = useState(false);
  // مرجع متزامن — يُقرأ داخل setTimeout بعد اكتمال الإقلاع
  const needsDownloadRef = useRef(false);

  // تُستدعى من شاشة التحميل عند اكتمالها: إعادة فحص الجاهزية ثم الدخول
  const handleDownloadDone = useCallback(() => {
    isOfflineReady()
      .then(ok => {
        setNeedsDownload(!ok);
        setReady(true);
      })
      .catch(() => {
        // تعذّر الفحص — الدخول على أي حال (التحميل اكتمل من الشاشة)
        setNeedsDownload(false);
        setReady(true);
      });
    // مزامنة خلفية لمرة واحدة — صامتة ولا تعلق الواجهة
    backgroundSync().catch(() => {});
  }, []);

  useEffect(() => {
    const bootStart = Date.now();
    (async () => {
      try {
        // مفتاح تشفير القاعدة (مشتق لكل جهاز) قبل فتحها — ترقية تلقائية للقديم
        await ensureDatabaseKey();
        await initDatabase();
        // فحص جاهزية الأوفلاين قبل عرض الملاح: التحميل الكامل عند أول تشغيل فقط
        try {
          const offline = await isOfflineReady();
          needsDownloadRef.current = !offline;
          setNeedsDownload(!offline);
        } catch {
          /* فشل الفحص — يُكمل التطبيق بالحد الأدنى */
        }
        // ملاحظة: seedBundledData أُزيلت — البيانات المدمجة القديمة (kind='watani')
        // لم تعد تُقرأ من أي شاشة بعد الترحيل لـbankRead؛ التحميل الأول هو المصدر الوحيد.
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
          if (needsDownloadRef.current) return; // شاشة التحميل تتولى الدخول عبر onDone
          setReady(true);
          // مزامنة خلفية لمرة واحدة بعد اكتمال الإقلاع — صامتة ولا تعلق الواجهة
          backgroundSync().catch(() => {});
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
            <ThemedNavigator
              ready={ready}
              needsDownload={needsDownload}
              onDone={handleDownloadDone}
            />
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
