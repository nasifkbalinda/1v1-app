import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

// ---> THE DESKTOP TOP NAVIGATION BAR <---
function DesktopTopNav({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

  const NavLink = ({ title, path }: { title: string, path: string }) => {
    // Check if the current route matches the button to highlight it
    const isActive = pathname === path || (path === '/' && pathname === '/index');
    
    return (
      <Pressable onPress={() => router.navigate(path)} style={styles.navItem}>
        <Text style={[styles.navText, isActive && styles.navTextActive]}>{title}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.topNavContainer}>
      <Text style={styles.logo}>V</Text>
      <View style={styles.navLinksGroup}>
        <NavLink title="Home" path="/" />
        <NavLink title="My List" path="/mylist" />
        <NavLink title="Downloads" path="/downloads" />
        <NavLink title="Settings" path="/settings" />
        {/* ONLY SHOW ADMIN LINK IF USER IS ADMIN */}
        {isAdmin && <NavLink title="Admin" path="/admin" />}
      </View>
    </View>
  );
}

// ---> THE MASTER TABS CONTROLLER <---
export default function TabsLayout() {
  // Listen to the screen width in real-time
  const { width } = useWindowDimensions();
  
  // 768px is the industry standard breakpoint for Tablets and Desktops
  const isDesktop = width > 768; 

  // ---> SECURE REAL-TIME ADMIN CHECK <---
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // ---> NEW: SILENT ACTIVITY PING <---
    const pingActiveStatus = async (user: any) => {
      if (!user) return;
      try {
        // Update this user's 'last_active' timestamp to right now
        await supabase
          .from('profiles')
          .update({ last_active: new Date().toISOString() })
          .eq('id', user.id);
      } catch (e) {
        console.log("Ping failed silently", e);
      }
    };

    // 1. Check immediately when the app loads
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user;
      if (user) {
        setIsAdmin(user.email?.toLowerCase() === 'saifnasif1@gmail.com');
        pingActiveStatus(user); // Fire the ping!
      }
    });

    // 2. Actively listen for any Google Logins or Logouts in the background
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      setIsAdmin(user?.email?.toLowerCase() === 'saifnasif1@gmail.com');
      
      // If they just logged in, fire the ping!
      if (event === 'SIGNED_IN' && user) {
         pingActiveStatus(user);
      }
    });

    // Cleanup listener when you close the app
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      
      {/* If we are on Desktop, render the Top Navigation Bar */}
      {isDesktop && <DesktopTopNav isAdmin={isAdmin} />}
      
      <Tabs
        screenOptions={{
          headerShown: false, // We use our own headers inside the screens
          // If Desktop: completely hide the bottom bar. If Mobile: show it normally.
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
        {/* DYNAMICALLY HIDE/SHOW BOTTOM ADMIN TAB */}
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

const styles = StyleSheet.create({
  topNavContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 40, 
    paddingVertical: 20, 
    backgroundColor: '#0a0a0a', 
    borderBottomWidth: 1, 
    borderBottomColor: '#1f1f1f',
    zIndex: 100 
  },
  logo: { 
    fontSize: 32, 
    fontWeight: '900', 
    color: '#e50914', 
    marginRight: 40, 
    letterSpacing: -1 
  },
  navLinksGroup: { 
    flexDirection: 'row', 
    gap: 30 
  },
  navItem: { 
    paddingVertical: 5 
  },
  navText: { 
    color: '#e5e5e5', 
    fontSize: 15, 
    fontWeight: '500', 
    transitionDuration: '0.2s' 
  },
  navTextActive: { 
    color: '#fff', 
    fontWeight: 'bold' 
  }
});