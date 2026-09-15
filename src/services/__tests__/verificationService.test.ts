import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateError,
  calculateVerdict,
  calculateProtocolResult,
  updatePointWithCalculation,
  createProtocol,
  startVerification,
  updateProtocolPoint,
  completeProtocol,
  rejectProtocol,
  hasActiveProtocol,
} from '../verificationService';
import { store } from '../../store';
import { VerificationPoint } from '../../types';

// Мокаем store для тестов
vi.mock('../../store', () => {
  let protocols: any[] = [];
  let instruments: any[] = [
    {
      id: 'test-device-1',
      inventoryNumber: 'СИ-0001',
      name: 'Тестовый мультиметр',
      status: 'available',
      intervalMonths: 12,
      lastVerificationDate: '2024-01-01',
      nextVerificationDate: '2025-01-01',
    },
  ];
  let operations: any[] = [];

  return {
    store: {
      getProtocols: () => protocols,
      addProtocol: (protocol: any) => {
        const newProtocol = { ...protocol, id: 'test-protocol-' + protocols.length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        protocols.push(newProtocol);
        return newProtocol;
      },
      updateProtocol: (id: string, updates: any) => {
        const protocol = protocols.find(p => p.id === id);
        if (!protocol) return null;
        if (protocol.status === 'completed' || protocol.status === 'rejected') {
          throw new Error('Нельзя изменять завершённый или отклонённый протокол');
        }
        const updated = { ...protocol, ...updates, updatedAt: new Date().toISOString() };
        protocols = protocols.map(p => p.id === id ? updated : p);
        return updated;
      },
      deleteProtocol: (id: string) => {
        const protocol = protocols.find(p => p.id === id);
        if (!protocol) return false;
        if (protocol.status === 'completed' || protocol.status === 'rejected') {
          throw new Error('Нельзя удалить завершённый или отклонённый протокол');
        }
        protocols = protocols.filter(p => p.id !== id);
        return true;
      },
      getInstruments: () => instruments,
      updateInstrument: (id: string, updates: any) => {
        instruments = instruments.map(i => i.id === id ? { ...i, ...updates } : i);
      },
      addOperation: (op: any) => {
        operations.push({ ...op, id: 'op-' + operations.length, timestamp: new Date().toISOString() });
      },
      // Для сброса между тестами
      _reset: () => {
        protocols = [];
        instruments = [
          {
            id: 'test-device-1',
            inventoryNumber: 'СИ-0001',
            name: 'Тестовый мультиметр',
            status: 'available',
            intervalMonths: 12,
            lastVerificationDate: '2024-01-01',
            nextVerificationDate: '2025-01-01',
          },
        ];
        operations = [];
      },
      _getInstruments: () => instruments,
    },
  };
});

describe('verificationService', () => {
  beforeEach(() => {
    (store as any)._reset();
  });

  describe('calculateError', () => {
    it('должен корректно рассчитывать погрешность', () => {
      expect(calculateError(100.5, 100)).toBe(0.5);
      expect(calculateError(99.5, 100)).toBe(0.5);
      expect(calculateError(100, 100)).toBe(0);
    });

    it('должен возвращать абсолютное значение', () => {
      expect(calculateError(50, 100)).toBe(50);
      expect(calculateError(150, 100)).toBe(50);
    });
  });

  describe('calculateVerdict', () => {
    it('должен возвращать pass при погрешности в пределах допуска', () => {
      expect(calculateVerdict(0.05, 0.1)).toBe('pass');
      expect(calculateVerdict(0.1, 0.1)).toBe('pass');
    });

    it('должен возвращать fail при погрешности выше допуска', () => {
      expect(calculateVerdict(0.15, 0.1)).toBe('fail');
      expect(calculateVerdict(1.0, 0.1)).toBe('fail');
    });

    it('должен учитывать epsilon для пограничных значений (0.10000000000000009 при tolerance 0.1 → pass)', () => {
      // Типичный случай floating-point precision issue
      const error = 0.1 + Number.EPSILON; // 0.10000000000000009
      expect(calculateVerdict(error, 0.1)).toBe('pass');
    });

    it('должен корректно обрабатывать нулевые значения', () => {
      expect(calculateVerdict(0, 0)).toBe('pass');
      expect(calculateVerdict(0, 0.1)).toBe('pass');
    });
  });

  describe('calculateProtocolResult', () => {
    it('должен возвращать undefined если не все точки имеют вердикт', () => {
      const points: VerificationPoint[] = [
        { id: '1', name: 'Точка 1', nominal: 100, unit: 'В', tolerance: 1, verdict: 'pass' },
        { id: '2', name: 'Точка 2', nominal: 200, unit: 'В', tolerance: 1 },
      ];
      expect(calculateProtocolResult(points)).toBeUndefined();
    });

    it('должен возвращать pass если все точки pass', () => {
      const points: VerificationPoint[] = [
        { id: '1', name: 'Точка 1', nominal: 100, unit: 'В', tolerance: 1, verdict: 'pass' },
        { id: '2', name: 'Точка 2', nominal: 200, unit: 'В', tolerance: 1, verdict: 'pass' },
      ];
      expect(calculateProtocolResult(points)).toBe('pass');
    });

    it('должен возвращать fail если хотя бы одна точка fail', () => {
      const points: VerificationPoint[] = [
        { id: '1', name: 'Точка 1', nominal: 100, unit: 'В', tolerance: 1, verdict: 'pass' },
        { id: '2', name: 'Точка 2', nominal: 200, unit: 'В', tolerance: 1, verdict: 'fail' },
      ];
      expect(calculateProtocolResult(points)).toBe('fail');
    });
  });

  describe('updatePointWithCalculation', () => {
    it('должен обновлять точку с авторасчётом', () => {
      const point: VerificationPoint = {
        id: '1', name: '100 В', nominal: 100, unit: 'В', tolerance: 0.5,
      };
      const updated = updatePointWithCalculation(point, 100.3);
      expect(updated.actual).toBe(100.3);
      expect(updated.error).toBe(0.3);
      expect(updated.verdict).toBe('pass');
    });

    it('должен вычислять fail при превышении допуска', () => {
      const point: VerificationPoint = {
        id: '1', name: '100 В', nominal: 100, unit: 'В', tolerance: 0.5,
      };
      const updated = updatePointWithCalculation(point, 101.0);
      expect(updated.error).toBe(1.0);
      expect(updated.verdict).toBe('fail');
    });
  });

  describe('createProtocol', () => {
    it('должен создавать протокол с снапшотом данных СИ', () => {
      const protocol = createProtocol(
        'test-device-1',
        'operator-1',
        [{ name: '100 В', nominal: 100, unit: 'В', tolerance: 0.5 }]
      );

      expect(protocol.deviceId).toBe('test-device-1');
      expect(protocol.instrumentInventoryNumber).toBe('СИ-0001');
      expect(protocol.instrumentName).toBe('Тестовый мультиметр');
      expect(protocol.status).toBe('draft');
      expect(protocol.points).toHaveLength(1);
    });

    it('должен выбрасывать ошибку если СИ не найдено', () => {
      expect(() => {
        createProtocol('non-existent', 'operator-1', []);
      }).toThrow('Средство измерений не найдено');
    });
  });

  describe('Жизненный цикл СИ', () => {
    it('должен переводить СИ в verification при startVerification', () => {
      const protocol = createProtocol('test-device-1', 'operator-1', [
        { name: '100 В', nominal: 100, unit: 'В', tolerance: 0.5 }
      ]);

      startVerification(protocol.id, 'operator-1');

      const instruments = (store as any)._getInstruments();
      const device = instruments.find((i: any) => i.id === 'test-device-1');
      expect(device.status).toBe('verification');
    });

    it('должен переводить СИ в available и пересчитывать даты при завершении с pass', () => {
      const protocol = createProtocol('test-device-1', 'operator-1', [
        { name: '100 В', nominal: 100, unit: 'В', tolerance: 0.5 }
      ]);
      startVerification(protocol.id, 'operator-1');

      // Обновляем точку с passing значением
      updateProtocolPoint(protocol.id, protocol.points[0].id, 100.1, 'operator-1');

      const completed = completeProtocol(protocol.id, 'operator-1');

      expect(completed?.status).toBe('completed');
      expect(completed?.result).toBe('pass');

      const instruments = (store as any)._getInstruments();
      const device = instruments.find((i: any) => i.id === 'test-device-1');
      expect(device.status).toBe('available');
      expect(device.lastVerificationDate).toBeTruthy();
      expect(device.nextVerificationDate).toBeTruthy();
    });

    it('должен переводить СИ в repair при завершении с fail', () => {
      const protocol = createProtocol('test-device-1', 'operator-1', [
        { name: '100 В', nominal: 100, unit: 'В', tolerance: 0.5 }
      ]);
      startVerification(protocol.id, 'operator-1');

      // Обновляем точку с failing значением
      updateProtocolPoint(protocol.id, protocol.points[0].id, 102.0, 'operator-1');

      const completed = completeProtocol(protocol.id, 'operator-1');

      expect(completed?.result).toBe('fail');

      const instruments = (store as any)._getInstruments();
      const device = instruments.find((i: any) => i.id === 'test-device-1');
      expect(device.status).toBe('repair');
    });
  });

  describe('Неизменяемость завершённых протоколов', () => {
    it('должен выбрасывать ошибку при updateProtocol для completed', () => {
      const protocol = createProtocol('test-device-1', 'operator-1', [
        { name: '100 В', nominal: 100, unit: 'В', tolerance: 0.5 }
      ]);
      startVerification(protocol.id, 'operator-1');
      updateProtocolPoint(protocol.id, protocol.points[0].id, 100.1, 'operator-1');
      completeProtocol(protocol.id, 'operator-1');

      expect(() => {
        updateProtocolPoint(protocol.id, protocol.points[0].id, 100.2, 'operator-1');
      }).toThrow('Нельзя изменять завершённый или отклонённый протокол');
    });

    it('должен выбрасывать ошибку при updateProtocol для rejected', () => {
      const protocol = createProtocol('test-device-1', 'operator-1', [
        { name: '100 В', nominal: 100, unit: 'В', tolerance: 0.5 }
      ]);
      rejectProtocol(protocol.id, 'Тестовая причина', 'operator-1');

      expect(() => {
        store.updateProtocol(protocol.id, { notes: 'test' });
      }).toThrow('Нельзя изменять завершённый или отклонённый протокол');
    });
  });

  describe('Блокировка завершения', () => {
    it('должен блокировать завершение если не все точки имеют вердикт', () => {
      const protocol = createProtocol('test-device-1', 'operator-1', [
        { name: '100 В', nominal: 100, unit: 'В', tolerance: 0.5 },
        { name: '200 В', nominal: 200, unit: 'В', tolerance: 0.5 },
      ]);
      startVerification(protocol.id, 'operator-1');

      // Заполняем только одну точку
      updateProtocolPoint(protocol.id, protocol.points[0].id, 100.1, 'operator-1');

      expect(() => {
        completeProtocol(protocol.id, 'operator-1');
      }).toThrow('Нельзя завершить протокол: не все точки имеют вердикт');
    });
  });

  describe('hasActiveProtocol', () => {
    it('должен возвращать true если есть активный протокол', () => {
      createProtocol('test-device-1', 'operator-1', [
        { name: '100 В', nominal: 100, unit: 'В', tolerance: 0.5 }
      ]);
      expect(hasActiveProtocol('test-device-1')).toBe(true);
    });

    it('должен возвращать false если нет активных протоколов', () => {
      expect(hasActiveProtocol('test-device-1')).toBe(false);
    });

    it('должен возвращать false если все протоколы завершены', () => {
      const protocol = createProtocol('test-device-1', 'operator-1', [
        { name: '100 В', nominal: 100, unit: 'В', tolerance: 0.5 }
      ]);
      startVerification(protocol.id, 'operator-1');
      updateProtocolPoint(protocol.id, protocol.points[0].id, 100.1, 'operator-1');
      completeProtocol(protocol.id, 'operator-1');

      expect(hasActiveProtocol('test-device-1')).toBe(false);
    });
  });
});
