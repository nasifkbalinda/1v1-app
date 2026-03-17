import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      try {
        // Parse tokens from the window location hash [cite: 17, 18]
        const hash = window.location.hash.replace('#', '');
        const params = new URLSearchParams(hash);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (access_token && refresh_token) {
          // Explicitly set the session so Supabase persists it [cite: 18]
          await supabase.auth.setSession({ access_token, refresh_token });
        }

        const { data } = await supabase.auth.getSession();
        
        // Clean URL and redirect [cite: 18, 19]
        window.history.replaceState({}, document.title, '/');
        router.replace(data.session ? '/(tabs)' : '/login');
      } catch (e) {
        console.error('Web auth callback failed', e);
        router.replace('/login');
      }
    };

    if (typeof window !== 'undefined') {
      run();
    }
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator size="large" color="#e50914" />
    </View>
  );
}