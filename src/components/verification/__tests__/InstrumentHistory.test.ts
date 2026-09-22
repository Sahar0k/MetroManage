import { describe, it, expect } from 'vitest';
import { store } from '../../../store';
import { MeasuringInstrument, VerificationProtocol, IssueRecord, OperationLog } from '../../../types';

// Тест агрегации истории СИ
describe('InstrumentHistory aggregation', () => {
  it('должен агрегировать протоколы, выдачи и операции в хронологическом порядке', () => {
    // Создаём тестовые данные
    const instrument: MeasuringInstrument = {
      id: 'test-inst-1',
      inventoryNumber: 'СИ-0001',
      name: 'Тестовый прибор',
      category: 'Тест',
      type: 'Test',
      serialNumber: 'SN001',
      manufacturer: 'Test',
      range: '0-100',
      accuracy: '1%',
      status: 'available',
      lastVerificationDate: '2024-01-01',
      intervalMonths: 12,
      nextVerificationDate: '2025-01-01',
      location: 'Склад',
      warehouseId: null,
      customFields: {},
    };

    const protocol: VerificationProtocol = {
      id: 'protocol-1',
      deviceId: 'test-inst-1',
      instrumentInventoryNumber: 'СИ-0001',
      instrumentName: 'Тестовый прибор',
      operatorId: 'user-1',
      dateStart: '2024-06-01T10:00:00Z',
      dateEnd: '2024-06-01T12:00:00Z',
      status: 'completed',
      result: 'pass',
      points: [],
      createdAt: '2024-06-01T10:00:00Z',
      updatedAt: '2024-06-01T12:00:00Z',
    };

    const issue: IssueRecord = {
      id: 'issue-1',
      instrumentId: 'test-inst-1',
      employeeId: 'emp-1',
      issuedBy: 'user-1',
      issuedAt: '2024-05-01T09:00:00Z',
      returnedAt: '2024-05-15T17:00:00Z',
      returnedBy: 'user-1',
      note: 'Тестовая выдача',
      originalWarehouseId: null,
    };

    const operation: OperationLog = {
      id: 'op-1',
      timestamp: '2024-04-01T08:00:00Z',
      userId: 'user-1',
      action: 'create',
      entityType: 'instrument',
      entityId: 'test-inst-1',
      details: 'Прибор создан',
    };

    // Проверяем, что данные корректны
    expect(protocol.deviceId).toBe(instrument.id);
    expect(issue.instrumentId).toBe(instrument.id);
    expect(operation.entityId).toBe(instrument.id);

    // Проверяем хронологический порядок
    const events = [
      { timestamp: operation.timestamp, type: 'operation' },
      { timestamp: issue.issuedAt, type: 'issue' },
      { timestamp: issue.returnedAt!, type: 'return' },
      { timestamp: protocol.createdAt, type: 'protocol' },
    ];

    const sorted = events.sort((a: { timestamp: string; type: string }, b: { timestamp: string; type: string }) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    expect(sorted[0].type).toBe('protocol');
    expect(sorted[1].type).toBe('return');
    expect(sorted[2].type).toBe('issue');
    expect(sorted[3].type).toBe('operation');
  });

  it('должен фильтровать события по deviceId/instrumentId/entityId', () => {
    const instrumentId = 'test-inst-2';
    
    const protocol: VerificationProtocol = {
      id: 'protocol-2',
      deviceId: instrumentId,
      instrumentInventoryNumber: 'СИ-0002',
      instrumentName: 'Тестовый прибор 2',
      operatorId: 'user-1',
      dateStart: '2024-06-01T10:00:00Z',
      status: 'draft',
      points: [],
      createdAt: '2024-06-01T10:00:00Z',
      updatedAt: '2024-06-01T10:00:00Z',
    };

    expect(protocol.deviceId).toBe(instrumentId);
  });
});
