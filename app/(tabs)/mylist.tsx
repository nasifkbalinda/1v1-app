import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Movie = { id: string; title: string; poster_url: string | null; };

export default function MyListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // We use useFocusEffect so it refreshes every time the user clicks on the tab
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function fetchMyList() {
        setLoading(true);
        try {
          // 1. Get the current user
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            if (isMounted) { setUserId(null); setLoading(false); }
            return;
          }
          if (isMounted) setUserId(user.id);

          // 2. Fetch all movie IDs from their watchlist
          const { data: watchlistData, error: watchError } = await supabase
            .from('watchlist')
            .select('movie_id')
            .eq('user_id', user.id);

          if (watchError || !watchlistData || watchlistData.length === 0) {
            if (isMounted) { setMovies([]); setLoading(false); }
            return;
          }

          const movieIds = watchlistData.map(item => item.movie_id);

          // 3. Fetch the actual movie details for those IDs
          const { data: moviesData, error: moviesError } = await supabase
            .from('movies')
            .select('id, title, poster_url')
            .in('id', movieIds);

          if (!moviesError && moviesData && isMounted) {
            setMovies(moviesData as Movie[]);
          }
        } catch (err) {
          console.error("Error fetching My List:", err);
        } finally {
          if (isMounted) setLoading(false);
        }
      }

      fetchMyList();

      return () => { isMounted = false; };
    }, [])
  );

  const { width } = Dimensions.get('window');
  const isWeb = Platform.OS === 'web';
  const numColumns = isWeb ? 5 : 3;
  const cardWidth = isWeb ? 160 : (width - 40 - (12 * (numColumns - 1))) / numColumns; 

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e50914" />
          <Text style={styles.loadingText}>Loading your list...</Text>
        </View>
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="person-circle-outline" size={64} color="#333" />
          <Text style={styles.emptyTitle}>Not Logged In</Text>
          <Text style={styles.emptySub}>Please log in to save movies to your list.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Mobile Header (Hidden on Desktop automatically by the layout!) */}
      <View style={[styles.headerFixed, { paddingTop: insets.top + 10 }]}>
        <View style={styles.webContentWrapper}>
          <Text style={styles.headerTitle}>My List</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.webContentWrapper}>
          
          {movies.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="list-outline" size={64} color="#333" />
              <Text style={styles.emptyTitle}>Your list is empty</Text>
              <Text style={styles.emptySub}>Movies and shows you add will appear here.</Text>
              <Pressable style={styles.browseButton} onPress={() => router.navigate('/')}>
                <Text style={styles.browseButtonText}>Browse Movies</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.grid}>
              {movies.map((movie) => (
                <Pressable key={movie.id} style={[styles.movieCard, { width: cardWidth }]} onPress={() => router.push(`/movie/${movie.id}`)}>
                  {movie.poster_url ? (
                    <Image source={{ uri: movie.poster_url }} style={[styles.moviePoster, { height: isWeb ? 240 : cardWidth * 1.5 }]} resizeMode="cover" />
                  ) : (
                    <View style={[styles.moviePosterPlaceholder, { height: isWeb ? 240 : cardWidth * 1.5 }]}>
                      <Text style={styles.moviePosterText}>{movie.title}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          )}

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#888' },
  headerFixed: { backgroundColor: 'rgba(10, 10, 10, 0.95)', borderBottomWidth: 1, borderBottomColor: '#1f1f1f', zIndex: 100, paddingBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 20, paddingBottom: 60 },
  webContentWrapper: { width: '100%', maxWidth: 1200, alignSelf: 'center', paddingHorizontal: 16 },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  movieCard: { borderRadius: 8, overflow: 'hidden', backgroundColor: '#111', borderWidth: 1, borderColor: '#1f1f1f' },
  moviePoster: { width: '100%' },
  moviePosterPlaceholder: { width: '100%', backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  moviePosterText: { color: '#888', padding: 10, textAlign: 'center' },
  
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginTop: 20 },
  emptySub: { fontSize: 15, color: '#888', marginTop: 8, marginBottom: 24, textAlign: 'center' },
  browseButton: { backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 4 },
  browseButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' }
});