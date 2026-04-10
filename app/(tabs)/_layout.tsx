// @ts-nocheck
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { supabase } from '@/lib/supabase'; // ---> NEW: Imported Supabase to check roles <---
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  // ---> NEW: State to track if user is an Admin <---
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);

  // ---> NEW: Database check for user role on the layout level <---
  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (data && (data.role === 'super_admin' || data.role === 'manager')) {
          setCanAccessAdmin(true);
        } else {
          setCanAccessAdmin(false);
        }
      } else {
        setCanAccessAdmin(false);
      }
    };

    checkRole();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        checkRole();
      } else {
        setCanAccessAdmin(false);
      }
    });
    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  // We only show the bottom tab bar on mobile. Desktop has it in index.tsx
  const showTabBar = !isDesktop;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'dark'].tint,
        headerShown: useClientOnlyValue(false, true),
        tabBarStyle: { 
          backgroundColor: '#121212', 
          borderTopColor: '#2a2a2a', 
          height: 60,
          paddingBottom: 8,
          position: 'absolute', // Ensures content scrolls under on mobile too
          display: showTabBar ? 'flex' : 'none',
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', color: '#bdbdbd' },
      }}>
      
      {/* 1. Home tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'V-Stream', 
          tabBarLabel: 'Home',
          headerShown: false, 
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={24} color={color} />,
        }}
      />
      
      {/* 2. My List tab */}
      <Tabs.Screen
        name="mylist"
        options={{
          title: 'My List',
          tabBarLabel: 'My List',
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="list-outline" size={24} color={color} />,
        }}
      />
      
      {/* 3. Downloads tab */}
      <Tabs.Screen
        name="downloads"
        options={{
          title: 'Downloads',
          tabBarLabel: 'Downloads',
          headerShown: false,
          tabBarIcon: ({ color }) => <Ionicons name="download-outline" size={24} color={color} />,
        }}
      />
      
      {/* ---> UPDATED: Admin tab is now dynamically hidden based on role <--- */}
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin Panel',
          tabBarLabel: 'Admin',
          headerShown: false, 
          // Setting href to null completely removes the icon from the bottom bar
          href: canAccessAdmin ? '/admin' : null, 
          tabBarIcon: ({ color }) => <Ionicons name="lock-closed-outline" size={24} color={color} />,
        }}
      />
      
      {/* 5. Settings -> Profile Tab */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Account Settings',
          tabBarLabel: 'Profile', 
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.profileIconWrapper, focused && styles.profileIconWrapperFocused]}>
              <Image source={{ uri: 'https://api.dicebear.com/7.x/avataaars/png?seed=vstream&backgroundColor=e50914' }} style={styles.mobileProfileAvatar} />
            </View>
          ),
        }}
      />

    </Tabs>
  );
}

const styles = StyleSheet.create({
  profileIconWrapper: {
    padding: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  profileIconWrapperFocused: {
    borderColor: '#e50914',
    borderWidth: 1,
  },
  mobileProfileAvatar: { width: 24, height: 24, borderRadius: 4 },
});