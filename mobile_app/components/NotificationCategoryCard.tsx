import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  useFonts,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

// Exact TCEA college seal logo asset used in Login.tsx
const TCEA_LOGO = require('../assets/logo.png');

export interface NotificationItemData {
  id: string;
  type:
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
    | 'notice'
    | string;
  title: string;
  desc: string;
  time: string;
  group?: string;
  unread?: boolean;
  [key: string]: any;
}

interface NotificationCategoryCardProps {
  notification: NotificationItemData;
  onClose?: () => void;
}

export default function NotificationCategoryCard({
  notification,
  onClose,
}: NotificationCategoryCardProps) {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const { type, title, desc, time } = notification;
  const data = notification.data || notification.meta || {};

  // Determine theme category
  // Theme 1: overdue, due
  // Theme 2: fine, security
  // Theme 3: issued, returned, renewed, reserve
  // Theme 4: paper, book, academic
  // Theme 5: notice, broadcast
  const isTheme1 = type === 'overdue' || type === 'due';
  const isTheme2 = type === 'fine' || type === 'security';
  const isTheme3 =
    type === 'issued' ||
    type === 'returned' ||
    type === 'renewed' ||
    type === 'reserve';
  const isTheme4 = type === 'paper' || type === 'book' || type === 'academic';
  const isTheme5 = type === 'notice' || type === 'broadcast' || (!isTheme1 && !isTheme2 && !isTheme3 && !isTheme4);

  // Logo ring border color per theme
  const logoBorderColor = isTheme1 || isTheme4
    ? 'rgba(255,255,255,0.35)'
    : isTheme5
    ? 'rgba(217,119,6,0.35)'
    : '#DDE3F3';

  // Header App label color & time color
  const headerLabelColor = isTheme1 || isTheme4
    ? '#FFFFFF'
    : isTheme5
    ? '#7A4A0A'
    : '#4B5C75';

  const headerTimeColor = isTheme1 || isTheme4
    ? 'rgba(255,255,255,0.85)'
    : isTheme5
    ? '#7A4A0A'
    : '#6B7280';

  const renderCardContent = () => {
    // ----------------------------------------------------
    // THEME 1: Overdue Alert & Due Reminder (Full Red Gradient)
    // ----------------------------------------------------
    if (isTheme1) {
      const isDue = type === 'due';
      const iconName: keyof typeof Ionicons.glyphMap = isDue ? 'time-outline' : 'warning-outline';
      const chipIcon: keyof typeof Ionicons.glyphMap = isDue ? 'time-outline' : 'cash-outline';
      const chipLabel = data.chipText || (isDue ? (data.dueDate ? `Due ${data.dueDate}` : 'Due Reminder') : (data.amount ? `Pending fine ₹${data.amount}` : 'Pending fine ₹50'));

      return (
        <LinearGradient
          colors={['#E0533C', '#C81E27', '#A5141C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.cardOuter}
        >
          {/* Header Row */}
          <View style={s.headerRow}>
            <View style={[s.logoCircle, { borderColor: logoBorderColor }]}>
              <Image
                source={TCEA_LOGO}
                style={s.logoImg}
                resizeMode="contain"
              />
            </View>
            <Text style={[s.appLabel, { color: headerLabelColor }]}>TCEA LIBRARY</Text>
            <Text style={[s.headerTime, { color: headerTimeColor }]}>{time}</Text>
          </View>

          {/* Content Row */}
          <View style={s.contentRow}>
            <View style={[s.iconTile, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name={iconName} size={23} color="#FFFFFF" />
            </View>
            <View style={s.textBlock}>
              <Text style={[s.titleText, { color: '#FFFFFF' }]}>{title}</Text>
              <Text style={[s.bodyText, { color: 'rgba(255,255,255,0.92)' }]}>{desc}</Text>
              <View style={s.theme1Chip}>
                <Ionicons name={chipIcon} size={14} color="#FFFFFF" />
                <Text style={s.theme1ChipText}>{chipLabel}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      );
    }

    // ----------------------------------------------------
    // THEME 2: Fine Added & Security (White Card + Red Tile + Right Chip)
    // ----------------------------------------------------
    if (isTheme2) {
      const isSecurity = type === 'security';
      const iconName: keyof typeof Ionicons.glyphMap = isSecurity
        ? 'lock-closed-outline'
        : 'cash-outline';
      const rightChipText = data.chipText || (isSecurity ? 'Security' : (data.amount ? `+ ₹${data.amount}` : '+ ₹10'));

      return (
        <View style={[s.cardOuter, s.whiteCard]}>
          {/* Header Row */}
          <View style={s.headerRow}>
            <View style={[s.logoCircle, { borderColor: logoBorderColor }]}>
              <Image
                source={TCEA_LOGO}
                style={s.logoImg}
                resizeMode="contain"
              />
            </View>
            <Text style={[s.appLabel, { color: headerLabelColor }]}>TCEA LIBRARY</Text>
            <Text style={[s.headerTime, { color: headerTimeColor }]}>{time}</Text>
          </View>

          {/* Content Row */}
          <View style={s.contentRow}>
            <View style={[s.iconTile, { backgroundColor: '#FDE7E4' }]}>
              <Ionicons name={iconName} size={23} color="#C81E27" />
            </View>
            <View style={s.textBlock}>
              <View style={s.theme2TitleRow}>
                <Text style={[s.titleText, { color: '#111827', flex: 1 }]}>{title}</Text>
                <View style={s.theme2RightChip}>
                  <Text style={s.theme2RightChipText}>{rightChipText}</Text>
                </View>
              </View>
              <Text style={[s.bodyText, { color: '#6B7280' }]}>{desc}</Text>
            </View>
          </View>
        </View>
      );
    }

    // ----------------------------------------------------
    // THEME 3: Digital Receipts: Issue, Return, Renewed & Reserve
    // ----------------------------------------------------
    if (isTheme3) {
      let iconName: keyof typeof Ionicons.glyphMap = 'receipt-outline';
      let stripLabel = 'Due date';
      let stripChip = data.chipText || data.dueDate || '01 Nov 2026';

      if (type === 'returned') {
        iconName = 'checkmark-circle-outline';
        stripLabel = 'Returned on';
        stripChip = data.chipText || 'No dues';
      } else if (type === 'renewed') {
        iconName = 'refresh-circle-outline';
        stripLabel = 'Due date';
        stripChip = data.chipText || data.dueDate || '02 Nov 2026';
      } else if (type === 'reserve') {
        iconName = 'bookmark-outline';
        stripLabel = 'Hold status';
        stripChip = data.chipText || 'Ready at Desk';
      }

      return (
        <View style={[s.cardOuter, s.whiteCard]}>
          {/* Header Row */}
          <View style={s.headerRow}>
            <View style={[s.logoCircle, { borderColor: logoBorderColor }]}>
              <Image
                source={TCEA_LOGO}
                style={s.logoImg}
                resizeMode="contain"
              />
            </View>
            <Text style={[s.appLabel, { color: headerLabelColor }]}>TCEA LIBRARY</Text>
            <Text style={[s.headerTime, { color: headerTimeColor }]}>{time}</Text>
          </View>

          {/* Content Row */}
          <View style={s.contentRow}>
            <View style={[s.iconTile, { backgroundColor: '#D9F5E8' }]}>
              <Ionicons name={iconName} size={23} color="#0F7A4B" />
            </View>
            <View style={s.textBlock}>
              <Text style={[s.titleText, { color: '#111827' }]}>{title}</Text>
              <Text style={[s.bodyText, { color: '#6B7280' }]}>{desc}</Text>
            </View>
          </View>

          {/* Dashed Receipt Strip */}
          <View style={s.dashedReceiptStrip}>
            <Text style={s.dashedStripLabel}>{stripLabel}</Text>
            <View style={s.dashedStripChip}>
              <Text style={s.dashedStripChipText}>{stripChip}</Text>
            </View>
          </View>
        </View>
      );
    }

    // ----------------------------------------------------
    // THEME 4: Targeted Academic & Book Alerts (Navy Gradient + Coral Chip)
    // ----------------------------------------------------
    if (isTheme4) {
      const isBook = type === 'book';
      const iconName: keyof typeof Ionicons.glyphMap = isBook
        ? 'book-outline'
        : 'document-text-outline';
      const chipLabel = data.chipText || (isBook ? 'CST Catalog' : 'CST · 5th Semester');

      return (
        <LinearGradient
          colors={['#0B2C4D', '#1B4A7A']}
          style={[s.cardOuter, s.navyCardBorder]}
        >
          {/* Header Row */}
          <View style={s.headerRow}>
            <View style={[s.logoCircle, { borderColor: logoBorderColor }]}>
              <Image
                source={TCEA_LOGO}
                style={s.logoImg}
                resizeMode="contain"
              />
            </View>
            <Text style={[s.appLabel, { color: headerLabelColor }]}>TCEA LIBRARY</Text>
            <Text style={[s.headerTime, { color: headerTimeColor }]}>{time}</Text>
          </View>

          {/* Content Row */}
          <View style={s.contentRow}>
            <View style={[s.iconTile, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
              <Ionicons name={iconName} size={23} color="#FFFFFF" />
            </View>
            <View style={s.textBlock}>
              <Text style={[s.titleText, { color: '#FFFFFF' }]}>{title}</Text>
              <Text style={[s.bodyText, { color: 'rgba(255,255,255,0.88)' }]}>{desc}</Text>
              <View style={s.theme4Chip}>
                <Text style={s.theme4ChipText}>{chipLabel}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      );
    }

    // ----------------------------------------------------
    // THEME 5: Global Broadcast (Cream-to-Amber Gradient)
    // ----------------------------------------------------
    const broadcastLabel = data.chipText || 'Sent to all students';

    return (
      <LinearGradient
        colors={['#FFF1DB', '#FFDFA8']}
        style={s.cardOuter}
      >
        {/* Header Row */}
        <View style={s.headerRow}>
          <View style={[s.logoCircle, { borderColor: logoBorderColor }]}>
            <Image
              source={TCEA_LOGO}
              style={s.logoImg}
              resizeMode="contain"
            />
          </View>
          <Text style={[s.appLabel, { color: headerLabelColor }]}>TCEA LIBRARY</Text>
          <Text style={[s.headerTime, { color: headerTimeColor }]}>{time}</Text>
        </View>

        {/* Content Row */}
        <View style={s.contentRow}>
          <View style={[s.iconTile, { backgroundColor: '#D97706' }]}>
            <Ionicons name="megaphone-outline" size={23} color="#FFFFFF" />
          </View>
          <View style={s.textBlock}>
            <Text style={[s.titleText, { color: '#4A2C05' }]}>{title}</Text>
            <Text style={[s.bodyText, { color: '#6B4208' }]}>{desc}</Text>
            <View style={s.theme5Chip}>
              <Ionicons name="people-outline" size={13} color="#7A4A0A" />
              <Text style={s.theme5ChipText}>{broadcastLabel}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    );
  };

  return (
    <View style={s.container}>
      {renderCardContent()}

      {/* Dismiss Button Below Card */}
      {onClose && (
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel="Close notification details"
        >
          <Text style={s.closeBtnText}>Close</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  cardOuter: {
    width: '100%',
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 18,
    shadowColor: '#071B31',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    overflow: 'hidden',
  },
  whiteCard: {
    backgroundColor: '#FFFFFF',
  },
  navyCardBorder: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  logoImg: {
    width: 22,
    height: 22,
  },
  appLabel: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 11.5,
    letterSpacing: 0.5,
    marginLeft: 8,
    flex: 1,
  },
  headerTime: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11.5,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 14,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
  },
  titleText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 15.5,
    lineHeight: 21,
  },
  bodyText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 6,
  },

  // Theme 1
  theme1Chip: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  theme1ChipText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11.5,
  },

  // Theme 2
  theme2TitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  theme2RightChip: {
    backgroundColor: '#FDE7E4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  theme2RightChipText: {
    color: '#C81E27',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
  },

  // Theme 3
  dashedReceiptStrip: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderTopColor: '#DDE3F3',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dashedStripLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#6B7280',
  },
  dashedStripChip: {
    backgroundColor: '#D9F5E8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dashedStripChipText: {
    color: '#0F7A4B',
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  // Theme 4
  theme4Chip: {
    backgroundColor: '#E0533C',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  theme4ChipText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11.5,
  },

  // Theme 5
  theme5Chip: {
    backgroundColor: 'rgba(217,119,6,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  theme5ChipText: {
    color: '#7A4A0A',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11.5,
  },

  // Dismiss Button
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    marginTop: 14,
    alignSelf: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
