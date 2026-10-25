import { File } from 'expo-file-system';

function isPickerCacheUri(uri: string): boolean {
  const normalized = decodeURIComponent(uri).toLowerCase();
  return normalized.startsWith('file://') &&
    (normalized.includes('/cache/') || normalized.includes('/caches/'));
}

export async function deletePickerCacheFiles(uris: readonly string[]): Promise<void> {
  await Promise.all(
    [...new Set(uris)].map(async (uri) => {
      if (!isPickerCacheUri(uri)) return;
      try {
        const file = new File(uri);
        if (file.exists) file.delete();
      } catch {
        // A picker or the operating system may have already removed its temporary file.
      }
    }),
  );
}
