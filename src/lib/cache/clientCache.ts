/**
 * Tiny in-memory client cache with in-flight dedupe + TTL.
 * Survives tab navigations within the same SPA session (Feed ↔ Map).
 */

type Entry<T> = {
  data?: T;
  fetchedAt: number;
  promise?: Promise<T>;
};

const store = new Map<string, Entry<unknown>>();

const DEFAULT_TTL_MS = 60_000;

export function cachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const existing = store.get(key) as Entry<T> | undefined;
  const now = Date.now();

  if (existing?.data !== undefined && now - existing.fetchedAt < ttlMs) {
    return Promise.resolve(existing.data);
  }

  if (existing?.promise) {
    return existing.promise;
  }

  const promise = fetcher()
    .then((data) => {
      store.set(key, { data, fetchedAt: Date.now() });
      return data;
    })
    .catch((err) => {
      const current = store.get(key) as Entry<T> | undefined;
      // Keep stale data on error; drop the failed in-flight promise.
      if (current?.data !== undefined) {
        store.set(key, { data: current.data, fetchedAt: current.fetchedAt });
      } else {
        store.delete(key);
      }
      throw err;
    });

  store.set(key, {
    data: existing?.data,
    fetchedAt: existing?.fetchedAt ?? 0,
    promise,
  });

  return promise;
}

export function invalidateCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(keyPrefix)) store.delete(key);
  }
}

export function peekCache<T>(key: string): T | undefined {
  return (store.get(key) as Entry<T> | undefined)?.data;
}
