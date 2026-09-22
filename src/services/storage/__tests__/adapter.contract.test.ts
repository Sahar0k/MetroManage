import { describe, it, expect, beforeEach } from 'vitest';
import { StorageAdapter } from '../StorageAdapter';
import { LocalStorageAdapter } from '../localAdapter';
import { PocketBaseAdapter } from '../pocketbaseAdapter';
import { MeasuringInstrument, Employee, Department } from '../../../types';

// Параметризованные тесты для обоих адаптеров
const adapters: Array<[string, () => StorageAdapter]> = [
  ['LocalStorageAdapter', () => new LocalStorageAdapter()],
];

// Добавляем PocketBaseAdapter только если есть переменная окружения PB_URL
const pbUrl = import.meta.env.PB_URL as string | undefined;
if (pbUrl) {
  adapters.push(['PocketBaseAdapter', () => new PocketBaseAdapter(pbUrl)]);
}

describe.each(adapters)('StorageAdapter Contract Tests - %s', (adapterName, createAdapter) => {
  let adapter: StorageAdapter;

  beforeEach(async () => {
    if (adapterName === 'LocalStorageAdapter') {
      localStorage.clear();
    }
    adapter = createAdapter();
    await adapter.initStorage();
  });

  describe('Instruments CRUD', () => {
    it('should create an instrument', () => {
      const instrument: Omit<MeasuringInstrument, 'id'> = {
        inventoryNumber: 'TEST-001',
        name: 'Test Instrument',
        category: 'Test',
        type: 'Type A',
        serialNumber: 'SN123',
        manufacturer: 'Test Manufacturer',
        range: '0-100',
        accuracy: '±1%',
        status: 'available',
        lastVerificationDate: '2024-01-01',
        intervalMonths: 12,
        nextVerificationDate: '2025-01-01',
        location: 'Test Location',
        warehouseId: null,
        customFields: {},
      };

      const created = adapter.addInstrument(instrument);
      expect(created.id).toBeDefined();
      expect(created.inventoryNumber).toBe('TEST-001');
      expect(created.name).toBe('Test Instrument');
    });

    it('should read instruments', () => {
      const instrument: Omit<MeasuringInstrument, 'id'> = {
        inventoryNumber: 'TEST-001',
        name: 'Test Instrument',
        category: 'Test',
        type: 'Type A',
        serialNumber: 'SN123',
        manufacturer: 'Test Manufacturer',
        range: '0-100',
        accuracy: '±1%',
        status: 'available',
        lastVerificationDate: '2024-01-01',
        intervalMonths: 12,
        nextVerificationDate: '2025-01-01',
        location: 'Test Location',
        warehouseId: null,
        customFields: {},
      };

      adapter.addInstrument(instrument);
      const instruments = adapter.getInstruments();
      
      expect(instruments).toHaveLength(1);
      expect(instruments[0].inventoryNumber).toBe('TEST-001');
    });

    it('should update an instrument', () => {
      const instrument: Omit<MeasuringInstrument, 'id'> = {
        inventoryNumber: 'TEST-001',
        name: 'Test Instrument',
        category: 'Test',
        type: 'Type A',
        serialNumber: 'SN123',
        manufacturer: 'Test Manufacturer',
        range: '0-100',
        accuracy: '±1%',
        status: 'available',
        lastVerificationDate: '2024-01-01',
        intervalMonths: 12,
        nextVerificationDate: '2025-01-01',
        location: 'Test Location',
        warehouseId: null,
        customFields: {},
      };

      const created = adapter.addInstrument(instrument);
      adapter.updateInstrument(created.id, { name: 'Updated Name' });
      
      const instruments = adapter.getInstruments();
      expect(instruments[0].name).toBe('Updated Name');
    });

    it('should delete an instrument', () => {
      const instrument: Omit<MeasuringInstrument, 'id'> = {
        inventoryNumber: 'TEST-001',
        name: 'Test Instrument',
        category: 'Test',
        type: 'Type A',
        serialNumber: 'SN123',
        manufacturer: 'Test Manufacturer',
        range: '0-100',
        accuracy: '±1%',
        status: 'available',
        lastVerificationDate: '2024-01-01',
        intervalMonths: 12,
        nextVerificationDate: '2025-01-01',
        location: 'Test Location',
        warehouseId: null,
        customFields: {},
      };

      const created = adapter.addInstrument(instrument);
      adapter.deleteInstrument(created.id);
      
      const instruments = adapter.getInstruments();
      expect(instruments).toHaveLength(0);
    });
  });

  describe('Employees CRUD', () => {
    it('should create an employee', () => {
      const employee: Omit<Employee, 'id'> = {
        fullName: 'John Doe',
        tabNumber: '12345',
        departmentId: 'dept-1',
        comment: 'Test employee',
        warehouseId: 'wh-1',
      };

      const created = adapter.addEmployee(employee);
      expect(created.id).toBeDefined();
      expect(created.fullName).toBe('John Doe');
    });

    it('should read employees', () => {
      const employee: Omit<Employee, 'id'> = {
        fullName: 'John Doe',
        tabNumber: '12345',
        departmentId: 'dept-1',
        comment: 'Test employee',
        warehouseId: 'wh-1',
      };

      adapter.addEmployee(employee);
      const employees = adapter.getEmployees();
      
      expect(employees).toHaveLength(1);
      expect(employees[0].fullName).toBe('John Doe');
    });

    it('should update an employee', () => {
      const employee: Omit<Employee, 'id'> = {
        fullName: 'John Doe',
        tabNumber: '12345',
        departmentId: 'dept-1',
        comment: 'Test employee',
        warehouseId: 'wh-1',
      };

      const created = adapter.addEmployee(employee);
      adapter.updateEmployee(created.id, { fullName: 'Jane Doe' });
      
      const employees = adapter.getEmployees();
      expect(employees[0].fullName).toBe('Jane Doe');
    });

    it('should delete an employee', () => {
      const employee: Omit<Employee, 'id'> = {
        fullName: 'John Doe',
        tabNumber: '12345',
        departmentId: 'dept-1',
        comment: 'Test employee',
        warehouseId: 'wh-1',
      };

      const created = adapter.addEmployee(employee);
      adapter.deleteEmployee(created.id);
      
      const employees = adapter.getEmployees();
      expect(employees).toHaveLength(0);
    });
  });

  describe('Departments CRUD', () => {
    it('should create a department', () => {
      const department: Omit<Department, 'id'> = {
        name: 'Test Department',
        code: 'TD-01',
      };

      const created = adapter.addDepartment(department);
      expect(created.id).toBeDefined();
      expect(created.name).toBe('Test Department');
    });

    it('should read departments', () => {
      const department: Omit<Department, 'id'> = {
        name: 'Test Department',
        code: 'TD-01',
      };

      adapter.addDepartment(department);
      const departments = adapter.getDepartments();
      
      expect(departments).toHaveLength(1);
      expect(departments[0].name).toBe('Test Department');
    });

    it('should update a department', () => {
      const department: Omit<Department, 'id'> = {
        name: 'Test Department',
        code: 'TD-01',
      };

      const created = adapter.addDepartment(department);
      adapter.updateDepartment(created.id, { name: 'Updated Department' });
      
      const departments = adapter.getDepartments();
      expect(departments[0].name).toBe('Updated Department');
    });

    it('should delete a department', () => {
      const department: Omit<Department, 'id'> = {
        name: 'Test Department',
        code: 'TD-01',
      };

      const created = adapter.addDepartment(department);
      const result = adapter.deleteDepartment(created.id);
      
      expect(result.success).toBe(true);
      const departments = adapter.getDepartments();
      expect(departments).toHaveLength(0);
    });
  });

  describe('Connection and Stats', () => {
    it('should report connection status', async () => {
      const isConnected = await adapter.isConnected();
      expect(typeof isConnected).toBe('boolean');
    });

    it('should return stats', async () => {
      const instrument: Omit<MeasuringInstrument, 'id'> = {
        inventoryNumber: 'TEST-001',
        name: 'Test Instrument',
        category: 'Test',
        type: 'Type A',
        serialNumber: 'SN123',
        manufacturer: 'Test Manufacturer',
        range: '0-100',
        accuracy: '±1%',
        status: 'available',
        lastVerificationDate: '2024-01-01',
        intervalMonths: 12,
        nextVerificationDate: '2025-01-01',
        location: 'Test Location',
        warehouseId: null,
        customFields: {},
      };

      adapter.addInstrument(instrument);
      
      const stats = await adapter.getStats();
      expect(stats).toHaveProperty('local');
      expect(stats).toHaveProperty('remote');
      expect(typeof stats.local).toBe('number');
      expect(typeof stats.remote).toBe('number');
    });
  });
});
