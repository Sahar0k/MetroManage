/**
 * Storage Adapter Factory
 * Создаёт и управляет адаптерами хранилища данных
 */

import { StorageAdapter } from './StorageAdapter';
import { LocalStorageAdapter } from './localAdapter';
import { PocketBaseAdapter } from './pocketbaseAdapter';

export type StorageSourceType = 'local' | 'pocketbase';

export interface StorageConfig {
  type: StorageSourceType;
  pocketbaseUrl?: string;
}

const STORAGE_CONFIG_KEY = 'mk_storage_config';

let currentAdapter: StorageAdapter | null = null;
let currentConfig: StorageConfig | null = null;

/**
 * Получить текущую конфигурацию хранилища
 */
export function getStorageConfig(): StorageConfig {
  if (currentConfig) return currentConfig;
  
  const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
  if (saved) {
    currentConfig = JSON.parse(saved);
    return currentConfig!;
  }
  
  // По умолчанию используем localStorage
  currentConfig = { type: 'local' };
  return currentConfig;
}

/**
 * Сохранить конфигурацию хранилища
 */
export function setStorageConfig(config: StorageConfig): void {
  currentConfig = config;
  localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
  currentAdapter = null; // Сбросить текущий адаптер
}

/**
 * Получить текущий адаптер хранилища
 */
export function getStorageAdapter(): StorageAdapter {
  if (currentAdapter) return currentAdapter;
  
  const config = getStorageConfig();
  
  if (config.type === 'pocketbase' && config.pocketbaseUrl) {
    currentAdapter = new PocketBaseAdapter(config.pocketbaseUrl);
  } else {
    currentAdapter = new LocalStorageAdapter();
  }
  
  return currentAdapter;
}

/**
 * Переключить источник данных
 */
export async function switchStorageSource(type: StorageSourceType, pocketbaseUrl?: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (type === 'pocketbase') {
      if (!pocketbaseUrl) {
        return { success: false, error: 'URL сервера не указан' };
      }
      
      const testAdapter = new PocketBaseAdapter(pocketbaseUrl);
      const isConnected = await testAdapter.isConnected();
      
      if (!isConnected) {
        return { success: false, error: 'Сервер недоступен' };
      }
      
      setStorageConfig({ type: 'pocketbase', pocketbaseUrl });
    } else {
      setStorageConfig({ type: 'local' });
    }
    
    currentAdapter = null; // Сбросить текущий адаптер
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    };
  }
}

/**
 * Проверить соединение с сервером
 */
export async function checkServerConnection(url: string): Promise<{ success: boolean; version?: string; error?: string }> {
  try {
    const adapter = new PocketBaseAdapter(url);
    return await adapter.checkConnection();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    };
  }
}

/**
 * Получить статистику хранилища
 */
export async function getStorageStats(): Promise<{ local: number; remote: number }> {
  const adapter = getStorageAdapter();
  return await adapter.getStats();
}

// Экспорты
export type { StorageAdapter } from './StorageAdapter';
export { LocalStorageAdapter } from './localAdapter';
export { PocketBaseAdapter } from './pocketbaseAdapter';
