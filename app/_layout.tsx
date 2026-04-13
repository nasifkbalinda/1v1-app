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
  
  // 1. FONT LOADING LOGIC (UPDATED: Removed the manual public folder requirement)
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
  });

  // 2. AUTH SESSION LOGIC
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    // Check session on app start
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      
      // --- HEARTBEAT ON LOAD ---
      if (session?.user) {
        supabase.from('profiles').update({ last_active: new Date().toISOString() }).eq('id', session.user.id).then();
      }
    });

    // Listen for sign-in/sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
      
      // --- HEARTBEAT ON STATE CHANGE ---
      // This makes your DAU / WAU / MAU stats work in the admin dashboard!
      if (session?.user) {
        supabase.from('profiles').update({ last_active: new Date().toISOString() }).eq('id', session.user.id).then();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 3. NAVIGATION GUARD (Updated to allow /movie/ screen)
  useEffect(() => {
    if (authLoading || !fontsLoaded) return;

    // Check if the current screen is inside (tabs) or the movie player
    const inAuthGroup = segments[0] === '(tabs)' || segments[0] === 'movie';

    if (!session && inAuthGroup) {
      // If not logged in but trying to access content, go to login
      router.replace('/login');
    } else if (session && !inAuthGroup) {
      // If logged in but on login/public screens, go to home
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
      <Stack.Screen name="movie/[id]" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  );
}