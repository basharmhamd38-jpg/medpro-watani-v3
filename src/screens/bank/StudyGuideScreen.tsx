// دليل الدراسة — مرجعية AI Studio (StudyGuideSection.tsx)
// 8 أقسام فرعية تفاعلية: النصائح، التركيز، بومودورو، قائمة التحقق،
// اختبار نمط التعلم، تمرين التنفس، تحدي الذاكرة، المراجعة الذكية
// كل البيانات محلية (مطابقة للموقع) + حفظ التقدم بـ AsyncStorage
import { useEffect, useRef, useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AppTextInput as TextInput } from '../../components/AppText';
import { AppText as Text } from '../../components/AppText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  GraduationCap,
  ListChecks,
  Pause,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Wind,
} from 'lucide-react-native';
import { radius, shadows, useTheme, type ThemeColors } from '../../theme';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import { formatNumber } from '../../utils/numbers';

type SubTab =
  | 'tips'
  | 'focus'
  | 'pomodoro'
  | 'checklist'
  | 'learningStyle'
  | 'breathing'
  | 'memory'
  | 'spacedRep';

// ─── البيانات (مطابقة للموقع حرفيًا) ─────────────────────────────────────────

const TIPS_GROUPS: { title: string; items: string[] }[] = [
  {
    title: 'استراتيجيات الدراسة الفعالة',
    items: [
      'ادرس بنشاط وأشصت بصوت عالٍ كأنك تعلّم زميلًا.',
      'الاستدعاء النشط: أغلق الكتاب واسترجع قبل قراءة الجواب.',
      'التكرار المتباعد: راجع بعد يوم ثم 3 أيام ثم أسبوع ثم أسبوعين.',
      'اربط كل معلومة نظرية بحالة سريرية.',
      'ابدأ بالمواد عالية الوزن: الباطنة أولًا في الكتلة الأولى، والجراحة والنسائية والتوليد في الثانية.',
      'حل الدورات السابقة بتوقيت حقيقي: 120 سؤالًا في ساعتين — أفكار الأسئلة تتكرر.',
    ],
  },
  {
    title: 'قراءة السؤال السريري',
    items: [
      'اقرأ الجملة الأخيرة أولًا.',
      'حدد العلامات الحاسمة (العمر، الجنس، الأعراض المميزة، الفحوص).',
      'ابنِ تشخيصًا تفريقيًا من 2-3 احتمالات ثم استبعد.',
      'انتبه للكلمات المطلقة (دائمًا/أبدًا/كل) فغالبًا تدل على خيار خاطئ.',
      'لا تغيّر إجابتك الأولى إلا بدليل واضح.',
    ],
  },
  {
    title: 'تقنيات الذاكرة',
    items: [
      'القصر الذهني وتخيل المعلومات في أماكن مألوفة.',
      'الكلمات المفتاحية والاختصارات الذكية لتسريع التذكر.',
      'الصور الذهنية الغريبة لترسخ المعلومات الصعبة.',
      'التشفير الثلاثي: اقرأ + اكتب + اشرح بصوتك.',
      'النوم 7-9 ساعات — تثبيت الذاكرة والتعلم يحدث أثناء النوم العميق.',
    ],
  },
  {
    title: 'إدارة القلق',
    items: [
      'جهّز كل مستلزماتك من الليلة السابقة ونم مبكرًا.',
      'صباح الامتحان: فطور متوازن + تنفس عميق دقيقتين + لا معلومات جديدة.',
      'أثناء الامتحان: توقف 10 ثوانٍ وتنفس بعمق عند شعور التوتر.',
      'ثق بتحضيرك وجهدك طوال فترة التحضير.',
    ],
  },
  {
    title: 'إدارة الوقت',
    items: [
      'دقيقة واحدة لكل سؤال كمعدل زمني مستهدف.',
      'محطات دورية: كل 30 سؤالًا ≈ 30 دقيقة.',
      'السؤال الصعب: علّمه وانتقل فوراً وعُد إليه نهاية الاختبار.',
      'آخر 10 دقائق مخصصة لمراجعة الأسئلة المعلّمة فقط.',
    ],
  },
  {
    title: 'استبعاد الإجابات الخاطئة',
    items: [
      'استبعد المستحيل طبياً وعلمياً أولًا.',
      'احذر الصياغات المطلقة الحادة.',
      'عند بقاء خيارين اختر الأكثر تحديدًا وتوافقًا مع العلامات الحاسمة.',
      'لا تترك أي سؤال فارغًا — خمن بذكاء إن لزم الأمر.',
    ],
  },
  {
    title: 'التقييم الذاتي',
    items: [
      'سجّل أخطاءك وصنّف سببها (معلومة ناقصة؟ تسرّع؟ سوء قراءة للسؤال؟).',
      'راجع الدورات السابقة — الأنماط الامتحانية تتكرر بانتظام.',
      'ركّز جلسات المراجعة النهائية على نقاط ضعفك الحقيقية.',
    ],
  },
];

const FOCUS_METHODS: { title: string; desc: string }[] = [
  {
    title: 'الاستدعاء النشط',
    desc: 'أغلق الكتاب واشرح المعلومة لنفسك بصوت عالٍ قبل التأكد من صحتها في المرجع لتثبيتها في الذاكرة طويلة الأمد.',
  },
  {
    title: 'التكرار المتباعد',
    desc: 'راجع المعلومات الأساسية بعد يوم ثم 3 أيام ثم أسبوع بدل الحشو العشوائي المجهد في ليلة الامتحان.',
  },
  {
    title: 'الخرائط الذهنية',
    desc: 'ارسم خريطة بصرية تربط الموضوع الرئيسي بتفريعاته السريرية والعلاجية لتسهيل الاسترجاع السريع.',
  },
  {
    title: 'التعلم متعدد الحواس',
    desc: 'امزج بين القراءة البصرية، الكتابة بخط اليد، والشرح الصوتي لتفعيل أكبر مساحة في الدماغ.',
  },
  {
    title: 'التأمل واليقظة',
    desc: 'خصص 5 دقائق يوميًا من التنفس العميق المنتظم لتهدئة العقل وخفض هرمونات التوتر.',
  },
  {
    title: 'النوم الكافي',
    desc: 'احرص على 7-9 ساعات نوم يومياً؛ فالحرمان من النوم يدمّر التركيز والقدرة على اتخاذ القرار السريري.',
  },
  {
    title: 'بيئة الدراسة',
    desc: 'اجلس في مكان هادئ وثابت، واجعل هاتفك صامتاً وبعيداً، مع إضاءة جيدة وجلسات تركيز مقسمة.',
  },
];

const CHECKLIST_PHASES: { id: string; title: string; items: string[] }[] = [
  {
    id: 'week_before',
    title: 'قبل الامتحان بأسبوع',
    items: [
      'ثبّت نومك (7-9 ساعات) واستيقظ مبكرًا لضبط الساعة البيولوجية.',
      'خفف الحشو العشوائي وركّز على المراجعة عالية المردود.',
      'تدرّب على نموذج امتحاني كامل: 120 سؤالًا في ساعتين.',
      'تأكد من تسجيلك الإلكتروني عبر موقع الهيئة الوطنية للجودة والاعتمادية.',
      'اعرف مركزك الامتحاني وطريق الوصول إليه مسبقاً.',
    ],
  },
  {
    id: 'day_before',
    title: 'اليوم السابق',
    items: [
      'مراجعة خفيفة وسريعة فقط — بلا معلومات جديدة لتجنب التشتت.',
      'جهّز الهوية الشخصية الإثباتية + وثيقة التسجيل الامتحاني.',
      'ارتدِ ملابس مريحة ومناسبة لدرجة حرارة القاعة.',
      'جهّز ماء ووجبة خفيفة (فترة الامتحان ساعتان متواصلتان).',
      'اضبط منبهين للاستيقاظ المبكر.',
      'نم مبكرًا وتجنب أي كافيين في المساء.',
    ],
  },
  {
    id: 'exam_morning',
    title: 'صباح الامتحان',
    items: [
      'استيقظ قبل الموعد بثلاث ساعات على الأقل لتنشيط الدماغ.',
      'تناول فطورًا متوازنًا يجمع البروتينات والكربوهيدرات المعقدة.',
      'قم بتمدد خفيف وتنفس عميق لدقيقتين.',
      'راجع ملخصك السريع فقط دون إجهاد بصري أو ذهني.',
      'اخرج مبكرًا واترك وقتاً احتياطياً كافياً للطريق.',
    ],
  },
  {
    id: 'during_exam',
    title: 'أثناء الامتحان',
    items: [
      'دقيقة واحدة لكل سؤال كمعدل زمني صارم.',
      'اقرأ الجملة الأخيرة أولًا في الحالات السريرية المعقدة.',
      'أجب عن كل سؤال ولا تترك أي خانة فارغة.',
      'راقب الوقت بانتظام: كل 30 سؤالًا ≈ 30 دقيقة.',
    ],
  },
  {
    id: 'between_blocks',
    title: 'بين الكتلتين (نحو أسبوعين)',
    items: [
      'انتهت الكتلة الأولى — أغلق صفحتها تماماً ولا تراجعها، لن يغيّر ذلك شيئًا.',
      'خذ يوم راحة تام للتعافي الجسدي والذهني أولًا.',
      'وجّه كل الفترة القادمة لمواد الكتلة الثانية فقط: جراحة، عينية، أذنية، نسائية وتوليد.',
      'حافظ على نفس إيقاع النوم المنتظم وجلسات الدراسة المركزة.',
    ],
  },
];

const LS_QUESTIONS: {
  q: string;
  options: { text: string; type: 'V' | 'A' | 'K' }[];
}[] = [
  {
    q: 'لما بتتعلم معلومة طبية جديدة، شو أسرع طريقة بتثبت فيها براسك؟',
    options: [
      { text: 'بشوف مخطط أو صورة توضيحية', type: 'V' },
      { text: 'حدا بيشرحلي إياها', type: 'A' },
      { text: 'بجرّبها أو بطبقها بنفسي', type: 'K' },
    ],
  },
  {
    q: 'كيف بتتذكر رقم تلفون جديد؟',
    options: [
      { text: 'بتخيّل شكله مكتوب قدّامي', type: 'V' },
      { text: 'برردّه بصوت عالي', type: 'A' },
      { text: 'بكتبه بإيدي عدّة مرات', type: 'K' },
    ],
  },
  {
    q: 'بالمحاضرة بتستوعب أكتر لما الدكتور...',
    options: [
      { text: 'بيستخدم شرائح وصور ومخططات', type: 'V' },
      { text: 'بيشرح شفهيًا وبيعطي أمثلة', type: 'A' },
      { text: 'بيعمل تطبيق عملي أو حالات', type: 'K' },
    ],
  },
  {
    q: 'إذا ضعت بطريق جديد عليك...',
    options: [
      { text: 'بتفتح الخريطة وبتشوفها', type: 'V' },
      { text: 'بتسأل حدا وبيوصفلك الطريق', type: 'A' },
      { text: 'بتمشي وبتستكشف بنفسك', type: 'K' },
    ],
  },
  {
    q: 'قبل الامتحان بتراجع بـ...',
    options: [
      { text: 'ملخصات ملوّنة وخرائط ذهنية', type: 'V' },
      { text: 'بتشرح الدروس لنفسك بصوت عالٍ', type: 'A' },
      { text: 'بتحل أسئلة وبطاقات تدريبية', type: 'K' },
    ],
  },
  {
    q: 'شو أكتر شي بيشتت تركيزك؟',
    options: [
      { text: 'الفوضى والأشياء المبعثرة حواليك', type: 'V' },
      { text: 'الضجيج والأصوات', type: 'A' },
      { text: 'القعدة الطويلة بلا حركة', type: 'K' },
    ],
  },
  {
    q: 'لما تقرأ معلومة بكتاب...',
    options: [
      { text: 'بتتذكر مكانها بالصفحة وشكلها', type: 'V' },
      { text: 'بتتذكر شو انحكى عنها', type: 'A' },
      { text: 'بتتذكر لما استخدمتها أو طبقتها', type: 'K' },
    ],
  },
  {
    q: 'لحفظ قائمة أدوية طويلة بتفضّل...',
    options: [
      { text: 'جدول ملوّن ومنظّم', type: 'V' },
      { text: 'ترديدها صوتيًا بإيقاع', type: 'A' },
      { text: 'بطاقات بتقلبها بإيدك', type: 'K' },
    ],
  },
];

const LS_STYLE_DETAILS: Record<
  string,
  { label: string; title: string; recs: string }
> = {
  V: {
    label: 'بصري',
    title: 'المتعلم البصري — تتعلم أفضل بالصور والمخططات',
    recs: 'استخدم الخرائط الذهنية والجداول الملونة والمخططات؛ لخّص بألوان؛ شاهد فيديوهات تعليمية.',
  },
  A: {
    label: 'سمعي',
    title: 'المتعلم السمعي — تتعلم أفضل بالشرح والسماع',
    recs: 'اشرح الدروس بصوت عالٍ؛ ناقش مع زملائك؛ سجّل شرحك واستمع إليه؛ اعتمد الترديد الصوتي للحفظ.',
  },
  K: {
    label: 'عملي',
    title: 'المتعلم العملي — تتعلم أفضل بالتجربة والتطبيق',
    recs: 'حل الأسئلة والبطاقات التدريبية؛ ادرس بجلسات قصيرة مع فواصل حركة؛ اربط كل معلومة بحالة سريرية.',
  },
};

const MED_WORDS_POOL = [
  'ديجوكسين',
  'فوروسيميد',
  'أتروبين',
  'وارفارين',
  'ميتفورمين',
  'أوميبرازول',
  'سالبوتامول',
  'أموكسيسيلين',
  'هيبارين',
  'أسبرين',
  'ليزينوبريل',
  'أتورفاستاتين',
  'مورفين',
  'إنسولين',
  'بروبرانولول',
  'ديكساميثازون',
];

const PALACE_STEPS = [
  {
    title: '١. اختيار المكان المألوف:',
    desc: 'تخيل مكاناً تعرفه تفاصيله جيداً (مثل غرفتك، منزلك القديم، أو بهو مشفى الجامعة).',
  },
  {
    title: '٢. تحديد محطات ثابتة بترتيب منطقي:',
    desc: 'حدد نقاط ومحطات سير واضحة بترتيب ثابت (مثلاً: الباب الرئيسي ← مكتب الاستقبال ← السرير الأول ← النافذة).',
  },
  {
    title: '٣. ربط المعلومات بصور بصرية غريبة ومضحكة:',
    desc: 'الدماغ يتذكر الصور الغريبة والمثيرة بسهولة. حوّل كل مصطلح طبي إلى رمز بصري مجنون.',
  },
  {
    title: '٤. وضع الصورة في المحطة:',
    desc: 'اربط كل مصطلح بالمحطة الخاصة به في مكانك المتخيل.',
  },
  {
    title: '٥. الاسترجاع الذهني:',
    desc: 'أثناء الامتحان، تجول عقلياً في نفس المكان وبنفس الترتيب لتسترجع المعلومات بدقة تامة.',
  },
];

const SUB_TABS: { key: SubTab; label: string; icon: any }[] = [
  { key: 'tips', label: 'النصائح', icon: BookOpen },
  { key: 'focus', label: 'التركيز', icon: Brain },
  { key: 'pomodoro', label: 'بومودورو', icon: Clock },
  { key: 'checklist', label: 'قائمة التحقق', icon: CheckCircle2 },
  { key: 'learningStyle', label: 'اختبار النمط', icon: Sparkles },
  { key: 'breathing', label: 'التنفس', icon: Wind },
  { key: 'memory', label: 'الذاكرة', icon: Target },
  { key: 'spacedRep', label: 'المراجعة الذكية', icon: ListChecks },
];

// ─── مكوّنات مساعدة ──────────────────────────────────────────────────────────

function SectionTitle({
  icon,
  title,
  desc,
}: {
  icon: any;
  title: string;
  desc?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const Icon = icon;
  return (
    <View style={[styles.card, shadows.card]}>
      <View style={styles.titleRow}>
        <Icon size={18} color={colors.burgundyLight} strokeWidth={2.2} />
        <Text style={[styles.titleText, rtlTextStyle]}>{bidi(title)}</Text>
      </View>
      {desc ? (
        <Text style={[styles.titleDesc, rtlTextStyle]}>{bidi(desc)}</Text>
      ) : null}
    </View>
  );
}

// ─── القسم 1: النصائح ────────────────────────────────────────────────────────

function TipsSection() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState('');
  const [openAccordions, setOpenAccordions] = useState<Record<number, boolean>>({
    0: true,
  });

  const filtered = TIPS_GROUPS.filter(g => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      g.title.toLowerCase().includes(q) ||
      g.items.some(item => item.toLowerCase().includes(q))
    );
  });

  return (
    <View style={styles.col}>
      <View style={[styles.card, shadows.card]}>
        <View style={styles.titleRow}>
          <Sparkles size={18} color={colors.amberText} strokeWidth={2.2} />
          <Text style={[styles.titleText, rtlTextStyle]}>
            {'القسم ١: نصائح الدراسة للامتحان الوطني'}
          </Text>
        </View>
        <View style={styles.searchWrap}>
          <Search
            size={16}
            color={colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={'ابحث في النصائح والاستراتيجيات...'}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, rtlTextStyle]}
          />
        </View>
      </View>

      {filtered.length === 0 ? (
        <View style={[styles.card, styles.emptyBox]}>
          <Text style={[styles.emptyText, rtlTextStyle]}>
            {'لا توجد نتائج مطابقة لبحثك.'}
          </Text>
        </View>
      ) : (
        filtered.map((group, gi) => {
          const isOpen = openAccordions[gi] !== false;
          const Icon = isOpen ? ChevronUp : ChevronDown;
          return (
            <View
              key={gi}
              style={[styles.card, styles.accordionCard, shadows.card]}>
              <TouchableOpacity
                style={styles.accordionHead}
                activeOpacity={0.7}
                onPress={() =>
                  setOpenAccordions(prev => ({ ...prev, [gi]: !isOpen }))
                }>
                <View style={styles.accordionHeadInner}>
                  <View style={styles.numBadge}>
                    <Text style={styles.numBadgeText}>{gi + 1}</Text>
                  </View>
                  <Text style={[styles.accordionTitle, rtlTextStyle]}>
                    {bidi(group.title)}
                  </Text>
                </View>
                <Icon size={18} color={colors.burgundy} />
              </TouchableOpacity>
              {isOpen && (
                <View style={styles.accordionBody}>
                  {group.items.map((item, ii) => (
                    <View key={ii} style={styles.tipRow}>
                      <View style={styles.tipDot} />
                      <Text style={[styles.tipText, rtlTextStyle]}>
                        {bidi(item)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

// ─── القسم 2: طرق التركيز ────────────────────────────────────────────────────

function FocusSection() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.col}>
      <SectionTitle
        icon={Brain}
        title="القسم 2: طرق التركيز والتعلم الفعّال"
        desc="بطاقات علمية عملية لتعزيز الذاكرة والتركيز أثناء التحضير الطبي."
      />
      {FOCUS_METHODS.map((m, idx) => (
        <View key={idx} style={[styles.card, shadows.card]}>
          <View style={styles.methodBadge}>
            <Text style={[styles.methodBadgeText, rtlTextStyle]}>
              {`طريقة #${formatNumber(idx + 1)}`}
            </Text>
          </View>
          <Text style={[styles.methodTitle, rtlTextStyle]}>
            {bidi(m.title)}
          </Text>
          <View style={styles.methodDescBox}>
            <Text style={[styles.methodDesc, rtlTextStyle]}>
              {bidi(m.desc)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── القسم 3: مؤقت بومودورو ──────────────────────────────────────────────────

const POMO_COUNT_KEY = 'study_guide_pomodoro_count';
const POMO_DATE_KEY = 'study_guide_pomodoro_date';

function formatTime(secs: number) {
  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function PomodoroSection() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [mode, setMode] = useState<'focus' | 'shortBreak' | 'longBreak'>(
    'focus',
  );
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [sessionIndex, setSessionIndex] = useState(1);
  const stateRef = useRef({ mode, timeLeft, sessionIndex, pomodoroCount });
  stateRef.current = { mode, timeLeft, sessionIndex, pomodoroCount };

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(POMO_COUNT_KEY);
        const savedDate = await AsyncStorage.getItem(POMO_DATE_KEY);
        const today = new Date().toISOString().split('T')[0];
        if (saved && savedDate === today)
          setPomodoroCount(parseInt(saved, 10) || 0);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      const st = stateRef.current;
      if (st.timeLeft > 0) {
        setTimeLeft(t => t - 1);
      } else {
        setIsRunning(false);
        if (st.mode === 'focus') {
          const nextCount = st.pomodoroCount + 1;
          setPomodoroCount(nextCount);
          const today = new Date().toISOString().split('T')[0];
          AsyncStorage.setItem(POMO_COUNT_KEY, String(nextCount)).catch(
            () => {},
          );
          AsyncStorage.setItem(POMO_DATE_KEY, today).catch(() => {});
          if (st.sessionIndex >= 4) {
            setMode('longBreak');
            setTimeLeft(20 * 60);
            setSessionIndex(1);
          } else {
            setMode('shortBreak');
            setTimeLeft(5 * 60);
            setSessionIndex(prev => prev + 1);
          }
        } else {
          setMode('focus');
          setTimeLeft(25 * 60);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning]);

  const reset = () => {
    setIsRunning(false);
    if (mode === 'focus') setTimeLeft(25 * 60);
    else if (mode === 'shortBreak') setTimeLeft(5 * 60);
    else setTimeLeft(20 * 60);
  };

  const modeLabel =
    mode === 'focus'
      ? 'وقت التركيز العميق 📚'
      : mode === 'shortBreak'
        ? 'راحة قصيرة ☕'
        : 'راحة طويلة 🌿';

  return (
    <View style={styles.col}>
      <SectionTitle
        icon={Clock}
        title="القسم 3: مؤقت بومودورو الدراسي (تفاعلي)"
        desc="25 دقيقة تركيز ← 5 دقائق راحة ← بعد 4 جلسات راحة طويلة 20 دقيقة."
      />
      <View style={[styles.card, styles.pomoCard, shadows.card]}>
        <View style={styles.modeBadge}>
          <View
            style={[
              styles.modeDot,
              {
                backgroundColor:
                  mode === 'focus' ? colors.burgundy : colors.emerald,
              },
            ]}
          />
          <Text style={[styles.modeText, rtlTextStyle]}>{bidi(modeLabel)}</Text>
        </View>

        <View style={styles.timerBox}>
          <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
        </View>

        <View style={styles.sessionInfo}>
          <View style={styles.sessionCell}>
            <Text style={styles.sessionLabel}>الجلسة الحالية</Text>
            <Text style={styles.sessionValue}>{sessionIndex} / 4</Text>
          </View>
          <View style={styles.sessionDivider} />
          <View style={styles.sessionCell}>
            <Text style={styles.sessionLabel}>جلسات اليوم المنجزة</Text>
            <Text style={[styles.sessionValue, { color: colors.emerald }]}>
              {pomodoroCount} جلسات
            </Text>
          </View>
        </View>

        <View style={styles.pomoControls}>
          {!isRunning ? (
            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.8}
              onPress={() => setIsRunning(true)}>
              <Play size={16} color={colors.white} />
              <Text style={styles.primaryBtnText}>بدء المؤقت</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.amber }]}
              activeOpacity={0.8}
              onPress={() => setIsRunning(false)}>
              <Pause size={16} color={colors.white} />
              <Text style={styles.primaryBtnText}>إيقاف مؤقت</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.ghostBtn}
            activeOpacity={0.8}
            onPress={reset}>
            <RotateCcw size={16} color={colors.text} />
            <Text style={styles.ghostBtnText}>إعادة</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── القسم 4: قائمة تحضير يوم الامتحان ────────────────────────────────────────

const CHECKLIST_KEY = 'study_guide_checklist_v1';

function ChecklistSection() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(CHECKLIST_KEY);
        if (saved) setChecked(JSON.parse(saved));
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const toggle = (key: string) => {
    setChecked(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(CHECKLIST_KEY, JSON.stringify(updated)).catch(
        () => {},
      );
      return updated;
    });
  };

  if (!loaded) return null;

  return (
    <View style={styles.col}>
      <SectionTitle
        icon={CheckCircle2}
        title="القسم 4: قائمة تحضير يوم الامتحان والكتل"
        desc="تُحفظ مهامك تلقائيًا على جهازك وتبقى معك دائمًا."
      />
      {CHECKLIST_PHASES.map(phase => {
        const doneCount = phase.items.filter(
          (_, idx) => !!checked[`${phase.id}_${idx}`],
        ).length;
        return (
          <View key={phase.id} style={[styles.card, styles.phaseCard]}>
            <View style={styles.phaseHead}>
              <View style={styles.titleRow}>
                <ShieldCheck
                  size={16}
                  color={colors.burgundyLight}
                  strokeWidth={2.2}
                />
                <Text style={[styles.phaseTitle, rtlTextStyle]}>
                  {bidi(phase.title)}
                </Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>
                  {doneCount} / {phase.items.length}
                </Text>
              </View>
            </View>
            <View style={styles.checkList}>
              {phase.items.map((item, idx) => {
                const key = `${phase.id}_${idx}`;
                const isChecked = !!checked[key];
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.checkRow,
                      isChecked && styles.checkRowDone,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => toggle(key)}>
                    <View
                      style={[
                        styles.checkBox,
                        isChecked && styles.checkBoxDone,
                      ]}>
                      {isChecked && <Check size={14} color={colors.white} />}
                    </View>
                    <Text
                      style={[
                        styles.checkText,
                        rtlTextStyle,
                        isChecked && styles.checkTextDone,
                      ]}>
                      {bidi(item)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── القسم 5: اختبار نمط التعلم ──────────────────────────────────────────────

const LS_RESULT_KEY = 'study_guide_learning_style_result';

type LsTestState = 'intro' | 'quiz' | 'result';
type LsResult = {
  counts: { V: number; A: number; K: number };
  percentages: { V: number; A: number; K: number };
  dominantStyles: string[];
};

function LsResultCard({
  result,
  onRetake,
}: {
  result: LsResult;
  onRetake: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const title =
    result.dominantStyles.length > 1
      ? `نمط مزدوج: ${result.dominantStyles
          .map(s => LS_STYLE_DETAILS[s].label)
          .join(' و ')}`
      : LS_STYLE_DETAILS[result.dominantStyles[0]].title;

  const bars: { label: string; pct: number; color: string }[] = [
    { label: 'بصري (Visual - V)', pct: result.percentages.V, color: colors.burgundy },
    { label: 'سمعي (Auditory - A)', pct: result.percentages.A, color: colors.burgundyLight },
    { label: 'عملي / حركي (Kinesthetic - K)', pct: result.percentages.K, color: colors.amber },
  ];

  return (
    <View style={[styles.card, styles.centerCard, shadows.card]}>
      <View style={styles.iconTile}>
        <Brain size={32} color={colors.burgundy} />
      </View>
      <Text style={[styles.lsResultTitle, rtlTextStyle]}>{bidi(title)}</Text>
      <View style={styles.barsBox}>
        {bars.map((b, i) => (
          <View key={i} style={styles.barRow}>
            <View style={styles.barLabelRow}>
              <Text style={[styles.barLabel, rtlTextStyle]}>{bidi(b.label)}</Text>
              <Text style={styles.barPct}>{b.pct}%</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[styles.barFill, { width: `${b.pct}%`, backgroundColor: b.color }]}
              />
            </View>
          </View>
        ))}
      </View>
      <View style={styles.recsBox}>
        <Text style={[styles.recsTitle, rtlTextStyle]}>
          {'💡 توصيات مخصصة لنمطك:'}
        </Text>
        {result.dominantStyles.map((s, i) => (
          <View key={i} style={styles.recCard}>
            <Text style={[styles.recText, rtlTextStyle]}>
              {bidi(LS_STYLE_DETAILS[s].recs)}
            </Text>
          </View>
        ))}
      </View>
      <TouchableOpacity
        style={styles.primaryBtn}
        activeOpacity={0.8}
        onPress={onRetake}>
        <Text style={styles.primaryBtnText}>إعادة الاختبار 🔄</Text>
      </TouchableOpacity>
    </View>
  );
}

function LearningStyleSection() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [state, setState] = useState<LsTestState>('intro');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<('V' | 'A' | 'K')[]>([]);
  const [result, setResult] = useState<LsResult | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LS_RESULT_KEY);
        if (saved) {
          setResult(JSON.parse(saved));
          setState('result');
        }
      } catch {}
    })();
  }, []);

  const start = () => {
    setAnswers([]);
    setIndex(0);
    setState('quiz');
  };

  const choose = (type: 'V' | 'A' | 'K') => {
    const next = [...answers, type];
    if (index + 1 < LS_QUESTIONS.length) {
      setAnswers(next);
      setIndex(index + 1);
    } else {
      const counts = { V: 0, A: 0, K: 0 };
      next.forEach(a => {
        counts[a]++;
      });
      const total = next.length || 8;
      const percentages = {
        V: Math.round((counts.V / total) * 100),
        A: Math.round((counts.A / total) * 100),
        K: Math.round((counts.K / total) * 100),
      };
      const max = Math.max(counts.V, counts.A, counts.K);
      const dominantStyles: string[] = [];
      if (counts.V === max) dominantStyles.push('V');
      if (counts.A === max) dominantStyles.push('A');
      if (counts.K === max) dominantStyles.push('K');
      const r: LsResult = { counts, percentages, dominantStyles };
      setResult(r);
      AsyncStorage.setItem(LS_RESULT_KEY, JSON.stringify(r)).catch(() => {});
      setState('result');
    }
  };

  if (state === 'result' && result) {
    return (
      <View style={styles.col}>
        <LsResultCard result={result} onRetake={start} />
      </View>
    );
  }

  if (state === 'quiz') {
    const q = LS_QUESTIONS[index];
    return (
      <View style={styles.col}>
        <View style={[styles.card, shadows.card]}>
          <View style={styles.quizHead}>
            <Text style={styles.quizCounter}>
              {`سؤال ${formatNumber(index + 1)} من ${formatNumber(LS_QUESTIONS.length)}`}
            </Text>
            <View style={styles.quizTag}>
              <Text style={styles.quizTagText}>{'اختبار النمط'}</Text>
            </View>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${((index + 1) / LS_QUESTIONS.length) * 100}%`,
                  backgroundColor: colors.burgundy,
                },
              ]}
            />
          </View>
          <Text style={[styles.quizQuestion, rtlTextStyle]}>{bidi(q.q)}</Text>
          <View style={styles.col2}>
            {q.options.map((opt, oi) => (
              <TouchableOpacity
                key={oi}
                style={styles.optBtn}
                activeOpacity={0.7}
                onPress={() => choose(opt.type)}>
                <Text style={[styles.optText, rtlTextStyle]}>
                  {bidi(opt.text)}
                </Text>
                <View style={styles.optLetter}>
                  <Text style={styles.optLetterText}>
                    {['أ', 'ب', 'ج'][oi]}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.col}>
      <View style={[styles.card, styles.centerCard, shadows.card]}>
        <View style={styles.iconTile}>
          <Brain size={32} color={colors.burgundy} />
        </View>
        <Text style={[styles.introTitle, rtlTextStyle]}>
          {'ما هو نمط تعلمك الطبي الأمثل؟'}
        </Text>
        <Text style={[styles.introDesc, rtlTextStyle]}>
          {'اختبار قصير من ٨ أسئلة يحدد ما إذا كنت متعصباً للبصريات، السمعيات، أو التطبيق العملي لتستثمر وقتك بأقصى كفاءة.'}
        </Text>
        <TouchableOpacity
          style={styles.primaryBtnWide}
          activeOpacity={0.8}
          onPress={start}>
          <Text style={styles.primaryBtnText}>ابدأ الاختبار الآن 🚀</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── القسم 6: تمرين التنفس (4-7-8) ───────────────────────────────────────────

type BreathPhase = 'inhale' | 'hold' | 'exhale';

function BreathingSection() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<BreathPhase>('inhale');
  const [secondsLeft, setSecondsLeft] = useState(4);
  const [cycle, setCycle] = useState(1);
  const [completed, setCompleted] = useState(false);
  const stRef = useRef({ isRunning, phase, secondsLeft, cycle, completed });
  stRef.current = { isRunning, phase, secondsLeft, cycle, completed };

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      const st = stRef.current;
      if (st.completed) {
        setIsRunning(false);
        return;
      }
      if (st.secondsLeft > 1) {
        setSecondsLeft(s => s - 1);
      } else if (st.phase === 'inhale') {
        setPhase('hold');
        setSecondsLeft(7);
      } else if (st.phase === 'hold') {
        setPhase('exhale');
        setSecondsLeft(8);
      } else {
        if (st.cycle >= 4) {
          setIsRunning(false);
          setCompleted(true);
          setSecondsLeft(0);
        } else {
          setCycle(c => Math.min(c + 1, 4));
          setPhase('inhale');
          setSecondsLeft(4);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning]);

  const start = () => {
    setCompleted(false);
    setPhase('inhale');
    setSecondsLeft(4);
    setCycle(1);
    setIsRunning(true);
  };
  const reset = () => {
    setIsRunning(false);
    setCompleted(false);
    setPhase('inhale');
    setSecondsLeft(4);
    setCycle(1);
  };

  const phaseTitle =
    phase === 'inhale'
      ? 'شهيق (أدخل الهواء ببطء)'
      : phase === 'hold'
        ? 'احبس النفس (استرخِ)'
        : 'زفير (أخرج الهواء ببطء)';
  const circleBg =
    phase === 'inhale'
      ? colors.burgundy
      : phase === 'hold'
        ? colors.burgundyLight
        : colors.burgundyLight;

  return (
    <View style={styles.col}>
      <SectionTitle
        icon={Wind}
        title="تمرين التنفس المهدئ (تقنية 4-7-8)"
        desc="تمرين علمي لخفض القلق والتوتر قبل دخول قاعة الامتحان."
      />
      <View style={[styles.card, styles.centerCard, shadows.card]}>
        <View style={styles.cycleRow}>
          <Text style={[styles.cycleText, rtlTextStyle]}>
            {`الدورة الحالية: ${formatNumber(Math.min(cycle, 4))} من ${formatNumber(4)}`}
          </Text>
          <View style={styles.amberPill}>
            <Text style={styles.amberPillText}>{'تقنية ٤-٧-٨'}</Text>
          </View>
        </View>

        <View style={styles.breathCircleWrap}>
          <View style={[styles.breathCircle, { backgroundColor: circleBg }]}>
            <Text style={styles.breathSecs}>{secondsLeft}</Text>
            <Text style={[styles.breathPhase, rtlTextStyle]}>
              {bidi(phaseTitle)}
            </Text>
          </View>
        </View>

        {completed && (
          <View style={styles.doneBox}>
            <Text style={[styles.doneText, rtlTextStyle]}>
              {'🎉 أحسنت! هدّأت أعصابك وأصبحت جاهزاً للتركيز بصفاء تام.'}
            </Text>
          </View>
        )}

        <View style={styles.pomoControls}>
          {!isRunning ? (
            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.8}
              onPress={start}>
              <Play size={16} color={colors.white} />
              <Text style={styles.primaryBtnText}>
                {completed ? 'ابدأ من جديد' : 'ابدأ التمرين'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.amber }]}
              activeOpacity={0.8}
              onPress={() => setIsRunning(false)}>
              <Pause size={16} color={colors.white} />
              <Text style={styles.primaryBtnText}>إيقاف مؤقت</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.ghostBtn}
            activeOpacity={0.8}
            onPress={reset}>
            <RotateCcw size={16} color={colors.text} />
            <Text style={styles.ghostBtnText}>إعادة</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── القسم 7: تدريب الذاكرة ──────────────────────────────────────────────────

type MemGameState = 'intro' | 'memorize' | 'recall' | 'result';

function MemorySection() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [subView, setSubView] = useState<'challenge' | 'palace'>('challenge');
  const [gameState, setGameState] = useState<MemGameState>('intro');
  const [words, setWords] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(30);
  const [userInput, setUserInput] = useState('');
  const [score, setScore] = useState<{
    correct: string[];
    missed: string[];
  } | null>(null);
  const gsRef = useRef(gameState);
  gsRef.current = gameState;

  useEffect(() => {
    if (gsRef.current !== 'memorize') return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setGameState('recall');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState]);

  const startChallenge = () => {
    const shuffled = [...MED_WORDS_POOL].sort(() => 0.5 - Math.random());
    setWords(shuffled.slice(0, 8));
    setUserInput('');
    setTimeLeft(30);
    setScore(null);
    setGameState('memorize');
  };

  const submitRecall = () => {
    const lines = userInput
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    const correct: string[] = [];
    const missed: string[] = [];
    words.forEach(w => {
      if (lines.some(l => l.toLowerCase() === w.toLowerCase())) correct.push(w);
      else missed.push(w);
    });
    setScore({ correct, missed });
    setGameState('result');
  };

  return (
    <View style={styles.col}>
      <View style={[styles.miniTabs, shadows.card]}>
        {(
          [
            { key: 'challenge', label: 'تحدي الذاكرة', icon: Target },
            { key: 'palace', label: 'دليل القصر الذهني', icon: BookOpen },
          ] as const
        ).map(t => {
          const Icon = t.icon;
          const active = subView === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.miniTab, active && styles.miniTabActive]}
              activeOpacity={0.7}
              onPress={() => setSubView(t.key)}>
              <Icon
                size={15}
                color={active ? colors.white : colors.burgundy}
                strokeWidth={2.2}
              />
              <Text
                style={[
                  styles.miniTabText,
                  active && styles.miniTabTextActive,
                  rtlTextStyle,
                ]}>
                {bidi(t.label)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {subView === 'challenge' ? (
        <View style={[styles.card, styles.centerCard, shadows.card]}>
          <Text style={[styles.gameTitle, rtlTextStyle]}>
            {'لعبة تحدي الذاكرة الطبية (٨ كلمات)'}
          </Text>
          <Text style={[styles.gameSub, rtlTextStyle]}>
            {'اختبر قوة تذكرك السريع'}
          </Text>

          {gameState === 'intro' && (
            <View style={styles.col2}>
              <View style={styles.iconTile}>
                <Brain size={32} color={colors.burgundy} />
              </View>
              <Text style={[styles.introDesc, rtlTextStyle]}>
                {'ستظهر لك ٨ كلمات ومصطلحات طبية لمدة ٣٠ ثانية فقط. احفظها جيداً ثم اكتب ما تتذكره منها!'}
              </Text>
              <TouchableOpacity
                style={styles.primaryBtnWide}
                activeOpacity={0.8}
                onPress={startChallenge}>
                <Text style={styles.primaryBtnText}>ابدأ التحدي ⚡</Text>
              </TouchableOpacity>
            </View>
          )}

          {gameState === 'memorize' && (
            <View style={styles.col2}>
              <View style={styles.amberBanner}>
                <Text style={[styles.amberBannerText, rtlTextStyle]}>
                  {'احفظ الكلمات التالية بعناية:'}
                </Text>
                <Text style={styles.amberTimer}>⏱️ {timeLeft} ثانية</Text>
              </View>
              <View style={styles.wordsGrid}>
                {words.map((w, i) => (
                  <View key={i} style={styles.wordTile}>
                    <Text style={[styles.wordText, rtlTextStyle]}>
                      {bidi(w)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {gameState === 'recall' && (
            <View style={styles.col2}>
              <Text style={[styles.recallHint, rtlTextStyle]}>
                {'انتهى الوقت! اكتب الكلمات التي تتذكرها (اكتب كل كلمة في سطر منفصل):'}
              </Text>
              <TextInput
                value={userInput}
                onChangeText={setUserInput}
                multiline
                numberOfLines={6}
                textAlign="right"
                placeholder={'اكتب الكلمات هنا...'}
                placeholderTextColor={colors.textMuted}
                style={[styles.recallInput, rtlTextStyle]}
              />
              <TouchableOpacity
                style={styles.primaryBtnWide}
                activeOpacity={0.8}
                onPress={submitRecall}>
                <Text style={styles.primaryBtnText}>تحقق من الإجابة 🎯</Text>
              </TouchableOpacity>
            </View>
          )}

          {gameState === 'result' && score && (
            <View style={styles.col2}>
              <View style={styles.scoreBox}>
                <Text style={[styles.scoreLabel, rtlTextStyle]}>
                  {'نتيجتك في التحدي'}
                </Text>
                <Text style={styles.scoreValue}>
                  {score.correct.length} / {words.length}
                </Text>
              </View>
              <View style={styles.scoreCols}>
                <View style={[styles.scoreCol, styles.scoreColGood]}>
                  <Text style={[styles.scoreColTitle, rtlTextStyle]}>
                    {`✅ الكلمات الصحيحة (${formatNumber(score.correct.length)}):`}
                  </Text>
                  <Text style={[styles.scoreColText, rtlTextStyle]}>
                    {bidi(score.correct.join('، ') || 'لا شيء')}
                  </Text>
                </View>
                <View style={[styles.scoreCol, styles.scoreColBad]}>
                  <Text style={[styles.scoreColTitle, rtlTextStyle]}>
                    {`❌ الكلمات التي نسيتها (${formatNumber(score.missed.length)}):`}
                  </Text>
                  <Text style={[styles.scoreColText, rtlTextStyle]}>
                    {bidi(
                      score.missed.join('، ') || 'لا شيء — علامتك كاملة! 🎉',
                    )}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.primaryBtnWide}
                activeOpacity={0.8}
                onPress={startChallenge}>
                <Text style={styles.primaryBtnText}>العب مجددًا (كلمات جديدة) 🔄</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.card, shadows.card]}>
          <Text style={[styles.palaceTitle, rtlTextStyle]}>
            {bidi('دليل القصر الذهني (Memory Palace)')}
          </Text>
          <Text style={[styles.palaceSub, rtlTextStyle]}>
            {'تقنية عريقة لترسيخ مئات المعلومات الطبية في الذاكرة طويلة الأمد.'}
          </Text>
          {PALACE_STEPS.map((s, i) => (
            <View key={i} style={styles.palaceStep}>
              <Text style={[styles.palaceStepTitle, rtlTextStyle]}>
                {bidi(s.title)}
              </Text>
              <Text style={[styles.palaceStepDesc, rtlTextStyle]}>
                {bidi(s.desc)}
              </Text>
            </View>
          ))}
          <View style={styles.amberExample}>
            <Text style={[styles.amberExampleTitle, rtlTextStyle]}>
              {'💡 مثال طبي عملي (أعراض فرط نشاط الدرق):'}
            </Text>
            <Text style={[styles.amberExampleText, rtlTextStyle]}>
              {'عند دخولك باب العيادة (المحطة ١)، تتخيل مريضاً بعينين جاحظتين (جحوظ). على مكتب الاستقبال (المحطة ٢)، يوجد قلب ينبض بسرعة شديدة وصوت دقاته عالية (خفقان). بجانب السرير (المحطة ٣)، توجد يد ترتجف بقوة (رعاش). وبجانب النافذة (المحطة ٤)، ترى مريضاً نحيلاً جداً (نقص وزن). بهذه الطريقة لن تنسى أي عرض أبداً!'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── القسم 8: المراجعة الذكية (التكرار المتباعد) ──────────────────────────────

const SPACED_KEY = 'study_guide_spaced_rep_topics';

type SpacedTopic = {
  id: string;
  title: string;
  addedDate: string;
  completedReviews: Record<string, boolean>;
};

const REVIEW_INTERVALS = [
  { key: 'day_1', label: 'مراجعة +1 يوم', days: 1 },
  { key: 'day_3', label: 'مراجعة +3 أيام', days: 3 },
  { key: 'day_7', label: 'مراجعة +7 أيام', days: 7 },
  { key: 'day_14', label: 'مراجعة +14 يوم', days: 14 },
];

function SpacedRepSection() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const todayStr = new Date().toISOString().split('T')[0];
  const [topics, setTopics] = useState<SpacedTopic[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(SPACED_KEY);
        if (saved) {
          setTopics(JSON.parse(saved));
        } else {
          const yesterday = new Date(Date.now() - 86400000)
            .toISOString()
            .split('T')[0];
          setTopics([
            {
              id: '1',
              title: 'فشل القلب الاحتقاني (CHF)',
              addedDate: yesterday,
              completedReviews: {},
            },
            {
              id: '2',
              title: 'احتشاء العضلة القلبية (STEMI)',
              addedDate: todayStr,
              completedReviews: {},
            },
          ]);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded)
      AsyncStorage.setItem(SPACED_KEY, JSON.stringify(topics)).catch(() => {});
  }, [topics, loaded]);

  const addTopic = () => {
    if (!newTitle.trim()) return;
    setTopics(prev => [
      {
        id: 'top_' + Date.now(),
        title: newTitle.trim(),
        addedDate: todayStr,
        completedReviews: {},
      },
      ...prev,
    ]);
    setNewTitle('');
  };

  const deleteTopic = (id: string) =>
    setTopics(prev => prev.filter(t => t.id !== id));

  const toggleReview = (topicId: string, reviewKey: string) =>
    setTopics(prev =>
      prev.map(t =>
        t.id === topicId
          ? {
              ...t,
              completedReviews: {
                ...t.completedReviews,
                [reviewKey]: !t.completedReviews[reviewKey],
              },
            }
          : t,
      ),
    );

  const reviewsFor = (topic: SpacedTopic) => {
    const base = new Date(topic.addedDate);
    const today = new Date(todayStr);
    return REVIEW_INTERVALS.map(inter => {
      const target = new Date(base.getTime() + inter.days * 86400000);
      const targetStr = target.toISOString().split('T')[0];
      const diffDays = Math.round(
        (target.getTime() - today.getTime()) / 86400000,
      );
      let friendly = targetStr;
      if (diffDays === 0) friendly = 'اليوم';
      else if (diffDays === 1) friendly = 'غدًا';
      else if (diffDays === -1) friendly = 'أمس';
      else if (diffDays > 1 && diffDays <= 7) friendly = `بعد ${diffDays} أيام`;
      else if (diffDays < -1) friendly = `منذ ${Math.abs(diffDays)} أيام`;
      return {
        ...inter,
        targetStr,
        friendly,
        due: diffDays <= 0,
        done: !!topic.completedReviews[inter.key],
      };
    });
  };

  const dueCount = topics.reduce(
    (n, t) =>
      n +
      reviewsFor(t).filter(r => r.due && !r.done).length,
    0,
  );

  if (!loaded) return null;

  return (
    <View style={styles.col}>
      <SectionTitle
        icon={ListChecks}
        title="جدول التكرار المتباعد الذكي (Anki)"
        desc="أضف مواضيعك وسيُجدول لك التطبيق مراجعاتها بعد 1 و3 و7 و14 يومًا."
      />

      <View style={[styles.card, shadows.card]}>
        <View style={styles.addRow}>
          <TextInput
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder={'أضف موضوعًا جديدًا للمراجعة...'}
            placeholderTextColor={colors.textMuted}
            style={[styles.addInput, rtlTextStyle]}
          />
          <TouchableOpacity
            style={styles.addBtn}
            activeOpacity={0.8}
            onPress={addTopic}>
            <Text style={styles.addBtnText}>＋ إضافة</Text>
          </TouchableOpacity>
        </View>
        {dueCount > 0 && (
          <View style={styles.dueBanner}>
            <Text style={[styles.dueBannerText, rtlTextStyle]}>
              {`🔔 لديك ${formatNumber(dueCount)} مراجعة مستحقة اليوم!`}
            </Text>
          </View>
        )}
      </View>

      {topics.map(topic => {
        const revs = reviewsFor(topic);
        const doneN = revs.filter(r => r.done).length;
        return (
          <View key={topic.id} style={[styles.card, shadows.card]}>
            <View style={styles.topicHead}>
              <View style={styles.topicHeadInner}>
                <Text style={[styles.topicTitle, rtlTextStyle]}>
                  {bidi(topic.title)}
                </Text>
                <Text style={[styles.topicDate, rtlTextStyle]}>
                  {bidi(`أُضيف بتاريخ ${topic.addedDate} • ${formatNumber(doneN)}/${formatNumber(revs.length)} مراجعات`)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.delBtn}
                activeOpacity={0.7}
                onPress={() => deleteTopic(topic.id)}>
                <Text style={styles.delBtnText}>🗑</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.revGrid}>
              {revs.map(r => (
                <TouchableOpacity
                  key={r.key}
                  style={[
                    styles.revTile,
                    r.done && styles.revTileDone,
                    !r.done && r.due && styles.revTileDue,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => toggleReview(topic.id, r.key)}>
                  <Text
                    style={[
                      styles.revTileLabel,
                      rtlTextStyle,
                      r.done && styles.revTileLabelDone,
                    ]}>
                    {bidi(r.label)}
                  </Text>
                  <Text
                    style={[
                      styles.revTileDate,
                      rtlTextStyle,
                      r.done && styles.revTileLabelDone,
                    ]}>
                    {bidi(r.friendly)}
                  </Text>
                  {r.done && <Check size={14} color={colors.emerald} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── الشاشة الرئيسية ──────────────────────────────────────────────────────────

export default function StudyGuideScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [tab, setTab] = useState<SubTab>('tips');

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <View style={styles.banner}>
        <View style={styles.titleRow}>
          <GraduationCap size={24} color={colors.gold} strokeWidth={2.2} />
          <Text style={[styles.bannerTitle, rtlTextStyle]}>
            {'دليل الدراسة للامتحان الوطني'}
          </Text>
        </View>
        <Text style={[styles.bannerDesc, rtlTextStyle]}>
          {'دليلك الشامل المجاني لنجاح باهر وتفوق في الامتحان الوطني الطبي الموحد. استراتيجيات، تركيز، بومودورو، وقائمة التحضير.'}
        </Text>
      </View>

      <View style={[styles.tabsGrid, shadows.card]}>
        {SUB_TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.subTab, active && styles.subTabActive]}
              activeOpacity={0.7}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}>
              <Icon
                size={15}
                color={active ? colors.white : colors.burgundy}
                strokeWidth={2.2}
              />
              <Text
                style={[
                  styles.subTabText,
                  active && styles.subTabTextActive,
                  rtlTextStyle,
                ]}
                numberOfLines={1}>
                {bidi(t.label)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'tips' && <TipsSection />}
      {tab === 'focus' && <FocusSection />}
      {tab === 'pomodoro' && <PomodoroSection />}
      {tab === 'checklist' && <ChecklistSection />}
      {tab === 'learningStyle' && <LearningStyleSection />}
      {tab === 'breathing' && <BreathingSection />}
      {tab === 'memory' && <MemorySection />}
      {tab === 'spacedRep' && <SpacedRepSection />}
    </ScrollView>
  );
}

// ─── الأنماط ──────────────────────────────────────────────────────────────────

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16, paddingBottom: 32, gap: 12 },
  col: { gap: 10 },
  col2: { gap: 10, alignItems: 'stretch' },

  banner: {
    backgroundColor: colors.burgundy,
    borderRadius: radius.md,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
  },
  bannerTitle: {
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 19,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'right',
    flexShrink: 1,
  },
  bannerDesc: {
    fontFamily: 'tajawal',
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
    textAlign: 'right',
  },

  tabsGrid: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    padding: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subTab: {
    width: '23.5%',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.bg,
  },
  subTabActive: { backgroundColor: colors.burgundy },
  subTabText: {
    fontFamily: 'tajawal',
    fontSize: 11,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'center',
  },
  subTabTextActive: { color: colors.white },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    padding: 14,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'right',
    flexShrink: 1,
  },
  titleDesc: {
    fontFamily: 'tajawal',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 19,
    textAlign: 'right',
  },

  searchWrap: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: { marginStart: 4 },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: 'tajawal',
    fontSize: 12,
    color: colors.title,
    textAlign: 'right',
  },

  emptyBox: { alignItems: 'center', paddingVertical: 32 },
  emptyText: {
    fontFamily: 'tajawal',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  accordionCard: { overflow: 'hidden', padding: 0 },
  accordionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: colors.accordionBg,
  },
  accordionHeadInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  numBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numBadgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  accordionTitle: {
    fontFamily: 'tajawal',
    fontSize: 13,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'right',
    flexShrink: 1,
  },
  accordionBody: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderBurgundy,
    gap: 10,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.inputBg,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.burgundy,
    marginTop: 7,
  },
  tipText: {
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 12,
    color: colors.text,
    lineHeight: 20,
    textAlign: 'right',
  },

  methodBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(122,31,43,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 6,
  },
  methodBadgeText: {
    fontFamily: 'tajawal',
    fontSize: 10,
    fontWeight: '700',
    color: colors.burgundy,
  },
  methodTitle: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'right',
  },
  methodDescBox: {
    marginTop: 8,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    borderRadius: 12,
    padding: 12,
  },
  methodDesc: {
    fontFamily: 'tajawal',
    fontSize: 12,
    color: colors.text,
    lineHeight: 20,
    textAlign: 'right',
  },

  pomoCard: { alignItems: 'center', gap: 16, paddingVertical: 24 },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(122,31,43,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  modeDot: { width: 10, height: 10, borderRadius: 5 },
  modeText: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.burgundy,
  },
  timerBox: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 48,
  },
  timerText: {
    fontSize: 52,
    fontWeight: '700',
    color: colors.burgundy,
    letterSpacing: 4,
  },
  sessionInfo: {
    flexDirection: 'row',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    width: '100%',
  },
  sessionCell: { flex: 1, alignItems: 'center', gap: 4 },
  sessionLabel: {
    fontFamily: 'tajawal',
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
  sessionValue: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.burgundy,
  },
  sessionDivider: { width: 1, backgroundColor: colors.border },
  pomoControls: { flexDirection: 'row', gap: 10, width: '100%' },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.burgundy,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontFamily: 'tajawal',
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  primaryBtnWide: {
    width: '100%',
    backgroundColor: colors.burgundy,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtn: {
    flexDirection: 'row',
    backgroundColor: colors.segBg,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ghostBtnText: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },

  phaseCard: { padding: 0, overflow: 'hidden' },
  phaseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderBurgundy,
  },
  phaseTitle: {
    fontFamily: 'tajawal',
    fontSize: 13,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'right',
  },
  countBadge: {
    backgroundColor: 'rgba(122,31,43,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  countBadgeText: {
    fontFamily: 'tajawal',
    fontSize: 10,
    fontWeight: '700',
    color: colors.burgundy,
  },
  checkList: { padding: 14, gap: 10 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
  },
  checkRowDone: { backgroundColor: colors.successBg, borderColor: colors.successBorder },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.letterBorder,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkBoxDone: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  checkText: {
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 12,
    color: colors.text,
    lineHeight: 20,
    textAlign: 'right',
  },
  checkTextDone: {
    textDecorationLine: 'line-through',
    opacity: 0.85,
    fontWeight: '700',
    color: colors.success,
  },

  centerCard: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  iconTile: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(122,31,43,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTitle: {
    fontFamily: 'tajawal',
    fontSize: 17,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'center',
  },
  introDesc: {
    fontFamily: 'tajawal',
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  lsResultTitle: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'center',
  },
  barsBox: {
    width: '100%',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  barRow: { gap: 5 },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barLabel: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'right',
  },
  barPct: { fontFamily: 'tajawal', fontSize: 12, fontWeight: '700' },
  barTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 4 },
  recsBox: { width: '100%', gap: 8 },
  recsTitle: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'right',
  },
  recCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  recText: {
    fontFamily: 'tajawal',
    fontSize: 12,
    color: colors.text,
    lineHeight: 20,
    textAlign: 'right',
  },

  quizHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    marginBottom: 12,
  },
  quizCounter: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.burgundy,
  },
  quizTag: {
    backgroundColor: 'rgba(122,31,43,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  quizTagText: {
    fontFamily: 'tajawal',
    fontSize: 10,
    fontWeight: '700',
    color: colors.burgundy,
  },
  quizQuestion: {
    fontFamily: 'tajawal',
    fontSize: 15,
    fontWeight: '700',
    color: colors.title,
    lineHeight: 24,
    textAlign: 'right',
    marginTop: 12,
    marginBottom: 10,
  },
  optBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
  },
  optText: {
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
  },
  optLetter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.letterBg,
    borderWidth: 1,
    borderColor: colors.letterBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optLetterText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },

  cycleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  cycleText: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.burgundy,
  },
  amberPill: {
    backgroundColor: colors.amberBg,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  amberPillText: {
    fontFamily: 'tajawal',
    fontSize: 10,
    fontWeight: '700',
    color: colors.amberText,
  },
  breathCircleWrap: { alignItems: 'center', marginVertical: 8 },
  breathCircle: {
    width: 190,
    height: 190,
    borderRadius: 95,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 4,
    borderColor: 'rgba(122,31,43,0.2)',
  },
  breathSecs: { fontSize: 40, fontWeight: '700', color: colors.white },
  breathPhase: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  doneBox: {
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: 16,
    padding: 14,
    width: '100%',
  },
  doneText: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
    textAlign: 'center',
    lineHeight: 20,
  },

  miniTabs: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    padding: 6,
    flexDirection: 'row',
    gap: 6,
  },
  miniTab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  miniTabActive: { backgroundColor: colors.burgundy },
  miniTabText: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.burgundy,
  },
  miniTabTextActive: { color: colors.white },

  gameTitle: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'center',
  },
  gameSub: {
    fontFamily: 'tajawal',
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  amberBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.explainBg,
    borderWidth: 1,
    borderColor: colors.explainBorder,
    borderRadius: 12,
    padding: 12,
  },
  amberBannerText: {
    flex: 1,
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.amberText,
  },
  amberTimer: { fontSize: 16, fontWeight: '700', color: colors.amberText },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  wordTile: {
    width: '48%',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  wordText: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.burgundy,
  },
  recallHint: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
    lineHeight: 20,
  },
  recallInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 14,
    fontFamily: 'tajawal',
    fontSize: 13,
    color: colors.title,
    minHeight: 130,
    textAlignVertical: 'top',
  },
  scoreBox: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  scoreLabel: {
    fontFamily: 'tajawal',
    fontSize: 11,
    color: colors.burgundyLight,
    fontWeight: '700',
  },
  scoreValue: {
    fontFamily: 'tajawal',
    fontSize: 30,
    fontWeight: '700',
    color: colors.burgundy,
  },
  scoreCols: { flexDirection: 'row', gap: 10 },
  scoreCol: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1, gap: 6 },
  scoreColGood: { backgroundColor: colors.successBg, borderColor: colors.successBorder },
  scoreColBad: { backgroundColor: colors.errorBg, borderColor: '#FECACA' },
  scoreColTitle: {
    fontFamily: 'tajawal',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  scoreColText: {
    fontFamily: 'tajawal',
    fontSize: 12,
    textAlign: 'right',
    lineHeight: 19,
  },

  palaceTitle: {
    fontFamily: 'tajawal',
    fontSize: 14,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'right',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
    marginBottom: 10,
  },
  palaceSub: {
    fontFamily: 'tajawal',
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: 10,
    lineHeight: 19,
  },
  palaceStep: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  palaceStepTitle: {
    fontFamily: 'tajawal',
    fontSize: 13,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'right',
  },
  palaceStepDesc: {
    fontFamily: 'tajawal',
    fontSize: 12,
    color: colors.text,
    lineHeight: 20,
    textAlign: 'right',
  },
  amberExample: {
    backgroundColor: colors.explainBg,
    borderWidth: 1,
    borderColor: colors.explainBorder,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  amberExampleTitle: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.amberText,
    textAlign: 'right',
  },
  amberExampleText: {
    fontFamily: 'tajawal',
    fontSize: 12,
    color: colors.explainText,
    lineHeight: 21,
    textAlign: 'right',
  },

  addRow: { flexDirection: 'row', gap: 8 },
  addInput: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'tajawal',
    fontSize: 12,
    color: colors.title,
    textAlign: 'right',
  },
  addBtn: {
    backgroundColor: colors.burgundy,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  dueBanner: {
    marginTop: 10,
    backgroundColor: colors.amberBg,
    borderWidth: 1,
    borderColor: colors.explainBorder,
    borderRadius: 12,
    padding: 10,
  },
  dueBannerText: {
    fontFamily: 'tajawal',
    fontSize: 12,
    fontWeight: '700',
    color: colors.amberText,
    textAlign: 'center',
  },
  topicHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  topicHeadInner: { flex: 1, gap: 4 },
  topicTitle: {
    fontFamily: 'tajawal',
    fontSize: 13,
    fontWeight: '700',
    color: colors.burgundy,
    textAlign: 'right',
  },
  topicDate: {
    fontFamily: 'tajawal',
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'right',
  },
  delBtn: { padding: 4 },
  delBtnText: { fontSize: 16 },
  revGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  revTile: {
    width: '48%',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    gap: 4,
  },
  revTileDone: { backgroundColor: colors.successBg, borderColor: colors.successBorder },
  revTileDue: { borderColor: colors.amber, borderWidth: 1.5 },
  revTileLabel: {
    fontFamily: 'tajawal',
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  revTileLabelDone: { color: colors.success },
  revTileDate: {
    fontFamily: 'tajawal',
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
