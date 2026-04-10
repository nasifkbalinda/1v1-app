import {
  addDownloadedMovie,
  isMovieDownloaded,
  type DownloadedMovie,
} from '@/lib/downloads';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { createElement, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Movie = {
  id: string;
  title: string;
  description: string | null;
  poster_url: string | null;
  video_url: string | null;
  category: string | null;
  type: string | null;
};

type Episode = {
  id: string;
  season_number: number;
  episode_number: number;
  title: string;
  video_url: string | null;
};

// ---> 1. NATIVE PLAYER (For iOS & Android apps - Supports Offline & PiP) <---
function NativeVideoBlock({ url, onError, videoHeight }: { url: string, onError: () => void, videoHeight: number }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.play();
  });

  // FIX: Safely track the player status to prevent TypeScript event typing errors
  const statusEvent = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => {
    if (statusEvent.status === 'error') {
      onError();
    }
  }, [statusEvent.status, onError]);

  return (
    <VideoView
      style={[styles.videoView, { height: videoHeight }]}
      player={player}
      contentFit="contain"
      nativeControls={true}
      fullscreenOptions={{ enable: true }}
      allowsPictureInPicture
    />
  );
}

// ---> 2. WEB PLAYER (For Desktop Browsers - Unlocks Subtitles & Quality Selectors) <---
function WebVideoBlock({ videoId, videoHeight }: { videoId: string, videoHeight: number }) {
  // Using createElement ensures TypeScript won't throw errors when building the mobile apps
  return createElement('iframe', {
    src: `https://iframe.mediadelivery.net/embed/633147/${videoId}?autoplay=true&preload=true`,
    loading: "lazy",
    style: { border: 'none', width: '100%', height: videoHeight },
    allow: "accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;",
    allowFullScreen: true
  });
}

// ---> 3. THE SMART ROUTER <---
function VideoPlayerBlock({
  url,
  onError,
}: {
  url: string;
  onError: () => void;
}) {
  const { width } = Dimensions.get('window');
  const videoHeight = width * (9 / 16);

  let videoId = '';
  if (url.includes('b-cdn.net')) {
    const parts = url.split('/');
    videoId = parts[parts.length - 2]; 
  }

  if (Platform.OS === 'web' && videoId) {
    return <WebVideoBlock videoId={videoId} videoHeight={videoHeight} />;
  }

  return <NativeVideoBlock url={url} onError={onError} videoHeight={videoHeight} />;
}

export default function TheaterScreen() {
  const params = useLocalSearchParams<{
    id: string;
    localUri?: string;
    title?: string;
    poster_url?: string;
  }>();
  const { id, localUri: paramLocalUri, title: paramTitle, poster_url: paramPosterUrl } = params;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [suggestions, setSuggestions] = useState<Movie[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [isInMyList, setIsInMyList] = useState(false);
  const [watchlistChecking, setWatchlistChecking] = useState(false);
  const [watchlistToggling, setWatchlistToggling] = useState(false);

  const isOfflineMode = Boolean(paramLocalUri);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('No movie ID');
      return;
    }
    if (isOfflineMode) {
      setMovie({
        id,
        title: paramTitle ?? 'Movie',
        description: null,
        poster_url: paramPosterUrl ?? null,
        video_url: paramLocalUri ?? null,
        category: null,
        type: null,
      });
      setLoading(false);
      setIsDownloaded(true);
      return;
    }
    async function fetchMovie() {
      try {
        const [downloaded] = await Promise.all([
          isMovieDownloaded(id),
          (async () => {
            const { data, error: fetchError } = await supabase
              .from('movies')
              .select('id, title, description, poster_url, video_url, category, type')
              .eq('id', id)
              .single();
            if (fetchError) throw fetchError;
            setMovie(data);
          })(),
        ]);
        setIsDownloaded(downloaded);
      } catch (err) {
        console.error('Error fetching movie:', err);
        setError('Could not load movie');
      } finally {
        setLoading(false);
      }
    }
    fetchMovie();
  }, [id, isOfflineMode, paramLocalUri, paramTitle, paramPosterUrl]);

  useEffect(() => {
    if (isOfflineMode) {
      setCurrentVideoUrl(paramLocalUri ?? null);
      return;
    }
    if (movie?.video_url) {
      setCurrentVideoUrl(movie.video_url);
    } else {
      setCurrentVideoUrl(null);
    }
  }, [isOfflineMode, paramLocalUri, movie]);

  useEffect(() => {
    setVideoFailed(false);
  }, [currentVideoUrl]);

  useEffect(() => {
    if (!movie || movie.type !== 'TV Series' || isOfflineMode) {
      setEpisodes([]);
      return;
    }

    let isCancelled = false;

    async function fetchEpisodes() {
      try {
        setEpisodesLoading(true);
        const { data, error: episodesError } = await supabase
          .from('episodes')
          .select('id, season_number, episode_number, title, video_url')
          .eq('movie_id', movie!.id) // FIX: Added non-null assertion !
          .order('season_number', { ascending: true })
          .order('episode_number', { ascending: true });

        if (episodesError) throw episodesError;
        if (!isCancelled) {
          setEpisodes((data as Episode[]) ?? []);
        }
      } catch (err) {
        console.error('Error fetching episodes:', err);
        if (!isCancelled) {
          setEpisodes([]);
        }
      } finally {
        if (!isCancelled) {
          setEpisodesLoading(false);
        }
      }
    }

    fetchEpisodes();

    return () => {
      isCancelled = true;
    };
  }, [movie, isOfflineMode]);

  useEffect(() => {
    if (!movie || !movie.category || isOfflineMode) return;

    let isCancelled = false;

    async function fetchSuggestions() {
      try {
        setSuggestionsLoading(true);
        const { data, error: suggestionsError } = await supabase
          .from('movies')
          .select('id, title, description, poster_url, video_url, category, type')
          .eq('category', movie!.category) // FIX: Added non-null assertion !
          .neq('id', movie!.id) // FIX: Added non-null assertion !
          .limit(5);

        if (suggestionsError) throw suggestionsError;
        if (!isCancelled) {
          setSuggestions(data ?? []);
        }
      } catch (err) {
        console.error('Error fetching similar movies:', err);
        if (!isCancelled) {
          setSuggestions([]);
        }
      } finally {
        if (!isCancelled) {
          setSuggestionsLoading(false);
        }
      }
    }

    fetchSuggestions();

    return () => {
      isCancelled = true;
    };
  }, [movie, isOfflineMode]);

  useEffect(() => {
    if (!movie || isOfflineMode) {
      setIsInMyList(false);
      return;
    }

    let isCancelled = false;

    async function checkWatchlist() {
      try {
        setWatchlistChecking(true);
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) {
          console.log('[Watchlist] Auth check error:', authError.message);
          if (!isCancelled) setIsInMyList(false);
          return;
        }
        if (!user) {
          console.log('[Watchlist] No user signed in');
          if (!isCancelled) setIsInMyList(false);
          return;
        }
        const { data, error } = await supabase
          .from('watchlist')
          .select('id')
          .eq('user_id', user.id)
          .eq('movie_id', movie!.id) // FIX: Added non-null assertion !
          .maybeSingle();
        if (error) {
          console.log('[Watchlist] Check error:', error.message);
          if (!isCancelled) setIsInMyList(false);
          return;
        }
        if (!isCancelled) {
          setIsInMyList(!!data);
          console.log('[Watchlist] Is on list:', !!data);
        }
      } catch (err) {
        console.error('[Watchlist] Check failed:', err);
        if (!isCancelled) setIsInMyList(false);
      } finally {
        if (!isCancelled) setWatchlistChecking(false);
      }
    }

    checkWatchlist();
    return () => {
      isCancelled = true;
    };
  }, [movie, isOfflineMode]);

  const handleWatchlistToggle = useCallback(async () => {
    if (!movie || isOfflineMode || watchlistToggling) return;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) {
      console.log('[Watchlist] Toggle auth error:', authError.message);
      return;
    }
    if (!user) {
      console.log('[Watchlist] Toggle failed: no user signed in');
      return;
    }

    setWatchlistToggling(true);
    try {
      if (isInMyList) {
        const { error } = await supabase
          .from('watchlist')
          .delete()
          .eq('user_id', user.id)
          .eq('movie_id', movie.id);
        if (error) {
          console.log('[Watchlist] Remove error:', error.message);
          return;
        }
        console.log('[Watchlist] Removed from list successfully');
        setIsInMyList(false);
      } else {
        const { error } = await supabase.from('watchlist').insert({
          user_id: user.id,
          movie_id: movie.id,
        });
        if (error) {
          console.log('[Watchlist] Add error:', error.message);
          return;
        }
        console.log('[Watchlist] Added to list successfully');
        setIsInMyList(true);
      }
    } catch (err) {
      console.error('[Watchlist] Toggle failed:', err);
    } finally {
      setWatchlistToggling(false);
    }
  }, [movie, isOfflineMode, isInMyList, watchlistToggling]);

  const downloadVideo = useCallback(
    async (videoUrl: string, title: string) => {
      if (!movie || isOfflineMode || !videoUrl || isDownloading || isDownloaded) return;

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.open(videoUrl, '_blank');
        }
        return;
      }

      const fileUri = `${FileSystem.documentDirectory}movie_${movie.id}.mp4`;
      setIsDownloading(true);
      setDownloadProgress(0);
      try {
        const downloadResumable = FileSystem.createDownloadResumable(
          videoUrl,
          fileUri,
          {},
          ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
            const pct =
              totalBytesExpectedToWrite > 0
                ? Math.round((100 * totalBytesWritten) / totalBytesExpectedToWrite)
                : 0;
            setDownloadProgress(Math.min(100, pct));
          }
        );
        const result = await downloadResumable.downloadAsync();
        if (result?.uri) {
          const entry: DownloadedMovie = {
            id: movie.id,
            title,
            poster_url: movie.poster_url,
            localUri: result.uri,
          };
          await addDownloadedMovie(entry);
          setIsDownloaded(true);
        }
      } catch (err) {
        console.error('Download failed:', err);
      } finally {
        setIsDownloading(false);
        setDownloadProgress(null);
      }
    },
    [movie, isOfflineMode, isDownloading, isDownloaded]
  );

  const handleDownload = useCallback(async () => {
    if (!movie) return;

    const activeVideoUrl =
      movie.type === 'TV Series' ? currentVideoUrl : movie.video_url;

    if (!activeVideoUrl) return;

    await downloadVideo(activeVideoUrl, movie.title);
  }, [movie, currentVideoUrl, downloadVideo]);

  const handleEpisodeDownload = useCallback(
    async (episode: Episode) => {
      if (!episode.video_url) return;
      await downloadVideo(episode.video_url, episode.title);
    },
    [downloadVideo]
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={26} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (error || !movie) {
    return (
      <View style={styles.container}>
        <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={26} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? 'Movie not found'}</Text>
        </View>
      </View>
    );
  }

  const { width } = Dimensions.get('window');
  const videoHeight = width * (9 / 16);
  const hasActiveVideoUrl =
    movie.type === 'TV Series' ? !!currentVideoUrl : !!movie.video_url;
  const showDownloadButton =
    !isOfflineMode && !isDownloaded && hasActiveVideoUrl;

  const headerHeight = insets.top + 52;
  const shouldShowVideo = !!currentVideoUrl && !videoFailed;

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 8, minHeight: headerHeight }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={16}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {shouldShowVideo ? (
          <View style={[styles.videoContainer, { height: videoHeight }]}>
            <VideoPlayerBlock
              key={currentVideoUrl}
              url={currentVideoUrl}
              onError={() => setVideoFailed(true)}
            />
          </View>
        ) : (
          <View style={[styles.videoPlaceholder, { height: videoHeight }]}>
            {movie.poster_url ? (
              <Pressable
                style={styles.videoFallbackPressable}
                onPress={() => router.push(`/movie/${movie.id}`)}>
                <Image
                  source={{ uri: movie.poster_url }}
                  style={styles.videoPoster}
                  resizeMode="cover"
                />
                <View style={styles.playOverlay}>
                  <Text style={styles.playOverlayText}>▶ Play Preview</Text>
                </View>
              </Pressable>
            ) : (
              <Text style={styles.placeholderText}>No video available</Text>
            )}
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.title}>{movie.title}</Text>

          <View style={styles.metaRow}>
            {movie.type && (
              <View style={styles.metaBadge}>
                <Text style={styles.metaBadgeText}>{movie.type}</Text>
              </View>
            )}
            {movie.category && (
              <Text style={styles.metaCategory}>{movie.category}</Text>
            )}
          </View>

          <View style={styles.actionButtonsRow}>
            {showDownloadButton && (
              <Pressable
                style={[
                  styles.downloadButton,
                  isDownloading && styles.downloadButtonDisabled,
                ]}
                onPress={handleDownload}
                disabled={isDownloading}>
                {isDownloading ? (
                  <Text style={styles.downloadButtonText}>
                    Downloading... {downloadProgress ?? 0}%
                  </Text>
                ) : (
                  <>
                    <Ionicons name="download-outline" size={20} color="#fff" />
                    <Text style={styles.downloadButtonText}>Download for Offline</Text>
                  </>
                )}
              </Pressable>
            )}
            {!isOfflineMode && (
              <Pressable
                style={[
                  styles.myListButton,
                  watchlistToggling && styles.myListButtonDisabled,
                ]}
                onPress={handleWatchlistToggle}
                disabled={watchlistToggling}>
                {watchlistToggling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : isInMyList ? (
                  <>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.myListButtonText}>✓ My List</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.myListButtonText}>+ My List</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
          {isDownloaded && !isOfflineMode && (
            <View style={styles.downloadedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
              <Text style={styles.downloadedBadgeText}>Available Offline</Text>
            </View>
          )}

          {movie.description ? (
            <Text style={styles.description}>{movie.description}</Text>
          ) : null}

          {!isOfflineMode && movie.type === 'TV Series' && (
            <View style={styles.episodesSection}>
              <Text style={styles.episodesTitle}>Episodes</Text>
              {episodesLoading ? (
                <View style={styles.episodesLoadingRow}>
                  <ActivityIndicator size="small" color="#e50914" />
                  <Text style={styles.episodesLoadingText}>
                    Loading episodes...
                  </Text>
                </View>
              ) : episodes.length === 0 ? (
                <Text style={styles.episodesEmptyText}>
                  No episodes available yet.
                </Text>
              ) : (
                <View style={styles.episodeList}>
                  {episodes.map((ep) => {
                    const isActive =
                      !!ep.video_url && ep.video_url === currentVideoUrl;
                    return (
                      <View
                        key={ep.id}
                        style={[
                          styles.episodeItem,
                          isActive && styles.episodeItemActive,
                        ]}>
                        <Pressable
                          style={styles.episodeMain}
                          onPress={() => {
                            console.log('Attempting to play URL:', ep.video_url);
                            if (ep.video_url) {
                              setCurrentVideoUrl(ep.video_url);
                            }
                          }}>
                          <View style={styles.episodeTextBlock}>
                            <Text style={styles.episodeLabel}>{`S${ep.season_number}:E${ep.episode_number}`}</Text>
                            <Text
                              style={styles.episodeTitle}
                              numberOfLines={1}>
                              {ep.title}
                            </Text>
                          </View>
                          <Ionicons
                            name="play-circle-outline"
                            size={22}
                            color={isActive ? '#e50914' : '#fff'}
                          />
                        </Pressable>
                        {ep.video_url && (
                          <Pressable
                            style={styles.episodeDownloadButton}
                            onPress={() => handleEpisodeDownload(ep)}
                            disabled={isDownloading || isDownloaded}>
                            <Ionicons
                              name="download-outline"
                              size={18}
                              color={isDownloading || isDownloaded ? '#666' : '#ddd'}
                            />
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {!isOfflineMode && (
            <View style={styles.suggestionsSection}>
              <Text style={styles.suggestionsTitle}>More Like This</Text>
              {suggestionsLoading ? (
                <View style={styles.suggestionsLoadingRow}>
                  <ActivityIndicator size="small" color="#e50914" />
                  <Text style={styles.suggestionsLoadingText}>
                    Finding similar titles...
                  </Text>
                </View>
              ) : suggestions.length === 0 ? (
                <Text style={styles.suggestionsEmptyText}>
                  No similar titles yet.
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.suggestionsRow}>
                  {suggestions.map((item) => (
                    <Pressable
                      key={item.id}
                      style={styles.suggestionCard}
                      onPress={() => router.push(`/movie/${item.id}`)}>
                      {item.poster_url ? (
                        <Image
                          source={{ uri: item.poster_url }}
                          style={styles.suggestionPoster}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.suggestionPosterPlaceholder}>
                          <Text
                            style={styles.suggestionPlaceholderText}
                            numberOfLines={2}>
                            {item.title}
                          </Text>
                        </View>
                      )}
                      {item.type && (
                        <View style={styles.suggestionTypeBadge}>
                          <Text style={styles.suggestionTypeBadgeText}>
                            {item.type}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginRight: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  videoContainer: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#000',
    alignSelf: 'center',
  },
  videoView: {
    width: '100%',
    backgroundColor: '#000',
  },
  videoPlaceholder: {
    width: '100%',
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  videoFallbackPressable: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  videoPoster: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playOverlayText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  placeholderText: {
    color: '#666',
    fontSize: 16,
  },
  info: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  metaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#e50914',
  },
  metaBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaCategory: {
    color: '#b3b3b3',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    backgroundColor: '#e50914',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  downloadButtonDisabled: {
    backgroundColor: '#555',
    opacity: 0.9,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  myListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    backgroundColor: '#e50914',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  myListButtonDisabled: {
    backgroundColor: '#555',
    opacity: 0.9,
  },
  myListButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  downloadedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  downloadedBadgeText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
  },
  episodesSection: {
    marginTop: 28,
  },
  episodesTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  episodesLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  episodesLoadingText: {
    color: '#888',
    fontSize: 14,
  },
  episodesEmptyText: {
    color: '#666',
    fontSize: 14,
  },
  episodeList: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    backgroundColor: '#111',
  },
  episodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  episodeItemActive: {
    backgroundColor: '#1f0a0b',
  },
  episodeMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  episodeTextBlock: {
    flex: 1,
    marginRight: 10,
  },
  episodeLabel: {
    color: '#b3b3b3',
    fontSize: 12,
    marginBottom: 2,
  },
  episodeTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  episodeDownloadButton: {
    paddingLeft: 10,
    paddingVertical: 4,
  },
  description: {
    color: '#e5e5e5',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 4,
  },
  suggestionsSection: {
    marginTop: 28,
  },
  suggestionsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  suggestionsLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  suggestionsLoadingText: {
    color: '#888',
    fontSize: 14,
  },
  suggestionsEmptyText: {
    color: '#666',
    fontSize: 14,
  },
  suggestionsRow: {
    paddingRight: 20,
  },
  suggestionCard: {
    width: 120,
    height: 180,
    marginRight: 14,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  suggestionPoster: {
    width: '100%',
    height: '100%',
  },
  suggestionPosterPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  suggestionPlaceholderText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },
  suggestionTypeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  suggestionTypeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  loadingText: {
    color: '#888',
    fontSize: 15,
    marginTop: 12,
  },
  errorText: {
    color: '#e5e5e5',
    fontSize: 16,
  },
});