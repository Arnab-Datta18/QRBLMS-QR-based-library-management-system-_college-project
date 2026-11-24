import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LogBox } from 'react-native';
import { NavigationContainer, DefaultTheme, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import {
  useFonts,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';

// Prevent native splash screen from hiding before fonts/assets load
SplashScreen.preventAutoHideAsync();

LogBox.ignoreLogs(['[expo-notifications]', 'expo-notifications']);

import Login from './screens/Login';
import Home from './screens/Home';
import Academics from './screens/Academics';
import Borrowed from './screens/Borrowed';
import Profile from './screens/Profile';
import NotificationsScreen from './screens/Notifications';
import { clearTokens, getStudentId } from './api/auth';
import {
  setupNotificationChannelsAsync,
  registerForPushNotificationsAsync,
  unregisterPushNotificationsAsync,
} from './utils/pushNotifications';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Floating Tab Bar Component
function CustomTabBar({ state, navigation }: any) {
  const [fontsLoaded] = useFonts({ PlusJakartaSans_700Bold });

  // Only render Home, Borrowed, Academics in the floating bottom pill
  const visibleRoutes = state.routes.filter(
    (route: any) => route.name !== 'Profile' && route.name !== 'Notifications'
  );

  return (
    <View style={tabStyles.container}>
      <View style={tabStyles.pill}>
        {visibleRoutes.map((route: any) => {
          // If user is on Profile screen, isFocused is false for all 3 tabs!
          const isFocused = state.routes[state.index]?.name === route.name;
          
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          let iconName: any = 'home';
          if (route.name === 'Home') iconName = 'home';
          else if (route.name === 'Borrowed') iconName = 'book';
          else if (route.name === 'Academics') iconName = 'school';

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              style={[tabStyles.tabButton, isFocused && tabStyles.tabButtonFocused]}
            >
              <Ionicons 
                name={isFocused ? iconName : `${iconName}-outline`} 
                size={18} 
                color={isFocused ? '#fff' : '#0B2C4D'} 
              />
              {fontsLoaded && (
                <Text style={[tabStyles.tabText, !isFocused && tabStyles.tabTextInactive]}>
                  {route.name}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
    elevation: 0,
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 999,
    padding: 6,
    gap: 4,
    shadowColor: '#0B2C4D',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  tabButtonFocused: {
    backgroundColor: '#C81E27',
  },
  tabText: {
    color: '#fff',
    marginLeft: 6,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13.5,
  },
  tabTextInactive: {
    color: '#0B2C4D',
  },
});

// Bottom Tabs setup
function MainTabs({ navigation }: any) {
  const handleLogout = async () => {
    try {
      await unregisterPushNotificationsAsync();
    } catch (e) {
      console.warn('Unregister push on logout error:', e);
    }
    try {
      await clearTokens();
    } catch (e) {
      console.warn('Logout error:', e);
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Borrowed" component={Borrowed} />
      <Tab.Screen name="Academics" component={Academics} />
      <Tab.Screen name="Profile">
        {props => <Profile {...props} onLogout={handleLogout} />}
      </Tab.Screen>
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const navigationRef = useNavigationContainerRef();

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    JetBrainsMono_700Bold,
  });

  // Deep linking helper for push notifications
  const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    try {
      const data = response?.notification?.request?.content?.data as any;
      const targetScreen = data?.screen || data?.route;
      if (!targetScreen) return;

      const validTabs = ['Home', 'Borrowed', 'Academics', 'Profile', 'Notifications'];
      if (validTabs.includes(targetScreen)) {
        if (navigationRef.isReady()) {
          (navigationRef as any).navigate('MainTabs', { screen: targetScreen });
        } else {
          setTimeout(() => {
            if (navigationRef.isReady()) {
              (navigationRef as any).navigate('MainTabs', { screen: targetScreen });
            }
          }, 600);
        }
      }
    } catch (err) {
      console.warn('Error handling notification response navigation:', err);
    }
  };

  // Push notification channels & response listener setup
  useEffect(() => {
    // 1. Configure high-priority Android notification channels
    setupNotificationChannelsAsync().catch(err => {
      console.warn('Notification channel setup error:', err);
    });

    // 2. Re-sync push token if user already has an active session
    getStudentId().then(studentId => {
      if (studentId) {
        registerForPushNotificationsAsync(studentId).catch(err => {
          console.warn('Push notification re-sync error:', err);
        });
      }
    });

    // 3. Handle cold-start launch from killed state
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) {
        handleNotificationResponse(response);
      }
    });

    // 4. Handle foreground / background taps on received notifications
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      handleNotificationResponse(response);
    });

    return () => {
      responseSubscription.remove();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function hideSplash() {
      if (fontsLoaded) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        if (isMounted) {
          try {
            await SplashScreen.hideAsync();
          } catch (e) {
            console.warn('Error hiding splash screen:', e);
          }
        }
      }
    }
    hideSplash();
    return () => {
      isMounted = false;
    };
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <NavigationContainer ref={navigationRef} theme={DefaultTheme}>
      <Stack.Navigator initialRouteName="Login">
        {/* Login Screen (No Header) */}
        <Stack.Screen
          name="Login"
          component={Login}
          options={{ headerShown: false }}
        />

        {/* Main App (Header now handled internally per screen) */}
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
