/**
 * MigrationService - сервис для миграции данных между хранилищами
 */

import { StorageAdapter } from './StorageAdapter';
import { LocalStorageAdapter } from './localAdapter';
import { PocketBaseAdapter } from './pocketbaseAdapter';

export interface MigrationProgress {
  current: number;
  total: number;
  entity: string;
}

export interface MigrationReport {
  instruments: { migrated: number; conflicts: number };
  employees: { migrated: number; conflicts: number };
  departments: { migrated: number; conflicts: number };
  warehouses: { migrated: number; conflicts: number };
  categories: { migrated: number; conflicts: number };
  issues: { migrated: number; conflicts: number };
  sendoffs: { migrated: number; conflicts: number };
  protocols: { migrated: number; conflicts: number };
  totalMigrated: number;
  totalConflicts: number;
}

export type ConflictResolution = 'skip' | 'overwrite' | 'manual';

export interface MigrationConflict {
  entity: string;
  id: string;
  localUpdatedAt?: string;
  remoteUpdatedAt?: string;
  resolution: ConflictResolution;
}

/**
 * Миграция данных из локального хранилища в PocketBase
 */
export async function migrateLocalToPocketBase(
  localAdapter: LocalStorageAdapter,
  pocketbaseAdapter: PocketBaseAdapter,
  onProgress?: (progress: MigrationProgress) => void,
  conflictResolution: ConflictResolution = 'skip'
): Promise<MigrationReport> {
  const report: MigrationReport = {
    instruments: { migrated: 0, conflicts: 0 },
    employees: { migrated: 0, conflicts: 0 },
    departments: { migrated: 0, conflicts: 0 },
    warehouses: { migrated: 0, conflicts: 0 },
    categories: { migrated: 0, conflicts: 0 },
    issues: { migrated: 0, conflicts: 0 },
    sendoffs: { migrated: 0, conflicts: 0 },
    protocols: { migrated: 0, conflicts: 0 },
    totalMigrated: 0,
    totalConflicts: 0,
  };

  // Миграция departments
  const departments = localAdapter.getDepartments();
  onProgress?.({ current: 0, total: departments.length, entity: 'departments' });
  for (let i = 0; i < departments.length; i++) {
    try {
      pocketbaseAdapter.addDepartment(departments[i]);
      report.departments.migrated++;
    } catch (error) {
      report.departments.conflicts++;
    }
    onProgress?.({ current: i + 1, total: departments.length, entity: 'departments' });
  }

  // Миграция warehouses
  const warehouses = localAdapter.getWarehouses();
  onProgress?.({ current: 0, total: warehouses.length, entity: 'warehouses' });
  for (let i = 0; i < warehouses.length; i++) {
    try {
      pocketbaseAdapter.addWarehouse(warehouses[i]);
      report.warehouses.migrated++;
    } catch (error) {
      report.warehouses.conflicts++;
    }
    onProgress?.({ current: i + 1, total: warehouses.length, entity: 'warehouses' });
  }

  // Миграция employees
  const employees = localAdapter.getEmployees();
  onProgress?.({ current: 0, total: employees.length, entity: 'employees' });
  for (let i = 0; i < employees.length; i++) {
    try {
      pocketbaseAdapter.addEmployee(employees[i]);
      report.employees.migrated++;
    } catch (error) {
      report.employees.conflicts++;
    }
    onProgress?.({ current: i + 1, total: employees.length, entity: 'employees' });
  }

  // Миграция categories
  const categories = localAdapter.getCategories();
  onProgress?.({ current: 0, total: categories.length, entity: 'categories' });
  for (let i = 0; i < categories.length; i++) {
    try {
      pocketbaseAdapter.addCategory(categories[i]);
      report.categories.migrated++;
    } catch (error) {
      report.categories.conflicts++;
    }
    onProgress?.({ current: i + 1, total: categories.length, entity: 'categories' });
  }

  // Миграция instruments
  const instruments = localAdapter.getInstruments();
  onProgress?.({ current: 0, total: instruments.length, entity: 'instruments' });
  for (let i = 0; i < instruments.length; i++) {
    try {
      pocketbaseAdapter.addInstrument(instruments[i]);
      report.instruments.migrated++;
    } catch (error) {
      report.instruments.conflicts++;
    }
    onProgress?.({ current: i + 1, total: instruments.length, entity: 'instruments' });
  }

  // Миграция issues
  const issues = localAdapter.getIssues();
  onProgress?.({ current: 0, total: issues.length, entity: 'issues' });
  for (let i = 0; i < issues.length; i++) {
    try {
      pocketbaseAdapter.addIssue(issues[i]);
      report.issues.migrated++;
    } catch (error) {
      report.issues.conflicts++;
    }
    onProgress?.({ current: i + 1, total: issues.length, entity: 'issues' });
  }

  // Миграция sendoffs
  const sendoffs = localAdapter.getSendoffs();
  onProgress?.({ current: 0, total: sendoffs.length, entity: 'sendoffs' });
  for (let i = 0; i < sendoffs.length; i++) {
    try {
      pocketbaseAdapter.addSendoff(sendoffs[i]);
      report.sendoffs.migrated++;
    } catch (error) {
      report.sendoffs.conflicts++;
    }
    onProgress?.({ current: i + 1, total: sendoffs.length, entity: 'sendoffs' });
  }

  // Миграция protocols
  const protocols = localAdapter.getProtocols();
  onProgress?.({ current: 0, total: protocols.length, entity: 'protocols' });
  for (let i = 0; i < protocols.length; i++) {
    try {
      pocketbaseAdapter.addProtocol(protocols[i]);
      report.protocols.migrated++;
    } catch (error) {
      report.protocols.conflicts++;
    }
    onProgress?.({ current: i + 1, total: protocols.length, entity: 'protocols' });
  }

  // Подсчет итогов
  report.totalMigrated = 
    report.departments.migrated +
    report.warehouses.migrated +
    report.employees.migrated +
    report.categories.migrated +
    report.instruments.migrated +
    report.issues.migrated +
    report.sendoffs.migrated +
    report.protocols.migrated;

  report.totalConflicts = 
    report.departments.conflicts +
    report.warehouses.conflicts +
    report.employees.conflicts +
    report.categories.conflicts +
    report.instruments.conflicts +
    report.issues.conflicts +
    report.sendoffs.conflicts +
    report.protocols.conflicts;

  return report;
}

/**
 * Миграция данных из PocketBase в локальное хранилище
 */
export async function migratePocketBaseToLocal(
  pocketbaseAdapter: PocketBaseAdapter,
  localAdapter: LocalStorageAdapter,
  onProgress?: (progress: MigrationProgress) => void,
  conflictResolution: ConflictResolution = 'skip'
): Promise<MigrationReport> {
  // Аналогичная логика, но в обратном направлении
  // PocketBaseAdapter должен реализовать асинхронные методы для получения данных
  const report: MigrationReport = {
    instruments: { migrated: 0, conflicts: 0 },
    employees: { migrated: 0, conflicts: 0 },
    departments: { migrated: 0, conflicts: 0 },
    warehouses: { migrated: 0, conflicts: 0 },
    categories: { migrated: 0, conflicts: 0 },
    issues: { migrated: 0, conflicts: 0 },
    sendoffs: { migrated: 0, conflicts: 0 },
    protocols: { migrated: 0, conflicts: 0 },
    totalMigrated: 0,
    totalConflicts: 0,
  };

  // Получаем данные из PocketBase через кэш
  const departments = pocketbaseAdapter.getDepartments();
  onProgress?.({ current: 0, total: departments.length, entity: 'departments' });
  for (let i = 0; i < departments.length; i++) {
    try {
      localAdapter.addDepartment(departments[i]);
      report.departments.migrated++;
    } catch (error) {
      report.departments.conflicts++;
    }
    onProgress?.({ current: i + 1, total: departments.length, entity: 'departments' });
  }

  const warehouses = pocketbaseAdapter.getWarehouses();
  onProgress?.({ current: 0, total: warehouses.length, entity: 'warehouses' });
  for (let i = 0; i < warehouses.length; i++) {
    try {
      localAdapter.addWarehouse(warehouses[i]);
      report.warehouses.migrated++;
    } catch (error) {
      report.warehouses.conflicts++;
    }
    onProgress?.({ current: i + 1, total: warehouses.length, entity: 'warehouses' });
  }

  const employees = pocketbaseAdapter.getEmployees();
  onProgress?.({ current: 0, total: employees.length, entity: 'employees' });
  for (let i = 0; i < employees.length; i++) {
    try {
      localAdapter.addEmployee(employees[i]);
      report.employees.migrated++;
    } catch (error) {
      report.employees.conflicts++;
    }
    onProgress?.({ current: i + 1, total: employees.length, entity: 'employees' });
  }

  const categories = pocketbaseAdapter.getCategories();
  onProgress?.({ current: 0, total: categories.length, entity: 'categories' });
  for (let i = 0; i < categories.length; i++) {
    try {
      localAdapter.addCategory(categories[i]);
      report.categories.migrated++;
    } catch (error) {
      report.categories.conflicts++;
    }
    onProgress?.({ current: i + 1, total: categories.length, entity: 'categories' });
  }

  const instruments = pocketbaseAdapter.getInstruments();
  onProgress?.({ current: 0, total: instruments.length, entity: 'instruments' });
  for (let i = 0; i < instruments.length; i++) {
    try {
      localAdapter.addInstrument(instruments[i]);
      report.instruments.migrated++;
    } catch (error) {
      report.instruments.conflicts++;
    }
    onProgress?.({ current: i + 1, total: instruments.length, entity: 'instruments' });
  }

  const issues = pocketbaseAdapter.getIssues();
  onProgress?.({ current: 0, total: issues.length, entity: 'issues' });
  for (let i = 0; i < issues.length; i++) {
    try {
      localAdapter.addIssue(issues[i]);
      report.issues.migrated++;
    } catch (error) {
      report.issues.conflicts++;
    }
    onProgress?.({ current: i + 1, total: issues.length, entity: 'issues' });
  }

  const sendoffs = pocketbaseAdapter.getSendoffs();
  onProgress?.({ current: 0, total: sendoffs.length, entity: 'sendoffs' });
  for (let i = 0; i < sendoffs.length; i++) {
    try {
      localAdapter.addSendoff(sendoffs[i]);
      report.sendoffs.migrated++;
    } catch (error) {
      report.sendoffs.conflicts++;
    }
    onProgress?.({ current: i + 1, total: sendoffs.length, entity: 'sendoffs' });
  }

  const protocols = pocketbaseAdapter.getProtocols();
  onProgress?.({ current: 0, total: protocols.length, entity: 'protocols' });
  for (let i = 0; i < protocols.length; i++) {
    try {
      localAdapter.addProtocol(protocols[i]);
      report.protocols.migrated++;
    } catch (error) {
      report.protocols.conflicts++;
    }
    onProgress?.({ current: i + 1, total: protocols.length, entity: 'protocols' });
  }

  report.totalMigrated = 
    report.departments.migrated +
    report.warehouses.migrated +
    report.employees.migrated +
    report.categories.migrated +
    report.instruments.migrated +
    report.issues.migrated +
    report.sendoffs.migrated +
    report.protocols.migrated;

  report.totalConflicts = 
    report.departments.conflicts +
    report.warehouses.conflicts +
    report.employees.conflicts +
    report.categories.conflicts +
    report.instruments.conflicts +
    report.issues.conflicts +
    report.sendoffs.conflicts +
    report.protocols.conflicts;

  return report;
}
