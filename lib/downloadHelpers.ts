import * as FileSystem from 'expo-file-system/legacy';
import { Alert, Platform } from 'react-native';

export const DOWNLOAD_DIR = FileSystem.documentDirectory;
export const RESUMABLE_SNAPSHOT_KEY = (id: string) => `download_snapshot_${id}`;
export const MIN_VALID_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB minimum for a valid movie

export function buildMp4Url(videoUrl: string): string {
  try {
    const parsed = new URL(videoUrl);
    
    // 1. Handle Legacy Mux Links
    if (parsed.hostname === 'stream.mux.com') {
      const cleanPath = parsed.pathname.replace(/\.m3u8$/, '');
      parsed.pathname = `${cleanPath}/highest.mp4`;
      parsed.search = ''; 
      return parsed.toString();
    }
    
    // 2. Handle New Bunny Stream Links
    const host = parsed.hostname.toLowerCase();
    if (host === 'b-cdn.net' || host.endsWith('.b-cdn.net')) {
      // Bunny generates specific resolution files when MP4 Fallback is enabled.
      // We default to 720p as it is the perfect balance of high quality and decent file size for mobile.
      const cleanPath = parsed.pathname.replace(/\/playlist\.m3u8$/, '');
      parsed.pathname = `${cleanPath}/play_720p.mp4`;
      parsed.search = '';
      return parsed.toString();
    }
    
  } catch {}
  return videoUrl;
}

export function getLocalFilePath(targetId: string): string {
  return `${DOWNLOAD_DIR}${targetId}.mp4`;
}

export function showDownloadError(title: string, technicalError: string, isAdmin: boolean): void {
  if (isAdmin) {
    const msg = `Movie: "${title}"\n\nTechnical detail:\n${technicalError}`;
    if (Platform.OS === 'web') window.alert(`[Admin] Download Failed\n\n${msg}`);
    else Alert.alert(`🛠️ [Admin] Download Failed`, msg, [{ text: 'OK' }]);
  } else {
    const msg = `We couldn't download "${title}" right now. Please check your connection and try again.`;
    if (Platform.OS === 'web') window.alert(`Download Failed\n\n${msg}`);
    else Alert.alert('Download Failed', msg, [{ text: 'OK' }]);
  }
}

export async function deleteLocalFile(localUri: string, movieId: string): Promise<boolean> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
    }
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.removeItem(RESUMABLE_SNAPSHOT_KEY(movieId));
    return true;
  } catch (e) {
    console.error('[Downloads] Failed to delete local file:', e);
    return false;
  }
}