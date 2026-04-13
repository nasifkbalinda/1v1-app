import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const DOWNLOADS_KEY = '@movie_downloads';

export type DownloadedMovie = {
  id: string;
  title: string;
  poster_url: string | null;
  localUri: string;
};

export async function getDownloadedMovies(): Promise<DownloadedMovie[]> {
  try {
    const raw = await AsyncStorage.getItem(DOWNLOADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DownloadedMovie[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addDownloadedMovie(movie: DownloadedMovie): Promise<void> {
  const list = await getDownloadedMovies();
  const filtered = list.filter((m) => m.id !== movie.id);
  await AsyncStorage.setItem(
    DOWNLOADS_KEY,
    JSON.stringify([...filtered, movie])
  );
}

// FIXED: Now physically deletes the video file from the device storage to prevent memory leaks
export async function removeDownloadedMovie(movieId: string, localUri?: string): Promise<void> {
  try {
    // 1. If a localUri is provided, check if it exists and delete the actual video file
    if (localUri) {
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(localUri, { idempotent: true });
      }
    }
  } catch (error) {
    console.error("Error deleting physical file:", error);
  }

  // 2. Remove the record from AsyncStorage
  const list = await getDownloadedMovies();
  await AsyncStorage.setItem(
    DOWNLOADS_KEY,
    JSON.stringify(list.filter((m) => m.id !== movieId))
  );
}

export async function isMovieDownloaded(movieId: string): Promise<boolean> {
  const list = await getDownloadedMovies();
  return list.some((m) => m.id === movieId);
}

export async function getDownloadedMovie(
  movieId: string
): Promise<DownloadedMovie | null> {
  const list = await getDownloadedMovies();
  return list.find((m) => m.id === movieId) ?? null;
}