import { dehydrate, hydrate, type QueryClient } from '@tanstack/react-query';

const STORAGE_KEY = 'skilltopia-query-cache';

type PersistedQueryCache = ReturnType<typeof dehydrate>;

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function hydrateQueryCache(queryClient: QueryClient): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const serialized = storage.getItem(STORAGE_KEY);
    if (!serialized) return;

    hydrate(queryClient, JSON.parse(serialized) as PersistedQueryCache);
  } catch {
    storage.removeItem(STORAGE_KEY);
  }
}

export function persistQueryCache(queryClient: QueryClient): () => void {
  const storage = getStorage();
  if (!storage) return () => undefined;

  const unsubscribe = queryClient.getQueryCache().subscribe(() => {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(dehydrate(queryClient)));
    } catch {
      // Cache persistence is best effort; in-memory queries remain available.
    }
  });

  return unsubscribe;
}
