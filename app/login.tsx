import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) Alert.alert("Error", error.message);
      else Alert.alert("Check your email", "We sent a verification link to your inbox!");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) Alert.alert("Error", error.message);
      // onAuthStateChange in _layout.tsx handles the redirect 
    }
    setLoading(true); // Keep loading true until _layout redirects
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.logo}>V</Text>
        <Text style={styles.title}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
        
        <TextInput 
          placeholder="Email" 
          placeholderTextColor="#666" 
          style={styles.input} 
          value={email} 
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <TextInput 
          placeholder="Password" 
          placeholderTextColor="#666" 
          style={styles.input} 
          secureTextEntry 
          value={password} 
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isSignUp ? 'Get Started' : 'Sign In'}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.toggle}>
          <Text style={styles.toggleText}>
            {isSignUp ? 'Already have an account? Sign In' : 'New to V? Sign up now.'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#000', justifyContent: 'center', padding: 20 },
  inner: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  logo: { color: '#e50914', fontSize: 50, fontWeight: '900', textAlign: 'center', marginBottom: 20 },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 25 },
  input: { backgroundColor: '#333', color: '#fff', padding: 15, borderRadius: 5, marginBottom: 15 },
  button: { backgroundColor: '#e50914', padding: 15, borderRadius: 5, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  toggle: { marginTop: 25 },
  toggleText: { color: '#b3b3b3', textAlign: 'center', fontSize: 14 }
});