import { store } from '../store';
import { VerificationSendoff } from '../types';

/**
 * Сервис для управления логистикой поверки (отправка и возврат)
 */

/**
 * Отправить прибор на поверку
 */
export function sendToVerification(
  instrumentId: string,
  destination: string,
  responsibleId: string | null,
  expectedReturnDate: string | null,
  comment: string,
  userId: string
): { success: boolean; message: string; sendoff?: VerificationSendoff } {
  const instrument = store.getInstruments().find(i => i.id === instrumentId);
  if (!instrument) {
    return { success: false, message: 'Прибор не найден' };
  }

  // Проверка статуса
  if (instrument.status !== 'available') {
    return { 
      success: false, 
      message: `Нельзя отправить на поверку: прибор в статусе "${instrument.status}"` 
    };
  }

  // Проверка активной отправки
  const activeSendoff = store.getSendoffs().find(
    s => s.instrumentId === instrumentId && s.status === 'sent'
  );
  if (activeSendoff) {
    return { 
      success: false, 
      message: 'Прибор уже отправлен на поверку' 
    };
  }

  // Создаём отправку
  const sendoff = store.addSendoff({
    instrumentId,
    destination,
    sentAt: new Date().toISOString(),
    responsibleId,
    expectedReturnDate,
    status: 'sent',
    returnedAt: null,
    protocolId: null,
    comment,
  });

  // Обновляем статус прибора
  store.updateInstrument(instrumentId, { status: 'verification' });

  // Записываем в OperationLog
  store.addOperation({
    userId,
    action: 'update',
    entityType: 'instrument',
    entityId: instrumentId,
    details: `Отправлен на поверку в ${destination}`,
  });

  return { success: true, message: 'Прибор отправлен на поверку', sendoff };
}

/**
 * Завершить отправку (возврат с поверки)
 */
export function completeSendoff(
  sendoffId: string,
  protocolId: string,
  userId: string
): { success: boolean; message: string } {
  const sendoff = store.getSendoffs().find(s => s.id === sendoffId);
  if (!sendoff) {
    return { success: false, message: 'Отправка не найдена' };
  }

  if (sendoff.status === 'returned') {
    return { success: false, message: 'Отправка уже завершена' };
  }

  // Обновляем отправку
  store.updateSendoff(sendoffId, {
    status: 'returned',
    returnedAt: new Date().toISOString(),
    protocolId,
  });

  // Записываем в OperationLog
  store.addOperation({
    userId,
    action: 'update',
    entityType: 'instrument',
    entityId: sendoff.instrumentId,
    details: 'Возврат с поверки',
  });

  return { success: true, message: 'Прибор возвращён с поверки' };
}

/**
 * Получить просроченные отправки
 */
export function getOverdueSendoffs(): VerificationSendoff[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return store.getSendoffs().filter(sendoff => {
    if (sendoff.status !== 'sent') return false;
    if (!sendoff.expectedReturnDate) return false;
    
    const expectedDate = new Date(sendoff.expectedReturnDate);
    expectedDate.setHours(0, 0, 0, 0);
    
    return expectedDate < today;
  });
}

/**
 * Получить активную отправку для прибора
 */
export function getActiveSendoff(instrumentId: string): VerificationSendoff | undefined {
  return store.getSendoffs().find(
    s => s.instrumentId === instrumentId && s.status === 'sent'
  );
}

/**
 * Получить все отправки для прибора
 */
export function getSendoffsForInstrument(instrumentId: string): VerificationSendoff[] {
  return store.getSendoffs().filter(s => s.instrumentId === instrumentId);
}
