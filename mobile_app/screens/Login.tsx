import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  ActivityIndicator, 
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
  Pressable,
  StatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, PlusJakartaSans_500Medium, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { useFocusEffect } from '@react-navigation/native';

import { loginWithCredentials, getRefreshToken, storeAuthData, getSavedStudentId } from '../api/auth';
import apiClient from '../api/client';
import * as LocalAuthentication from 'expo-local-authentication';

const withTimeout = (promise: Promise<any>, ms = 3000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('OS_SENSOR_TIMEOUT')), ms))
  ]);
};

const C = {
  primary: '#C81E27', tertiary: '#E0533C', navy: '#0B2C4D', navyDeep: '#071B31',
  neutral: '#111827', surface: '#EEF1FB', field: '#F3F5FD', border: '#DDE3F3', muted: '#6B7280',
};

const Field = ({ label, icon, right, focused, ...props }: any) => (
  <View style={{ marginBottom: 16 }}>
    <Text style={s.label}>{label}</Text>
    <View style={[s.field, focused && s.fieldFocused]}>
      <Ionicons name={icon} size={20} color={focused ? C.primary : '#8A94A8'} />
      <TextInput style={s.input} placeholderTextColor="#9AA3B5" {...props} />
      {right}
    </View>
  </View>
);

export default function Login({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [loaded] = useFonts({ 
    PlusJakartaSans_500Medium, 
    PlusJakartaSans_700Bold, 
    PlusJakartaSans_800ExtraBold 
  });
  
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isBioLoading, setIsBioLoading] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [hasSavedSession, setHasSavedSession] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [rememberId, setRememberId] = useState(true);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const checkBiometrics = async () => {
    try {
      const hasHardware = await withTimeout(LocalAuthentication.hasHardwareAsync());
      const isEnrolled = await withTimeout(LocalAuthentication.isEnrolledAsync());
      const token = await getRefreshToken();
      const savedId = await getSavedStudentId();
      if (savedId) {
        setStudentId(savedId);
      } else {
        setStudentId('');
      }
      setBiometricsAvailable(hasHardware && isEnrolled);
      setHasSavedSession(!!token);
    } catch (error) {
      console.warn("Biometric hardware check failed or timed out", error);
      setBiometricsAvailable(false);
      setHasSavedSession(false);
      setStudentId('');
    }
  };

  useFocusEffect(
    useCallback(() => {
      checkBiometrics();
      setPassword('');
    }, [])
  );

  const handleLogin = async () => {
    if (!studentId || !password) {
      Alert.alert('Error', 'Please enter both Student ID and Password');
      return;
    }
    setLoading(true);
    try {
      const data = await loginWithCredentials(studentId, password);
      navigation.replace('MainTabs');
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Invalid credentials';
      Alert.alert('Login Failed', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    console.log("Biometric button clicked!"); 
    setIsBioLoading(true);
    try {
      const hasHardware = await withTimeout(LocalAuthentication.hasHardwareAsync());
      if (!hasHardware) {
        Alert.alert('Error', 'No biometric hardware detected.');
        return;
      }

      const isEnrolled = await withTimeout(LocalAuthentication.isEnrolledAsync());
      if (!isEnrolled) {
        Alert.alert('Error', 'No biometrics enrolled on this device.');
        return;
      }

      const authResult = await withTimeout(
        LocalAuthentication.authenticateAsync({
          promptMessage: 'Login to TCEA Library',
          cancelLabel: 'Cancel',
          fallbackLabel: 'Use Password',
        }),
        30000 
      );

      if (authResult.success) {
        setLoading(true);
        try {
          const refreshToken = await getRefreshToken();
          if (!refreshToken) {
            Alert.alert('Notice', 'Please login manually with your password first to enable biometrics.');
            return; 
          }

          const response = await apiClient.post('/refresh', { refresh_token: refreshToken });
          const data = response.data;

          if (data.refresh_token && data.student_id) {
            await storeAuthData(data.refresh_token, data.student_id);
          }

          navigation.replace('MainTabs');
        } catch (apiError: any) {
          const errorMsg = apiError.response?.data?.message || apiError.response?.data?.error || apiError.message || 'Failed to authenticate with server.';
          Alert.alert('Login Failed', errorMsg);
        } finally {
          setLoading(false);
        }
      }
    } catch (error: any) {
      console.error("Biometric Crash:", error);
      const errMsg = error?.message?.toLowerCase() || '';
      if (errMsg.includes('os_sensor_timeout') || errMsg.includes('timeout')) {
        Alert.alert('Scanner Timeout', 'The fingerprint sensor timed out. Please try again or use your password.');
      } else {
        Alert.alert('Error', 'The biometric scanner encountered an unexpected error.');
      }
    } finally {
      setIsBioLoading(false);
    }
  };

  if (!loaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Colourful hero */}
          <LinearGradient colors={[C.navyDeep, C.navy, '#1B4A7A']} style={[s.hero, { paddingTop: insets.top + 32 }]}>
            <View style={[s.blob, { width: 240, height: 240, top: -80, right: -80, backgroundColor: C.primary, opacity: 0.38 }]} />
            <View style={[s.blob, { width: 150, height: 150, bottom: 40, left: -60, backgroundColor: C.tertiary, opacity: 0.24 }]} />

            <View style={s.logoRing}>
              <Image source={require('../assets/logo.png')} style={s.logo} resizeMode="contain" />
            </View>
            <Text style={s.title}>Student Portal</Text>
            <Text style={s.sub}>Login to view your catalog, borrow history & digital exam archives</Text>
          </LinearGradient>

          {/* Overlapping login card */}
          <View style={s.card}>
            <Field
              label="ROLL NUMBER / REGISTRATION NO."
              icon="id-card-outline"
              placeholder="e.g. CSE1/2024-CST-042"
              value={studentId}
              onChangeText={setStudentId}
              autoCapitalize="characters"
              focused={focusedInput === 'studentId'}
              onFocus={() => setFocusedInput('studentId')}
              onBlur={() => setFocusedInput(null)}
            />
            <Field
              label="PASSWORD"
              icon="lock-closed-outline"
              placeholder="Enter password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              focused={focusedInput === 'password'}
              onFocus={() => setFocusedInput('password')}
              onBlur={() => setFocusedInput(null)}
              right={
                <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#8A94A8" />
                </Pressable>
              }
            />

            <Pressable style={s.remember} onPress={() => setRememberId(!rememberId)}>
              <View style={[s.box, rememberId && s.boxOn]}>
                {rememberId && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={s.rememberText}>Remember ID</Text>
            </Pressable>

            <Pressable 
              onPress={handleLogin} 
              disabled={loading} 
              style={({ pressed }) => ({ transform: [{ scale: pressed && !loading ? 0.97 : 1 }], opacity: loading ? 0.8 : 1 })}
            >
              <LinearGradient colors={[C.tertiary, C.primary, '#A5141C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.signIn}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={s.signInText}>SIGN IN</Text>
                    <View style={s.arrow}><Ionicons name="arrow-forward" size={16} color={C.primary} /></View>
                  </>
                )}
              </LinearGradient>
            </Pressable>

            {biometricsAvailable && hasSavedSession && (
              <>
                <View style={s.divider}>
                  <View style={s.line} /><Text style={s.or}>or</Text><View style={s.line} />
                </View>

                <Pressable 
                  onPress={handleBiometricLogin} 
                  disabled={loading || isBioLoading} 
                  style={({ pressed }) => [s.bio, pressed && !(loading || isBioLoading) && { backgroundColor: '#E6EAF8' }, (loading || isBioLoading) && { opacity: 0.6 }]}
                >
                  <Ionicons name="scan-outline" size={20} color={C.navy} />
                  <Text style={s.bioText}>{isBioLoading ? "Waking up scanner..." : "Sign in with Face ID / Fingerprint"}</Text>
                </Pressable>
              </>
            )}
          </View>

          {/* Footer */}
          <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={s.foot1}>Techno India Group  •  Approved by AICTE</Text>
            <Text style={s.foot2}>TECHNO COLLEGE OF ENGINEERING AGARTALA</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const shadow = { shadowColor: '#0B2C4D', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 8 };
const s = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 84, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden', alignItems: 'center' },
  blob: { position: 'absolute', borderRadius: 999 },
  logoRing: { marginTop: 10, width: 104, height: 104, borderRadius: 52, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.35)', ...shadow },
  logo: { width: 88, height: 88, borderRadius: 44 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 30, color: '#fff', marginTop: 18, letterSpacing: -0.5 },
  sub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14.5, lineHeight: 21, color: '#C9D6E8', textAlign: 'center', marginTop: 8, maxWidth: 300 },
  card: { marginHorizontal: 20, marginTop: -56, backgroundColor: '#fff', borderRadius: 30, padding: 22, ...shadow },
  label: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12.5, color: C.navy, letterSpacing: 0.6, marginBottom: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.field, borderWidth: 1.5, borderColor: C.border, borderRadius: 18, paddingHorizontal: 16, height: 56 },
  fieldFocused: { borderColor: C.primary, backgroundColor: '#FFF8F7' },
  input: { flex: 1, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15.5, color: C.neutral },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20, marginTop: 2 },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: '#B7C0D4', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: C.primary, borderColor: C.primary },
  rememberText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: '#4B5563' },
  signIn: { height: 58, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  signInText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: '#fff', letterSpacing: 1 },
  arrow: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  line: { flex: 1, height: 1, backgroundColor: C.border },
  or: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: C.muted },
  bio: { height: 54, borderRadius: 999, borderWidth: 1.5, borderColor: C.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  bioText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.navy },
  footer: { alignItems: 'center', marginTop: 'auto', paddingTop: 28, gap: 4 },
  foot1: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: '#4B5563' },
  foot2: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11, color: '#8A94A8', letterSpacing: 0.4 },
});
