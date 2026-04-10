import { hasExtensionBookmarks } from './env';

const MOCK_PREFIX = 'windesk-mock-storage:';

export type StorageAreaGet = (keys: string | string[] | null) => Promise<Record<string, unknown>>;

export type StorageAreaSet = (items: Record<string, unknown>) => Promise<void>;

export type StorageAreaRemove = (keys: string | string[]) => Promise<void>;

function mockGet(keys: string | string[] | null): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const keyList =
    keys === null
      ? Object.keys(localStorage)
          .filter((k) => k.startsWith(MOCK_PREFIX))
          .map((k) => k.slice(MOCK_PREFIX.length))
      : Array.isArray(keys)
        ? keys
        : [keys];
  for (const k of keyList) {
    const raw = localStorage.getItem(MOCK_PREFIX + k);
    if (raw != null) {
      try {
        out[k] = JSON.parse(raw) as unknown;
      } catch {
        out[k] = raw;
      }
    }
  }
  return Promise.resolve(out);
}

function mockSet(items: Record<string, unknown>): Promise<void> {
  for (const [k, v] of Object.entries(items)) {
    localStorage.setItem(MOCK_PREFIX + k, JSON.stringify(v));
  }
  return Promise.resolve();
}

function mockRemove(keys: string | string[]): Promise<void> {
  const list = Array.isArray(keys) ? keys : [keys];
  for (const k of list) {
    localStorage.removeItem(MOCK_PREFIX + k);
  }
  return Promise.resolve();
}

/** chrome.storage.local with dev fallback to prefixed localStorage. */
export const storageLocal: {
  get: StorageAreaGet;
  set: StorageAreaSet;
  remove: StorageAreaRemove;
} = {
  get: (keys) => {
    if (hasExtensionBookmarks() && chrome.storage?.local) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get(keys, (r) => {
          const err = chrome.runtime?.lastError;
          if (err) reject(new Error(err.message));
          else resolve(r as Record<string, unknown>);
        });
      });
    }
    return mockGet(keys);
  },
  set: (items) => {
    if (hasExtensionBookmarks() && chrome.storage?.local) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.set(items, () => {
          const err = chrome.runtime?.lastError;
          if (err) reject(new Error(err.message));
          else resolve();
        });
      });
    }
    return mockSet(items);
  },
  remove: (keys) => {
    if (hasExtensionBookmarks() && chrome.storage?.local) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.remove(keys, () => {
          const err = chrome.runtime?.lastError;
          if (err) reject(new Error(err.message));
          else resolve();
        });
      });
    }
    return mockRemove(keys);
  },
};
