import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateImport, mapRowToInstrument, DEFAULT_MAPPING } from '../importService';

describe('importService', () => {
  describe('validateImport', () => {
    it('должен валидировать корректные данные', () => {
      const rows = [
        {
          '№ п/п': '1',
          'Наименование': 'Мультиметр',
          'Производитель': 'Keysight',
          'Модель': '34461A',
          'Заводской номер': 'SN001',
        },
      ];

      const result = validateImport(rows, DEFAULT_MAPPING);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.duplicates.size).toBe(0);
    });

    it('должен находить пустые обязательные поля', () => {
      const rows = [
        {
          '№ п/п': '1',
          'Наименование': '',
          'Производитель': 'Keysight',
          'Модель': '34461A',
        },
      ];

      const result = validateImport(rows, DEFAULT_MAPPING);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe('Наименование');
    });

    it('должен находить дубликаты заводских номеров', () => {
      const rows = [
        {
          '№ п/п': '1',
          'Наименование': 'Мультиметр',
          'Производитель': 'Keysight',
          'Модель': '34461A',
          'Заводской номер': 'SN001',
        },
        {
          '№ п/п': '2',
          'Наименование': 'Мультиметр',
          'Производитель': 'Keysight',
          'Модель': '34461A',
          'Заводской номер': 'SN001',
        },
      ];

      const result = validateImport(rows, DEFAULT_MAPPING);

      expect(result.valid).toBe(false);
      expect(result.duplicates.size).toBe(1);
      expect(result.duplicates.has('SN001')).toBe(true);
    });
  });

  describe('mapRowToInstrument', () => {
    it('должен маппить строку Excel в MeasuringInstrument', () => {
      const row = {
        '№ п/п': '1',
        'Наименование': 'Мультиметр',
        'Производитель': 'Keysight',
        'Модель': '34461A',
        'Заводской номер': 'SN001',
      };

      const result = mapRowToInstrument(row, DEFAULT_MAPPING, 0);

      expect(result.inventoryNumber).toBe('1');
      expect(result.name).toBe('Мультиметр');
      expect(result.manufacturer).toBe('Keysight');
      expect(result.type).toBe('34461A');
      expect(result.serialNumber).toBe('SN001');
      expect(result.lastVerificationDate).toBeNull();
    });

    it('должен генерировать инвентарный номер если не указан', () => {
      const row = {
        'Наименование': 'Мультиметр',
        'Производитель': 'Keysight',
        'Модель': '34461A',
      };

      const result = mapRowToInstrument(row, DEFAULT_MAPPING, 5);

      expect(result.inventoryNumber).toBe('СИ-0006');
    });
  });

  describe('DEFAULT_MAPPING', () => {
    it('должен содержать все необходимые поля', () => {
      expect(DEFAULT_MAPPING.inventoryNumber).toBe('№ п/п');
      expect(DEFAULT_MAPPING.name).toBe('Наименование');
      expect(DEFAULT_MAPPING.manufacturer).toBe('Производитель');
      expect(DEFAULT_MAPPING.type).toBe('Модель');
      expect(DEFAULT_MAPPING.serialNumber).toBe('Заводской номер');
      expect(DEFAULT_MAPPING.responsible).toBe('Ответственный');
      expect(DEFAULT_MAPPING.gosreestrNumber).toBe('Номер в гос. реестре');
    });
  });
});
