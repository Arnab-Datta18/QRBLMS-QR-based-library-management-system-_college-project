import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerDeviceToken, unregisterDeviceToken } from '../api/client';

export const PUSH_TOKEN_STORAGE_KEY = 'expo_push_token';
const FALLBACK_EAS_PROJECT_ID = '32fea263-0d01-4719-a298-bd2a56aaa71e';

// Configure foreground notification behavior: show heads-up alert banner, sound, badge
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Configure native Android notification channels with high-priority heads-up behavior.
 */
export async function setupNotificationChannelsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('tcea-library-alerts', {
      name: 'TCEA Library Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0B2C4D',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync('tcea-library-urgent', {
      name: 'TCEA Library Urgent',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#9E1B32',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  }
}

/**
 * Registers this device for native Expo push notifications, persists the token,
 * and syncs with the Flask backend registry.
 */
export async function registerForPushNotificationsAsync(studentId: string): Promise<string | null> {
  try {
    if (!studentId) {
      console.warn('[Push] Skipping registration: No studentId provided.');
      return null;
    }

    await setupNotificationChannelsAsync();

    // Check device type (simulators cannot receive APNs/FCM directly)
    if (!Device.isDevice) {
      console.log('[Push] Must use physical device for native push notifications.');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Push] Push notification permissions were denied.');
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId ??
      FALLBACK_EAS_PROJECT_ID;

    console.log(`[Push] Resolving push token using EAS projectId: ${projectId}`);

    const pushTokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = pushTokenResponse?.data;
    if (!token) {
      console.warn('[Push] Could not retrieve Expo push token (empty data returned).');
      return null;
    }

    // Persist token in secure storage for subsequent re-sync and unregister
    await SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, token);

    // Always synchronize current token with backend registry
    const regResult = await registerDeviceToken(studentId.trim(), token, Platform.OS);
    console.log(`[Push] Registered push token for student ${studentId}: ${token}`, regResult);

    return token;
  } catch (error) {
    console.error('[Push] Failed to register push token:', error);
    return null;
  }
}

/**
 * Deactivates device token in backend and clears local storage on user logout.
 */
export async function unregisterPushNotificationsAsync(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY);
    if (token) {
      try {
        await unregisterDeviceToken(token);
        console.log('[Push] Unregistered push token on backend.');
      } catch (backendError) {
        console.warn('[Push] Backend unregister failed (ignoring on logout):', backendError);
      }
      await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
    }
  } catch (error) {
    console.error('[Push] Failed to unregister push token:', error);
  }
}
