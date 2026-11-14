import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Image, StatusBar, Dimensions } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Hold native splash screen while JS bundle loads
SplashScreen.preventAutoHideAsync();

const { width } = Dimensions.get('window');
const LOGO_SIZE = Math.min(width * 0.72, 280);

export default function Splash({ navigation }: any) {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Loop rotation animation over 8000ms with linear easing
    const animation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const initSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        console.warn('Error hiding native splash:', e);
      }
      animation.start();
    };

    initSplash();

    // Timer that waits 3000ms, then navigates to Login
    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, 3000);

    return () => {
      animation.stop();
      clearTimeout(timer);
    };
  }, [navigation, spinValue]);

  // Interpolate 0 -> 1 to 0deg -> 360deg
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Rotating outer QR ring */}
      <Animated.Image
        source={require('../assets/splash_ring.png')}
        style={[
          styles.image,
          {
            transform: [{ rotate: spin }],
          },
        ]}
        resizeMode="contain"
      />

      {/* Static center logo sitting on top */}
      <Image
        source={require('../assets/splash_logo.png')}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    position: 'absolute',
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
});
