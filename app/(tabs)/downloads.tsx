import { useCallback, useEffect, useState } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { getDownloadedMovies, type DownloadedMovie } from '@/lib/downloads';

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 2;
const CARD_GAP = 12;
const CARD_WIDTH = (width - 16 * 2 - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const CARD_HEIGHT = CARD_WIDTH * (16 / 9);

export default function DownloadsScreen() {
  const router = useRouter();
  const [movies, setMovies] = useState<DownloadedMovie[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDownloads = useCallback(async () => {
    try {
      const list = await getDownloadedMovies();
      setMovies(list);
    } catch (err) {
      console.error('Failed to load downloads:', err);
      setMovies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadDownloads();
    }, [loadDownloads])
  );

  const openOffline = (item: DownloadedMovie) => {
    router.push({
      pathname: `/movie/${item.id}`,
      params: {
        localUri: item.localUri,
        title: item.title,
        poster_url: item.poster_url ?? '',
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#e50914" />
        <Text style={styles.loadingText}>Loading downloads...</Text>
      </View>
    );
  }

  if (movies.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No downloads yet</Text>
        <Text style={styles.emptyMessage}>
          Movies you download from the player will appear here. Watch them
          offline anytime.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Your offline movies</Text>
        <View style={styles.grid}>
          {movies.map((item) => (
            <Pressable
              key={item.id}
              style={styles.card}
              onPress={() => openOffline(item)}>
              {item.poster_url ? (
                <Image
                  source={{ uri: item.poster_url }}
                  style={styles.poster}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.posterPlaceholder}>
                  <Text style={styles.posterPlaceholderText} numberOfLines={2}>
                    {item.title}
                  </Text>
                </View>
              )}
              <View style={styles.cardOverlay} />
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#888',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#141414',
  },
  posterPlaceholderText: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cardTitle: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
