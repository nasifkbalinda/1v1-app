import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type UserProfile = {
  id: string;
  email: string;
  username: string | null;
  created_at: string;
};

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Profile Editable State
  const [displayName, setDisplayName] = useState('');
  
  // Password Update State
  const [newPassword, setNewPassword] = useState('');
  
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') window.alert(`${title}: ${message}`);
    else Alert.alert(title, message);
  };

  const fetchUserData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser) {
        setUser(null);
        router.replace('/login');
        return;
      }

      // Get additional metadata or separate profiles table if you have one
      // For now, we rely on user metadata for username
      setUser({
        id: authUser.id,
        email: authUser.email!,
        username: authUser.user_metadata?.username || 'V-Stream User',
        created_at: authUser.created_at
      });
      
      setDisplayName(authUser.user_metadata?.username || '');

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Refresh data when screen gains focus
  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [fetchUserData])
  );

  const handleUpdateProfile = async () => {
    if (!displayName.trim()) return showAlert("Error", "Username cannot be empty");
    if (displayName === user?.username) return; // No change

    setSavingProfile(true);
    try {
      // Update user_metadata in Supabase Auth
      const { error } = await supabase.auth.updateUser({
        data: { username: displayName.trim() }
      });

      if (error) throw error;
      
      showAlert("Success", "Profile updated successfully!");
      fetchUserData(); // refresh local state

    } catch (error: any) {
      showAlert("Error", error.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      return showAlert("Error", "Password must be at least 6 characters");
    }
    
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      showAlert("Success", "Your password has been updated!");
      setNewPassword(''); // clear input
    } catch (error: any) {
      showAlert("Error", error.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  // Format creation date
  const joinedDate = user ? new Date(user.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  }) : '';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e50914" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ---> FIXED HEADER <--- */}
      <View style={[styles.headerFixed, { paddingTop: insets.top + 10 }]}>
        <View style={styles.webContentWrapper}>
           <Text style={styles.headerTitle}>Profile & Settings</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.webContentWrapper}>
          
          {/* ---> PROFILE AVATAR SECTION (Netflix Style) <--- */}
          <View style={styles.profileCard}>
            <View style={styles.avatarLarge}>
               <Ionicons name="person" size={50} color="#fff" />
               <View style={styles.editAvatarBadge}><Ionicons name="camera" size={12} color="#fff" /></View>
            </View>
            <View style={styles.profileEditBlock}>
                <Text style={styles.label}>Display Name</Text>
                <View style={styles.inputRow}>
                    <TextInput style={[styles.input, styles.profileInput]} placeholder="Your Name" placeholderTextColor="#666" value={displayName} onChangeText={setDisplayName} />
                    {displayName !== user?.username && displayName.trim().length > 0 && (
                        <TouchableOpacity style={styles.saveProfileButton} onPress={handleUpdateProfile} disabled={savingProfile}>
                            {savingProfile ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveProfileButtonText}>Save</Text>}
                        </TouchableOpacity>
                    )}
                </View>
            </View>
          </View>

          {/* ---> ACCOUNT INFO SECTION <--- */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeader}>Account Details</Text>
            <View style={styles.infoCard}>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Email</Text><Text style={styles.infoValue}>{user?.email}</Text></View>
                <View style={[styles.infoRow, styles.lastInfoRow]}><Text style={styles.infoLabel}>Joined</Text><Text style={styles.infoValue}>{joinedDate}</Text></View>
            </View>
          </View>

          {/* ---> SECURITY SECTION (Password Update) <--- */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeader}>Security</Text>
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Change Password</Text>
                <TextInput placeholder="Enter at least 6 characters" placeholderTextColor="#666" style={styles.input} secureTextEntry value={newPassword} onChangeText={setNewPassword} />
                <TouchableOpacity style={[styles.primaryButton, (!newPassword || newPassword.length < 6) && styles.primaryButtonDisabled]} onPress={handleUpdatePassword} disabled={savingPassword || !newPassword || newPassword.length < 6}>
                {savingPassword ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update Password</Text>}
                </TouchableOpacity>
            </View>
          </View>

          {/* ---> DANGER ZONE (Sign Out) <--- */}
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color="#e50914" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loadingContainer: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  headerFixed: { backgroundColor: '#0a0a0a', borderBottomWidth: 1, borderBottomColor: '#1f1f1f', zIndex: 100, paddingBottom: 10 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 30, paddingBottom: 60 },
  webContentWrapper: { width: '100%', maxWidth: 1200, alignSelf: 'center', paddingHorizontal: 16 },
  
  // Profile Avatar Card
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 12, padding: 20, marginBottom: 30, borderWidth: 1, borderColor: '#1f1f1f' },
  avatarLarge: { width: 90, height: 90, borderRadius: 12, backgroundColor: '#e50914', alignItems: 'center', justifyContent: 'center', marginRight: 20, position: 'relative' },
  editAvatarBadge: { position: 'absolute', bottom: -5, right: -5, backgroundColor: '#333', borderRadius: 99, padding: 4, borderWidth: 2, borderColor: '#111' },
  profileEditBlock: { flex: 1, gap: 5 },
  profileInput: { marginBottom: 0 },
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  saveProfileButton: { backgroundColor: '#e50914', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, height: 48, justifyContent: 'center' },
  saveProfileButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  // Sections
  sectionContainer: { marginBottom: 30 },
  sectionHeader: { fontSize: 14, color: '#e50914', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 },
  
  // Info Card
  infoCard: { backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: '#1f1f1f', overflow: 'hidden' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  lastInfoRow: { borderBottomWidth: 0 },
  infoLabel: { color: '#888', fontSize: 14 },
  infoValue: { color: '#fff', fontSize: 15, fontWeight: '500' },

  // Inputs & Buttons
  inputGroup: { gap: 8 },
  label: { fontSize: 13, color: '#aaa', marginBottom: 2 },
  input: { backgroundColor: '#1a1a1a', color: '#fff', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a', fontSize: 16 },
  primaryButton: { backgroundColor: '#e50914', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  primaryButtonDisabled: { backgroundColor: '#555', opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  // Sign Out
  signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#1a1a1a', padding: 16, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#e50914' },
  signOutText: { color: '#e50914', fontWeight: 'bold', fontSize: 16 }
});