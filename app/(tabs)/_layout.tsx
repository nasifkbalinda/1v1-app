import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768; 

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAdmin(data?.user?.email?.toLowerCase() === 'saifnasif1@gmail.com');
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAdmin(session?.user?.email?.toLowerCase() === 'saifnasif1@gmail.com');
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <Tabs
        screenOptions={{
          headerShown: false, // Ensures NO default headers are shown anywhere
          tabBarStyle: isDesktop ? { display: 'none' } : { backgroundColor: '#111', borderTopColor: '#222' },
          tabBarActiveTintColor: '#e50914',
          tabBarInactiveTintColor: '#888',
        }}
      >
        <Tabs.Screen 
          name="index" 
          options={{ title: 'Home', tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} /> }} 
        />
        <Tabs.Screen 
          name="mylist" 
          options={{ title: 'My List', tabBarIcon: ({ color }) => <Ionicons name="list" size={24} color={color} /> }} 
        />
        <Tabs.Screen 
          name="downloads" 
          options={{ title: 'Downloads', tabBarIcon: ({ color }) => <Ionicons name="download" size={24} color={color} /> }} 
        />
        <Tabs.Screen 
          name="settings" 
          options={{ title: 'Settings', tabBarIcon: ({ color }) => <Ionicons name="settings" size={24} color={color} /> }} 
        />
        <Tabs.Screen 
          name="admin" 
          options={{ 
            title: 'Admin',
            href: isAdmin ? '/admin' : null,
            tabBarIcon: ({ color }) => <Ionicons name="construct" size={24} color={color} /> 
          }} 
        />
      </Tabs>
    </View>
  );
}