/**
 * Сервис для работы с Госреестром СИ (fgis.gost.ru)
 * Все запросы через прокси /api/gosreestr
 */

import { indexedDBCache } from './indexedDBCache';

export interface GosreestrHint {
  id: string;
  name: string;
  designation: string;
  number: string;
  manufacturer: string;
}

export interface GosreestrCard {
  id: string;
  name: string;
  type: string;
  gosreestrNumber: string;
  manufacturer: string;
  intervalMonths: number | null;
  status: string;
  descriptionLink?: string;
  methodLink?: string;
}

interface APIProperty {
  name: string;
  type: string;
  value: string | string[];
  link?: string;
  mime?: string;
}

interface APIItem {
  id: string;
  type: string;
  properties: APIProperty[];
}

interface APIResponse {
  status: string;
  result: {
    totalCount: number;
    items: APIItem[];
  };
}

// Rate limiting
let lastRequestTime = 0;
const RATE_LIMIT_MS = 1000;

// Кэш
const hintsCache = new Map<string, { data: GosreestrHint[]; timestamp: number }>();
const cardsCache = new Map<string, { data: GosreestrCard; timestamp: number }>();
const HINTS_TTL = 24 * 60 * 60 * 1000; // 24 часа
const CARDS_TTL = 7 * 24 * 60 * 60 * 1000; // 7 дней

/**
 * Построение параметров запроса для поиска
 */
function buildQueryParams(query: string, page: number = 1, pageSize: number = 10): string {
  const params = new URLSearchParams();
  params.append('pageNumber', page.toString());
  params.append('pageSize', pageSize.toString());
  
  // Определяем тип поиска
  const isExactNumber = /^\d{1,5}-\d{2}$/.test(query);
  
  if (isExactNumber) {
    // Точный поиск по номеру в реестре
    params.append('filter[0].field', 'foei:NumberSI');
    params.append('filter[0].operator', 'eq');
    params.append('filter[0].value', query);
  } else {
    // Текстовый поиск по наименованию и обозначению
    params.append('search', query);
  }
  
  return params.toString();
}

/**
 * Парсинг МПИ из строки
 */
export function parseMPI(mpiString: string): number | null {
  if (!mpiString || mpiString.trim() === '') return null;
  
  const str = mpiString.toLowerCase().trim();
  
  // "4 года" -> 48
  const yearsMatch = str.match(/(\d+)\s*год/);
  if (yearsMatch) {
    return parseInt(yearsMatch[1]) * 12;
  }
  
  // "24 месяца" -> 24
  const monthsMatch = str.match(/(\d+)\s*мес/);
  if (monthsMatch) {
    return parseInt(monthsMatch[1]);
  }
  
  // "6 мес" -> 6
  const shortMonthsMatch = str.match(/(\d+)\s*мес/);
  if (shortMonthsMatch) {
    return parseInt(shortMonthsMatch[1]);
  }
  
  return null;
}

/**
 * Извлечение свойства из карточки
 */
function getProperty(properties: APIProperty[], name: string): string | null {
  const prop = properties.find(p => p.name === name);
  if (!prop) return null;
  
  if (Array.isArray(prop.value)) {
    return prop.value[0] || null;
  }
  
  return prop.value || null;
}

/**
 * Извлечение ссылки на вложение
 */
function getAttachmentLink(properties: APIProperty[], name: string): string | undefined {
  const prop = properties.find(p => p.name === name && p.link);
  return prop?.link;
}

/**
 * Rate limiting
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
}

/**
 * Поиск по запросу
 */
export async function searchByQuery(
  query: string,
  signal?: AbortSignal
): Promise<GosreestrHint[]> {
  if (!query || query.length < 3) return [];
  
  // Проверка кэша
  const cached = hintsCache.get(query);
  if (cached && Date.now() - cached.timestamp < HINTS_TTL) {
    return cached.data;
  }
  
  try {
    await waitForRateLimit();
    
    const params = buildQueryParams(query);
    const response = await fetch(`/api/gosreestr/api/registry/4/data?${params}`, {
      signal,
      headers: {
        'User-Agent': 'Metrolog-Manage/1.0',
      },
    });
    
    if (!response.ok) {
      if (response.status === 429) {
        // Rate limit exceeded, retry after backoff
        await new Promise(resolve => setTimeout(resolve, 2000));
        return searchByQuery(query, signal);
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data: APIResponse = await response.json();
    
    const hints: GosreestrHint[] = data.result.items.map(item => ({
      id: item.id,
      name: getProperty(item.properties, 'foei:NameSI') || '',
      designation: getProperty(item.properties, 'foei:DesignationSI') || '',
      number: getProperty(item.properties, 'foei:NumberSI') || '',
      manufacturer: getProperty(item.properties, 'foei:ManufacturerTotalSI') || '',
    }));
    
    // Сохраняем в кэш
    hintsCache.set(query, { data: hints, timestamp: Date.now() });
    
    return hints;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    // Graceful fallback
    console.error('Gosreestr search error:', error);
    return [];
  }
}

/**
 * Получение полной карточки
 */
export async function fetchCard(
  id: string,
  signal?: AbortSignal
): Promise<GosreestrCard | null> {
  // Проверка кэша
  const cached = cardsCache.get(id);
  if (cached && Date.now() - cached.timestamp < CARDS_TTL) {
    return cached.data;
  }
  
  try {
    await waitForRateLimit();
    
    const response = await fetch(`/api/gosreestr/api/registry/4/items/${id}/plaindata`, {
      signal,
      headers: {
        'User-Agent': 'Metrolog-Manage/1.0',
      },
    });
    
    if (!response.ok) {
      if (response.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return fetchCard(id, signal);
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data: APIResponse = await response.json();
    const item = data.result.items[0];
    
    if (!item) return null;
    
    const mpiString = getProperty(item.properties, 'foei:MPISI') || '';
    const yearString = getProperty(item.properties, 'foei:YearSI') || '';
    
    let intervalMonths = parseMPI(mpiString);
    if (intervalMonths === null && yearString) {
      const year = parseInt(yearString);
      if (!isNaN(year)) {
        const currentYear = new Date().getFullYear();
        intervalMonths = (currentYear - year) * 12;
      }
    }
    
    const card: GosreestrCard = {
      id: item.id,
      name: getProperty(item.properties, 'foei:NameSI') || '',
      type: getProperty(item.properties, 'foei:DesignationSI') || '',
      gosreestrNumber: getProperty(item.properties, 'foei:NumberSI') || '',
      manufacturer: getProperty(item.properties, 'foei:ManufacturerTotalSI') || '',
      intervalMonths,
      status: getProperty(item.properties, 'foei:StatusSI') || '',
      descriptionLink: getAttachmentLink(item.properties, 'foei:DescriptionSI'),
      methodLink: getAttachmentLink(item.properties, 'foei:MethodVerifSI'),
    };
    
    // Сохраняем в кэш
    cardsCache.set(id, { data: card, timestamp: Date.now() });
    
    return card;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    console.error('Gosreestr fetch card error:', error);
    return null;
  }
}

/**
 * Скачивание вложения
 */
export async function downloadAttachment(
  link: string,
  signal?: AbortSignal
): Promise<Blob | null> {
  try {
    await waitForRateLimit();
    
    const response = await fetch(`/api/gosreestr${link}`, {
      signal,
      headers: {
        'User-Agent': 'Metrolog-Manage/1.0',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.blob();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    console.error('Gosreestr download error:', error);
    return null;
  }
}

/**
 * Маппинг карточки Госреестра в поля формы СИ
 */
export function mapToInstrument(card: GosreestrCard): Partial<{
  name: string;
  type: string;
  manufacturer: string;
  intervalMonths: number;
}> {
  return {
    name: card.name,
    type: card.type,
    manufacturer: card.manufacturer,
    intervalMonths: card.intervalMonths || 12,
  };
}

/**
 * Очистка кэша
 */
export function clearCache(): void {
  hintsCache.clear();
  cardsCache.clear();
}

// === Настройка доступа к Госреестру ===

const SETTINGS_KEY = 'gosreestr_access_enabled';

/**
 * Проверка, включён ли доступ к Госреестру
 */
export async function isGosreestrAccessEnabled(): Promise<boolean> {
  try {
    const enabled = await indexedDBCache.getSetting(SETTINGS_KEY);
    return enabled !== false; // По умолчанию включено
  } catch {
    return true;
  }
}

/**
 * Установка настройки доступа к Госреестру
 */
export async function setGosreestrAccessEnabled(enabled: boolean): Promise<void> {
  await indexedDBCache.setSetting(SETTINGS_KEY, enabled);
}

/**
 * Поиск с поддержкой клиентского кэша
 */
export async function searchByQueryWithCache(
  query: string,
  signal?: AbortSignal
): Promise<{ hints: GosreestrHint[]; fromCache: boolean; cacheDate?: number }> {
  // Проверка настройки доступа
  const accessEnabled = await isGosreestrAccessEnabled();
  
  if (!accessEnabled) {
    return { hints: [], fromCache: false };
  }

  try {
    // Попытка получить из сети
    const hints = await searchByQuery(query, signal);
    
    // Кэшируем результаты в IndexedDB
    if (hints.length > 0) {
      await indexedDBCache.cacheCard(`search:${query}`, hints);
    }
    
    return { hints, fromCache: false };
  } catch (error) {
    // При ошибке сети пытаемся получить из кэша
    try {
      const cached = await indexedDBCache.getCachedCard(`search:${query}`);
      if (cached) {
        return { 
          hints: cached.data, 
          fromCache: true, 
          cacheDate: cached.timestamp 
        };
      }
    } catch {
      // Игнорируем ошибки кэша
    }
    
    return { hints: [], fromCache: false };
  }
}

/**
 * Получение карточки с поддержкой клиентского кэша
 */
export async function fetchCardWithCache(
  id: string,
  signal?: AbortSignal
): Promise<{ card: GosreestrCard | null; fromCache: boolean; cacheDate?: number }> {
  // Проверка настройки доступа
  const accessEnabled = await isGosreestrAccessEnabled();
  
  if (!accessEnabled) {
    // Пытаемся получить из кэша
    try {
      const cached = await indexedDBCache.getCachedCard(id);
      if (cached) {
        return { 
          card: cached.data, 
          fromCache: true, 
          cacheDate: cached.timestamp 
        };
      }
    } catch {
      // Игнорируем ошибки кэша
    }
    return { card: null, fromCache: false };
  }

  try {
    // Попытка получить из сети
    const card = await fetchCard(id, signal);
    
    // Кэшируем в IndexedDB
    if (card) {
      await indexedDBCache.cacheCard(id, card);
    }
    
    return { card, fromCache: false };
  } catch (error) {
    // При ошибке сети пытаемся получить из кэша
    try {
      const cached = await indexedDBCache.getCachedCard(id);
      if (cached) {
        return { 
          card: cached.data, 
          fromCache: true, 
          cacheDate: cached.timestamp 
        };
      }
    } catch {
      // Игнорируем ошибки кэша
    }
    
    return { card: null, fromCache: false };
  }
}

/**
 * Проверка свежести кэша при старте приложения
 */
export async function checkCacheFreshness(
  onProgress?: (current: number, total: number) => void
): Promise<{ checked: number; updated: number }> {
  const accessEnabled = await isGosreestrAccessEnabled();
  if (!accessEnabled) {
    return { checked: 0, updated: 0 };
  }

  try {
    const staleCards = await indexedDBCache.getStaleCards(30);
    const limit = Math.min(staleCards.length, 20); // Лимит 20 проверок за старт
    
    let updated = 0;
    
    for (let i = 0; i < limit; i++) {
      const card = staleCards[i];
      
      // Пропускаем поисковые запросы
      if (card.id.startsWith('search:')) continue;
      
      onProgress?.(i + 1, limit);
      
      try {
        await waitForRateLimit();
        
        const response = await fetch(`/api/gosreestr/api/registry/4/items/${card.id}/plaindata`, {
          headers: {
            'User-Agent': 'Metrolog-Manage/1.0',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          const item = data.result.items[0];
          
          if (item) {
            // Обновляем только статус
            const statusProp = item.properties.find((p: any) => p.name === 'foei:StatusSI');
            if (statusProp) {
              const updatedCard = { ...card.data, status: statusProp.value };
              await indexedDBCache.cacheCard(card.id, updatedCard);
              updated++;
            }
          }
        }
      } catch (error) {
        // Игнорируем ошибки, продолжаем проверку
        console.error('Freshness check error:', error);
      }
    }
    
    return { checked: limit, updated };
  } catch (error) {
    console.error('Cache freshness check failed:', error);
    return { checked: 0, updated: 0 };
  }
}
