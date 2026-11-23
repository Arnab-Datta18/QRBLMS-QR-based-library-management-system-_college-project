import React, { useState, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl, 
  Pressable,
  StatusBar,
  Modal,
  Animated
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, PlusJakartaSans_500Medium, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';

import { getDashboard, getCatalog } from '../api/client';
import { getStudentId } from '../api/auth';
import { HomeSkeleton, ErrorState, withMinimumDelay } from '../components/Skeleton';

const C = {
  primary: '#C81E27', tertiary: '#E0533C',
  navy: '#0B2C4D', navyDeep: '#071B31', neutral: '#111827',
  surface: '#EEF1FB', card: '#FFFFFF', mint: '#D9F5E8', mintText: '#0F7A4B',
};

// Normalized semester formatting helpers to eliminate duplicate "Semester" / "th Sem"
const formatSemester = (sem: any): string => {
  if (!sem && sem !== 0) return '';
  const str = String(sem).trim();
  const numMatch = str.match(/\d+/);
  if (numMatch) {
    const n = parseInt(numMatch[0], 10);
    const suffix = (n === 1) ? 'st' : (n === 2) ? 'nd' : (n === 3) ? 'rd' : 'th';
    return `${n}${suffix} Sem`;
  }
  return str.replace(/Semester/gi, 'Sem').trim();
};

const formatSemesterFull = (sem: any): string => {
  if (!sem && sem !== 0) return 'Semester';
  const str = String(sem).trim();
  const numMatch = str.match(/\d+/);
  if (numMatch) {
    const n = parseInt(numMatch[0], 10);
    const suffix = (n === 1) ? 'st' : (n === 2) ? 'nd' : (n === 3) ? 'rd' : 'th';
    return `${n}${suffix} Semester`;
  }
  if (/^semester/i.test(str)) return str;
  return `Semester ${str}`;
};

const Chip = ({ icon, label, filled, accent }: any) => (
  <View style={[s.chip, filled && { backgroundColor: 'rgba(255,255,255,0.16)' }, accent && { backgroundColor: C.tertiary }]}>
    <Ionicons name={icon as any} size={14} color="#fff" />
    <Text style={s.chipText}>{label}</Text>
  </View>
);

export default function Home({ navigation: propNav }: any) {
  const navigation = propNav || useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ PlusJakartaSans_500Medium, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [gatepassModalVisible, setGatepassModalVisible] = useState(false);

  // Styled Auto-Dismiss Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-16)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(toastOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(toastTranslateY, { toValue: -16, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setToastMessage(null);
    });
  }, [toastOpacity, toastTranslateY]);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(msg);
    Animated.parallel([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(toastTranslateY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    // Auto-dismiss after 2 seconds
    toastTimerRef.current = setTimeout(() => {
      hideToast();
    }, 2000);
  }, [hideToast, toastOpacity, toastTranslateY]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const studentId = await getStudentId();
      if (!studentId) {
        setError('No student identity found. Please log in.');
        return;
      }

      const [dashboardRes, catalogRes] = await withMinimumDelay(
        Promise.all([
          getDashboard(studentId),
          getCatalog(studentId)
        ]),
        2600
      );
      
      setData(dashboardRes);
      setCatalog(catalogRes?.books || []);
    } catch (err: any) {
      console.error('Home fetch error:', err);
      setError(err?.response?.data?.message || err?.message || 'Unable to connect to library servers. Please check your network.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // 1. Show skeleton while fonts are loading or during initial data load
  if (!fontsLoaded || (loading && !data)) {
    return <HomeSkeleton />;
  }

  // 2. Show error state with retry if data load failed
  if (error && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: C.surface, justifyContent: 'center' }}>
        <StatusBar barStyle="light-content" />
        <ErrorState
          title="Dashboard Offline"
          message={error}
          onRetry={fetchData}
        />
      </View>
    );
  }

  if (!data) {
    return <HomeSkeleton />;
  }

  // Calculate next due date string
  let nextDueDateText = 'No Dues';
  if (data.active_issues && data.active_issues.length > 0) {
    const sorted = [...data.active_issues].sort((a, b) => {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
    
    const nextDue = sorted[0];
    const today = new Date();
    const dueDate = new Date(nextDue.due_date);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (nextDue.is_overdue) {
      nextDueDateText = 'Overdue';
    } else if (diffDays === 0) {
      nextDueDateText = 'Today';
    } else if (diffDays === 1) {
      nextDueDateText = 'Tomorrow';
    } else {
      nextDueDateText = `${diffDays} Days`;
    }
  }

  const handleCopyId = async () => {
    if (data?.student_id) {
      await Clipboard.setStringAsync(data.student_id);
      showToast(`Student ID "${data.student_id}" copied to clipboard`);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <StatusBar barStyle="light-content" />

      {/* Styled Auto-Dismiss Toast Banner */}
      {toastMessage && (
        <Animated.View 
          style={[
            s.toastContainer, 
            { 
              top: Math.max(insets.top + 8, 48),
              opacity: toastOpacity, 
              transform: [{ translateY: toastTranslateY }] 
            }
          ]}
        >
          <Pressable style={s.toastBody} onPress={hideToast}>
            <View style={s.toastIconWrap}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.toastTitle}>ID Copied to Clipboard</Text>
              <Text style={s.toastSub} numberOfLines={1}>{toastMessage}</Text>
            </View>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </Animated.View>
      )}

      <ScrollView 
        contentContainerStyle={{ paddingBottom: 130 }} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchData} tintColor="#fff" />
        }
      >
        {/* Colourful header */}
        <LinearGradient colors={[C.navyDeep, C.navy, '#1B4A7A']} style={[s.header, { paddingTop: Math.max(insets.top + 16, 56) }]}>
          <View style={[s.blob, { width: 220, height: 220, top: -70, right: -60, backgroundColor: C.primary, opacity: 0.35 }]} />
          <View style={[s.blob, { width: 140, height: 140, top: 150, left: -50, backgroundColor: C.tertiary, opacity: 0.22 }]} />

          <View style={s.topRow}>
            <View>
              <Text style={s.brand}>TCEA Library</Text>
              <Text style={s.brandSub}>Home</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable 
                onPress={() => navigation.navigate('Notifications')}
                style={({ pressed }) => [s.roundBtn, pressed && { opacity: 0.8 }]}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
              >
                <Ionicons name="notifications-outline" size={20} color="#fff" />
                <View style={s.dot} />
              </Pressable>
              <Pressable 
                onPress={() => navigation.navigate('Profile')}
                style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.94 : 1 }] }]}
                accessibilityRole="button"
                accessibilityLabel="Go to Profile"
              >
                <LinearGradient colors={[C.tertiary, C.primary]} style={s.roundBtn}>
                  <Ionicons name="person" size={20} color="#fff" />
                </LinearGradient>
              </Pressable>
            </View>
          </View>

          <Text style={s.hello} adjustsFontSizeToFit numberOfLines={1}>
            Hello, {data.student_name || 'Student'}!
          </Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', gap: 8, paddingRight: 20 }}>
              <Chip icon="school-outline" label={data.course || 'Course'} filled />
              <Chip icon="laptop-outline" label={data.department || 'Dept'} filled />
              <Chip icon="calendar-outline" label={formatSemesterFull(data.semester)} accent />
            </View>
          </ScrollView>

          {/* Pass card with expansion affordance */}
          <LinearGradient colors={['#FFFFFF', '#F3F5FF']} style={s.pass}>
            <Pressable 
              onPress={() => setGatepassModalVisible(true)}
              style={({ pressed }) => [{ width: '100%', alignItems: 'center' }, pressed && { opacity: 0.92 }]}
              accessibilityRole="button"
              accessibilityLabel="Tap to expand Digital Library Pass"
            >
              <View style={s.passHead}>
                <View style={s.passIcon}><Ionicons name="id-card-outline" size={20} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.passTitle}>TCEA Digital Library Pass</Text>
                  <Text style={s.passSub}>Verified institutional gatepass</Text>
                </View>
                <View style={s.active}><Text style={s.activeText}>Active</Text></View>
              </View>

              <LinearGradient colors={[C.primary, C.tertiary, C.navy]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.qrFrame}>
                <View style={s.qrInner}>
                  <QRCode value={data.qr_payload || data.student_id || 'INVALID'} size={150} color={C.neutral} backgroundColor="#fff" />
                </View>
              </LinearGradient>
            </Pressable>

            {/* Independent one-tap Student ID copy button */}
            <Pressable 
              style={({ pressed }) => [s.idPill, pressed && { opacity: 0.7 }]} 
              onPress={handleCopyId}
              accessibilityRole="button"
              accessibilityLabel="Copy Student ID"
            >
              <Text style={s.idText}>{data.student_id}</Text>
              <Ionicons name="copy-outline" size={16} color={C.navy} />
            </Pressable>

            <Pressable 
              onPress={() => setGatepassModalVisible(true)}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Text style={s.hint}>Tap to expand or scan at library terminal</Text>
            </Pressable>
          </LinearGradient>
        </LinearGradient>

        {/* Dynamic Stats Row */}
        <View style={s.statsRow}>
          <View style={[s.stat, { backgroundColor: '#FEE2E2' }]}>
            <View style={[s.statIcon, { backgroundColor: '#FECACA' }]}>
              <Ionicons name="book" size={20} color={C.primary} />
            </View>
            <View>
              <Text style={s.statBig}>{(data.active_issues || []).length} / 4</Text>
              <Text style={s.statSmall}>Active loans</Text>
            </View>
          </View>
          
          <View style={[s.stat, { backgroundColor: '#E0E7FF' }]}>
            <View style={[s.statIcon, { backgroundColor: '#C7D2FE' }]}>
              <Ionicons name="hourglass" size={20} color={C.navy} />
            </View>
            <View>
              <Text style={[s.statBig, nextDueDateText === 'Overdue' && { color: C.primary }]}>
                {nextDueDateText}
              </Text>
              <Text style={s.statSmall}>Next due date</Text>
            </View>
          </View>
        </View>

        {/* Dynamic Books Section */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Available books for you</Text>
          <View style={s.count}><Text style={s.countText}>{catalog.length}</Text></View>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => navigation.navigate('Borrowed')} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <Text style={s.viewAll}>View all</Text>
          </Pressable>
        </View>

        {catalog.length === 0 ? (
          <Text style={{ textAlign: 'center', fontFamily: 'PlusJakartaSans_500Medium', color: '#6B7280', marginTop: 20 }}>
            No books available for your course currently.
          </Text>
        ) : (
          catalog.slice(0, 5).map((book, index) => {
            const isAvailable = book.is_in_stock;
            const spineColors = [C.primary, '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
            const spineColor = spineColors[index % spineColors.length];
            
            return (
              <View key={book.book_id} style={[s.book, !isAvailable && { opacity: 0.6 }]}>
                <View style={[s.spine, { backgroundColor: spineColor }]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={s.bookTop}>
                    <View style={s.tag}>
                      <Text style={s.tagText} numberOfLines={1} ellipsizeMode="tail">
                        {data.department} • {formatSemester(data.semester)}
                      </Text>
                    </View>
                    <View style={[s.avail, !isAvailable && { backgroundColor: '#F3F4F6' }]}>
                      <Text style={[s.availText, !isAvailable && { color: '#6B7280' }]}>
                        {isAvailable ? 'Available' : 'Unavailable'}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={s.bookTitle} numberOfLines={2}>{book.title}</Text>
                  <Text style={s.author} numberOfLines={1} ellipsizeMode="tail">{book.author}</Text>
                  
                  {/* Informational book footer */}
                  <View style={s.bookBottom}>
                    <Text style={s.ref} numberOfLines={1}>Ref: {book.book_id}</Text>
                    <View style={[s.infoBadge, isAvailable ? { backgroundColor: '#E8F5E9' } : { backgroundColor: '#F3F4F6' }]}>
                      <Ionicons 
                        name={isAvailable ? "checkmark-circle" : "close-circle"} 
                        size={13} 
                        color={isAvailable ? C.mintText : '#6B7280'} 
                      />
                      <Text style={[s.infoBadgeText, isAvailable ? { color: C.mintText } : { color: '#6B7280' }]}>
                        {isAvailable ? 'In Stack' : 'Checked Out'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Expanded High-Brightness Gatepass Modal */}
      <Modal
        visible={gatepassModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGatepassModalVisible(false)}
        statusBarTranslucent
      >
        <View style={s.gatepassOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setGatepassModalVisible(false)} />
          <View style={s.gatepassCard}>
            <View style={s.gatepassTop}>
              <View style={s.passIcon}>
                <Ionicons name="id-card-outline" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.gatepassTitle}>TCEA Digital Library Pass</Text>
                <Text style={s.gatepassSub}>Verified Institutional Gatepass</Text>
              </View>
              <Pressable 
                onPress={() => setGatepassModalVisible(false)} 
                style={({ pressed }) => [s.gatepassCloseBtn, pressed && { opacity: 0.7 }]}
                hitSlop={10}
              >
                <Ionicons name="close" size={22} color={C.neutral} />
              </Pressable>
            </View>

            <View style={s.gatepassStudentInfo}>
              <Text style={s.gatepassName}>{data?.student_name || 'Student'}</Text>
              <Text style={s.gatepassId}>ID: {data?.student_id}</Text>
              <View style={s.gatepassBadges}>
                <View style={s.gatepassBadge}>
                  <Text style={s.gatepassBadgeText}>{data?.course || 'Course'}</Text>
                </View>
                <View style={s.gatepassBadge}>
                  <Text style={s.gatepassBadgeText}>{data?.department || 'Dept'}</Text>
                </View>
                <View style={[s.gatepassBadge, { backgroundColor: C.mint }]}>
                  <Text style={[s.gatepassBadgeText, { color: C.mintText }]}>{formatSemester(data?.semester)}</Text>
                </View>
              </View>
            </View>

            {/* High-Contrast Large QR Container */}
            <View style={s.gatepassQrContainer}>
              <View style={s.gatepassQrInner}>
                <QRCode 
                  value={data?.qr_payload || data?.student_id || 'INVALID'} 
                  size={220} 
                  color="#000000" 
                  backgroundColor="#FFFFFF" 
                />
              </View>
              <View style={s.highBrightnessPill}>
                <Ionicons name="sunny-outline" size={14} color="#D97706" />
                <Text style={s.highBrightnessText}>High-Contrast Gatepass QR</Text>
              </View>
            </View>

            <Text style={s.gatepassFooterHint}>
              Present this high-brightness QR code directly under the library entrance turnstile or scanner terminal.
            </Text>

            <Pressable 
              style={({ pressed }) => [s.gatepassDoneBtn, pressed && { opacity: 0.9 }]}
              onPress={() => setGatepassModalVisible(false)}
            >
              <Text style={s.gatepassDoneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const shadow = { shadowColor: '#0B2C4D', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 };
const s = StyleSheet.create({
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 28, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, color: '#fff' },
  brandSub: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#FFB3A8' },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: C.tertiary, borderWidth: 1.5, borderColor: C.navy },
  hello: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 30, color: '#fff', marginTop: 22, letterSpacing: -0.5 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  chipText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#fff' },
  pass: { borderRadius: 28, padding: 18, alignItems: 'center', ...shadow },
  passHead: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' },
  passIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' },
  passTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: C.neutral },
  passSub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11.5, color: '#6B7280' },
  active: { backgroundColor: C.mint, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  activeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: C.mintText },
  qrFrame: { marginTop: 16, padding: 5, borderRadius: 26 },
  qrInner: { backgroundColor: '#fff', padding: 16, borderRadius: 22 },
  idPill: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, backgroundColor: '#E6EAF8', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  idText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, letterSpacing: 1.5, color: C.navy },
  hint: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12.5, color: '#6B7280', marginTop: 8 },
  statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 20 },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 22 },
  statIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statBig: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 19, color: C.neutral },
  statSmall: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#4B5563' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginTop: 26, marginBottom: 12 },
  sectionTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 19, color: C.neutral },
  count: { backgroundColor: C.navy, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  countText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#fff' },
  viewAll: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.primary },
  book: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 14, backgroundColor: C.card, borderRadius: 22, overflow: 'hidden', ...shadow, shadowOpacity: 0.08 },
  spine: { width: 7 },
  bookTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, paddingHorizontal: 14, gap: 8 },
  tag: { flexShrink: 1, backgroundColor: '#E6EAF8', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: C.navy },
  avail: { flexShrink: 0, backgroundColor: C.mint, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  availText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: C.mintText },
  bookTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16.5, lineHeight: 22, color: C.neutral, marginTop: 8, paddingHorizontal: 14 },
  author: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#6B7280', paddingHorizontal: 14, marginTop: 2 },
  bookBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, paddingTop: 10, gap: 8 },
  ref: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#6B7280', flexShrink: 1 },
  infoBadge: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  infoBadgeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5 },
  gatepassOverlay: { flex: 1, backgroundColor: 'rgba(7, 27, 49, 0.78)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  gatepassCard: { backgroundColor: '#FFFFFF', borderRadius: 32, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center', ...shadow, shadowRadius: 30 },
  gatepassTop: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', marginBottom: 16 },
  gatepassTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, color: C.neutral },
  gatepassSub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11.5, color: '#6B7280' },
  gatepassCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  gatepassStudentInfo: { alignItems: 'center', width: '100%', marginBottom: 16 },
  gatepassName: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, color: C.neutral, textAlign: 'center' },
  gatepassId: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.navy, letterSpacing: 1, marginTop: 2 },
  gatepassBadges: { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' },
  gatepassBadge: { backgroundColor: '#E6EAF8', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  gatepassBadgeText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: C.navy },
  gatepassQrContainer: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 24, borderWidth: 2, borderColor: '#EEF1FB', alignItems: 'center', ...shadow, shadowOpacity: 0.06 },
  gatepassQrInner: { padding: 8, backgroundColor: '#FFFFFF', borderRadius: 16 },
  highBrightnessPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFBEB', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, marginTop: 10 },
  highBrightnessText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: '#D97706' },
  gatepassFooterHint: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 16, lineHeight: 18, paddingHorizontal: 10 },
  gatepassDoneBtn: { backgroundColor: C.navy, paddingVertical: 14, borderRadius: 999, width: '100%', alignItems: 'center', marginTop: 18 },
  gatepassDoneText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#FFFFFF' },

  /* Toast Styles */
  toastContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: 'center',
    shadowColor: '#071B31',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  toastBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#071B31',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
  },
  toastIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13.5,
    color: '#FFFFFF',
  },
  toastSub: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#C9D6E8',
    marginTop: 1,
  },
});
