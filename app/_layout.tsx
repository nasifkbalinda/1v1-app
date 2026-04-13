import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import IoniconsTTF from '@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf';
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
  
  // ✅ BULLETPROOF FONT LOADING (Web + Android safe)
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,        // ensures correct font family mapping
    Ionicons: IoniconsTTF,   // forces bundler to include the font (fixes web)
  });

  // 2. AUTH SESSION LOGIC
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    // Check session on app start
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      
      if (session?.user) {
        supabase
          .from('profiles')
          .update({ last_active: new Date().toISOString() })
          .eq('id', session.user.id)
          .then();
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
      
      if (session?.user) {
        supabase
          .from('profiles')
          .update({ last_active: new Date().toISOString() })
          .eq('id', session.user.id)
          .then();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 3. NAVIGATION GUARD
  useEffect(() => {
    if (authLoading || (!fontsLoaded && !fontError)) return;

    const inAuthGroup = segments[0] === '(tabs)' || segments[0] === 'movie';

    if (!session && inAuthGroup) {
      router.replace('/login');
    } else if (session && !inAuthGroup) {
      router.replace('/(tabs)');
    }

    SplashScreen.hideAsync();
  }, [session, authLoading, fontsLoaded, fontError, segments]);

  // 4. LOADING SCREEN
  if ((!fontsLoaded && !fontError) || authLoading) {
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
      <Stack.Screen name="movie/[id]" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  );
}