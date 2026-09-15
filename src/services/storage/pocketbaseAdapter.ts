/**
 * PocketBaseAdapter - адаптер для работы с PocketBase
 * Использует PocketBase SDK для серверного хранения данных
 * Реализует in-memory кэш с write-through стратегией
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
import { v4 as uuidv4 } from 'uuid';
import { calculateNextVerification } from '../../utils/domain';

export class PocketBaseAdapter implements StorageAdapter {
  private pb: PocketBase;
  private baseUrl: string;
  
  // In-memory cache
  private cache = {
    instruments: [] as MeasuringInstrument[],
    employees: [] as Employee[],
    departments: [] as Department[],
    warehouses: [] as Warehouse[],
    categories: [] as InstrumentCategory[],
    issues: [] as IssueRecord[],
    sendoffs: [] as VerificationSendoff[],
    protocols: [] as VerificationProtocol[],
    filters: [] as SavedFilter[],
    operations: [] as OperationLog[],
  };
  
  private initialized = false;

  constructor(baseUrl: string = 'http://127.0.0.1:8090') {
    this.baseUrl = baseUrl;
    this.pb = new PocketBase(baseUrl);
  }

  /**
   * Инициализация адаптера: загрузка всех данных в кэш
   */
  async initStorage(): Promise<void> {
    if (this.initialized) return;
    
    if (!this.pb.authStore.isValid) {
      throw new Error('NotAuthenticated: необходимо войти в систему');
    }

    try {
      // Загружаем все сущности параллельно
      const [instruments, employees, departments, warehouses, categories, issues, sendoffs, protocols, filters, operations] = await Promise.all([
        this.pb.collection('instruments').getFullList(),
        this.pb.collection('employees').getFullList(),
        this.pb.collection('departments').getFullList(),
        this.pb.collection('warehouses').getFullList(),
        this.pb.collection('categories').getFullList(),
        this.pb.collection('issues').getFullList(),
        this.pb.collection('sendoffs').getFullList(),
        this.pb.collection('protocols').getFullList(),
        this.pb.collection('filters').getFullList(),
        this.pb.collection('operations').getFullList(),
      ]);

      // Заполняем кэш
      this.cache.instruments = instruments.map((r: any) => this.mapInstrument(r));
      this.cache.employees = employees.map((r: any) => this.mapEmployee(r));
      this.cache.departments = departments.map((r: any) => this.mapDepartment(r));
      this.cache.warehouses = warehouses.map((r: any) => this.mapWarehouse(r));
      this.cache.categories = categories.map((r: any) => this.mapCategory(r));
      this.cache.issues = issues.map((r: any) => this.mapIssue(r));
      this.cache.sendoffs = sendoffs.map((r: any) => this.mapSendoff(r));
      this.cache.protocols = protocols.map((r: any) => this.mapProtocol(r));
      this.cache.filters = filters.map((r: any) => this.mapFilter(r));
      this.cache.operations = operations.map((r: any) => this.mapOperation(r));

      this.initialized = true;
    } catch (error) {
      throw new Error(`InitStorage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // === Mapping helpers ===

  private mapInstrument(r: any): MeasuringInstrument {
    return {
      id: r.id,
      inventoryNumber: r.inventoryNumber || '',
      name: r.name || '',
      category: r.category || '',
      type: r.type || '',
      serialNumber: r.serialNumber || '',
      manufacturer: r.manufacturer || '',
      range: r.range || '',
      accuracy: r.accuracy || '',
      status: r.status || 'available',
      lastVerificationDate: r.lastVerificationDate || null,
      intervalMonths: r.intervalMonths || 12,
      nextVerificationDate: r.nextVerificationDate || null,
      location: r.location || '',
      warehouseId: r.warehouseId || null,
      customFields: r.customFields || {},
    };
  }

  private mapEmployee(r: any): Employee {
    return {
      id: r.id,
      fullName: r.fullName || '',
      tabNumber: r.tabNumber || '',
      departmentId: r.departmentId || '',
      comment: r.comment || '',
      warehouseId: r.warehouseId || null,
    };
  }

  private mapDepartment(r: any): Department {
    return {
      id: r.id,
      name: r.name || '',
      code: r.code || '',
    };
  }

  private mapWarehouse(r: any): Warehouse {
    return {
      id: r.id,
      name: r.name || '',
      location: r.location || '',
    };
  }

  private mapCategory(r: any): InstrumentCategory {
    return {
      id: r.id,
      name: r.name || '',
      description: r.description || '',
      fields: r.fields || [],
      createdAt: r.created || new Date().toISOString(),
    };
  }

  private mapIssue(r: any): IssueRecord {
    return {
      id: r.id,
      instrumentId: r.instrumentId || '',
      employeeId: r.employeeId || '',
      issuedBy: r.issuedBy || '',
      issuedAt: r.issuedAt || new Date().toISOString(),
      returnedAt: r.returnedAt || null,
      returnedBy: r.returnedBy || null,
      note: r.note || '',
      originalWarehouseId: r.originalWarehouseId || null,
    };
  }

  private mapSendoff(r: any): VerificationSendoff {
    return {
      id: r.id,
      instrumentId: r.instrumentId || '',
      destination: r.destination || '',
      sentAt: r.sentAt || new Date().toISOString(),
      responsibleId: r.responsibleId || null,
      expectedReturnDate: r.expectedReturnDate || null,
      status: r.status || 'sent',
      returnedAt: r.returnedAt || null,
      protocolId: r.protocolId || null,
      comment: r.comment || '',
    };
  }

  private mapProtocol(r: any): VerificationProtocol {
    return {
      id: r.id,
      deviceId: r.deviceId || '',
      instrumentInventoryNumber: r.instrumentInventoryNumber || '',
      instrumentName: r.instrumentName || '',
      operatorId: r.operatorId || '',
      dateStart: r.dateStart || new Date().toISOString(),
      dateEnd: r.dateEnd || null,
      status: r.status || 'draft',
      result: r.result || undefined,
      points: r.points || [],
      conditions: r.conditions || undefined,
      notes: r.notes || undefined,
      rejectionReason: r.rejectionReason || undefined,
      createdAt: r.created || new Date().toISOString(),
      updatedAt: r.updated || new Date().toISOString(),
    };
  }

  private mapFilter(r: any): SavedFilter {
    return {
      id: r.id,
      name: r.name || '',
      category: r.category || '',
      conditions: r.conditions || [],
      createdAt: r.created || new Date().toISOString(),
    };
  }

  private mapOperation(r: any): OperationLog {
    return {
      id: r.id,
      timestamp: r.timestamp || new Date().toISOString(),
      userId: r.userId || '',
      action: r.action || '',
      entityType: r.entityType || '',
      entityId: r.entityId || '',
      details: r.details || '',
    };
  }

  // === Instruments ===

  getInstruments(): MeasuringInstrument[] {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    return [...this.cache.instruments];
  }

  addInstrument(instrument: Omit<MeasuringInstrument, 'id'>): MeasuringInstrument {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const nextVerificationDate = calculateNextVerification(instrument.lastVerificationDate, instrument.intervalMonths);
    const newInstrument: MeasuringInstrument = { 
      ...instrument, 
      id: uuidv4(), 
      nextVerificationDate 
    };
    
    // Write to cache immediately
    this.cache.instruments.push(newInstrument);
    
    // Persist to PocketBase asynchronously
    this.persistToPB('instruments', newInstrument).catch(err => {
      console.error('Persist failed:', err);
      // TODO: mark as unsynced
    });
    
    return newInstrument;
  }

  updateInstrument(id: string, updates: Partial<MeasuringInstrument>): void {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const index = this.cache.instruments.findIndex(i => i.id === id);
    if (index === -1) return;
    
    const updated = { ...this.cache.instruments[index], ...updates };
    if (updates.lastVerificationDate !== undefined || updates.intervalMonths !== undefined) {
      updated.nextVerificationDate = calculateNextVerification(updated.lastVerificationDate, updated.intervalMonths);
    }
    
    this.cache.instruments[index] = updated;
    
    this.pb.collection('instruments').update(id, updates).catch(err => {
      console.error('Update failed:', err);
    });
  }

  deleteInstrument(id: string): void {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    this.cache.instruments = this.cache.instruments.filter(i => i.id !== id);
    
    this.pb.collection('instruments').delete(id).catch(err => {
      console.error('Delete failed:', err);
    });
  }

  // === Employees ===

  getEmployees(): Employee[] {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    return [...this.cache.employees];
  }

  addEmployee(employee: Omit<Employee, 'id'>): Employee {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const newEmployee: Employee = { ...employee, id: uuidv4() };
    this.cache.employees.push(newEmployee);
    
    this.persistToPB('employees', newEmployee).catch(err => {
      console.error('Persist failed:', err);
    });
    
    return newEmployee;
  }

  updateEmployee(id: string, updates: Partial<Employee>): void {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const index = this.cache.employees.findIndex(e => e.id === id);
    if (index === -1) return;
    
    this.cache.employees[index] = { ...this.cache.employees[index], ...updates };
    
    this.pb.collection('employees').update(id, updates).catch(err => {
      console.error('Update failed:', err);
    });
  }

  deleteEmployee(id: string): void {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    this.cache.employees = this.cache.employees.filter(e => e.id !== id);
    
    this.pb.collection('employees').delete(id).catch(err => {
      console.error('Delete failed:', err);
    });
  }

  // === Departments ===

  getDepartments(): Department[] {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    return [...this.cache.departments];
  }

  addDepartment(department: Omit<Department, 'id'>): Department {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const newDepartment: Department = { ...department, id: uuidv4() };
    this.cache.departments.push(newDepartment);
    
    this.persistToPB('departments', newDepartment).catch(err => {
      console.error('Persist failed:', err);
    });
    
    return newDepartment;
  }

  updateDepartment(id: string, updates: Partial<Department>): void {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const index = this.cache.departments.findIndex(d => d.id === id);
    if (index === -1) return;
    
    this.cache.departments[index] = { ...this.cache.departments[index], ...updates };
    
    this.pb.collection('departments').update(id, updates).catch(err => {
      console.error('Update failed:', err);
    });
  }

  deleteDepartment(id: string): { success: boolean; message: string } {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const employees = this.cache.employees.filter(e => e.departmentId === id);
    if (employees.length > 0) {
      return { success: false, message: `Нельзя удалить отдел: в нём ${employees.length} сотрудник(ов)` };
    }
    
    this.cache.departments = this.cache.departments.filter(d => d.id !== id);
    
    this.pb.collection('departments').delete(id).catch(err => {
      console.error('Delete failed:', err);
    });
    
    return { success: true, message: 'Отдел удалён' };
  }

  // === Warehouses ===

  getWarehouses(): Warehouse[] {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    return [...this.cache.warehouses];
  }

  addWarehouse(warehouse: Omit<Warehouse, 'id'>): Warehouse {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const newWarehouse: Warehouse = { ...warehouse, id: uuidv4() };
    this.cache.warehouses.push(newWarehouse);
    
    this.persistToPB('warehouses', newWarehouse).catch(err => {
      console.error('Persist failed:', err);
    });
    
    return newWarehouse;
  }

  updateWarehouse(id: string, updates: Partial<Warehouse>): void {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const index = this.cache.warehouses.findIndex(w => w.id === id);
    if (index === -1) return;
    
    this.cache.warehouses[index] = { ...this.cache.warehouses[index], ...updates };
    
    this.pb.collection('warehouses').update(id, updates).catch(err => {
      console.error('Update failed:', err);
    });
  }

  deleteWarehouse(id: string): { success: boolean; message: string } {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const employees = this.cache.employees.filter(e => e.warehouseId === id);
    const instruments = this.cache.instruments.filter(i => i.warehouseId === id);
    if (employees.length > 0 || instruments.length > 0) {
      return { success: false, message: 'Нельзя удалить склад: используется' };
    }
    
    this.cache.warehouses = this.cache.warehouses.filter(w => w.id !== id);
    
    this.pb.collection('warehouses').delete(id).catch(err => {
      console.error('Delete failed:', err);
    });
    
    return { success: true, message: 'Склад удалён' };
  }

  // === Categories ===

  getCategories(): InstrumentCategory[] {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    return [...this.cache.categories];
  }

  addCategory(category: Omit<InstrumentCategory, 'id' | 'createdAt'>): InstrumentCategory {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const newCategory: InstrumentCategory = { 
      ...category, 
      id: uuidv4(), 
      createdAt: new Date().toISOString() 
    };
    this.cache.categories.push(newCategory);
    
    this.persistToPB('categories', newCategory).catch(err => {
      console.error('Persist failed:', err);
    });
    
    return newCategory;
  }

  updateCategory(id: string, updates: Partial<Omit<InstrumentCategory, 'id' | 'createdAt'>>): void {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const index = this.cache.categories.findIndex(c => c.id === id);
    if (index === -1) return;
    
    this.cache.categories[index] = { ...this.cache.categories[index], ...updates };
    
    this.pb.collection('categories').update(id, updates).catch(err => {
      console.error('Update failed:', err);
    });
  }

  deleteCategory(id: string): { success: boolean; message: string } {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const category = this.cache.categories.find(c => c.id === id);
    if (!category) return { success: false, message: 'Категория не найдена' };
    
    const hasInstruments = this.cache.instruments.some(i => i.category === category.name);
    if (hasInstruments) {
      return { 
        success: false, 
        message: `Нельзя удалить категорию: в ней есть приборы (${this.cache.instruments.filter(i => i.category === category.name).length} шт.)` 
      };
    }
    
    this.cache.categories = this.cache.categories.filter(c => c.id !== id);
    
    this.pb.collection('categories').delete(id).catch(err => {
      console.error('Delete failed:', err);
    });
    
    return { success: true, message: 'Категория удалена' };
  }

  // === Issues ===

  getIssues(): IssueRecord[] {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    return [...this.cache.issues];
  }

  addIssue(issue: Omit<IssueRecord, 'id'>): IssueRecord {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const newIssue: IssueRecord = { ...issue, id: uuidv4() };
    this.cache.issues.push(newIssue);
    
    this.persistToPB('issues', newIssue).catch(err => {
      console.error('Persist failed:', err);
    });
    
    return newIssue;
  }

  returnInstrument(issueId: string, userId: string): void {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const index = this.cache.issues.findIndex(i => i.id === issueId);
    if (index === -1) return;
    
    this.cache.issues[index] = { 
      ...this.cache.issues[index], 
      returnedAt: new Date().toISOString(), 
      returnedBy: userId 
    };
    
    this.pb.collection('issues').update(issueId, {
      returnedAt: this.cache.issues[index].returnedAt,
      returnedBy: this.cache.issues[index].returnedBy,
    }).catch(err => {
      console.error('Update failed:', err);
    });
  }

  // === Sendoffs ===

  getSendoffs(): VerificationSendoff[] {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    return [...this.cache.sendoffs];
  }

  addSendoff(sendoff: Omit<VerificationSendoff, 'id'>): VerificationSendoff {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const newSendoff: VerificationSendoff = { ...sendoff, id: uuidv4() };
    this.cache.sendoffs.push(newSendoff);
    
    this.persistToPB('sendoffs', newSendoff).catch(err => {
      console.error('Persist failed:', err);
    });
    
    return newSendoff;
  }

  updateSendoff(id: string, updates: Partial<VerificationSendoff>): VerificationSendoff | null {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const index = this.cache.sendoffs.findIndex(s => s.id === id);
    if (index === -1) return null;
    
    this.cache.sendoffs[index] = { ...this.cache.sendoffs[index], ...updates };
    
    this.pb.collection('sendoffs').update(id, updates).catch(err => {
      console.error('Update failed:', err);
    });
    
    return this.cache.sendoffs[index];
  }

  deleteSendoff(id: string): boolean {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    this.cache.sendoffs = this.cache.sendoffs.filter(s => s.id !== id);
    
    this.pb.collection('sendoffs').delete(id).catch(err => {
      console.error('Delete failed:', err);
    });
    
    return true;
  }

  // === Protocols ===

  getProtocols(): VerificationProtocol[] {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    return [...this.cache.protocols];
  }

  addProtocol(protocol: Omit<VerificationProtocol, 'id' | 'createdAt' | 'updatedAt'>): VerificationProtocol {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const newProtocol: VerificationProtocol = { 
      ...protocol, 
      id: uuidv4(), 
      createdAt: new Date().toISOString(), 
      updatedAt: new Date().toISOString() 
    };
    this.cache.protocols.push(newProtocol);
    
    this.persistToPB('protocols', newProtocol).catch(err => {
      console.error('Persist failed:', err);
    });
    
    return newProtocol;
  }

  updateProtocol(id: string, updates: Partial<VerificationProtocol>): VerificationProtocol | null {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const index = this.cache.protocols.findIndex(p => p.id === id);
    if (index === -1) return null;
    
    const protocol = this.cache.protocols[index];
    if (protocol.status === 'completed' || protocol.status === 'rejected') {
      throw new Error('Нельзя изменять завершённый или отклонённый протокол');
    }
    
    this.cache.protocols[index] = { 
      ...protocol, 
      ...updates, 
      updatedAt: new Date().toISOString() 
    };
    
    this.pb.collection('protocols').update(id, updates).catch(err => {
      console.error('Update failed:', err);
    });
    
    return this.cache.protocols[index];
  }

  deleteProtocol(id: string): boolean {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const protocol = this.cache.protocols.find(p => p.id === id);
    if (!protocol) return false;
    
    if (protocol.status === 'completed' || protocol.status === 'rejected') {
      throw new Error('Нельзя удалить завершённый или отклонённый протокол');
    }
    
    this.cache.protocols = this.cache.protocols.filter(p => p.id !== id);
    
    this.pb.collection('protocols').delete(id).catch(err => {
      console.error('Delete failed:', err);
    });
    
    return true;
  }

  // === Filters ===

  getSavedFilters(): SavedFilter[] {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    return [...this.cache.filters];
  }

  saveFilter(filter: Omit<SavedFilter, 'id' | 'createdAt'>): string {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const newFilter: SavedFilter = { 
      ...filter, 
      id: uuidv4(), 
      createdAt: new Date().toISOString() 
    };
    this.cache.filters.push(newFilter);
    
    this.persistToPB('filters', newFilter).catch(err => {
      console.error('Persist failed:', err);
    });
    
    return newFilter.id;
  }

  deleteFilter(filterId: string): void {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    this.cache.filters = this.cache.filters.filter(f => f.id !== filterId);
    
    this.pb.collection('filters').delete(filterId).catch(err => {
      console.error('Delete failed:', err);
    });
  }

  updateFilter(filterId: string, updates: Partial<SavedFilter>): void {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const index = this.cache.filters.findIndex(f => f.id === filterId);
    if (index === -1) return;
    
    this.cache.filters[index] = { ...this.cache.filters[index], ...updates };
    
    this.pb.collection('filters').update(filterId, updates).catch(err => {
      console.error('Update failed:', err);
    });
  }

  // === Operations ===

  getOperations(): OperationLog[] {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    return [...this.cache.operations];
  }

  addOperation(op: Omit<OperationLog, 'id' | 'timestamp'>): OperationLog {
    if (!this.initialized) {
      throw new Error('NotInitialized: вызовите initStorage() перед использованием');
    }
    
    const newOp: OperationLog = { 
      ...op, 
      id: uuidv4(), 
      timestamp: new Date().toISOString() 
    };
    this.cache.operations.unshift(newOp);
    this.cache.operations = this.cache.operations.slice(0, 500);
    
    this.persistToPB('operations', newOp).catch(err => {
      console.error('Persist failed:', err);
    });
    
    return newOp;
  }

  // === Users ===

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

  // === Attachments ===

  saveAttachment(id: string, data: string): void {
    throw new Error('NotImplemented: saveAttachment для PocketBase требует отдельной реализации через файлы');
  }

  getAttachment(id: string): string | null {
    throw new Error('NotImplemented: getAttachment для PocketBase требует отдельной реализации');
  }

  // === Connection ===

  async isConnected(): Promise<boolean> {
    try {
      const health = await this.pb.health.check();
      return health.code === 200;
    } catch (error) {
      return false;
    }
  }

  async getStats(): Promise<{ local: number; remote: number }> {
    if (!this.initialized) {
      return { local: 0, remote: 0 };
    }
    return { 
      local: 0, 
      remote: this.cache.instruments.length 
    };
  }

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

  // === Auth ===

  async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.pb.collection('users').authWithPassword(email, password);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  logout(): void {
    this.pb.authStore.clear();
    this.initialized = false;
    this.cache = {
      instruments: [],
      employees: [],
      departments: [],
      warehouses: [],
      categories: [],
      issues: [],
      sendoffs: [],
      protocols: [],
      filters: [],
      operations: [],
    };
  }

  // === Helper ===

  private async persistToPB(collection: string, data: any): Promise<void> {
    await this.pb.collection(collection).create(data);
  }
}
