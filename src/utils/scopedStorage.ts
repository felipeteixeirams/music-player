export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * A view of localStorage where every key belongs to one user, so two people signing in on the same device never
 * see each other's favorites and playlists. Without a user (login off) the keys are the plain ones.
 */
export function scopedStorage(userId: string | null, backing?: KeyValueStorage): KeyValueStorage {
  const store = () => backing ?? localStorage;
  const scoped = (key: string) => (userId ? `${key}:${userId}` : key);
  return {
    getItem: (key) => store().getItem(scoped(key)),
    setItem: (key, value) => store().setItem(scoped(key), value),
    removeItem: (key) => store().removeItem(scoped(key))
  };
}
