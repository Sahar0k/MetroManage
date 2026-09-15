/**
 * LocalStorageAdapter - адаптер для работы с localStorage
 * Обёртка над текущей логикой store.ts
 */

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

const STORAGE_KEYS = {
  users: 'mk_users',
  departments: 'mk_departments',
  employees: 'mk_employees',
  instruments: 'mk_instruments',
  warehouses: 'mk_warehouses',
  issues: 'mk_issues',
  operations: 'mk_operations',
  currentUser: 'mk_current_user',
  categories: 'mk_categories',
  sendoffs: 'mk_verification_sendoffs',
  protocols: 'mk_verification_protocols',
  filters: 'mk_saved_filters',
};

export class LocalStorageAdapter implements StorageAdapter {
  /**
   * Инициализация адаптера: для localStorage это просто проверка доступности
   */
  async initStorage(): Promise<void> {
    // localStorage всегда доступен, просто проверяем
    try {
      localStorage.getItem('test');
    } catch (error) {
      throw new Error('LocalStorage not available');
    }
  }

  // Instruments
  getInstruments(): MeasuringInstrument[] {
    const data = localStorage.getItem(STORAGE_KEYS.instruments);
    return data ? JSON.parse(data) : [];
  }

  addInstrument(instrument: Omit<MeasuringInstrument, 'id'>): MeasuringInstrument {
    const instruments = this.getInstruments();
    const nextVerificationDate = calculateNextVerification(instrument.lastVerificationDate, instrument.intervalMonths);
    const newInstrument = { ...instrument, id: uuidv4(), nextVerificationDate };
    instruments.push(newInstrument);
    localStorage.setItem(STORAGE_KEYS.instruments, JSON.stringify(instruments));
    return newInstrument;
  }

  updateInstrument(id: string, updates: Partial<MeasuringInstrument>): void {
    const instruments = this.getInstruments().map(i => {
      if (i.id === id) {
        const updated = { ...i, ...updates };
        if (updates.lastVerificationDate !== undefined || updates.intervalMonths !== undefined) {
          updated.nextVerificationDate = calculateNextVerification(updated.lastVerificationDate, updated.intervalMonths);
        }
        return updated;
      }
      return i;
    });
    localStorage.setItem(STORAGE_KEYS.instruments, JSON.stringify(instruments));
  }

  deleteInstrument(id: string): void {
    const instruments = this.getInstruments().filter(i => i.id !== id);
    localStorage.setItem(STORAGE_KEYS.instruments, JSON.stringify(instruments));
  }

  // Employees
  getEmployees(): Employee[] {
    const data = localStorage.getItem(STORAGE_KEYS.employees);
    return data ? JSON.parse(data) : [];
  }

  addEmployee(employee: Omit<Employee, 'id'>): Employee {
    const employees = this.getEmployees();
    const newEmployee = { ...employee, id: uuidv4() };
    employees.push(newEmployee);
    localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(employees));
    return newEmployee;
  }

  updateEmployee(id: string, updates: Partial<Employee>): void {
    const employees = this.getEmployees().map(e => e.id === id ? { ...e, ...updates } : e);
    localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(employees));
  }

  deleteEmployee(id: string): void {
    const employees = this.getEmployees().filter(e => e.id !== id);
    localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(employees));
  }

  // Departments
  getDepartments(): Department[] {
    const data = localStorage.getItem(STORAGE_KEYS.departments);
    return data ? JSON.parse(data) : [];
  }

  addDepartment(department: Omit<Department, 'id'>): Department {
    const departments = this.getDepartments();
    const newDepartment = { ...department, id: uuidv4() };
    departments.push(newDepartment);
    localStorage.setItem(STORAGE_KEYS.departments, JSON.stringify(departments));
    return newDepartment;
  }

  updateDepartment(id: string, updates: Partial<Department>): void {
    const departments = this.getDepartments().map(d => d.id === id ? { ...d, ...updates } : d);
    localStorage.setItem(STORAGE_KEYS.departments, JSON.stringify(departments));
  }

  deleteDepartment(id: string): { success: boolean; message: string } {
    const employees = this.getEmployees().filter(e => e.departmentId === id);
    if (employees.length > 0) {
      return { success: false, message: `Нельзя удалить отдел: в нём ${employees.length} сотрудник(ов)` };
    }
    const departments = this.getDepartments().filter(d => d.id !== id);
    localStorage.setItem(STORAGE_KEYS.departments, JSON.stringify(departments));
    return { success: true, message: 'Отдел удалён' };
  }

  // Warehouses
  getWarehouses(): Warehouse[] {
    const data = localStorage.getItem(STORAGE_KEYS.warehouses);
    return data ? JSON.parse(data) : [];
  }

  addWarehouse(warehouse: Omit<Warehouse, 'id'>): Warehouse {
    const warehouses = this.getWarehouses();
    const newWarehouse = { ...warehouse, id: uuidv4() };
    warehouses.push(newWarehouse);
    localStorage.setItem(STORAGE_KEYS.warehouses, JSON.stringify(warehouses));
    return newWarehouse;
  }

  updateWarehouse(id: string, updates: Partial<Warehouse>): void {
    const warehouses = this.getWarehouses().map(w => w.id === id ? { ...w, ...updates } : w);
    localStorage.setItem(STORAGE_KEYS.warehouses, JSON.stringify(warehouses));
  }

  deleteWarehouse(id: string): { success: boolean; message: string } {
    const employees = this.getEmployees().filter(e => e.warehouseId === id);
    const instruments = this.getInstruments().filter(i => i.warehouseId === id);
    if (employees.length > 0 || instruments.length > 0) {
      return { success: false, message: `Нельзя удалить склад: используется` };
    }
    const warehouses = this.getWarehouses().filter(w => w.id !== id);
    localStorage.setItem(STORAGE_KEYS.warehouses, JSON.stringify(warehouses));
    return { success: true, message: 'Склад удалён' };
  }

  // Categories
  getCategories(): InstrumentCategory[] {
    const data = localStorage.getItem(STORAGE_KEYS.categories);
    return data ? JSON.parse(data) : [];
  }

  addCategory(category: Omit<InstrumentCategory, 'id' | 'createdAt'>): InstrumentCategory {
    const categories = this.getCategories();
    const newCategory = { ...category, id: uuidv4(), createdAt: new Date().toISOString() };
    categories.push(newCategory);
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories));
    return newCategory;
  }

  updateCategory(id: string, updates: Partial<Omit<InstrumentCategory, 'id' | 'createdAt'>>): void {
    const categories = this.getCategories().map(c => c.id === id ? { ...c, ...updates } : c);
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories));
  }

  deleteCategory(id: string): { success: boolean; message: string } {
    const category = this.getCategories().find(c => c.id === id);
    if (!category) return { success: false, message: 'Категория не найдена' };
    const instruments = this.getInstruments();
    const hasInstruments = instruments.some(i => i.category === category.name);
    if (hasInstruments) {
      return { success: false, message: `Нельзя удалить категорию: в ней есть приборы (${instruments.filter(i => i.category === category.name).length} шт.)` };
    }
    const categories = this.getCategories().filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories));
    return { success: true, message: 'Категория удалена' };
  }

  // Issue Records
  getIssues(): IssueRecord[] {
    const data = localStorage.getItem(STORAGE_KEYS.issues);
    return data ? JSON.parse(data) : [];
  }

  addIssue(issue: Omit<IssueRecord, 'id'>): IssueRecord {
    const issues = this.getIssues();
    const newIssue = { ...issue, id: uuidv4() };
    issues.push(newIssue);
    localStorage.setItem(STORAGE_KEYS.issues, JSON.stringify(issues));
    return newIssue;
  }

  returnInstrument(issueId: string, userId: string): void {
    const issues = this.getIssues().map(i =>
      i.id === issueId ? { ...i, returnedAt: new Date().toISOString(), returnedBy: userId } : i
    );
    localStorage.setItem(STORAGE_KEYS.issues, JSON.stringify(issues));
  }

  // Verification Sendoffs
  getSendoffs(): VerificationSendoff[] {
    const data = localStorage.getItem(STORAGE_KEYS.sendoffs);
    return data ? JSON.parse(data) : [];
  }

  addSendoff(sendoff: Omit<VerificationSendoff, 'id'>): VerificationSendoff {
    const sendoffs = this.getSendoffs();
    const newSendoff = { ...sendoff, id: uuidv4() };
    sendoffs.push(newSendoff);
    localStorage.setItem(STORAGE_KEYS.sendoffs, JSON.stringify(sendoffs));
    return newSendoff;
  }

  updateSendoff(id: string, updates: Partial<VerificationSendoff>): VerificationSendoff | null {
    const sendoffs = this.getSendoffs();
    const sendoff = sendoffs.find(s => s.id === id);
    if (!sendoff) return null;
    const updated = { ...sendoff, ...updates };
    const newSendoffs = sendoffs.map(s => s.id === id ? updated : s);
    localStorage.setItem(STORAGE_KEYS.sendoffs, JSON.stringify(newSendoffs));
    return updated;
  }

  deleteSendoff(id: string): boolean {
    const sendoffs = this.getSendoffs();
    const newSendoffs = sendoffs.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.sendoffs, JSON.stringify(newSendoffs));
    return true;
  }

  // Verification Protocols
  getProtocols(): VerificationProtocol[] {
    const data = localStorage.getItem(STORAGE_KEYS.protocols);
    return data ? JSON.parse(data) : [];
  }

  addProtocol(protocol: Omit<VerificationProtocol, 'id' | 'createdAt' | 'updatedAt'>): VerificationProtocol {
    const protocols = this.getProtocols();
    const newProtocol = { ...protocol, id: uuidv4(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    protocols.push(newProtocol);
    localStorage.setItem(STORAGE_KEYS.protocols, JSON.stringify(protocols));
    return newProtocol;
  }

  updateProtocol(id: string, updates: Partial<VerificationProtocol>): VerificationProtocol | null {
    const protocols = this.getProtocols();
    const protocol = protocols.find(p => p.id === id);
    if (!protocol) return null;
    if (protocol.status === 'completed' || protocol.status === 'rejected') {
      throw new Error('Нельзя изменять завершённый или отклонённый протокол');
    }
    const updated = { ...protocol, ...updates, updatedAt: new Date().toISOString() };
    const newProtocols = protocols.map(p => p.id === id ? updated : p);
    localStorage.setItem(STORAGE_KEYS.protocols, JSON.stringify(newProtocols));
    return updated;
  }

  deleteProtocol(id: string): boolean {
    const protocols = this.getProtocols();
    const protocol = protocols.find(p => p.id === id);
    if (!protocol) return false;
    if (protocol.status === 'completed' || protocol.status === 'rejected') {
      throw new Error('Нельзя удалить завершённый или отклонённый протокол');
    }
    const newProtocols = protocols.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.protocols, JSON.stringify(newProtocols));
    return true;
  }

  // Saved Filters
  getSavedFilters(): SavedFilter[] {
    const data = localStorage.getItem(STORAGE_KEYS.filters);
    return data ? JSON.parse(data) : [];
  }

  saveFilter(filter: Omit<SavedFilter, 'id' | 'createdAt'>): string {
    const filters = this.getSavedFilters();
    const newFilter = { ...filter, id: uuidv4(), createdAt: new Date().toISOString() };
    filters.push(newFilter);
    localStorage.setItem(STORAGE_KEYS.filters, JSON.stringify(filters));
    return newFilter.id;
  }

  deleteFilter(filterId: string): void {
    const filters = this.getSavedFilters().filter(f => f.id !== filterId);
    localStorage.setItem(STORAGE_KEYS.filters, JSON.stringify(filters));
  }

  updateFilter(filterId: string, updates: Partial<SavedFilter>): void {
    const filters = this.getSavedFilters().map(f => f.id === filterId ? { ...f, ...updates } : f);
    localStorage.setItem(STORAGE_KEYS.filters, JSON.stringify(filters));
  }

  // Operation Logs
  getOperations(): OperationLog[] {
    const data = localStorage.getItem(STORAGE_KEYS.operations);
    return data ? JSON.parse(data) : [];
  }

  addOperation(op: Omit<OperationLog, 'id' | 'timestamp'>): OperationLog {
    const operations = this.getOperations();
    const newOp = { ...op, id: uuidv4(), timestamp: new Date().toISOString() };
    operations.unshift(newOp);
    localStorage.setItem(STORAGE_KEYS.operations, JSON.stringify(operations.slice(0, 500)));
    return newOp;
  }

  // Users
  getCurrentUser(): User | null {
    const data = localStorage.getItem(STORAGE_KEYS.currentUser);
    return data ? JSON.parse(data) : null;
  }

  setCurrentUser(user: User | null): void {
    localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
  }

  // Attachments
  saveAttachment(id: string, data: string): void {
    localStorage.setItem(`mk_attachment_${id}`, data);
  }

  getAttachment(id: string): string | null {
    return localStorage.getItem(`mk_attachment_${id}`);
  }

  // Служебные методы
  async isConnected(): Promise<boolean> {
    return true; // localStorage всегда доступен
  }

  async getStats(): Promise<{ local: number; remote: number }> {
    const instruments = this.getInstruments().length;
    return { local: instruments, remote: instruments };
  }
}
