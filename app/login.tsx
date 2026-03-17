import { Ionicons } from '@expo/vector-icons';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'update'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(''); 
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); 

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') window.alert(`${title}: ${message}`);
    else Alert.alert(title, String(message));
  };

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') setMode('update');
      if (event === 'SIGNED_IN') {
        router.replace('/(tabs)'); 
      }
    });
    
    return () => { authListener.subscription.unsubscribe(); };
  }, [router]);

  const handleEmailAuth = async () => {
    if (!email || !password) return showAlert("Error", "Please fill in all required fields");
    setLoading(true);
    
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { username: username } } });
      if (error) showAlert("Error", error.message);
      else showAlert("Success", "Account created!");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) showAlert("Error", error.message);
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      
      // ---> THE REAL WEB FIX: Let Supabase handle everything automatically <---
      if (Platform.OS === 'web') {
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
        if (error) throw error;
        return;
      }

      // ---> NATIVE ANDROID/IOS REDIRECT (Unchanged) <---
      const redirectTo = makeRedirectUri({ scheme: 'v1app' }); 
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });

      if (error) throw error;

      if (data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (res.type === 'success') {
          const parsedUrl = Linking.parse(res.url);
          const params = parsedUrl.queryParams || {};
          const fragment = parsedUrl.fragment || '';
          
          if (params.code) {
             await supabase.auth.exchangeCodeForSession(String(params.code));
          } else {
             const access_match = fragment.match(/access_token=([^&]+)/);
             const refresh_match = fragment.match(/refresh_token=([^&]+)/);
             if (access_match && refresh_match) {
                 await supabase.auth.setSession({ access_token: access_match[1], refresh_token: refresh_match[1] });
             }
          }
        }
      }
    } catch (error: any) {
      showAlert("Error", error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.centerBox}>
        <Text style={styles.logo}>V</Text>
        <Text style={styles.title}>{mode === 'login' ? 'Welcome Back' : 'Auth'}</Text>

        <View style={styles.inputContainer}>
          {mode !== 'update' && (
            <TextInput placeholder="Email" placeholderTextColor="#666" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />
          )}
          
          {mode !== 'forgot' && (
            <View style={styles.passwordContainer}>
              <TextInput placeholder="Password" placeholderTextColor="#666" style={styles.passwordInput} secureTextEntry={!showPassword} value={password} onChangeText={setPassword} />
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={22} color="#888" />
              </TouchableOpacity>
            </View>
          )}
          
          <TouchableOpacity style={styles.primaryButton} onPress={handleEmailAuth} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{mode === 'login' ? 'Login' : 'Submit'}</Text>}
          </TouchableOpacity>
        </View>

        {(mode === 'login' || mode === 'signup') && (
          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin} disabled={loading}>
             {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.googleButtonText}>Continue with Google</Text>}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, backgroundColor: '#000', justifyContent: 'center', padding: 30 },
  centerBox: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  logo: { color: '#e50914', fontSize: 60, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 40 },
  inputContainer: { gap: 15 },
  input: { backgroundColor: '#1a1a1a', color: '#fff', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  passwordInput: { flex: 1, color: '#fff', padding: 15 },
  eyeIcon: { paddingHorizontal: 15 },
  primaryButton: { backgroundColor: '#e50914', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  googleButton: { backgroundColor: '#fff', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 30 },
  googleButtonText: { color: '#000', fontWeight: 'bold' }
});