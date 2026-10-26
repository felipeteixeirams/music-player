import assert from 'node:assert';
import { test, describe, beforeEach } from 'node:test';
import {
  getOfflineTrackIds,
  isTrackOfflineAvailable,
  downloadTrackForOffline,
  removeOfflineTrack
} from './offlineManager';
import { Track } from '../types/music';
import { scopedStorage } from './scopedStorage';

// Mock localStorage and window.caches in Node test context
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string) {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = value.toString();
  }

  removeItem(key: string) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }
}

const mockCacheStorage = {
  open: async (cacheName: string) => ({
    put: async (url: string, response: any) => {},
    delete: async (url: string) => true,
    match: async (url: string) => null
  })
};

// Global mocks
(global as any).localStorage = new LocalStorageMock();
(global as any).window = {
  caches: mockCacheStorage
};
(global as any).caches = mockCacheStorage;

describe('Offline Manager Unit Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('getOfflineTrackIds returns empty array when nothing is stored', () => {
    const ids = getOfflineTrackIds();
    assert.deepStrictEqual(ids, []);
  });

  test('isTrackOfflineAvailable checks if track id exists in storage', () => {
    const trackId = 'test-track-123';
    assert.strictEqual(isTrackOfflineAvailable(trackId), false);

    localStorage.setItem('aurastream_offline_track_ids', JSON.stringify([trackId]));
    assert.strictEqual(isTrackOfflineAvailable(trackId), true);
  });

  test('removeOfflineTrack removes track id from stored array', async () => {
    const trackId = 'test-track-456';
    localStorage.setItem('aurastream_offline_track_ids', JSON.stringify([trackId]));
    assert.strictEqual(isTrackOfflineAvailable(trackId), true);

    const success = await removeOfflineTrack(trackId);
    assert.strictEqual(success, true);
    assert.strictEqual(isTrackOfflineAvailable(trackId), false);
  });

  test('downloadTrackForOffline handles failure gracefully when fetch fails', async () => {
    const sampleTrack: Track = {
      id: 'track-789',
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
      duration: 180,
      coverUrl: 'https://example.com/cover.jpg',
      style: 'Pop',
      categoryId: 'web',
      sources: {
        localUrl: 'https://example.com/audio.mp3',
        youtubeId: 'abc123xyz'
      }
    };

    // Global fetch returning unsuccessful response
    (global as any).fetch = async () => ({
      ok: false,
      status: 404
    });

    const result = await downloadTrackForOffline(sampleTrack);
    assert.strictEqual(result.success, false);
    assert.strictEqual(typeof result.error, 'string');
  });

  test('downloadTrackForOffline caches audio successfully when fetch is ok', async () => {
    const sampleTrack: Track = {
      id: 'track-success-1',
      title: 'Success Song',
      artist: 'Success Artist',
      album: 'Success Album',
      duration: 200,
      coverUrl: 'https://example.com/cover.jpg',
      style: 'Pop',
      categoryId: 'web',
      sources: {
        localUrl: 'https://example.com/audio.mp3',
        youtubeId: 'abc123xyz'
      }
    };

    // Global fetch returning OK response
    (global as any).fetch = async () => ({
      ok: true,
      status: 200
    });

    const result = await downloadTrackForOffline(sampleTrack);
    assert.strictEqual(result.success, true);
    assert.strictEqual(isTrackOfflineAvailable(sampleTrack.id), true);
  });

  test('downloadTrackForOffline stores a catalog preview through the same-origin audio proxy', async () => {
    const previewTrack: Track = {
      id: 'deezer-1',
      title: 'Preview Song',
      artist: 'Artist',
      album: 'Album',
      duration: 200,
      coverUrl: 'https://cdn.example/cover.jpg',
      style: 'Deezer',
      categoryId: 'web',
      sources: { localUrl: '', previewUrl: 'https://cdnt-preview.dzcdn.net/a.mp3?hdnea=x' }
    };

    const requested: string[] = [];
    (global as any).fetch = async (url: string) => {
      requested.push(url);
      return { ok: true, status: 200 };
    };

    // The player is on the YouTube engine, so the "current stream" is a watch URL that must be ignored
    const result = await downloadTrackForOffline(previewTrack, 'https://www.youtube.com/watch?v=abcdefghijk');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.previewOnly, true);
    assert.strictEqual(requested[0], '/api/audio?url=' + encodeURIComponent(previewTrack.sources.previewUrl!));
    assert.strictEqual(isTrackOfflineAvailable('deezer-1'), true);
  });

  test('downloadTrackForOffline explains that YouTube full tracks cannot be downloaded', async () => {
    const fullTrack: Track = {
      id: 'deezer-2',
      title: 'No Preview Song',
      artist: 'Artist',
      album: 'Album',
      duration: 200,
      coverUrl: 'https://cdn.example/cover.jpg',
      style: 'Deezer',
      categoryId: 'web',
      sources: { localUrl: '' }
    };
    (global as any).fetch = async () => {
      throw new Error('no request expected');
    };

    const result = await downloadTrackForOffline(fullTrack, 'https://www.youtube.com/watch?v=abcdefghijk');
    assert.strictEqual(result.success, false);
    assert.match(result.error ?? '', /YouTube/);
    assert.strictEqual(isTrackOfflineAvailable('deezer-2'), false);
  });
});

describe('Downloads por usuário', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('cada usuário lista só os próprios downloads', async () => {
    const ana = scopedStorage('ana');
    const bia = scopedStorage('bia');
    ana.setItem('aurastream_offline_track_ids', JSON.stringify(['t1']));
    assert.strictEqual(isTrackOfflineAvailable('t1', ana), true);
    assert.strictEqual(isTrackOfflineAvailable('t1', bia), false);
    assert.deepStrictEqual(getOfflineTrackIds(bia), []);
  });

  test('o áudio só é apagado do cache quando mais ninguém do aparelho tem a faixa', async () => {
    const deleted: string[] = [];
    const cache = { delete: async (url: string) => (deleted.push(url), true), put: async () => {}, match: async () => null };
    (global as any).caches = (global as any).window.caches = { open: async () => cache };
    // o armazenamento falso precisa de length e key para o código enxergar as listas dos outros usuários
    const real = (global as any).localStorage;
    const store = new Map<string, string>();
    const wrapped = {
      get length() { return store.size; },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k)
    };
    (global as any).localStorage = wrapped;
    try {
      const ana = scopedStorage('ana', wrapped);
      const bia = scopedStorage('bia', wrapped);
      ana.setItem('aurastream_offline_track_ids', JSON.stringify(['t1']));
      bia.setItem('aurastream_offline_track_ids', JSON.stringify(['t1']));

      await removeOfflineTrack('t1', ana);
      assert.deepStrictEqual(deleted, [], 'a Bia ainda tem a faixa: o arquivo fica');
      assert.strictEqual(isTrackOfflineAvailable('t1', ana), false);
      assert.strictEqual(isTrackOfflineAvailable('t1', bia), true);

      await removeOfflineTrack('t1', bia);
      assert.deepStrictEqual(deleted, ['/offline-audio/t1', '/offline-cover/t1']);
    } finally {
      (global as any).localStorage = real;
    }
  });
});
