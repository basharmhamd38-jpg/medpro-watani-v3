// هوية «Med pro - وطني» — الألوان الدقيقة من الموك المعتمد
export const colors = {
  burgundy: '#7A1F2B',      // عنابي أساسي داكن
  burgundyLight: '#A63A4A', // عنابي فاتح / ثانوي
  burgundyDeep: '#8C1D2F',  // عنابي عميق (عناوين الموقع)
  bg: '#FBF3F4',            // خلفية التطبيق
  card: '#FFFFFF',          // خلفية البطاقات
  title: '#1D2939',          // نص عناوين داكن
  text: '#344054',           // نص أساسي
  textSecondary: '#667085', // نص فرعي رمادي
  textMuted: '#98A2B3',     // نص باهت
  tabInactive: '#9CA3AF',    // تبويبات غير نشطة (رمادي الموقع gray-400)
  border: '#F0E2E4',        // حدود البطاقات
  borderLight: '#F3E8EA',
  borderFaint: '#F5EDEF',
  borderBurgundy: 'rgba(122,31,43,0.15)', // حدود بلون العنابي (أسلوب الموقع)
  burgundySoft: 'rgba(122,31,43,0.08)', // خلفية عنابية خافتة (شارات)
  successBorder: '#A7F3D0',   // حد الشارات الخضراء
  errorBorder: '#FECACA',     // حد بطاقات الخطأ
  ghostBorder: '#E7C9CD',   // حدود الأزرار الشبحية
  optionBg: '#FFFDFD',      // خلفية الخيار غير المحدد
  optionBorder: '#F0E4E6',   // حد الخيار العادي (مواصفة 6.8)
  letterBg: '#F6F1F2',       // خلفية حرف الخيار الدائري (مواصفة 6.8)
  letterBorder: '#D1D5DB',   // حد حرف الخيار (رمادي الموقع gray-300)
  optionSelectedBg: '#FDF3F4',
  segBg: '#EDE7E8',         // خلفية التبويب الداخلي
  accordionBg: '#FBF7F8',
  featureTile: '#FAF0F1',   // خلفية بلاطات الميزات (شاشة الدخول)
  success: '#0E7C66',
  successBg: '#E6F7F4',
  emerald: '#059669',       // أخضر داكن (دوائر الحروف)
  rose: '#E11D48',          // أحمر داكن (دوائر الحروف)
  error: '#DC2626',
  errorBg: '#FEF2F2',
  amber: '#F59E0B',         // كهرماني (شارات القفل)
  amberDot: '#22C55E',      // أخضر نابض (شاشة الدخول)
  amberBg: '#FEF3C7',
  amberText: '#92400E',
  explainBg: '#FFFBEB',
  explainBorder: '#FDE68A',
  explainText: '#78350F',
  toastBg: '#1D2939',
  scrim: 'rgba(20,8,10,0.45)',
  white: '#FFFFFF',
  black: '#000000',
  gold: '#FCD34D',              // الذهبي الموحد (أيقونات/شارات/عدادات)
  skeletonBg: '#EFE3E5',        // خلفية هياكل التحميل (Skeletons)
  cardGlassHeader: 'rgba(255,255,255,0.5)', // حجاب ترويسة الدرج الزجاجي
  cardGlassFooter: 'rgba(255,255,255,0.9)', // حجاب تذييل الدرج الزجاجي
  inputBg: '#F9FAFB',            // خلفية حقول الإدخال
} as const;

// نوع مشترك للوحة الألوان — يضمن تطابق مفاتيح الوضع الليلي مع النهاري
// (قيم string عامة حتى يقبل الوضع الليلي درجات مختلفة لنفس المفاتيح)
export type ThemeColors = Record<keyof typeof colors, string>;

// الوضع الليلي — نفس الهوية العنابية على خلفيات داكنة دافئة
export const darkColors: ThemeColors = {
  burgundy: '#8E2A3A',      // عنابي مضيء قليلًا ليبرز على الداكن
  burgundyLight: '#B04A5A', // عنابي فاتح / ثانوي
  burgundyDeep: '#A63A4A',  // عنابي عميق
  bg: '#161214',            // خلفية التطبيق الداكنة
  card: '#211B1E',          // خلفية البطاقات
  title: '#F7F0F1',         // نص عناوين فاتح
  text: '#E6D9DC',          // نص أساسي
  textSecondary: '#B49AA0', // نص فرعي
  textMuted: '#9A8288',     // نص باهت (تباين محسّن للقراءة)
  tabInactive: '#9A8288',   // تبويبات غير نشطة
  border: '#352A2E',        // حدود البطاقات
  borderLight: '#3D3035',
  borderFaint: '#2C2327',
  borderBurgundy: 'rgba(176,74,90,0.25)',
  burgundySoft: 'rgba(176,74,90,0.22)', // خلفية عنابية خافتة (شارات)
  successBorder: 'rgba(52,211,153,0.35)', // حد الشارات الخضراء
  errorBorder: 'rgba(248,113,113,0.35)',  // حد بطاقات الخطأ
  ghostBorder: '#5A3F45',   // حدود الأزرار الشبحية
  optionBg: '#211B1E',      // خلفية الخيار غير المحدد
  optionBorder: '#3D3035',
  letterBg: '#2C2327',      // خلفية حرف الخيار الدائري
  letterBorder: '#5A4A50',
  optionSelectedBg: 'rgba(142,42,58,0.35)',
  segBg: '#2C2327',         // خلفية التبويب الداخلي
  accordionBg: '#1C1719',
  featureTile: '#241C1F',   // خلفية بلاطات الميزات
  success: '#34D399',
  successBg: 'rgba(52,211,153,0.14)',
  emerald: '#34D399',
  rose: '#F87171',
  error: '#F87171',
  errorBg: 'rgba(248,113,113,0.14)',
  amber: '#FBBF24',
  amberDot: '#22C55E',
  amberBg: 'rgba(251,191,36,0.14)',
  amberText: '#FCD34D',
  explainBg: '#2A2117',
  explainBorder: '#6B5426',
  explainText: '#FDE68A',
  toastBg: '#3A2D32',
  scrim: 'rgba(0,0,0,0.6)',
  white: '#FFFFFF',
  black: '#000000',
  gold: '#FCD34D',              // الذهبي الموحد (أيقونات/شارات/عدادات)
  skeletonBg: '#2E2529',        // خلفية هياكل التحميل (Skeletons)
  cardGlassHeader: 'rgba(33,27,30,0.5)', // حجاب ترويسة الدرج الزجاجي
  cardGlassFooter: 'rgba(33,27,30,0.9)', // حجاب تذييل الدرج الزجاجي
  inputBg: '#241C1F',            // خلفية حقول الإدخال
};

export const gradients = {
  primary: ['#7A1F2B', '#A63A4A'] as const,
  progress: ['#7A1F2B', '#A63A4A'] as const,
  download: ['#0E7C66', '#14A085'] as const,
  welcome: ['#FBF3F4', '#F6E8EA', '#F3DDE1'] as const,
  drawerHeader: ['#7A1F2B', '#A63A4A'] as const,
  header: ['#7A1F2B', '#A63A4A'] as const, // ترويسة الموقع (عمودي)
  google: ['#7A1F2B', '#8C2332', '#A63A4A'] as const, // زر Google في الموقع
};
