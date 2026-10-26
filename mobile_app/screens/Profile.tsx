import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import {
  useFonts,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';

import { getDashboard, changePassword, getFullImageUrl, uploadAvatar } from '../api/client';
import { getStudentId, clearTokens } from '../api/auth';

const C = {
  primary: '#C81E27',
  primaryDark: '#A5141C',
  tertiary: '#E0533C',
  navy: '#0B2C4D',
  navyDeep: '#071B31',
  neutral: '#111827',
  surface: '#EEF1FB',
  pale: '#E6EAF8',
  fieldGrey: '#F3F5FD',
  fieldBorder: '#DDE3F3',
  mint: '#D9F5E8',
  mintText: '#0F7A4B',
  duesTint: '#E3F8EE',
  checkGreen: '#10B981',
  onlineGreen: '#34D399',
  softRed: '#FDE7E4',
  muted: '#6B7280',
  labelGrey: '#4B5C75',
  placeholder: '#8A94A8',
  peach: '#FFB3A8',
};

interface ProfileProps {
  navigation?: any;
  onLogout?: () => void;
}

export default function Profile({ navigation, onLogout }: ProfileProps) {
  const nav = navigation || useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    JetBrainsMono_700Bold,
  });

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const studentId = await getStudentId();
      if (!studentId) return;
      const res = await getDashboard(studentId);
      setData(res);
      if (res.avatar_url || res.profile_pic_url) {
        const full = getFullImageUrl(res.avatar_url || res.profile_pic_url);
        setAvatarUri(full);
      }
    } catch (err) {
      console.warn('Profile fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  // Dynamic values with safe fallbacks
  const studentId = data?.student_id || '24305141004';
  const fullName = data?.name || data?.student_name || 'Arnab Datta';
  const course = data?.course || 'Diploma in Engineering';
  const department = data?.department || 'Computer Science & Technology (CST)';
  const semester = data?.semester || '5th Semester';
  const email = data?.email || 'student@tcea.edu.in';
  const activeLoans = data?.active_loans_count ?? (data?.active_issues ? data.active_issues.length : 3);
  const totalDues = data?.total_dues ?? data?.total_fine ?? 0;

  // Helper to extract student initials
  const getInitials = (name: string) => {
    if (!name) return 'AD';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Image picker handler with multi-layer frontend security
  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Permission to access your photo gallery is required to choose a profile image.'
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];

      // LAYER 1: STRICT CLIENT-SIDE VALIDATION
      // a) Extension Whitelist: .jpg, .jpeg, .png, .webp
      const uri = asset.uri || '';
      const filename = asset.fileName || uri.split('/').pop() || '';
      const ext = (filename.includes('.') ? filename.split('.').pop() : uri.split('.').pop())?.toLowerCase() || '';
      const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];

      if (!validExtensions.includes(ext)) {
        Alert.alert(
          'Security Blocked',
          'Invalid file format or size. Only genuine JPG, PNG, or WEBP images under 2 MB are allowed.'
        );
        return;
      }

      // b) MIME Type Whitelist: image/jpeg, image/png, image/webp
      const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (asset.mimeType && !validMimes.includes(asset.mimeType.toLowerCase())) {
        Alert.alert(
          'Security Blocked',
          'Invalid file format or size. Only genuine JPG, PNG, or WEBP images under 2 MB are allowed.'
        );
        return;
      }

      // c) File Size Cap: <= 2 MB (2 * 1024 * 1024 bytes)
      const MAX_SIZE = 2 * 1024 * 1024;
      if (asset.fileSize && asset.fileSize > MAX_SIZE) {
        Alert.alert(
          'Security Blocked',
          'Invalid file format or size. Only genuine JPG, PNG, or WEBP images under 2 MB are allowed.'
        );
        return;
      }

      // Client validation passed -> upload to backend
      try {
        setUploadingAvatar(true);
        const uploadRes = await uploadAvatar(studentId, asset.uri, asset.mimeType, filename);
        if (uploadRes.status === 'success' && uploadRes.avatar_url) {
          const fullAvatarUrl = getFullImageUrl(uploadRes.avatar_url);
          setAvatarUri(fullAvatarUrl);
          Alert.alert('Success', 'Profile photo updated successfully!');
        } else {
          setAvatarUri(asset.uri);
        }
      } catch (uploadErr: any) {
        const errorMsg =
          uploadErr.response?.data?.message ||
          uploadErr.message ||
          'Failed to upload avatar to server.';
        Alert.alert('Upload Failed', errorMsg);
      } finally {
        setUploadingAvatar(false);
      }
    } catch (e) {
      console.warn('Image picker error:', e);
      Alert.alert('Notice', 'Unable to open photo gallery on this device.');
    }
  };

  // Change password submission
  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      Alert.alert('Validation Error', 'Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Validation Error', 'New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New password and confirmation do not match.');
      return;
    }

    try {
      setSubmittingPassword(true);
      const res = await changePassword(studentId, currentPassword, newPassword);
      if (res.status === 'success' || res.message) {
        Alert.alert('Success', res.message || 'Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        Alert.alert('Error', res.message || 'Failed to update password.');
      }
    } catch (err: any) {
      const errMsg =
        err.response?.data?.message ||
        err.message ||
        'An error occurred while changing your password.';
      Alert.alert('Password Change Failed', errMsg);
    } finally {
      setSubmittingPassword(false);
    }
  };

  // Safe Logout Confirmation
  const handleLogoutConfirm = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of your TCEA Library account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearTokens();
            } catch (e) {
              console.warn('Logout error:', e);
            }
            if (onLogout) {
              onLogout();
            } else if (navigation) {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            }
          },
        },
      ]
    );
  };

  if (!fontsLoaded) {
    return (
      <View style={[s.loadingContainer, { backgroundColor: C.surface }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* HEADER WITH GRADIENT & GLOW BLOBS */}
          <LinearGradient
            colors={['#071B31', '#0B2C4D', '#1B4A7A']}
            style={[s.header, { paddingTop: Math.max(insets.top + 14, 52) }]}
          >
            {/* Glow Circles */}
            <View style={s.glowCircleTop} />
            <View style={s.glowCircleBottom} />

            {/* Top Bar Row */}
            <View style={s.topRow}>
              <View>
                <Text style={s.brandTitle}>TCEA Library</Text>
                <Text style={s.brandSub}>Profile</Text>
              </View>

              <View style={s.topActions}>
                {/* Notification Bell */}
                <Pressable
                  onPress={() => nav.navigate('Notifications')}
                  style={({ pressed }) => [s.bellBtn, pressed && { opacity: 0.8 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Notifications"
                >
                  <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
                  <View style={s.notificationDot} />
                </Pressable>

                {/* Profile Circle Icon */}
                <LinearGradient
                  colors={[C.tertiary, C.primary]}
                  style={s.profileCircleBtn}
                >
                  <Ionicons name="person" size={20} color="#FFFFFF" />
                </LinearGradient>
              </View>
            </View>

            {/* Centered Avatar */}
            <View style={s.avatarContainer}>
              <LinearGradient
                colors={['#E0533C', '#C81E27', '#FFFFFF']}
                style={s.avatarRing}
              >
                <View style={s.avatarInner}>
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color={C.primary} />
                  ) : avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={s.avatarImage} />
                  ) : (
                    <Text style={s.avatarInitials}>{getInitials(fullName)}</Text>
                  )}
                </View>
              </LinearGradient>

              {/* Status Dot (Top-Right) */}
              <View style={s.statusDot} />

              {/* Camera Button (Bottom-Right) */}
              <Pressable
                onPress={handlePickImage}
                style={({ pressed }) => [
                  s.cameraBtn,
                  pressed && { transform: [{ scale: 0.92 }] },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
              >
                <LinearGradient
                  colors={[C.tertiary, C.primary]}
                  style={s.cameraBtnInner}
                >
                  <Ionicons name="camera" size={17} color="#FFFFFF" />
                </LinearGradient>
              </Pressable>
            </View>

            {/* Student Name */}
            <Text style={s.studentName} numberOfLines={1} adjustsFontSizeToFit>
              {fullName}
            </Text>

            {/* Registered Badge Pill */}
            <View style={s.badgePill}>
              <Ionicons name="school-outline" size={14} color="#FFFFFF" />
              <Text style={s.badgeText}>TCEA REGISTERED STUDENT</Text>
            </View>

            {/* Two Stat Cards */}
            <View style={s.statsRow}>
              {/* Active Loans Card */}
              <View style={s.statCard}>
                <Text style={s.statValuePrimary}>
                  {String(activeLoans).padStart(2, '0')}
                </Text>
                <Text style={s.statLabel}>Active Loans</Text>
              </View>

              {/* Dues Card */}
              <View
                style={[
                  s.statCard,
                  {
                    backgroundColor: totalDues > 0 ? C.softRed : C.duesTint,
                  },
                ]}
              >
                <Text
                  style={[
                    s.statValueDynamic,
                    {
                      color: totalDues > 0 ? C.primary : C.mintText,
                    },
                  ]}
                >
                  {totalDues}
                </Text>
                <Text style={s.statLabel}>Dues (₹)</Text>
              </View>
            </View>
          </LinearGradient>

          {/* CARD 1: REGISTRATION RECORD */}
          <View style={s.card}>
            {/* Sec Head */}
            <View style={s.secHead}>
              <LinearGradient
                colors={['#0B2C4D', '#1B4A7A']}
                style={s.iconTile}
              >
                <Ionicons name="id-card-outline" size={22} color="#FFFFFF" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Registration Record</Text>
              </View>
              <Pressable
                onPress={() =>
                  Alert.alert(
                    'Academic Record Locked',
                    'Official academic details are managed and verified by the Institute Registrar.'
                  )
                }
                style={({ pressed }) => [
                  s.editPill,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Ionicons name="create-outline" size={14} color={C.mintText} />
                <Text style={s.editPillText}>Edit</Text>
              </Pressable>
            </View>

            {/* Data Rows */}
            <View style={s.recordRows}>
              {/* Row 1: Student ID */}
              <View style={s.dataRow}>
                <Text style={s.rowLabel}>Student ID</Text>
                <View style={s.shadedIdBox}>
                  <Text style={s.idValueText}>{studentId}</Text>
                </View>
              </View>

              <View style={s.divider} />

              {/* Row 2: Full Name */}
              <View style={s.dataRow}>
                <Text style={s.rowLabel}>Full Name</Text>
                <Text style={s.rowValueText}>{fullName}</Text>
              </View>

              <View style={s.divider} />

              {/* Row 3: Course */}
              <View style={s.dataRow}>
                <Text style={s.rowLabel}>Course</Text>
                <Text style={s.rowValueText}>{course}</Text>
              </View>

              <View style={s.divider} />

              {/* Row 4: Department */}
              <View style={s.dataRow}>
                <Text style={s.rowLabel}>Department</Text>
                <Text
                  style={[s.rowValueText, { textAlign: 'right', maxWidth: '64%' }]}
                >
                  {department}
                </Text>
              </View>

              <View style={s.divider} />

              {/* Row 5: Semester */}
              <View style={s.dataRow}>
                <Text style={s.rowLabel}>Semester</Text>
                <View style={s.semesterPill}>
                  <Text style={s.semesterText}>{semester}</Text>
                </View>
              </View>

              <View style={s.divider} />

              {/* Row 6: Student Email */}
              <View style={s.dataRow}>
                <Text style={s.rowLabel}>Student email</Text>
                <Text style={s.emailValueText}>{email}</Text>
              </View>
            </View>

            {/* Authenticated by Registrar Box */}
            <View style={s.registrarBox}>
              <View style={s.shieldTile}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color={C.navy}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.registrarTitle}>Authenticated by Registrar</Text>
                <Text style={s.registrarSub}>Session 2023–2026 • Validated</Text>
              </View>
              <View style={s.checkCircle}>
                <Ionicons name="checkmark" size={15} color="#FFFFFF" />
              </View>
            </View>
          </View>

          {/* CARD 2: ACCOUNT SECURITY */}
          <View style={s.card}>
            <View style={s.secHead}>
              <View style={[s.iconTile, { backgroundColor: C.softRed }]}>
                <Ionicons name="lock-closed" size={22} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Account Security</Text>
                <Text style={s.cardSub}>
                  Manage your student portal login credentials
                </Text>
              </View>
            </View>

            {/* 3 Password Fields */}
            <View style={s.passwordForm}>
              {/* Field 1: Current Password */}
              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>Current Password</Text>
                <View
                  style={[
                    s.inputField,
                    focusedField === 'current' && s.inputFieldFocused,
                  ]}
                >
                  <TextInput
                    style={s.textInput}
                    placeholder="Enter current password"
                    placeholderTextColor={C.placeholder}
                    secureTextEntry={!showCurrent}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    onFocus={() => setFocusedField('current')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                  />
                  <Pressable
                    onPress={() => setShowCurrent(prev => !prev)}
                    style={s.eyeButton}
                  >
                    <Ionicons
                      name={showCurrent ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={focusedField === 'current' ? C.primary : C.placeholder}
                    />
                  </Pressable>
                </View>
              </View>

              {/* Field 2: New Password */}
              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>
                  New Password <Text style={{ color: C.primary, fontSize: 12 }}>(min. 8 characters)</Text>
                </Text>
                <View
                  style={[
                    s.inputField,
                    focusedField === 'new' && s.inputFieldFocused,
                  ]}
                >
                  <TextInput
                    style={s.textInput}
                    placeholder="Enter new password"
                    placeholderTextColor={C.placeholder}
                    secureTextEntry={!showNew}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    onFocus={() => setFocusedField('new')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                  />
                  <Pressable
                    onPress={() => setShowNew(prev => !prev)}
                    style={s.eyeButton}
                  >
                    <Ionicons
                      name={showNew ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={focusedField === 'new' ? C.primary : C.placeholder}
                    />
                  </Pressable>
                </View>
              </View>

              {/* Field 3: Confirm New Password */}
              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>Confirm New Password</Text>
                <View
                  style={[
                    s.inputField,
                    focusedField === 'confirm' && s.inputFieldFocused,
                  ]}
                >
                  <TextInput
                    style={s.textInput}
                    placeholder="Re-enter new password"
                    placeholderTextColor={C.placeholder}
                    secureTextEntry={!showConfirm}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onFocus={() => setFocusedField('confirm')}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="none"
                  />
                  <Pressable
                    onPress={() => setShowConfirm(prev => !prev)}
                    style={s.eyeButton}
                  >
                    <Ionicons
                      name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={focusedField === 'confirm' ? C.primary : C.placeholder}
                    />
                  </Pressable>
                </View>
              </View>

              {/* Change Password Button */}
              <Pressable
                onPress={handleChangePassword}
                disabled={submittingPassword}
                style={({ pressed }) => [
                  s.changePasswordBtn,
                  pressed && { transform: [{ scale: 0.98 }] },
                  submittingPassword && { opacity: 0.8 },
                ]}
              >
                <LinearGradient
                  colors={[C.tertiary, C.primary, C.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.changePasswordGradient}
                >
                  {submittingPassword ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="key-outline" size={20} color="#FFFFFF" />
                      <Text style={s.changePasswordText}>Change Password</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>

          {/* CARD 3: SESSION & SIGN OUT */}
          <View style={s.card}>
            <View style={s.secHead}>
              <View style={[s.iconTile, { backgroundColor: C.softRed }]}>
                <Ionicons name="log-out-outline" size={22} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Account Session</Text>
                <Text style={s.cardSub}>
                  Safely sign out of your student portal on this device
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleLogoutConfirm}
              style={({ pressed }) => [
                s.logoutBtn,
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Log out of account"
            >
              <Ionicons name="log-out-outline" size={20} color={C.primary} />
              <Text style={s.logoutBtnText}>Log Out of Account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 130,
  },

  // HEADER
  header: {
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  glowCircleTop: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: C.primary,
    opacity: 0.36,
    top: -80,
    right: -70,
  },
  glowCircleBottom: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: C.tertiary,
    opacity: 0.22,
    bottom: 30,
    left: -60,
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.peach,
    marginTop: 2,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.tertiary,
  },
  profileCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // AVATAR
  avatarContainer: {
    width: 118,
    height: 118,
    marginTop: 22,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    width: 118,
    height: 118,
    borderRadius: 59,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  avatarInitials: {
    fontSize: 34,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: C.navy,
  },
  statusDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.onlineGreen,
    borderWidth: 3,
    borderColor: C.navy,
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cameraBtnInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // NAME & BADGE
  studentName: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    marginTop: 14,
    textAlign: 'center',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 8,
    gap: 6,
  },
  badgeText: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },

  // STAT CARDS
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
    width: '100%',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B2C4D',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  statValuePrimary: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: C.primary,
  },
  statValueDynamic: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.labelGrey,
    marginTop: 2,
  },

  // CARD CONTAINERS
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 18,
    shadowColor: '#0B2C4D',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  secHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 19,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: C.navy,
    letterSpacing: -0.2,
  },
  cardSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
    marginTop: 2,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.mint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 4,
  },
  editPillText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.mintText,
  },

  // REGISTRATION ROWS
  recordRows: {
    marginTop: 16,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
  },
  rowLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.labelGrey,
  },
  shadedIdBox: {
    backgroundColor: C.fieldGrey,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.fieldBorder,
  },
  idValueText: {
    fontSize: 13,
    fontFamily: 'JetBrainsMono_700Bold',
    color: C.navy,
  },
  rowValueText: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.navy,
  },
  semesterPill: {
    backgroundColor: C.pale,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  semesterText: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.navy,
  },
  emailValueText: {
    fontSize: 12.5,
    fontFamily: 'JetBrainsMono_700Bold',
    color: C.primary,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F4FA',
    marginVertical: 1,
  },

  // REGISTRAR VALIDATION BOX
  registrarBox: {
    backgroundColor: C.fieldGrey,
    borderWidth: 1,
    borderColor: C.fieldBorder,
    borderRadius: 16,
    padding: 12,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shieldTile: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B2C4D',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  registrarTitle: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.navy,
  },
  registrarSub: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
    marginTop: 2,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.checkGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // PASSWORD FORM
  passwordForm: {
    marginTop: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.labelGrey,
    marginBottom: 6,
  },
  inputField: {
    height: 54,
    borderRadius: 18,
    backgroundColor: C.fieldGrey,
    borderWidth: 1.5,
    borderColor: C.fieldBorder,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  inputFieldFocused: {
    backgroundColor: '#FFF8F7',
    borderColor: C.primary,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.neutral,
    height: '100%',
  },
  eyeButton: {
    padding: 8,
  },
  changePasswordBtn: {
    height: 56,
    borderRadius: 999,
    marginTop: 8,
    overflow: 'hidden',
    shadowColor: C.primary,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  changePasswordGradient: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  changePasswordText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },

  // LOGOUT BUTTON
  logoutBtn: {
    height: 54,
    borderRadius: 999,
    backgroundColor: '#FFF8F7',
    borderWidth: 1.5,
    borderColor: C.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
  },
  logoutBtnText: {
    fontSize: 15.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.primary,
  },
});
