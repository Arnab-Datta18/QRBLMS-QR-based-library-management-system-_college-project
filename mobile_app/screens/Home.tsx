import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator, 
  RefreshControl, 
  Pressable,
  Alert,
  StatusBar
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

const C = {
  primary: '#C81E27', tertiary: '#E0533C',
  navy: '#0B2C4D', navyDeep: '#071B31', neutral: '#111827',
  surface: '#EEF1FB', card: '#FFFFFF', mint: '#D9F5E8', mintText: '#0F7A4B',
};

const Chip = ({ icon, label, filled, accent }: any) => (
  <View style={[s.chip, filled && { backgroundColor: 'rgba(255,255,255,0.16)' }, accent && { backgroundColor: C.tertiary }]}>
    <Ionicons name={icon as any} size={14} color="#fff" />
    <Text style={s.chipText}>{label}</Text>
  </View>
);

const GradientButton = ({ label, onPress, disabled }: any) => (
  <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [{ transform: [{ scale: pressed && !disabled ? 0.96 : 1 }], opacity: disabled ? 0.6 : 1 }]}>
    <LinearGradient colors={disabled ? ['#E2E8F0', '#E2E8F0'] : [C.tertiary, C.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.btn}>
      <Ionicons name="bookmark" size={15} color={disabled ? '#94A3B8' : '#fff'} />
      <Text style={[s.btnText, disabled && { color: '#94A3B8' }]}>{label}</Text>
    </LinearGradient>
  </Pressable>
);

export default function Home({ navigation: propNav }: any) {
  const navigation = propNav || useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ PlusJakartaSans_500Medium, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [catalog, setCatalog] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const studentId = await getStudentId();
      if (!studentId) return;

      const [dashboardRes, catalogRes] = await Promise.all([
        getDashboard(studentId),
        getCatalog(studentId)
      ]);
      
      setData(dashboardRes);
      setCatalog(catalogRes.books || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  if (!fontsLoaded || (loading && !data)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.surface }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.surface }}>
        <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', color: C.neutral }}>Error loading dashboard.</Text>
      </View>
    );
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
      Alert.alert('Success', 'ID Copied to Clipboard');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <StatusBar barStyle="light-content" />
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
              <Chip icon="calendar-outline" label={`Semester ${data.semester || 'N'}`} accent />
            </View>
          </ScrollView>

          {/* Pass card */}
          <LinearGradient colors={['#FFFFFF', '#F3F5FF']} style={s.pass}>
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

            <Pressable style={({ pressed }) => [s.idPill, pressed && { opacity: 0.7 }]} onPress={handleCopyId}>
              <Text style={s.idText}>{data.student_id}</Text>
              <Ionicons name="copy-outline" size={16} color={C.navy} />
            </Pressable>
            <Text style={s.hint}>Tap to expand or scan at library terminal</Text>
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

        {/* Dynamic Books Mapping */}
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
            // Cycle through vibrant colors for the spine
            const spineColors = [C.primary, '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
            const spineColor = spineColors[index % spineColors.length];
            
            return (
              <View key={book.book_id} style={[s.book, !isAvailable && { opacity: 0.6 }]}>
                <View style={[s.spine, { backgroundColor: spineColor }]} />
                <View style={{ flex: 1 }}>
                  <View style={s.bookTop}>
                    <View style={s.tag}><Text style={[s.tag, { paddingHorizontal: 0, paddingVertical: 0 }]}>{data.department} / {data.semester}th Sem</Text></View>
                    <View style={[s.avail, !isAvailable && { backgroundColor: '#F3F4F6' }]}>
                      <Text style={[s.availText, !isAvailable && { color: '#6B7280' }]}>
                        {isAvailable ? 'Available' : 'Unavailable'}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={s.bookTitle} numberOfLines={1}>{book.title}</Text>
                  <Text style={s.author} numberOfLines={1}>{book.author}</Text>
                  
                  <View style={s.bookBottom}>
                    <Text style={s.ref}>Ref: {book.book_id}</Text>
                    <GradientButton 
                      label="Reserve" 
                      disabled={!isAvailable}
                    />
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
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
  book: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 12, backgroundColor: C.card, borderRadius: 22, overflow: 'hidden', ...shadow, shadowOpacity: 0.08 },
  spine: { width: 8 },
  bookTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, paddingHorizontal: 14 },
  tag: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: C.navy, backgroundColor: '#E6EAF8', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  avail: { backgroundColor: C.mint, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  availText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: C.mintText },
  bookTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, color: C.neutral, marginTop: 10, paddingHorizontal: 14 },
  author: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#6B7280', paddingHorizontal: 14, marginTop: 2 },
  bookBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, paddingTop: 12 },
  ref: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: '#6B7280' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, shadowColor: C.primary, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  btnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13.5, color: '#fff' },
});
