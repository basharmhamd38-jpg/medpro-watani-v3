// حالة شاشة التعريف (Onboarding) — تُعرض مرة واحدة عند أول تشغيل
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'watani_onboarding_done';

export async function isOnboardingDone(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function completeOnboarding(): Promise<void> {
  // إشعار المشتركين أولًا وبشكل متزامن — الزر يستجيب فورًا ولا يعلق
  // أبدًا بانتظار التخزين (لو علق setItem لن يُحجب الانتقال للترحيب)
  notifyOnboarding(true);
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // تجاهل — في أسوأ الحالات ستُعرض الشاشة مجددًا عند التشغيل التالي
  }
}

// اشتراك — يُعلِم RootNavigator عند إتمام التعريف ليبدّل المسار فورًا
type OnboardingListener = (done: boolean) => void;
const listeners = new Set<OnboardingListener>();

export function subscribeOnboarding(listener: OnboardingListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyOnboarding(done: boolean): void {
  for (const listener of listeners) {
    try {
      listener(done);
    } catch {
      // لا يُعطَّل الملاح بسبب مستمع معطوب
    }
  }
}
