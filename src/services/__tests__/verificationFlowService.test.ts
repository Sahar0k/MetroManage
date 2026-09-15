import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendToVerification, completeSendoff, getOverdueSendoffs, getActiveSendoff } from '../verificationFlowService';
import { store } from '../../store';

// Mock store
vi.mock('../../store', () => {
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
    {
      id: 'test-device-2',
      inventoryNumber: 'СИ-0002',
      name: 'Тестовый осциллограф',
      status: 'issued',
      intervalMonths: 12,
      lastVerificationDate: '2024-01-01',
      nextVerificationDate: '2025-01-01',
    },
  ];
  let sendoffs: any[] = [];
  let operations: any[] = [];

  return {
    store: {
      getInstruments: () => instruments,
      updateInstrument: (id: string, updates: any) => {
        instruments = instruments.map(i => i.id === id ? { ...i, ...updates } : i);
      },
      getSendoffs: () => sendoffs,
      addSendoff: (sendoff: any) => {
        const newSendoff = { ...sendoff, id: 'sendoff-' + sendoffs.length };
        sendoffs.push(newSendoff);
        return newSendoff;
      },
      updateSendoff: (id: string, updates: any) => {
        const sendoff = sendoffs.find(s => s.id === id);
        if (!sendoff) return null;
        const updated = { ...sendoff, ...updates };
        sendoffs = sendoffs.map(s => s.id === id ? updated : s);
        return updated;
      },
      addOperation: (op: any) => {
        operations.push({ ...op, id: 'op-' + operations.length, timestamp: new Date().toISOString() });
      },
      _reset: () => {
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
          {
            id: 'test-device-2',
            inventoryNumber: 'СИ-0002',
            name: 'Тестовый осциллограф',
            status: 'issued',
            intervalMonths: 12,
            lastVerificationDate: '2024-01-01',
            nextVerificationDate: '2025-01-01',
          },
        ];
        sendoffs = [];
        operations = [];
      },
      _getInstruments: () => instruments,
      _getSendoffs: () => sendoffs,
    },
  };
});

describe('verificationFlowService', () => {
  beforeEach(() => {
    (store as any)._reset();
  });

  describe('sendToVerification', () => {
    it('должен отправлять прибор из статуса available', () => {
      const result = sendToVerification(
        'test-device-1',
        'Метрологическая служба',
        'user-1',
        '2024-12-31',
        'Плановая поверка',
        'user-1'
      );

      expect(result.success).toBe(true);
      expect(result.sendoff).toBeDefined();
      expect(result.sendoff?.status).toBe('sent');

      const instruments = (store as any)._getInstruments();
      const device = instruments.find((i: any) => i.id === 'test-device-1');
      expect(device.status).toBe('verification');
    });

    it('должен отказывать в отправке из статуса issued', () => {
      const result = sendToVerification(
        'test-device-2',
        'Метрологическая служба',
        'user-1',
        '2024-12-31',
        'Плановая поверка',
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('нельзя отправить');
    });

    it('должен отказывать если уже есть активная отправка', () => {
      sendToVerification(
        'test-device-1',
        'Метрологическая служба',
        'user-1',
        '2024-12-31',
        'Плановая поверка',
        'user-1'
      );

      const result = sendToVerification(
        'test-device-1',
        'Другая служба',
        'user-1',
        '2024-12-31',
        'Ещё одна поверка',
        'user-1'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('уже отправлен');
    });
  });

  describe('completeSendoff', () => {
    it('должен завершать отправку', () => {
      const sendoffResult = sendToVerification(
        'test-device-1',
        'Метрологическая служба',
        'user-1',
        '2024-12-31',
        'Плановая поверка',
        'user-1'
      );

      const result = completeSendoff(sendoffResult.sendoff!.id, 'protocol-1', 'user-1');

      expect(result.success).toBe(true);

      const sendoffs = (store as any)._getSendoffs();
      const sendoff = sendoffs.find((s: any) => s.id === sendoffResult.sendoff!.id);
      expect(sendoff.status).toBe('returned');
      expect(sendoff.protocolId).toBe('protocol-1');
    });
  });

  describe('getOverdueSendoffs', () => {
    it('должен возвращать просроченные отправки', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      store.addSendoff({
        instrumentId: 'test-device-1',
        destination: 'Метрологическая служба',
        sentAt: new Date().toISOString(),
        responsibleId: 'user-1',
        expectedReturnDate: yesterday.toISOString().split('T')[0],
        status: 'sent',
        returnedAt: null,
        protocolId: null,
        comment: 'Плановая поверка',
      });

      const overdue = getOverdueSendoffs();
      expect(overdue.length).toBe(1);
    });

    it('не должен возвращать отправки с будущей датой возврата', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      store.addSendoff({
        instrumentId: 'test-device-1',
        destination: 'Метрологическая служба',
        sentAt: new Date().toISOString(),
        responsibleId: 'user-1',
        expectedReturnDate: tomorrow.toISOString().split('T')[0],
        status: 'sent',
        returnedAt: null,
        protocolId: null,
        comment: 'Плановая поверка',
      });

      const overdue = getOverdueSendoffs();
      expect(overdue.length).toBe(0);
    });
  });

  describe('getActiveSendoff', () => {
    it('должен возвращать активную отправку', () => {
      const sendoffResult = sendToVerification(
        'test-device-1',
        'Метрологическая служба',
        'user-1',
        '2024-12-31',
        'Плановая поверка',
        'user-1'
      );

      const active = getActiveSendoff('test-device-1');
      expect(active).toBeDefined();
      expect(active?.id).toBe(sendoffResult.sendoff?.id);
    });

    it('не должен возвращать завершённую отправку', () => {
      const sendoffResult = sendToVerification(
        'test-device-1',
        'Метрологическая служба',
        'user-1',
        '2024-12-31',
        'Плановая поверка',
        'user-1'
      );

      completeSendoff(sendoffResult.sendoff!.id, 'protocol-1', 'user-1');

      const active = getActiveSendoff('test-device-1');
      expect(active).toBeUndefined();
    });
  });
});
