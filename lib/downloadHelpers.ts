import * as FileSystem from 'expo-file-system/legacy';
import { Alert, Platform } from 'react-native';

// Minimum size to ensure we didn't just download a broken/empty file
export const MIN_VALID_FILE_SIZE_BYTES = 1024; 

// Key for AsyncStorage to keep track of paused downloads
export const RESUMABLE_SNAPSHOT_KEY = (id: string) => `@resumable_download_${id}`;

// Standardized local file path generator
export const getLocalFilePath = (id: string) => {
  return `${FileSystem.documentDirectory}movie_${id}.mp4`;
};

// Converts the streaming URL into a direct MP4 download URL for Bunny CDN
export const buildMp4Url = (videoUrl: string) => {
  if (!videoUrl) return '';
  
  // If it's a Bunny stream, change the m3u8 playlist to the raw 720p mp4 file
  if (videoUrl.includes('b-cdn.net') && videoUrl.includes('.m3u8')) {
    return videoUrl.replace('playlist.m3u8', 'play_720p.mp4');
  }
  
  return videoUrl;
};

// Safely deletes the physical file from the device
export const deleteLocalFile = async (localUri: string, targetId: string): Promise<boolean> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
    }
    return true;
  } catch (error) {
    console.error('Error deleting local file:', error);
    return false;
  }
};

// Smart error handler that gives more info to admins
export const showDownloadError = (title: string, technicalMessage: string, isAdmin: boolean) => {
  const errorMessage = isAdmin ? technicalMessage : 'Please try again later. Make sure you have a stable internet connection.';
  
  if (Platform.OS === 'web') {
    window.alert(`Failed to download "${title}".\n\n${errorMessage}`);
  } else {
    Alert.alert(
      'Download Failed',
      `Could not download "${title}".\n\n${errorMessage}`
    );
  }
};