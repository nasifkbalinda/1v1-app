import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const isWeb = Platform.OS === 'web';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Web uses standard browser localStorage automatically 
    // Native uses AsyncStorage to survive app restarts [cite: 8, 9]
    storage: isWeb ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Web detects tokens in URL; Native is handled manually [cite: 8, 9]
    detectSessionInUrl: isWeb, 
  },
});