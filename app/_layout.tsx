import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

// Prevent splash screen from hiding until fonts and auth are ready 
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  // 1. FONT LOADING (Lowercase 'ionicons' is the secret key) [cite: 3, 12]
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    'ionicons': require('../public/fonts/Ionicons.ttf'), 
  });

  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  // 2. AUTH SESSION CHECK
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 3. NAVIGATION & SPLASH SCREEN CONTROL
  useEffect(() => {
    if (!fontsLoaded || authLoading) return; // Do not render until ready 

    const inAuthGroup = segments[0] === '(tabs)';

    if (!session && inAuthGroup) {
      router.replace('/login');
    } else if (session && !inAuthGroup) {
      router.replace('/(tabs)');
    }

    SplashScreen.hideAsync(); // Hide splash screen only when everything is 100% ready
  }, [session, authLoading, fontsLoaded, segments]);

  if (!fontsLoaded || authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#e50914" size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}