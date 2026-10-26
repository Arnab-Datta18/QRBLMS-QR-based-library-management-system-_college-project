import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, StatusBar, ActivityIndicator, RefreshControl, Alert, Modal } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useFonts, PlusJakartaSans_500Medium, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';

import { getDashboard, getHistory } from '../api/client';
import { getStudentId } from '../api/auth';

const C = {
  primary: '#C81E27', tertiary: '#E0533C', navy: '#0B2C4D', navyDeep: '#071B31',
  neutral: '#111827', surface: '#EEF1FB', pale: '#E6EAF8', muted: '#6B7280',
  mint: '#D9F5E8', mintText: '#0F7A4B', green: '#10B981', redTint: '#FDE7E4',
};

const Stat = ({ label, value, unit, color, bg }: any) => (
  <View style={[s.stat, { backgroundColor: bg }]}>
    <Text style={[s.statLabel, color && { color }]}>{label}</Text>
    <Text style={s.statRow}><Text style={[s.statNum, color && { color }]}>{value}</Text><Text style={s.statUnit}> {unit}</Text></Text>
  </View>
);

const DateBox = ({ issued, due, dueRed }: any) => (
  <View style={s.dateBox}>
    <View>
      <Text style={s.dLabel}>Issued date</Text>
      <Text style={s.dVal}>{issued}</Text>
    </View>
    <View>
      <Text style={s.dLabel}>Due date</Text>
      <Text style={[s.dVal, dueRed && { color: C.primary }]}>{due}</Text>
    </View>
  </View>
);

const Pill = ({ children, bg, color, dot }: any) => (
  <View style={[s.pill, { backgroundColor: bg }]}>
    {dot && <View style={[s.pillDot, { backgroundColor: color }]} />}
    <Text style={[s.pillText, { color }]}>{children}</Text>
  </View>
);

export default function BorrowedScreen({ navigation: propNav }: any) {
  const navigation = propNav || useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [loaded] = useFonts({ PlusJakartaSans_500Medium, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  
  const [loading, setLoading] = useState(true);
  const [activeIssues, setActiveIssues] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrData, setQrData] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const studentId = await getStudentId();
      if (!studentId) return;

      const [dashboardRes, historyRes] = await Promise.all([
        getDashboard(studentId),
        getHistory(studentId)
      ]);
      
      setActiveIssues(dashboardRes.active_issues || []);
      setHistory(historyRes.history || []);
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

  const handleRenew = (bookId: string) => {
    Alert.alert('Renew Loan', `API handler for renewing book ${bookId} not implemented yet.`);
  };

  const handleClearFine = (bookId: string) => {
    Alert.alert('Clear Fine', `API handler for clearing fine on book ${bookId} not implemented yet.`);
  };

  const handleQR = (qrString: string) => {
    setQrData(qrString || '');
    setQrModalVisible(true);
  };

  if (!loaded) return null;

  const activeLoans = activeIssues.filter(item => !item.is_overdue);
  const overdueLoans = activeIssues.filter(item => item.is_overdue);

  const calculateDaysLate = (dueDateStr: string) => {
    if (!dueDateStr) return 1;
    const due = new Date(dueDateStr);
    const today = new Date();
    const diffTime = today.getTime() - due.getTime();
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const calculateDaysLeft = (dueDateStr: string) => {
    if (!dueDateStr) return 0;
    const due = new Date(dueDateStr);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const calculateProgress = (issueDateStr: string, dueDateStr: string) => {
    if (!issueDateStr || !dueDateStr) return 50;
    const issue = new Date(issueDateStr).getTime();
    const due = new Date(dueDateStr).getTime();
    const today = new Date().getTime();
    
    if (today >= due) return 100;
    if (today <= issue) return 0;
    
    return ((today - issue) / (due - issue)) * 100;
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <StatusBar barStyle="light-content" />
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 130 }} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} tintColor="#fff" />}
      >
        {/* Colourful header */}
        <LinearGradient colors={[C.navyDeep, C.navy, '#1B4A7A']} style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View style={[s.blob, { width: 220, height: 220, top: -70, right: -60, backgroundColor: C.primary, opacity: 0.35 }]} />
          <View style={[s.blob, { width: 140, height: 140, bottom: 10, left: -50, backgroundColor: C.tertiary, opacity: 0.22 }]} />

          <View style={s.topRow}>
            <View>
              <Text style={s.brand}>TCEA Library</Text>
              <Text style={s.brandSub}>Borrowed</Text>
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

          <View style={s.titleRow}>
            <Text style={s.title}>Borrowed Books</Text>
            <View style={s.titleIcon}><Ionicons name="library-outline" size={22} color="#fff" /></View>
          </View>

          <View style={s.statsRow}>
            <Stat label="Active" value={activeLoans.length.toString()} unit="items" bg="#fff" />
            <Stat label="Overdue" value={overdueLoans.length.toString()} unit="book" color={C.primary} bg="#FFE9E6" />
            <Stat label="Returned" value={history.length.toString()} unit="total" color={C.mintText} bg="#E3F8EE" />
          </View>
        </LinearGradient>

        <View style={s.sectionRow}>
          <View style={[s.sectionIcon, { backgroundColor: C.primary }]}><Ionicons name="book" size={16} color="#fff" /></View>
          <Text style={s.sectionTitle}>Currently borrowed</Text>
        </View>

        {loading && activeIssues.length === 0 ? (
          <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 20 }} />
        ) : (
          <>
            {activeLoans.map((item, index) => {
              const daysLeft = calculateDaysLeft(item.due_date);
              const progress = calculateProgress(item.issue_date, item.due_date);
              
              return (
                <View key={item.issue_id || item.book_id || index} style={s.card}>
                  <View style={{ flexDirection: 'row', width: '100%' }}>
                    <View style={[s.spine, { backgroundColor: C.green }]} />
                    <View style={[s.cardBody, { flex: 1, width: undefined }]}>
                      <View style={s.cardTop}>
                      <Pill bg={C.mint} color={C.mintText} dot>Active</Pill>
                    </View>
                    <Text style={s.bookTitle}>{item.book_name || item.title || 'Unknown Title'}</Text>
                    <Text style={s.author}>{item.author || 'Unknown Author'}</Text>
                    <DateBox issued={item.issue_date || 'Unknown'} due={item.due_date || 'Unknown'} />

                    <View style={s.progressHead}>
                      <Text style={s.progressText}>Loan duration: {daysLeft} days remaining</Text>
                      <Text style={[s.progressText, { color: C.mintText }]}>Due next week</Text>
                    </View>
                    <View style={s.track}>
                      <LinearGradient colors={['#34D399', '#10B981']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.fill, { width: `${progress}%` }]} />
                    </View>

                    <View style={s.btnRow}>
                      <Pressable style={({ pressed }) => [s.renew, pressed && { backgroundColor: C.pale }]} onPress={() => handleRenew(item.issue_id || item.book_id)}>
                        <Ionicons name="refresh" size={18} color={C.neutral} />
                        <Text style={s.renewText}>Renew Loan</Text>
                      </Pressable>
                      <Pressable style={({ pressed }) => [s.qrBtn, pressed && { transform: [{ scale: 0.94 }] }]} onPress={() => handleQR(item.qr_code_string)}>
                        <Ionicons name="qr-code-outline" size={22} color="#fff" />
                      </Pressable>
                    </View>
                  </View>
                  </View>
                </View>
              );
            })}

            {overdueLoans.map((item, index) => {
              const daysLate = calculateDaysLate(item.due_date);
              const fineAmount = daysLate * 5;
              
              return (
                <View key={item.issue_id || item.book_id || index} style={[s.card, { borderWidth: 1.5, borderColor: '#F6C4BF' }]}>
                  <LinearGradient colors={[C.primary, C.tertiary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.banner}>
                    <Ionicons name="warning" size={18} color="#fff" />
                    <Text style={s.bannerText}>OVERDUE BY {daysLate} DAYS</Text>
                    <View style={s.late}><Text style={s.lateText}>{daysLate}d late</Text></View>
                  </LinearGradient>
                  <View style={s.cardBody}>
                    <View style={s.cardTop}>
                      <Pill bg={C.redTint} color={C.primary}>Overdue</Pill>
                    </View>
                    <Text style={s.bookTitle}>{item.book_name || item.title || 'Unknown Title'}</Text>
                    <Text style={s.author}>{item.author || 'Unknown Author'}</Text>
                    <DateBox issued={item.issue_date || 'Unknown'} due={item.due_date || 'Unknown'} dueRed />

                    <View style={s.fineBox}>
                      <View style={s.fineIcon}><Ionicons name="cash-outline" size={22} color={C.primary} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fineTitle}>Accumulated fine</Text>
                        <Text style={s.fineSub}>₹5 per day fine rate</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={s.fineAmt}>₹{fineAmount}</Text>
                        <Text style={s.finePending}>PENDING FINE</Text>
                      </View>
                    </View>

                    <View style={s.btnRow}>
                      <Pressable style={({ pressed }) => [{ flex: 1 }, pressed && { transform: [{ scale: 0.97 }] }]} onPress={() => handleClearFine(item.issue_id || item.book_id)}>
                        <LinearGradient colors={[C.tertiary, C.primary, '#A5141C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.clear}>
                          <Ionicons name="card-outline" size={20} color="#fff" />
                          <Text style={s.clearText}>Clear Fine & Return Book</Text>
                        </LinearGradient>
                      </Pressable>
                      <Pressable style={({ pressed }) => [s.qrBtn, { backgroundColor: C.primary }, pressed && { transform: [{ scale: 0.94 }] }]} onPress={() => handleQR(item.qr_code_string)}>
                        <Ionicons name="qr-code-outline" size={22} color="#fff" />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
            
            {activeIssues.length === 0 && (
               <Text style={{ textAlign: 'center', fontFamily: 'PlusJakartaSans_500Medium', color: '#6B7280', marginTop: 10 }}>
                 No books currently borrowed.
               </Text>
            )}
          </>
        )}

        <View style={[s.sectionRow, { justifyContent: 'space-between', marginTop: 30 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[s.sectionIcon, { backgroundColor: C.navy }]}><Ionicons name="time-outline" size={17} color="#fff" /></View>
            <Text style={s.sectionTitle}>Past loans & history</Text>
          </View>
          <Pressable><Text style={s.viewAll}>View all ({history.length})</Text></Pressable>
        </View>

        <View style={[s.card, { paddingHorizontal: 16 }]}>
          {loading && history.length === 0 ? (
            <ActivityIndicator size="small" color={C.navy} style={{ margin: 20 }} />
          ) : history.length > 0 ? (
            history.map((item, index) => (
              <View key={item.issue_id || item.book_id || index} style={[s.hRow, index !== history.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }]}>
                <View style={s.hIcon}><Ionicons name="book-outline" size={22} color={C.navy} /></View>
                <View style={{ flex: 1 }}>
                  <View style={s.hTop}>
                    <Text style={s.hTitle} numberOfLines={1}>{item.book_name || item.title || 'Unknown Title'}</Text>
                    <Pill bg={C.mint} color={C.mintText}>Returned</Pill>
                  </View>
                  <Text style={s.author}>{item.author || 'Unknown Author'}</Text>
                  <Text style={s.hDates} numberOfLines={1}>In: <Text style={s.hDate}>{item.issue_date || 'Unknown'}</Text>   •   Out: <Text style={s.hDate}>{item.return_date || 'Unknown'}</Text></Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={{ textAlign: 'center', fontFamily: 'PlusJakartaSans_500Medium', color: '#6B7280', padding: 20 }}>
              No past history found.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* QR Code Modal */}
      <Modal visible={qrModalVisible} transparent animationType="fade" onRequestClose={() => setQrModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Scan Book QR</Text>
            <Text style={s.modalSub}>Show this code to the librarian</Text>
            <View style={s.qrFrame}>
              {qrData ? <QRCode value={qrData} size={200} color={C.navyDeep} backgroundColor="#fff" /> : <Text style={{color: C.primary, textAlign: 'center', fontFamily: 'PlusJakartaSans_700Bold', width: 200}}>Error: Secure QR token not found from server</Text>}
            </View>
            <Pressable style={s.modalClose} onPress={() => setQrModalVisible(false)}>
              <Text style={s.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const shadow = { shadowColor: '#0B2C4D', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 };

const s = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 32, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 },
  brand: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, color: '#fff' },
  brandSub: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#FFB3A8' },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: C.tertiary, borderWidth: 1.5, borderColor: C.navy },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 28, color: '#fff', letterSpacing: -0.5 },
  titleIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, padding: 14, borderRadius: 20, ...shadow },
  statLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: C.navy, marginBottom: 6 },
  statRow: { flexDirection: 'row', alignItems: 'baseline' },
  statNum: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 24, color: C.navyDeep, letterSpacing: -1 },
  statUnit: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: C.muted },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginTop: 28, marginBottom: 16 },
  sectionIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, color: C.neutral },
  viewAll: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.primary },
  card: { marginHorizontal: 20, marginBottom: 16, backgroundColor: '#fff', borderRadius: 24, overflow: 'hidden', ...shadow, flexDirection: 'column' },
  spine: { width: 6 },
  cardBody: { width: '100%', flexDirection: 'column', padding: 20 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  bookTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, color: C.neutral, marginBottom: 4 },
  author: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: C.muted, marginBottom: 16 },
  dateBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F9FAFB', borderRadius: 16, padding: 14, marginBottom: 18 },
  dLabel: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  dVal: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.neutral },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: C.navy },
  track: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden', marginBottom: 20 },
  fill: { height: '100%', borderRadius: 3 },
  btnRow: { flexDirection: 'row', gap: 12 },
  renew: { flex: 1, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, borderWidth: 1.5, borderColor: C.neutral },
  renewText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.neutral },
  qrBtn: { width: 50, height: 50, borderRadius: 16, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 11, width: '100%' },
  bannerText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, color: '#fff', flex: 1, letterSpacing: 0.5 },
  late: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  lateText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#fff' },
  fineBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.redTint, borderRadius: 18, padding: 14, marginTop: 14, marginBottom: 14, width: '100%' },
  fineIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow, shadowOpacity: 0.05 },
  fineTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.neutral, marginBottom: 2 },
  fineSub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: C.muted },
  fineAmt: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, color: C.primary, letterSpacing: -0.5 },
  finePending: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 10, color: C.primary, letterSpacing: 0.5, marginTop: 2 },
  clear: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16 },
  clearText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#fff' },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 18 },
  hIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: C.pale, alignItems: 'center', justifyContent: 'center' },
  hTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  hTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: C.neutral, flex: 1, paddingRight: 10 },
  hDates: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  hDate: { color: C.navy, fontFamily: 'PlusJakartaSans_700Bold' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 4 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(7, 27, 49, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 32, padding: 30, alignItems: 'center', width: '100%', ...shadow, shadowRadius: 30 },
  modalTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 22, color: C.neutral, marginBottom: 8 },
  modalSub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: C.muted, marginBottom: 24, textAlign: 'center' },
  qrFrame: { padding: 16, backgroundColor: '#fff', borderRadius: 24, borderWidth: 2, borderColor: '#F3F4F6', marginBottom: 28 },
  modalClose: { backgroundColor: '#F3F4F6', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 999, width: '100%', alignItems: 'center' },
  modalCloseText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: C.navy },
});
