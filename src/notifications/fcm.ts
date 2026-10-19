// إشعارات FCM الفورية — «Med pro - وطني»
// - طلب الإذن عند أول تشغيل (صياغة عربية لطيفة)
// - تسجيل توكن الجهاز في fcm_tokens/{uid} + اشتراك تلقائي بموضوع all
// - معالج خلفية (يعمل والتطبيق مغلق) + معالج مقدمة
// ملاحظة: السيرفر (sender.py) يدير اشتراكات المواضيع أيضًا — لا تعارض
import {
  getMessaging,
  requestPermission,
  getToken,
  onTokenRefresh,
  onMessage,
  subscribeToTopic,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE } from '../config';

const PERM_KEY = 'fcm_permission_asked';
const TOKEN_KEY = 'fcm_token';

/** طلب إذن الإشعارات — مرة واحدة بأسلوب عربي لطيف */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const msg = getMessaging();
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'إشعارات Med pro - وطني',
          message:
            'فعّل الإشعارات ليصلك تذكيرك اليومي للدراسة وأخبار الفعاليات أولًا بأول — يمكنك إيقافها متى شئت من الإعدادات.',
          buttonPositive: 'تفعيل الإشعارات',
          buttonNegative: 'ليس الآن',
        },
      );
      await AsyncStorage.setItem(PERM_KEY, '1');
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    const asked = await AsyncStorage.getItem(PERM_KEY);
    if (!asked) {
      const status = await requestPermission(msg);
      await AsyncStorage.setItem(PERM_KEY, '1');
      return (
        status === AuthorizationStatus.AUTHORIZED ||
        status === AuthorizationStatus.PROVISIONAL
      );
    }
    return true;
  } catch {
    return false;
  }
}

/** حفظ توكن الجهاز في Firestore: fcm_tokens/{uid} */
async function saveTokenToFirestore(uid: string, token: string): Promise<void> {
  try {
    if (!FIREBASE.apiKey) return;
    const url =
      `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}` +
      `/databases/${FIREBASE.databaseId}/documents/fcm_tokens/${uid}?key=${FIREBASE.apiKey}`;
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          token: { stringValue: token },
          platform: { stringValue: Platform.OS },
          updatedAt: { timestampValue: new Date().toISOString() },
        },
      }),
    });
  } catch {
    // الفشل هنا لا يكسر التطبيق — ستُعاد المحاولة عند الدخول التالي
  }
}

/** تسجيل الجهاز للإشعارات — يُستدعى عند تسجيل الدخول/التفعيل */
export async function registerDeviceForPush(uid: string): Promise<void> {
  try {
    const msg = getMessaging();
    const ok = await requestNotificationPermission();
    if (!ok) return;
    const token = await getToken(msg);
    if (!token) return;
    const prev = await AsyncStorage.getItem(TOKEN_KEY);
    if (prev !== token) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
      await saveTokenToFirestore(uid, token);
    }
    // اشتراك تلقائي بموضوع all (السيرفر يدير الاشتراكات أيضًا)
    await subscribeToTopic(msg, 'all').catch(() => {});
    // تحديث التوكن عند تجدده
    onTokenRefresh(msg, async (t: string) => {
      await AsyncStorage.setItem(TOKEN_KEY, t);
      await saveTokenToFirestore(uid, t);
      await subscribeToTopic(msg, 'all').catch(() => {});
    });
  } catch {
    // تجاهل هادئ — الإشعارات ميزة إضافية لا توقف التطبيق
  }
}

/** معالج الرسائل في المقدمة */
export function setupForegroundHandler(): void {
  const msg = getMessaging();
  onMessage(msg, async () => {
    // النظام يعرض الإشعار تلقائيًا عند وجود notification payload؛
    // هنا يمكن إضافة toast داخلي لاحقًا إن لزم
  });
}

/** تهيئة FCM عند إقلاع التطبيق */
export async function initFCM(): Promise<void> {
  try {
    await requestNotificationPermission();
    setupForegroundHandler();
  } catch {
    // لا شيء حرج
  }
}
