// الجذر: Stack (Welcome → Main) — يستجيب لحالة الدخول لحظيًا عبر الاشتراك
// تسجيل الخروج: الملاح ينتقل تلقائيًا لـWelcome (بلا reset يدوي يغلق التطبيق)
// ملاحظة: جلسة الضيف {type:'guest'} المخزّنة تُعد جلسة صالحة (تفتح Main) —
// "لا جلسة" تعني غياب أي حالة مخزنة فقط (بعد signOut)
import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { storage, subscribeAuth } from '../auth/auth';
import { isOnboardingDone, subscribeOnboarding } from '../onboarding/store';
import type { RootStackParamList } from './types';
import WelcomeScreen from '../screens/welcome/WelcomeScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import DrawerNavigator from './DrawerNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

function hasStoredSession(): boolean {
  return storage.getString('auth_state') != null;
}

export default function RootNavigator() {
  const [hasSession, setHasSession] = useState<boolean>(hasStoredSession);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    // اشتراك: أي setAuth/signOut يُحدّث الملاح فورًا
    const unsubscribe = subscribeAuth(() => {
      setHasSession(hasStoredSession());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    // التعريف يُعرض مرة واحدة عند أول تشغيل
    let cancelled = false;
    // احتياطي: لو علق فحص التخزين لا تبقى الشاشة فارغة للأبد
    const timer = setTimeout(() => {
      setOnboarded(prev => (prev === null ? true : prev));
    }, 3000);
    isOnboardingDone()
      .then(v => {
        if (cancelled) return;
        clearTimeout(timer);
        setOnboarded(v);
      })
      .catch(() => {
        if (cancelled) return;
        clearTimeout(timer);
        setOnboarded(true);
      });
    const unsubscribe = subscribeOnboarding(v => {
      if (!cancelled) setOnboarded(v);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  if (onboarded === null) {
    // جارٍ التحقق — الملاح يُبنى بعد معرفة الحالة
    return null;
  }

  const initialRoute = !onboarded ? 'Onboarding' : hasSession ? 'Main' : 'Welcome';

  return (
    <Stack.Navigator
      // key متغيّر مع الحالة = إعادة تركيب الملاح بالمسار الصحيح عند الدخول/الخروج/إتمام التعريف
      key={`${onboarded}-${hasSession ? 'main' : 'welcome'}`}
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Main" component={DrawerNavigator} />
    </Stack.Navigator>
  );
}
