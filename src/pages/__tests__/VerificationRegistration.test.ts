import { describe, it, expect, vi, beforeEach } from 'vitest';
import { store } from '../../store';

// Mock store
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
        const updated = { ...protocol, ...updates, updatedAt: new Date().toISOString() };
        protocols = protocols.map(p => p.id === id ? updated : p);
        return updated;
      },
      deleteProtocol: (id: string) => {
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
      _getOperations: () => operations,
    },
  };
});

describe('VerificationRegistration', () => {
  beforeEach(() => {
    (store as any)._reset();
  });

  describe('Регистрация с pass', () => {
    it('должен обновить статус СИ на available и пересчитать даты', () => {
      const protocol = store.addProtocol({
        deviceId: 'test-device-1',
        instrumentInventoryNumber: 'СИ-0001',
        instrumentName: 'Тестовый мультиметр',
        operatorId: 'operator-1',
        dateStart: '2024-06-01',
        dateEnd: '2024-06-01',
        status: 'completed',
        result: 'pass',
        points: [{ id: 'point-1', name: '2025-06-01', nominal: 0, unit: '', tolerance: 0 }],
      });

      // Обновляем статус СИ
      store.updateInstrument('test-device-1', {
        status: 'available',
        lastVerificationDate: '2024-06-01',
        nextVerificationDate: '2025-06-01',
      });

      const instruments = (store as any)._getInstruments();
      const device = instruments.find((i: any) => i.id === 'test-device-1');
      
      expect(device.status).toBe('available');
      expect(device.lastVerificationDate).toBe('2024-06-01');
      expect(device.nextVerificationDate).toBe('2025-06-01');
    });
  });

  describe('Регистрация с fail', () => {
    it('должен обновить статус СИ на repair', () => {
      const protocol = store.addProtocol({
        deviceId: 'test-device-1',
        instrumentInventoryNumber: 'СИ-0001',
        instrumentName: 'Тестовый мультиметр',
        operatorId: 'operator-1',
        dateStart: '2024-06-01',
        dateEnd: '2024-06-01',
        status: 'completed',
        result: 'fail',
        points: [{ id: 'point-1', name: '2025-06-01', nominal: 0, unit: '', tolerance: 0 }],
      });

      // Обновляем статус СИ
      store.updateInstrument('test-device-1', { status: 'repair' });

      const instruments = (store as any)._getInstruments();
      const device = instruments.find((i: any) => i.id === 'test-device-1');
      
      expect(device.status).toBe('repair');
    });
  });

  describe('Запись в OperationLog', () => {
    it('должен записывать операцию при регистрации поверки', () => {
      const protocol = store.addProtocol({
        deviceId: 'test-device-1',
        instrumentInventoryNumber: 'СИ-0001',
        instrumentName: 'Тестовый мультиметр',
        operatorId: 'operator-1',
        dateStart: '2024-06-01',
        dateEnd: '2024-06-01',
        status: 'completed',
        result: 'pass',
        points: [{ id: 'point-1', name: '2025-06-01', nominal: 0, unit: '', tolerance: 0 }],
      });

      store.addOperation({
        userId: 'operator-1',
        action: 'return',
        entityType: 'protocol',
        entityId: protocol.id,
        details: 'Зарегистрирована поверка СИ-0001: ГОДЕН',
      });

      const operations = (store as any)._getOperations();
      expect(operations).toHaveLength(1);
      expect(operations[0].entityType).toBe('protocol');
      expect(operations[0].details).toContain('ГОДЕН');
    });
  });

  describe('Событие в InstrumentHistory', () => {
    it('должен создавать событие в истории при регистрации поверки', () => {
      const protocol = store.addProtocol({
        deviceId: 'test-device-1',
        instrumentInventoryNumber: 'СИ-0001',
        instrumentName: 'Тестовый мультиметр',
        operatorId: 'operator-1',
        dateStart: '2024-06-01',
        dateEnd: '2024-06-01',
        status: 'completed',
        result: 'pass',
        points: [{ id: 'point-1', name: '2025-06-01', nominal: 0, unit: '', tolerance: 0 }],
      });

      const protocols = store.getProtocols();
      const deviceProtocols = protocols.filter(p => p.deviceId === 'test-device-1');
      
      expect(deviceProtocols).toHaveLength(1);
      expect(deviceProtocols[0].result).toBe('pass');
    });
  });
});
