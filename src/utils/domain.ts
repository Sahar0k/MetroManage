import { MeasuringInstrument, IssueRecord, BlockReason, IssueResult, Role } from '../types';

export function addMonths(date: Date, months: number): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  const targetMonth = month + months;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  const daysInTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const clampedDay = Math.min(day, daysInTargetMonth);

  return new Date(targetYear, normalizedMonth, clampedDay);
}

export function calculateNextVerification(lastVerificationDate: string | null, intervalMonths: number): string | null {
  if (!lastVerificationDate) return null;
  const lastDate = new Date(lastVerificationDate);
  const nextDate = addMonths(lastDate, intervalMonths);
  return nextDate.toISOString().split('T')[0];
}

export function isVerificationExpired(instrument: MeasuringInstrument): boolean {
  if (!instrument.nextVerificationDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDate = new Date(instrument.nextVerificationDate);
  return nextDate < today;
}

export function isVerificationDueSoon(instrument: MeasuringInstrument, daysThreshold: number = 30): boolean {
  if (!instrument.nextVerificationDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDate = new Date(instrument.nextVerificationDate);
  const diffMs = nextDate.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= daysThreshold;
}

export function canIssueInstrument(instrument: MeasuringInstrument, userRole: Role): IssueResult {
  if (userRole === 'guest') {
    return { success: false, reason: 'insufficient_role', message: 'Недостаточно прав для выдачи СИ' };
  }
  if (instrument.status === 'decommissioned') {
    return { success: false, reason: 'decommissioned', message: 'СИ списано и не может быть выдано' };
  }
  if (instrument.status === 'repair') {
    return { success: false, reason: 'in_repair', message: 'СИ находится в ремонте' };
  }
  if (instrument.status === 'verification') {
    return { success: false, reason: 'in_verification', message: 'СИ находится на поверке' };
  }
  if (instrument.status === 'issued') {
    return { success: false, reason: 'already_issued', message: 'СИ уже выдано другому сотруднику' };
  }
  if (isVerificationExpired(instrument)) {
    return { success: false, reason: 'expired_verification', message: 'Поверка СИ просрочена — выдача заблокирована' };
  }
  return { success: true, reason: null, message: 'СИ доступно для выдачи' };
}

export function canReturnInstrument(record: IssueRecord, userRole: Role): { success: boolean; message: string } {
  if (userRole === 'guest') {
    return { success: false, message: 'Недостаточно прав для возврата СИ' };
  }
  if (record.returnedAt !== null) {
    return { success: false, message: 'СИ уже возвращено' };
  }
  return { success: true, message: 'СИ можно вернуть' };
}

export function getRoleLabel(role: Role): string {
  switch (role) {
    case 'guest': return 'Гость';
    case 'metrologist': return 'Метролог';
    default: return role;
  }
}

export function hasPermission(role: Role, action: 'issue' | 'return' | 'edit_instruments' | 'manage_users' | 'manage_departments' | 'view_all'): boolean {
  const permissions: Record<Role, string[]> = {
    guest: ['view_all'],
    metrologist: ['view_all', 'issue', 'return', 'edit_instruments', 'manage_users', 'manage_departments'],
  };
  return permissions[role]?.includes(action) ?? false;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}
