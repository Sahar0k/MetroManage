import { store } from '../store';
import { MeasuringInstrument, Employee, Department, Warehouse } from '../types';
import { isVerificationExpired, canIssueInstrument } from '../utils/domain';

export class InstrumentService {
  static getAll(): MeasuringInstrument[] { return store.getInstruments(); }
  static getById(id: string): MeasuringInstrument | undefined { return store.getInstruments().find(i => i.id === id); }
  static getByCategory(category: string): MeasuringInstrument[] { return store.getInstruments().filter(i => i.category === category); }
  static getByStatus(status: MeasuringInstrument['status']): MeasuringInstrument[] { return store.getInstruments().filter(i => i.status === status); }
  static getExpired(): MeasuringInstrument[] { return store.getInstruments().filter(i => isVerificationExpired(i)); }
  static create(instrument: Omit<MeasuringInstrument, 'id'>): MeasuringInstrument { return store.addInstrument(instrument); }
  static update(id: string, updates: Partial<MeasuringInstrument>): void { store.updateInstrument(id, updates); }
  static delete(id: string): void { store.deleteInstrument(id); }
  static canIssue(instrument: MeasuringInstrument, userRole: string): { success: boolean; message: string } { return canIssueInstrument(instrument, userRole as any); }
  static issue(instrumentId: string, employeeId: string, userId: string): void {
    const instrument = this.getById(instrumentId);
    if (!instrument) throw new Error('Прибор не найден');
    store.addIssue({ instrumentId, employeeId, issuedBy: userId, issuedAt: new Date().toISOString(), returnedAt: null, returnedBy: null, note: '', originalWarehouseId: instrument.warehouseId });
    this.update(instrumentId, { status: 'issued', warehouseId: null });
    store.addOperation({ userId, action: 'issue', entityType: 'instrument', entityId: instrumentId, details: `Выдача прибора ${instrument.inventoryNumber}` });
  }
  static return(instrumentId: string, userId: string): void {
    const instrument = this.getById(instrumentId);
    if (!instrument) throw new Error('Прибор не найден');
    const issues = store.getIssues();
    const activeIssue = issues.find(i => i.instrumentId === instrumentId && !i.returnedAt);
    if (!activeIssue) throw new Error('Активная выдача не найдена');
    store.returnInstrument(activeIssue.id, userId);
    this.update(instrumentId, { status: 'available', warehouseId: activeIssue.originalWarehouseId });
    store.addOperation({ userId, action: 'return', entityType: 'instrument', entityId: instrumentId, details: `Возврат прибора ${instrument.inventoryNumber}` });
  }
}

export class EmployeeService {
  static getAll(): Employee[] { return store.getEmployees(); }
  static getById(id: string): Employee | undefined { return store.getEmployees().find(e => e.id === id); }
  static getByDepartment(departmentId: string): Employee[] { return store.getEmployees().filter(e => e.departmentId === departmentId); }
  static create(employee: Omit<Employee, 'id'>): Employee { return store.addEmployee(employee); }
  static update(id: string, updates: Partial<Employee>): void { store.updateEmployee(id, updates); }
  static delete(id: string): void { store.deleteEmployee(id); }
}

export class DepartmentService {
  static getAll(): Department[] { return store.getDepartments(); }
  static getById(id: string): Department | undefined { return store.getDepartments().find(d => d.id === id); }
  static create(department: Omit<Department, 'id'>): Department { return store.addDepartment(department); }
  static update(id: string, updates: Partial<Department>): void { store.updateDepartment(id, updates); }
  static delete(id: string): { success: boolean; message: string } { return store.deleteDepartment(id); }
}

export class WarehouseService {
  static getAll(): Warehouse[] { return store.getWarehouses(); }
  static getById(id: string): Warehouse | undefined { return store.getWarehouses().find(w => w.id === id); }
  static create(warehouse: Omit<Warehouse, 'id'>): Warehouse { return store.addWarehouse(warehouse); }
  static update(id: string, updates: Partial<Warehouse>): void { store.updateWarehouse(id, updates); }
  static delete(id: string): { success: boolean; message: string } { return store.deleteWarehouse(id); }
}

export class OperationService {
  static getAll() { return store.getOperations(); }
  static getByEntityType(entityType: string) { return store.getOperations().filter(op => op.entityType === entityType); }
  static getByAction(action: string) { return store.getOperations().filter(op => op.action === action); }
  static add(operation: Parameters<typeof store.addOperation>[0]) { return store.addOperation(operation); }
}
