import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

type PickedFile = {
  uri: string;
  name: string;
  mimeType?: string;
};

export default function AdminScreen() {
  const [activeSection, setActiveSection] = useState<'upload' | 'manage' | 'trash'>(
    'upload'
  );
  const [uploadMode, setUploadMode] = useState<'movie' | 'tvseries' | 'episode'>('movie');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'Action' | 'Adventure' | 'Comedy' | 'Drama' | null>(null);
  const [posterFile, setPosterFile] = useState<PickedFile | null>(null);
  const [videoFile, setVideoFile] = useState<PickedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [tvSeries, setTvSeries] = useState<{ id: string; title: string }[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [seasonNumber, setSeasonNumber] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('');
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [episodeVideoFile, setEpisodeVideoFile] = useState<PickedFile | null>(null);
  const [uploadingEpisode, setUploadingEpisode] = useState(false);

  const [manageMovies, setManageMovies] = useState<
    {
      id: string;
      title: string;
      description: string | null;
      poster_url: string | null;
      video_url: string | null;
      category: string | null;
      type: string | null;
      status: string | null;
    }[]
  >([]);
  const [manageLoading, setManageLoading] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [editingMovie, setEditingMovie] = useState<{
    id: string;
    title: string;
    description: string | null;
    poster_url: string | null;
    video_url: string | null;
    category: string | null;
    type: string | null;
  } | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPosterUrl, setEditPosterUrl] = useState('');
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const clearFeedback = useCallback(() => {
    setSuccessMessage(null);
    setErrorMessage(null);
  }, []);

  const pickPoster = useCallback(async () => {
    clearFeedback();
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setErrorMessage('Photo library permission is required to select a poster.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setPosterFile({
        uri: asset.uri,
        name: asset.fileName ?? `poster-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
    } catch (err) {
      console.error('Poster pick error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to select poster image.');
    }
  }, [clearFeedback]);

  const pickVideo = useCallback(async () => {
    clearFeedback();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      setVideoFile({
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType ?? 'video/mp4',
      });
    } catch (err) {
      console.error('Video pick error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to select movie video.');
    }
  }, [clearFeedback]);

  const pickEpisodeVideo = useCallback(async () => {
    clearFeedback();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      setEpisodeVideoFile({
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType ?? 'video/mp4',
      });
    } catch (err) {
      console.error('Episode video pick error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to select episode video.');
    }
  }, [clearFeedback]);

  const uploadFile = useCallback(
    async (uri: string, path: string, mimeType: string): Promise<string> => {
      const response = await fetch(uri);
      if (!response.ok) throw new Error(`Failed to read file: ${response.status}`);
      const blob = await response.blob();
      const { data, error } = await supabase.storage.from('movies').upload(path, blob, {
        contentType: mimeType,
        upsert: false,
      });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('movies').getPublicUrl(data.path);
      return urlData.publicUrl;
    },
    []
  );

  const fetchTvSeries = useCallback(async () => {
    clearFeedback();
    setLoadingSeries(true);
    try {
      const { data, error } = await supabase
        .from('movies')
        .select('id, title')
        .eq('type', 'TV Series')
        .eq('status', 'active')
        .order('title', { ascending: true });

      if (error) throw error;
      setTvSeries(data ?? []);
    } catch (err) {
      console.error('Fetch TV series error:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to load TV series. Please try again.'
      );
    } finally {
      setLoadingSeries(false);
    }
  }, [clearFeedback]);

  const fetchAllMovies = useCallback(async () => {
    clearFeedback();
    setManageError(null);
    setManageLoading(true);
    try {
      const { data, error } = await supabase
        .from('movies')
        .select('id, title, description, poster_url, video_url, category, type, status')
        .order('title', { ascending: true });

      if (error) throw error;
      setManageMovies(data ?? []);
    } catch (err) {
      console.error('Fetch all movies error:', err);
      setManageError(
        err instanceof Error ? err.message : 'Failed to load movies. Please try again.'
      );
    } finally {
      setManageLoading(false);
    }
  }, [clearFeedback]);

  useEffect(() => {
    if (uploadMode === 'episode' && tvSeries.length === 0 && !loadingSeries) {
      fetchTvSeries();
    }
  }, [uploadMode, tvSeries.length, loadingSeries, fetchTvSeries]);

  useEffect(() => {
    if (activeSection === 'manage' || activeSection === 'trash') {
      fetchAllMovies();
    }
  }, [activeSection, fetchAllMovies]);

  const handleUploadMovie = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Please enter a movie title.');
      return;
    }
    if (!category) {
      setErrorMessage('Please select a category.');
      return;
    }
    if (!posterFile) {
      setErrorMessage('Please select a poster image.');
      return;
    }
    if (!videoFile) {
      setErrorMessage('Please select a movie video.');
      return;
    }

    clearFeedback();
    setUploading(true);

    try {
      const timestamp = Date.now();
      const safeSlug = trimmedTitle.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').slice(0, 40) || 'movie';
      const posterExt = posterFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const videoExt = videoFile.name.split('.').pop()?.toLowerCase() || 'mp4';
      const posterPath = `posters/${timestamp}-${safeSlug}.${posterExt}`;
      const videoPath = `videos/${timestamp}-${safeSlug}.${videoExt}`;

      const [posterUrl, videoUrl] = await Promise.all([
        uploadFile(posterFile.uri, posterPath, posterFile.mimeType ?? 'image/jpeg'),
        uploadFile(videoFile.uri, videoPath, videoFile.mimeType ?? 'video/mp4'),
      ]);

      const { error: insertError } = await supabase.from('movies').insert({
        title: trimmedTitle,
        description: description.trim() || null,
        poster_url: posterUrl,
        video_url: videoUrl,
        type: 'Movie',
        category,
        status: 'active',
        deleted_at: null,
      });

      if (insertError) throw insertError;

      setSuccessMessage('Movie uploaded successfully!');
      setTitle('');
      setDescription('');
      setCategory(null);
      setPosterFile(null);
      setVideoFile(null);
    } catch (err) {
      console.error('Upload error:', err);
      const message =
        err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Upload failed. Please try again.';
      setErrorMessage(message);
    } finally {
      setUploading(false);
    }
  }, [title, description, category, posterFile, videoFile, clearFeedback, uploadFile]);

  const handleCreateTVSeries = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Please enter a TV series title.');
      return;
    }
    if (!category) {
      setErrorMessage('Please select a category.');
      return;
    }
    if (!posterFile) {
      setErrorMessage('Please select a poster image.');
      return;
    }

    clearFeedback();
    setUploading(true);

    try {
      const timestamp = Date.now();
      const safeSlug = trimmedTitle.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').slice(0, 40) || 'series';
      const posterExt = posterFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const posterPath = `posters/${timestamp}-${safeSlug}.${posterExt}`;

      const posterUrl = await uploadFile(posterFile.uri, posterPath, posterFile.mimeType ?? 'image/jpeg');

      const { error: insertError } = await supabase.from('movies').insert({
        title: trimmedTitle,
        description: description.trim() || null,
        poster_url: posterUrl,
        video_url: null,
        type: 'TV Series',
        category,
        status: 'active',
        deleted_at: null,
      });

      if (insertError) throw insertError;

      setSuccessMessage('TV Series created successfully!');
      setTitle('');
      setDescription('');
      setCategory(null);
      setPosterFile(null);
    } catch (err) {
      console.error('Create TV Series error:', err);
      const message =
        err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Failed to create TV series. Please try again.';
      setErrorMessage(message);
    } finally {
      setUploading(false);
    }
  }, [title, description, category, posterFile, clearFeedback, uploadFile]);

  const handleTrashMovie = useCallback(
    (movieId: string) => {
      const runTrash = async () => {
        setManageError(null);
        setUpdatingId(movieId);
        try {
          const { error } = await supabase
            .from('movies')
            .update({
              status: 'trash',
              deleted_at: new Date().toISOString(),
            })
            .eq('id', movieId);

          if (error) throw error;

          setManageMovies((prev) =>
            prev.map((m) =>
              m.id === movieId
                ? { ...m, status: 'trash', deleted_at: new Date().toISOString() }
                : m
            )
          );

          if (editingMovie && editingMovie.id === movieId) {
            setEditingMovie(null);
          }

          await fetchAllMovies();
        } catch (err) {
          console.error('Trash movie error:', err);
          const message =
            err instanceof Error
              ? err.message
              : (err as { message?: string })?.message ??
                'Failed to move movie to trash. Please try again.';
          setManageError(message);
        } finally {
          setUpdatingId(null);
        }
      };

      if (Platform.OS === 'web') {
        const confirmed =
          typeof window !== 'undefined' &&
          window.confirm('Move to Trash? Are you sure?');
        if (confirmed) {
          void runTrash();
        }
      } else {
        Alert.alert('Move to Trash?', 'Are you sure?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes',
            style: 'destructive',
            onPress: () => {
              void runTrash();
            },
          },
        ]);
      }
    },
    [fetchAllMovies, editingMovie]
  );

  const handleRestoreMovie = useCallback(
    async (movieId: string) => {
      setManageError(null);
      setUpdatingId(movieId);
      try {
        const { error } = await supabase
          .from('movies')
          .update({
            status: 'active',
            deleted_at: null,
          })
          .eq('id', movieId);

        if (error) throw error;
        setManageMovies((prev) =>
          prev.map((m) => (m.id === movieId ? { ...m, status: 'active', deleted_at: null } : m))
        );
        await fetchAllMovies();
      } catch (err) {
        console.error('Restore movie error:', err);
        const message =
          err instanceof Error
            ? err.message
            : (err as { message?: string })?.message ??
              'Failed to restore movie. Please try again.';
        setManageError(message);
      } finally {
        setUpdatingId(null);
      }
    },
    [fetchAllMovies]
  );

  const handleDeleteForeverMovie = useCallback(
    (movieId: string) => {
      const runDelete = async () => {
        setManageError(null);
        setDeletingId(movieId);
        try {
          const { error } = await supabase
            .from('movies')
            .delete()
            .eq('id', movieId);

          if (error) throw error;

          setManageMovies((prev) => prev.filter((m) => m.id !== movieId));

          if (editingMovie && editingMovie.id === movieId) {
            setEditingMovie(null);
          }

          await fetchAllMovies();
        } catch (err) {
          console.error('Delete movie error:', err);
          const message =
            err instanceof Error
              ? err.message
              : (err as { message?: string })?.message ??
                'Failed to delete movie. Please try again.';
          setManageError(message);
        } finally {
          setDeletingId(null);
        }
      };

      if (Platform.OS === 'web') {
        const confirmed =
          typeof window !== 'undefined' &&
          window.confirm('Permanent Delete: This cannot be undone. Proceed?');
        if (confirmed) {
          void runDelete();
        }
      } else {
        Alert.alert(
          'Permanent Delete',
          'This cannot be undone. Proceed?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Yes',
              style: 'destructive',
              onPress: () => {
                void runDelete();
              },
            },
          ]
        );
      }
    },
    [fetchAllMovies, editingMovie]
  );

  useEffect(() => {
    if (editingMovie) {
      setEditTitle(editingMovie.title);
      setEditDescription(editingMovie.description ?? '');
      setEditCategory(editingMovie.category ?? '');
      setEditPosterUrl(editingMovie.poster_url ?? '');
      setEditVideoUrl(editingMovie.video_url ?? '');
    } else {
      setEditTitle('');
      setEditDescription('');
      setEditCategory('');
      setEditPosterUrl('');
      setEditVideoUrl('');
    }
  }, [editingMovie]);

  const handleStartEdit = useCallback(
    (movie: {
      id: string;
      title: string;
      description: string | null;
      poster_url: string | null;
      video_url: string | null;
      category: string | null;
      type: string | null;
    }) => {
      setManageError(null);
      clearFeedback();
      setEditingMovie(movie);
    },
    [clearFeedback]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingMovie(null);
  }, []);

  const handleUpdateMovie = useCallback(async () => {
    if (!editingMovie) return;

    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      setManageError('Please enter a movie title.');
      return;
    }

    setEditSaving(true);
    setManageError(null);

    try {
      const updates = {
        title: trimmedTitle,
        description: editDescription.trim() || null,
        category: editCategory.trim() || null,
        poster_url: editPosterUrl.trim() || null,
        video_url: editVideoUrl.trim() || null,
      };

      const { error } = await supabase.from('movies').update(updates).eq('id', editingMovie.id);

      if (error) throw error;

      setManageMovies((prev) =>
        prev.map((m) => (m.id === editingMovie.id ? { ...m, ...updates } : m))
      );

      setEditingMovie(null);
      await fetchAllMovies();
    } catch (err) {
      console.error('Update movie error:', err);
      const message =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message ??
            'Failed to update movie. Please try again.';
      setManageError(message);
    } finally {
      setEditSaving(false);
    }
  }, [
    editingMovie,
    editTitle,
    editDescription,
    editCategory,
    editPosterUrl,
    editVideoUrl,
    fetchAllMovies,
  ]);

  const handleEpisodeUpload = useCallback(async () => {
    const trimmedTitle = episodeTitle.trim();
    if (!selectedSeriesId) {
      setErrorMessage('Please select a TV series.');
      return;
    }
    if (!trimmedTitle) {
      setErrorMessage('Please enter an episode title.');
      return;
    }
    const season = Number(seasonNumber);
    if (!season || season < 1) {
      setErrorMessage('Please enter a valid season number.');
      return;
    }
    const episode = Number(episodeNumber);
    if (!episode || episode < 1) {
      setErrorMessage('Please enter a valid episode number.');
      return;
    }
    if (!episodeVideoFile) {
      setErrorMessage('Please select an episode video.');
      return;
    }

    clearFeedback();
    setUploadingEpisode(true);

    try {
      const timestamp = Date.now();
      const baseSlug =
        trimmedTitle.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').slice(0, 40) || 'episode';
      const ext = episodeVideoFile.name.split('.').pop()?.toLowerCase() || 'mp4';
      const videoPath = `episodes/${timestamp}-${baseSlug}-s${season}e${episode}.${ext}`;

      const videoUrl = await uploadFile(
        episodeVideoFile.uri,
        videoPath,
        episodeVideoFile.mimeType ?? 'video/mp4'
      );

      const { error: insertError } = await supabase.from('episodes').insert({
        movie_id: selectedSeriesId,
        season_number: season,
        episode_number: episode,
        title: trimmedTitle,
        video_url: videoUrl,
      });

      if (insertError) throw insertError;

      setSuccessMessage('Episode uploaded successfully!');
      setSelectedSeriesId(null);
      setSeasonNumber('');
      setEpisodeNumber('');
      setEpisodeTitle('');
      setEpisodeVideoFile(null);
    } catch (err) {
      console.error('Episode upload error:', err);
      const message =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message ?? 'Episode upload failed. Please try again.';
      setErrorMessage(message);
    } finally {
      setUploadingEpisode(false);
    }
  }, [
    episodeTitle,
    selectedSeriesId,
    seasonNumber,
    episodeNumber,
    episodeVideoFile,
    clearFeedback,
    uploadFile,
  ]);

  const activeMovies = manageMovies.filter((movie) => movie.status === 'active');
  const trashedMovies = manageMovies.filter((movie) => movie.status === 'trash');

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.tabRow}>
          <Pressable
            style={[
              styles.tabButton,
              activeSection === 'upload' && styles.tabButtonActive,
            ]}
            onPress={() => {
              setActiveSection('upload');
              clearFeedback();
              setManageError(null);
              setEditingMovie(null);
            }}>
            <Text
              style={[
                styles.tabButtonLabel,
                activeSection === 'upload' && styles.tabButtonLabelActive,
              ]}>
              Upload New
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tabButton,
              activeSection === 'manage' && styles.tabButtonActive,
            ]}
            onPress={() => {
              setActiveSection('manage');
              clearFeedback();
              setManageError(null);
            }}>
            <Text
              style={[
                styles.tabButtonLabel,
                activeSection === 'manage' && styles.tabButtonLabelActive,
              ]}>
              Manage Active
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tabButton,
              activeSection === 'trash' && styles.tabButtonActive,
            ]}
            onPress={() => {
              setActiveSection('trash');
              clearFeedback();
              setManageError(null);
              setEditingMovie(null);
            }}>
            <Text
              style={[
                styles.tabButtonLabel,
                activeSection === 'trash' && styles.tabButtonLabelActive,
              ]}>
              Trash Bin
            </Text>
          </Pressable>
        </View>

        {activeSection === 'upload' && (
          <>
            <View style={styles.subTabRow}>
              <Pressable
                style={[
                  styles.subTabButton,
                  uploadMode === 'movie' && styles.tabButtonActive,
                ]}
                onPress={() => {
                  setUploadMode('movie');
                  clearFeedback();
                }}>
                <Text
                  style={[
                    styles.subTabButtonLabel,
                    uploadMode === 'movie' && styles.subTabButtonLabelActive,
                  ]}>
                  Upload Movie
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.subTabButton,
                  uploadMode === 'tvseries' && styles.tabButtonActive,
                ]}
                onPress={() => {
                  setUploadMode('tvseries');
                  clearFeedback();
                }}>
                <Text
                  style={[
                    styles.subTabButtonLabel,
                    uploadMode === 'tvseries' && styles.subTabButtonLabelActive,
                  ]}>
                  Create TV Series
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.subTabButton,
                  uploadMode === 'episode' && styles.tabButtonActive,
                ]}
                onPress={() => {
                  setUploadMode('episode');
                  clearFeedback();
                }}>
                <Text
                  style={[
                    styles.subTabButtonLabel,
                    uploadMode === 'episode' && styles.subTabButtonLabelActive,
                  ]}>
                  Add Episode
                </Text>
              </Pressable>
            </View>

            {uploadMode === 'movie' && (
              <>
                <Text style={styles.header}>Upload Movie</Text>
                <Text style={styles.subheader}>Add a new movie with poster and video</Text>

                <Text style={styles.label}>Movie Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter movie title"
                  placeholderTextColor="#666"
                  value={title}
                  onChangeText={(t) => {
                    setTitle(t);
                    clearFeedback();
                  }}
                  editable={!uploading}
                  autoCapitalize="words"
                />

                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.descriptionInput]}
                  placeholder="Enter description (optional)"
                  placeholderTextColor="#666"
                  value={description}
                  onChangeText={(t) => {
                    setDescription(t);
                    clearFeedback();
                  }}
                  editable={!uploading}
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.label}>Category</Text>
                <View style={styles.optionRow}>
                  {['Action', 'Adventure', 'Comedy', 'Drama'].map((option) => {
                    const selected = category === option;
                    return (
                      <Pressable
                        key={option}
                        style={[
                          styles.optionChip,
                          selected && styles.optionChipSelected,
                          uploading && styles.optionChipDisabled,
                        ]}
                        disabled={uploading}
                        onPress={() => {
                          setCategory(option as 'Action' | 'Adventure' | 'Comedy' | 'Drama');
                          clearFeedback();
                        }}>
                        <Text
                          style={[
                            styles.optionChipText,
                            selected && styles.optionChipTextSelected,
                          ]}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.label}>Poster Image</Text>
                <View style={styles.buttonRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.selectButton,
                      pressed && styles.selectButtonPressed,
                    ]}
                    onPress={pickPoster}
                    disabled={uploading}>
                    <Ionicons name="image-outline" size={22} color="#fff" />
                    <Text style={styles.selectButtonText}>
                      {posterFile ? posterFile.name : 'Select Poster Image'}
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.label}>Movie Video</Text>
                <View style={styles.buttonRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.selectButton,
                      pressed && styles.selectButtonPressed,
                    ]}
                    onPress={pickVideo}
                    disabled={uploading}>
                    <Ionicons name="videocam-outline" size={22} color="#fff" />
                    <Text style={styles.selectButtonText}>
                      {videoFile ? videoFile.name : 'Select Movie Video'}
                    </Text>
                  </Pressable>
                </View>

                {uploading && (
                  <View style={styles.feedbackRow}>
                    <ActivityIndicator size="small" color="#e50914" />
                    <Text style={styles.feedbackText}>Uploading...</Text>
                  </View>
                )}
                {successMessage && (
                  <View style={styles.feedbackRow}>
                    <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                    <Text style={[styles.feedbackText, styles.successText]}>
                      {successMessage}
                    </Text>
                  </View>
                )}
                {errorMessage && (
                  <View style={styles.feedbackRow}>
                    <Ionicons name="alert-circle" size={20} color="#ef4444" />
                    <Text style={[styles.feedbackText, styles.errorText]}>{errorMessage}</Text>
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.uploadButton,
                    uploading && styles.uploadButtonDisabled,
                    pressed && !uploading && styles.uploadButtonPressed,
                  ]}
                  onPress={handleUploadMovie}
                  disabled={uploading}>
                  {uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={24} color="#fff" />
                      <Text style={styles.uploadButtonText}>Upload Movie</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}

            {uploadMode === 'tvseries' && (
              <>
                <Text style={styles.header}>Create TV Series</Text>
                <Text style={styles.subheader}>Add a new TV series (add episodes later)</Text>

                <Text style={styles.label}>Series Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter TV series title"
                  placeholderTextColor="#666"
                  value={title}
                  onChangeText={(t) => {
                    setTitle(t);
                    clearFeedback();
                  }}
                  editable={!uploading}
                  autoCapitalize="words"
                />

                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.descriptionInput]}
                  placeholder="Enter description (optional)"
                  placeholderTextColor="#666"
                  value={description}
                  onChangeText={(t) => {
                    setDescription(t);
                    clearFeedback();
                  }}
                  editable={!uploading}
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.label}>Category</Text>
                <View style={styles.optionRow}>
                  {['Action', 'Adventure', 'Comedy', 'Drama'].map((option) => {
                    const selected = category === option;
                    return (
                      <Pressable
                        key={option}
                        style={[
                          styles.optionChip,
                          selected && styles.optionChipSelected,
                          uploading && styles.optionChipDisabled,
                        ]}
                        disabled={uploading}
                        onPress={() => {
                          setCategory(option as 'Action' | 'Adventure' | 'Comedy' | 'Drama');
                          clearFeedback();
                        }}>
                        <Text
                          style={[
                            styles.optionChipText,
                            selected && styles.optionChipTextSelected,
                          ]}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.label}>Poster Image</Text>
                <View style={styles.buttonRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.selectButton,
                      pressed && styles.selectButtonPressed,
                    ]}
                    onPress={pickPoster}
                    disabled={uploading}>
                    <Ionicons name="image-outline" size={22} color="#fff" />
                    <Text style={styles.selectButtonText}>
                      {posterFile ? posterFile.name : 'Select Poster Image'}
                    </Text>
                  </Pressable>
                </View>

                {uploading && (
                  <View style={styles.feedbackRow}>
                    <ActivityIndicator size="small" color="#e50914" />
                    <Text style={styles.feedbackText}>Creating...</Text>
                  </View>
                )}
                {successMessage && (
                  <View style={styles.feedbackRow}>
                    <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                    <Text style={[styles.feedbackText, styles.successText]}>
                      {successMessage}
                    </Text>
                  </View>
                )}
                {errorMessage && (
                  <View style={styles.feedbackRow}>
                    <Ionicons name="alert-circle" size={20} color="#ef4444" />
                    <Text style={[styles.feedbackText, styles.errorText]}>{errorMessage}</Text>
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.uploadButton,
                    uploading && styles.uploadButtonDisabled,
                    pressed && !uploading && styles.uploadButtonPressed,
                  ]}
                  onPress={handleCreateTVSeries}
                  disabled={uploading}>
                  {uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="add-circle-outline" size={24} color="#fff" />
                      <Text style={styles.uploadButtonText}>Create TV Series</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}

            {uploadMode === 'episode' && (
              <>
                <Text style={styles.header}>Upload Episode</Text>
                <Text style={styles.subheader}>
                  Add a new episode for an existing TV series
                </Text>

                <Text style={styles.label}>TV Series</Text>
                <View style={styles.episodeSeriesList}>
                  {loadingSeries && (
                    <View style={styles.feedbackRow}>
                      <ActivityIndicator size="small" color="#e50914" />
                      <Text style={styles.feedbackText}>Loading TV series...</Text>
                    </View>
                  )}
                  {!loadingSeries && tvSeries.length === 0 && (
                    <View style={styles.feedbackRow}>
                      <Ionicons name="alert-circle" size={20} color="#ef4444" />
                      <Text style={[styles.feedbackText, styles.errorText]}>
                        No TV series found. Create a TV Series first.
                      </Text>
                    </View>
                  )}
                  {!loadingSeries &&
                    tvSeries.map((show) => {
                      const selected = selectedSeriesId === show.id;
                      return (
                        <Pressable
                          key={show.id}
                          style={[
                            styles.seriesItem,
                            selected && styles.seriesItemSelected,
                          ]}
                          disabled={uploadingEpisode}
                          onPress={() => {
                            setSelectedSeriesId(show.id);
                            clearFeedback();
                          }}>
                          <Text
                            style={[
                              styles.seriesItemText,
                              selected && styles.seriesItemTextSelected,
                            ]}>
                            {show.title}
                          </Text>
                          {selected && (
                            <Ionicons name="checkmark-circle" size={18} color="#e50914" />
                          )}
                        </Pressable>
                      );
                    })}
                </View>

                <Text style={styles.label}>Season Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 1"
                  placeholderTextColor="#666"
                  value={seasonNumber}
                  onChangeText={(t) => {
                    setSeasonNumber(t.replace(/[^0-9]/g, ''));
                    clearFeedback();
                  }}
                  editable={!uploadingEpisode}
                  keyboardType="number-pad"
                />

                <Text style={styles.label}>Episode Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 1"
                  placeholderTextColor="#666"
                  value={episodeNumber}
                  onChangeText={(t) => {
                    setEpisodeNumber(t.replace(/[^0-9]/g, ''));
                    clearFeedback();
                  }}
                  editable={!uploadingEpisode}
                  keyboardType="number-pad"
                />

                <Text style={styles.label}>Episode Title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter episode title"
                  placeholderTextColor="#666"
                  value={episodeTitle}
                  onChangeText={(t) => {
                    setEpisodeTitle(t);
                    clearFeedback();
                  }}
                  editable={!uploadingEpisode}
                  autoCapitalize="sentences"
                />

                <Text style={styles.label}>Episode Video</Text>
                <View style={styles.buttonRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.selectButton,
                      pressed && styles.selectButtonPressed,
                    ]}
                    onPress={pickEpisodeVideo}
                    disabled={uploadingEpisode}>
                    <Ionicons name="videocam-outline" size={22} color="#fff" />
                    <Text style={styles.selectButtonText}>
                      {episodeVideoFile ? episodeVideoFile.name : 'Select Episode Video'}
                    </Text>
                  </Pressable>
                </View>

                {uploadingEpisode && (
                  <View style={styles.feedbackRow}>
                    <ActivityIndicator size="small" color="#e50914" />
                    <Text style={styles.feedbackText}>Uploading episode...</Text>
                  </View>
                )}
                {successMessage && (
                  <View style={styles.feedbackRow}>
                    <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                    <Text style={[styles.feedbackText, styles.successText]}>
                      {successMessage}
                    </Text>
                  </View>
                )}
                {errorMessage && (
                  <View style={styles.feedbackRow}>
                    <Ionicons name="alert-circle" size={20} color="#ef4444" />
                    <Text style={[styles.feedbackText, styles.errorText]}>{errorMessage}</Text>
                  </View>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.uploadButton,
                    uploadingEpisode && styles.uploadButtonDisabled,
                    pressed && !uploadingEpisode && styles.uploadButtonPressed,
                  ]}
                  onPress={handleEpisodeUpload}
                  disabled={uploadingEpisode}>
                  {uploadingEpisode ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={24} color="#fff" />
                      <Text style={styles.uploadButtonText}>Upload Episode</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </>
        )}

        {activeSection === 'manage' && (
          <View style={styles.manageSection}>
            <Text style={styles.header}>Manage Active</Text>
            <Text style={styles.subheader}>Edit or move active movies to Trash</Text>

            {manageLoading && (
              <View style={styles.feedbackRow}>
                <ActivityIndicator size="small" color="#e50914" />
                <Text style={styles.feedbackText}>Loading movies...</Text>
              </View>
            )}

            {manageError && (
              <View style={styles.feedbackRow}>
                <Ionicons name="alert-circle" size={20} color="#ef4444" />
                <Text style={[styles.feedbackText, styles.errorText]}>{manageError}</Text>
              </View>
            )}

            {!manageLoading && !manageError && (
              <>
                {editingMovie ? (
                  <View style={styles.editSection}>
                    <Text style={styles.manageSubsectionTitle}>Edit Movie</Text>
                    <Text style={styles.editHintText}>
                      Update details for <Text style={styles.editMovieTitle}>{editingMovie.title}</Text>
                    </Text>

                    <Text style={styles.label}>Title</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Movie title"
                      placeholderTextColor="#666"
                      value={editTitle}
                      onChangeText={setEditTitle}
                      editable={!editSaving}
                    />

                    <Text style={styles.label}>Description</Text>
                    <TextInput
                      style={[styles.input, styles.descriptionInput]}
                      placeholder="Description"
                      placeholderTextColor="#666"
                      value={editDescription}
                      onChangeText={setEditDescription}
                      editable={!editSaving}
                      multiline
                      numberOfLines={3}
                    />

                    <Text style={styles.label}>Category</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Category (e.g. Action)"
                      placeholderTextColor="#666"
                      value={editCategory}
                      onChangeText={setEditCategory}
                      editable={!editSaving}
                    />

                    <Text style={styles.label}>Poster URL</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="https://..."
                      placeholderTextColor="#666"
                      value={editPosterUrl}
                      onChangeText={setEditPosterUrl}
                      editable={!editSaving}
                      autoCapitalize="none"
                    />

                    <Text style={styles.label}>Video URL</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="https://..."
                      placeholderTextColor="#666"
                      value={editVideoUrl}
                      onChangeText={setEditVideoUrl}
                      editable={!editSaving}
                      autoCapitalize="none"
                    />

                    <View style={styles.editActionsRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.editCancelButton,
                          pressed && styles.editCancelButtonPressed,
                        ]}
                        disabled={editSaving}
                        onPress={handleCancelEdit}>
                        <Text style={styles.editCancelButtonText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          styles.editSaveButton,
                          editSaving && styles.uploadButtonDisabled,
                          pressed && !editSaving && styles.uploadButtonPressed,
                        ]}
                        disabled={editSaving}
                        onPress={handleUpdateMovie}>
                        {editSaving ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.editSaveButtonText}>Update Movie</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ) : activeMovies.length === 0 ? (
                  <Text style={styles.manageEmptyText}>No active movies.</Text>
                ) : (
                  <View style={styles.manageList}>
                    {activeMovies.map((movie) => {
                      const isUpdating = updatingId === movie.id;
                      return (
                        <View key={movie.id} style={styles.manageItem}>
                          <View style={styles.manageThumb}>
                            {movie.poster_url ? (
                              <Image
                                source={{ uri: movie.poster_url }}
                                style={styles.manageThumbImage}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={styles.manageThumbPlaceholder}>
                                <Ionicons name="image-outline" size={18} color="#666" />
                              </View>
                            )}
                          </View>
                          <View style={styles.manageInfo}>
                            <Text style={styles.manageTitle}>{movie.title}</Text>
                            <Text style={styles.manageMeta}>
                              {movie.type || 'Movie'} • {movie.category || 'Uncategorized'}
                            </Text>
                          </View>
                          <View style={styles.manageActions}>
                            <Pressable
                              style={({ pressed }) => [
                                styles.manageButton,
                                styles.manageButtonSecondary,
                                pressed && styles.manageButtonPressed,
                                isUpdating && styles.manageButtonDisabled,
                              ]}
                              disabled={isUpdating}
                              onPress={() => handleStartEdit(movie)}>
                              <Text style={styles.manageButtonText}>Edit</Text>
                            </Pressable>
                            <Pressable
                              style={({ pressed }) => [
                                styles.manageButton,
                                styles.manageButtonTrash,
                                pressed && styles.manageButtonPressed,
                                isUpdating && styles.manageButtonDisabled,
                              ]}
                              disabled={isUpdating}
                              onPress={() => handleTrashMovie(movie.id)}>
                              {isUpdating ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text style={styles.manageButtonText}>Trash</Text>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {activeSection === 'trash' && (
          <View style={styles.manageSection}>
            <Text style={styles.header}>Trash Bin</Text>
            <Text style={styles.subheader}>Restore or permanently delete movies</Text>

            {manageLoading && (
              <View style={styles.feedbackRow}>
                <ActivityIndicator size="small" color="#e50914" />
                <Text style={styles.feedbackText}>Loading movies...</Text>
              </View>
            )}

            {manageError && (
              <View style={styles.feedbackRow}>
                <Ionicons name="alert-circle" size={20} color="#ef4444" />
                <Text style={[styles.feedbackText, styles.errorText]}>{manageError}</Text>
              </View>
            )}

            {!manageLoading && !manageError && (
              <>
                {trashedMovies.length === 0 ? (
                  <Text style={styles.manageEmptyText}>No trashed movies.</Text>
                ) : (
                  <View style={styles.manageList}>
                    {trashedMovies.map((movie) => {
                      const isRestoring = updatingId === movie.id;
                      const isDeleting = deletingId === movie.id;
                      return (
                        <View key={movie.id} style={styles.manageItem}>
                          <View style={styles.manageThumb}>
                            {movie.poster_url ? (
                              <Image
                                source={{ uri: movie.poster_url }}
                                style={styles.manageThumbImage}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={styles.manageThumbPlaceholder}>
                                <Ionicons name="image-outline" size={18} color="#666" />
                              </View>
                            )}
                          </View>
                          <View style={styles.manageInfo}>
                            <Text style={styles.manageTitle}>{movie.title}</Text>
                            <Text style={styles.manageMeta}>
                              {movie.type || 'Movie'} • {movie.category || 'Uncategorized'}
                            </Text>
                          </View>
                          <View style={styles.manageActions}>
                            <Pressable
                              style={({ pressed }) => [
                                styles.manageButton,
                                styles.manageButtonRestore,
                                pressed && styles.manageButtonPressed,
                                (isRestoring || isDeleting) && styles.manageButtonDisabled,
                              ]}
                              disabled={isRestoring || isDeleting}
                              onPress={() => handleRestoreMovie(movie.id)}>
                              {isRestoring ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text style={styles.manageButtonText}>Restore</Text>
                              )}
                            </Pressable>
                            <Pressable
                              style={({ pressed }) => [
                                styles.manageButton,
                                styles.manageButtonTrash,
                                pressed && styles.manageButtonPressed,
                                (isRestoring || isDeleting) && styles.manageButtonDisabled,
                              ]}
                              disabled={isRestoring || isDeleting}
                              onPress={() => handleDeleteForeverMovie(movie.id)}>
                              {isDeleting ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text style={styles.manageButtonText}>Delete Forever</Text>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderRadius: 999,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  subTabRow: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderRadius: 999,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  subTabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTabButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#aaa',
  },
  subTabButtonLabelActive: {
    color: '#fff',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#e50914',
  },
  tabButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#aaa',
  },
  tabButtonLabelActive: {
    color: '#fff',
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  subheader: {
    fontSize: 14,
    color: '#888',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ccc',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 20,
  },
  descriptionInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  optionChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#111',
  },
  optionChipSelected: {
    borderColor: '#e50914',
    backgroundColor: '#1f0a0b',
  },
  optionChipDisabled: {
    opacity: 0.6,
  },
  optionChipText: {
    color: '#fff',
    fontSize: 14,
  },
  optionChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonRow: {
    marginBottom: 20,
  },
  episodeSeriesList: {
    marginBottom: 20,
    gap: 8,
  },
  seriesItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  seriesItemSelected: {
    borderColor: '#e50914',
    backgroundColor: '#1f0a0b',
  },
  seriesItemText: {
    fontSize: 14,
    color: '#fff',
    flex: 1,
    marginRight: 8,
  },
  seriesItemTextSelected: {
    fontWeight: '600',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  selectButtonText: {
    fontSize: 15,
    color: '#fff',
    flex: 1,
  },
  selectButtonPressed: {
    opacity: 0.8,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  feedbackText: {
    fontSize: 14,
    color: '#888',
  },
  successText: {
    color: '#22c55e',
  },
  errorText: {
    color: '#ef4444',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#e50914',
    borderRadius: 12,
    paddingVertical: 18,
    marginTop: 8,
  },
  uploadButtonDisabled: {
    opacity: 0.7,
  },
  uploadButtonPressed: {
    opacity: 0.9,
  },
  uploadButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  manageSection: {
    marginTop: 8,
  },
  manageList: {
    marginTop: 8,
    gap: 12,
  },
  manageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 8,
  },
  manageInfo: {
    flex: 1,
    marginRight: 12,
  },
  manageTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  manageMeta: {
    fontSize: 13,
    color: '#888',
  },
  manageActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  manageStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  manageStatusBadgeActive: {
    backgroundColor: '#064e3b',
  },
  manageStatusBadgeTrash: {
    backgroundColor: '#7f1d1d',
  },
  manageStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f9fafb',
    textTransform: 'uppercase',
  },
  manageButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  manageButtonSecondary: {
    backgroundColor: '#374151',
  },
  manageButtonTrash: {
    backgroundColor: '#b91c1c',
  },
  manageButtonRestore: {
    backgroundColor: '#16a34a',
  },
  manageButtonPressed: {
    opacity: 0.9,
  },
  manageButtonDisabled: {
    opacity: 0.7,
  },
  manageButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  manageEmptyText: {
    fontSize: 14,
    color: '#888',
    marginTop: 12,
  },
  manageSubsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 8,
    marginBottom: 8,
  },
  manageThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
    marginRight: 12,
  },
  manageThumbImage: {
    width: '100%',
    height: '100%',
  },
  manageThumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSection: {
    marginTop: 8,
  },
  editHintText: {
    fontSize: 13,
    color: '#888',
    marginBottom: 16,
  },
  editMovieTitle: {
    fontWeight: '600',
    color: '#fff',
  },
  editActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4b5563',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  editCancelButtonPressed: {
    opacity: 0.9,
  },
  editCancelButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#e5e7eb',
  },
  editSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e50914',
  },
  editSaveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
