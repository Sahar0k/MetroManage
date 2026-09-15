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
        status: 'success',
        result: {
          totalCount: 1,
          items: [{
            id: 'test-id',
            type: 'foei:SI_type',
            properties: [
              { name: 'foei:NameSI', type: 'string', value: 'Тест' },
              { name: 'foei:DesignationSI', type: 'string', value: 'Тест-1' },
              { name: 'foei:NumberSI', type: 'string', value: '52797-13' },
              { name: 'foei:ManufacturerTotalSI', type: 'string', value: 'ООО Тест' },
            ],
          }],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await searchByQuery('52797-13');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('filter%5B0%5D.field=foei%3ANumberSI'),
        expect.any(Object)
      );
      expect(result).toHaveLength(1);
      expect(result[0].number).toBe('52797-13');
    });

    it('должен строить текстовый запрос для обычного поиска', async () => {
      const mockResponse = {
        status: 'success',
        result: {
          totalCount: 1,
          items: [{
            id: 'test-id',
            type: 'foei:SI_type',
            properties: [
              { name: 'foei:NameSI', type: 'string', value: 'Р2М-18А' },
              { name: 'foei:DesignationSI', type: 'string', value: 'Р2М-18А' },
              { name: 'foei:NumberSI', type: 'string', value: '12345-20' },
              { name: 'foei:ManufacturerTotalSI', type: 'string', value: 'ООО Тест' },
            ],
          }],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await searchByQuery('Р2М-18А');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=%D0%A02%D0%9C-18%D0%90'),
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
        status: 'success',
        result: {
          totalCount: 1,
          items: [{
            id: 'test-id',
            type: 'foei:SI_type',
            properties: [
              { name: 'foei:NameSI', type: 'string', value: 'Мультиметр' },
              { name: 'foei:DesignationSI', type: 'string', value: 'Мультиметр-1' },
              { name: 'foei:NumberSI', type: 'string', value: '12345-20' },
              { name: 'foei:ManufacturerTotalSI', type: 'string', value: 'ООО Тест' },
              { name: 'foei:MPISI', type: 'string', value: '2 года' },
              { name: 'foei:StatusSI', type: 'string', value: 'Действует' },
            ],
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
    });

    it('должен возвращать null при ошибке', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const card = await fetchCard('test-id');

      expect(card).toBeNull();
    });
  });
});
