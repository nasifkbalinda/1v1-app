import { addDownloadedMovie, isMovieDownloaded, type DownloadedMovie } from '@/lib/downloads';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Movie = { id: string; title: string; description: string | null; poster_url: string | null; video_url: string | null; category: string | null; type: string | null; };
type Episode = { id: string; season_number: number; episode_number: number; title: string; video_url: string | null; };

function VideoPlayerBlock({ url, onError, initialTime, movieId, userId }: { url: string; onError: (msg: string) => void; initialTime: number; movieId: string; userId: string | null; }) {
  
  // ---> THE WEB FORMAT FIX <---
  // Chrome desktop cannot play .m3u8 directly. We swap it to the MP4 file for web users!
  const playableUrl = (Platform.OS === 'web' && url.includes('stream.mux.com')) 
    ? url.replace('.m3u8', '/capped-1080p.mp4') 
    : url;

  const player = useVideoPlayer(playableUrl, (p) => {
    p.loop = false;
    p.staysActiveInBackground = true; 
    p.play();
  });

  const { status, error } = useEvent(player, 'statusChange', { status: player.status, error: null as unknown });
  const [hasSeeked, setHasSeeked] = useState(false);

  useEffect(() => { 
    if (error) {
      let msg = 'Unknown Error';
      if (typeof error === 'object' && error !== null) {
        msg = (error as any).message || JSON.stringify(error);
      } else { msg = String(error); }
      onError(`File Corrupted or Missing: ${msg}`); 
    }
  }, [error, onError]);

  useEffect(() => {
    if (status === 'readyToPlay' && initialTime > 0 && !hasSeeked) {
      player.currentTime = initialTime;
      setHasSeeked(true);
    }
  }, [status, initialTime, hasSeeked, player]);

  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => {
      if (player.playing && player.currentTime > 5) {
        supabase.from('playback_progress').upsert({ user_id: userId, movie_id: movieId, timestamp_seconds: Math.floor(player.currentTime), updated_at: new Date().toISOString() }, { onConflict: 'user_id, movie_id' }).then();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [player, movieId, userId]);

  const { width } = Dimensions.get('window');
  const isWeb = Platform.OS === 'web';
  
  // ---> DESKTOP SIZE OPTIMIZATION <---
  const maxVideoWidth = isWeb ? Math.min(width - 40, 960) : width;
  const videoHeight = maxVideoWidth * (9 / 16);

  return (
    <View style={{ alignItems: 'center', backgroundColor: '#000', paddingVertical: isWeb ? 24 : 0 }}>
      <VideoView 
        style={[styles.videoView, { width: maxVideoWidth, height: videoHeight, borderRadius: isWeb ? 12 : 0, overflow: 'hidden' }]} 
        player={player} 
        contentFit="contain" 
        nativeControls={true} 
        fullscreenOptions={{ enable: true }} 
        allowsPictureInPicture 
      />
    </View>
  );
}

function MoviePosterCard({ movie }: { movie: Movie }) {
  const router = useRouter();
  const { width } = Dimensions.get('window');
  const isWeb = Platform.OS === 'web';
  const cardWidth = isWeb ? 160 : (width - 40 - 16) / 3; 

  return (
    <Pressable style={[styles.similarCard, { width: cardWidth }]} onPress={() => router.push(`/movie/${movie.id}`)}>
      {movie.poster_url ? (
        <Image source={{ uri: movie.poster_url }} style={[styles.similarPoster, { height: isWeb ? 240 : 160 }]} resizeMode="cover" />
      ) : (
        <View style={[styles.similarPosterPlaceholder, { height: isWeb ? 240 : 160 }]}><Text style={styles.similarPosterText}>{movie.title}</Text></View>
      )}
    </Pressable>
  );
}

export default function TheaterScreen() {
  const params = useLocalSearchParams<{ id: string; localUri?: string; title?: string; poster_url?: string; }>();
  const { id, localUri: paramLocalUri, title: paramTitle, poster_url: paramPosterUrl } = params;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [videoFailedMsg, setVideoFailedMsg] = useState<string | null>(null);
  const [isInMyList, setIsInMyList] = useState(false);
  const [watchlistToggling, setWatchlistToggling] = useState(false);
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [initialTime, setInitialTime] = useState<number>(0);

  const isOfflineMode = Boolean(paramLocalUri);

  useEffect(() => {
    if (!id) { setLoading(false); setError('No movie ID'); return; }
    if (isOfflineMode) {
      setMovie({ id, title: paramTitle ?? 'Movie', description: null, poster_url: paramPosterUrl ?? null, video_url: paramLocalUri ?? null, category: null, type: null });
      setLoading(false); setIsDownloaded(true); return;
    }
    
    async function fetchMovie() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          const { data: prog } = await supabase.from('playback_progress').select('timestamp_seconds').eq('user_id', user.id).eq('movie_id', id).maybeSingle();
          if (prog) setInitialTime(Number(prog.timestamp_seconds));
        }

        const [downloaded] = await Promise.all([
          isMovieDownloaded(id),
          (async () => {
            const { data, error: fetchError } = await supabase.from('movies').select('*').eq('id', id).single();
            if (fetchError) throw fetchError;
            setMovie(data);
          })(),
        ]);
        setIsDownloaded(downloaded);
      } catch (err) { setError('Could not load movie'); } finally { setLoading(false); }
    }
    fetchMovie();
  }, [id, isOfflineMode, paramLocalUri, paramTitle, paramPosterUrl]);

  useEffect(() => {
    if (isOfflineMode) { setCurrentVideoUrl(paramLocalUri ?? null); return; }
    if (movie?.video_url) setCurrentVideoUrl(movie.video_url);
    else setCurrentVideoUrl(null);
  }, [isOfflineMode, paramLocalUri, movie]);

  useEffect(() => { setVideoFailedMsg(null); }, [currentVideoUrl]);

  useEffect(() => {
    if (!movie || movie.type !== 'TV Series' || isOfflineMode) { setEpisodes([]); return; }
    let isCancelled = false;
    async function fetchEpisodes() {
      try {
        const { data } = await supabase.from('episodes').select('*').eq('movie_id', movie?.id).order('season_number', { ascending: true }).order('episode_number', { ascending: true });
        if (!isCancelled) setEpisodes((data as Episode[]) ?? []);
      } catch (err) { if (!isCancelled) setEpisodes([]); }
    }
    fetchEpisodes();
    return () => { isCancelled = true; };
  }, [movie, isOfflineMode]);

  useEffect(() => {
    if (!movie || isOfflineMode || !userId) return;
    let isCancelled = false;
    async function checkWatchlist() {
      try {
        const { data } = await supabase.from('watchlist').select('id').eq('user_id', userId).eq('movie_id', movie.id).maybeSingle();
        if (!isCancelled) setIsInMyList(!!data);
      } catch (err) { console.error(err); }
    }
    checkWatchlist();
    return () => { isCancelled = true; };
  }, [movie?.id, isOfflineMode, userId]);

  useEffect(() => {
    if (!movie || !movie.category || isOfflineMode) return;
    async function fetchSimilar() {
      try {
        const { data } = await supabase.from('movies').select('*').eq('category', movie.category).neq('id', movie.id).limit(6);
        setSimilarMovies(data as Movie[] ?? []);
      } catch (err) { setSimilarMovies([]); }
    }
    fetchSimilar();
  }, [movie?.id, movie?.category, isOfflineMode]);

  const handleWatchlistToggle = useCallback(async () => {
    if (!movie || isOfflineMode || watchlistToggling) return;
    if (!userId) {
      if (Platform.OS === 'web') window.alert("Please log in to use My List");
      return;
    }
    setWatchlistToggling(true);
    try {
      if (isInMyList) {
        await supabase.from('watchlist').delete().eq('user_id', userId).eq('movie_id', movie.id);
        setIsInMyList(false);
      } else {
        await supabase.from('watchlist').insert({ user_id: userId, movie_id: movie.id });
        setIsInMyList(true);
      }
    } catch (err) {} finally { setWatchlistToggling(false); }
  }, [movie, isOfflineMode, isInMyList, watchlistToggling, userId]);

  const downloadVideo = useCallback(
    async (videoUrl: string, title: string) => {
      if (!movie || isOfflineMode || !videoUrl || isDownloading || isDownloaded) return;

      const mp4Url = videoUrl.includes('stream.mux.com') ? videoUrl.replace('.m3u8', '/capped-1080p.mp4') : videoUrl;

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          const a = document.createElement('a');
          a.href = mp4Url;
          a.download = `${title}.mp4`;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        return;
      }

      const fileUri = `${FileSystem.documentDirectory}movie_${movie.id}.mp4`;
      setIsDownloading(true);
      setDownloadProgress(0);
      try {
        const downloadResumable = FileSystem.createDownloadResumable(mp4Url, fileUri, {}, ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
            if (totalBytesExpectedToWrite > 0) {
              const pct = Math.round((100 * totalBytesWritten) / totalBytesExpectedToWrite);
              setDownloadProgress(Math.min(100, pct));
            }
          }
        );
        const result = await downloadResumable.downloadAsync();
        if (result && result.status >= 200 && result.status < 300) {
          const entry: DownloadedMovie = { id: movie.id, title, poster_url: movie.poster_url, localUri: result.uri };
          await addDownloadedMovie(entry);
          setIsDownloaded(true);
          Alert.alert('Download Complete', `${title} has been saved for offline viewing.`);
        } else {
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
          Alert.alert('Not Ready Yet', 'The high-quality MP4 file is still processing on the servers. Please try again in a few minutes.');
        }
      } catch (err) { Alert.alert('Download Failed', 'Check your network connection and try again.'); } finally { setIsDownloading(false); setDownloadProgress(null); }
    },
    [movie, isOfflineMode, isDownloading, isDownloaded]
  );

  const handleDownload = useCallback(async () => {
    if (!movie) return;
    const activeVideoUrl = currentVideoUrl || movie.video_url; 
    if (!activeVideoUrl) return;
    if (Platform.OS === 'web') window.alert("Your download will begin shortly. \n\nNote: For brand new uploads, the high-quality MP4 file may take 3-5 minutes to finish processing in the background before the download link works.");
    await downloadVideo(activeVideoUrl, movie.title);
  }, [movie, currentVideoUrl, downloadVideo]);

  if (loading) return (<View style={styles.container}><View style={styles.centered}><ActivityIndicator size="large" color="#e50914" /></View></View>);
  if (error || !movie) return (<View style={styles.container}><View style={styles.centered}><Text style={styles.errorText}>{error ?? 'Movie not found'}</Text></View></View>);

  const { width } = Dimensions.get('window');
  const isWeb = Platform.OS === 'web';
  const maxVideoWidth = isWeb ? Math.min(width - 40, 960) : width;
  const videoHeight = maxVideoWidth * (9 / 16);
  
  const activeVideoUrl = currentVideoUrl || movie.video_url;
  const showDownloadButton = !isOfflineMode && !isDownloaded && !!activeVideoUrl;

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}><Ionicons name="arrow-back" size={26} color="#fff" /></Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {currentVideoUrl && !videoFailedMsg ? (
          <View style={styles.videoContainer}>
            <VideoPlayerBlock key={currentVideoUrl} url={currentVideoUrl} onError={(msg) => setVideoFailedMsg(msg)} initialTime={initialTime} movieId={movie.id} userId={userId} />
          </View>
        ) : (
          <View style={[styles.videoPlaceholder, { width: maxVideoWidth, height: videoHeight, borderRadius: isWeb ? 12 : 0, marginVertical: isWeb ? 24 : 0 }]}>
            {videoFailedMsg ? (
              <View style={{padding: 20, alignItems: 'center'}}><Ionicons name="alert-circle-outline" size={40} color="#e50914" style={{marginBottom: 10}} /><Text style={[styles.errorText, {textAlign: 'center'}]}>{videoFailedMsg}</Text></View>
            ) : movie.poster_url ? (
              <Image source={{ uri: movie.poster_url }} style={styles.videoPoster} resizeMode="contain" />
            ) : (
              <Text style={styles.placeholderText}>Preparing Stream...</Text>
            )}
          </View>
        )}

        <View style={styles.webContentWrapper}>
          <View style={styles.info}>
            <Text style={styles.title}>{movie.title}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaBadge}><Text style={styles.metaBadgeText}>{movie.type || 'Movie'}</Text></View>
              <Text style={styles.metaCategory}>{movie.category || 'V Original'}</Text>
            </View>

            <View style={styles.actionButtonsRow}>
              {showDownloadButton && (
                <Pressable style={[styles.downloadButton, isDownloading && styles.downloadButtonDisabled]} onPress={handleDownload} disabled={isDownloading}>
                  <Ionicons name="download-outline" size={20} color="#fff" />
                  <Text style={styles.downloadButtonText}>{isDownloading ? `Downloading ${downloadProgress}%` : Platform.OS === 'web' ? 'Download MP4 (Desktop)' : 'Offline Download'}</Text>
                </Pressable>
              )}
              {!isOfflineMode && (
                <Pressable style={[styles.myListButton, watchlistToggling && styles.myListButtonDisabled]} onPress={handleWatchlistToggle} disabled={watchlistToggling}>
                  <Ionicons name={isInMyList ? "checkmark" : "add"} size={20} color="#fff" />
                  <Text style={styles.myListButtonText}>{isInMyList ? 'In My List' : 'Add to List'}</Text>
                </Pressable>
              )}
            </View>

            {movie.description && <Text style={styles.description}>{movie.description}</Text>}

            {!isOfflineMode && movie.type === 'TV Series' && episodes.length > 0 && (
              <View style={styles.episodesSection}>
                <Text style={styles.episodesTitle}>Episodes</Text>
                <View style={styles.episodeList}>
                  {episodes.map((ep) => (
                    <Pressable key={ep.id} style={[styles.episodeItem, ep.video_url === currentVideoUrl && styles.episodeItemActive]} onPress={() => ep.video_url && setCurrentVideoUrl(ep.video_url)}>
                      <View style={styles.episodeTextBlock}>
                        <Text style={styles.episodeLabel}>{`S${ep.season_number}:E${ep.episode_number}`}</Text>
                        <Text style={styles.episodeTitle} numberOfLines={1}>{ep.title}</Text>
                      </View>
                      <Ionicons name="play-circle-outline" size={22} color={ep.video_url === currentVideoUrl ? '#e50914' : '#fff'} />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {!isOfflineMode && similarMovies.length > 0 && (
              <View style={styles.similarSection}>
                <Text style={styles.episodesTitle}>Similar Titles</Text>
                <View style={styles.similarGrid}>
                  {similarMovies.map((m) => (
                    <MoviePosterCard key={m.id} movie={m} />
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, backgroundColor: '#0a0a0a' },
  backButton: { paddingVertical: 10, paddingHorizontal: 6, marginRight: 8 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  videoContainer: { width: '100%', backgroundColor: '#000', alignSelf: 'center' },
  videoView: { backgroundColor: '#000' },
  videoPlaceholder: { backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', overflow: 'hidden' },
  videoPoster: { width: '100%', height: '100%' },
  placeholderText: { color: '#666', fontSize: 16 },
  
  webContentWrapper: { width: '100%', maxWidth: 1200, alignSelf: 'center' },
  
  info: { paddingHorizontal: 20, paddingTop: 24 },
  title: { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  metaBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#e50914' },
  metaBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  metaCategory: { color: '#b3b3b3', fontSize: 13, textTransform: 'uppercase' },
  actionButtonsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' },
  downloadButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e50914', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 999 },
  downloadButtonDisabled: { backgroundColor: '#555' },
  downloadButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  myListButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a1a1a', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 999, borderWidth: 1, borderColor: '#333' },
  myListButtonDisabled: { opacity: 0.5 },
  myListButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  episodesSection: { marginTop: 28 },
  episodesTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 12 },
  episodeList: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#1f1f1f', backgroundColor: '#111' },
  episodeItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  episodeItemActive: { backgroundColor: '#1f0a0b' },
  episodeTextBlock: { flex: 1, marginRight: 10 },
  episodeLabel: { color: '#b3b3b3', fontSize: 12 },
  episodeTitle: { color: '#fff', fontSize: 15, fontWeight: '500' },
  description: { color: '#e5e5e5', fontSize: 16, lineHeight: 24, marginTop: 4 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#e5e5e5', fontSize: 16 },
  similarSection: { marginTop: 40 },
  similarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  similarCard: { borderRadius: 8, overflow: 'hidden', backgroundColor: '#111' },
  similarPoster: { width: '100%' },
  similarPosterPlaceholder: { width: '100%', backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  similarPosterText: { color: '#888', padding: 10, textAlign: 'center' },
});