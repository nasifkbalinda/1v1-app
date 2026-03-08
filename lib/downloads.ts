import AsyncStorage from '@react-native-async-storage/async-storage';

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

export async function removeDownloadedMovie(movieId: string): Promise<void> {
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
