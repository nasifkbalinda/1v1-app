import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

// Keep the splash screen visible 
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Use ...Ionicons.font to register the correct internal mappings [cite: 6, 21]
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    'Ionicons': require('../public/fonts/Ionicons.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Only hide the splash screen when fonts are 100% ready [cite: 7, 21]
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Fallback loading state
  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#e50914" size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}