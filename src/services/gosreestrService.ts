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
 * Построение поискового запроса для подсказок Госреестра.
 * Если запрос уже содержит '*' или '?' — не модифицируем (пользователь указал wildcard явно).
 * Иначе: экранируем Lucene-спецсимволы + добавляем trailing wildcard.*.
 * Пример: 'Р2М' → 'Р2М*' (ищет термы, начинающиеся с Р2М).
 */
export function buildSearchQuery(query: string): string {
  const trimmed = query.trim();
  // Уже содержит wildcard — оборачиваем в *
  if (/[*?]/.test(trimmed)) {
    return `*${escapeLuceneQuery(trimmed)}*`;
  }
  // Частичный запрос: trailing wildcard (без ведущего *, т.к. XCDB mit24 плохо обрабатывает leading wild)
  const escaped = escapeLuceneQuery(trimmed);
  return `${escaped}*`;
}

/**
 * Универсальный парсер j_* полей: принимает string|array|object|null → всегда массив
 */
function parseJField<T>(raw: unknown, itemValidator?: (item: unknown) => boolean): T[] {
  // Если уже массив — вернуть как есть (type-guard не применим)
  if (Array.isArray(raw)) return raw as T[];
  
  // Если object — обёрнуть в массив
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) return [raw as T];
  
  // Если null/undefined — пустой массив
  if (raw == null) return [];
  
  // Строка — попытаться распарсить JSON
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      // Рекурсивно обработаем результат
      return parseJField<T>(parsed, itemValidator);
    } catch {
      // Малий JSON — вернём пустой массив
      return [];
    }
  }
  
  // Всё остальное — пустой массив
  return [];
}

/**
 * Парсинг JSON-строки с type-guard (сохранён для обратной совместимости)
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
 * Извлечение МПИ из j_mpis (устойчивый к любому типу входных данных)
 */
function extractMPI(jMpisRaw: string | undefined): number | null {
  const jMpis = parseJField<{ mpi?: unknown; mpi_text?: unknown }>(jMpisRaw);
  if (jMpis.length === 0) return null;
  
  const firstItem = jMpis[0];
  const mpiValue = firstItem.mpi ?? firstItem.mpi_text;
  
  if (typeof mpiValue !== 'string') return null;
  
  return parseMPI(mpiValue);
}

/**
 * Извлечение ссылки на описание из j_specifications
 */
function extractDescriptionLink(jSpecsRaw: string | undefined): string | undefined {
  const jSpecs = parseJField<{ doc_uuid?: unknown; doc_name?: string }>(jSpecsRaw);
  if (jSpecs.length === 0) return undefined;
  
  const firstSpec = jSpecs[0];
  if (typeof firstSpec.doc_uuid === 'string' && firstSpec.doc_uuid) {
    return `${BASE_URL}${DOCS_API_ENDPOINT}/${firstSpec.doc_uuid}`;
  }
  
  return undefined;
}

/**
 * Извлечение ссылки на методику из j_methods
 */
function extractMethodLink(jMethodsRaw: string | undefined): string | undefined {
  const jMethods = parseJField<{ doc_uuid?: unknown; doc_name?: string }>(jMethodsRaw);
  if (jMethods.length === 0) return undefined;
  
  const firstMethod = jMethods[0];
  if (typeof firstMethod.doc_uuid === 'string' && firstMethod.doc_uuid) {
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
 * Parse JSON safely with typed validation
 */
async function safeJsonParse<T>(response: Response, validator?: (data: unknown) => data is T): Promise<T> {
  const text = await response.text();
  try {
    const parsed: unknown = JSON.parse(text);
    if (validator) {
      if (validator(parsed)) return parsed;
      throw new Error(`Parsed JSON does not match expected shape`);
    }
    return parsed as T;
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) {
      // Truncated or malformed response - might be transient
      throw Object.assign(new JsonParseError('Failed to parse JSON response'), { rawPreview: text.slice(0, 200) });
    }
    throw error;
  }
}

class JsonParseError extends Error {
  readonly name = 'JsonParseError';
  readonly rawPreview: string;
  constructor(message: string, options?: { rawPreview: string }) {
    super(message);
    this.rawPreview = options?.rawPreview || '';
  }
}

/**
 * Обработка ответа с retry на 429 и transient errors (JSON parse)
 */
async function handleResponseWithRetry<T>(
  response: Response,
  parseFn: () => Promise<T>,
  retryFn: () => Promise<T>,
  retries: number = 1
): Promise<T> {
  // Retry на 429 (rate limit)
  if (response.status === 429) {
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    return retryFn();
  }
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  try {
    return await parseFn();
  } catch (error) {
    // Retry на JsonParseError (transient - возможно truncated response)
    if ((error instanceof Error && error.name === 'JsonParseError') && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return handleResponseWithRetry(response, parseFn, retryFn, retries - 1);
    }
    throw error;
  }
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
    
    const searchQ = buildSearchQuery(query);
    const params = new URLSearchParams({
      fq: searchQ,
      fl: 'title,number,notation,manufacturers,mit_uuid,is_actual',
      rows: '20',
      sort: 'num1 desc,num2 desc',
    });
    
    const url = `${BASE_URL}${LIST_ENDPOINT}?${params.toString()}`;
    
    let response = await fetchWithTimeout(url, {
      signal,
      headers: buildHeaders(),
    });
    
    // Retry on 429 rate limit
    if (response.status === 429) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      response = await fetchWithTimeout(url, { signal, headers: buildHeaders() });
    }
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data: Mit24Response = await safeJsonParse<Mit24Response>(response);
    
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
    
    let data: Mit24Response;
    try {
      data = await safeJsonParse<Mit24Response>(response);
    } catch (parseErr) {
      const errDetail = parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.error(`fetchCard(${id}): parse failed [${errDetail}]`);
      // Retry once for transient JSON parse error
      try {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        const resp2 = await fetchWithTimeout(url, { signal, headers: buildHeaders() });
        data = await safeJsonParse<Mit24Response>(resp2);
      } catch (retryErr) {
        const retryDetail = retryErr instanceof Error ? retryErr.message : String(retryErr);
        console.error(`fetchCard(${id}): retry failed [${retryDetail}]`);
        return null;
      }
    }
    
    if (data.response.docs.length === 0) {
      console.warn(`fetchCard(${id}): API returned 0 docs (query: mit_uuid:"${id}")`);
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
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`fetchCard(${id}): FAILED [${errMsg}]`);
    return null;
  }
}

/**
 * Валидация base64 перед вызовом atob
 */
function isValidBase64(s: string): boolean {
  return /^[A-Za-z0-9+/]+={0,2}$/.test(s.trim());
}

/**
 * Декодирует base64 в Uint8Array.
 * atob() возвращает строку где каждый символ — один байт исходного файла
 * (Latin1-диапазон). Так правильно восстанавливаем бинарные данные.
 */
function decodeBase64ToBytes(base64: string): Uint8Array {
  const cleaned = base64.replace(/\s/g, '');
  if (!isValidBase64(cleaned)) {
    throw new Error(`Invalid base64: expected only [A-Za-z0-9+/=], got "${cleaned.slice(0, 30)}..."`);
  }
  const raw = atob(cleaned);
  const len = raw.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

/**
 * Скачивание вложения из API /cm/iaux/docs/{uuid}
 * Ожидаемый JSON-ответ:
 *   { title, filename, mimetype, doc: "JVBERi0x...", doc_uuid }
 * Строго читаем поле «doc», валидируем как base64 перед atob.
 */
export async function downloadAttachment(
  link: string,
  signal?: AbortSignal
): Promise<Blob | null> {
  try {
    await waitForRateLimit();
    
    // Нормализация URL: не дублировать префикс API_BASE (уже встроен в ссылки из fetchCard)
    const url = link.startsWith('http') || link.startsWith(BASE_URL)
      ? link
      : `${BASE_URL}${link}`;
    
    const response = await fetchWithTimeout(url, {
      signal,
      headers: buildHeaders(),
    });
    
    if (!response.ok) {
      const textFallback = await response.text();
      const snippet = textFallback.slice(0, 120).replace(/[\x00-\x1f]/g, '');
      console.error(`iaux docs HTTP ${response.status}: ${snippet}`);
      return null;
    }
    
    // Считываем тело как строку один раз
    const text = await response.text();
    
    // Попытка распарсить JSON строго для поля «doc»
    if (text.trimStart().startsWith('{')) {
      let j: Record<string, unknown>;
      try {
        j = JSON.parse(text) as Record<string, unknown>;
      } catch {
        console.error('iaux docs: JSON parse failed, first 120 chars:', text.slice(0, 120));
        return null;
      }
      
      const b64 = j?.doc;
      if (typeof b64 !== 'string' || b64.length === 0) {
        const keys = Object.keys(j);
        console.error(`iaux docs: field "doc" missing or not string; available keys=${keys}`);
        return null;
      }
      
      try {
        const bytes = decodeBase64ToBytes(b64);
        const mime = guessContentTypeFromJson(b64, j.mimetype as string | undefined);
        return new Blob([bytes], { type: mime });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`iaux docs: base64 decode failed [${msg}]`);
        return null;
      }
    }
    
    // Не-JWT тело — показываем первые 120 символов и отказываемся
    const bodySnippet = text.slice(0, 120).replace(/[\x00-\x1f]/g, '');
    console.error(`iaux docs: expected JSON but got: ${bodySnippet}`);
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    console.error('Gosreestr download error:', error);
    return null;
  }
}

/**
 * Определяет MIME-тип для Blob: сначала из JSON-поля mimetype,
 * потом по preamble base64 (e.g. "JVBERi0" → PDF).
 */
function guessContentTypeFromJson(base64: string, jsonMime?: string | undefined): string {
  if (typeof jsonMime === 'string' && jsonMime) return jsonMime;
  const p = base64.replace(/\s/g, '').slice(0, 10);
  if (/^JVBERi0/.test(p)) return 'application/pdf';
  return 'application/octet-stream';
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
  console.debug(`fetchCardWithCache(${id}): started`);
  const accessEnabled = await isGosreestrAccessEnabled();
  console.debug(`fetchCardWithCache(${id}): accessEnabled=${accessEnabled}`);
  
  if (!accessEnabled) {
    try {
      const cacheKey = `${CACHE_SCHEMA_VERSION}card:${id}`;
      const cached = await indexedDBCache.getCachedCard(cacheKey);
      if (cached) {
        console.debug(`fetchCardWithCache(${id}): returned from IndexedDB cache`);
        return { 
          card: cached.data, 
          fromCache: true, 
          cacheDate: cached.timestamp 
        };
      }
      console.debug(`fetchCardWithCache(${id}): no local cache, access disabled`);
    } catch (cacheErr) {
      console.error(`fetchCardWithCache(${id}): IndexedDB error [${cacheErr}]`);
    }
    return { card: null, fromCache: false };
  }

  try {
    const card = await fetchCard(id, signal);
    console.debug(`fetchCardWithCache(${id}): fetchCard returned ${card ? 'card' : 'null'}`);
    
    if (card) {
      const cacheKey = `${CACHE_SCHEMA_VERSION}card:${id}`;
      await indexedDBCache.cacheCard(cacheKey, card);
    }
    
    return { card, fromCache: false };
  } catch (error) {
    console.debug(`fetchCardWithCache(${id}): main fetch failed, trying IndexedDB fallback`);
    try {
      const cacheKey = `${CACHE_SCHEMA_VERSION}card:${id}`;
      const cached = await indexedDBCache.getCachedCard(cacheKey);
      if (cached) {
        console.debug(`fetchCardWithCache(${id}): returned from IndexedDB fallback cache`);
        return { 
          card: cached.data, 
          fromCache: true, 
          cacheDate: cached.timestamp 
        };
      }
    } catch (cacheErr) {
      console.error(`fetchCardWithCache(${id}): IndexedDB fallback error [${cacheErr}]`);
    }
    
    console.warn(`fetchCardWithCache(${id}): ALL ATTEMPTS FAILED - returning null`);
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
