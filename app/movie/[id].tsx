// @ts-nocheck
import { addDownloadedMovie, isMovieDownloaded } from '@/lib/downloads';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Movie = { id: string; title: string; description: string | null; poster_url: string | null; backdrop_url?: string | null; video_url: string | null; category: string | null; type: string | null; };
type Episode = { id: string; season_number: number; episode_number: number; title: string; video_url: string | null; };

function WebHLSPlayer({ url, initialTime, onTimeUpdate }: { url: string; initialTime: number; onTimeUpdate: (time: number) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;
    const isMP4 = url.toLowerCase().includes('.mp4') || url.includes('highest.mp4');
    if (isMP4) {
      video.src = url; video.currentTime = initialTime; video.play().catch(e => console.log("Autoplay blocked:", e));
    } else {
      import('hls.js').then((HlsModule) => {
        const Hls = HlsModule.default;
        if (Hls.isSupported()) {
          const hls = new Hls({ startPosition: initialTime });
          const hlsUrl = url.includes('.m3u8') ? url : `${url}.m3u8`;
          hls.loadSource(hlsUrl); hls.attachMedia(video); hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url; video.currentTime = initialTime; video.play().catch(() => {});
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

  return <video ref={videoRef} controls autoPlay playsInline style={{ width: '100%', height: '100%', backgroundColor: '#000' }} />;
}

function VideoPlayerBlock({ url, onError, initialTime, movieId, userId }: { url: string; onError: (msg: string) => void; initialTime: number; movieId: string; userId: string | null; }) {
  const isWeb = Platform.OS === 'web';
  const player = !isWeb ? useVideoPlayer(url, (p) => { p.play(); }) : null;
  const hasCountedView = useRef(false);

  useEffect(() => {
    const viewTimer = setTimeout(() => {
      if (!hasCountedView.current) {
        hasCountedView.current = true;
        const safeId = isNaN(Number(movieId)) ? movieId : Number(movieId);
        supabase.rpc('increment_view_count', { row_id: safeId }).then();
      }
    }, 6000);
    return () => clearTimeout(viewTimer);
  }, [movieId]);

  useEffect(() => {
    if (!userId || !movieId) return;
    const progressTimer = setInterval(() => {
      const currentTime = isWeb && document.querySelector('video') ? document.querySelector('video')?.currentTime || 0 : player?.currentTime || 0;
      if (currentTime > 5) {
        supabase.from('playback_progress').upsert({ user_id: userId, movie_id: movieId, timestamp_seconds: Math.floor(currentTime), updated_at: new Date().toISOString() }, { onConflict: 'user_id, movie_id' }).then();
      }
    }, 10000);
    return () => clearInterval(progressTimer);
  }, [userId, movieId, isWeb, player]);

  return (
    <View style={styles.videoContainer}>
      {isWeb ? (
        <WebHLSPlayer url={url} initialTime={initialTime} onTimeUpdate={() => {}} />
      ) : (
        <VideoView style={{ flex: 1 }} player={player!} nativeControls={true} fullscreenOptions={{ enable: true }} />
      )}
    </View>
  );
}

export default function TheaterScreen() {
  const params = useLocalSearchParams<{ id: string; localUri?: string; }>();
  const { id, localUri: paramLocalUri } = params;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);
  const [isInMyList, setIsInMyList] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  
  const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null);
  
  // ---> NEW: Season Dropdown State <---
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);

  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const isOfflineMode = Boolean(paramLocalUri);

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

        if (movieData.type === 'TV Series') {
          const { data: epData } = await supabase.from('episodes').select('*').eq('movie_id', id).eq('status', 'active').order('season_number').order('episode_number');
          setEpisodes(epData || []);
          // Automatically select the first available season
          if (epData && epData.length > 0) {
             setSelectedSeason(epData[0].season_number);
          }
        }

        const { data: simData } = await supabase.from('movies')
          .select('*')
          .eq('category', movieData.category)
          .eq('status', 'active')
          .neq('id', id)
          .limit(6);
          
        setSimilarMovies(simData || []);

        const downloaded = await isMovieDownloaded(id);
        setIsDownloaded(downloaded);

      } catch (err) { console.error(err); } finally { setLoading(false); }
    }
    fetchData();
  }, [id]);

  const toggleWatchlist = async () => {
    if (!userId || !movie) return;
    try {
      if (isInMyList) { await supabase.from('watchlist').delete().eq('user_id', userId).eq('movie_id', movie.id); setIsInMyList(false); } 
      else { await supabase.from('watchlist').insert({ user_id: userId, movie_id: movie.id }); setIsInMyList(true); }
    } catch (e) { console.error(e); }
  };

  const handleDownload = async () => {
    if (!movie || isDownloading || isDownloaded) return;
    const activeUrl = currentVideoUrl || movie.video_url;
    if (!activeUrl) return;
    let mp4Url = activeUrl.includes('stream.mux.com') ? (activeUrl.endsWith('.m3u8') ? activeUrl.replace('.m3u8', '/highest.mp4') : `${activeUrl}/highest.mp4`) : activeUrl;
    setIsDownloading(true);
    try {
      const downloadResumable = FileSystem.createDownloadResumable(mp4Url, `${FileSystem.documentDirectory}${movie.id}.mp4`, {}, (p) => {
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

  const handlePlayMain = () => {
    if (movie?.type === 'TV Series' && episodes.length > 0) {
      if (!activeEpisode) {
        setCurrentVideoUrl(episodes[0].video_url);
        setActiveEpisode(episodes[0]);
        setSelectedSeason(episodes[0].season_number); // Update season UI
      }
    } else {
      setCurrentVideoUrl(movie?.video_url || null);
    }
    setIsPlaying(true);
  };

  const handlePlayEpisode = (ep: Episode) => {
    setCurrentVideoUrl(ep.video_url);
    setActiveEpisode(ep);
    setIsPlaying(true);
  };

  const hasNextEpisode = activeEpisode ? episodes.findIndex(e => e.id === activeEpisode.id) < episodes.length - 1 : false;
  
  const handleNextEpisode = () => {
    if (!activeEpisode) return;
    const currentIndex = episodes.findIndex(e => e.id === activeEpisode.id);
    if (currentIndex !== -1 && currentIndex < episodes.length - 1) {
      const nextEp = episodes[currentIndex + 1];
      setCurrentVideoUrl(nextEp.video_url);
      setActiveEpisode(nextEp);
      setSelectedSeason(nextEp.season_number); // Automatically switch the season tab if needed
      setIsPlaying(true);
    }
  };

  // ---> NEW: Calculate unique seasons for the UI <---
  const availableSeasons = Array.from(new Set(episodes.map(e => e.season_number))).sort((a,b) => a-b);
  // ---> NEW: Filter episodes to only show the selected season <---
  const displayedEpisodes = episodes.filter(ep => ep.season_number === selectedSeason);

  const gridColumns = isDesktop ? 6 : (width > 550 ? 4 : 2);
  const gridGap = 10;
  const gridPadding = 40; 
  const safeCardWidth = (width - gridPadding - (gridGap * (gridColumns - 1))) / gridColumns;
  const finalCardWidth = Math.min(safeCardWidth, 160);

  if (loading) return <View style={styles.container}><ActivityIndicator size="large" color="#e50914" /></View>;
  if (!movie) return <View style={styles.container}><Text style={{color:'#fff'}}>Not found.</Text></View>;

  return (
    <View style={styles.container}>
      
      <View style={[styles.header, { top: Platform.OS === 'web' ? 20 : insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={24} color="#fff" /></Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 60 }}>
        {isPlaying && currentVideoUrl ? (
          <VideoPlayerBlock url={currentVideoUrl} movieId={movie.id} userId={userId} initialTime={0} onError={()=>{}} />
        ) : (
          <View style={styles.posterBox}>
            <Image source={{ uri: movie.backdrop_url || movie.poster_url }} style={styles.mainPoster} resizeMode="cover" />
            <Pressable style={styles.playOverlay} onPress={handlePlayMain}>
              <Ionicons name="play" size={60} color="#fff" />
            </Pressable>
          </View>
        )}

        <View style={styles.details}>
          <Text style={styles.title}>{movie.title}</Text>
          
          {activeEpisode && isPlaying && (
            <Text style={styles.activeEpisodeTitle}>
              Now Playing: S{activeEpisode.season_number} E{activeEpisode.episode_number} - {activeEpisode.title}
            </Text>
          )}

          <Text style={styles.meta}>{movie.category} • {movie.type}</Text>

          <View style={styles.buttonRow}>
            <Pressable style={styles.playBtn} onPress={handlePlayMain}>
              <Ionicons name="play" size={20} color="#000" />
              <Text style={styles.playBtnText}>{isPlaying ? 'Playing' : 'Play'}</Text>
            </Pressable>

            {hasNextEpisode && isPlaying && (
               <Pressable style={styles.nextBtn} onPress={handleNextEpisode}>
                 <Ionicons name="play-skip-forward" size={20} color="#fff" />
                 <Text style={styles.nextBtnText}>Next Ep</Text>
               </Pressable>
            )}

            <Pressable style={styles.actionBtn} onPress={toggleWatchlist}>
              <Ionicons name={isInMyList ? "checkmark" : "add"} size={24} color="#fff" />
              <Text style={styles.actionBtnText}>My List</Text>
            </Pressable>

            {!isDownloaded && !isOfflineMode && Platform.OS !== 'web' && (
              <Pressable style={styles.actionBtn} onPress={handleDownload} disabled={isDownloading}>
                <Ionicons name="download-outline" size={22} color={isDownloading ? "#555" : "#fff"} />
                <Text style={styles.actionBtnText}>{isDownloading ? `${downloadProgress}%` : 'Download'}</Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.description}>{movie.description}</Text>

          {movie.type === 'TV Series' && availableSeasons.length > 0 && (
            <View style={styles.section}>
              
              {/* ---> NEW: Season Pill Selector UI <--- */}
              <View style={styles.seasonSelectorContainer}>
                 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                   {availableSeasons.map(seasonNum => (
                      <Pressable 
                        key={`season-${seasonNum}`} 
                        style={[styles.seasonPill, selectedSeason === seasonNum && styles.activeSeasonPill]}
                        onPress={() => setSelectedSeason(seasonNum)}
                      >
                        <Text style={[styles.seasonPillText, selectedSeason === seasonNum && styles.activeSeasonPillText]}>
                           Season {seasonNum}
                        </Text>
                      </Pressable>
                   ))}
                 </ScrollView>
              </View>

              {/* Only maps through the episodes belonging to the Selected Season */}
              {displayedEpisodes.map(ep => {
                const isActive = activeEpisode?.id === ep.id;
                return (
                  <Pressable 
                    key={ep.id} 
                    style={[styles.epRow, isActive && styles.activeEpRow]} 
                    onPress={() => handlePlayEpisode(ep)}
                  >
                    <View style={styles.epInfo}>
                      <Text style={[styles.epMeta, isActive && { color: '#ff4b4b' }]}>
                        S{ep.season_number} E{ep.episode_number}
                      </Text>
                      <Text style={[styles.epTitle, isActive && { fontWeight: 'bold' }]}>
                        {ep.title}
                      </Text>
                    </View>
                    <Ionicons 
                      name={isActive ? "play-circle" : "play-circle-outline"} 
                      size={28} 
                      color={isActive ? "#e50914" : "#fff"} 
                    />
                  </Pressable>
                );
              })}
            </View>
          )}

          {similarMovies.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>More Like This</Text>
              <View style={[styles.grid, { gap: gridGap }]}>
                {similarMovies.map(m => (
                  <Pressable 
                    key={m.id} 
                    style={[styles.gridItem, { width: finalCardWidth }]} 
                    onPress={() => router.replace(`/movie/${m.id}`)}
                  >
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
  header: { position: 'absolute', left: 20, zIndex: 100 },
  backButton: { backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 24 },
  scroll: { flex: 1 },
  videoContainer: { width: '100%', maxWidth: 960, alignSelf: 'center', aspectRatio: 16/9, backgroundColor: '#000', marginTop: Platform.OS === 'web' ? 40 : 0, borderRadius: Platform.OS === 'web' ? 8 : 0, overflow: 'hidden' },
  posterBox: { width: '100%', maxWidth: 960, alignSelf: 'center', aspectRatio: 16/9, backgroundColor: '#111', marginTop: Platform.OS === 'web' ? 40 : 0, borderRadius: Platform.OS === 'web' ? 8 : 0, overflow: 'hidden' },
  mainPoster: { width: '100%', height: '100%' },
  playOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  details: { padding: 20, maxWidth: 960, alignSelf: 'center', width: '100%' },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  activeEpisodeTitle: { color: '#e50914', fontSize: 15, fontWeight: 'bold', marginTop: 6 },
  meta: { color: '#888', marginVertical: 8, fontWeight: '600' },
  buttonRow: { flexDirection: 'row', gap: 20, marginVertical: 15, alignItems: 'center' },
  playBtn: { backgroundColor: '#fff', paddingHorizontal: 30, height: 40, borderRadius: 4, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  playBtnText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  nextBtn: { backgroundColor: '#333', paddingHorizontal: 20, height: 40, borderRadius: 4, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  nextBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  actionBtn: { alignItems: 'center', minWidth: 60 },
  actionBtnText: { color: '#888', fontSize: 11, marginTop: 4 },
  description: { color: '#ccc', fontSize: 14, lineHeight: 22, marginTop: 10 },
  section: { marginTop: 40 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  
  // ---> NEW: Season UI Styles <---
  seasonSelectorContainer: { marginBottom: 20 },
  seasonPill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333' },
  activeSeasonPill: { backgroundColor: '#e50914', borderColor: '#e50914' },
  seasonPillText: { color: '#888', fontWeight: 'bold', fontSize: 14 },
  activeSeasonPillText: { color: '#fff' },

  epRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: 'transparent' },
  activeEpRow: { backgroundColor: '#1a0a0b', borderColor: '#e50914' },
  epInfo: { flex: 1 },
  epMeta: { color: '#e50914', fontWeight: 'bold', fontSize: 12 },
  epTitle: { color: '#fff', fontSize: 14, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { aspectRatio: 2/3, marginBottom: 10 },
  gridImage: { width: '100%', height: '100%', borderRadius: 4, backgroundColor: '#111' }
});