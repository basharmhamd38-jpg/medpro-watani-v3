// إعدادات التطبيق — «Med pro - وطني»
export const APP = {
  packageName: 'sy.medpro.watani',
  versionName: '1.0',
  versionCode: 1,
  adminEmail: 'drbasharmohammad@gmail.com',
  telegramBot: '@medpro_watani_bot',
  telegramBotUrl: 'https://t.me/medpro_watani_bot',
  maxDevices: 2,
} as const;

// Firebase — المشروع national-exam-8ecba (الماستر للمزامنة)
// مفتاح Web API مملوء من إعدادات مشروع الويب (firebase-applet-config.json)
// بدونه تعمل المزامنة بوضع «غير متاحة» ويبقى التطبيق أوفلاين كاملًا.
export const FIREBASE = {
  projectId: 'national-exam-8ecba',
  // قاعدة البيانات المسماة التي تحوي كل البيانات الحية (بنوك الأسئلة + الكورسات)
  // مطابقة للموقع الحي medpro-watani-web (TARGET_DATABASE_ID)
  databaseId: 'ai-studio-nationalexamapp-330e566e-ddc6-4e62-86a9-8009ee9cde64',
  apiKey: 'AIzaSyDfap1QHyML4wBtOoUa_hdikJqMGl7N2xQ',
  authDomain: 'national-exam-8ecba.firebaseapp.com',
} as const;

// Google Sign-In — عميل الويب (OAuth) مطابق لـ google-services.json
// يُستخدم في WelcomeScreen (الدخول) و auth.ts (الخروج من حساب Google)
export const GOOGLE = {
  webClientId:
    '660952704333-8cdodgfk7prfj3sv70725fu6oq9h0mjr.apps.googleusercontent.com',
} as const;

// نموذج الدفع المعتمد
export const PAYMENT = {
  // آخر دورتين من كل قسم وطني مجانيتان ومفتوحتان
  freeSessionsPerSection: 2,
  mode: 'paid' as 'paid' | 'free', // يُقرأ من Firestore لاحقًا (app_config/payment)
} as const;
