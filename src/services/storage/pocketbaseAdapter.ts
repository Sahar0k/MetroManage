/**
 * PocketBaseAdapter - адаптер для работы с PocketBase
 * Использует PocketBase SDK для серверного хранения данных
 */

import PocketBase from 'pocketbase';
import { StorageAdapter } from './StorageAdapter';
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

export class PocketBaseAdapter implements StorageAdapter {
  private pb: PocketBase;
  private baseUrl: string;

  constructor(baseUrl: string = 'http://127.0.0.1:8090') {
    this.baseUrl = baseUrl;
    this.pb = new PocketBase(baseUrl);
  }

  private async ensureAuth(): Promise<void> {
    if (!this.pb.authStore.isValid) {
      // В режиме отладки используем тестового пользователя
      try {
        await this.pb.collection('users').authWithPassword('admin@test.com', 'admin123');
      } catch (error) {
        console.warn('PocketBase auth failed, continuing without auth');
      }
    }
  }

  // Instruments
  getInstruments(): MeasuringInstrument[] {
    // Синхронный метод - возвращаем пустой массив, реальная загрузка через async
    return [];
  }

  async getInstrumentsAsync(): Promise<MeasuringInstrument[]> {
    await this.ensureAuth();
    try {
      const records = await this.pb.collection('instruments').getFullList();
      return records.map((r: any) => ({
        id: r.id,
        inventoryNumber: r.inventoryNumber,
        name: r.name,
        category: r.category,
        type: r.type,
        serialNumber: r.serialNumber,
        manufacturer: r.manufacturer,
        range: r.range,
        accuracy: r.accuracy,
        status: r.status,
        lastVerificationDate: r.lastVerificationDate,
        intervalMonths: r.intervalMonths,
        nextVerificationDate: r.nextVerificationDate,
        location: r.location,
        warehouseId: r.warehouseId,
        customFields: r.customFields || {},
      }));
    } catch (error) {
      console.error('Failed to get instruments:', error);
      return [];
    }
  }

  addInstrument(instrument: Omit<MeasuringInstrument, 'id'>): MeasuringInstrument {
    // Синхронный метод - заглушка
    return { ...instrument, id: 'temp-' + Date.now() } as MeasuringInstrument;
  }

  async addInstrumentAsync(instrument: Omit<MeasuringInstrument, 'id'>): Promise<MeasuringInstrument> {
    await this.ensureAuth();
    try {
      const record = await this.pb.collection('instruments').create(instrument);
      return record as unknown as MeasuringInstrument;
    } catch (error) {
      console.error('Failed to add instrument:', error);
      throw error;
    }
  }

  updateInstrument(id: string, updates: Partial<MeasuringInstrument>): void {
    // Синхронный метод - заглушка
  }

  async updateInstrumentAsync(id: string, updates: Partial<MeasuringInstrument>): Promise<void> {
    await this.ensureAuth();
    try {
      await this.pb.collection('instruments').update(id, updates);
    } catch (error) {
      console.error('Failed to update instrument:', error);
      throw error;
    }
  }

  deleteInstrument(id: string): void {
    // Синхронный метод - заглушка
  }

  async deleteInstrumentAsync(id: string): Promise<void> {
    await this.ensureAuth();
    try {
      await this.pb.collection('instruments').delete(id);
    } catch (error) {
      console.error('Failed to delete instrument:', error);
      throw error;
    }
  }

  // Заглушки для остальных методов (аналогичная структура)
  getEmployees(): Employee[] { return []; }
  addEmployee(employee: Omit<Employee, 'id'>): Employee { return { ...employee, id: 'temp' } as Employee; }
  updateEmployee(id: string, updates: Partial<Employee>): void {}
  deleteEmployee(id: string): void {}

  getDepartments(): Department[] { return []; }
  addDepartment(department: Omit<Department, 'id'>): Department { return { ...department, id: 'temp' } as Department; }
  updateDepartment(id: string, updates: Partial<Department>): void {}
  deleteDepartment(id: string): { success: boolean; message: string } { return { success: true, message: '' }; }

  getWarehouses(): Warehouse[] { return []; }
  addWarehouse(warehouse: Omit<Warehouse, 'id'>): Warehouse { return { ...warehouse, id: 'temp' } as Warehouse; }
  updateWarehouse(id: string, updates: Partial<Warehouse>): void {}
  deleteWarehouse(id: string): { success: boolean; message: string } { return { success: true, message: '' }; }

  getCategories(): InstrumentCategory[] { return []; }
  addCategory(category: Omit<InstrumentCategory, 'id' | 'createdAt'>): InstrumentCategory { return { ...category, id: 'temp', createdAt: '' } as InstrumentCategory; }
  updateCategory(id: string, updates: Partial<Omit<InstrumentCategory, 'id' | 'createdAt'>>): void {}
  deleteCategory(id: string): { success: boolean; message: string } { return { success: true, message: '' }; }

  getIssues(): IssueRecord[] { return []; }
  addIssue(issue: Omit<IssueRecord, 'id'>): IssueRecord { return { ...issue, id: 'temp' } as IssueRecord; }
  returnInstrument(issueId: string, userId: string): void {}

  getSendoffs(): VerificationSendoff[] { return []; }
  addSendoff(sendoff: Omit<VerificationSendoff, 'id'>): VerificationSendoff { return { ...sendoff, id: 'temp' } as VerificationSendoff; }
  updateSendoff(id: string, updates: Partial<VerificationSendoff>): VerificationSendoff | null { return null; }
  deleteSendoff(id: string): boolean { return true; }

  getProtocols(): VerificationProtocol[] { return []; }
  addProtocol(protocol: Omit<VerificationProtocol, 'id' | 'createdAt' | 'updatedAt'>): VerificationProtocol { return { ...protocol, id: 'temp', createdAt: '', updatedAt: '' } as VerificationProtocol; }
  updateProtocol(id: string, updates: Partial<VerificationProtocol>): VerificationProtocol | null { return null; }
  deleteProtocol(id: string): boolean { return true; }

  getSavedFilters(): SavedFilter[] { return []; }
  saveFilter(filter: Omit<SavedFilter, 'id' | 'createdAt'>): string { return 'temp'; }
  deleteFilter(filterId: string): void {}
  updateFilter(filterId: string, updates: Partial<SavedFilter>): void {}

  getOperations(): OperationLog[] { return []; }
  addOperation(op: Omit<OperationLog, 'id' | 'timestamp'>): OperationLog { return { ...op, id: 'temp', timestamp: '' } as OperationLog; }

  getCurrentUser(): User | null {
    if (this.pb.authStore.isValid && this.pb.authStore.model) {
      return {
        id: this.pb.authStore.model.id,
        username: this.pb.authStore.model.email || '',
        fullName: this.pb.authStore.model.name || '',
        role: 'metrologist',
      };
    }
    return null;
  }

  setCurrentUser(user: User | null): void {
    // В PocketBase авторизация управляется через SDK
  }

  saveAttachment(id: string, data: string): void {
    // Заглушка
  }

  getAttachment(id: string): string | null {
    return null;
  }

  async isConnected(): Promise<boolean> {
    try {
      const health = await this.pb.health.check();
      return health.code === 200;
    } catch (error) {
      return false;
    }
  }

  async getStats(): Promise<{ local: number; remote: number }> {
    try {
      await this.ensureAuth();
      const instruments = await this.pb.collection('instruments').getFullList();
      return { local: 0, remote: instruments.length };
    } catch (error) {
      return { local: 0, remote: 0 };
    }
  }

  // Методы для проверки соединения
  async checkConnection(): Promise<{ success: boolean; version?: string; error?: string }> {
    try {
      const health = await this.pb.health.check();
      return {
        success: health.code === 200,
        version: (health as any).version,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
