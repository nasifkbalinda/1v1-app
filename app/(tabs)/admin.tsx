import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const ADMIN_EMAIL = 'saifnasif1@gmail.com';

type UploadTask = { id: string; title: string; type: 'Movie' | 'Episode'; progress: number; status: 'uploading' | 'processing' | 'done' | 'error'; message?: string; };

export default function AdminScreen() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  const [activeSection, setActiveSection] = useState<'upload' | 'manage' | 'trash'>('upload');
  const [uploadMode, setUploadMode] = useState<'movie' | 'tvseries' | 'episode'>('movie');
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'Action' | 'Adventure' | 'Comedy' | 'Drama' | null>(null);
  const [posterFile, setPosterFile] = useState<any | null>(null);
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

  const [manageMovies, setManageMovies] = useState<any[]>([]);
  const [manageLoading, setManageLoading] = useState(false);
  
  const [editingMovie, setEditingMovie] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editEpisodes, setEditEpisodes] = useState<any[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        setIsAuthorized(true);
      } else {
        if (Platform.OS === 'web') window.alert("Access Denied: Admin privileges required.");
        else Alert.alert("Access Denied", "Admin privileges required.");
        router.replace('/'); 
      }
      setAuthChecking(false);
    };
    checkAdmin();
  }, [router]);

  // --- REFINED MASTER UPDATE LOGIC ---
  const handleMasterUpdate = async () => {
    if (!editingMovie) return;
    setEditSaving(true);
    
    try {
      // 1. Update the Main Movie/Series Info
      const { error: movieError } = await supabase
        .from('movies')
        .update({ 
          title: editTitle, 
          description: editDescription, 
          category: editCategory 
        })
        .eq('id', editingMovie.id);
      
      if (movieError) throw movieError;

      // 2. If it's a TV Series, update each episode in the database
      if (editingMovie.type === 'TV Series' && editEpisodes.length > 0) {
        // We use Promise.all to ensure all episodes save before moving on
        const episodeUpdates = editEpisodes.map(ep => 
          supabase
            .from('episodes')
            .update({
              title: ep.title,
              season_number: parseInt(ep.season_number),
              episode_number: parseInt(ep.episode_number)
            })
            .eq('id', ep.id)
        );
        
        const results = await Promise.all(episodeUpdates);
        const firstError = results.find(r => r.error);
        if (firstError) throw firstError.error;
      }

      if (Platform.OS === 'web') window.alert("Success: Series and Episodes updated!");
      else Alert.alert("Success", "Series and Episodes updated!");
      
      setEditingMovie(null);
      fetchAllMovies(); // Refresh the list
    } catch (error: any) {
      if (Platform.OS === 'web') window.alert("Update Failed: " + error.message);
      else Alert.alert("Error", error.message);
    } finally {
      setEditSaving(false);
    }
  };

  const updateLocalEpisode = (id: string, field: string, value: string) => {
    setEditEpisodes(prev => prev.map(ep => 
      ep.id === id ? { ...ep, [field]: value } : ep
    ));
  };

  const fetchTvSeries = useCallback(async () => {
    setLoadingSeries(true);
    const { data } = await supabase.from('movies').select('id, title').eq('type', 'TV Series').eq('status', 'active').order('title');
    setTvSeries(data ?? []);
    setLoadingSeries(false);
  }, []);

  const fetchAllMovies = useCallback(async () => {
    setManageLoading(true);
    const { data } = await supabase.from('movies').select('*').order('title');
    setManageMovies(data ?? []);
    setManageLoading(false);
  }, []);

  useEffect(() => { if (uploadMode === 'episode') fetchTvSeries(); }, [uploadMode, fetchTvSeries]);
  useEffect(() => { if (activeSection === 'manage' || activeSection === 'trash') fetchAllMovies(); }, [activeSection, fetchAllMovies]);

  const startEditing = async (movie: any) => {
    setEditingMovie(movie);
    setEditTitle(movie.title);
    setEditDescription(movie.description || '');
    setEditCategory(movie.category || '');

    if (movie.type === 'TV Series') {
      setLoadingEpisodes(true);
      const { data } = await supabase.from('episodes').select('*').eq('movie_id', movie.id).order('season_number').order('episode_number');
      setEditEpisodes(data || []);
      setLoadingEpisodes(false);
    }
  };

  const handleDeleteEpisode = async (epId: string) => {
    if (Platform.OS === 'web' ? window.confirm("Delete episode?") : true) {
      await supabase.from('episodes').delete().eq('id', epId);
      setEditEpisodes(prev => prev.filter(e => e.id !== epId));
    }
  };

  // ... (Rest of your upload/trash logic remains the same)

  if (authChecking) return (<View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color="#e50914" /></View>);
  if (!isAuthorized) return null;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.tabRow}>
          <Pressable style={[styles.tabButton, activeSection === 'upload' && styles.tabButtonActive]} onPress={() => { setActiveSection('upload'); setEditingMovie(null); }}><Text style={[styles.tabButtonLabel, activeSection === 'upload' && styles.tabButtonLabelActive]}>Upload</Text></Pressable>
          <Pressable style={[styles.tabButton, activeSection === 'manage' && styles.tabButtonActive]} onPress={() => setActiveSection('manage')}><Text style={[styles.tabButtonLabel, activeSection === 'manage' && styles.tabButtonLabelActive]}>Manage</Text></Pressable>
          <Pressable style={[styles.tabButton, activeSection === 'trash' && styles.tabButtonActive]} onPress={() => { setActiveSection('trash'); setEditingMovie(null); }}><Text style={[styles.tabButtonLabel, activeSection === 'trash' && styles.tabButtonLabelActive]}>Trash</Text></Pressable>
        </View>

        {activeSection === 'manage' && (
          <View>
            {editingMovie ? (
              <View style={styles.editSection}>
                <Text style={styles.label}>Edit {editingMovie.type}</Text>
                <TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle} placeholder="Series Title" />
                <TextInput style={[styles.input, styles.descriptionInput]} multiline value={editDescription} onChangeText={setEditDescription} placeholder="Description" />
                
                {editingMovie.type === 'TV Series' && (
                  <View style={styles.episodeManager}>
                    <Text style={styles.label}>Episodes</Text>
                    {loadingEpisodes ? <ActivityIndicator color="#e50914" /> : (
                      editEpisodes.map(ep => (
                        <View key={ep.id} style={styles.epEditCard}>
                            <TextInput 
                              style={styles.inputSmall} 
                              value={ep.title} 
                              onChangeText={(val) => updateLocalEpisode(ep.id, 'title', val)} 
                              placeholder="Episode Title" 
                            />
                            <View style={{flexDirection: 'row', gap: 10, marginTop: 5}}>
                              <Text style={{color: '#888', alignSelf: 'center'}}>S:</Text>
                              <TextInput style={[styles.inputSmall, {flex: 1}]} value={ep.season_number.toString()} onChangeText={(val) => updateLocalEpisode(ep.id, 'season_number', val)} keyboardType="numeric" />
                              <Text style={{color: '#888', alignSelf: 'center'}}>E:</Text>
                              <TextInput style={[styles.inputSmall, {flex: 1}]} value={ep.episode_number.toString()} onChangeText={(val) => updateLocalEpisode(ep.id, 'episode_number', val)} keyboardType="numeric" />
                              <Pressable style={{justifyContent: 'center'}} onPress={() => handleDeleteEpisode(ep.id)}><Ionicons name="trash-outline" size={20} color="#e50914" /></Pressable>
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
                  <View style={styles.manageInfo}><Text style={styles.manageTitle}>{m.title}</Text><Text style={styles.manageMeta}>{m.type}</Text></View>
                  <View style={styles.manageActions}>
                    <Pressable style={[styles.manageButton, styles.manageButtonSecondary]} onPress={() => startEditing(m)}><Text style={styles.manageButtonText}>Edit</Text></Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
        
        {/* ... (Upload Section UI and Trash Section UI) */}
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
  label: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12 },
  input: { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 16, color: '#fff', borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 15 },
  inputSmall: { backgroundColor: '#111', borderRadius: 8, padding: 10, color: '#fff', borderWidth: 1, borderColor: '#333' },
  descriptionInput: { minHeight: 100, textAlignVertical: 'top' },
  manageItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 10 },
  manageInfo: { flex: 1 },
  manageTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  manageMeta: { fontSize: 13, color: '#888', marginTop: 4 },
  manageActions: { flexDirection: 'row', gap: 10 },
  manageButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999 },
  manageButtonSecondary: { backgroundColor: '#374151' },
  manageButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  editSection: { backgroundColor: '#111', padding: 20, borderRadius: 15, borderLeftWidth: 4, borderLeftColor: '#e50914' },
  editActionsRow: { flexDirection: 'row', gap: 15, marginTop: 20 },
  editCancelButton: { flex: 1, padding: 15, backgroundColor: '#333', borderRadius: 10, alignItems: 'center' },
  editCancelButtonText: { color: '#fff', fontWeight: 'bold' },
  editSaveButton: { flex: 1, padding: 15, backgroundColor: '#e50914', borderRadius: 10, alignItems: 'center' },
  editSaveButtonText: { color: '#fff', fontWeight: 'bold' },
  episodeManager: { marginTop: 25, borderTopWidth: 1, borderTopColor: '#222', paddingTop: 20 },
  epEditCard: { backgroundColor: '#181818', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#2a2a2a' },
});