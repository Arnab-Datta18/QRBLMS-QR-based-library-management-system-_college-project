import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, StatusBar, ActivityIndicator, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, PlusJakartaSans_500Medium, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { getPyqs, baseURL } from '../api/client';
import { getStudentId } from '../api/auth';

const C = {
  primary: '#C81E27', tertiary: '#E0533C', navy: '#0B2C4D', navyDeep: '#071B31',
  neutral: '#111827', surface: '#EEF1FB', pale: '#E6EAF8', muted: '#6B7280',
  amber: '#D97706',
};

export default function AcademicsScreen({ navigation: propNav }: any) {
  const navigation = propNav || useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [loaded] = useFonts({ PlusJakartaSans_500Medium, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, JetBrainsMono_700Bold });
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState<any[]>([]);

  const fetchPYQs = useCallback(async () => {
    try {
      setLoading(true);
      const studentId = await getStudentId();
      if (!studentId) return;

      const response = await getPyqs(studentId);
      setPapers(response.pyqs || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPYQs();
    }, [fetchPYQs])
  );

  // Preserve this search filtering logic but with safe fallbacks
  const list = useMemo(() => papers.filter(p =>
    ((p.title || '') + (p.subject || '')).toLowerCase().includes(query.trim().toLowerCase())
  ), [query, papers]);

  const getFullPdfUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const serverUrl = baseURL.replace('/api', '');
    return `${serverUrl}${url}`;
  };

  const handleDownload = async (p: any) => {
    const code = p.code || p.subject || 'PYQ';
    const title = p.title || 'Unknown_Paper';
    Alert.alert("Download Started", "Downloading " + code + "_" + title + ".pdf...");
    
    const url = getFullPdfUrl(p.pdf_url || p.file_url);
    if (!url) {
      Alert.alert('Error', 'No PDF file available for this paper.');
      return;
    }

    const fileName = `${code}_${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;

    try {
      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      await Sharing.shareAsync(uri);
    } catch (error) {
      Alert.alert('Error', 'Failed to download the PDF.');
      console.error(error);
    }
  };

  const handleView = async (p: any) => {
    const code = p.code || p.subject || 'PYQ';
    const title = p.title || 'Unknown_Paper';
    const url = getFullPdfUrl(p.pdf_url || p.file_url);
    if (!url) {
      Alert.alert('Error', 'No PDF file available for this paper.');
      return;
    }

    const fileName = `${code}_${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

    try {
      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      
      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(uri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: 'application/pdf',
        });
      } else {
        await Sharing.shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open the PDF.');
      console.error(error);
    }
  };

  if (!loaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Colourful header */}
        <LinearGradient colors={[C.navyDeep, C.navy, '#1B4A7A']} style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View style={[s.blob, { width: 220, height: 220, top: -70, right: -60, backgroundColor: C.primary, opacity: 0.35 }]} />
          <View style={[s.blob, { width: 140, height: 140, bottom: -20, left: -50, backgroundColor: C.tertiary, opacity: 0.22 }]} />

          <View style={s.topRow}>
            <View>
              <Text style={s.brand}>TCEA Library</Text>
              <Text style={s.brandSub}>Academics</Text>
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
            <View style={s.titleBar} />
            <Text style={s.title}>Digital Archives</Text>
          </View>
          <Text style={s.subtitle}>Previous-year question papers</Text>

          <View style={s.search}>
            <Ionicons name="search" size={20} color={C.primary} />
            <TextInput
              style={s.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search subject name or paper code"
              placeholderTextColor="#8A94A8"
              numberOfLines={1}
            />
            <View style={s.mic}><Ionicons name="mic-outline" size={18} color="#fff" /></View>
          </View>
        </LinearGradient>

        {/* List header */}
        <View style={s.listHead}>
          <View style={s.count}><Text style={s.countText}>{list.length} Listed</Text></View>
        </View>

        {loading && papers.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={C.primary} />
          </View>
        ) : list.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="document-text-outline" size={36} color="#9AA3B5" />
            <Text style={s.emptyText}>No papers found. Try a different search.</Text>
          </View>
        ) : (
          list.map((p, index) => (
            <View key={p.paper_id ? String(p.paper_id) : `pyq-${index}`} style={s.card}>
              <View style={s.cardTop}>
                <LinearGradient colors={[C.tertiary, C.primary, '#A5141C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.pdf}>
                  <Ionicons name="document-text" size={30} color="#fff" />
                  <Text style={s.pdfLabel}>PDF</Text>
                  <Text style={s.pdfSize}>{p.size || '1.4 MB'}</Text>
                </LinearGradient>

                <View style={{ flex: 1 }}>
                  <View style={s.metaRow}>
                    <View style={s.codePill}><Text style={s.codeText}>{p.subject || 'PYQ'}</Text></View>
                    <Text style={s.year}>Year {p.year || '2025'}</Text>
                  </View>
                  <Text style={s.paperTitle} numberOfLines={2}>{p.title || 'Unknown Paper'}</Text>
                  <View style={s.examRow}>
                    <View style={[s.examDot, { backgroundColor: (p.exam && p.exam.startsWith('Mid')) ? C.primary : C.amber }]} />
                    <Text style={s.examText}>{p.exam || 'End-Semester Examination'}</Text>
                  </View>
                </View>
              </View>

              <View style={s.btnRow}>
                <Pressable 
                  onPress={() => handleView(p)}
                  style={({ pressed }) => [s.view, pressed && { backgroundColor: C.pale }]}
                >
                  <Ionicons name="eye-outline" size={19} color={C.navy} />
                  <Text style={s.viewText}>View</Text>
                </Pressable>
                <Pressable 
                  onPress={() => handleDownload(p)}
                  style={({ pressed }) => ({ flex: 1.3, transform: [{ scale: pressed ? 0.97 : 1 }] })}
                >
                  <LinearGradient colors={['#10B981', '#0B8A5F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.download}>
                    <Ionicons name="download-outline" size={19} color="#fff" />
                    <Text style={s.downloadText}>Download</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const shadow = { shadowColor: '#0B2C4D', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 };
const s = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 26, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, color: '#fff' },
  brandSub: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#FFB3A8', letterSpacing: 0.5 },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: C.tertiary, borderWidth: 1.5, borderColor: C.navy },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22 },
  titleBar: { width: 6, height: 34, borderRadius: 3, backgroundColor: C.tertiary },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 30, color: '#fff', letterSpacing: -0.5 },
  subtitle: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: '#C9D6E8', marginTop: 4, marginLeft: 18 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 999, height: 56, paddingLeft: 18, paddingRight: 8, marginTop: 18, ...shadow, shadowOpacity: 0.25 },
  searchInput: { flex: 1, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14.5, color: C.neutral },
  mic: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' },
  listHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginTop: 22, marginBottom: 14 },
  count: { backgroundColor: C.navy, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 },
  countText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#fff' },
  empty: { alignItems: 'center', gap: 10, padding: 30 },
  emptyText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: C.muted, textAlign: 'center' },
  card: { marginHorizontal: 20, marginBottom: 16, backgroundColor: '#fff', borderRadius: 26, padding: 18, ...shadow },
  cardTop: { flexDirection: 'row', gap: 14 },
  pdf: { width: 70, height: 88, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: C.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  pdfLabel: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 10, color: 'rgba(255,255,255,0.85)', letterSpacing: 1, marginTop: -2 },
  pdfSize: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12.5, color: '#fff', marginTop: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codePill: { backgroundColor: '#FDE7E4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  codeText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12.5, color: C.primary, letterSpacing: 0.5 },
  year: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: '#4B5C75' },
  paperTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 18, lineHeight: 23, color: C.neutral, marginTop: 8 },
  examRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 },
  examDot: { width: 8, height: 8, borderRadius: 4 },
  examText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: C.muted },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  view: { flex: 1, height: 50, borderRadius: 999, borderWidth: 1.5, borderColor: C.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  viewText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14.5, color: C.navy },
  download: { height: 50, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#10B981', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  downloadText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14.5, color: '#fff' },
});
