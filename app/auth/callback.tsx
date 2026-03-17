import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      try {
        const hash = window.location.hash.replace('#', '');
        const params = new URLSearchParams(hash);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (access_token && refresh_token) {
          // Force persistence in browser[cite: 18].
          await supabase.auth.setSession({ access_token, refresh_token });
        }
        
        const { data } = await supabase.auth.getSession();
        window.history.replaceState({}, document.title, '/');
        router.replace(data.session ? '/(tabs)' : '/login');
      } catch (e) {
        router.replace('/login');
      }
    };
    run();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator size="large" color="#e50914" />
    </View>
  );
}