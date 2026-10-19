// الصدارة — المحتوى الحقيقي (مرجعية AI Studio: App.tsx شاشة leaderboard)
// بطاقة المستوى الشخصية + قائمة الصدارة من Firestore (مجموعة users مرتبة بـ XP)
import React, { useCallback, useState , useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AlertTriangle, RefreshCw, Trophy } from 'lucide-react-native';
import AppHeader from '../../components/AppHeader';
import LockScreen from '../../components/LockScreen';
import ListSkeleton from '../../components/ListSkeleton';
import { getAuth } from '../../auth/auth';
import { getProfile } from '../../gamification/profile';
import {
  UNIVERSITIES,
  getMyUniversity,
  normalizeUniversity,
} from '../../universities';
import { APP, FIREBASE } from '../../config';
import { canAccessTab } from '../../payment/gates';
import { getAuthHeaders, isAuthError } from '../../activation/codes';
import { shadows, useTheme, type ThemeColors } from '../../theme';
import { bidi, rtlTextStyle } from '../../utils/bidi';
import { formatNumber } from '../../utils/numbers';

type LeaderboardUser = {
  uid: string;
  name: string;
  email: string;
  totalXP: number;
  level: number;
  university: string;
};

type UniversityRow = {
  name: string;
  totalXP: number;
  members: number;
  avgXP: number;
};

/** تجميع المستخدمين حسب الجامعة — كل الجامعات المعتمدة تظهر حتى بصفر أعضاء */
function aggregateUniversities(users: LeaderboardUser[]): UniversityRow[] {
  const map = new Map<string, { xp: number; members: number }>();
  for (const u of users) {
    const key = u.university || 'أخرى';
    const cur = map.get(key) ?? { xp: 0, members: 0 };
    cur.xp += u.totalXP;
    cur.members += 1;
    map.set(key, cur);
  }
  for (const name of UNIVERSITIES) {
    if (!map.has(name)) map.set(name, { xp: 0, members: 0 });
  }
  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      totalXP: v.xp,
      members: v.members,
      avgXP: v.members > 0 ? Math.round(v.xp / v.members) : 0,
    }))
    .sort((a, b) => b.totalXP - a.totalXP);
}

function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}

// ─── جلب الصدارة ───
// المصدر: Cloudflare Worker (watani-api) — Firestore مهجورة
// GET https://watani-api.drbasharmohammad.workers.dev/v1/leaderboard
// يُرجع: { total, entries: [{ rank, email, name, university, points }] }
const WATANI_API = 'https://watani-api.drbasharmohammad.workers.dev';

async function fetchLeaderboard(): Promise<LeaderboardUser[]> {
  // يرمي NOT_AUTHENTICATED إن لم يكن هناك دخول Google فعلي
  const headers = await getAuthHeaders();
  const url = `${WATANI_API}/v1/leaderboard?limit=50`;
  const res = await fetch(url, { headers });
  if (res.status === 401 || res.status === 403) throw new Error('FORBIDDEN');
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = (await res.json()) as any;
  const entries: any[] = data.entries ?? [];
  const adminEmail = APP.adminEmail.toLowerCase();

  const users: LeaderboardUser[] = entries.map((e) => {
    const xp = typeof e.points === 'number' ? e.points : 0;
    return {
      uid: String(e.email || ''),
      name: String(e.name || '') || 'طالب الطب البشري',
      email: String(e.email || ''),
      totalXP: xp,
      level: levelForXp(xp),
      university: normalizeUniversity(String(e.university || '')),
    };
  });

  return users
    .filter((u) => u.totalXP > 0 && u.email.toLowerCase() !== adminEmail)
    .sort((a, b) => b.totalXP - a.totalXP)
    .slice(0, 50);
}

function rankBadge(rank: number): { emoji: string; label: string } {
  if (rank === 1) return { emoji: '🥇', label: '1' };
  if (rank === 2) return { emoji: '🥈', label: '2' };
  if (rank === 3) return { emoji: '🥉', label: '3' };
  return { emoji: '', label: `#${rank}` };
}

export default function LeaderboardTab() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const [list, setList] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // غياب دخول Google الفعلي → حالة فارغة أنيقة بدل الفشل الصامت
  const [authNeeded, setAuthNeeded] = useState(false);
  const [myEmail, setMyEmail] = useState('');
  const [myName, setMyName] = useState('');
  const [myUniversity, setMyUniversity] = useState('');
  const [mode, setMode] = useState<'individuals' | 'universities'>('individuals');
  // بياناتي المحلية كاحتياط (إن لم أظهر في قائمة Firestore بعد)
  const [localXp, setLocalXp] = useState(0);
  const [localLevel, setLocalLevel] = useState(1);
  // بوابة القسم: الصدارة مقفلة لغير المفعّلين (مثل ChallengeTab/ProgressTab)
  const [open, setOpen] = useState(true);
  const [gateReason, setGateReason] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setAuthNeeded(false);
    try {
      const users = await fetchLeaderboard();
      setList(users);
    } catch (e: any) {
      if (isAuthError(e)) {
        // لا يوجد دخول Google فعلي (انتهت الجلسة) — حالة فارغة أنيقة بزر تسجيل دخول
        setAuthNeeded(true);
        setList([]);
      } else if (e instanceof Error && e.message === 'FORBIDDEN') {
        setError('لا تملك صلاحية عرض الصدارة — سجّل الدخول بحساب Google وحاول مجددًا');
      } else {
        setError('تعذر تحميل قائمة الصدارة — تحقق من الاتصال وحاول مجددًا');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const gate = canAccessTab('leaderboard');
      setOpen(gate.open);
      setGateReason(gate.reason || '');
      if (!gate.open) return;
      const a = getAuth();
      if (a.type === 'user') {
        setMyEmail(a.email.toLowerCase());
        setMyName(a.name || a.email);
      } else {
        setMyEmail('');
        setMyName('');
      }
      getProfile().then((p) => {
        setLocalXp(p.totalXP);
        setLocalLevel(p.level);
      }).catch(() => {});
      setMyUniversity(getMyUniversity());
      load();
    }, [load]),
  );

  const uniRows = useMemo(() => aggregateUniversities(list), [list]);
  const myUniRank = myUniversity
    ? uniRows.findIndex((r) => r.name === myUniversity)
    : -1;
  const myUniEntry = myUniRank >= 0 ? uniRows[myUniRank] : null;

  const myRank = list.findIndex((u) => u.email.toLowerCase() === myEmail);
  const myEntry = myRank >= 0 ? list[myRank] : null;
  // الأولوية لبيانات Firestore، والاحتياط للبيانات المحلية
  const myXp = myEntry?.totalXP ?? localXp;
  const myLevel = myEntry?.level ?? localLevel;
  const baseLvlXp = Math.pow(myLevel - 1, 2) * 100;
  const nextLvlXp = Math.pow(myLevel, 2) * 100;
  const neededXp = Math.max(0, nextLvlXp - myXp);
  const pct = Math.min(
    100,
    Math.max(0, Math.round(((myXp - baseLvlXp) / Math.max(1, nextLvlXp - baseLvlXp)) * 100)),
  );

  // بوابة القسم: غير المفعّلين يرون شاشة القفل بدل المحتوى (B3)
  if (!open) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader />
        <LockScreen message={gateReason || 'يتطلب التفعيل'} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
        }>
        {/* بطاقة المستوى الشخصية */}
        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroIdRow}>
              <View>
                <Text style={styles.heroTitle}>
                  {bidi(
                    mode === 'universities'
                      ? myUniversity
                        ? `جامعة ${myUniversity}`
                        : 'صدارة الجامعات'
                      : myName
                        ? `د. ${myName}`
                        : 'قائمة الصدارة والتفوق',
                  )}
                </Text>
                <Text style={styles.heroSub}>
                  {bidi(
                    mode === 'universities'
                      ? myUniEntry
                        ? `مجموع الجامعة: ${formatNumber(myUniEntry.totalXP)} XP • ${formatNumber(myUniEntry.members)} ${myUniEntry.members === 1 ? 'طالب' : myUniEntry.members === 2 ? 'طالبان' : 'طلاب'}`
                        : 'نقاط طلاب كل جامعة مجمّعة'
                      : `مجموع نقاط المران: ${myXp} XP`,
                  )}
                </Text>
              </View>
              <View style={styles.trophyWrap}>
                <Text style={styles.trophyEmoji}>🏆</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => load(true)}
              activeOpacity={0.7}>
              <RefreshCw size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
          <View style={styles.levelRow}>
            <Text style={styles.levelText}>
              {bidi(`المستوى ${formatNumber(myLevel)} (${formatNumber(myXp)} XP)`)}
            </Text>
            <Text style={styles.levelText}>
              {bidi(`متبقي ${formatNumber(neededXp)} XP للمستوى ${formatNumber(myLevel + 1)}`)}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          {mode === 'universities'
            ? myUniRank >= 0 && (
                <Text style={styles.rankText}>
                  {`ترتيب جامعتك الحالي: #${formatNumber(myUniRank + 1)} من ${formatNumber(uniRows.length)}`}
                </Text>
              )
            : myRank >= 0 && (
                <Text style={styles.rankText}>
                  {`ترتيبك الحالي: #${formatNumber(myRank + 1)} من ${formatNumber(list.length)}`}
                </Text>
              )}
        </View>

        {/* مفتاح التبديل: الأفراد / الجامعات */}
        <View style={styles.toggleWrap}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'individuals' && styles.toggleBtnActive]}
            onPress={() => setMode('individuals')}
            activeOpacity={0.8}>
            <Text
              style={[
                styles.toggleText,
                mode === 'individuals' && styles.toggleTextActive,
              ]}>
              {'الأفراد'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'universities' && styles.toggleBtnActive]}
            onPress={() => setMode('universities')}
            activeOpacity={0.8}>
            <Text
              style={[
                styles.toggleText,
                mode === 'universities' && styles.toggleTextActive,
              ]}>
              {'الجامعات'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* قائمة الصدارة */}
        {loading ? (
          <ListSkeleton count={8} withBadge />
        ) : authNeeded ? (
          <View style={styles.emptyCard}>
            <Trophy size={40} color={colors.burgundyLight} />
            <Text style={styles.emptyTitle}>{'سجّل الدخول بحساب Google لعرض الصدارة'}</Text>
            <Text style={styles.emptySub}>
              {'انتهت جلسة الدخول — سجّل الدخول مجددًا لعرض نقاط الطلاب وترتيبك'}
            </Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => navigation.navigate('Activation')}
              activeOpacity={0.85}>
              <Text style={styles.retryBtnText}>{'تسجيل الدخول'}</Text>
            </TouchableOpacity>
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <AlertTriangle size={32} color={colors.error} />
            <Text style={styles.errorText}>{bidi(error)}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => load()}
              activeOpacity={0.85}>
              <Text style={styles.retryBtnText}>{'إعادة المحاولة'}</Text>
            </TouchableOpacity>
          </View>
        ) : mode === 'universities' ? (
          <>
            {!myUniversity && (
              <TouchableOpacity
                style={styles.uniPrompt}
                onPress={() => navigation.navigate('Profile')}
                activeOpacity={0.85}>
                <Text style={styles.uniPromptText}>
                  {'حدد جامعتك من الملف الشخصي لتظهر في صدارة الجامعات'}
                </Text>
              </TouchableOpacity>
            )}
            <View style={styles.listWrap}>
              {uniRows.map((r, idx) => {
                const rank = idx + 1;
                const badge = rankBadge(rank);
                const isMine = myUniversity !== '' && r.name === myUniversity;
                return (
                  <View
                    key={r.name}
                    style={[styles.row, isMine && styles.rowMe]}>
                    <View style={styles.rankBadge}>
                      {badge.emoji ? (
                        <Text style={styles.rankEmoji}>{badge.emoji}</Text>
                      ) : null}
                      <Text style={styles.rankLabel}>{badge.label}</Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {bidi(isMine ? `جامعة ${r.name} (جامعتك)` : `جامعة ${r.name}`)}
                      </Text>
                      <Text style={styles.userLevel}>
                        {bidi(
                          r.members > 0
                            ? `${formatNumber(r.members)} ${r.members === 1 ? 'طالب' : r.members === 2 ? 'طالبان' : 'طلاب'} • متوسط ${formatNumber(r.avgXP)} XP`
                            : 'لا يوجد طلاب بعد',
                        )}
                      </Text>
                    </View>
                    <View style={styles.xpPill}>
                      <Text style={styles.xpText}>{`${r.totalXP} XP`}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : list.length === 0 ? (
          <View style={styles.emptyCard}>
            <Trophy size={40} color={colors.burgundyLight} />
            <Text style={styles.emptyTitle}>{'لا توجد بيانات صدارة بعد'}</Text>
            <Text style={styles.emptySub}>
              {'اجمع النقاط وحلّ التحديات لتظهر في صدارة طلاب الطب!'}
            </Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => navigation.navigate('ChallengeTab')}
              activeOpacity={0.85}>
              <Text style={styles.retryBtnText}>{'ابدأ التحدي اليومي'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listWrap}>
            {list.map((u, idx) => {
              const rank = idx + 1;
              const badge = rankBadge(rank);
              const isMe = u.email.toLowerCase() === myEmail;
              return (
                <View
                  key={u.uid || `${idx}`}
                  style={[styles.row, isMe && styles.rowMe]}>
                  <View style={styles.rankBadge}>
                    {badge.emoji ? (
                      <Text style={styles.rankEmoji}>{badge.emoji}</Text>
                    ) : null}
                    <Text style={styles.rankLabel}>{badge.label}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {bidi(isMe ? `${u.name} (أنت)` : u.name)}
                    </Text>
                    <Text style={styles.userLevel}>
                      {`المستوى ${formatNumber(u.level)}`}
                    </Text>
                  </View>
                  <View style={styles.xpPill}>
                    <Text style={styles.xpText}>{`${u.totalXP} XP`}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  heroCard: {
    backgroundColor: colors.burgundy,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.burgundy,
    ...shadows.card,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroIdRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  trophyWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyEmoji: { fontSize: 24 },
  heroTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    ...rtlTextStyle,
    textAlign: 'right',
  },
  heroSub: {
    fontSize: 11,
    color: colors.explainBorder,
    marginTop: 2,
    ...rtlTextStyle,
    textAlign: 'right',
  },
  refreshBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FEF3C7',
    ...rtlTextStyle,
    textAlign: 'right',
  },
  progressTrack: {
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 999,
    marginTop: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.amber,
    borderRadius: 999,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.explainBorder,
    marginTop: 10,
    ...rtlTextStyle,
    textAlign: 'right',
  },
  toggleWrap: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: colors.burgundy,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    ...rtlTextStyle,
  },
  toggleTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  uniPrompt: {
    backgroundColor: colors.optionSelectedBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.burgundy,
    alignItems: 'center',
  },
  uniPromptText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.burgundy,
    ...rtlTextStyle,
    textAlign: 'center',
  },
  centerBox: { alignItems: 'center', padding: 32, gap: 12 },
  mutedText: {
    fontSize: 12,
    color: colors.textSecondary,
    ...rtlTextStyle,
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    ...rtlTextStyle,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: colors.burgundy,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryBtnText: { fontSize: 12, fontWeight: '700', color: colors.white },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.title,
    ...rtlTextStyle,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 20,
    ...rtlTextStyle,
    textAlign: 'center',
  },
  listWrap: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    ...shadows.card,
  },
  rowMe: {
    borderColor: colors.burgundy,
    borderWidth: 2,
    backgroundColor: colors.optionSelectedBg,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 48,
  },
  rankEmoji: { fontSize: 20 },
  rankLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  userInfo: { flex: 1, alignItems: 'flex-end' },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.title,
    ...rtlTextStyle,
    textAlign: 'right',
  },
  userLevel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    ...rtlTextStyle,
    textAlign: 'right',
  },
  xpPill: {
    backgroundColor: colors.bg,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.borderBurgundy,
  },
  xpText: { fontSize: 11, fontWeight: '700', color: colors.burgundy },
});
