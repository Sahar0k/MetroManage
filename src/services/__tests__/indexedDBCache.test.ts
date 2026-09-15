import { describe, it, expect, vi, beforeEach } from 'vitest';

// Базовые тесты для проверки структуры модуля
describe('indexedDBCache', () => {
  it('должен экспортировать indexedDBCache', async () => {
    const module = await import('../indexedDBCache');
    expect(module.indexedDBCache).toBeDefined();
    expect(typeof module.indexedDBCache.init).toBe('function');
    expect(typeof module.indexedDBCache.cacheCard).toBe('function');
    expect(typeof module.indexedDBCache.getCachedCard).toBe('function');
    expect(typeof module.indexedDBCache.exportSnapshot).toBe('function');
    expect(typeof module.indexedDBCache.importSnapshot).toBe('function');
  });

  it('должен иметь правильную структуру методов', async () => {
    const module = await import('../indexedDBCache');
    const cache = module.indexedDBCache;
    
    expect(cache).toHaveProperty('init');
    expect(cache).toHaveProperty('cacheCard');
    expect(cache).toHaveProperty('getCachedCard');
    expect(cache).toHaveProperty('getStaleCards');
    expect(cache).toHaveProperty('getAllCachedCards');
    expect(cache).toHaveProperty('setSetting');
    expect(cache).toHaveProperty('getSetting');
    expect(cache).toHaveProperty('exportSnapshot');
    expect(cache).toHaveProperty('importSnapshot');
    expect(cache).toHaveProperty('clearAll');
  });
});
