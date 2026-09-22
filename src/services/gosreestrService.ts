/**
 * Сервис для работы с Госреестром СИ (fgis.gost.ru)
 * Новый эндпоинт: /cm/xcdb/mit24/list
 * Все запросы через прокси /api/gosreestr
 */

import { indexedDBCache } from './indexedDBCache';

// Базовый URL для API
const BASE_URL = '/api/gosreestr';
const LIST_ENDPOINT = '/cm/xcdb/mit24/list';
const DOCS_API_ENDPOINT = '/cm/iaux/docs';

// Константы для rate limiting
const RATE_LIMIT_MS = 1000;
const RETRY_DELAY_MS = 2000;
const FETCH_TIMEOUT_MS = 20000;

// Константы для кэша
const HINTS_TTL = 24 * 60 * 60 * 1000; // 24 часа
const CARDS_TTL = 7 * 24 * 60 * 60 * 1000; // 7 дней
const CACHE_SCHEMA_VERSION = 'mit24:'; // Префикс для новой схемы кэша

// Обязательные заголовки для обхода ботозащиты
const BOT_SAFE_HEADERS = {
  'Accept': 'application/json,text/plain,*/*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://fgis.gost.ru/fundmetrology/cm/mits',
};

// === ТИПЫ ===

export interface GosreestrHint {
  id: string;
  name: string;
  designation: string;
  number: string;
  manufacturer: string;
  isActual: boolean;
}

export interface GosreestrCard {
  id: string;
  name: string;
  type: string;
  gosreestrNumber: string;
  manufacturer: string;
  intervalMonths: number | null;
  status: string;
  isActual: boolean;
  validTo: string | null;
  productionType: 'serial' | 'single' | 'unknown';
  descriptionLink?: string;
  methodLink?: string;
  cardUrl: string;
}

// Типы для ответа API
interface Mit24Doc {
  mit_uuid: string;
  title: string;
  number: string;
  notation?: string;
  manufacturers?: string;
  is_actual?: boolean;
  valid_to?: string;
  production_type?: number;
  j_mpis?: string;
  j_methods?: string;
  j_specifications?: string;
  j_manufacturers?: string;
  j_notation?: string;
}

interface Mit24Response {
  response: {
    numFound: number;
    docs: Mit24Doc[];
  };
}

interface JMPI {
  mpi?: string;
  mpi_text?: string;
}

interface JSpecification {
  doc_uuid?: string;
  doc_name?: string;
}

interface JMethod {
  doc_uuid?: string;
  doc_name?: string;
}

// === УТИЛИТЫ ===

let lastRequestTime = 0;

// Кэш в памяти
const hintsCache = new Map<string, { data: GosreestrHint[]; timestamp: number }>();
const cardsCache = new Map<string, { data: GosreestrCard; timestamp: number }>();

/**
 * Экранирование спецсимволов Lucene
 */
export function escapeLuceneQuery(query: string): string {
  // Спецсимволы Lucene: + - && || ! ( ) { } [ ] ^ " * ? : \ /
  const specialChars = /[+\-&|!(){}[\]^"~*?:\\/]/g;
  return query.replace(specialChars, '\\$&');
}

/**
 * Парсинг JSON-строки с type-guard
 */
function parseJsonSafely<T>(jsonString: string | undefined, validator: (data: unknown) => data is T): T | null {
  if (!jsonString) return null;
  
  try {
    const parsed: unknown = JSON.parse(jsonString);
    if (validator(parsed)) {
      return parsed;
    }
    return null;
  } catch (error) {
    console.error('JSON parse error:', error);
    return null;
  }
}

/**
 * Type-guard для массива JMPI
 */
function isJMPIArray(data: unknown): data is JMPI[] {
  return Array.isArray(data) && data.every(item => 
    typeof item === 'object' && item !== null && ('mpi' in item || 'mpi_text' in item)
  );
}

/**
 * Type-guard для массива JSpecification
 */
function isJSpecificationArray(data: unknown): data is JSpecification[] {
  return Array.isArray(data) && data.every(item => 
    typeof item === 'object' && item !== null && ('doc_uuid' in item || 'doc_name' in item)
  );
}

/**
 * Type-guard для массива JMethod
 */
function isJMethodArray(data: unknown): data is JMethod[] {
  return Array.isArray(data) && data.every(item => 
    typeof item === 'object' && item !== null && ('doc_uuid' in item || 'doc_name' in item)
  );
}

/**
 * Парсинг МПИ из строки (экспортируется для обратной совместимости)
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
  
  // Просто число
  const numberMatch = str.match(/^(\d+)$/);
  if (numberMatch) {
    return parseInt(numberMatch[1]);
  }
  
  return null;
}

/**
 * Извлечение МПИ из j_mpis
 */
function extractMPI(jMpisString: string | undefined): number | null {
  const jMpis = parseJsonSafely(jMpisString, isJMPIArray);
  if (!jMpis || jMpis.length === 0) return null;
  
  const firstMPI = jMpis[0];
  const mpiValue = firstMPI.mpi || firstMPI.mpi_text;
  
  if (!mpiValue) return null;
  
  return parseMPI(mpiValue);
}

/**
 * Извлечение ссылки на описание из j_specifications
 */
function extractDescriptionLink(jSpecsString: string | undefined): string | undefined {
  const jSpecs = parseJsonSafely(jSpecsString, isJSpecificationArray);
  if (!jSpecs || jSpecs.length === 0) return undefined;
  
  const firstSpec = jSpecs[0];
  if (firstSpec.doc_uuid) {
    return `${BASE_URL}${DOCS_API_ENDPOINT}/${firstSpec.doc_uuid}`;
  }
  
  return undefined;
}

/**
 * Извлечение ссылки на методику из j_methods
 */
function extractMethodLink(jMethodsString: string | undefined): string | undefined {
  const jMethods = parseJsonSafely(jMethodsString, isJMethodArray);
  if (!jMethods || jMethods.length === 0) return undefined;
  
  const firstMethod = jMethods[0];
  if (firstMethod.doc_uuid) {
    return `${BASE_URL}${DOCS_API_ENDPOINT}/${firstMethod.doc_uuid}`;
  }
  
  return undefined;
}

/**
 * Определение типа производства
 */
function parseProductionType(productionType: number | undefined): 'serial' | 'single' | 'unknown' {
  if (productionType === 1) return 'serial';
  if (productionType === 2) return 'single';
  return 'unknown';
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
 * Fetch с таймаутом
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Построение заголовков для запроса
 */
function buildHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
  return {
    ...BOT_SAFE_HEADERS,
    ...additionalHeaders,
  };
}

/**
 * Обработка ответа с retry на 429
 */
async function handleResponseWithRetry<T>(
  response: Response,
  parseFn: () => Promise<T>,
  retryFn: () => Promise<T>
): Promise<T> {
  if (response.status === 429) {
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    return retryFn();
  }
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return parseFn();
}

// === ПУБЛИЧНЫЕ ФУНКЦИИ ===

/**
 * Поиск по запросу
 */
export async function searchByQuery(
  query: string,
  signal?: AbortSignal
): Promise<GosreestrHint[]> {
  if (!query || query.length < 3) return [];
  
  // Проверка кэша
  const cacheKey = `${CACHE_SCHEMA_VERSION}search:${query}`;
  const cached = hintsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < HINTS_TTL) {
    return cached.data;
  }
  
  try {
    await waitForRateLimit();
    
    const escapedQuery = escapeLuceneQuery(query);
    const params = new URLSearchParams({
      fq: `*${escapedQuery}*`,
      fl: 'title,number,notation,manufacturers,mit_uuid,is_actual',
      rows: '20',
      sort: 'num1 desc,num2 desc',
    });
    
    const url = `${BASE_URL}${LIST_ENDPOINT}?${params.toString()}`;
    
    const response = await fetchWithTimeout(url, {
      signal,
      headers: buildHeaders(),
    });
    
    const data: Mit24Response = await handleResponseWithRetry(response, () => response.json(), () => searchByQuery(query, signal));
    
    const hints: GosreestrHint[] = data.response.docs.map(doc => ({
      id: doc.mit_uuid,
      name: doc.title || '',
      designation: doc.notation || '',
      number: doc.number || '',
      manufacturer: doc.manufacturers || '',
      isActual: doc.is_actual !== false,
    }));
    
    // Сохраняем в кэш
    hintsCache.set(cacheKey, { data: hints, timestamp: Date.now() });
    
    return hints;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
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
  const cacheKey = `${CACHE_SCHEMA_VERSION}card:${id}`;
  const cached = cardsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CARDS_TTL) {
    return cached.data;
  }
  
  try {
    await waitForRateLimit();
    
    const params = new URLSearchParams({
      fq: `mit_uuid:"${id}"`,
      rows: '1',
      fl: '*',
    });
    
    const url = `${BASE_URL}${LIST_ENDPOINT}?${params.toString()}`;
    
    const response = await fetchWithTimeout(url, {
      signal,
      headers: buildHeaders(),
    });
    
    const data: Mit24Response = await handleResponseWithRetry(response, () => response.json(), () => fetchCard(id, signal));
    
    if (data.response.docs.length === 0) {
      return null;
    }
    
    const doc = data.response.docs[0];
    
    const intervalMonths = extractMPI(doc.j_mpis);
    const descriptionLink = extractDescriptionLink(doc.j_specifications);
    const methodLink = extractMethodLink(doc.j_methods);
    const productionType = parseProductionType(doc.production_type);
    
    const card: GosreestrCard = {
      id: doc.mit_uuid,
      name: doc.title || '',
      type: doc.notation || '',
      gosreestrNumber: doc.number || '',
      manufacturer: doc.manufacturers || '',
      intervalMonths,
      status: doc.is_actual !== false ? 'Действует' : 'Не действует',
      isActual: doc.is_actual !== false,
      validTo: doc.valid_to || null,
      productionType,
      descriptionLink,
      methodLink,
      cardUrl: `https://fgis.gost.ru/fundmetrology/cm/mits/${doc.mit_uuid}`,
    };
    
    // Сохраняем в кэш
    cardsCache.set(cacheKey, { data: card, timestamp: Date.now() });
    
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
    
    const url = link.startsWith('http') ? link : `${BASE_URL}${link}`;
    
    const response = await fetchWithTimeout(url, {
      signal,
      headers: buildHeaders(),
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

// === НАСТРОЙКА ДОСТУПА К ГОСРЕЕСТРУ ===

const SETTINGS_KEY = 'gosreestr_access_enabled';

/**
 * Проверка, включён ли доступ к Госреестру
 */
export async function isGosreestrAccessEnabled(): Promise<boolean> {
  try {
    const enabled = await indexedDBCache.getSetting(SETTINGS_KEY);
    return enabled !== false;
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
  const accessEnabled = await isGosreestrAccessEnabled();
  
  if (!accessEnabled) {
    return { hints: [], fromCache: false };
  }

  try {
    const hints = await searchByQuery(query, signal);
    
    if (hints.length > 0) {
      const cacheKey = `${CACHE_SCHEMA_VERSION}search:${query}`;
      await indexedDBCache.cacheCard(cacheKey, { data: hints });
    }
    
    return { hints, fromCache: false };
  } catch (error) {
    try {
      const cacheKey = `${CACHE_SCHEMA_VERSION}search:${query}`;
      const cached = await indexedDBCache.getCachedCard(cacheKey);
      if (cached) {
        return { 
          hints: cached.data as GosreestrHint[], 
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
  const accessEnabled = await isGosreestrAccessEnabled();
  
  if (!accessEnabled) {
    try {
      const cacheKey = `${CACHE_SCHEMA_VERSION}card:${id}`;
      const cached = await indexedDBCache.getCachedCard(cacheKey);
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
    const card = await fetchCard(id, signal);
    
    if (card) {
      const cacheKey = `${CACHE_SCHEMA_VERSION}card:${id}`;
      await indexedDBCache.cacheCard(cacheKey, card);
    }
    
    return { card, fromCache: false };
  } catch (error) {
    try {
      const cacheKey = `${CACHE_SCHEMA_VERSION}card:${id}`;
      const cached = await indexedDBCache.getCachedCard(cacheKey);
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
    const limit = Math.min(staleCards.length, 20);
    
    let updated = 0;
    
    for (let i = 0; i < limit; i++) {
      const card = staleCards[i];
      
      // Пропускаем поисковые запросы
      if (card.id.startsWith(`${CACHE_SCHEMA_VERSION}search:`)) continue;
      
      onProgress?.(i + 1, limit);
      
      try {
        await waitForRateLimit();
        
        const params = new URLSearchParams({
          fq: `mit_uuid:"${card.id.replace(`${CACHE_SCHEMA_VERSION}card:`, '')}"`,
          rows: '1',
          fl: 'is_actual,valid_to',
        });
        
        const url = `${BASE_URL}${LIST_ENDPOINT}?${params.toString()}`;
        
        const response = await fetchWithTimeout(url, {
          headers: buildHeaders(),
        });
        
        if (response.ok) {
          const data: Mit24Response = await response.json();
          
          if (data.response.docs.length > 0) {
            const doc = data.response.docs[0];
            const updatedCard = { 
              ...card.data, 
              status: doc.is_actual !== false ? 'Действует' : 'Не действует',
              isActual: doc.is_actual !== false,
              validTo: doc.valid_to || null,
            };
            
            await indexedDBCache.cacheCard(card.id, updatedCard);
            updated++;
          }
        }
      } catch (error) {
        console.error('Freshness check error:', error);
      }
    }
    
    return { checked: limit, updated };
  } catch (error) {
    console.error('Cache freshness check failed:', error);
    return { checked: 0, updated: 0 };
  }
}
