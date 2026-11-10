export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

type MemoryEntry = { value: string; expires: number };

export function memoryCache(): CacheStore {
  const entries = new Map<string, MemoryEntry>();
  return {
    async get(key) {
      const hit = entries.get(key);
      if (!hit) return null;
      if (hit.expires < Date.now()) {
        entries.delete(key);
        return null;
      }
      return hit.value;
    },
    async set(key, value, ttlSeconds) {
      entries.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
      if (entries.size > 200) {
        const oldest = entries.keys().next().value;
        if (oldest) entries.delete(oldest);
      }
    },
  };
}

type NamedCache = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
};

type CacheStorageLike = {
  open(name: string): Promise<NamedCache>;
};

function workerCaches(): CacheStorageLike | null {
  const scope = globalThis as { caches?: CacheStorageLike };
  return scope.caches ?? null;
}

function cacheRequest(key: string): Request {
  return new Request(`https://alive-maps.internal/cache/${encodeURIComponent(key)}`);
}

/** Workers Cache API. Misses are normal; write failures are ignored. */
export function workersCache(): CacheStore {
  return {
    async get(key) {
      const storage = workerCaches();
      if (!storage) return null;
      try {
        const cache = await storage.open("alive-maps");
        const hit = await cache.match(cacheRequest(key));
        return hit ? hit.text() : null;
      } catch (err) {
        console.warn(JSON.stringify({ event: "cache_read_failed", message: errorMessage(err) }));
        return null;
      }
    },
    async set(key, value, ttlSeconds) {
      const storage = workerCaches();
      if (!storage) return;
      try {
        const cache = await storage.open("alive-maps");
        await cache.put(
          cacheRequest(key),
          new Response(value, {
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": `public, max-age=${ttlSeconds}`,
            },
          }),
        );
      } catch (err) {
        console.warn(JSON.stringify({ event: "cache_write_failed", message: errorMessage(err) }));
      }
    },
  };
}

export async function cachedJson<T>(
  cache: CacheStore,
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  const hit = await cache.get(key);
  if (hit) {
    try {
      return JSON.parse(hit) as T;
    } catch {
      // Refetch when a cached body is not JSON.
    }
  }
  const value = await load();
  try {
    await cache.set(key, JSON.stringify(value), ttlSeconds);
  } catch (err) {
    console.warn(JSON.stringify({ event: "cache_write_failed", message: errorMessage(err) }));
  }
  return value;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
