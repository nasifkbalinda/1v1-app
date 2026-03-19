// @ts-nocheck
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const POSTER_WIDTH = 130;
const POSTER_HEIGHT = 190;

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
  
  const { width, height } = useWindowDimensions();
  const isDesktop = width > 768;

  const [movies, setMovies] = useState<Movie[]>([]);
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
  
  // --- EXTRACT THE HERO MOVIE ---
  const heroMovie = !searchQuery.trim() && filteredMovies.length > 0 ? filteredMovies[0] : null;
  
  // Exclude the hero movie from the general grids so it doesn't duplicate right underneath
  const remainingMovies = heroMovie ? filteredMovies.slice(1) : filteredMovies;
  
  const trendingMovies = useMemo(() => {
    return [...remainingMovies].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);
  }, [remainingMovies]);

  const latestUploadsMovies = remainingMovies.slice(0, 12);
  
  const categoryOrder = ['Action', 'Adventure', 'Comedy', 'Drama'];
  const moviesByCategory = useMemo(() => {
    const grouped: Record<string, Movie[]> = {};
    for (const movie of remainingMovies) {
      const category = movie.category ?? 'Other';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(movie);
    }
    return grouped;
  }, [remainingMovies]);

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

  // --- REUSABLE FILTER COMPONENT ---
  const FilterNavigation = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filtersScrollContent, isDesktop && styles.desktopFiltersScroll]}>
      {FILTERS.map((filter) => (
        <Pressable key={filter} onPress={() => setActiveFilter(filter)} style={[styles.filterPill, filter === activeFilter && styles.filterPillActive, isDesktop && styles.desktopFilterPill]}>
          <Text style={[styles.filterPillText, filter === activeFilter && styles.filterPillTextActive, isDesktop && styles.desktopFilterText, isDesktop && filter === activeFilter && styles.desktopFilterTextActive]}>
            {filter}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );

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
        
        {/* --- CINEMATIC HERO SECTION --- */}
        {heroMovie && (
          <View style={[styles.heroContainer, { height: isDesktop ? height * 0.75 : height * 0.6 }]}>
            <Image source={{ uri: heroMovie.poster_url || '' }} style={styles.heroImage} resizeMode="cover" />
            
            {/* The Magic Fade */}
            <LinearGradient colors={['transparent', 'rgba(10,10,10,0.6)', '#0a0a0a']} style={styles.heroGradient} />

            {/* Desktop Filters (Positioned over the hero image to look like a Navbar extension) */}
            {isDesktop && (
              <View style={styles.desktopNavOverlay}>
                <FilterNavigation />
              </View>
            )}

            <View style={[styles.heroContent, isDesktop && styles.heroContentDesktop]}>
              <Text style={[styles.heroTitle, isDesktop && styles.heroTitleDesktop]} numberOfLines={2}>{heroMovie.title}</Text>
              
              {isDesktop && heroMovie.description && (
                <Text style={styles.heroDescription} numberOfLines={3}>{heroMovie.description}</Text>
              )}

              <View style={styles.heroButtonsRow}>
                <Pressable style={styles.heroPlayButton} onPress={() => router.push(`/movie/${heroMovie.id}`)}>
                  <Ionicons name="play" size={24} color="#000" style={{marginLeft: 4}} />
                  <Text style={styles.heroPlayButtonText}>Play</Text>
                </Pressable>
                
                <Pressable style={styles.heroWatchlistButton} onPress={() => router.push(`/movie/${heroMovie.id}`)}>
                  <Ionicons name="add" size={24} color="#fff" />
                  <Text style={styles.heroWatchlistButtonText}>More Info</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* --- MAIN CONTENT GRIDS --- */}
        {/* We pull the grids UP into the gradient fade using a negative margin */}
        <View style={[styles.webContentWrapper, { marginTop: heroMovie ? (isDesktop ? -120 : -40) : 20, zIndex: 10 }]}>

          {/* Mobile Filters */}
          {!isDesktop && (
            <View style={styles.mobileFiltersWrapper}>
              <FilterNavigation />
            </View>
          )}

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
            <TextInput style={styles.searchBar} placeholder="Search movies..." placeholderTextColor="#666" value={searchQuery} onChangeText={setSearchQuery} />
          </View>

          {/* CONTINUE WATCHING */}
          {continueWatching.length > 0 && !searchQuery.trim() && (
            <View style={styles.categorySection}>
              <Text style={styles.sectionLabel}>Continue Watching</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
                {continueWatching.map((item) => {
                  const movie = item.movies;
                  return (
                    <Pressable key={`cw-${movie.id}`} style={styles.movieCard} onPress={() => router.push(`/movie/${movie.id}`)}>
                      <Image source={{ uri: movie.poster_url || '' }} style={styles.moviePoster} resizeMode="cover" />
                      <View style={styles.continueWatchingOverlay}>
                        <Ionicons name="play-circle" size={40} color="rgba(255,255,255,0.8)" />
                      </View>
                      <View style={styles.progressBarBackground}>
                         <View style={styles.progressBarFill} /> 
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* TRENDING NOW */}
          {trendingMovies.length > 0 && !searchQuery.trim() && (
            <View style={styles.categorySection}>
              <Text style={styles.sectionLabel}>Popular This Week</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
                {trendingMovies.map((movie) => (
                  <Pressable key={`trending-${movie.id}`} style={styles.movieCard} onPress={() => router.push(`/movie/${movie.id}`)}>
                    <Image source={{ uri: movie.poster_url || '' }} style={styles.moviePoster} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* LATEST UPLOADS */}
          {latestUploadsMovies.length > 0 && !searchQuery.trim() && (
            <View style={styles.categorySection}>
              <Text style={styles.sectionLabel}>Recently Added</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
                {latestUploadsMovies.map((movie) => (
                  <Pressable key={`latest-${movie.id}`} style={styles.movieCard} onPress={() => router.push(`/movie/${movie.id}`)}>
                    <Image source={{ uri: movie.poster_url || '' }} style={styles.moviePoster} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* CATEGORIES */}
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
  scrollContent: { paddingBottom: 60 },
  webContentWrapper: { width: '100%', maxWidth: 1400, alignSelf: 'center', paddingHorizontal: 20 },
  
  // HERO STYLES
  heroContainer: { width: '100%', position: 'relative' },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', opacity: 0.8 },
  heroGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  heroContent: { position: 'absolute', bottom: '15%', left: 20, right: 20 },
  heroContentDesktop: { left: 40, right: '40%', bottom: '20%' }, // Constrain text width on desktop
  heroTitle: { color: '#fff', fontSize: 36, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4, marginBottom: 12 },
  heroTitleDesktop: { fontSize: 60, lineHeight: 65 },
  heroDescription: { color: '#e5e5e5', fontSize: 16, lineHeight: 24, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3, marginBottom: 25 },
  heroButtonsRow: { flexDirection: 'row', gap: 15 },
  heroPlayButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 4, gap: 8 },
  heroPlayButtonText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  heroWatchlistButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(109, 109, 110, 0.7)', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 4, gap: 8 },
  heroWatchlistButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  // NAVIGATION / FILTERS
  desktopNavOverlay: { position: 'absolute', top: Platform.OS === 'web' ? 20 : 50, left: 40, zIndex: 20 },
  mobileFiltersWrapper: { marginBottom: 20 },
  filtersScrollContent: { gap: 10, paddingRight: 20 },
  desktopFiltersScroll: { gap: 25 }, // Spread out more on desktop
  filterPill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#121212', borderWidth: 1, borderColor: '#2a2a2a' },
  filterPillActive: { backgroundColor: '#e50914', borderColor: '#e50914' },
  filterPillText: { color: '#bdbdbd', fontSize: 13, fontWeight: '700' },
  filterPillTextActive: { color: '#fff' },
  // Desktop specific filter overrides (Text links instead of pills)
  desktopFilterPill: { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0 },
  desktopFilterText: { color: '#e5e5e5', fontSize: 16, fontWeight: '500', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  desktopFilterTextActive: { color: '#fff', fontWeight: 'bold' },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(26,26,26,0.8)', borderRadius: 8, marginBottom: 30, paddingHorizontal: 14, borderWidth: 1, borderColor: '#2a2a2a', maxWidth: 600 },
  searchIcon: { marginRight: 10 },
  searchBar: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#fff', outlineStyle: 'none' },
  
  categorySection: { marginBottom: 35 },
  sectionLabel: { fontSize: 20, fontWeight: 'bold', color: '#e5e5e5', marginBottom: 15 },
  rowScroll: { gap: 12, paddingRight: 20 },
  
  movieCard: { width: POSTER_WIDTH, height: POSTER_HEIGHT, borderRadius: 6, overflow: 'hidden', backgroundColor: '#1a1a1a', position: 'relative' },
  moviePoster: { width: '100%', height: '100%' },
  
  continueWatchingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' },
  progressBarBackground: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: '#333' },
  progressBarFill: { width: '60%', height: '100%', backgroundColor: '#e50914' },
});