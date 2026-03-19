// @ts-nocheck
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Adjusted professional sizing
const POSTER_WIDTH = 150;
const POSTER_HEIGHT = 225;
const CW_WIDTH = 320;
const CW_HEIGHT = 120;

type Movie = { id: string; title: string; description: string | null; poster_url: string | null; video_url: string | null; category: string | null; type: string | null; views?: number; };
const FILTERS = ['All', 'Movies', 'TV Shows', 'Action', 'Comedy', 'Adventure', 'Sci-Fi'] as const;
type Filter = (typeof FILTERS)[number];

function filterByQuery(movies: Movie[], query: string): Movie[] {
  if (!query.trim()) return movies;
  const lower = query.trim().toLowerCase();
  return movies.filter((m) => m.title.toLowerCase().includes(lower) || (m.category?.toLowerCase().includes(lower) ?? false) || (m.type?.toLowerCase().includes(lower) ?? false));
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

  const filteredMovies = useMemo(() => filterByQuery(movies, searchQuery), [movies, searchQuery]);
  const heroMovie = !searchQuery.trim() && filteredMovies.length > 0 ? filteredMovies[0] : null;
  const remainingMovies = heroMovie ? filteredMovies.slice(1) : filteredMovies;
  
  const trendingMovies = useMemo(() => {
    return [...remainingMovies].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);
  }, [remainingMovies]);

  const latestUploadsMovies = remainingMovies.slice(0, 12);
  
  if (loading) return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color="#e50914" /></View>);

  return (
    <View style={styles.container}>
      
      {/* --- UNIFIED TOP NAVBAR (ABSOLUTE POSITIONED) --- */}
      <View style={[styles.unifiedHeader, { paddingTop: isDesktop ? 30 : insets.top + 10 }]}>
        <Text style={styles.logo}>V</Text>
        
        {isDesktop && (
          <>
            {/* Primary Nav Links */}
            <View style={styles.primaryNav}>
              {['HOME', 'MY LIST', 'DOWNLOADS', 'SETTINGS', 'ADMIN'].map((item) => (
                <Pressable key={item}><Text style={styles.navLink}>{item}</Text></Pressable>
              ))}
            </View>

            {/* Category Filters */}
            <View style={styles.categoryNav}>
              {FILTERS.map((filter) => (
                <Pressable key={filter} onPress={() => setActiveFilter(filter)}>
                  <Text style={[styles.filterLink, filter === activeFilter && styles.filterLinkActive]}>
                    {filter.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Search Bar */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color="#888" style={{ marginRight: 8 }} />
              <TextInput 
                style={styles.searchInput} 
                placeholder="Search" 
                placeholderTextColor="#666" 
                value={searchQuery} 
                onChangeText={setSearchQuery} 
              />
            </View>

            {/* User Avatar Placeholder */}
            <View style={styles.avatar} />
          </>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* --- CINEMATIC HERO SECTION --- */}
        {heroMovie && (
          <View style={[styles.heroContainer, { height: isDesktop ? height * 0.8 : height * 0.6 }]}>
            <Image source={{ uri: heroMovie.poster_url || '' }} style={styles.heroImage} resizeMode="cover" />
            
            {/* Dark gradient from left for text readability */}
            <LinearGradient colors={['rgba(10,10,10,0.8)', 'transparent']} start={{x: 0, y: 0}} end={{x: 0.6, y: 0}} style={StyleSheet.absoluteFillObject} />
            {/* Dark gradient from bottom to blend into the grids */}
            <LinearGradient colors={['transparent', 'rgba(10,10,10,0.6)', '#0a0a0a']} locations={[0.5, 0.85, 1]} style={StyleSheet.absoluteFillObject} />

            <View style={[styles.heroContent, isDesktop && styles.heroContentDesktop]}>
              <Text style={[styles.heroTitle, isDesktop && styles.heroTitleDesktop]} numberOfLines={2}>{heroMovie.title}</Text>
              
              {isDesktop && heroMovie.description && (
                <Text style={styles.heroDescription} numberOfLines={2}>{heroMovie.description}</Text>
              )}

              <View style={styles.heroButtonsRow}>
                <Pressable style={styles.heroPlayButton} onPress={() => router.push(`/movie/${heroMovie.id}`)}>
                  <Ionicons name="play" size={20} color="#000" />
                  <Text style={styles.heroPlayButtonText}>PLAY</Text>
                </Pressable>
                
                <Pressable style={styles.heroWatchlistButton} onPress={() => router.push(`/movie/${heroMovie.id}`)}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.heroWatchlistButtonText}>ADD TO WATCHLIST</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* --- MAIN CONTENT GRIDS --- */}
        <View style={[styles.gridContainer, { marginTop: heroMovie ? (isDesktop ? -150 : -40) : 100 }]}>

          {/* CONTINUE WATCHING (Horizontal Cards) */}
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
                        <View style={styles.cwPlayOverlay}><Ionicons name="play" size={24} color="#fff" /></View>
                      </View>
                      <View style={styles.cwInfo}>
                        <Text style={styles.cwTitle} numberOfLines={1}>{movie.title}</Text>
                        <Text style={styles.cwDesc} numberOfLines={2}>{movie.category} • {movie.type}</Text>
                      </View>
                      <View style={styles.cwProgressBg}><View style={styles.cwProgressFill} /></View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* POPULAR LEADERBOARD */}
          {trendingMovies.length > 0 && !searchQuery.trim() && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Popular Leaderboard</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
                {trendingMovies.map((movie, index) => (
                  <Pressable key={`trending-${movie.id}`} style={styles.movieCard} onPress={() => router.push(`/movie/${movie.id}`)}>
                    <Image source={{ uri: movie.poster_url || '' }} style={styles.moviePoster} resizeMode="cover" />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.movieGradient} />
                    <Text style={styles.rankText}>#{index + 1} {movie.title}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* NEW RELEASES */}
          {latestUploadsMovies.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{searchQuery ? 'Search Results' : 'New Releases'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowScroll}>
                {latestUploadsMovies.map((movie) => (
                  <Pressable key={`latest-${movie.id}`} style={styles.movieCard} onPress={() => router.push(`/movie/${movie.id}`)}>
                    <Image source={{ uri: movie.poster_url || '' }} style={styles.moviePoster} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

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
  gridContainer: { width: '100%', maxWidth: 1600, alignSelf: 'center', paddingHorizontal: 40, zIndex: 10 },
  
  // UNIFIED HEADER
  unifiedHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 40, width: '100%', maxWidth: 1600, alignSelf: 'center' },
  logo: { fontSize: 32, fontWeight: '900', color: '#e50914', marginRight: 30 },
  primaryNav: { flexDirection: 'row', gap: 20, marginRight: 'auto' },
  navLink: { color: '#ccc', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  categoryNav: { flexDirection: 'row', gap: 20, marginRight: 30 },
  filterLink: { color: '#888', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  filterLinkActive: { color: '#fff', fontSize: 16, fontWeight: '800' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f1f1f', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 8, width: 200, marginRight: 20 },
  searchInput: { flex: 1, color: '#fff', fontSize: 13, outlineStyle: 'none' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#444' },

  // HERO STYLES
  heroContainer: { width: '100%', position: 'relative' },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroContent: { position: 'absolute', bottom: '15%', left: 20, right: 20, zIndex: 10 },
  heroContentDesktop: { left: 40, width: '45%', bottom: '25%' },
  heroTitle: { color: '#fff', fontSize: 32, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4, marginBottom: 10 },
  heroTitleDesktop: { fontSize: 48, lineHeight: 52 },
  heroDescription: { color: '#ccc', fontSize: 14, lineHeight: 20, marginBottom: 20, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  heroButtonsRow: { flexDirection: 'row', gap: 12 },
  heroPlayButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 4, gap: 6 },
  heroPlayButtonText: { color: '#000', fontSize: 14, fontWeight: '800' },
  heroWatchlistButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(50, 50, 50, 0.8)', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 4, gap: 6 },
  heroWatchlistButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // SECTION STYLES
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  rowScroll: { gap: 15, paddingRight: 40 },
  
  // CONTINUE WATCHING CARDS (Horizontal)
  cwCard: { width: CW_WIDTH, height: CW_HEIGHT, backgroundColor: '#1a1a1a', borderRadius: 6, overflow: 'hidden', flexDirection: 'row', position: 'relative' },
  cwImageContainer: { width: 100, height: '100%', position: 'relative' },
  cwImage: { width: '100%', height: '100%', opacity: 0.8 },
  cwPlayOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  cwInfo: { flex: 1, padding: 15, justifyContent: 'center' },
  cwTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  cwDesc: { color: '#888', fontSize: 12, lineHeight: 16 },
  cwProgressBg: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: '#333' },
  cwProgressFill: { width: '45%', height: '100%', backgroundColor: '#e50914' }, // Static width for aesthetics

  // STANDARD MOVIE POSTERS
  movieCard: { width: POSTER_WIDTH, height: POSTER_HEIGHT, borderRadius: 6, overflow: 'hidden', backgroundColor: '#1a1a1a', position: 'relative' },
  moviePoster: { width: '100%', height: '100%' },
  movieGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%' },
  rankText: { position: 'absolute', bottom: 8, left: 8, color: '#fff', fontSize: 12, fontWeight: 'bold', zIndex: 2 }
});