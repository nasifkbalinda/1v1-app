// @ts-nocheck
import { addDownloadedMovie, isMovieDownloaded } from '@/lib/downloads';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useEvent } from 'expo';
import * as FileSystem from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Movie = { id: string; title: string; description: string | null; poster_url: string | null; video_url: string | null; category: string | null; type: string | null; };
type Episode = { id: string; season_number: number; episode_number: number; title: string; video_url: string | null; };

// --- FIX 1: THE SMART WEB PLAYER (Handles HLS and MP4) ---
function WebHLSPlayer({ url, initialTime, onTimeUpdate }: { url: string; initialTime: number; onTimeUpdate: (time: number) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    // Detect format
    const isMP4 = url.toLowerCase().includes('.mp4') || url.includes('highest.mp4');

    if (isMP4) {
      // Standard MP4 Playback
      video.src = url;
      video.currentTime = initialTime;
      video.play().catch(e => console.log("Autoplay blocked:", e));
    } else {
      // HLS Streaming Playback
      import('hls.js').then((HlsModule) => {
        const Hls = HlsModule.default;
        if (Hls.isSupported()) {
          const hls = new Hls({ startPosition: initialTime });
          // Ensure URL has extension for HLS
          const hlsUrl = url.includes('.m3u8') ? url : `${url}.m3u8`;
          hls.loadSource(hlsUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => { 
            video.play().catch(e => console.log("Autoplay blocked:", e)); 
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url;
          video.currentTime = initialTime;
          video.play().catch(e => console.log("Autoplay blocked:", e));
        }
      });
    }
  }, [url, initialTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTimeUpdate = () => onTimeUpdate(video.currentTime);
    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [onTimeUpdate]);

  return (
    <video
      ref={videoRef}
      controls
      autoPlay
      playsInline
      style={{ width: '100%', height: '100%', backgroundColor: '#000', borderRadius: 12 }}
    />
  );
}

// --- HYBRID PLAYER BLOCK ---
function VideoPlayerBlock({ url, onError, initialTime, movieId, userId }: { url: string; onError: (msg: string) => void; initialTime: number; movieId: string; userId: string | null; }) {
  const isWeb = Platform.OS === 'web';
  const { width } = Dimensions.get('window');
  const maxVideoWidth = isWeb ? Math.min(width - 40, 960) : width;
  const videoHeight = maxVideoWidth * (9 / 16);

  const player = !isWeb ? useVideoPlayer(url, (p) => {
    p.loop = false;
    p.staysActiveInBackground = true; 
    p.play();
  }) : null;

  const statusEvent = !isWeb ? useEvent(player, 'statusChange', { status: player?.status } as any) as any : null;
  const status = statusEvent?.status ?? player?.status;
  const playerError = statusEvent?.error;
  const [hasSeeked, setHasSeeked] = useState(false);
  const hasCountedView = useRef(false);

  useEffect(() => { 
    if (!isWeb && playerError) {
      onError(`Playback Error: ${playerError?.message || 'Check connection'}`); 
    }
  }, [playerError, onError, isWeb]);

  useEffect(() => {
    if (!isWeb && player && status === 'readyToPlay' && initialTime > 0 && !hasSeeked) {
      player.currentTime = initialTime;
      setHasSeeked(true);
    }
  }, [status, initialTime, hasSeeked, player, isWeb]);

  const lastUpdateRef = useRef(0);
  const handleProgress = useCallback((currentTime: number) => {
    if (!userId || !movieId || currentTime < 5) return;
    if (!hasCountedView.current) {
      hasCountedView.current = true;
      supabase.rpc('increment_view_count', { row_id: movieId }).then();
    }
    const now = Date.now();
    if (now - lastUpdateRef.current > 10000) { 
      supabase.from('playback_progress').upsert(
        { user_id: userId, movie_id: movieId, timestamp_seconds: Math.floor(currentTime), updated_at: new Date().toISOString() }, 
        { onConflict: 'user_id, movie_id' }
      ).then();
      lastUpdateRef.current = now;
    }
  }, [userId, movieId]);

  useEffect(() => {
    if (isWeb || !player) return;
    const interval = setInterval(() => { if (player.playing) handleProgress(player.currentTime); }, 2000);
    return () => clearInterval(interval);
  }, [player, isWeb, handleProgress]);

  return (
    <View style={{ alignItems: 'center', backgroundColor: '#000', paddingVertical: isWeb ? 24 : 0 }}>
      <View style={{ width: maxVideoWidth, height: videoHeight, borderRadius: isWeb ? 12 : 0, overflow: 'hidden' }}>
        {isWeb ? (
          <WebHLSPlayer url={url} initialTime={initialTime} onTimeUpdate={handleProgress} />
        ) : (
          <VideoView 
            style={{ width: '100%', height: '100%' }} 
            player={player!} 
            contentFit="contain" 
            nativeControls={true} 
            fullscreenOptions={{ enable: true }} 
            allowsPictureInPicture 
          />
        )}
      </View>
    </View>
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
  const [videoFailedMsg, setVideoFailedMsg] = useState<string | null>(null);
  const [isInMyList, setIsInMyList] = useState(false);
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [initialTime, setInitialTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);

  const isOfflineMode = Boolean(paramLocalUri);

  useEffect(() => {
    if (!id) { setLoading(false); setError('No movie ID'); return; }
    if (isOfflineMode) {
      setMovie({ id, title: paramTitle ?? 'Movie', description: null, poster_url: paramPosterUrl ?? null, video_url: paramLocalUri ?? null, category: null, type: null });
      setLoading(false); setIsDownloaded(true); setCurrentVideoUrl(paramLocalUri ?? null); setIsPlaying(true);
      return;
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
  }, [id, isOfflineMode, paramLocalUri]);

  // FIX 3: Reset error message when switching videos
  const handlePlayRequest = (urlToPlay: string | null) => {
    if (!urlToPlay) return;
    setVideoFailedMsg(null); 
    if (!userId && !isOfflineMode) { router.push('/settings'); return; }
    setCurrentVideoUrl(urlToPlay);
    setIsPlaying(true);
  };

  // FIX 2: UPDATED MUX MP4 DOWNLOADER PATH
  const downloadVideo = useCallback(async (videoUrl: string, title: string) => {
      if (!movie || isOfflineMode || !videoUrl || isDownloading || isDownloaded) return;
      if (!userId) { router.push('/settings'); return; }

      // Use the 'highest.mp4' format we set in the backend
      let mp4Url = videoUrl;
      if (videoUrl.includes('stream.mux.com')) {
        mp4Url = videoUrl.endsWith('.m3u8') 
          ? videoUrl.replace('.m3u8', '/highest.mp4') 
          : `${videoUrl}/highest.mp4`;
      }

      if (Platform.OS === 'web') return;

      const fileUri = `${FileSystem.documentDirectory}movie_${movie!.id}.mp4`;
      setIsDownloading(true);
      setDownloadProgress(0);
      try {
        const downloadResumable = FileSystem.createDownloadResumable(mp4Url, fileUri, {}, ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          if (totalBytesExpectedToWrite > 0) {
            setDownloadProgress(Math.min(100, Math.round((100 * totalBytesWritten) / totalBytesExpectedToWrite)));
          }
        });
        const result = await downloadResumable.downloadAsync();
        if (result && result.status >= 200 && result.status < 300) {
          await addDownloadedMovie({ id: movie!.id, title, poster_url: movie!.poster_url, localUri: result.uri });
          setIsDownloaded(true);
          Alert.alert('Success', 'Saved for offline.');
        } else {
          Alert.alert('Error', 'File not ready yet.');
        }
      } catch (err) { Alert.alert('Error', 'Download failed.'); } 
      finally { setIsDownloading(false); setDownloadProgress(null); }
    }, [movie, isOfflineMode, isDownloading, isDownloaded, userId]);

  const handleDownload = useCallback(async () => {
    if (!movie) return;
    const activeVideoUrl = currentVideoUrl || movie!.video_url; 
    if (activeVideoUrl) await downloadVideo(activeVideoUrl, movie!.title);
  }, [movie, currentVideoUrl, downloadVideo]);

  if (loading) return (<View style={styles.container}><ActivityIndicator size="large" color="#e50914" style={{marginTop: 100}}/></View>);

  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}><Ionicons name="arrow-back" size={26} color="#fff" /></Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {isPlaying && currentVideoUrl && !videoFailedMsg ? (
          <VideoPlayerBlock key={currentVideoUrl} url={currentVideoUrl} onError={(msg) => setVideoFailedMsg(msg)} initialTime={initialTime} movieId={movie.id} userId={userId} />
        ) : (
          <View style={styles.videoPlaceholder}>
            {videoFailedMsg ? (
              <Text style={styles.errorText}>{videoFailedMsg}</Text>
            ) : (
              <Image source={{ uri: movie?.poster_url }} style={styles.videoPoster} resizeMode="contain" />
            )}
            <Pressable style={styles.bigPlayButton} onPress={() => handlePlayRequest(movie?.video_url)}>
              <Ionicons name="play" size={40} color="#fff" />
            </Pressable>
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.title}>{movie?.title}</Text>
          <View style={styles.actionButtonsRow}>
            {!isDownloaded && (
              <Pressable style={[styles.downloadButton, isDownloading && styles.downloadButtonDisabled]} onPress={handleDownload}>
                <Text style={styles.downloadButtonText}>{isDownloading ? `Downloading ${downloadProgress}%` : 'Download Offline'}</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.description}>{movie?.description}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  headerRow: { flexDirection: 'row', paddingHorizontal: 12, backgroundColor: '#0a0a0a' },
  backButton: { padding: 10 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  videoPlaceholder: { width: '100%', height: 250, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  videoPoster: { ...StyleSheet.absoluteFillObject },
  bigPlayButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#e50914', justifyContent: 'center', alignItems: 'center' },
  info: { padding: 20 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  description: { color: '#ccc', fontSize: 16, lineHeight: 24 },
  actionButtonsRow: { marginVertical: 15 },
  downloadButton: { backgroundColor: '#e50914', padding: 12, borderRadius: 5, alignItems: 'center' },
  downloadButtonDisabled: { backgroundColor: '#555' },
  downloadButtonText: { color: '#fff', fontWeight: 'bold' },
  errorText: { color: '#e50914', textAlign: 'center', padding: 20 }
});