import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  RefreshControl,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  useFonts,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import NotificationCategoryCard from '../components/NotificationCategoryCard';
import { getStudentId } from '../api/auth';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api/client';

// Color tokens strictly adhering to TCEA Library Design Spec
const C = {
  primary: '#C81E27',
  tertiary: '#E0533C',
  navy: '#0B2C4D',
  navyDeep: '#071B31',
  navyLight: '#1B4A7A',
  neutral: '#111827',
  surface: '#EEF1FB',
  unreadTint: '#FFFAF9',
  pressedRow: '#F3F5FD',
  divider: '#E3E8F5',
  mint: '#D9F5E8',
  mintText: '#0F7A4B',
  amber: '#D97706',
  amberBg: '#FFF1DB',
  redTint: '#FDE7E4',
  paleBlue: '#E6EAF8',
  muted: '#6B7280',
  timeGrey: '#8A94A8',
  labelGrey: '#4B5C75',
  peach: '#FFB3A8',
  subtitleLight: '#C9D6E8',
};

// Notification Types Mapping
export type NotificationType =
  | 'due'
  | 'overdue'
  | 'fine'
  | 'issued'
  | 'renewed'
  | 'returned'
  | 'reserve'
  | 'paper'
  | 'book'
  | 'security'
  | 'notice';

interface TypeConfig {
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  fg: string;
}

const TYPES: Record<NotificationType, TypeConfig> = {
  due: { icon: 'time', bg: '#FFF1DB', fg: '#D97706' },
  overdue: { icon: 'warning', bg: '#FDE7E4', fg: '#C81E27' },
  fine: { icon: 'cash', bg: '#FDE7E4', fg: '#C81E27' },
  issued: { icon: 'receipt', bg: '#D9F5E8', fg: '#0F7A4B' },
  renewed: { icon: 'refresh-circle', bg: '#D9F5E8', fg: '#0F7A4B' },
  returned: { icon: 'checkmark-circle', bg: '#D9F5E8', fg: '#0F7A4B' },
  reserve: { icon: 'bookmark', bg: '#E6EAF8', fg: '#0B2C4D' },
  paper: { icon: 'document-text', bg: '#E6EAF8', fg: '#0B2C4D' },
  book: { icon: 'book', bg: '#E6EAF8', fg: '#0B2C4D' },
  security: { icon: 'lock-closed', bg: '#FDE7E4', fg: '#C81E27' },
  notice: { icon: 'megaphone', bg: '#FFF1DB', fg: '#D97706' },
};

export type NotificationGroup = 'Today' | 'Yesterday' | 'Earlier';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  desc: string;
  time: string;
  group: NotificationGroup;
  unread: boolean;
  target?: 'Borrowed' | 'Academics' | 'Profile' | 'Home';
}

// Initial Seed Data with 11 representative items matching design spec
const INITIAL_DATA: NotificationItem[] = [
  {
    id: 'n1',
    type: 'due',
    title: 'Return Due in 2 Days',
    desc: "Clean Architecture: A Craftsman's Guide is due on Oct 20. Renew or return to avoid overdue fines.",
    time: '10m ago',
    group: 'Today',
    unread: true,
    target: 'Borrowed',
  },
  {
    id: 'n2',
    type: 'paper',
    title: 'New CST Sem 5 PYQ Alert',
    desc: 'Winter 2024 Theory of Computation & Computer Networks question papers are now available in Digital Archives.',
    time: '2h ago',
    group: 'Today',
    unread: true,
    target: 'Academics',
  },
  {
    id: 'n3',
    type: 'issued',
    title: 'Digital Issue Receipt',
    desc: 'Database System Concepts (Accession #CS-309) has been issued to your account. Due date is Nov 01, 2026.',
    time: '5h ago',
    group: 'Today',
    unread: false,
    target: 'Borrowed',
  },
  {
    id: 'n4',
    type: 'reserve',
    title: 'Reservation Ready for Pickup',
    desc: 'Operating System Concepts is available at Circulation Counter 2. Hold valid for 48 hours.',
    time: 'Yesterday, 4:15 PM',
    group: 'Yesterday',
    unread: true,
    target: 'Borrowed',
  },
  {
    id: 'n5',
    type: 'overdue',
    title: 'Daily High-Priority Overdue Alert',
    desc: 'Compilers: Principles, Techniques, and Tools was due on Oct 15. Please return immediately to the counter.',
    time: 'Yesterday, 09:00 AM',
    group: 'Yesterday',
    unread: true,
    target: 'Borrowed',
  },
  {
    id: 'n6',
    type: 'renewed',
    title: 'Loan Successfully Renewed',
    desc: 'Artificial Intelligence: A Modern Approach has been extended by 14 days. New due date is Nov 02.',
    time: 'Yesterday, 11:20 AM',
    group: 'Yesterday',
    unread: false,
    target: 'Borrowed',
  },
  {
    id: 'n7',
    type: 'fine',
    title: 'Automated Overdue Fine Update',
    desc: 'A late fine of ₹15.00 has been calculated for 3 overdue days on Compilers (CS-1082).',
    time: 'Oct 15',
    group: 'Earlier',
    unread: false,
    target: 'Borrowed',
  },
  {
    id: 'n8',
    type: 'book',
    title: 'Targeted Department Book Arrivals',
    desc: '6 new books on Cloud Computing & Distributed Systems added to the CST library stack.',
    time: 'Oct 14',
    group: 'Earlier',
    unread: false,
    target: 'Borrowed',
  },
  {
    id: 'n9',
    type: 'returned',
    title: 'Digital Return Receipt',
    desc: 'Modern Operating Systems has been safely received by librarian and cleared from your record.',
    time: 'Oct 12',
    group: 'Earlier',
    unread: false,
    target: 'Borrowed',
  },
  {
    id: 'n10',
    type: 'security',
    title: 'Account Password / Security Alert',
    desc: 'Your student library portal password was updated successfully from mobile app login.',
    time: 'Oct 10',
    group: 'Earlier',
    unread: false,
    target: 'Profile',
  },
  {
    id: 'n11',
    type: 'notice',
    title: 'Global Librarian Broadcast',
    desc: 'Central Library reading hall will remain open until 8:00 PM during upcoming mid-term examination week.',
    time: 'Oct 08',
    group: 'Earlier',
    unread: false,
  },
];

const GROUPS: NotificationGroup[] = ['Today', 'Yesterday', 'Earlier'];

export default function NotificationsScreen({ navigation: propNav }: any) {
  const navigation = propNav || useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_DATA);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const [studentId, setStudentId] = useState<string>('');

  const unreadCount = notifications.filter(n => n.unread).length;
  const shown = filter === 'unread' ? notifications.filter(n => n.unread) : notifications;



  const fetchLiveNotifications = useCallback(async (sid?: string) => {
    try {
      const activeSid = sid || studentId || (await getStudentId());
      if (!activeSid) return;
      if (!studentId) setStudentId(activeSid);

      const res = await getNotifications(activeSid);
      if (res && res.notifications && Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
      }
    } catch (err) {
      console.warn('Failed to fetch live notifications:', err);
    }
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      fetchLiveNotifications();
    }, [fetchLiveNotifications])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLiveNotifications();
    setRefreshing(false);
  }, [fetchLiveNotifications]);

  const handleMarkAllRead = async () => {
    // 1. Optimistic UI update
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));

    // 2. Sync with backend
    try {
      const activeSid = studentId || (await getStudentId());
      if (activeSid) {
        await markAllNotificationsRead(activeSid);
      }
    } catch (err) {
      console.warn('Failed to mark all notifications read on backend:', err);
    }
  };

  const handlePressRow = (item: NotificationItem) => {
    // 1. Mark as read immediately in UI
    setNotifications(prev =>
      prev.map(n => (n.id === item.id ? { ...n, unread: false } : n))
    );

    // 2. Open centered detail card modal with full message (no page navigation)
    setSelectedNotification({ ...item, unread: false });

    // 3. Sync with backend if was unread
    if (item.unread) {
      (async () => {
        try {
          const activeSid = studentId || (await getStudentId());
          if (activeSid) {
            await markNotificationRead(activeSid, item.id);
          }
        } catch (err) {
          console.warn('Failed to mark notification read on backend:', err);
        }
      })();
    }
  };

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: C.surface }} />;
  }

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FFFFFF" />
        }
      >
        {/* HEADER BLOCK */}
        <LinearGradient
          colors={[C.navyDeep, C.navy, C.navyLight]}
          style={[s.header, { paddingTop: insets.top + 12 }]}
        >
          {/* Glow Blobs */}
          <View style={s.glowBlobTop} />
          <View style={s.glowBlobBottom} />

          {/* Top Row: Back Button, Brand, Profile Button */}
          <View style={s.topRow}>
            <Pressable
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
              style={({ pressed }) => [s.roundBtn, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </Pressable>

            <View style={s.brandCol}>
              <Text style={s.brandTitle}>TCEA Library</Text>
              <Text style={s.brandSub}>Notifications</Text>
            </View>

            <Pressable
              onPress={() => navigation.navigate('Profile')}
              style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.94 : 1 }] }]}
              accessibilityRole="button"
              accessibilityLabel="Profile"
            >
              <LinearGradient colors={[C.tertiary, C.primary]} style={s.roundBtn}>
                <Ionicons name="person" size={20} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
          </View>

          {/* Title Row with Coral Bar */}
          <View style={s.titleRow}>
            <View style={s.coralBar} />
            <Text style={s.title}>Notifications</Text>
          </View>

          {/* Subtitle */}
          <Text style={s.subtitle}>
            {unreadCount > 0 ? `You have ${unreadCount} unread` : "You're all caught up"}
          </Text>

          {/* Segmented Control */}
          <View style={s.segmentedTrack}>
            <Pressable
              onPress={() => setFilter('all')}
              style={[s.segmentBtn, filter === 'all' && s.segmentBtnActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === 'all' }}
            >
              <Text style={[s.segmentText, filter === 'all' ? s.segmentTextActive : s.segmentTextInactive]}>
                All
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setFilter('unread')}
              style={[s.segmentBtn, filter === 'unread' && s.segmentBtnActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === 'unread' }}
            >
              <Text style={[s.segmentText, filter === 'unread' ? s.segmentTextActive : s.segmentTextInactive]}>
                Unread ({unreadCount})
              </Text>
            </Pressable>
          </View>
        </LinearGradient>

        {/* ACTION ROW */}
        <View style={s.actionRow}>
          <Text style={s.actionCount}>
            {shown.length} {shown.length === 1 ? 'notification' : 'notifications'}
          </Text>

          {unreadCount > 0 && (
            <Pressable
              onPress={handleMarkAllRead}
              style={({ pressed }) => [s.markAllPill, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel="Mark all read"
            >
              <Ionicons name="checkmark-done" size={15} color={C.mintText} />
              <Text style={s.markAllText}>Mark all read</Text>
            </Pressable>
          )}
        </View>

        {/* NOTIFICATION GROUPS OR EMPTY STATE */}
        {shown.length === 0 ? (
          <View style={s.emptyContainer}>
            <View style={s.emptyTile}>
              <Ionicons name="notifications-off-outline" size={34} color={C.navy} />
            </View>
            <Text style={s.emptyTitle}>
              {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
            </Text>
            <Text style={s.emptySub}>
              New alerts about your loans and papers will show up here.
            </Text>
          </View>
        ) : (
          GROUPS.map(group => {
            const groupItems = shown.filter(item => item.group === group);
            if (groupItems.length === 0) return null;

            return (
              <View key={group}>
                <Text style={s.groupHeader}>{group.toUpperCase()}</Text>
                <View style={s.card}>
                  {groupItems.map((item, index) => {
                    const typeConfig = TYPES[item.type] || TYPES.notice;
                    const isLast = index === groupItems.length - 1;

                    return (
                      <View key={item.id}>
                        <Pressable
                          onPress={() => handlePressRow(item)}
                          style={({ pressed }) => [
                            s.row,
                            item.unread ? s.rowUnread : s.rowRead,
                            pressed && s.rowPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={item.title}
                        >
                          {/* Unread Left Spine */}
                          {item.unread && <View style={s.unreadSpine} />}

                          {/* 46x46 Rounded-Square Tile */}
                          <View style={[s.iconTile, { backgroundColor: typeConfig.bg }]}>
                            <Ionicons name={typeConfig.icon} size={22} color={typeConfig.fg} />
                          </View>

                          {/* Content Column */}
                          <View style={s.rowContent}>
                            <View style={s.rowHeader}>
                              <Text
                                style={[
                                  s.rowTitle,
                                  item.unread ? s.rowTitleUnread : s.rowTitleRead,
                                ]}
                                numberOfLines={1}
                              >
                                {item.title}
                              </Text>
                              <Text style={s.rowTime}>{item.time}</Text>
                            </View>
                            <Text
                              style={[s.rowDesc, item.unread && s.rowDescUnreadPadding]}
                              numberOfLines={2}
                            >
                              {item.desc}
                            </Text>
                          </View>

                          {/* Unread Bottom-Right Dot */}
                          {item.unread && <View style={s.unreadDot} />}
                        </Pressable>

                        {/* Divider between items in same card */}
                        {!isLast && <View style={s.divider} />}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* CENTERED RICH CATEGORY CARD MODAL */}
      <Modal
        visible={!!selectedNotification}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedNotification(null)}
      >
        <Pressable
          style={s.modalBackdrop}
          onPress={() => setSelectedNotification(null)}
        >
          <Pressable
            style={s.modalCardWrapper}
            onPress={e => e.stopPropagation()}
          >
            {selectedNotification && (
              <NotificationCategoryCard
                notification={selectedNotification}
                onClose={() => setSelectedNotification(null)}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.surface,
  },
  scrollContent: {
    paddingBottom: 130, // Clearance for global floating pill tab bar
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
    position: 'relative',
  },
  glowBlobTop: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -70,
    right: -60,
    backgroundColor: C.primary,
    opacity: 0.35,
  },
  glowBlobBottom: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    bottom: -30,
    left: -50,
    backgroundColor: C.tertiary,
    opacity: 0.22,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandCol: {
    alignItems: 'center',
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: -0.3,
  },
  brandSub: {
    color: C.peach,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  titleRow: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  coralBar: {
    width: 6,
    height: 34,
    borderRadius: 3,
    backgroundColor: C.tertiary,
  },
  title: {
    fontSize: 30,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.subtitleLight,
    marginTop: 4,
    marginLeft: 18,
  },
  segmentedTrack: {
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    padding: 4,
    flexDirection: 'row',
  },
  segmentBtn: {
    flex: 1,
    height: 42,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: C.navy,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  segmentText: {
    fontSize: 14,
  },
  segmentTextActive: {
    color: C.primary,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  segmentTextInactive: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    opacity: 0.9,
  },
  actionRow: {
    marginTop: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionCount: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.labelGrey,
  },
  markAllPill: {
    backgroundColor: C.mint,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  markAllText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.mintText,
  },

  groupHeader: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: 0.8,
    color: C.labelGrey,
    marginTop: 22,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    marginHorizontal: 20,
    overflow: 'hidden',
    shadowColor: C.navy,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 13,
    position: 'relative',
  },
  rowRead: {
    backgroundColor: '#FFFFFF',
  },
  rowUnread: {
    backgroundColor: C.unreadTint,
  },
  rowPressed: {
    backgroundColor: C.pressedRow,
  },
  unreadSpine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: C.primary,
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContent: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: 15,
    color: C.neutral,
    flex: 1,
  },
  rowTitleUnread: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  rowTitleRead: {
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  rowTime: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.timeGrey,
    marginLeft: 8,
  },
  rowDesc: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    lineHeight: 19,
    color: C.muted,
    marginTop: 4,
  },
  rowDescUnreadPadding: {
    paddingRight: 18,
  },
  unreadDot: {
    position: 'absolute',
    right: 16,
    bottom: 18,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.primary,
  },
  divider: {
    height: 1,
    backgroundColor: C.divider,
    marginLeft: 75, // Align nicely past the icon tile
  },
  emptyContainer: {
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyTile: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: C.paleBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: C.neutral,
    marginTop: 16,
  },
  emptySub: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    maxWidth: 260,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 27, 49, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCardWrapper: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
});
