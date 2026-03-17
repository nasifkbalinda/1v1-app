import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

// Keep the splash screen visible while everything loads
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  
  // 1. FONT LOADING LOGIC (From your old code)
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
  });

  // 2. AUTH SESSION LOGIC (From our new fix)
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    // Check session on app start
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    // Listen for sign-in/sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 3. NAVIGATION GUARD
  useEffect(() => {
    if (authLoading || !fontsLoaded) return;

    const inAuthGroup = segments[0] === '(tabs)';

    if (!session && inAuthGroup) {
      router.replace('/login');
    } else if (session && !inAuthGroup) {
      router.replace('/(tabs)');
    }
    
    // Hide splash screen once fonts AND auth are ready
    SplashScreen.hideAsync();
  }, [session, authLoading, fontsLoaded, segments]);

  // 4. LOADING SCREEN (Wait for Fonts + Auth)
  if (!fontsLoaded && !fontError || authLoading) {
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