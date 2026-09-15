/**
 * Клиентский кэш в IndexedDB для работы в оффлайн-режиме
 */

const DB_NAME = 'metrolog-manage-cache';
const DB_VERSION = 1;
const STORES = {
  GOSREESTR_CARDS: 'gosreestr_cards',
  SETTINGS: 'settings',
};

interface CachedCard {
  id: string;
  data: any;
  timestamp: number;
}

interface Setting {
  key: string;
  value: any;
  timestamp: number;
}

class IndexedDBCache {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORES.GOSREESTR_CARDS)) {
          db.createObjectStore(STORES.GOSREESTR_CARDS, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }
      };
    });
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    if (!this.db) {
      await this.init();
    }
    const transaction = this.db!.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // === Gosreestr Cards Cache ===

  async cacheCard(id: string, data: any): Promise<void> {
    const store = await this.getStore(STORES.GOSREESTR_CARDS, 'readwrite');
    const card: CachedCard = {
      id,
      data,
      timestamp: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const request = store.put(card);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getCachedCard(id: string): Promise<CachedCard | null> {
    const store = await this.getStore(STORES.GOSREESTR_CARDS);
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getStaleCards(maxAgeDays: number = 30): Promise<CachedCard[]> {
    const store = await this.getStore(STORES.GOSREESTR_CARDS);
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    const threshold = Date.now() - maxAge;

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cards = request.result as CachedCard[];
        const stale = cards.filter(card => card.timestamp < threshold);
        resolve(stale);
      };
    });
  }

  async getAllCachedCards(): Promise<CachedCard[]> {
    const store = await this.getStore(STORES.GOSREESTR_CARDS);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  // === Settings ===

  async setSetting(key: string, value: any): Promise<void> {
    const store = await this.getStore(STORES.SETTINGS, 'readwrite');
    const setting: Setting = {
      key,
      value,
      timestamp: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const request = store.put(setting);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getSetting(key: string): Promise<any | null> {
    const store = await this.getStore(STORES.SETTINGS);
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result?.value || null);
    });
  }

  // === Snapshot Import/Export ===

  async exportSnapshot(): Promise<any> {
    const cards = await this.getAllCachedCards();
    const settings: Setting[] = [];
    
    const settingsStore = await this.getStore(STORES.SETTINGS);
    const allSettings = await new Promise<Setting[]>((resolve, reject) => {
      const request = settingsStore.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
    settings.push(...allSettings);

    return {
      version: DB_VERSION,
      timestamp: Date.now(),
      cards,
      settings,
    };
  }

  async importSnapshot(snapshot: any): Promise<void> {
    if (snapshot.version !== DB_VERSION) {
      throw new Error('Incompatible snapshot version');
    }

    // Import cards
    for (const card of snapshot.cards || []) {
      await this.cacheCard(card.id, card.data);
    }

    // Import settings
    for (const setting of snapshot.settings || []) {
      await this.setSetting(setting.key, setting.value);
    }
  }

  // === Cleanup ===

  async clearAll(): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(
      [STORES.GOSREESTR_CARDS, STORES.SETTINGS],
      'readwrite'
    );

    transaction.objectStore(STORES.GOSREESTR_CARDS).clear();
    transaction.objectStore(STORES.SETTINGS).clear();

    return new Promise((resolve, reject) => {
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  }
}

export const indexedDBCache = new IndexedDBCache();
