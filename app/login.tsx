import { makeRedirectUri } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      if (Platform.OS === 'web') {
        // Redirect Web users to the specific callback route.
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        return;
      }

      // Android Flow: Handle the deep link manually[cite: 13, 14].
      const redirectTo = makeRedirectUri({ scheme: 'v1app', path: 'auth/callback' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });

      if (error) throw error;
      const res = await WebBrowser.openAuthSessionAsync(data?.url ?? '', redirectTo);
      if (res.type === 'success') {
        const params = new URLSearchParams(res.url.split('#')[1] ?? '');
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>V</Text>
      <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin} disabled={loading}>
         {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.googleButtonText}>Continue with Google</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  logo: { color: '#e50914', fontSize: 60, fontWeight: '900', marginBottom: 40 },
  googleButton: { backgroundColor: '#fff', padding: 15, borderRadius: 8, width: '80%', alignItems: 'center' },
  googleButtonText: { color: '#000', fontWeight: 'bold' }
});