export interface CacheEntry<T> {
  value: T
  fetchedAt: string
  expiresAt: string
  stale?: boolean
}

export interface CacheStore<T> {
  get(key: string): CacheEntry<T> | undefined
  set(key: string, entry: CacheEntry<T>): CacheEntry<T>
  delete(key: string): void
  clear(): void
}

export function createMemoryCache<T>(): CacheStore<T> {
  const entries = new Map<string, CacheEntry<T>>()

  return {
    get(key) {
      return entries.get(key)
    },
    set(key, entry) {
      entries.set(key, entry)
      return entry
    },
    delete(key) {
      entries.delete(key)
    },
    clear() {
      entries.clear()
    },
  }
}
