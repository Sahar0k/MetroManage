/**
 * StorageAdapter - интерфейс для работы с данными
 * Определяет контракт для различных источников данных (localStorage, PocketBase, etc.)
 */

import {
  MeasuringInstrument,
  Employee,
  Department,
  Warehouse,
  InstrumentCategory,
  IssueRecord,
  VerificationSendoff,
  VerificationProtocol,
  SavedFilter,
  OperationLog,
  User,
} from '../../types';

export interface StorageAdapter {
  // Instruments
  getInstruments(): MeasuringInstrument[];
  addInstrument(instrument: Omit<MeasuringInstrument, 'id'>): MeasuringInstrument;
  updateInstrument(id: string, updates: Partial<MeasuringInstrument>): void;
  deleteInstrument(id: string): void;

  // Employees
  getEmployees(): Employee[];
  addEmployee(employee: Omit<Employee, 'id'>): Employee;
  updateEmployee(id: string, updates: Partial<Employee>): void;
  deleteEmployee(id: string): void;

  // Departments
  getDepartments(): Department[];
  addDepartment(department: Omit<Department, 'id'>): Department;
  updateDepartment(id: string, updates: Partial<Department>): void;
  deleteDepartment(id: string): { success: boolean; message: string };

  // Warehouses
  getWarehouses(): Warehouse[];
  addWarehouse(warehouse: Omit<Warehouse, 'id'>): Warehouse;
  updateWarehouse(id: string, updates: Partial<Warehouse>): void;
  deleteWarehouse(id: string): { success: boolean; message: string };

  // Categories
  getCategories(): InstrumentCategory[];
  addCategory(category: Omit<InstrumentCategory, 'id' | 'createdAt'>): InstrumentCategory;
  updateCategory(id: string, updates: Partial<Omit<InstrumentCategory, 'id' | 'createdAt'>>): void;
  deleteCategory(id: string): { success: boolean; message: string };

  // Issue Records
  getIssues(): IssueRecord[];
  addIssue(issue: Omit<IssueRecord, 'id'>): IssueRecord;
  returnInstrument(issueId: string, userId: string): void;

  // Verification Sendoffs
  getSendoffs(): VerificationSendoff[];
  addSendoff(sendoff: Omit<VerificationSendoff, 'id'>): VerificationSendoff;
  updateSendoff(id: string, updates: Partial<VerificationSendoff>): VerificationSendoff | null;
  deleteSendoff(id: string): boolean;

  // Verification Protocols
  getProtocols(): VerificationProtocol[];
  addProtocol(protocol: Omit<VerificationProtocol, 'id' | 'createdAt' | 'updatedAt'>): VerificationProtocol;
  updateProtocol(id: string, updates: Partial<VerificationProtocol>): VerificationProtocol | null;
  deleteProtocol(id: string): boolean;

  // Saved Filters
  getSavedFilters(): SavedFilter[];
  saveFilter(filter: Omit<SavedFilter, 'id' | 'createdAt'>): string;
  deleteFilter(filterId: string): void;
  updateFilter(filterId: string, updates: Partial<SavedFilter>): void;

  // Operation Logs
  getOperations(): OperationLog[];
  addOperation(op: Omit<OperationLog, 'id' | 'timestamp'>): OperationLog;

  // Users (для серверного режима)
  getCurrentUser(): User | null;
  setCurrentUser(user: User | null): void;

  // Attachments (файлы)
  saveAttachment(id: string, data: string): void;
  getAttachment(id: string): string | null;

  // Служебные методы
  isConnected(): Promise<boolean>;
  getStats(): Promise<{ local: number; remote: number }>;
}
