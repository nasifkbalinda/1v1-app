// @ts-nocheck
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const POSTER_WIDTH = 120;
const POSTER_HEIGHT = 180;
const CW_WIDTH = 280;
const CW_HEIGHT = 90;

type Movie = { id: string; title: string; description: string | null; poster_url: string | null; backdrop_url?: string | null; video_url: string | null; category: string | null; type: string | null; views?: number; };
const FILTERS = ['All', 'Movies', 'TV Shows', 'Action', 'Comedy', 'Adventure', 'Sci-Fi'] as const;
type Filter = (typeof FILTERS)[number];

function filterByQuery(movies: Movie[], query: string): Movie[] {
  if (!query.trim()) return movies;
  const lower = query.trim().toLowerCase();
  return movies.filter((m) => m.title.toLowerCase().includes(lower) || (m.category?.toLowerCase().includes(lower) ?? false) || (m.type?.toLowerCase().includes(lower) ?? false));
}

export default function HomeScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  
  const { width, height } = useWindowDimensions();
  const isDesktop = width > 768;

  // ---> UPDATED: State to track if user can see Admin button <---
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);
  
  const [movies, setMovies] = useState<Movie[]>([]);
  const [continueWatching, setContinueWatching] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [moviesRefreshing, setMoviesRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<Filter>('All');

  // ---> UPDATED: Check database for role instead of hardcoded email <---
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

  const applyActiveFilterToMoviesQuery = (query: any, filter: Filter) => {
    if (filter === 'All') return query;
    if (filter === 'Movies') return query.ilike('type', '%movie%');
    if (filter === 'TV Shows') return query.ilike('type', '%tv%');
    return query.ilike('category', `%${filter}%`);
  };

  const fetchMovies = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setMoviesRefreshing(true);
      
      const baseQuery = supabase.from('movies').select('*').eq('status', 'active');
      const filteredQuery = applyActiveFilterToMoviesQuery(baseQuery, activeFilter).order('id', { ascending: false }); 
      
      const { data, error } = await filteredQuery;
      if (error) throw error;
      setMovies(data ?? []);
    } catch (err) {
      console.error('Error fetching movies:', err);
    } finally {
      setLoading(false);
      setMoviesRefreshing(false);
    }
  };

  const fetchContinueWatching = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; 

      const { data, error } = await supabase
        .from('playback_progress')
        .select('timestamp_seconds, updated_at, movie_id, movies (*)')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (data && !error) {
        const validProgress = data.filter(item => item.movies !== null);
        setContinueWatching(validProgress);
      }
    } catch (err) {
      console.error('Error fetching continue watching:', err);
    }
  };

  useEffect(() => { 
    fetchMovies(true); 
    fetchContinueWatching(); 
  }, [activeFilter]);

  const handleManualRefresh = () => { 
    fetchMovies(false); 
    fetchContinueWatching(); 
  };

  const filteredMovies = useMemo(() => filterByQuery(movies, searchQuery), [movies, searchQuery]);
  const heroMovie = !searchQuery.trim() && filteredMovies.length > 0 ? filteredMovies[0] : null;
  
  const trendingMovies = useMemo(() => {
    return [...filteredMovies].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);
  }, [filteredMovies]);

  const latestUploadsMovies = useMemo(() => {
    return heroMovie 
      ? filteredMovies.filter(m => m.id !== heroMovie.id).slice(0, 12)
      : filteredMovies.slice(0, 12);
  }, [filteredMovies, heroMovie]);

  const categoryOrder = ['Action', 'Adventure', 'Comedy', 'Drama', 'Sci-Fi'];
  
  const moviesByCategory = useMemo(() => {
    const grouped: Record<string, Movie[]> = {};
    for (const movie of filteredMovies) {
      let cat = movie.category?.trim() || 'Other';
      const knownCat = FILTERS.find(f => f.toLowerCase() === cat.toLowerCase());
      if (knownCat) cat = knownCat;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(movie);
    }
    return grouped;
  }, [filteredMovies]);

  const sortedCategories = useMemo(() => {
    return Object.keys(moviesByCategory).sort((a, b) => {
      const ia = categoryOrder.indexOf(a);
      const ib = categoryOrder.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [moviesByCategory, categoryOrder]);

  const NavLink = ({ title, path }: { title: string, path: string }) => {
    const isActive = pathname === path || (path === '/' && pathname === '/index');
    return (
      <Pressable onPress={() => router.navigate(path)} style={styles.navItem}>
        <Text style={[styles.navText, isActive && styles.navTextActive]}>{title}</Text>
      </Pressable>
    );
  };

  const heroHeight = isDesktop
    ? Math.min(width / (16 / 9), height * 0.85)
    : height * 0.5;

  if (loading) return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color="#e50914" /></View>);

  return (
    <View style={styles.container}>
      <View style={[styles.unifiedHeader, { paddingTop: isDesktop ? 10 : insets.top + 10 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.logo}>V</Text>
          {isDesktop && (
            <View style={styles.primaryNav}>
              <NavLink title="Home" path="/" />
              <NavLink title="My List" path="/mylist" />
              <NavLink title="Downloads" path="/downloads" />
              <NavLink title="Settings" path="/settings" />
              {/* ---> UPDATED: Uses the new variable <--- */}
              {canAccessAdmin && <NavLink title="Admin" path="/admin" />}
            </View>
          )}
        </View>

        {isDesktop && (
          <View style={styles.headerRight}>
            <View style={styles.categoryNav}>
              {FILTERS.map((filter) => (
                <Pressable key={filter} onPress={() => setActiveFilter(filter)}>
                  <Text style={[styles.filterLink, filter === activeFilter && styles.filterLinkActive]}>{filter}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color="#888" style={{ marginRight: 8 }} />
              <TextInput style={styles.searchInput} placeholder="Search movies..." placeholderTextColor="#666" value={searchQuery} onChangeText={setSearchQuery} />
            </View>
          </View>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={moviesRefreshing} onRefresh={handleManualRefresh} tintColor="#e50914" />}>
        
        {heroMovie && (
          <View style={[styles.heroContainer, { height: heroHeight }]}>
            
            {Platform.OS === 'web' ? (
              // @ts-ignore
              <img 
                src={heroMovie.backdrop_url || heroMovie.poster_url || ''} 
                style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', opacity: 0.9 }} 
                alt="Hero Backdrop"
              />
            ) : (
              <Image source={{ uri: heroMovie.backdrop_url || heroMovie.poster_url || '' }} style={styles.heroImage} resizeMode="cover" />
            )}
            
            <LinearGradient colors={['rgba(10,10,10,0.9)', 'transparent']} start={{x: 0, y: 0}} end={{x: 0.6, y: 0}} style={StyleSheet.absoluteFillObject} />
            <LinearGradient colors={['transparent', 'rgba(10,10,10,0.8)', '#0a0a0a']} locations={[0.5, 0.85, 1]} style={StyleSheet.absoluteFillObject} />

            <View style={[styles.heroContent, isDesktop && styles.heroContentDesktop]}>
              <Text style={[styles.heroTitle, isDesktop && styles.heroTitleDesktop]} numberOfLines={2}>{heroMovie.title}</Text>
              {isDesktop && heroMovie.description && (
                <Text style={styles.heroDescription} numberOfLines={3}>{heroMovie.description}</Text>
              )}
              <View style={styles.heroButtonsRow}>
                <Pressable style={styles.heroPlayButton} onPress={() => router.push(`/movie/${heroMovie.id}`)}>
                  <Ionicons name="play" size={18} color="#000" />
                  <Text style={styles.heroPlayButtonText}>Play</Text>
                </Pressable>
                <Pressable style={styles.heroWatchlistButton} onPress={() => router.push(`/movie/${heroMovie.id}`)}>
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.heroWatchlistButtonText}>More Info</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        <View style={[styles.gridContainer, { marginTop: heroMovie ? (isDesktop ? -30 : -20) : 80 }]}>

          {!isDesktop && (
            <View style={{ marginBottom: 20 }}>
               <View style={styles.mobileSearchContainer}>
                 <Ionicons name="search" size={20} color="#888" style={{ marginRight: 10 }} />
                 <TextInput style={styles.searchInput} placeholder="Search movies..." placeholderTextColor="#666" value={searchQuery} onChangeText={setSearchQuery} />
               </View>
               <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 20 }}>
                 {FILTERS.map((filter) => (
                   <Pressable key={filter} onPress={() => setActiveFilter(filter)} style={[styles.mobileFilterPill, filter === activeFilter && styles.mobileFilterPillActive]}>
                     <Text style={[styles.mobileFilterPillText, filter === activeFilter && styles.mobileFilterPillTextActive]}>{filter}</Text>
                   </Pressable>
                 ))}
               </ScrollView>
            </View>
          )}

          {continueWatching.length > 0 && !searchQuery.trim() && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Continue Watching</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
                {continueWatching.map((item) => {
                  const movie = item.movies;
                  return (
                    <Pressable key={`cw-${movie.id}`} style={styles.cwCard} onPress={() => router.push(`/movie/${movie.id}`)}>
                      <View style={styles.cwImageContainer}>
                        <Image source={{ uri: movie.poster_url || '' }} style={styles.cwImage} resizeMode="cover" />
                        <View style={styles.cwPlayOverlay}><Ionicons name="play" size={20} color="#fff" /></View>
                      </View>
                      <View style={styles.cwInfo}>
                        <Text style={styles.cwTitle} numberOfLines={1}>{movie.title}</Text>
                        <Text style={styles.cwDesc} numberOfLines={1}>{movie.category} • {movie.type}</Text>
                      </View>
                      <View style={styles.cwProgressBg}><View style={styles.cwProgressFill} /></View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {trendingMovies.length > 0 && !searchQuery.trim() && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trending</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
                {trendingMovies.map((movie) => (
                  <Pressable key={`trending-${movie.id}`} style={styles.movieCard} onPress={() => router.push(`/movie/${movie.id}`)}>
                    <Image source={{ uri: movie.poster_url || '' }} style={styles.moviePoster} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {latestUploadsMovies.length > 0 && !searchQuery.trim() && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Latest Uploads</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
                {latestUploadsMovies.map((movie) => (
                  <Pressable key={`latest-${movie.id}`} style={styles.movieCard} onPress={() => router.push(`/movie/${movie.id}`)}>
                    <Image source={{ uri: movie.poster_url || '' }} style={styles.moviePoster} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {sortedCategories.map((category) => {
            const categoryMovies = moviesByCategory[category];
            if (!categoryMovies) return null;
            return (
              <View key={category} style={styles.section}>
                <Text style={styles.sectionTitle}>{category}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
                  {categoryMovies.map((movie) => (
                    <Pressable key={movie.id} style={styles.movieCard} onPress={() => router.push(`/movie/${movie.id}`)}>
                      <Image source={{ uri: movie.poster_url || '' }} style={styles.moviePoster} resizeMode="cover" />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            );
          })}

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loadingContainer: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  gridContainer: { width: '100%', maxWidth: 1600, alignSelf: 'center', paddingHorizontal: 20, zIndex: 10 },
  
  unifiedHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 40, width: '100%', maxWidth: 1600, alignSelf: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 30 },
  logo: { fontSize: 32, fontWeight: 'bold', color: '#e50914', marginRight: 40 },
  primaryNav: { flexDirection: 'row', gap: 24 },
  navItem: { paddingVertical: 5 },
  navText: { color: '#e5e5e5', fontSize: 13, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  navTextActive: { color: '#fff', fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,1)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 },
  
  categoryNav: { flexDirection: 'row', gap: 20 },
  filterLink: { color: '#e5e5e5', fontSize: 13, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  filterLinkActive: { color: '#fff', fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,1)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 },
  
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30,30,30,0.8)', borderRadius: 4, paddingHorizontal: 12, paddingVertical: 6, width: 220, borderWidth: 1, borderColor: '#333' },
  searchInput: { flex: 1, color: '#fff', fontSize: 13, outlineStyle: 'none' },

  mobileSearchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 8, marginBottom: 16, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#2a2a2a' },
  mobileFilterPill: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#121212', borderWidth: 1, borderColor: '#2a2a2a' },
  mobileFilterPillActive: { backgroundColor: '#e50914', borderColor: '#e50914' },
  mobileFilterPillText: { color: '#bdbdbd', fontSize: 12, fontWeight: 'bold' },
  mobileFilterPillTextActive: { color: '#fff' },

  heroContainer: { width: '100%', position: 'relative', overflow: 'hidden' },
  heroImage: { 
    ...StyleSheet.absoluteFillObject, 
    width: '100%', 
    height: '100%', 
    opacity: 0.9,
  },
  heroContent: { position: 'absolute', bottom: '15%', left: 20, right: 20, zIndex: 10 },
  heroContentDesktop: { left: 40, width: '45%', bottom: '12%' },
  
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4, marginBottom: 8 },
  heroTitleDesktop: { fontSize: 34, lineHeight: 40 },
  heroDescription: { color: '#e5e5e5', fontSize: 14, lineHeight: 20, marginBottom: 16, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  heroButtonsRow: { flexDirection: 'row', gap: 10 },
  heroPlayButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 4, gap: 6 },
  heroPlayButtonText: { color: '#000', fontSize: 14, fontWeight: 'bold' },
  heroWatchlistButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(51, 51, 51, 0.8)', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 4, gap: 6 },
  heroWatchlistButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#e5e5e5', marginBottom: 12 },
  rowScroll: { gap: 12, paddingRight: 40 },
  
  cwCard: { width: CW_WIDTH, height: CW_HEIGHT, backgroundColor: '#1a1a1a', borderRadius: 4, overflow: 'hidden', flexDirection: 'row', position: 'relative', borderWidth: 1, borderColor: '#222' },
  cwImageContainer: { width: 100, height: '100%', position: 'relative' },
  cwImage: { width: '100%', height: '100%', opacity: 0.7 },
  cwPlayOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  cwInfo: { flex: 1, padding: 10, justifyContent: 'center' },
  cwTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  cwDesc: { color: '#888', fontSize: 12 },
  cwProgressBg: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: '#333' },
  cwProgressFill: { width: '60%', height: '100%', backgroundColor: '#e50914' }, 

  movieCard: { width: POSTER_WIDTH, height: POSTER_HEIGHT, borderRadius: 4, overflow: 'hidden', backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#1f1f1f' },
  moviePoster: { width: '100%', height: '100%' }
});