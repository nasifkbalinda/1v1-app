import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function TabLayout() {
  
  useEffect(() => {
    // ---> THE GLOBAL WEB TOKEN RESCUE <---
    // This catches the Google token the moment you land on the Home page or any tab!
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const url = window.location.href;
      
      if (url.includes('access_token') && url.includes('refresh_token')) {
        console.log("Tokens spotted in the URL! Rescuing...");
        
        const getParam = (stringUrl: string, key: string) => {
          const match = stringUrl.match(new RegExp('[#?&]' + key + '=([^&]+)'));
          return match ? match[1] : null;
        };
        
        const access_token = getParam(url, 'access_token');
        const refresh_token = getParam(url, 'refresh_token');
        
        if (access_token && refresh_token) {
          // Force Supabase to log you in instantly
          supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
            if (!error) {
              console.log("Successfully logged in via URL tokens!");
              // Clean up the address bar so it looks professional and removes the messy token
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          });
        }
      }
    }
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { 
          backgroundColor: '#0a0a0a', 
          borderTopColor: '#1f1f1f',
          display: Platform.OS === 'web' ? 'none' : 'flex', // Hides bottom bar on web
        },
        tabBarActiveTintColor: '#e50914',
        tabBarInactiveTintColor: '#888',
      }}>
      <Tabs.Screen 
        name="index" 
        options={{ title: 'Home', tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} /> }} 
      />
      <Tabs.Screen 
        name="mylist" 
        options={{ title: 'My List', tabBarIcon: ({ color }) => <Ionicons name="bookmark" size={24} color={color} /> }} 
      />
      <Tabs.Screen 
        name="downloads" 
        options={{ title: 'Downloads', tabBarIcon: ({ color }) => <Ionicons name="download" size={24} color={color} /> }} 
      />
      <Tabs.Screen 
        name="settings" 
        options={{ title: 'Settings', tabBarIcon: ({ color }) => <Ionicons name="settings" size={24} color={color} /> }} 
      />
    </Tabs>
  );
}