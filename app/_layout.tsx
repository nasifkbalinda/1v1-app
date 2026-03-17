import { supabase } from '@/lib/supabase';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check session on start and listen for changes[cite: 23].
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoading(false);
      if (session) router.replace('/(tabs)');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(false);
      if (session) router.replace('/(tabs)');
      else router.replace('/login');
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <View style={{flex:1, backgroundColor:'#000', justifyContent:'center'}}><ActivityIndicator color="#e50914"/></View>;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}