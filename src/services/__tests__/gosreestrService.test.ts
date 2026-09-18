import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseMPI, mapToInstrument, searchByQuery, fetchCard } from '../gosreestrService';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('gosreestrService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('parseMPI', () => {
    it('должен парсить "4 года" в 48 месяцев', () => {
      expect(parseMPI('4 года')).toBe(48);
    });

    it('должен парсить "1 год" в 12 месяцев', () => {
      expect(parseMPI('1 год')).toBe(12);
    });

    it('должен парсить "24 месяца" в 24 месяца', () => {
      expect(parseMPI('24 месяца')).toBe(24);
    });

    it('должен парсить "6 мес" в 6 месяцев', () => {
      expect(parseMPI('6 мес')).toBe(6);
    });

    it('должен возвращать null для пустой строки', () => {
      expect(parseMPI('')).toBeNull();
    });

    it('должен возвращать null для невалидной строки', () => {
      expect(parseMPI('неизвестно')).toBeNull();
    });
  });

  describe('mapToInstrument', () => {
    it('должен маппить карточку Госреестра в поля СИ', () => {
      const card = {
        id: 'test-id',
        name: 'Мультиметр цифровой',
        type: 'Мультиметр',
        gosreestrNumber: '12345-20',
        manufacturer: 'ООО Тест',
        intervalMonths: 12,
        status: 'Действует',
        isActual: true,
        validTo: null,
        productionType: 'serial' as const,
        cardUrl: 'https://fgis.gost.ru/fundmetrology/cm/mits/test-id',
      };

      const mapped = mapToInstrument(card);

      expect(mapped.name).toBe('Мультиметр цифровой');
      expect(mapped.type).toBe('Мультиметр');
      expect(mapped.manufacturer).toBe('ООО Тест');
      expect(mapped.intervalMonths).toBe(12);
    });

    it('должен использовать 12 месяцев если intervalMonths null', () => {
      const card = {
        id: 'test-id',
        name: 'Тест',
        type: 'Тест',
        gosreestrNumber: '12345-20',
        manufacturer: 'Тест',
        intervalMonths: null,
        status: 'Действует',
        isActual: true,
        validTo: null,
        productionType: 'serial' as const,
        cardUrl: 'https://fgis.gost.ru/fundmetrology/cm/mits/test-id',
      };

      const mapped = mapToInstrument(card);
      expect(mapped.intervalMonths).toBe(12);
    });
  });

  describe('searchByQuery', () => {
    it('должен возвращать пустой массив для запроса менее 3 символов', async () => {
      const result = await searchByQuery('ab');
      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('должен строить правильный запрос для точного номера', async () => {
      const mockResponse = {
        response: {
          numFound: 1,
          docs: [{
            mit_uuid: 'test-id',
            title: 'Тест',
            notation: 'Тест-1',
            number: '52797-13',
            manufacturers: 'ООО Тест',
            is_actual: true,
          }],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await searchByQuery('52797-13');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('fq=*52797-13*'),
        expect.any(Object)
      );
      expect(result).toHaveLength(1);
      expect(result[0].number).toBe('52797-13');
    });

    it('должен строить текстовый запрос для обычного поиска', async () => {
      const mockResponse = {
        response: {
          numFound: 1,
          docs: [{
            mit_uuid: 'test-id',
            title: 'Р2М-18А',
            notation: 'Р2М-18А',
            number: '12345-20',
            manufacturers: 'ООО Тест',
            is_actual: true,
          }],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await searchByQuery('Р2М-18А');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('fq=*'),
        expect.any(Object)
      );
      expect(result).toHaveLength(1);
    });

    it('должен возвращать пустой массив при сетевой ошибке', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await searchByQuery('тест');

      expect(result).toEqual([]);
    });
  });

  describe('fetchCard', () => {
    it('должен получать полную карточку', async () => {
      const mockResponse = {
        response: {
          numFound: 1,
          docs: [{
            mit_uuid: 'test-id',
            title: 'Мультиметр',
            notation: 'Мультиметр-1',
            number: '12345-20',
            manufacturers: 'ООО Тест',
            is_actual: true,
            valid_to: '2025-12-31',
            production_type: 1,
            j_mpis: JSON.stringify([{ mpi: '2 года' }]),
            j_specifications: JSON.stringify([{ doc_uuid: 'spec-uuid', doc_name: 'Описание типа' }]),
            j_methods: JSON.stringify([{ doc_uuid: 'method-uuid', doc_name: 'Методика поверки' }]),
          }],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const card = await fetchCard('test-id');

      expect(card).not.toBeNull();
      expect(card?.name).toBe('Мультиметр');
      expect(card?.intervalMonths).toBe(24);
      expect(card?.status).toBe('Действует');
      expect(card?.isActual).toBe(true);
      expect(card?.productionType).toBe('serial');
    });

    it('должен возвращать null при ошибке', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const card = await fetchCard('test-id');

      expect(card).toBeNull();
    });
  });
});
