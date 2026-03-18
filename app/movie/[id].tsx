// @ts-nocheck
import { addDownloadedMovie, isMovieDownloaded } from '@/lib/downloads';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Movie = { id: string; title: string; description: string | null; poster_url: string | null; video_url: string | null; category: string | null; type: string | null; };
type Episode = { id: string; season_number: number; episode_number: number; title: string; video_url: string | null; };

// --- 1. SMART WEB PLAYER (Handles HLS and MP4) ---
function WebHLSPlayer({ url, initialTime, onTimeUpdate }: { url: string; initialTime: number; onTimeUpdate: (time: number) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    const isMP4 = url.toLowerCase().includes('.mp4') || url.includes('highest.mp4');

    if (isMP4) {
      video.src = url;
      video.currentTime = initialTime;
      video.play().catch(e => console.log("Autoplay blocked:", e));
    } else {
      import('hls.js').then((HlsModule) => {
        const Hls = HlsModule.default;
        if (Hls.isSupported()) {
          const hls = new Hls({ startPosition: initialTime });
          const hlsUrl = url.includes('.m3u8') ? url : `${url}.m3u8`;
          hls.loadSource(hlsUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => { 
            video.play().catch(() => {}); 
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url;
          video.currentTime = initialTime;
          video.play().catch(() => {});
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
      style={{ width: '100%', height: '100%', backgroundColor: '#000' }}
    />
  );
}

// --- 2. HYBRID PLAYER BLOCK ---
function VideoPlayerBlock({ url, onError, initialTime, movieId, userId }: { url: string; onError: (msg: string) => void; initialTime: number; movieId: string; userId: string | null; }) {
  const isWeb = Platform.OS === 'web';
  const player = !isWeb ? useVideoPlayer(url, (p) => { p.play(); }) : null;

  return (
    <View style={styles.videoContainer}>
      {isWeb ? (
        <WebHLSPlayer url={url} initialTime={initialTime} onTimeUpdate={() => {}} />
      ) : (
        <VideoView 
          style={{ flex: 1 }} 
          player={player!} 
          nativeControls={true} 
          fullscreenOptions={{ enable: true }} 
        />
      )}
    </View>
  );
}

// --- 3. THEATER SCREEN ---
export default function TheaterScreen() {
  const params = useLocalSearchParams<{ id: string; localUri?: string; title?: string; poster_url?: string; }>();
  const { id, localUri: paramLocalUri } = params;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);
  const [isInMyList, setIsInMyList] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const isOfflineMode = Boolean(paramLocalUri);

  // FETCH MOVIE, EPISODES, AND SIMILAR TITLES
  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          const { data: wl } = await supabase.from('watchlist').select('id').eq('user_id', user.id).eq('movie_id', id).maybeSingle();
          setIsInMyList(!!wl);
        }

        const { data: movieData, error } = await supabase.from('movies').select('*').eq('id', id).single();
        if (error) throw error;
        setMovie(movieData);

        // Fetch Episodes if Series
        if (movieData.type === 'TV Series') {
          const { data: epData } = await supabase.from('episodes').select('*').eq('movie_id', id).eq('status', 'active').order('episode_number');
          setEpisodes(epData || []);
        }

        // Fetch Similar
        const { data: simData } = await supabase.from('movies').select('*').eq('category', movieData.category).neq('id', id).limit(6);
        setSimilarMovies(simData || []);

        const downloaded = await isMovieDownloaded(id);
        setIsDownloaded(downloaded);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const toggleWatchlist = async () => {
    if (!userId || !movie) return;
    try {
      if (isInMyList) {
        await supabase.from('watchlist').delete().eq('user_id', userId).eq('movie_id', movie.id);
        setIsInMyList(false);
      } else {
        await supabase.from('watchlist').insert({ user_id: userId, movie_id: movie.id });
        setIsInMyList(true);
      }
    } catch (e) { console.error(e); }
  };

  const handleDownload = async () => {
    if (!movie || isDownloading || isDownloaded) return;
    const activeUrl = currentVideoUrl || movie.video_url;
    if (!activeUrl) return;

    let mp4Url = activeUrl;
    if (activeUrl.includes('stream.mux.com')) {
      mp4Url = activeUrl.endsWith('.m3u8') ? activeUrl.replace('.m3u8', '/highest.mp4') : `${activeUrl}/highest.mp4`;
    }

    setIsDownloading(true);
    try {
      const fileUri = `${FileSystem.documentDirectory}${movie.id}.mp4`;
      const downloadResumable = FileSystem.createDownloadResumable(mp4Url, fileUri, {}, (p) => {
        setDownloadProgress(Math.round((p.totalBytesWritten / p.totalBytesExpectedToWrite) * 100));
      });
      const result = await downloadResumable.downloadAsync();
      if (result) {
        await addDownloadedMovie({ id: movie.id, title: movie.title, poster_url: movie.poster_url, localUri: result.uri });
        setIsDownloaded(true);
        Alert.alert("Success", "Saved offline.");
      }
    } catch (e) { Alert.alert("Error", "Download failed."); }
    finally { setIsDownloading(false); setDownloadProgress(null); }
  };

  if (loading) return <View style={styles.container}><ActivityIndicator size="large" color="#e50914" /></View>;
  if (!movie) return <View style={styles.container}><Text style={{color:'#fff'}}>Not found.</Text></View>;

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll}>
        {/* MEDIA SECTION */}
        {isPlaying && currentVideoUrl ? (
          <VideoPlayerBlock url={currentVideoUrl} movieId={movie.id} userId={userId} initialTime={0} onError={()=>{}} />
        ) : (
          <View style={styles.posterBox}>
            <Image source={{ uri: movie.poster_url }} style={styles.mainPoster} />
            <Pressable style={styles.playOverlay} onPress={() => {
              setCurrentVideoUrl(movie.type === 'TV Series' ? episodes[0]?.video_url : movie.video_url);
              setIsPlaying(true);
            }}>
              <Ionicons name="play" size={60} color="#fff" />
            </Pressable>
          </View>
        )}

        {/* INFO SECTION */}
        <View style={styles.details}>
          <Text style={styles.title}>{movie.title}</Text>
          <Text style={styles.meta}>{movie.category} • {movie.type}</Text>

          {/* BUTTON ROW */}
          <View style={styles.buttonRow}>
            <Pressable style={styles.playBtn} onPress={() => setIsPlaying(true)}>
              <Ionicons name="play" size={22} color="#000" />
              <Text style={styles.playBtnText}>Play</Text>
            </Pressable>

            <Pressable style={styles.actionBtn} onPress={toggleWatchlist}>
              <Ionicons name={isInMyList ? "checkmark" : "add"} size={26} color="#fff" />
              <Text style={styles.actionBtnText}>My List</Text>
            </Pressable>

            {!isDownloaded && (
              <Pressable style={styles.actionBtn} onPress={handleDownload} disabled={isDownloading}>
                <Ionicons name="download-outline" size={24} color={isDownloading ? "#555" : "#fff"} />
                <Text style={styles.actionBtnText}>{isDownloading ? `${downloadProgress}%` : 'Download'}</Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.description}>{movie.description}</Text>

          {/* EPISODES LIST */}
          {movie.type === 'TV Series' && episodes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Episodes</Text>
              {episodes.map(ep => (
                <Pressable key={ep.id} style={styles.epRow} onPress={() => {
                  setCurrentVideoUrl(ep.video_url);
                  setIsPlaying(true);
                }}>
                  <View style={styles.epInfo}>
                    <Text style={styles.epMeta}>S{ep.season_number} E{ep.episode_number}</Text>
                    <Text style={styles.epTitle}>{ep.title}</Text>
                  </View>
                  <Ionicons name="play-circle-outline" size={28} color="#fff" />
                </Pressable>
              ))}
            </View>
          )}

          {/* SIMILAR TITLES */}
          {similarMovies.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>More Like This</Text>
              <View style={styles.grid}>
                {similarMovies.map(m => (
                  <Pressable key={m.id} style={styles.gridItem} onPress={() => router.push(`/movie/${m.id}`)}>
                    <Image source={{ uri: m.poster_url }} style={styles.gridImage} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { position: 'absolute', left: 15, zIndex: 10 },
  backButton: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 },
  scroll: { flex: 1 },
  videoContainer: { width: '100%', aspectRatio: 16/9, backgroundColor: '#000' },
  posterBox: { width: '100%', aspectRatio: 16/9, backgroundColor: '#111' },
  mainPoster: { width: '100%', height: '100%', opacity: 0.6 },
  playOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  details: { padding: 20 },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  meta: { color: '#888', marginVertical: 8, fontWeight: '600' },
  buttonRow: { flexDirection: 'row', gap: 15, marginVertical: 15, alignItems: 'center' },
  playBtn: { flex: 1, backgroundColor: '#fff', height: 45, borderRadius: 4, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  playBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  actionBtn: { alignItems: 'center', minWidth: 60 },
  actionBtnText: { color: '#888', fontSize: 11, marginTop: 4 },
  description: { color: '#ccc', fontSize: 15, lineHeight: 22, marginTop: 10 },
  section: { marginTop: 30 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  epRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 15, borderRadius: 8, marginBottom: 10 },
  epInfo: { flex: 1 },
  epMeta: { color: '#e50914', fontWeight: 'bold', fontSize: 12 },
  epTitle: { color: '#fff', fontSize: 15, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: (Dimensions.get('window').width - 50) / 3, aspectRatio: 2/3 },
  gridImage: { width: '100%', height: '100%', borderRadius: 4, backgroundColor: '#111' }
});