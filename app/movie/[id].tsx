// @ts-nocheck
import { addDownloadedMovie, isMovieDownloaded } from '@/lib/downloads';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Movie = { id: string; title: string; description: string | null; poster_url: string | null; backdrop_url?: string | null; video_url: string | null; category: string | null; type: string | null; };
type Episode = { id: string; season_number: number; episode_number: number; title: string; video_url: string | null; };

function WebHLSPlayer({ url, initialTime, onTimeUpdate, title, onBack }: { url: string; initialTime: number; onTimeUpdate: (time: number) => void; title: string; onBack: () => void; }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<any>(null);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [time, setTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1); // ---> NEW: Volume state <---
  
  const [ccEnabled, setCcEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const controlsTimeoutRef = useRef<any>(null);

  const resetControlsTimer = () => {
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3500);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;
    const isMP4 = url.toLowerCase().includes('.mp4') || url.includes('highest.mp4');
    
    if (isMP4) {
      video.src = url; video.currentTime = initialTime; video.play().catch(() => {});
    } else {
      import('hls.js').then((HlsModule) => {
        const Hls = HlsModule.default;
        if (Hls.isSupported()) {
          const hls = new Hls({ startPosition: initialTime });
          hlsRef.current = hls; 
          const hlsUrl = url.includes('.m3u8') ? url : `${url}.m3u8`;
          hls.loadSource(hlsUrl); hls.attachMedia(video); hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url; video.currentTime = initialTime; video.play().catch(() => {});
        }
      });
    }

    const handleFsChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, [url, initialTime]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) videoRef.current.play(); else videoRef.current.pause();
    }
  };

  // ---> UPDATED: Bulletproof Fullscreen logic with iOS Safari Fallback <---
  const toggleFullscreen = () => {
    const video = videoRef.current as any;
    const container = containerRef.current as any;
    
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (container?.requestFullscreen) {
        container.requestFullscreen();
      } else if (container?.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (video?.webkitEnterFullscreen) {
        // Ultimate fallback for iPhones
        video.webkitEnterFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  };

  const toggleMinimize = () => {
    if (document.pictureInPictureEnabled && videoRef.current) {
       if (document.pictureInPictureElement) document.exitPictureInPicture();
       else videoRef.current.requestPictureInPicture();
    }
  };

  const toggleCC = () => {
    if (hlsRef.current) {
      const current = hlsRef.current.subtitleTrack;
      hlsRef.current.subtitleTrack = current === -1 ? 0 : -1;
      setCcEnabled(hlsRef.current.subtitleTrack !== -1);
    } else if (videoRef.current && videoRef.current.textTracks.length > 0) {
      const track = videoRef.current.textTracks[0];
      track.mode = track.mode === 'showing' ? 'hidden' : 'showing';
      setCcEnabled(track.mode === 'showing');
    }
  };

  const handleVolumeChange = (e: any) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (videoRef.current) {
       videoRef.current.volume = val;
       if (val > 0 && isMuted) {
           videoRef.current.muted = false;
           setIsMuted(false);
       } else if (val === 0 && !isMuted) {
           videoRef.current.muted = true;
           setIsMuted(true);
       }
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div 
      ref={containerRef}
      style={{ width: '100%', height: '100%', backgroundColor: '#000', position: 'relative' }}
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
      onMouseLeave={() => setShowControls(false)}
    >
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        onTimeUpdate={() => { setTime(videoRef.current?.currentTime || 0); onTimeUpdate(videoRef.current?.currentTime || 0); }}
        onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={togglePlay}
      />

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', transition: 'opacity 0.3s', opacity: showControls ? 1 : 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        
        {/* Top Gradient Bar */}
        <div style={{ padding: '20px', display: 'flex', alignItems: 'center', pointerEvents: 'auto', background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)' }}>
           <span style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold', textShadow: '1px 1px 3px #000' }}>{title}</span>
        </div>

        {/* Bottom Custom Control Bar */}
        <div style={{ padding: '20px', pointerEvents: 'auto', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
           <input 
              type="range" min="0" max={duration || 0} value={time} 
              onChange={(e) => { if(videoRef.current) videoRef.current.currentTime = Number(e.target.value); }}
              style={{ width: '100%', cursor: 'pointer', accentColor: '#e50914', height: '4px', marginBottom: '15px' }} 
           />
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                 <Pressable onPress={togglePlay}><Ionicons name={isPlaying ? "pause" : "play"} size={28} color="#fff" /></Pressable>
                 
                 {/* ---> UPDATED: Volume icon WITH slider <--- */}
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <Pressable onPress={() => { if(videoRef.current) { videoRef.current.muted = !isMuted; setIsMuted(!isMuted); } }}>
                        <Ionicons name={isMuted || volume === 0 ? "volume-mute" : "volume-high"} size={24} color="#fff" />
                     </Pressable>
                     <input 
                        type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        style={{ width: '60px', accentColor: '#e50914', cursor: 'pointer' }}
                     />
                 </div>

                 <span style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>{formatTime(time)} / {formatTime(duration)}</span>
                 
                 {/* ---> UPDATED: Bulletproof CC Text Button <--- */}
                 <Pressable onPress={toggleCC} style={{ marginLeft: 5 }}>
                    <div style={{ border: `1.5px solid ${ccEnabled ? '#e50914' : '#fff'}`, borderRadius: '4px', padding: '1px 6px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                       <span style={{ color: ccEnabled ? '#e50914' : '#fff', fontSize: '12px', fontWeight: 'bold' }}>CC</span>
                    </div>
                 </Pressable>
              </div>

              {/* Exact Requested Layout: Minimize, Fullscreen, Back */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                 <Pressable onPress={toggleMinimize}><Ionicons name="browsers-outline" size={22} color="#fff" /></Pressable>
                 <Pressable onPress={toggleFullscreen}><Ionicons name={isFullscreen ? "contract" : "expand"} size={24} color="#fff" /></Pressable>
                 <Pressable onPress={onBack}><Ionicons name="close-circle-outline" size={28} color="#fff" /></Pressable>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function VideoPlayerBlock({ url, onError, initialTime, movieId, userId, title, onBack }: { url: string; onError: (msg: string) => void; initialTime: number; movieId: string; userId: string | null; title: string; onBack: () => void; }) {
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
        <WebHLSPlayer url={url} initialTime={initialTime} onTimeUpdate={() => {}} title={title} onBack={onBack} />
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
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);

  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
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
          if (epData && epData.length > 0) {
             setExpandedSeason(epData[0].season_number);
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

  const ensureAuthenticated = () => {
    if (!userId) {
      if (Platform.OS === 'web') {
        window.alert("Please log in or create an account to access this feature.");
        router.push('/');
      } else {
        Alert.alert("Login Required", "Please log in or create an account to access this feature.", [{ text: "Cancel", style: "cancel" }, { text: "Log In", onPress: () => router.push('/') }]);
      }
      return false;
    }
    return true;
  };

  const toggleWatchlist = async () => {
    if (!ensureAuthenticated()) return;
    if (!movie) return;
    try {
      if (isInMyList) { await supabase.from('watchlist').delete().eq('user_id', userId).eq('movie_id', movie.id); setIsInMyList(false); } 
      else { await supabase.from('watchlist').insert({ user_id: userId, movie_id: movie.id }); setIsInMyList(true); }
    } catch (e) { console.error(e); }
  };

  const handleDownloadItem = async (videoUrl: string | null, targetId: string, title: string, posterUrl: string | null) => {
    if (!ensureAuthenticated()) return;
    if (!videoUrl) return;
    if (downloadingId) { Alert.alert("Wait", "Another download is already in progress."); return; }
    
    let mp4Url = videoUrl.includes('stream.mux.com') ? (videoUrl.endsWith('.m3u8') ? videoUrl.replace('.m3u8', '/highest.mp4') : `${videoUrl}/highest.mp4`) : videoUrl;
    
    setDownloadingId(targetId);
    setDownloadProgress(0);

    try {
      const destFile = new File(Paths.document, `${targetId}.mp4`);
      await File.downloadFileAsync(mp4Url, destFile);
      
      if (destFile.exists) {
        await addDownloadedMovie({ id: targetId, title: title, poster_url: posterUrl, localUri: destFile.uri });
        if (targetId === movie?.id) setIsDownloaded(true);
        Alert.alert("Success", `Downloaded offline.`);
      } else {
        throw new Error("File failed to save to device.");
      }
    } catch (e: any) { 
      Alert.alert("Download Error", e.message || String(e)); 
    } finally { 
      setDownloadingId(null); setDownloadProgress(null); 
    }
  };

  const handlePlayMain = () => {
    if (!ensureAuthenticated()) return;
    if (movie?.type === 'TV Series' && episodes.length > 0) {
      if (!activeEpisode) {
        setCurrentVideoUrl(episodes[0].video_url); setActiveEpisode(episodes[0]); setExpandedSeason(episodes[0].season_number);
      }
    } else { setCurrentVideoUrl(movie?.video_url || null); }
    setIsPlaying(true);
  };

  const handlePlayEpisode = (ep: Episode) => {
    if (!ensureAuthenticated()) return;
    setCurrentVideoUrl(ep.video_url); setActiveEpisode(ep); setIsPlaying(true);
  };

  const hasNextEpisode = activeEpisode ? episodes.findIndex(e => e.id === activeEpisode.id) < episodes.length - 1 : false;
  
  const handleNextEpisode = () => {
    if (!ensureAuthenticated()) return;
    if (!activeEpisode) return;
    const currentIndex = episodes.findIndex(e => e.id === activeEpisode.id);
    if (currentIndex !== -1 && currentIndex < episodes.length - 1) {
      const nextEp = episodes[currentIndex + 1];
      setCurrentVideoUrl(nextEp.video_url); setActiveEpisode(nextEp); setExpandedSeason(nextEp.season_number); setIsPlaying(true);
    }
  };

  const availableSeasons = Array.from(new Set(episodes.map(e => e.season_number))).sort((a,b) => a-b);
  const gridColumns = isDesktop ? 6 : (width > 550 ? 4 : 2);
  const gridGap = 10;
  const safeCardWidth = (width - 40 - (gridGap * (gridColumns - 1))) / gridColumns;
  const finalCardWidth = Math.min(safeCardWidth, 160);

  if (loading) return <View style={styles.container}><ActivityIndicator size="large" color="#e50914" /></View>;
  if (!movie) return <View style={styles.container}><Text style={{color:'#fff'}}>Not found.</Text></View>;

  const displayTitle = activeEpisode ? `S${activeEpisode.season_number} E${activeEpisode.episode_number} - ${activeEpisode.title}` : movie.title;

  return (
    <View style={styles.container}>
      
      {/* Hide native back button when web custom player is active to avoid showing two back buttons */}
      {!(Platform.OS === 'web' && isPlaying) && (
        <View style={[styles.header, { top: Platform.OS === 'web' ? 20 : insets.top + 10 }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={24} color="#fff" /></Pressable>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 60 }}>
        {isPlaying && currentVideoUrl ? (
          <VideoPlayerBlock url={currentVideoUrl} movieId={movie.id} userId={userId} initialTime={0} onError={()=>{}} title={displayTitle} onBack={() => setIsPlaying(false)} />
        ) : (
          <View style={styles.posterBox}>
            <Image source={{ uri: movie.backdrop_url || movie.poster_url }} style={styles.mainPoster} resizeMode="cover" />
            <Pressable style={styles.playOverlay} onPress={handlePlayMain}>
              <Ionicons name="play" size={60} color="#fff" />
            </Pressable>
          </View>
        )}

        <View style={styles.details}>
          <Text style={styles.title} selectable={false}>{movie.title}</Text>
          
          {activeEpisode && isPlaying && (
            <Text style={styles.activeEpisodeTitle} selectable={false}>Now Playing: S{activeEpisode.season_number} E{activeEpisode.episode_number} - {activeEpisode.title}</Text>
          )}

          <Text style={styles.meta} selectable={false}>{movie.category} • {movie.type}</Text>

          <View style={styles.buttonRow}>
            <Pressable style={styles.playBtn} onPress={handlePlayMain}>
              <Ionicons name="play" size={18} color="#000" />
              <Text style={styles.playBtnText} selectable={false}>{isPlaying ? 'Playing' : 'Play'}</Text>
            </Pressable>

            {hasNextEpisode && isPlaying && (
               <Pressable style={styles.nextBtn} onPress={handleNextEpisode}>
                 <Ionicons name="play-skip-forward" size={18} color="#fff" />
                 <Text style={styles.nextBtnText} selectable={false}>Next</Text>
               </Pressable>
            )}

            <Pressable style={styles.actionBtn} onPress={toggleWatchlist}>
              <Ionicons name={isInMyList ? "checkmark" : "add"} size={22} color="#fff" />
              <Text style={styles.actionBtnText} selectable={false}>My List</Text>
            </Pressable>

            {!isDownloaded && !isOfflineMode && Platform.OS !== 'web' && (
              <Pressable style={styles.actionBtn} onPress={() => handleDownloadItem(activeEpisode ? activeEpisode.video_url : movie.video_url, activeEpisode ? activeEpisode.id : movie.id, activeEpisode ? activeEpisode.title : movie.title, movie.poster_url)}>
                {(downloadingId === movie.id || (activeEpisode && downloadingId === activeEpisode.id)) ? (
                  <ActivityIndicator size="small" color="#fff" style={{ marginBottom: 4 }} />
                ) : (
                  <Ionicons name="download-outline" size={22} color="#fff" />
                )}
                <Text style={styles.actionBtnText} selectable={false}>
                  {(downloadingId === movie.id || (activeEpisode && downloadingId === activeEpisode.id)) ? 'Downloading' : 'Download'}
                </Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.description} selectable={false}>{movie.description}</Text>

          {movie.type === 'TV Series' && availableSeasons.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle} selectable={false}>Episodes</Text>
              {availableSeasons.map(seasonNum => {
                const isExpanded = expandedSeason === seasonNum;
                const seasonEpisodes = episodes.filter(ep => ep.season_number === seasonNum);
                return (
                  <View key={`season-${seasonNum}`} style={styles.seasonAccordion}>
                    <Pressable style={styles.seasonHeader} onPress={() => setExpandedSeason(isExpanded ? null : seasonNum)}>
                      <Text style={styles.seasonHeaderText} selectable={false}>Season {seasonNum}</Text>
                      <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#fff" />
                    </Pressable>
                    {isExpanded && (
                      <View style={styles.seasonEpisodesList}>
                        {seasonEpisodes.map(ep => {
                          const isActive = activeEpisode?.id === ep.id;
                          const isDownloadingThisEp = downloadingId === ep.id;
                          return (
                            <View key={ep.id} style={[styles.epRow, isActive && styles.activeEpRow]}>
                              <Pressable style={styles.epInfoContainer} onPress={() => handlePlayEpisode(ep)}>
                                <View style={styles.epInfo}>
                                  <Text style={[styles.epTitle, isActive && { color: '#e50914', fontWeight: 'bold' }]} selectable={false}>{ep.episode_number}. {ep.title}</Text>
                                </View>
                                <Ionicons name={isActive ? "play-circle" : "play-circle-outline"} size={28} color={isActive ? "#e50914" : "#fff"} />
                              </Pressable>
                              {!isOfflineMode && Platform.OS !== 'web' && (
                                <Pressable style={styles.epDownloadBtn} onPress={() => handleDownloadItem(ep.video_url, ep.id, ep.title, movie.poster_url)}>
                                  {isDownloadingThisEp ? <ActivityIndicator size="small" color="#888" /> : <Ionicons name="download-outline" size={24} color="#fff" />}
                                </Pressable>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {similarMovies.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle} selectable={false}>More Like This</Text>
              <View style={[styles.grid, { gap: gridGap }]}>
                {similarMovies.map(m => (
                  <Pressable key={m.id} style={[styles.gridItem, { width: finalCardWidth }]} onPress={() => router.replace(`/movie/${m.id}`)}>
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
  videoContainer: { width: '100%', maxWidth: 1200, alignSelf: 'center', aspectRatio: 16/9, backgroundColor: '#000', marginTop: Platform.OS === 'web' ? 40 : 0, borderRadius: Platform.OS === 'web' ? 8 : 0, overflow: 'hidden' },
  posterBox: { width: '100%', maxWidth: 1200, alignSelf: 'center', aspectRatio: 16/9, backgroundColor: '#111', marginTop: Platform.OS === 'web' ? 40 : 0, borderRadius: Platform.OS === 'web' ? 8 : 0, overflow: 'hidden' },
  mainPoster: { width: '100%', height: '100%' },
  playOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  details: { padding: 20, maxWidth: 960, alignSelf: 'center', width: '100%' },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  activeEpisodeTitle: { color: '#e50914', fontSize: 15, fontWeight: 'bold', marginTop: 6 },
  meta: { color: '#888', marginVertical: 8, fontWeight: '600' },
  buttonRow: { flexDirection: 'row', gap: 12, marginVertical: 15, alignItems: 'center', flexWrap: 'wrap' },
  playBtn: { backgroundColor: '#fff', paddingHorizontal: 16, height: 36, borderRadius: 4, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  playBtnText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  nextBtn: { backgroundColor: '#333', paddingHorizontal: 16, height: 36, borderRadius: 4, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  nextBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  actionBtn: { alignItems: 'center', minWidth: 50 },
  actionBtnText: { color: '#888', fontSize: 11, marginTop: 4 },
  description: { color: '#ccc', fontSize: 14, lineHeight: 22, marginTop: 10 },
  section: { marginTop: 40 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  seasonAccordion: { marginBottom: 10, backgroundColor: '#111', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#222' },
  seasonHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#1a1a1a' },
  seasonHeaderText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  seasonEpisodesList: { padding: 10 },
  epRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, marginBottom: 5, borderWidth: 1, borderColor: 'transparent', backgroundColor: '#111' },
  activeEpRow: { backgroundColor: '#1a0a0b', borderColor: '#e50914' },
  epInfoContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10 },
  epInfo: { flex: 1 },
  epTitle: { color: '#fff', fontSize: 14 },
  epDownloadBtn: { paddingVertical: 12, paddingHorizontal: 15, justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: '#333' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { aspectRatio: 2/3, marginBottom: 10 },
  gridImage: { width: '100%', height: '100%', borderRadius: 4, backgroundColor: '#111' }
});