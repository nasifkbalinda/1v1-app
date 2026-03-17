import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { 
          backgroundColor: '#0a0a0a', 
          borderTopColor: '#1f1f1f',
          display: Platform.OS === 'web' ? 'none' : 'flex',
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