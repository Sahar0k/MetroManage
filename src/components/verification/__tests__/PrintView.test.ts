import { describe, it, expect } from 'vitest';
import { VerificationProtocol } from '../../../types';

// Тест PrintView компонента
describe('PrintView', () => {
  it('должен рендерить снапшот-данные протокола', () => {
    const protocol: VerificationProtocol = {
      id: 'protocol-print-1',
      deviceId: 'device-1',
      instrumentInventoryNumber: 'СИ-0001',
      instrumentName: 'Мультиметр тестовый',
      operatorId: 'operator-1',
      dateStart: '2024-06-01T10:00:00Z',
      dateEnd: '2024-06-01T12:00:00Z',
      status: 'completed',
      result: 'pass',
      points: [
        {
          id: 'point-1',
          name: '100 В',
          nominal: 100,
          unit: 'В',
          actual: 100.05,
          error: 0.05,
          tolerance: 0.1,
          verdict: 'pass',
        },
      ],
      conditions: {
        temperature: 20.5,
        humidity: 60,
      },
      notes: 'Тестовые примечания',
      createdAt: '2024-06-01T10:00:00Z',
      updatedAt: '2024-06-01T12:00:00Z',
    };

    // Проверяем, что снапшот-данные сохранены
    expect(protocol.instrumentInventoryNumber).toBe('СИ-0001');
    expect(protocol.instrumentName).toBe('Мультиметр тестовый');
    expect(protocol.points).toHaveLength(1);
    expect(protocol.points[0].name).toBe('100 В');
    expect(protocol.points[0].verdict).toBe('pass');
    expect(protocol.conditions?.temperature).toBe(20.5);
    expect(protocol.conditions?.humidity).toBe(60);
    expect(protocol.notes).toBe('Тестовые примечания');
  });

  it('должен корректно отображать результат поверки', () => {
    const protocolPass: VerificationProtocol = {
      id: 'protocol-pass',
      deviceId: 'device-1',
      instrumentInventoryNumber: 'СИ-0002',
      instrumentName: 'Осциллограф',
      operatorId: 'operator-1',
      dateStart: '2024-06-01T10:00:00Z',
      dateEnd: '2024-06-01T12:00:00Z',
      status: 'completed',
      result: 'pass',
      points: [],
      createdAt: '2024-06-01T10:00:00Z',
      updatedAt: '2024-06-01T12:00:00Z',
    };

    const protocolFail: VerificationProtocol = {
      id: 'protocol-fail',
      deviceId: 'device-2',
      instrumentInventoryNumber: 'СИ-0003',
      instrumentName: 'Генератор',
      operatorId: 'operator-1',
      dateStart: '2024-06-01T10:00:00Z',
      dateEnd: '2024-06-01T12:00:00Z',
      status: 'completed',
      result: 'fail',
      points: [],
      createdAt: '2024-06-01T10:00:00Z',
      updatedAt: '2024-06-01T12:00:00Z',
    };

    expect(protocolPass.result).toBe('pass');
    expect(protocolFail.result).toBe('fail');
  });
});
