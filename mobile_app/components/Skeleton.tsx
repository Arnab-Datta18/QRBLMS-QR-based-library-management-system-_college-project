import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StyleProp,
  ViewStyle,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export const withMinimumDelay = async <T,>(promise: Promise<T>, minMs = 2600): Promise<T> => {
  const start = Date.now();
  try {
    const result = await promise;
    const elapsed = Date.now() - start;
    if (elapsed < minMs) {
      await new Promise(resolve => setTimeout(resolve, minMs - elapsed));
    }
    return result;
  } catch (error) {
    const elapsed = Date.now() - start;
    if (elapsed < minMs) {
      await new Promise(resolve => setTimeout(resolve, minMs - elapsed));
    }
    throw error;
  }
};

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: '#D9E0EF',
          opacity,
        },
        style,
      ]}
    />
  );
};

/* -------------------------------------------------------------
   REUSABLE ERROR STATE
------------------------------------------------------------- */
interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to Load Content',
  message = 'Failed to connect to the library system. Please check your connection and try again.',
  onRetry,
  style,
}) => {
  return (
    <View style={[styles.errorCard, style]}>
      <View style={styles.errorIconWrap}>
        <Ionicons name="cloud-offline-outline" size={32} color="#C81E27" />
      </View>
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      {onRetry && (
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
          ]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry loading content"
        >
          <LinearGradient
            colors={['#E0533C', '#C81E27']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.retryGradient}
          >
            <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
            <Text style={styles.retryText}>Retry</Text>
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );
};

/* -------------------------------------------------------------
   SCREEN SPECIFIC SKELETON LAYOUTS
------------------------------------------------------------- */

// 1. Home Skeleton
export const HomeSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Header Skeleton */}
      <View style={styles.headerSkeleton}>
        <View style={styles.topRow}>
          <View>
            <Skeleton width={110} height={20} borderRadius={6} />
            <Skeleton width={60} height={12} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Skeleton width={42} height={42} borderRadius={21} />
            <Skeleton width={42} height={42} borderRadius={21} />
          </View>
        </View>

        <Skeleton width={180} height={30} borderRadius={8} style={{ marginTop: 22 }} />

        {/* Chips */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 20 }}>
          <Skeleton width={80} height={28} borderRadius={14} />
          <Skeleton width={70} height={28} borderRadius={14} />
          <Skeleton width={90} height={28} borderRadius={14} />
        </View>

        {/* Digital Pass Card Skeleton */}
        <View style={styles.passCardSkeleton}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' }}>
            <Skeleton width={40} height={40} borderRadius={12} />
            <View style={{ flex: 1 }}>
              <Skeleton width={140} height={16} borderRadius={4} />
              <Skeleton width={110} height={12} borderRadius={4} style={{ marginTop: 6 }} />
            </View>
            <Skeleton width={60} height={24} borderRadius={12} />
          </View>
          <Skeleton width={160} height={160} borderRadius={20} style={{ marginTop: 18 }} />
          <Skeleton width={150} height={34} borderRadius={17} style={{ marginTop: 16 }} />
          <Skeleton width={200} height={12} borderRadius={4} style={{ marginTop: 10 }} />
        </View>
      </View>

      {/* Stats Row Skeleton */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Skeleton width={44} height={44} borderRadius={14} />
          <View style={{ flex: 1 }}>
            <Skeleton width={50} height={20} borderRadius={6} />
            <Skeleton width={70} height={12} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
        </View>
        <View style={styles.statBox}>
          <Skeleton width={44} height={44} borderRadius={14} />
          <View style={{ flex: 1 }}>
            <Skeleton width={60} height={20} borderRadius={6} />
            <Skeleton width={80} height={12} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
        </View>
      </View>

      {/* Available Books Section Skeleton */}
      <View style={{ paddingHorizontal: 20, marginTop: 24, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width={170} height={22} borderRadius={6} />
        <Skeleton width={60} height={16} borderRadius={4} />
      </View>

      {[1, 2, 3].map(key => (
        <View key={key} style={styles.bookCardSkeleton}>
          <Skeleton width={8} height="100%" borderRadius={0} />
          <View style={{ flex: 1, padding: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Skeleton width={90} height={20} borderRadius={6} />
              <Skeleton width={70} height={20} borderRadius={10} />
            </View>
            <Skeleton width="80%" height={18} borderRadius={6} style={{ marginTop: 12 }} />
            <Skeleton width="50%" height={14} borderRadius={4} style={{ marginTop: 6 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, alignItems: 'center' }}>
              <Skeleton width={80} height={14} borderRadius={4} />
              <Skeleton width={110} height={26} borderRadius={13} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

// 2. Borrowed Skeleton
export const BorrowedSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      {/* Header Skeleton */}
      <View style={[styles.headerSkeleton, { paddingBottom: 32 }]}>
        <View style={styles.topRow}>
          <View>
            <Skeleton width={110} height={20} borderRadius={6} />
            <Skeleton width={70} height={12} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Skeleton width={42} height={42} borderRadius={21} />
            <Skeleton width={42} height={42} borderRadius={21} />
          </View>
        </View>

        <Skeleton width={200} height={30} borderRadius={8} style={{ marginTop: 20, marginBottom: 20 }} />

        {/* 3 Stat boxes */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={[styles.statBox, { flex: 1, padding: 12 }]}>
            <Skeleton width={45} height={12} borderRadius={4} />
            <Skeleton width={35} height={24} borderRadius={6} style={{ marginTop: 6 }} />
          </View>
          <View style={[styles.statBox, { flex: 1, padding: 12 }]}>
            <Skeleton width={50} height={12} borderRadius={4} />
            <Skeleton width={30} height={24} borderRadius={6} style={{ marginTop: 6 }} />
          </View>
          <View style={[styles.statBox, { flex: 1, padding: 12 }]}>
            <Skeleton width={55} height={12} borderRadius={4} />
            <Skeleton width={35} height={24} borderRadius={6} style={{ marginTop: 6 }} />
          </View>
        </View>
      </View>

      {/* Section title */}
      <View style={{ paddingHorizontal: 20, marginTop: 24, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Skeleton width={28} height={28} borderRadius={8} />
        <Skeleton width={160} height={20} borderRadius={6} />
      </View>

      {/* 2 Active Loan Cards Skeleton */}
      {[1, 2].map(key => (
        <View key={key} style={styles.loanCardSkeleton}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <Skeleton width={70} height={22} borderRadius={11} />
          </View>
          <Skeleton width="75%" height={18} borderRadius={6} />
          <Skeleton width="45%" height={14} borderRadius={4} style={{ marginTop: 6, marginBottom: 16 }} />

          <View style={styles.dateBoxSkeleton}>
            <View>
              <Skeleton width={60} height={12} borderRadius={4} />
              <Skeleton width={75} height={14} borderRadius={4} style={{ marginTop: 6 }} />
            </View>
            <View>
              <Skeleton width={50} height={12} borderRadius={4} />
              <Skeleton width={75} height={14} borderRadius={4} style={{ marginTop: 6 }} />
            </View>
          </View>

          <Skeleton width="100%" height={6} borderRadius={3} style={{ marginBottom: 16 }} />

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Skeleton width="78%" height={48} borderRadius={16} />
            <Skeleton width={48} height={48} borderRadius={16} />
          </View>
        </View>
      ))}

      {/* Past history section */}
      <View style={{ paddingHorizontal: 20, marginTop: 24, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Skeleton width={28} height={28} borderRadius={8} />
          <Skeleton width={150} height={20} borderRadius={6} />
        </View>
        <Skeleton width={75} height={16} borderRadius={4} />
      </View>

      <View style={[styles.loanCardSkeleton, { padding: 16 }]}>
        {[1, 2, 3].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: i !== 3 ? 1 : 0, borderBottomColor: '#F3F4F6' }}>
            <Skeleton width={44} height={44} borderRadius={14} />
            <View style={{ flex: 1 }}>
              <Skeleton width="70%" height={15} borderRadius={4} />
              <Skeleton width="40%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
              <Skeleton width="55%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

// 3. Academics Skeleton
export const AcademicsSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={[styles.headerSkeleton, { paddingBottom: 28 }]}>
        <View style={styles.topRow}>
          <View>
            <Skeleton width={110} height={20} borderRadius={6} />
            <Skeleton width={70} height={12} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Skeleton width={42} height={42} borderRadius={21} />
            <Skeleton width={42} height={42} borderRadius={21} />
          </View>
        </View>

        <Skeleton width={190} height={28} borderRadius={8} style={{ marginTop: 20 }} />
        <Skeleton width={160} height={14} borderRadius={4} style={{ marginTop: 6, marginBottom: 20 }} />

        {/* Search bar skeleton */}
        <Skeleton width="100%" height={50} borderRadius={16} />
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 20, marginBottom: 14 }}>
        <Skeleton width={75} height={24} borderRadius={12} />
      </View>

      {[1, 2, 3, 4].map(key => (
        <View key={key} style={styles.academicCardSkeleton}>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <Skeleton width={56} height={68} borderRadius={14} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Skeleton width={50} height={20} borderRadius={6} />
                <Skeleton width={60} height={14} borderRadius={4} />
              </View>
              <Skeleton width="85%" height={16} borderRadius={4} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <Skeleton width="48%" height={42} borderRadius={14} />
            <Skeleton width="48%" height={42} borderRadius={14} />
          </View>
        </View>
      ))}
    </View>
  );
};

// 4. Profile Skeleton
export const ProfileSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={[styles.headerSkeleton, { paddingBottom: 36 }]}>
        <View style={styles.topRow}>
          <View>
            <Skeleton width={110} height={20} borderRadius={6} />
            <Skeleton width={50} height={12} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Skeleton width={42} height={42} borderRadius={21} />
            <Skeleton width={42} height={42} borderRadius={21} />
          </View>
        </View>

        {/* Avatar & Profile Hero */}
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <Skeleton width={96} height={96} borderRadius={48} />
          <Skeleton width={170} height={22} borderRadius={6} style={{ marginTop: 14 }} />
          <Skeleton width={120} height={14} borderRadius={4} style={{ marginTop: 6 }} />

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <Skeleton width={80} height={26} borderRadius={13} />
            <Skeleton width={110} height={26} borderRadius={13} />
          </View>
        </View>
      </View>

      {/* Stats summary */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Skeleton width={40} height={40} borderRadius={12} />
          <View style={{ flex: 1 }}>
            <Skeleton width={40} height={18} borderRadius={4} />
            <Skeleton width={70} height={12} borderRadius={4} style={{ marginTop: 4 }} />
          </View>
        </View>
        <View style={styles.statBox}>
          <Skeleton width={40} height={40} borderRadius={12} />
          <View style={{ flex: 1 }}>
            <Skeleton width={50} height={18} borderRadius={4} />
            <Skeleton width={70} height={12} borderRadius={4} style={{ marginTop: 4 }} />
          </View>
        </View>
      </View>

      {/* Info card skeleton */}
      <View style={[styles.loanCardSkeleton, { padding: 20, marginTop: 20 }]}>
        <Skeleton width={140} height={18} borderRadius={4} style={{ marginBottom: 16 }} />
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={{ paddingVertical: 10, borderBottomWidth: i !== 4 ? 1 : 0, borderBottomColor: '#F3F4F6' }}>
            <Skeleton width={80} height={12} borderRadius={4} />
            <Skeleton width="65%" height={16} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>
    </View>
  );
};

// 5. Notifications Skeleton
export const NotificationsSkeleton: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={[styles.headerSkeleton, { paddingBottom: 24 }]}>
        <View style={styles.topRow}>
          <Skeleton width={42} height={42} borderRadius={21} />
          <View style={{ alignItems: 'center' }}>
            <Skeleton width={110} height={20} borderRadius={6} />
            <Skeleton width={80} height={12} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
          <Skeleton width={42} height={42} borderRadius={21} />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
          <Skeleton width={130} height={24} borderRadius={6} />
          <Skeleton width={80} height={22} borderRadius={11} />
        </View>

        {/* Filter pills */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Skeleton width={90} height={32} borderRadius={16} />
          <Skeleton width={90} height={32} borderRadius={16} />
        </View>
      </View>

      {/* Notification items */}
      <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
        <Skeleton width={80} height={16} borderRadius={4} style={{ marginBottom: 12 }} />

        {[1, 2, 3, 4, 5].map(key => (
          <View key={key} style={styles.notificationCardSkeleton}>
            <Skeleton width={44} height={44} borderRadius={14} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Skeleton width="65%" height={16} borderRadius={4} />
                <Skeleton width={45} height={12} borderRadius={4} />
              </View>
              <Skeleton width="90%" height={13} borderRadius={4} style={{ marginTop: 6 }} />
              <Skeleton width="75%" height={13} borderRadius={4} style={{ marginTop: 4 }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

/* -------------------------------------------------------------
   STYLES
------------------------------------------------------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF1FB',
    paddingBottom: 40,
  },
  headerSkeleton: {
    backgroundColor: '#071B31',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passCardSkeleton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 18,
    alignItems: 'center',
    marginTop: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  statBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  bookCardSkeleton: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    overflow: 'hidden',
  },
  loanCardSkeleton: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
  },
  dateBoxSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  academicCardSkeleton: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
  },
  notificationCardSkeleton: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 10,
  },
  errorCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginVertical: 40,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#0B2C4D',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FDE7E4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 18,
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13.5,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryButton: {
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#C81E27',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  retryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
});
