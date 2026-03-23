// @ts-nocheck
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type UploadTask = { 
  id: string; 
  title: string; 
  type: 'Movie' | 'Episode'; 
  progress: number; 
  status: 'uploading' | 'processing' | 'done' | 'error' | 'step-label'; 
  message?: string; 
  retryPayload?: any; 
};

export default function AdminScreen() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  
  const [userRole, setUserRole] = useState<'super_admin' | 'manager' | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<'dashboard' | 'upload' | 'manage' | 'trash' | 'team'>('dashboard');
  const [uploadMode, setUploadMode] = useState<'movie' | 'tvseries' | 'episode'>('movie');
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'Action' | 'Adventure' | 'Comedy' | 'Drama' | 'Sci-Fi' | null>(null);
  const [posterFile, setPosterFile] = useState<any | null>(null);
  const [backdropFile, setBackdropFile] = useState<any | null>(null);
  
  const [videoFile, setVideoFile] = useState<any | null>(null);
  const [subtitleFile, setSubtitleFile] = useState<any | null>(null);
  
  const [tvSeries, setTvSeries] = useState<{ id: string; title: string }[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [seasonNumber, setSeasonNumber] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('');
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [episodeVideoFile, setEpisodeVideoFile] = useState<any | null>(null);
  const [episodeSubtitleFile, setEpisodeSubtitleFile] = useState<any | null>(null);

  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [tvSeriesUploading, setTvSeriesUploading] = useState(false);
  
  const xhrRefs = useRef<{ [key: string]: XMLHttpRequest }>({});

  const [manageMovies, setManageMovies] = useState<any[]>([]);
  const [trashedEpisodes, setTrashedEpisodes] = useState<any[]>([]); 
  const [manageLoading, setManageLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [editingMovie, setEditingMovie] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  
  const [editPosterUrl, setEditPosterUrl] = useState('');
  const [editPosterFile, setEditPosterFile] = useState<any | null>(null);
  const [editBackdropUrl, setEditBackdropUrl] = useState('');
  const [editBackdropFile, setEditBackdropFile] = useState<any | null>(null);
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [editVideoFile, setEditVideoFile] = useState<any | null>(null);
  
  const [editEpisodes, setEditEpisodes] = useState<any[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const [selectedManageIds, setSelectedManageIds] = useState<string[]>([]);
  const [selectedTrashIds, setSelectedTrashIds] = useState<string[]>([]);

  const [statsLoading, setStatsLoading] = useState(false);
  
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [teamLoading, setTeamLoading] = useState(false);
  
  const [platformStats, setPlatformStats] = useState({
    totalViews: 0, totalMovies: 0, totalSeries: 0, topCategory: 'N/A', topTitle: 'No Views Yet',
    totalUsers: 0, dau: 0, wau: 0, mau: 0, leaderboard: [] as any[]
  });

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        
        if (profile && (profile.role === 'super_admin' || profile.role === 'manager')) {
          setIsAuthorized(true);
          setUserRole(profile.role);
          setActiveSection(profile.role === 'super_admin' ? 'dashboard' : 'upload');
        } else {
          if (Platform.OS === 'web') window.alert("Access Denied: Admin or Manager privileges required.");
          else Alert.alert("Access Denied", "Admin or Manager privileges required.");
          router.replace('/'); 
        }
      } else {
        router.replace('/');
      }
      setAuthChecking(false);
    };
    checkAdmin();
  }, [router]);

  const fetchDashboardStats = useCallback(async () => {
    if (userRole !== 'super_admin') return;
    setStatsLoading(true);
    try {
      const { count: movieCount } = await supabase.from('movies').select('*', { count: 'exact', head: true }).eq('type', 'Movie').eq('status', 'active');
      const { count: seriesCount } = await supabase.from('movies').select('*', { count: 'exact', head: true }).eq('type', 'TV Series').eq('status', 'active');
      const { data: viewData } = await supabase.from('movies').select('id, title, views, category, type').eq('status', 'active');
      
      let totalViews = 0; const categoryCounts: Record<string, number> = {};
      let topTitleName = 'No Views Yet'; let highestViewCount = -1; let sortedLeaderboard: any[] = [];

      if (viewData) {
        viewData.forEach(item => {
          const v = item.views || 0;
          totalViews += v;
          if (item.category) categoryCounts[item.category] = (categoryCounts[item.category] || 0) + v;
          if (v > highestViewCount && v > 0) { highestViewCount = v; topTitleName = `${item.title} (${v} views)`; }
        });
        sortedLeaderboard = [...viewData].sort((a, b) => (b.views || 0) - (a.views || 0));
      }

      let topCat = 'None Yet'; let maxCatViews = -1;
      for (const [cat, views] of Object.entries(categoryCounts)) { if (views > maxCatViews) { maxCatViews = views; topCat = cat; } }

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { count: totalUsersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { count: dauCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('last_active', oneDayAgo);
      const { count: wauCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('last_active', sevenDaysAgo);
      const { count: mauCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('last_active', thirtyDaysAgo);

      setPlatformStats({
        totalMovies: movieCount || 0, totalSeries: seriesCount || 0, totalViews,
        topCategory: maxCatViews > 0 ? `${topCat} (${maxCatViews})` : 'Not enough data',
        topTitle: topTitleName, totalUsers: totalUsersCount || 0,
        dau: dauCount || 0, wau: wauCount || 0, mau: mauCount || 0, leaderboard: sortedLeaderboard.slice(0, 10)
      });
    } catch (err) { console.error("Failed to load stats", err); } finally { setStatsLoading(false); }
  }, [userRole]);

  const fetchTeamMembers = useCallback(async () => {
    if (userRole !== 'super_admin') return;
    setTeamLoading(true);
    try {
      let query = supabase.from('profiles').select('id, role, email');
      const { data, error } = await query.order('role', { ascending: true });
      if (!error && data) setTeamMembers(data);
    } catch (e) { console.error(e); } finally { setTeamLoading(false); }
  }, [userRole]);

  const handleToggleRole = async (targetId: string, currentRole: string) => {
    if (userRole !== 'super_admin') return;
    const safeCurrentRole = currentRole || 'user';
    const newRole = safeCurrentRole === 'manager' ? 'user' : 'manager';
    const msg = `Change this user to ${newRole.toUpperCase()}?`;
    if (Platform.OS === 'web' ? window.confirm(msg) : true) {
      setUpdatingId(targetId);
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', targetId);
      if (error) {
        if (Platform.OS === 'web') window.alert("Failed to update: " + error.message);
        else Alert.alert("Error", "Failed to update: " + error.message);
      } else {
        if (Platform.OS === 'web') window.alert("Success! User role updated.");
        else Alert.alert("Success", "User role updated.");
      }
      fetchTeamMembers();
      setUpdatingId(null);
    }
  };

  const fetchAllMovies = useCallback(async () => { 
    setManageLoading(true); 
    
    const { data: mData, error: mError } = await supabase.from('movies').select('*, profiles(email)').order('title'); 
    if (mError) {
      console.error("Error fetching movies:", mError.message);
      if (Platform.OS === 'web') window.alert("Database Error: " + mError.message);
    }
    setManageMovies(mData ?? []); 
    
    const { data: eData, error: eError } = await supabase.from('episodes').select('*, movies(title), profiles(email)').eq('status', 'trash').order('season_number'); 
    if (eError) {
      console.error("Error fetching episodes:", eError.message);
    }
    setTrashedEpisodes(eData ?? []); 
    
    setManageLoading(false); 
  }, []);

  useEffect(() => { if (activeSection === 'dashboard') fetchDashboardStats(); }, [activeSection, fetchDashboardStats]);
  useEffect(() => { if (activeSection === 'team') fetchTeamMembers(); }, [activeSection, fetchTeamMembers]);
  useEffect(() => { if (activeSection === 'manage' || activeSection === 'trash') fetchAllMovies(); }, [activeSection, fetchAllMovies]);

  const updateTask = (id: string, updates: Partial<UploadTask>) => { setUploadTasks(prev => prev.map(task => task.id === id ? { ...task, ...updates } : task)); };
  const removeTask = (id: string) => { setUploadTasks(prev => prev.filter(task => task.id !== id)); };

  const handleCancelTask = (taskId: string) => {
    if (xhrRefs.current[taskId]) {
      xhrRefs.current[taskId].abort();
    } else {
      updateTask(taskId, { status: 'error', message: 'Upload Cancelled by User' });
    }
  };

  const pickPoster = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    if (!result.canceled) setPosterFile({ uri: result.assets[0].uri, name: result.assets[0].fileName ?? `poster.jpg`, mimeType: result.assets[0].mimeType ?? 'image/jpeg', file: (result.assets[0] as any).file });
  };
  const pickBackdrop = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    if (!result.canceled) setBackdropFile({ uri: result.assets[0].uri, name: result.assets[0].fileName ?? `backdrop.jpg`, mimeType: result.assets[0].mimeType ?? 'image/jpeg', file: (result.assets[0] as any).file });
  };
  const pickVideo = async (isEpisode: boolean = false) => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
    if (!result.canceled) {
      const fd = { uri: result.assets[0].uri, name: result.assets[0].name, mimeType: result.assets[0].mimeType ?? 'video/mp4', file: result.assets[0].file };
      if (isEpisode) setEpisodeVideoFile(fd); else setVideoFile(fd);
    }
  };
  const pickEditPoster = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    if (!result.canceled) setEditPosterFile({ uri: result.assets[0].uri, name: result.assets[0].fileName ?? `edit_poster.jpg`, mimeType: result.assets[0].mimeType ?? 'image/jpeg', file: (result.assets[0] as any).file });
  };
  const pickEditBackdrop = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    if (!result.canceled) setEditBackdropFile({ uri: result.assets[0].uri, name: result.assets[0].fileName ?? `edit_backdrop.jpg`, mimeType: result.assets[0].mimeType ?? 'image/jpeg', file: (result.assets[0] as any).file });
  };
  const pickEditVideo = async () => {
    const msg = "Upload New Video? This will replace the current video when saved.";
    if (Platform.OS === 'web' ? !window.confirm(msg) : false) return;
    const result = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
    if (!result.canceled) setEditVideoFile({ uri: result.assets[0].uri, name: result.assets[0].name, mimeType: result.assets[0].mimeType ?? 'video/mp4', file: result.assets[0].file });
  };
  const pickSubtitle = async (isEpisode: boolean = false) => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (!result.canceled) {
      const fd = { uri: result.assets[0].uri, name: result.assets[0].name, mimeType: 'text/vtt', file: result.assets[0].file };
      if (isEpisode) setEpisodeSubtitleFile(fd); else setSubtitleFile(fd);
    }
  };

  const uploadFile = async (fileObj: any, path: string, mimeType: string): Promise<string> => {
    let blob = fileObj.file;
    if (!blob) { const response = await fetch(fileObj.uri); blob = await response.blob(); }
    const { data, error } = await supabase.storage.from('movies').upload(path, blob, { contentType: mimeType, upsert: true }); 
    if (error) throw error;
    return supabase.storage.from('movies').getPublicUrl(data.path).data.publicUrl;
  };

  const uploadVideoToMux = async (fileObj: any, taskId: string, subtitleUrl?: string | null, passthrough?: string): Promise<void> => {
    let blob = fileObj.file;
    if (!blob) { const response = await fetch(fileObj.uri); blob = await response.blob(); }
    
    updateTask(taskId, { message: 'Connecting to secure backend...' });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Authentication token missing. Please log in again.');

    const backendRes = await fetch('/api/mux', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${session.access_token}` 
        }, 
        body: JSON.stringify({ subtitleUrl, passthrough }) 
    });

    if (!backendRes.ok) {
      let errorMsg = `Backend Error (${backendRes.status})`;
      try {
        const errData = await backendRes.json();
        if (errData.error) errorMsg = errData.error;
      } catch (e) {}
      throw new Error(errorMsg);
    }

    const muxUpload = await backendRes.json();
    if (!muxUpload.data?.url) throw new Error(`No Upload URL provided by Mux`);
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRefs.current[taskId] = xhr;
      
      xhr.open('PUT', muxUpload.data.url);
      xhr.upload.onprogress = (event) => { 
        if (event.lengthComputable) { 
          updateTask(taskId, { progress: Math.round((event.loaded / event.total) * 100), message: `Uploading Video: ${Math.round((event.loaded / event.total) * 100)}%` }); 
        } 
      };
      xhr.onload = () => { 
        delete xhrRefs.current[taskId];
        if (xhr.status >= 200 && xhr.status < 300) { 
          updateTask(taskId, { status: 'done', progress: 100, message: 'Upload Complete!' }); 
          resolve(); 
        } else { 
          reject(new Error(`Failed (${xhr.status})`)); 
        } 
      };
      xhr.onerror = () => { 
        delete xhrRefs.current[taskId];
        reject(new Error(`Network error`)); 
      };
      xhr.onabort = () => {
        delete xhrRefs.current[taskId];
        reject(new Error(`Upload Cancelled by User`));
      };

      xhr.send(blob);
    });
  };

  const queueMovieUpload = () => {
    if (!title || !category || !posterFile || !videoFile) { Alert.alert('Error', 'Fill all required fields!'); return; }
    const taskId = Date.now().toString();
    const p = { cT: title, cD: description, cC: category, cP: posterFile, cB: backdropFile, cV: videoFile, cS: subtitleFile };
    setUploadTasks(prev => [{ id: taskId, title: title, type: 'Movie', progress: 0, status: 'uploading', message: 'Starting...', retryPayload: p }, ...prev]);
    setTitle(''); setDescription(''); setCategory(null); setPosterFile(null); setBackdropFile(null); setVideoFile(null); setSubtitleFile(null);
    runMovieBackground(taskId, p.cT, p.cD, p.cC, p.cP, p.cB, p.cV, p.cS);
  };

  const runMovieBackground = async (taskId: string, title: string, desc: string, cat: string, poster: any, backdrop: any, video: any, subtitle: any) => {
    try {
      const timestamp = Date.now(); const safeSlug = title.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 40);
      updateTask(taskId, { message: 'Uploading Images...' });
      let subUrl = subtitle ? await uploadFile(subtitle, `subtitles/${timestamp}-${safeSlug}.vtt`, 'text/vtt') : null;
      const posterUrl = await uploadFile(poster, `posters/${timestamp}-${safeSlug}.jpg`, 'image/jpeg');
      let backdropUrl = backdrop ? await uploadFile(backdrop, `backdrops/${timestamp}-${safeSlug}.jpg`, 'image/jpeg') : null;

      updateTask(taskId, { message: 'Creating Database Entry...' });
      const { data, error } = await supabase.from('movies').insert({ 
            title, description: desc || null, poster_url: posterUrl, backdrop_url: backdropUrl, type: 'Movie', category: cat, status: 'processing', uploaded_by: userId 
        }).select('id').single();
        
      if (error) throw new Error(`Database Error: ${error.message}`);
      await uploadVideoToMux(video, taskId, subUrl, `movies:${data.id}`);
    } catch (e: any) { updateTask(taskId, { status: 'error', message: e.message || 'Unknown Error' }); }
  };

  const queueEpisodeUpload = () => {
    if (!selectedSeriesId || !seasonNumber || !episodeNumber || !episodeTitle || !episodeVideoFile) return;
    const taskId = Date.now().toString();
    const p = { cSId: selectedSeriesId, cS: parseInt(seasonNumber), cE: parseInt(episodeNumber), cT: episodeTitle, cV: episodeVideoFile, cSub: episodeSubtitleFile };
    setUploadTasks(prev => [{ id: taskId, title: `S${seasonNumber}E${episodeNumber}: ${episodeTitle}`, type: 'Episode', progress: 0, status: 'uploading', message: 'Starting...', retryPayload: p }, ...prev]);
    setEpisodeTitle(''); setEpisodeNumber(''); setEpisodeVideoFile(null); setEpisodeSubtitleFile(null);
    runEpisodeBackground(taskId, p.cSId, p.cS, p.cE, p.cT, p.cV, p.cSub);
  };

  const runEpisodeBackground = async (taskId: string, seriesId: string, seasonNum: number, episodeNum: number, epTitle: string, video: any, subtitle: any) => {
    try {
      const timestamp = Date.now(); const safeSlug = epTitle.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 40);
      updateTask(taskId, { message: 'Uploading Subtitles...' });
      let subUrl = subtitle ? await uploadFile(subtitle, `subtitles/${timestamp}-${safeSlug}.vtt`, 'text/vtt') : null;

      updateTask(taskId, { message: 'Registering Episode...' });
      const { data, error } = await supabase.from('episodes').insert({ movie_id: seriesId, season_number: seasonNum, episode_number: episodeNum, title: epTitle, status: 'processing', uploaded_by: userId }).select('id').single();
      if (error) throw new Error(`Database Error: ${error.message}`);
      await uploadVideoToMux(video, taskId, subUrl, `episodes:${data.id}`);
    } catch (e: any) { updateTask(taskId, { status: 'error', message: e.message || 'Unknown Error' }); }
  };

  const handleRetryTask = (task: UploadTask) => {
    updateTask(task.id, { status: 'uploading', progress: 0, message: 'Retrying...' });
    if (task.type === 'Movie') runMovieBackground(task.id, task.retryPayload.cT, task.retryPayload.cD, task.retryPayload.cC, task.retryPayload.cP, task.retryPayload.cB, task.retryPayload.cV, task.retryPayload.cS);
    else if (task.type === 'Episode') runEpisodeBackground(task.id, task.retryPayload.cSId, task.retryPayload.cS, task.retryPayload.cE, task.retryPayload.cT, task.retryPayload.cV, task.retryPayload.cSub);
  };

  const handleCreateTVSeries = async () => {
    if (!title || !category || !posterFile) return;
    setTvSeriesUploading(true);
    try {
      const timestamp = Date.now(); const safeSlug = title.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 40);
      const posterUrl = await uploadFile(posterFile, `posters/${timestamp}-${safeSlug}.jpg`, 'image/jpeg');
      let backdropUrl = backdropFile ? await uploadFile(backdropFile, `backdrops/${timestamp}-${safeSlug}.jpg`, 'image/jpeg') : null;
      const { error } = await supabase.from('movies').insert({ title, description: description || null, poster_url: posterUrl, backdrop_url: backdropUrl, type: 'TV Series', category, status: 'active', uploaded_by: userId });
      if (error) throw error;
      setTitle(''); setDescription(''); setCategory(null); setPosterFile(null); setBackdropFile(null); fetchTvSeries();
      Alert.alert("Success", "Series created!");
    } catch(e: any) { Alert.alert("Error", e.message); } finally { setTvSeriesUploading(false); }
  };

  const fetchTvSeries = useCallback(async () => { setLoadingSeries(true); const { data } = await supabase.from('movies').select('id, title').eq('type', 'TV Series').eq('status', 'active').order('title'); setTvSeries(data ?? []); setLoadingSeries(false); }, []);

  const startEditing = async (movie: any) => {
    setEditingMovie(movie); setEditTitle(movie.title); setEditDescription(movie.description || ''); setEditCategory(movie.category || ''); setEditPosterUrl(movie.poster_url || ''); setEditBackdropUrl(movie.backdrop_url || ''); setEditVideoUrl(movie.video_url || '');
    setEditPosterFile(null); setEditBackdropFile(null); setEditVideoFile(null);
    if (movie.type === 'TV Series') { setLoadingEpisodes(true); const { data } = await supabase.from('episodes').select('*').eq('movie_id', movie.id).neq('status', 'trash').order('season_number').order('episode_number'); setEditEpisodes(data || []); setLoadingEpisodes(false); }
  };

  const handleMasterUpdate = async () => {
    if (!editingMovie) return;
    setEditSaving(true);
    try {
      let finalPosterUrl = editPosterUrl; let finalBackdropUrl = editBackdropUrl;
      const timestamp = Date.now(); const safeSlug = editTitle.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 40);
      if (editPosterFile) finalPosterUrl = await uploadFile(editPosterFile, `posters/${timestamp}-${safeSlug}.jpg`, 'image/jpeg');
      if (editBackdropFile) finalBackdropUrl = await uploadFile(editBackdropFile, `backdrops/${timestamp}-${safeSlug}.jpg`, 'image/jpeg');

      const { error: movieError } = await supabase.from('movies').update({ title: editTitle, description: editDescription, category: editCategory, poster_url: finalPosterUrl, backdrop_url: finalBackdropUrl }).eq('id', editingMovie.id);
      if (movieError) throw movieError;

      if (editVideoFile && editingMovie.type === 'Movie') {
        const taskId = `edit-${Date.now().toString()}`;
        setUploadTasks(prev => [{ id: taskId, title: `Update Video: ${editTitle}`, type: 'Movie', progress: 0, status: 'uploading', message: 'Starting video replacement...' }, ...prev]);
        uploadVideoToMux(editVideoFile, taskId, null, `movies:${editingMovie.id}`).catch(e => updateTask(taskId, { status: 'error', message: e.message }));
      }

      if (editingMovie.type === 'TV Series' && editEpisodes.length > 0) {
        const episodeUpdates = editEpisodes.map(ep => supabase.from('episodes').update({ title: ep.title, season_number: parseInt(ep.season_number), episode_number: parseInt(ep.episode_number) }).eq('id', ep.id));
        const results = await Promise.all(episodeUpdates);
        if (results.find(r => r.error)) throw results.find(r => r.error)?.error;
      }
      Alert.alert("Success", "Content updated!"); setEditingMovie(null); fetchAllMovies();
    } catch (error: any) { Alert.alert("Error", error.message); } finally { setEditSaving(false); }
  };

  const updateLocalEpisode = (id: string, field: string, value: string) => { setEditEpisodes(prev => prev.map(ep => ep.id === id ? { ...ep, [field]: value } : ep)); };
  
  const handleDeleteEpisode = async (epId: string) => {
    if (Platform.OS === 'web' ? window.confirm("Move to trash?") : true) { await supabase.from('episodes').update({ status: 'trash', deleted_at: new Date().toISOString() }).eq('id', epId); setEditEpisodes(prev => prev.filter(e => e.id !== epId)); fetchAllMovies(); }
  };

  const toggleManageSelection = (id: string) => { setSelectedManageIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]); };
  const toggleTrashSelection = (id: string) => { setSelectedTrashIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]); };

  const handleBulkTrash = async () => { await supabase.from('movies').update({ status: 'trash', deleted_at: new Date().toISOString() }).in('id', selectedManageIds); setSelectedManageIds([]); fetchAllMovies(); };
  const handleBulkRestore = async () => { await supabase.from('movies').update({ status: 'active', deleted_at: null }).in('id', selectedTrashIds); setSelectedTrashIds([]); fetchAllMovies(); };
  const handleBulkDeleteForever = async () => { if (Platform.OS === 'web' ? window.confirm("Delete forever?") : true) { await supabase.from('movies').delete().in('id', selectedTrashIds); setSelectedTrashIds([]); fetchAllMovies(); } };

  const handleTrashMovie = async (id: string) => { setUpdatingId(id); await supabase.from('movies').update({ status: 'trash', deleted_at: new Date().toISOString() }).eq('id', id); fetchAllMovies(); setUpdatingId(null); };
  const handleRestoreMovie = async (id: string) => { setUpdatingId(id); await supabase.from('movies').update({ status: 'active', deleted_at: null }).eq('id', id); fetchAllMovies(); setUpdatingId(null); };
  const handleDeleteForeverMovie = async (id: string) => { if (Platform.OS === 'web' ? window.confirm("Delete forever?") : true) { setDeletingId(id); await supabase.from('movies').delete().eq('id', id); fetchAllMovies(); setDeletingId(null); } };
  const handleRestoreEpisode = async (id: string) => { setUpdatingId(id); await supabase.from('episodes').update({ status: 'active', deleted_at: null }).eq('id', id); fetchAllMovies(); setUpdatingId(null); };
  const handleDeleteForeverEpisode = async (id: string) => { if (Platform.OS === 'web' ? window.confirm("Delete forever?") : true) { setDeletingId(id); await supabase.from('episodes').delete().eq('id', id); fetchAllMovies(); setDeletingId(null); } };

  const activeMovies = manageMovies.filter((m) => m.status !== 'trash');
  const trashedMovies = manageMovies.filter((m) => m.status === 'trash');

  if (authChecking) return (<View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#e50914" /></View>);
  if (!isAuthorized) return null;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        <View style={styles.tabRow}>
          {userRole === 'super_admin' && (
            <Pressable style={[styles.tabButton, activeSection === 'dashboard' && styles.tabButtonActive]} onPress={() => { setActiveSection('dashboard'); setEditingMovie(null); }}><Text style={[styles.tabButtonLabel, activeSection === 'dashboard' && styles.tabButtonLabelActive]}>Dashboard</Text></Pressable>
          )}
          <Pressable style={[styles.tabButton, activeSection === 'upload' && styles.tabButtonActive]} onPress={() => { setActiveSection('upload'); setEditingMovie(null); }}><Text style={[styles.tabButtonLabel, activeSection === 'upload' && styles.tabButtonLabelActive]}>Upload</Text></Pressable>
          <Pressable style={[styles.tabButton, activeSection === 'manage' && styles.tabButtonActive]} onPress={() => setActiveSection('manage')}><Text style={[styles.tabButtonLabel, activeSection === 'manage' && styles.tabButtonLabelActive]}>Manage</Text></Pressable>
          
          {userRole === 'super_admin' && (
            <>
              <Pressable style={[styles.tabButton, activeSection === 'trash' && styles.tabButtonActive]} onPress={() => { setActiveSection('trash'); setEditingMovie(null); }}><Text style={[styles.tabButtonLabel, activeSection === 'trash' && styles.tabButtonLabelActive]}>Trash</Text></Pressable>
              <Pressable style={[styles.tabButton, activeSection === 'team' && styles.tabButtonActive]} onPress={() => { setActiveSection('team'); setEditingMovie(null); }}><Text style={[styles.tabButtonLabel, activeSection === 'team' && styles.tabButtonLabelActive]}>Team</Text></Pressable>
            </>
          )}
        </View>

        {activeSection === 'dashboard' && userRole === 'super_admin' && (
           <View style={styles.dashboardContainer}>
             <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
               <Text style={styles.dashboardTitle}>Platform Analytics</Text>
               <Pressable onPress={fetchDashboardStats}>
                 {statsLoading ? <ActivityIndicator color="#e50914" /> : <Ionicons name="refresh" size={24} color="#888" />}
               </Pressable>
             </View>
             {/* Audience Stats */}
             <Text style={{color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15}}>Audience</Text>
             <View style={styles.statsGrid}>
               <View style={[styles.statCard, { width: '23%', borderColor: '#6b7280' }]}><Ionicons name="people" size={24} color="#6b7280" style={styles.statIcon} /><Text style={styles.statValue}>{platformStats.totalUsers.toLocaleString()}</Text><Text style={styles.statLabel}>Total Users</Text></View>
               <View style={[styles.statCard, { width: '23%', borderColor: '#10b981' }]}><Text style={styles.statValue}>{platformStats.dau.toLocaleString()}</Text><Text style={styles.statLabel}>Daily (DAU)</Text></View>
               <View style={[styles.statCard, { width: '23%', borderColor: '#3b82f6' }]}><Text style={styles.statValue}>{platformStats.wau.toLocaleString()}</Text><Text style={styles.statLabel}>Weekly (WAU)</Text></View>
               <View style={[styles.statCard, { width: '23%', borderColor: '#8b5cf6' }]}><Text style={styles.statValue}>{platformStats.mau.toLocaleString()}</Text><Text style={styles.statLabel}>Monthly (MAU)</Text></View>
             </View>
             {/* Content Stats */}
             <Text style={{color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 15}}>Content</Text>
             <View style={styles.statsGrid}>
               <View style={[styles.statCard, { width: '23%' }]}><Ionicons name="eye" size={24} color="#e50914" style={styles.statIcon} /><Text style={styles.statValue}>{platformStats.totalViews.toLocaleString()}</Text><Text style={styles.statLabel}>Total Views</Text></View>
               <View style={[styles.statCard, { width: '23%' }]}><Ionicons name="film" size={24} color="#e50914" style={styles.statIcon} /><Text style={styles.statValue}>{platformStats.totalMovies}</Text><Text style={styles.statLabel}>Movies</Text></View>
               <View style={[styles.statCard, { width: '23%' }]}><Ionicons name="tv" size={24} color="#e50914" style={styles.statIcon} /><Text style={styles.statValue}>{platformStats.totalSeries}</Text><Text style={styles.statLabel}>TV Series</Text></View>
               <View style={[styles.statCard, { width: '23%' }]}><Ionicons name="trophy" size={24} color="#f59e0b" style={styles.statIcon} /><Text style={[styles.statValue, {fontSize: 16}]} numberOfLines={1}>{platformStats.topCategory}</Text><Text style={styles.statLabel}>Top Category</Text></View>
               <View style={[styles.statCard, { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, marginTop: 5, borderColor: '#eab308' }]}>
                  <View style={{ flex: 1, paddingRight: 10 }}><Text style={[styles.statValue, {fontSize: 22, color: '#eab308'}]} numberOfLines={1}>{platformStats.topTitle}</Text><Text style={styles.statLabel}>Most Watched Title</Text></View>
                  <Ionicons name="star" size={36} color="#eab308" />
               </View>
             </View>
             {/* Leaderboard */}
             <View style={styles.leaderboardSection}>
               <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15}}><Ionicons name="list" size={22} color="#fff" /><Text style={styles.leaderboardSectionTitle}>Content Leaderboard</Text></View>
               {platformStats.leaderboard.length === 0 ? <Text style={{color: '#666'}}>No content available.</Text> : platformStats.leaderboard.map((item, index) => (
                  <View key={item.id} style={styles.leaderboardRow}>
                    <Text style={styles.rankText}>#{index + 1}</Text>
                    <View style={{flex: 1}}><Text style={styles.leaderboardTitle}>{item.title}</Text><Text style={styles.leaderboardCategory}>{item.category || 'Other'} • {item.type || 'Movie'}</Text></View>
                    <View style={{alignItems: 'flex-end'}}><Text style={styles.leaderboardViews}>{item.views || 0}</Text><Text style={{color: '#666', fontSize: 10}}>views</Text></View>
                  </View>
               ))}
             </View>
           </View>
        )}

        {/* --- UPLOAD SECTION --- */}
        {activeSection === 'upload' && (
          <>
            <View style={styles.subTabRow}>
              <Pressable style={[styles.subTabButton, uploadMode === 'movie' && styles.tabButtonActive]} onPress={() => setUploadMode('movie')}><Text style={[styles.subTabButtonLabel, uploadMode === 'movie' && styles.subTabButtonLabelActive]}>Movie</Text></Pressable>
              <Pressable style={[styles.subTabButton, uploadMode === 'tvseries' && styles.tabButtonActive]} onPress={() => setUploadMode('tvseries')}><Text style={[styles.subTabButtonLabel, uploadMode === 'tvseries' && styles.subTabButtonLabelActive]}>TV Series</Text></Pressable>
              <Pressable style={[styles.subTabButton, uploadMode === 'episode' && styles.tabButtonActive]} onPress={() => setUploadMode('episode')}><Text style={[styles.subTabButtonLabel, uploadMode === 'episode' && styles.subTabButtonLabelActive]}>Episode</Text></Pressable>
            </View>

            {uploadMode === 'movie' && (
              <>
                <Text style={styles.label}>Title *</Text>
                <TextInput style={styles.input} placeholderTextColor="#666" value={title} onChangeText={setTitle} />
                <Text style={styles.label}>Description</Text>
                <TextInput style={[styles.input, styles.descriptionInput]} placeholderTextColor="#666" multiline value={description} onChangeText={setDescription} />
                <Text style={styles.label}>Category *</Text>
                <View style={styles.optionRow}>{['Action', 'Adventure', 'Comedy', 'Drama', 'Sci-Fi'].map(opt => (<Pressable key={opt} style={[styles.optionChip, category === opt && styles.optionChipSelected]} onPress={() => setCategory(opt as any)}><Text style={styles.optionChipText}>{opt}</Text></Pressable>))}</View>
                
                <View style={styles.fileRow}>
                  <Pressable style={styles.selectButtonSmall} onPress={pickPoster}><Ionicons name="image" size={20} color="#fff" /><Text style={styles.selectButtonText} numberOfLines={1}>{posterFile ? posterFile.name : 'Poster (Vertical) *'}</Text></Pressable>
                  <Pressable style={styles.selectButtonSmall} onPress={pickBackdrop}><Ionicons name="image-outline" size={20} color="#fff" /><Text style={styles.selectButtonText} numberOfLines={1}>{backdropFile ? backdropFile.name : 'Backdrop (Horizontal)'}</Text></Pressable>
                </View>

                <Pressable style={[styles.selectButton, { borderColor: videoFile ? '#22c55e' : '#2a2a2a' }]} onPress={() => pickVideo(false)}><Ionicons name="videocam" size={20} color={videoFile ? '#22c55e' : '#fff'} /><Text style={styles.selectButtonText}>{videoFile ? videoFile.name : 'Video File *'}</Text></Pressable>
                <Pressable style={[styles.selectButton, { borderColor: subtitleFile ? '#22c55e' : '#2a2a2a', marginBottom: 15 }]} onPress={() => pickSubtitle(false)}><Ionicons name="text" size={20} color={subtitleFile ? '#22c55e' : '#fff'} /><Text style={styles.selectButtonText}>{subtitleFile ? subtitleFile.name : 'Optional: Attach Subtitles (.vtt / .srt)'}</Text></Pressable>
                <Pressable style={styles.uploadButton} onPress={queueMovieUpload}><Ionicons name="cloud-upload" size={20} color="#fff" /><Text style={styles.uploadButtonText}>Queue Upload</Text></Pressable>
              </>
            )}

            {uploadMode === 'tvseries' && (
              <>
                <Text style={styles.label}>Series Title *</Text>
                <TextInput style={styles.input} placeholderTextColor="#666" value={title} onChangeText={setTitle} />
                <Text style={styles.label}>Description</Text>
                <TextInput style={[styles.input, styles.descriptionInput]} placeholderTextColor="#666" multiline value={description} onChangeText={setDescription} />
                <Text style={styles.label}>Category *</Text>
                <View style={styles.optionRow}>{['Action', 'Adventure', 'Comedy', 'Drama', 'Sci-Fi'].map(opt => (<Pressable key={opt} style={[styles.optionChip, category === opt && styles.optionChipSelected]} onPress={() => setCategory(opt as any)}><Text style={styles.optionChipText}>{opt}</Text></Pressable>))}</View>
                
                <View style={styles.fileRow}>
                  <Pressable style={styles.selectButtonSmall} onPress={pickPoster}><Ionicons name="image" size={20} color="#fff" /><Text style={styles.selectButtonText} numberOfLines={1}>{posterFile ? posterFile.name : 'Poster (Vertical) *'}</Text></Pressable>
                  <Pressable style={styles.selectButtonSmall} onPress={pickBackdrop}><Ionicons name="image-outline" size={20} color="#fff" /><Text style={styles.selectButtonText} numberOfLines={1}>{backdropFile ? backdropFile.name : 'Backdrop (Horizontal)'}</Text></Pressable>
                </View>

                <Pressable style={styles.uploadButton} onPress={handleCreateTVSeries}>
                  {tvSeriesUploading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="folder-open" size={20} color="#fff" /><Text style={styles.uploadButtonText}>Create TV Series</Text></>}
                </Pressable>
              </>
            )}

            {uploadMode === 'episode' && (
              <>
                <Text style={styles.label}>Select TV Series *</Text>
                {loadingSeries ? <ActivityIndicator color="#e50914" /> : (
                  <ScrollView style={styles.episodeSeriesList} nestedScrollEnabled>
                    {tvSeries.map(s => (<Pressable key={s.id} style={[styles.seriesItem, selectedSeriesId === s.id && styles.seriesItemSelected]} onPress={() => setSelectedSeriesId(s.id)}><Text style={styles.seriesItemText}>{s.title}</Text></Pressable>))}
                  </ScrollView>
                )}
                <View style={{flexDirection: 'row', gap: 10}}>
                  <View style={{flex: 1}}><Text style={styles.label}>Season *</Text><TextInput style={styles.input} keyboardType="numeric" value={seasonNumber} onChangeText={setSeasonNumber} /></View>
                  <View style={{flex: 1}}><Text style={styles.label}>Episode *</Text><TextInput style={styles.input} keyboardType="numeric" value={episodeNumber} onChangeText={setEpisodeNumber} /></View>
                </View>
                <Text style={styles.label}>Episode Title *</Text>
                <TextInput style={styles.input} value={episodeTitle} onChangeText={setEpisodeTitle} />
                <Pressable style={[styles.selectButton, { borderColor: episodeVideoFile ? '#22c55e' : '#2a2a2a' }]} onPress={() => pickVideo(true)}><Ionicons name="videocam" size={20} color={episodeVideoFile ? '#22c55e' : '#fff'} /><Text style={styles.selectButtonText} numberOfLines={1}>{episodeVideoFile ? episodeVideoFile.name : 'Video *'}</Text></Pressable>
                <Pressable style={[styles.selectButton, { borderColor: episodeSubtitleFile ? '#22c55e' : '#2a2a2a', marginBottom: 15 }]} onPress={() => pickSubtitle(true)}><Ionicons name="text" size={20} color={episodeSubtitleFile ? '#22c55e' : '#fff'} /><Text style={styles.selectButtonText}>{episodeSubtitleFile ? episodeSubtitleFile.name : 'Optional: Attach Subtitles (.vtt / .srt)'}</Text></Pressable>
                <Pressable style={styles.uploadButton} onPress={queueEpisodeUpload}><Ionicons name="cloud-upload" size={20} color="#fff" /><Text style={styles.uploadButtonText}>Queue Upload</Text></Pressable>
              </>
            )}

            {uploadTasks.length > 0 && (
              <View style={styles.queueSection}>
                <Text style={styles.queueHeader}>Active Tasks</Text>
                {uploadTasks.map(task => (
                  <View key={task.id} style={styles.taskCard}>
                    <View style={styles.taskHeader}>
                      <Text style={styles.taskTitle}>{task.title}</Text>
                      <View style={{flexDirection: 'row', gap: 15, alignItems: 'center'}}>
                        {task.status === 'uploading' && (
                           <Pressable onPress={() => handleCancelTask(task.id)} style={{flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#333', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6}}>
                             <Ionicons name="close-circle" size={16} color="#ef4444" />
                             <Text style={{color: '#ef4444', fontSize: 12, fontWeight: 'bold'}}>Cancel</Text>
                           </Pressable>
                        )}
                        {task.status === 'error' && <Pressable onPress={() => handleRetryTask(task)} style={{flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#333', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6}}><Ionicons name="refresh" size={16} color="#3b82f6" /><Text style={{color: '#3b82f6', fontSize: 12, fontWeight: 'bold'}}>Retry</Text></Pressable>}
                        {(task.status === 'done' || task.status === 'error') && <Pressable onPress={() => removeTask(task.id)}><Ionicons name="close" size={20} color="#888" /></Pressable>}
                      </View>
                    </View>
                    {task.status==='uploading' && <View style={styles.taskProgressRow}><View style={styles.taskProgressBarBg}><View style={[styles.taskProgressBarFill, {width:`${task.progress}%`}]}/></View><Text style={styles.taskProgressText}>{task.progress}%</Text></View>}
                    <Text style={[styles.taskMessage, task.status === 'error' ? styles.taskErrorText : task.status === 'done' ? styles.taskSuccessText : null]}>{task.message}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* --- MANAGE SECTION --- */}
        {activeSection === 'manage' && (
          <View>
            {/* ---> UPDATED: Hidden Bulk Action Bar from Managers <--- */}
            {selectedManageIds.length > 0 && !editingMovie && userRole === 'super_admin' && (
              <View style={styles.bulkActionBar}>
                <Text style={styles.bulkActionText}>{selectedManageIds.length} Selected</Text>
                <Pressable style={styles.bulkActionButton} onPress={handleBulkTrash}><Text style={styles.bulkActionButtonText}>Trash Selected</Text></Pressable>
              </View>
            )}

            {manageLoading ? <ActivityIndicator color="#e50914" /> : (
              <>
                {editingMovie ? (
                  <View style={styles.editSection}>
                    <Text style={styles.label}>Edit {editingMovie.type}</Text>
                    <TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle} placeholder="Title" />
                    <TextInput style={[styles.input, styles.descriptionInput]} multiline value={editDescription} onChangeText={setEditDescription} placeholder="Description" />
                    
                    <Text style={styles.label}>Poster (Vertical)</Text>
                    <View style={styles.editImageContainer}>
                       {(editPosterFile || editPosterUrl) && <Image source={{ uri: editPosterFile ? editPosterFile.uri : editPosterUrl }} style={styles.editPosterPreview} resizeMode="cover" />}
                       <Pressable style={styles.editUploadBtn} onPress={pickEditPoster}><Ionicons name="camera-outline" size={20} color="#fff" /><Text style={styles.editUploadBtnText}>Replace Poster</Text></Pressable>
                    </View>

                    <Text style={styles.label}>Backdrop (Horizontal 16:9)</Text>
                    <View style={styles.editImageContainer}>
                       {(editBackdropFile || editBackdropUrl) && <Image source={{ uri: editBackdropFile ? editBackdropFile.uri : editBackdropUrl }} style={styles.editBackdropPreview} resizeMode="cover" />}
                       <Pressable style={styles.editUploadBtn} onPress={pickEditBackdrop}><Ionicons name="image-outline" size={20} color="#fff" /><Text style={styles.editUploadBtnText}>Replace Backdrop</Text></Pressable>
                    </View>

                    {editingMovie.type === 'Movie' && (
                      <View style={{ marginTop: 10, marginBottom: 20 }}>
                         <Text style={styles.label}>Video Content</Text>
                         <Pressable style={[styles.selectButton, { borderColor: editVideoFile ? '#22c55e' : '#333', backgroundColor: '#181818' }]} onPress={pickEditVideo}>
                            <Ionicons name="videocam" size={20} color={editVideoFile ? '#22c55e' : '#e50914'} />
                            <Text style={styles.selectButtonText}>{editVideoFile ? `Queued: ${editVideoFile.name}` : 'Upload Replacement Video'}</Text>
                         </Pressable>
                         {editVideoFile && <Text style={{ color: '#eab308', fontSize: 12, marginTop: 6 }}>Warning: Saving will immediately overwrite the existing video.</Text>}
                      </View>
                    )}
                    
                    {editingMovie.type === 'TV Series' && (
                      <View style={styles.episodeManager}>
                        <Text style={styles.label}>Episodes</Text>
                        {loadingEpisodes ? <ActivityIndicator color="#e50914" /> : (
                          editEpisodes.map(ep => (
                            <View key={ep.id} style={styles.epEditCard}>
                                <TextInput style={styles.inputSmall} value={ep.title} onChangeText={(val) => updateLocalEpisode(ep.id, 'title', val)} placeholder="Episode Title" />
                                <View style={{flexDirection: 'row', gap: 10, marginTop: 5}}>
                                  <Text style={{color: '#888', alignSelf: 'center'}}>S:</Text>
                                  <TextInput style={[styles.inputSmall, {flex: 1}]} value={ep.season_number.toString()} onChangeText={(val) => updateLocalEpisode(ep.id, 'season_number', val)} keyboardType="numeric" />
                                  <Text style={{color: '#888', alignSelf: 'center'}}>E:</Text>
                                  <TextInput style={[styles.inputSmall, {flex: 1}]} value={ep.episode_number.toString()} onChangeText={(val) => updateLocalEpisode(ep.id, 'episode_number', val)} keyboardType="numeric" />
                                  {/* ---> UPDATED: Hidden Episode Trash Button from Managers <--- */}
                                  {userRole === 'super_admin' && (
                                    <Pressable style={{justifyContent: 'center'}} onPress={() => handleDeleteEpisode(ep.id)}>
                                      <Ionicons name="trash-outline" size={20} color="#e50914" />
                                    </Pressable>
                                  )}
                                </View>
                            </View>
                          ))
                        )}
                      </View>
                    )}
                    <View style={styles.editActionsRow}>
                      <Pressable style={styles.editCancelButton} onPress={() => setEditingMovie(null)}><Text style={styles.editCancelButtonText}>Cancel</Text></Pressable>
                      <Pressable style={styles.editSaveButton} onPress={handleMasterUpdate}>{editSaving ? <ActivityIndicator color="#fff"/> : <Text style={styles.editSaveButtonText}>Save All Changes</Text>}</Pressable>
                    </View>
                  </View>
                ) : (
                  activeMovies.map(m => (
                    <View key={m.id} style={styles.manageItem}>
                      {/* ---> UPDATED: Hidden Bulk Select Checkboxes from Managers <--- */}
                      {userRole === 'super_admin' && (
                        <Pressable style={styles.checkboxZone} onPress={() => toggleManageSelection(m.id)}>
                          <Ionicons name={selectedManageIds.includes(m.id) ? "checkbox" : "square-outline"} size={22} color={selectedManageIds.includes(m.id) ? "#e50914" : "#666"} />
                        </Pressable>
                      )}
                      
                      <View style={styles.manageInfo}>
                        <Text style={styles.manageTitle}>{m.title}</Text>
                        <Text style={styles.manageMeta}>{m.type} • Uploaded by: {m.profiles?.email || 'Super Admin'}</Text>
                      </View>
                      
                      <View style={styles.manageActions}>
                        <Pressable style={[styles.manageButton, styles.manageButtonSecondary]} onPress={() => startEditing(m)}><Text style={styles.manageButtonText}>Edit</Text></Pressable>
                        {/* ---> UPDATED: Hidden Trash Button from Managers <--- */}
                        {userRole === 'super_admin' && (
                          <Pressable style={[styles.manageButton, styles.manageButtonTrash]} onPress={() => handleTrashMovie(m.id)}>
                            {updatingId === m.id ? <ActivityIndicator size="small" color="#fff"/> : <Text style={styles.manageButtonText}>Trash</Text>}
                          </Pressable>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </>
            )}
          </View>
        )}

        {/* --- TRASH SECTION (Super Admin Only) --- */}
        {activeSection === 'trash' && userRole === 'super_admin' && (
          <View>
            {selectedTrashIds.length > 0 && (
              <View style={styles.bulkActionBar}>
                <Text style={styles.bulkActionText}>{selectedTrashIds.length} Selected</Text>
                <View style={{flexDirection: 'row', gap: 10}}>
                  <Pressable style={[styles.bulkActionButton, {backgroundColor: '#16a34a'}]} onPress={handleBulkRestore}><Text style={styles.bulkActionButtonText}>Restore</Text></Pressable>
                  <Pressable style={[styles.bulkActionButton, {backgroundColor: '#b91c1c'}]} onPress={handleBulkDeleteForever}><Text style={styles.bulkActionButtonText}>Delete</Text></Pressable>
                </View>
              </View>
            )}

            {manageLoading ? <ActivityIndicator color="#e50914" /> : (
              <>
                {trashedMovies.length === 0 && trashedEpisodes.length === 0 && <Text style={styles.label}>Trash is empty.</Text>}
                {trashedMovies.map(m => (
                  <View key={`movie-${m.id}`} style={styles.manageItem}>
                    <Pressable style={styles.checkboxZone} onPress={() => toggleTrashSelection(m.id)}><Ionicons name={selectedTrashIds.includes(m.id) ? "checkbox" : "square-outline"} size={22} color={selectedTrashIds.includes(m.id) ? "#e50914" : "#666"} /></Pressable>
                    <View style={styles.manageInfo}>
                      <Text style={styles.manageTitle}>{m.title}</Text>
                      <Text style={styles.manageMeta}>{m.type} • Uploaded by: {m.profiles?.email || 'Super Admin'}</Text>
                    </View>
                    <View style={styles.manageActions}>
                      <Pressable style={[styles.manageButton, styles.manageButtonRestore]} onPress={() => handleRestoreMovie(m.id)}>{updatingId === m.id ? <ActivityIndicator size="small" color="#fff"/> : <Text style={styles.manageButtonText}>Restore</Text>}</Pressable>
                      <Pressable style={[styles.manageButton, styles.manageButtonTrash]} onPress={() => handleDeleteForeverMovie(m.id)}>{deletingId === m.id ? <ActivityIndicator size="small" color="#fff"/> : <Text style={styles.manageButtonText}>Delete</Text>}</Pressable>
                    </View>
                  </View>
                ))}
                {trashedEpisodes.map(ep => (
                  <View key={`ep-${ep.id}`} style={[styles.manageItem, { borderColor: '#444' }]}>
                    <View style={{ padding: 5, marginRight: 8 }}><Ionicons name="tv-outline" size={22} color="#888" /></View>
                    <View style={styles.manageInfo}>
                      <Text style={styles.manageTitle}>{ep.title}</Text>
                      <Text style={styles.manageMeta}>Episode • {ep.movies?.title} (S{ep.season_number} E{ep.episode_number}) • Uploaded by: {ep.profiles?.email || 'Super Admin'}</Text>
                    </View>
                    <View style={styles.manageActions}>
                      <Pressable style={[styles.manageButton, styles.manageButtonRestore]} onPress={() => handleRestoreEpisode(ep.id)}>{updatingId === ep.id ? <ActivityIndicator size="small" color="#fff"/> : <Text style={styles.manageButtonText}>Restore</Text>}</Pressable>
                      <Pressable style={[styles.manageButton, styles.manageButtonTrash]} onPress={() => handleDeleteForeverEpisode(ep.id)}>{deletingId === ep.id ? <ActivityIndicator size="small" color="#fff"/> : <Text style={styles.manageButtonText}>Delete</Text>}</Pressable>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {/* --- TEAM MANAGEMENT SECTION (Super Admin Only) --- */}
        {activeSection === 'team' && userRole === 'super_admin' && (
          <View style={styles.dashboardContainer}>
             <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
               <Text style={styles.dashboardTitle}>Team Management</Text>
               <Pressable onPress={fetchTeamMembers}>
                 {teamLoading ? <ActivityIndicator color="#e50914" /> : <Ionicons name="refresh" size={24} color="#888" />}
               </Pressable>
             </View>
             
             <Text style={styles.label}>Search by email to promote users to Managers.</Text>

             <View style={[styles.searchBox, { width: '100%', marginBottom: 20 }]}>
               <Ionicons name="search" size={18} color="#888" style={{ marginRight: 10 }} />
               <TextInput 
                 style={styles.searchInput} 
                 placeholder="Search users by email..." 
                 placeholderTextColor="#666" 
                 value={teamSearchQuery} 
                 onChangeText={setTeamSearchQuery} 
               />
             </View>
             
             <View style={styles.leaderboardSection}>
                {teamMembers
                  .filter(member => 
                     (member.email && member.email.toLowerCase().includes(teamSearchQuery.toLowerCase())) || 
                     member.id.includes(teamSearchQuery)
                  )
                  .map(member => (
                  <View key={member.id} style={[styles.leaderboardRow, {justifyContent: 'space-between'}]}>
                     <View style={{flex: 1}}>
                       <Text style={styles.leaderboardTitle}>{member.email || `User ID: ${member.id.substring(0,8)}...`}</Text>
                       <Text style={[styles.leaderboardCategory, { color: member.role === 'super_admin' ? '#eab308' : member.role === 'manager' ? '#3b82f6' : '#888' }]}>
                         {member.role ? member.role.toUpperCase() : 'USER'}
                       </Text>
                     </View>
                     
                     {member.role !== 'super_admin' && (
                       <Pressable 
                         style={[styles.manageButton, { backgroundColor: member.role === 'manager' ? '#333' : '#e50914' }]} 
                         onPress={() => handleToggleRole(member.id, member.role)}
                       >
                         {updatingId === member.id ? <ActivityIndicator size="small" color="#fff"/> : (
                           <Text style={styles.manageButtonText}>{member.role === 'manager' ? 'Demote to User' : 'Make Manager'}</Text>
                         )}
                       </Pressable>
                     )}
                     
                     {member.role === 'super_admin' && (
                        <Text style={{color: '#eab308', fontWeight: 'bold', fontSize: 12}}>SUPER ADMIN (Protected)</Text>
                     )}
                  </View>
                ))}
             </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 100 },
  tabRow: { flexDirection: 'row', backgroundColor: '#111', borderRadius: 999, padding: 4, marginBottom: 24, borderWidth: 1, borderColor: '#1f1f1f' },
  tabButton: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  tabButtonActive: { backgroundColor: '#e50914' },
  tabButtonLabel: { color: '#aaa', fontWeight: 'bold' },
  tabButtonLabelActive: { color: '#fff' },
  subTabRow: { flexDirection: 'row', backgroundColor: '#111', borderRadius: 999, padding: 4, marginBottom: 24 },
  subTabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 999 },
  subTabButtonLabel: { color: '#aaa', fontSize: 12, fontWeight: 'bold' },
  subTabButtonLabelActive: { color: '#fff' },
  label: { fontSize: 14, fontWeight: '600', color: '#ccc', marginBottom: 8 },
  input: { backgroundColor: '#1a1a1a', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16, fontSize: 16, color: '#fff', borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 20 },
  inputSmall: { backgroundColor: '#111', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 14, color: '#fff', borderWidth: 1, borderColor: '#333' },
  descriptionInput: { minHeight: 88, textAlignVertical: 'top' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  optionChip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: '#2a2a2a', backgroundColor: '#111' },
  optionChipSelected: { borderColor: '#e50914', backgroundColor: '#1f0a0b' },
  optionChipText: { color: '#fff', fontSize: 14 },
  fileRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  selectButtonSmall: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1a1a1a', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 10, borderWidth: 1, borderColor: '#2a2a2a' },
  selectButton: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1a1a1a', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 0 },
  selectButtonText: { fontSize: 14, color: '#fff', flex: 1 },
  uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#e50914', borderRadius: 12, paddingVertical: 18, marginTop: 8 },
  uploadButtonText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  episodeSeriesList: { maxHeight: 150, marginBottom: 20 },
  seriesItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 8 },
  seriesItemSelected: { borderColor: '#e50914', backgroundColor: '#1f0a0b' },
  seriesItemText: { fontSize: 14, color: '#fff' },
  queueSection: { marginTop: 40, borderTopWidth: 1, borderTopColor: '#222', paddingTop: 20 },
  queueHeader: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  taskCard: { backgroundColor: '#111', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  taskTitle: { color: '#fff', fontWeight: 'bold', flex: 1, marginRight: 10 },
  taskProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  taskProgressBarBg: { flex: 1, height: 6, backgroundColor: '#333', borderRadius: 3, overflow: 'hidden' },
  taskProgressBarFill: { height: '100%', backgroundColor: '#e50914' },
  taskProgressText: { color: '#888', fontSize: 12, width: 35, textAlign: 'right' },
  taskMessage: { color: '#888', fontSize: 13, marginTop: 8 },
  taskSuccessText: { color: '#22c55e', fontWeight: 'bold' },
  taskErrorText: { color: '#ef4444' },
  manageItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 8 },
  checkboxZone: { padding: 5, marginRight: 8 },
  manageInfo: { flex: 1, marginRight: 12 },
  manageTitle: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 4 },
  manageMeta: { fontSize: 13, color: '#888' },
  manageActions: { flexDirection: 'row', gap: 6 },
  manageButton: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999 },
  manageButtonSecondary: { backgroundColor: '#374151' },
  manageButtonTrash: { backgroundColor: '#b91c1c' },
  manageButtonRestore: { backgroundColor: '#16a34a' },
  manageButtonText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  editSection: { backgroundColor: '#111', padding: 20, borderRadius: 15, borderLeftWidth: 4, borderLeftColor: '#e50914' },
  editImageContainer: { flexDirection: 'row', gap: 15, marginBottom: 20, alignItems: 'flex-start' },
  editPosterPreview: { width: 80, aspectRatio: 2/3, borderRadius: 8, backgroundColor: '#222', borderWidth: 1, borderColor: '#333' },
  editBackdropPreview: { width: 140, aspectRatio: 16/9, borderRadius: 8, backgroundColor: '#222', borderWidth: 1, borderColor: '#333' },
  editUploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#181818', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#333', alignSelf: 'center' },
  editUploadBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  editActionsRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  editCancelButton: { flex: 1, padding: 12, backgroundColor: '#333', borderRadius: 8, alignItems: 'center' },
  editCancelButtonText: { color: '#fff', fontWeight: 'bold' },
  editSaveButton: { flex: 1, padding: 12, backgroundColor: '#e50914', borderRadius: 8, alignItems: 'center' },
  editSaveButtonText: { color: '#fff', fontWeight: 'bold' },
  bulkActionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1f1f1f', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  bulkActionText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  bulkActionButton: { backgroundColor: '#b91c1c', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  bulkActionButtonText: { color: '#fff', fontWeight: 'bold' },
  episodeManager: { marginTop: 20, borderTopWidth: 1, borderTopColor: '#222', paddingTop: 15 },
  epEditCard: { backgroundColor: '#181818', padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#2a2a2a' },
  dashboardContainer: { paddingBottom: 20 },
  dashboardTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  statCard: { backgroundColor: '#111', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#1f1f1f', alignItems: 'center', justifyContent: 'center' },
  statIcon: { marginBottom: 10 },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  statLabel: { fontSize: 13, color: '#888', fontWeight: '600' },
  leaderboardSection: { marginTop: 30, backgroundColor: '#111', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#1f1f1f' },
  leaderboardSectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  leaderboardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#222' },
  rankText: { fontSize: 16, fontWeight: 'bold', color: '#888', width: 40 },
  leaderboardTitle: { fontSize: 15, fontWeight: 'bold', color: '#fff' },
  leaderboardCategory: { fontSize: 12, color: '#666', marginTop: 2 },
  leaderboardViews: { fontSize: 16, fontWeight: 'bold', color: '#e50914' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#2a2a2a' },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, outlineStyle: 'none' },
});