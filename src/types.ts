export type Role = 'guest' | 'metrologist';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: Role;
}

export interface Department {
  id: string;
  name: string;
  code: string;
}

export interface Employee {
  id: string;
  fullName: string;
  tabNumber: string;
  departmentId: string;
  comment: string;
  warehouseId: string;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
}

export interface CustomField {
  id: string;
  name: string;
  type: 'number' | 'range';
  unit?: string;
  minValue?: number;
  maxValue?: number;
}

export interface InstrumentCategory {
  id: string;
  name: string;
  description?: string;
  fields: CustomField[];
  createdAt: string;
}

export interface CategoryTemplate {
  category: string;
  fields: CustomField[];
}

export interface SavedFilter {
  id: string;
  name: string;
  category: string;
  conditions: FilterCondition[];
  createdAt: string;
}

export interface FilterCondition {
  fieldId: string;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'between' | 'in_range';
  value: string | number | [number, number];
}

export interface MeasuringInstrument {
  id: string;
  inventoryNumber: string;
  name: string;
  category: string;
  type: string;
  serialNumber: string;
  manufacturer: string;
  range: string;
  accuracy: string;
  status: 'available' | 'issued' | 'repair' | 'decommissioned' | 'verification';
  lastVerificationDate: string | null;
  intervalMonths: number;
  nextVerificationDate: string | null;
  location: string;
  warehouseId: string | null;
  photo?: string;
  customFields: Record<string, string | number>;
}

export interface IssueRecord {
  id: string;
  instrumentId: string;
  employeeId: string;
  issuedBy: string;
  issuedAt: string;
  returnedAt: string | null;
  returnedBy: string | null;
  note: string;
  originalWarehouseId: string | null;
}

export interface OperationLog {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
}

export interface ScannerEvent {
  id: string;
  timestamp: string;
  barcode: string;
  rssi: number;
  online: boolean;
}

export type BlockReason = 'expired_verification' | 'already_issued' | 'insufficient_role' | 'decommissioned' | 'in_repair' | 'in_verification' | null;

export interface IssueResult {
  success: boolean;
  reason: BlockReason;
  message: string;
}

export interface DashboardStats {
  totalInstruments: number;
  available: number;
  issued: number;
  expiredVerification: number;
  verificationDueSoon: number;
  totalEmployees: number;
  totalDepartments: number;
}

// === Регистрация поверок (упрощённая форма без ручного ввода точек) ===

export interface VerificationSendoff {
  id: string;
  instrumentId: string;
  destination: string;
  sentAt: string;
  responsibleId: string | null;
  expectedReturnDate: string | null;
  status: 'sent' | 'returned';
  returnedAt: string | null;
  protocolId: string | null;
  comment: string;
}

export interface VerificationPoint {
  id: string;
  name: string;                    // Название точки (например, "100 В DC")
  nominal: number;                 // Номинальное значение
  unit: string;                    // Единица измерения (В, А, Ом и т.д.)
  actual?: number;                 // Фактическое значение (вводится поверителем)
  error?: number;                  // Погрешность (рассчитывается автоматически)
  tolerance: number;               // Допуск (максимальная погрешность)
  verdict?: 'pass' | 'fail';       // Вердикт (рассчитывается автоматически)
}

export interface VerificationProtocol {
  id: string;
  deviceId: string;                // ID средства измерений
  instrumentInventoryNumber: string; // Снапшот инвентарного номера
  instrumentName: string;          // Снапшот наименования
  operatorId: string;              // ID поверителя (сотрудника)
  dateStart: string;               // Дата начала поверки (ISO)
  dateEnd?: string;                // Дата завершения поверки (ISO)
  status: 'draft' | 'in_progress' | 'completed' | 'rejected';
  result?: 'pass' | 'fail';        // Итоговый вердикт
  points: VerificationPoint[];     // Точки измерений
  conditions?: {                   // Влияющие величины (опционально)
    temperature?: number;
    humidity?: number;
  };
  notes?: string;                  // Примечания
  rejectionReason?: string;        // Причина отклонения
  createdAt: string;               // Дата создания протокола
  updatedAt: string;               // Дата последнего обновления
}
