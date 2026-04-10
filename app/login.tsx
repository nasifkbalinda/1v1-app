// @ts-nocheck
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

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
      if (event === 'PASSWORD_RECOVERY') {
        setMode('update');
      }
      if (event === 'SIGNED_IN' && session?.user) {
         // A secondary safety net: if a suspended user somehow reloads into a valid session, boot them.
         const { data } = await supabase.from('profiles').select('status').eq('id', session.user.id).single();
         if (data?.status === 'suspended') {
            await supabase.auth.signOut();
            showAlert("Account Suspended", "Your account has been suspended. Please contact support.");
         } else {
            router.replace('/(tabs)'); 
         }
      }
    });
    return () => { authListener.subscription.unsubscribe(); };
  }, [router]);

  const handleEmailAuth = async () => {
    if (!email || !password) return showAlert("Error", "Please fill in all required fields");
    if (mode === 'signup' && !username) return showAlert("Error", "Please provide a username");
    
    setLoading(true);
    
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: { data: { username: username } }
      });
      if (error) showAlert("Error", error.message);
      else showAlert("Success", "Account created! Check your email for the confirmation link.");
    } else {
      
      // 1. Attempt standard login
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
         showAlert("Error", error.message);
      } else if (data?.user) {
         
         // ---> THE BOUNCER: Check if they are suspended <---
         const { data: profile } = await supabase.from('profiles').select('status').eq('id', data.user.id).single();
         
         if (profile?.status === 'suspended') {
            // Instantly log them out and show error
            await supabase.auth.signOut();
            showAlert("Account Suspended", "Your account has been suspended. Please contact support.");
            setLoading(false);
            return;
         }
         
         // If they aren't suspended, the onAuthStateChange listener above will route them to /(tabs)
      }
    }
    
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) return showAlert("Error", "Please enter your email address");
    setLoading(true);
    
    // ---> THE BOUNCER (Password Reset): Check if email belongs to a suspended account <---
    // We use a raw query here since they aren't logged in yet
    const { data: profileCheck } = await supabase.from('profiles').select('status').eq('email', email).maybeSingle();
    
    if (profileCheck?.status === 'suspended') {
       showAlert("Account Suspended", "You cannot reset the password for a suspended account.");
       setLoading(false);
       return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) showAlert("Error", error.message);
    else {
      showAlert("Check your email", "We sent you a password reset link!");
      setMode('login');
    }
    setLoading(false);
  };

  const handleUpdatePassword = async () => {
    if (!password) return showAlert("Error", "Please enter a new password");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: password });
    if (error) showAlert("Error", error.message);
    else {
      showAlert("Success", "Your password has been updated! You can now log in normally.");
      setMode('login');
      setPassword('');
      setEmail('');
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.centerBox}>
        <Text style={styles.logo}>V</Text>
        
        <Text style={styles.title}>
          {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Reset Password' : 'Create New Password'}
        </Text>

        <View style={styles.inputContainer}>
          
          {mode === 'signup' && (
            <TextInput placeholder="Choose a Username" placeholderTextColor="#666" style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" />
          )}

          {mode !== 'update' && (
            <TextInput placeholder="Email" placeholderTextColor="#666" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          )}
          
          {mode !== 'forgot' && (
            <View style={styles.passwordContainer}>
              <TextInput 
                placeholder={mode === 'update' ? "Enter your NEW Password" : "Password"} 
                placeholderTextColor="#666" 
                style={styles.passwordInput} 
                secureTextEntry={!showPassword} 
                value={password} 
                onChangeText={setPassword} 
              />
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={22} color="#888" />
              </TouchableOpacity>
            </View>
          )}
          
          {mode === 'forgot' ? (
            <TouchableOpacity style={styles.primaryButton} onPress={handleForgotPassword} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Reset Link</Text>}
            </TouchableOpacity>
          ) : mode === 'update' ? (
            <TouchableOpacity style={styles.primaryButton} onPress={handleUpdatePassword} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save New Password</Text>}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={handleEmailAuth} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{mode === 'login' ? 'Login' : 'Sign Up'}</Text>}
            </TouchableOpacity>
          )}
        </View>

        {mode === 'login' && (
          <TouchableOpacity style={styles.forgotButton} onPress={() => setMode('forgot')}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
        )}

        {mode !== 'update' && (
          <TouchableOpacity style={styles.switchButton} onPress={() => { if (mode === 'login') setMode('signup'); else setMode('login'); }}>
            <Text style={styles.switchText}>
              {mode === 'login' ? "Don't have an account? Sign Up" : "Back to Login"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', padding: 30 },
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
  forgotButton: { alignSelf: 'flex-end', marginTop: 10 },
  forgotText: { color: '#888', fontSize: 13 },
  switchButton: { marginTop: 30 },
  switchText: { color: '#888', textAlign: 'center' }
});