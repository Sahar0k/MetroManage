import { v4 as uuidv4 } from 'uuid';
import { store } from '../store';
import { VerificationProtocol, VerificationPoint, MeasuringInstrument } from '../types';
import { calculateNextVerification } from '../utils/domain';

/**
 * Модуль «Рабочее место поверителя»
 * 
 * Бизнес-логика:
 * - создание протокола поверки с снапшотом данных СИ
 * - авторасчёт погрешности и вердикта по точкам
 * - управление жизненным циклом СИ при смене статуса протокола
 * - журналирование операций
 */

const EPSILON = 1e-9;

/**
 * Расчёт погрешности: |actual - nominal|
 */
export function calculateError(actual: number, nominal: number): number {
  return Math.abs(actual - nominal);
}

/**
 * Автовынесение вердикта по допуску
 * С учётом epsilon для корректной обработки пограничных значений
 * (0.10000000000000009 при tolerance 0.1 → pass)
 */
export function calculateVerdict(error: number, tolerance: number): 'pass' | 'fail' {
  return error <= tolerance + EPSILON ? 'pass' : 'fail';
}

/**
 * Вычисление итогового результата протокола
 */
export function calculateProtocolResult(points: VerificationPoint[]): 'pass' | 'fail' | undefined {
  const allHaveVerdict = points.every(p => p.verdict !== undefined);
  if (!allHaveVerdict) return undefined;
  return points.every(p => p.verdict === 'pass') ? 'pass' : 'fail';
}

/**
 * Обновление точки с авторасчётом погрешности и вердикта
 */
export function updatePointWithCalculation(point: VerificationPoint, actual: number): VerificationPoint {
  const error = calculateError(actual, point.nominal);
  const verdict = calculateVerdict(error, point.tolerance);
  return { ...point, actual, error, verdict };
}

/**
 * Создание нового протокола поверки
 */
export function createProtocol(
  deviceId: string,
  operatorId: string,
  points: Omit<VerificationPoint, 'id'>[],
  conditions?: { temperature?: number; humidity?: number },
  notes?: string
): VerificationProtocol {
  const instrument = store.getInstruments().find(i => i.id === deviceId);
  if (!instrument) {
    throw new Error('Средство измерений не найдено');
  }

  const pointsWithIds: VerificationPoint[] = points.map(p => ({
    ...p,
    id: uuidv4(),
  }));

  const protocol = store.addProtocol({
    deviceId,
    instrumentInventoryNumber: instrument.inventoryNumber,
    instrumentName: instrument.name,
    operatorId,
    dateStart: new Date().toISOString(),
    status: 'draft',
    points: pointsWithIds,
    conditions,
    notes,
  });

  // Логируем создание
  store.addOperation({
    userId: operatorId,
    action: 'create',
    entityType: 'protocol',
    entityId: protocol.id,
    details: `Создан протокол поверки для ${instrument.inventoryNumber}`,
  });

  return protocol;
}

/**
 * Перевод протокола в статус 'in_progress'
 * При этом СИ переходит в статус 'verification'
 */
export function startVerification(protocolId: string, userId: string): VerificationProtocol | null {
  const protocol = store.getProtocols().find(p => p.id === protocolId);
  if (!protocol) return null;

  if (protocol.status !== 'draft') {
    throw new Error('Начать поверку можно только с черновика');
  }

  const updated = store.updateProtocol(protocolId, { status: 'in_progress' });
  if (!updated) return null;

  // Переводим СИ в статус 'verification'
  store.updateInstrument(protocol.deviceId, { status: 'verification' });

  // Логируем
  store.addOperation({
    userId,
    action: 'update',
    entityType: 'protocol',
    entityId: protocolId,
    details: `Начата поверка ${updated.instrumentInventoryNumber}`,
  });

  return updated;
}

/**
 * Обновление точки в протоколе
 */
export function updateProtocolPoint(
  protocolId: string,
  pointId: string,
  actual: number,
  userId: string
): VerificationProtocol | null {
  const protocol = store.getProtocols().find(p => p.id === protocolId);
  if (!protocol) return null;

  // Проверка read-only
  if (protocol.status === 'completed' || protocol.status === 'rejected') {
    throw new Error('Нельзя изменять завершённый или отклонённый протокол');
  }

  const updatedPoints = protocol.points.map(p => {
    if (p.id === pointId) {
      return updatePointWithCalculation(p, actual);
    }
    return p;
  });

  return store.updateProtocol(protocolId, { points: updatedPoints });
}

/**
 * Завершение протокола поверки
 * 
 * Жизненный цикл СИ:
 * - если все точки 'pass' → instrument.status = 'available',
 *   lastVerificationDate = дата завершения,
 *   nextVerificationDate = дата завершения + intervalMonths
 * - если есть 'fail' → result = 'fail', instrument.status = 'repair'
 */
export function completeProtocol(protocolId: string, userId: string): VerificationProtocol | null {
  const protocol = store.getProtocols().find(p => p.id === protocolId);
  if (!protocol) return null;

  if (protocol.status === 'completed' || protocol.status === 'rejected') {
    throw new Error('Нельзя завершить завершённый или отклонённый протокол');
  }

  // Проверка: все точки должны иметь вердикт
  const allHaveVerdict = protocol.points.every(p => p.verdict !== undefined);
  if (!allHaveVerdict) {
    throw new Error('Нельзя завершить протокол: не все точки имеют вердикт');
  }

  const result = calculateProtocolResult(protocol.points);
  const dateEnd = new Date().toISOString();

  const updated = store.updateProtocol(protocolId, {
    status: 'completed',
    result,
    dateEnd,
  });

  if (!updated) return null;

  // Обновляем жизненный цикл СИ
  const instrument = store.getInstruments().find(i => i.id === protocol.deviceId);
  if (instrument) {
    if (result === 'pass') {
      // Все точки прошли — СИ доступно, обновляем даты поверки
      const nextVerificationDate = calculateNextVerification(
        dateEnd.split('T')[0],
        instrument.intervalMonths
      );
      store.updateInstrument(protocol.deviceId, {
        status: 'available',
        lastVerificationDate: dateEnd.split('T')[0],
        nextVerificationDate,
      });
    } else {
      // Есть fail — СИ в ремонт
      store.updateInstrument(protocol.deviceId, { status: 'repair' });
    }
  }

  // Логируем завершение
  store.addOperation({
    userId,
    action: result === 'pass' ? 'return' : 'update',
    entityType: 'protocol',
    entityId: protocolId,
    details: `Завершена поверка ${updated.instrumentInventoryNumber}: ${result === 'pass' ? 'ГОДЕН' : 'НЕ ГОДЕН'}`,
  });

  return updated;
}

/**
 * Отклонение протокола
 */
export function rejectProtocol(protocolId: string, reason: string, userId: string): VerificationProtocol | null {
  const protocol = store.getProtocols().find(p => p.id === protocolId);
  if (!protocol) return null;

  if (protocol.status === 'completed' || protocol.status === 'rejected') {
    throw new Error('Нельзя отклонить завершённый или отклонённый протокол');
  }

  const updated = store.updateProtocol(protocolId, {
    status: 'rejected',
    rejectionReason: reason,
  });

  if (!updated) return null;

  // СИ остаётся в статусе 'verification' или переводится в 'repair'
  store.updateInstrument(protocol.deviceId, { status: 'repair' });

  // Логируем
  store.addOperation({
    userId,
    action: 'delete',
    entityType: 'protocol',
    entityId: protocolId,
    details: `Отклонён протокол ${updated.instrumentInventoryNumber}: ${reason}`,
  });

  return updated;
}

/**
 * Получить протоколы по статусу
 */
export function getProtocolsByStatus(status?: VerificationProtocol['status']): VerificationProtocol[] {
  const protocols = store.getProtocols();
  if (!status) return protocols;
  return protocols.filter(p => p.status === status);
}

/**
 * Получить протокол по ID
 */
export function getProtocolById(id: string): VerificationProtocol | undefined {
  return store.getProtocols().find(p => p.id === id);
}

/**
 * Удалить протокол (только черновик)
 */
export function deleteProtocol(protocolId: string, userId: string): boolean {
  const protocol = store.getProtocols().find(p => p.id === protocolId);
  if (!protocol) return false;

  if (protocol.status === 'completed' || protocol.status === 'rejected') {
    throw new Error('Нельзя удалить завершённый или отклонённый протокол');
  }

  const result = store.deleteProtocol(protocolId);

  if (result) {
    store.addOperation({
      userId,
      action: 'delete',
      entityType: 'protocol',
      entityId: protocolId,
      details: `Удалён протокол ${protocol.instrumentInventoryNumber}`,
    });
  }

  return result;
}

/**
 * Проверка: есть ли у СИ активный протокол (не завершён и не отклонён)
 */
export function hasActiveProtocol(deviceId: string): boolean {
  return store.getProtocols().some(
    p => p.deviceId === deviceId && (p.status === 'draft' || p.status === 'in_progress')
  );
}
