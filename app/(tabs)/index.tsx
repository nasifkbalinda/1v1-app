import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'expo-router';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  Image,
  ImageBackground,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

const HERO_MAX_HEIGHT = 300; // ~40–50% of most screens
const POSTER_WIDTH = 110;
const POSTER_HEIGHT = 160;

type Movie = {
  id: string;
  title: string;
  description: string | null;
  poster_url: string | null;
  video_url: string | null;
  category: string | null;
  type: string | null;
};

const FILTERS = [
  'All',
  'Movies',
  'TV Shows',
  'Action',
  'Comedy',
  'Adventure',
  'Sci-Fi',
] as const;
type Filter = (typeof FILTERS)[number];

function filterByQuery(movies: Movie[], query: string): Movie[] {
  if (!query.trim()) return movies;
  const lower = query.trim().toLowerCase();
  return movies.filter(
    (m) =>
      m.title.toLowerCase().includes(lower) ||
      (m.category?.toLowerCase().includes(lower) ?? false) ||
      (m.type?.toLowerCase().includes(lower) ?? false) ||
      (m.description?.toLowerCase().includes(lower) ?? false)
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [moviesRefreshing, setMoviesRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<Filter>('All');
  const [watchlistMovies, setWatchlistMovies] = useState<Movie[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [watchlistRefreshing, setWatchlistRefreshing] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const moviesInitialFetchDoneRef = useRef(false);
  const watchlistInitialFetchDoneRef = useRef(false);

  const applyActiveFilterToMoviesQuery = (query: any, filter: Filter) => {
    if (filter === 'All') return query;

    if (filter === 'Movies') {
      return query.ilike('type', '%movie%');
    }
    if (filter === 'TV Shows') {
      return query.ilike('type', '%tv%');
    }

    return query.ilike('category', `%${filter}%`);
  };

  const applyActiveFilterToWatchlistQuery = (query: any, filter: Filter) => {
    if (filter === 'All') return query;

    if (filter === 'Movies') {
      return query.ilike('movies.type', '%movie%');
    }
    if (filter === 'TV Shows') {
      return query.ilike('movies.type', '%tv%');
    }

    return query.ilike('movies.category', `%${filter}%`);
  };

  useEffect(() => {
    async function fetchMovies() {
      try {
        const isInitial = !moviesInitialFetchDoneRef.current;
        if (isInitial) setLoading(true);
        else setMoviesRefreshing(true);

        const baseQuery = supabase
          .from('movies')
          .select('id, title, description, poster_url, video_url, category, type')
          .eq('status', 'active');

        const filteredQuery = applyActiveFilterToMoviesQuery(baseQuery, activeFilter).order(
          'id',
          { ascending: true }
        );

        const { data, error } = await filteredQuery;
        if (error) throw error;
        setMovies(data ?? []);

        moviesInitialFetchDoneRef.current = true;
      } catch (err) {
        console.error('Error fetching movies:', err);
        setMovies([]);
      } finally {
        setLoading(false);
        setMoviesRefreshing(false);
      }
    }
    fetchMovies();
  }, [activeFilter]);

  useEffect(() => {
    async function fetchWatchlist() {
      try {
        const isInitial = !watchlistInitialFetchDoneRef.current;
        if (isInitial) setWatchlistLoading(true);
        else setWatchlistRefreshing(true);
        setWatchlistError(null);
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) {
          setWatchlistError('Could not verify user');
          setWatchlistMovies([]);
          return;
        }
        if (!user) {
          setWatchlistMovies([]);
          return;
        }

        const baseQuery = supabase
          .from('watchlist')
          .select(
            'movie_id, movies(id, title, description, poster_url, video_url, category, type)'
          )
          .eq('user_id', user.id)
          .eq('movies.status', 'active');

        const filteredQuery = applyActiveFilterToWatchlistQuery(
          baseQuery,
          activeFilter
        );

        const { data, error } = await filteredQuery;
        if (error) {
          console.error('Supabase watchlist fetch error:', error.message, error);
          setWatchlistError('Could not load your list');
          setWatchlistMovies([]);
          return;
        }
        const list =
          data
            ?.map((row) => (row as { movies: Movie | null }).movies)
            .filter((m): m is Movie => m != null) ?? [];
        setWatchlistMovies(list);
        watchlistInitialFetchDoneRef.current = true;
      } catch (err) {
        console.error('Error fetching watchlist:', err);
        setWatchlistError('Could not load your list');
        setWatchlistMovies([]);
      } finally {
        setWatchlistLoading(false);
        setWatchlistRefreshing(false);
      }
    }
    fetchWatchlist();
  }, [activeFilter]);

  const filteredMovies = useMemo(
    () => filterByQuery(movies, searchQuery),
    [movies, searchQuery]
  );
  const filteredWatchlist = useMemo(
    () => filterByQuery(watchlistMovies, searchQuery),
    [watchlistMovies, searchQuery]
  );

  const featuredMovie = filteredMovies[0];
  const categoryOrder = ['Action', 'Adventure', 'Comedy', 'Drama'];

  const moviesByCategory = useMemo(() => {
    const grouped: Record<string, Movie[]> = {};
    for (const movie of filteredMovies) {
      const category = movie.category ?? 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(movie);
    }
    return grouped;
  }, [filteredMovies]);

  const sortedCategories = useMemo(() => {
    const categories = Object.keys(moviesByCategory);
    return categories.sort((a, b) => {
      const ia = categoryOrder.indexOf(a);
      const ib = categoryOrder.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [moviesByCategory, categoryOrder]);

  const navigateToMovie = (id: string) => router.push(`/movie/${id}`);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e50914" />
        <Text style={styles.loadingText}>Loading movies...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.logo}>1v1</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 60 },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color="#888"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchBar}
            placeholder="Search movies..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => setSearchQuery('')}
              style={styles.searchClear}
              hitSlop={8}>
              <Ionicons name="close-circle" size={20} color="#888" />
            </Pressable>
          )}
        </View>

        {/* Filter Pills */}
        <View style={styles.filtersWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersScrollContent}>
            {FILTERS.map((filter) => {
              const isActive = filter === activeFilter;
              return (
                <Pressable
                  key={filter}
                  onPress={() => setActiveFilter(filter)}
                  style={[
                    styles.filterPill,
                    isActive && styles.filterPillActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}>
                  <Text
                    style={[
                      styles.filterPillText,
                      isActive && styles.filterPillTextActive,
                    ]}>
                    {filter}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {moviesRefreshing && (
            <View style={styles.filtersSpinner}>
              <ActivityIndicator size="small" color="#e50914" />
            </View>
          )}
        </View>

        {/* Hero Section (Featured Movie) */}
        {featuredMovie && (
          <View style={styles.heroWrapper}>
            {featuredMovie.poster_url ? (
              <ImageBackground
                source={{ uri: featuredMovie.poster_url }}
                style={styles.heroImage}
                imageStyle={styles.heroImageStyle}
                resizeMode="cover">
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.4)', '#0a0a0a']}
                  style={styles.heroGradient}
                />
                <View style={styles.heroContent}>
                  {featuredMovie.type && (
                    <Text style={styles.heroType}>{featuredMovie.type}</Text>
                  )}
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {featuredMovie.title}
                  </Text>
                  <View style={styles.heroButtons}>
                    <Pressable
                      style={styles.playButton}
                      onPress={() => navigateToMovie(featuredMovie.id)}>
                      <Ionicons name="play" size={22} color="#000" />
                      <Text style={styles.playButtonText}>Play</Text>
                    </Pressable>
                    <Pressable
                      style={styles.moreInfoButton}
                      onPress={() => navigateToMovie(featuredMovie.id)}>
                      <Ionicons name="information-circle-outline" size={20} color="#fff" />
                      <Text style={styles.moreInfoButtonText}>More Info</Text>
                    </Pressable>
                  </View>
                </View>
              </ImageBackground>
            ) : (
              <View style={[styles.heroImage, styles.heroPlaceholder]}>
                <LinearGradient
                  colors={['#1a1a1a', '#0a0a0a']}
                  style={styles.heroGradient}
                />
                <View style={styles.heroContent}>
                  {featuredMovie.type && (
                    <Text style={styles.heroType}>{featuredMovie.type}</Text>
                  )}
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {featuredMovie.title}
                  </Text>
                  <View style={styles.heroButtons}>
                    <Pressable
                      style={styles.playButton}
                      onPress={() => navigateToMovie(featuredMovie.id)}>
                      <Ionicons name="play" size={22} color="#000" />
                      <Text style={styles.playButtonText}>Play</Text>
                    </Pressable>
                    <Pressable
                      style={styles.moreInfoButton}
                      onPress={() => navigateToMovie(featuredMovie.id)}>
                      <Ionicons name="information-circle-outline" size={20} color="#fff" />
                      <Text style={styles.moreInfoButtonText}>More Info</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* My List */}
        <View style={styles.categorySection}>
          <Text style={styles.sectionLabel}>My List</Text>
          {watchlistLoading ? (
            <View style={styles.watchlistEmptyState}>
              <ActivityIndicator size="small" color="#e50914" />
              <Text style={styles.watchlistEmptyText}>Loading your list...</Text>
            </View>
          ) : watchlistError ? (
            <View style={styles.watchlistEmptyState}>
              <Text style={styles.watchlistErrorText}>{watchlistError}</Text>
            </View>
          ) : filteredWatchlist.length === 0 ? (
            <View style={styles.watchlistEmptyState}>
              <Text style={styles.watchlistEmptyText}>
                {searchQuery
                  ? 'No matches in your list.'
                  : 'Your list is empty. Add movies from their detail pages.'}
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rowScroll}>
              {filteredWatchlist.map((movie) => (
                <Pressable
                  key={movie.id}
                  style={styles.movieCard}
                  onPress={() => navigateToMovie(movie.id)}>
                  {movie.poster_url ? (
                    <Image
                      source={{ uri: movie.poster_url }}
                      style={styles.moviePoster}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.moviePosterPlaceholder}>
                      <Text style={styles.cardPlaceholder} numberOfLines={2}>
                        {movie.title}
                      </Text>
                    </View>
                  )}
                  {movie.type && (
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{movie.type}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}
          {watchlistRefreshing && !watchlistLoading && (
            <Text style={styles.refreshHint}>Updating…</Text>
          )}
        </View>

        {/* Category Rows */}
        {sortedCategories.length > 0 ? (
          sortedCategories.map((category) => {
            const categoryMovies = moviesByCategory[category];
            if (!categoryMovies || categoryMovies.length === 0) return null;

            return (
              <View key={category} style={styles.categorySection}>
                <Text style={styles.sectionLabel}>
                  {category === 'Action' ? 'Action & Adventure' : category}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rowScroll}>
                  {categoryMovies.map((movie) => (
                    <Pressable
                      key={movie.id}
                      style={styles.movieCard}
                      onPress={() => navigateToMovie(movie.id)}>
                      {movie.poster_url ? (
                        <Image
                          source={{ uri: movie.poster_url }}
                          style={styles.moviePoster}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.moviePosterPlaceholder}>
                          <Text style={styles.cardPlaceholder} numberOfLines={2}>
                            {movie.title}
                          </Text>
                        </View>
                      )}
                      {movie.type && (
                        <View style={styles.typeBadge}>
                          <Text style={styles.typeBadgeText}>{movie.type}</Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>
            {searchQuery ? 'No matches found.' : 'No movies yet'}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#888',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  logo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#e50914',
    letterSpacing: -0.5,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchBar: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
  },
  searchClear: {
    padding: 4,
  },
  filtersWrapper: {
    marginBottom: 14,
    position: 'relative',
  },
  filtersScrollContent: {
    paddingRight: 56,
    gap: 10,
  },
  filterPill: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  filterPillActive: {
    backgroundColor: '#e50914',
    borderColor: '#e50914',
  },
  filterPillText: {
    color: '#bdbdbd',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  filterPillTextActive: {
    color: '#fff',
  },
  filtersSpinner: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingLeft: 10,
  },
  heroWrapper: {
    marginBottom: 32,
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: HERO_MAX_HEIGHT,
  },
  heroImage: {
    height: HERO_MAX_HEIGHT,
    width: '100%',
    justifyContent: 'flex-end',
  },
  heroImageStyle: {
    borderRadius: 12,
  },
  heroPlaceholder: {
    backgroundColor: '#1a1a1a',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  heroContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    zIndex: 1,
  },
  heroType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b3b3b3',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    marginBottom: 12,
  },
  heroButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  playButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  moreInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(128,128,128,0.6)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  moreInfoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  rowScroll: {
    paddingRight: 16,
  },
  movieCard: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  moviePoster: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: 8,
  },
  moviePosterPlaceholder: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#1a1a1a',
  },
  cardPlaceholder: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    paddingVertical: 24,
  },
  watchlistEmptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingRight: 16,
  },
  watchlistEmptyText: {
    color: '#888',
    fontSize: 14,
    flex: 1,
  },
  watchlistErrorText: {
    color: '#e50914',
    fontSize: 14,
    flex: 1,
  },
  refreshHint: {
    marginTop: 10,
    color: '#888',
    fontSize: 12,
  },
  categorySection: {
    marginTop: 8,
    marginBottom: 24,
  },
  typeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
