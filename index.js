/**
 * @format
 */

import { AppRegistry, I18nManager } from 'react-native';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// LTR تشخيصي — التطبيق باتجاه يسار-ل-يمين لاختبار فرضية أن RTL يسبب مشاكل التنسيق/التعليق
// يجب أن يُستدعى قبل أي عرض
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

// معالج الإشعارات في الخلفية — يعمل والتطبيق مغلق تمامًا
// يجب تسجيله في المستوى الأعلى قبل أي مكون
setBackgroundMessageHandler(getMessaging(), async (_remoteMessage) => {
  // النظام يعرض الإشعارات ذات notification payload تلقائيًا؛
  // هنا نعالج البيانات الصامتة (data-only) إن وجدت
});

AppRegistry.registerComponent(appName, () => App);
