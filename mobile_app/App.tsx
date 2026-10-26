import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LogBox } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';

LogBox.ignoreLogs(['[expo-notifications]', 'expo-notifications']);

import Login from './screens/Login';
import Home from './screens/Home';
import Academics from './screens/Academics';
import Borrowed from './screens/Borrowed';
import Profile from './screens/Profile';
import Notifications from './screens/Notifications';
import { clearTokens } from './api/auth';

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
      <Tab.Screen name="Notifications" component={Notifications} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer theme={DefaultTheme}>
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
