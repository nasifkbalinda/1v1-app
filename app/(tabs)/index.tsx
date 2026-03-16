import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const POSTER_WIDTH = 110;
const POSTER_HEIGHT = 160;
const FEATURED_WIDTH = 380;
const FEATURED_HEIGHT = 220;

type Movie = { id: string; title: string; description: string | null; poster_url: string | null; video_url: string | null; category: string | null; type: string | null; duration_seconds?: number | null; views?: number; };
const FILTERS = ['All', 'Movies', 'TV Shows', 'Action', 'Comedy', 'Adventure', 'Sci-Fi'] as const;
type Filter = (typeof FILTERS)[number];

function filterByQuery(movies: Movie[], query: string): Movie[] {
  if (!query.trim()) return movies;
  const lower = query.trim().toLowerCase();
  return movies.filter((m) => m.title.toLowerCase().includes(lower) || (m.category?.toLowerCase().includes(lower) ?? false) || (m.type?.toLowerCase().includes(lower) ?? false) || (m.description?.toLowerCase().includes(lower) ?? false));
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [movies, setMovies] = useState<Movie[]>([]);
  // ---> NEW STATE FOR CONTINUE WATCHING <---
  const [continueWatching, setContinueWatching] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [moviesRefreshing, setMoviesRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<Filter>('All');

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
      setMovies([]);
    } finally {
      setLoading(false);
      setMoviesRefreshing(false);
    }
  };

  // ---> NEW FUNCTION: Fetch User's Playback Progress <---
  const fetchContinueWatching = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // If not logged in, just skip it

      // Fetch the progress AND join it with the movie details automatically!
      const { data, error } = await supabase
        .from('playback_progress')
        .select(`
          timestamp_seconds,
          updated_at,
          movie_id,
          movies (*)
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }) // Get the most recently watched first
        .limit(10);

      if (data && !error) {
        // Filter out any broken links (e.g. if a movie was deleted but progress remained)
        const validProgress = data.filter(item => item.movies !== null);
        setContinueWatching(validProgress);
      }
    } catch (err) {
      console.error('Error fetching continue watching:', err);
    }
  };

  useEffect(() => { 
    fetchMovies(true); 
    fetchContinueWatching(); // Call our new function on load!
  }, [activeFilter]);

  const handleManualRefresh = () => { 
    fetchMovies(false); 
    fetchContinueWatching(); 
  };

  const filteredMovies = useMemo(() => filterByQuery(movies, searchQuery), [movies, searchQuery]);
  
  const featuredRowMovies = filteredMovies.slice(0, 4);
  
  const trendingMovies = useMemo(() => {
    return [...filteredMovies]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 10);
  }, [filteredMovies]);

  const latestUploadsMovies = filteredMovies.slice(0, 12);
  
  const categoryOrder = ['Action', 'Adventure', 'Comedy', 'Drama'];
  const moviesByCategory = useMemo(() => {
    const grouped: Record<string, Movie[]> = {};
    for (const movie of filteredMovies) {
      const category = movie.category ?? 'Other';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(movie);
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

  if (loading) return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color="#e50914" /><Text style={styles.loadingText}>Loading movies...</Text></View>);

  return (
    <View style={styles.container}>
      
      {!isDesktop && (
        <View style={[styles.headerFixed, { paddingTop: insets.top + 10 }]}>
          <View style={styles.webContentWrapper}>
            <Text style={styles.logo}>V</Text>
          </View>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={moviesRefreshing} onRefresh={handleManualRefresh} tintColor="#e50914" />}>
        
        <View style={styles.webContentWrapper}>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
            <TextInput style={styles.searchBar} placeholder="Search movies..." placeholderTextColor="#666" value={searchQuery} onChangeText={setSearchQuery} />
          </View>

          <View style={styles.filtersWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScrollContent}>
              {FILTERS.map((filter) => (
                <Pressable key={filter} onPress={() => setActiveFilter(filter)} style={[styles.filterPill, filter === activeFilter && styles.filterPillActive]}>
                  <Text style={[styles.filterPillText, filter === activeFilter && styles.filterPillTextActive]}>{filter}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* --- FEATURED SECTION --- */}
          {featuredRowMovies.length > 0 && !searchQuery.trim() && (
            <View style={styles.categorySection}>
              <Text style={styles.sectionLabel}>Featured</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
                {featuredRowMovies.map((movie, index) => {
                  if (index === 0) {
                    return (
                      <Pressable key={movie.id} style={styles.featuredCard} onPress={() => router.push(`/movie/${movie.id}`)}>
                        <Image source={{ uri: movie.poster_url || '' }} style={styles.moviePoster} resizeMode="cover" />
                        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.featuredGradient} />
                        <View style={styles.featuredTextOverlay}>
                          <Text style={styles.featuredTitle} numberOfLines={2}>{movie.title}</Text>
                          <View style={styles.playButtonSmall}>
                            <Ionicons name="play" size={16} color="#000" />
                            <Text style={styles.playButtonTextSmall}>Play</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  } else {
                    return (
                      <Pressable key={movie.id} style={styles.movieCard} onPress={() => router.push(`/movie/${movie.id}`)}>
                        <Image source={{ uri: movie.poster_url || '' }} style={styles.moviePoster} resizeMode="cover" />
                      </Pressable>
                    );
                  }
                })}
              </ScrollView>
            </View>
          )}

          {/* --- NEW: CONTINUE WATCHING SECTION --- */}
          {continueWatching.length > 0 && !searchQuery.trim() && (
            <View style={styles.categorySection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 }}>
                 <Ionicons name="time" size={24} color="#e50914" />
                 <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>Continue Watching</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
                {continueWatching.map((item) => {
                  const movie = item.movies;
                  return (
                    <Pressable key={`cw-${movie.id}`} style={styles.movieCard} onPress={() => router.push(`/movie/${movie.id}`)}>
                      <Image source={{ uri: movie.poster_url || '' }} style={styles.moviePoster} resizeMode="cover" />
                      
                      {/* Cool overlay to indicate it's a "Resume" card */}
                      <View style={styles.continueWatchingOverlay}>
                        <Ionicons name="play-circle" size={36} color="rgba(255,255,255,0.8)" />
                      </View>
                      
                      {/* Fake progress bar at the bottom for aesthetics */}
                      <View style={styles.progressBarBackground}>
                         <View style={styles.progressBarFill} /> 
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* --- TRENDING NOW SECTION --- */}
          {trendingMovies.length > 0 && !searchQuery.trim() && (
            <View style={styles.categorySection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 }}>
                 <Ionicons name="flame" size={24} color="#e50914" />
                 <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>Trending Now</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
                {trendingMovies.map((movie) => (
                  <Pressable key={`trending-${movie.id}`} style={styles.movieCard} onPress={() => router.push(`/movie/${movie.id}`)}>
                    <Image source={{ uri: movie.poster_url || '' }} style={styles.moviePoster} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* --- LATEST UPLOADS SECTION --- */}
          {latestUploadsMovies.length > 0 && !searchQuery.trim() && (
            <View style={styles.categorySection}>
              <Text style={styles.sectionLabel}>Latest Uploads</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
                {latestUploadsMovies.map((movie) => (
                  <Pressable key={`latest-${movie.id}`} style={styles.movieCard} onPress={() => router.push(`/movie/${movie.id}`)}>
                    <Image source={{ uri: movie.poster_url || '' }} style={styles.moviePoster} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* --- CATEGORY SECTIONS --- */}
          {sortedCategories.map((category) => {
            const categoryMovies = moviesByCategory[category];
            if (!categoryMovies) return null;
            return (
              <View key={category} style={styles.categorySection}>
                <Text style={styles.sectionLabel}>{category}</Text>
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
  loadingText: { marginTop: 12, fontSize: 15, color: '#888' },
  headerFixed: { backgroundColor: 'rgba(10, 10, 10, 0.95)', borderBottomWidth: 1, borderBottomColor: '#1f1f1f', zIndex: 100, paddingBottom: 10 },
  logo: { fontSize: 32, fontWeight: '900', color: '#e50914' },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 20, paddingBottom: 60 },
  webContentWrapper: { width: '100%', maxWidth: 1200, alignSelf: 'center', paddingHorizontal: 16 },
  
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 8, marginBottom: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: '#2a2a2a' },
  searchIcon: { marginRight: 10 },
  searchBar: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#fff' },
  
  filtersWrapper: { marginBottom: 24 },
  filtersScrollContent: { paddingRight: 32, gap: 10 },
  filterPill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#121212', borderWidth: 1, borderColor: '#2a2a2a' },
  filterPillActive: { backgroundColor: '#e50914', borderColor: '#e50914' },
  filterPillText: { color: '#bdbdbd', fontSize: 13, fontWeight: '700' },
  filterPillTextActive: { color: '#fff' },
  
  categorySection: { marginBottom: 32 },
  sectionLabel: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  rowScroll: { paddingRight: 16, alignItems: 'center', gap: 12 },
  
  featuredCard: { width: FEATURED_WIDTH, height: FEATURED_HEIGHT, borderRadius: 8, overflow: 'hidden', backgroundColor: '#111', borderWidth: 1, borderColor: '#222', position: 'relative' },
  featuredGradient: { ...StyleSheet.absoluteFillObject },
  featuredTextOverlay: { position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  featuredTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1, marginRight: 10 },
  playButtonSmall: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 4, gap: 4 },
  playButtonTextSmall: { color: '#000', fontWeight: 'bold', fontSize: 12 },
  
  movieCard: { width: POSTER_WIDTH, height: POSTER_HEIGHT, borderRadius: 8, overflow: 'hidden', backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#1f1f1f', position: 'relative' },
  moviePoster: { width: '100%', height: '100%' },
  
  // NEW CONTINUE WATCHING STYLES
  continueWatchingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  progressBarBackground: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: '#333' },
  progressBarFill: { width: '60%', height: '100%', backgroundColor: '#e50914' },
});