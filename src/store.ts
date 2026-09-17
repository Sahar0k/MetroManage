import { v4 as uuidv4 } from 'uuid';
import { User, Department, Employee, MeasuringInstrument, Warehouse, IssueRecord, OperationLog, DashboardStats, InstrumentCategory, VerificationProtocol, VerificationSendoff } from './types';
import { calculateNextVerification, isVerificationExpired, isVerificationDueSoon } from './utils/domain';
import { CATEGORY_TEMPLATES } from './utils/customFields';
import { getStorageAdapter, StorageAdapter } from './services/storage';

let scannerOnline = false;
let scannerListeners: Array<() => void> = [];

export const scannerStatus = {
  isOnline: () => scannerOnline,
  setOnline: (online: boolean) => {
    scannerOnline = online;
    scannerListeners.forEach(listener => listener());
  },
  subscribe: (listener: () => void) => {
    scannerListeners.push(listener);
    return () => {
      scannerListeners = scannerListeners.filter(l => l !== listener);
    };
  }
};

const CURRENT_DATA_VERSION = '6.2';

function getSeedWarehouses(): Warehouse[] {
  return [
    { id: uuidv4(), name: 'Главный склад', location: 'Корпус А, помещение 101' },
    { id: uuidv4(), name: 'Склад №1', location: 'Корпус Б, помещение 205' },
    { id: uuidv4(), name: 'Склад №2', location: 'Корпус Б, помещение 206' },
    { id: uuidv4(), name: 'Склад №3', location: 'Корпус В, помещение 301' },
    { id: uuidv4(), name: 'Цеховой склад', location: 'Цех №1, участок хранения' },
  ];
}

function getSeedDepartments(): Department[] {
  return [
    { id: uuidv4(), name: 'Цех №1 — Механообработка', code: 'Ц1-МО' },
    { id: uuidv4(), name: 'Цех №2 — Сборка', code: 'Ц2-СБ' },
    { id: uuidv4(), name: 'Цех №3 — Контроль качества', code: 'Ц3-КК' },
    { id: uuidv4(), name: 'Метрологическая служба', code: 'МС-01' },
    { id: uuidv4(), name: 'Лаборатория испытаний', code: 'ЛИ-02' },
  ];
}

function getSeedEmployees(departments: Department[], warehouses: Warehouse[]): Employee[] {
  return [
    { id: uuidv4(), fullName: 'Иванов Пётр Сергеевич', tabNumber: '1001', departmentId: departments[0].id, comment: 'Опыт работы 5 лет', warehouseId: warehouses[0].id },
    { id: uuidv4(), fullName: 'Сидорова Анна Михайловна', tabNumber: '1002', departmentId: departments[1].id, comment: 'Ответственная за участок сборки', warehouseId: warehouses[1].id },
    { id: uuidv4(), fullName: 'Козлов Дмитрий Алексеевич', tabNumber: '1003', departmentId: departments[2].id, comment: 'Специалист по входному контролю', warehouseId: warehouses[0].id },
    { id: uuidv4(), fullName: 'Петрова Елена Владимировна', tabNumber: '1004', departmentId: departments[3].id, comment: 'Главный метролог', warehouseId: warehouses[0].id },
    { id: uuidv4(), fullName: 'Новиков Алексей Игоревич', tabNumber: '1005', departmentId: departments[0].id, comment: 'Наставник молодых специалистов', warehouseId: warehouses[2].id },
    { id: uuidv4(), fullName: 'Морозова Ольга Николаевна', tabNumber: '1006', departmentId: departments[4].id, comment: 'Руководитель лаборатории', warehouseId: warehouses[3].id },
  ];
}

function getSeedInstruments(warehouses: Warehouse[]): MeasuringInstrument[] {
  const today = new Date();
  const instrumentTypes = [
    { category: 'Анализатор спектра', models: ['FSU', 'FSL', 'FSV'], manufacturer: 'Rohde & Schwarz', range: '9 кГц - 43 ГГц', accuracy: '±0.5 дБ', customFields: [{ freq_min: 9000, freq_max: 43000000000, dyn_range: 110, phase_noise: -110 }] },
    { category: 'Генератор сигналов', models: ['SMA100B', 'SMW200A', 'SMB100A'], manufacturer: 'Rohde & Schwarz', range: '100 кГц - 43 ГГц', accuracy: '±0.1 дБ', customFields: [{ freq_min: 100000, freq_max: 43000000000, power_max: 27, modulation: 'AM' }] },
    { category: 'Осциллограф', models: ['RTO1014', 'RTO1024', 'RTM3004'], manufacturer: 'Rohde & Schwarz', range: '100 МГц - 6 ГГц', accuracy: '±2%', customFields: [{ bandwidth: 1000, channels: 4, sample_rate: 10, memory_depth: 100 }] },
    { category: 'Мультиметр', models: ['34461A', '34465A', '34470A'], manufacturer: 'Keysight', range: '0-1000 В', accuracy: '±0.02%', customFields: [{ voltage_dc_max: 1000, voltage_ac_max: 750, current_max: 3, digits: 6.5 }] },
    { category: 'Измеритель LCR', models: ['E4980A', 'E4982A', '4284A'], manufacturer: 'Keysight', range: '20 Гц - 2 МГц', accuracy: '±0.05%', customFields: [{ freq_test: 1, l_range: '100 мкГн - 100 Гн', c_range: '1 пФ - 1 Ф', r_range: '0.01 Ом - 100 МОм' }] },
    { category: 'Измеритель мощности', models: ['N1914A', 'N1913A', '436A'], manufacturer: 'Keysight', range: '100 МГц - 40 ГГц', accuracy: '±1%', customFields: [{ freq_min: 100, freq_max: 40000, power_min: -70, power_max: 100 }] },
    { category: 'Измеритель КСВ', models: ['N1501A', '8510C', '8720ES'], manufacturer: 'Keysight', range: '100 МГц - 50 ГГц', accuracy: '±0.01', customFields: [{ freq_min: 100, freq_max: 50000, vswr_range: '1.001 - 100', directivity: 40 }] },
    { category: 'Источник питания', models: ['E3631A', 'E3634A', 'N6705C'], manufacturer: 'Keysight', range: '0-60 В', accuracy: '±0.05%', customFields: [{ voltage_max: 60, current_max: 5, power_max: 200, channels: 3, stability: 2 }] },
  ];

  const instruments: MeasuringInstrument[] = [];

  for (let i = 1; i <= 150; i++) {
    const typeIndex = (i - 1) % instrumentTypes.length;
    const typeInfo = instrumentTypes[typeIndex];
    const modelIndex = Math.floor((i - 1) / instrumentTypes.length) % typeInfo.models.length;
    const model = typeInfo.models[modelIndex];
    
    const monthsAgo = Math.floor(Math.random() * 24) - 6;
    const lastVerificationDate = new Date(today);
    lastVerificationDate.setMonth(lastVerificationDate.getMonth() - monthsAgo);
    
    const intervalMonths = Math.random() > 0.5 ? 12 : 24;
    const nextVerificationDate = calculateNextVerification(lastVerificationDate.toISOString().split('T')[0], intervalMonths);
    
    let status: 'available' | 'issued' | 'repair' | 'decommissioned' | 'verification' = 'available';
    const statusRandom = Math.random();
    if (statusRandom > 0.92) status = 'issued';
    else if (statusRandom > 0.88) status = 'repair';
    else if (statusRandom > 0.85) status = 'decommissioned';
    else if (statusRandom > 0.80) status = 'verification';
    
    const warehouseIndex = i % warehouses.length;
    
    const customFields: Record<string, string | number> = {};
    if (typeInfo.customFields && typeInfo.customFields[0]) {
      const baseFields = typeInfo.customFields[0] as Record<string, string | number>;
      Object.keys(baseFields).forEach(key => {
        const baseValue = baseFields[key];
        if (typeof baseValue === 'number') {
          const variation = 1 + (Math.random() * 0.2 - 0.1);
          customFields[key] = Math.round(baseValue * variation * 100) / 100;
        } else {
          customFields[key] = baseValue;
        }
      });
    }
    
    instruments.push({
      id: uuidv4(),
      inventoryNumber: `СИ-${String(i).padStart(4, '0')}`,
      name: `${typeInfo.category} ${model}`,
      category: typeInfo.category,
      type: model,
      serialNumber: `${model}-${2015 + (i % 9)}-${String(1000 + i).padStart(4, '0')}`,
      manufacturer: typeInfo.manufacturer,
      range: typeInfo.range,
      accuracy: typeInfo.accuracy,
      status,
      lastVerificationDate: lastVerificationDate.toISOString().split('T')[0],
      intervalMonths,
      nextVerificationDate,
      location: status === 'issued' ? 'Выдан' : status === 'repair' ? 'Ремонтная мастерская' : status === 'decommissioned' ? 'Архив' : status === 'verification' ? 'Метрологическая служба' : 'Кладовая СИ',
      warehouseId: status === 'available' ? warehouses[warehouseIndex].id : null,
      customFields: customFields || {},
    });
  }

  return instruments;
}

function getSeedUsers(): User[] {
  return [
    { id: uuidv4(), username: 'guest', fullName: 'Гость', role: 'guest' },
    { id: uuidv4(), username: 'metrologist', fullName: 'Петрова Е.В.', role: 'metrologist' },
  ];
}

async function initializeStore(adapter: StorageAdapter): Promise<void> {
  await adapter.initStorage();
  
  const storedVersion = localStorage.getItem('mk_data_version');
  
  if (storedVersion !== CURRENT_DATA_VERSION) {
    const warehouses = getSeedWarehouses();
    const departments = getSeedDepartments();
    
    warehouses.forEach(w => adapter.addWarehouse(w));
    departments.forEach(d => adapter.addDepartment(d));
    getSeedEmployees(departments, warehouses).forEach(e => adapter.addEmployee(e));
    getSeedInstruments(warehouses).forEach(i => adapter.addInstrument(i));
    
    // Users остаются в localStorage (не часть бизнес-данных)
    const users = getSeedUsers();
    localStorage.setItem('mk_users', JSON.stringify(users));
    
    const defaultCategories: InstrumentCategory[] = CATEGORY_TEMPLATES.map((template: { category: string; fields: any[] }) => ({
      id: uuidv4(),
      name: template.category,
      description: `Категория для приборов типа "${template.category}"`,
      fields: template.fields,
      createdAt: new Date().toISOString()
    }));
    defaultCategories.forEach(c => adapter.addCategory(c));
    
    localStorage.setItem('mk_data_version', CURRENT_DATA_VERSION);
  }
}

let adapter: StorageAdapter | null = null;

export async function initStore(): Promise<void> {
  adapter = getStorageAdapter();
  await initializeStore(adapter);
}

function getAdapter(): StorageAdapter {
  if (!adapter) {
    throw new Error('Store not initialized. Call initStore() first.');
  }
  return adapter;
}

export const store = {
  // Users (остаются в localStorage)
  getUsers: (): User[] => { const data = localStorage.getItem('mk_users'); return data ? JSON.parse(data) : []; },
  getCurrentUser: (): User | null => { const data = localStorage.getItem('mk_current_user'); return data ? JSON.parse(data) : null; },
  setCurrentUser: (user: User | null) => { localStorage.setItem('mk_current_user', JSON.stringify(user)); },
  
  // Все бизнес-данные через адаптер
  getDepartments: (): Department[] => getAdapter().getDepartments(),
  addDepartment: (dept: Omit<Department, 'id'>): Department => getAdapter().addDepartment(dept),
  updateDepartment: (id: string, updates: Partial<Department>) => getAdapter().updateDepartment(id, updates),
  deleteDepartment: (id: string): { success: boolean; message: string } => getAdapter().deleteDepartment(id),
  
  getWarehouses: (): Warehouse[] => getAdapter().getWarehouses(),
  addWarehouse: (warehouse: Omit<Warehouse, 'id'>): Warehouse => getAdapter().addWarehouse(warehouse),
  updateWarehouse: (id: string, updates: Partial<Warehouse>) => getAdapter().updateWarehouse(id, updates),
  deleteWarehouse: (id: string): { success: boolean; message: string } => getAdapter().deleteWarehouse(id),
  
  getEmployees: (): Employee[] => getAdapter().getEmployees(),
  addEmployee: (emp: Omit<Employee, 'id'>): Employee => getAdapter().addEmployee(emp),
  updateEmployee: (id: string, updates: Partial<Employee>) => getAdapter().updateEmployee(id, updates),
  deleteEmployee: (id: string) => getAdapter().deleteEmployee(id),
  
  getInstruments: (): MeasuringInstrument[] => getAdapter().getInstruments(),
  addInstrument: (inst: Omit<MeasuringInstrument, 'id'>): MeasuringInstrument => {
    const instrument = getAdapter().addInstrument(inst);
    return instrument;
  },
  updateInstrument: (id: string, updates: Partial<MeasuringInstrument>) => getAdapter().updateInstrument(id, updates),
  deleteInstrument: (id: string) => getAdapter().deleteInstrument(id),
  
  getIssues: (): IssueRecord[] => getAdapter().getIssues(),
  addIssue: (issue: Omit<IssueRecord, 'id'>): IssueRecord => getAdapter().addIssue(issue),
  returnInstrument: (issueId: string, userId: string) => getAdapter().returnInstrument(issueId, userId),
  
  getOperations: (): OperationLog[] => getAdapter().getOperations(),
  addOperation: (op: Omit<OperationLog, 'id' | 'timestamp'>): OperationLog => getAdapter().addOperation(op),
  
  getCategories: (): InstrumentCategory[] => getAdapter().getCategories(),
  addCategory: (category: Omit<InstrumentCategory, 'id' | 'createdAt'>): InstrumentCategory => getAdapter().addCategory(category),
  updateCategory: (id: string, updates: Partial<Omit<InstrumentCategory, 'id' | 'createdAt'>>) => getAdapter().updateCategory(id, updates),
  deleteCategory: (id: string): { success: boolean; message: string } => getAdapter().deleteCategory(id),
  
  getProtocols: (): VerificationProtocol[] => getAdapter().getProtocols(),
  addProtocol: (protocol: Omit<VerificationProtocol, 'id' | 'createdAt' | 'updatedAt'>): VerificationProtocol => getAdapter().addProtocol(protocol),
  updateProtocol: (id: string, updates: Partial<VerificationProtocol>): VerificationProtocol | null => getAdapter().updateProtocol(id, updates),
  deleteProtocol: (id: string): boolean => getAdapter().deleteProtocol(id),
  
  getSendoffs: (): VerificationSendoff[] => getAdapter().getSendoffs(),
  addSendoff: (sendoff: Omit<VerificationSendoff, 'id'>): VerificationSendoff => getAdapter().addSendoff(sendoff),
  updateSendoff: (id: string, updates: Partial<VerificationSendoff>): VerificationSendoff | null => getAdapter().updateSendoff(id, updates),
  deleteSendoff: (id: string): boolean => getAdapter().deleteSendoff(id),
  
  getDashboardStats: (): DashboardStats => { 
    const instruments = getAdapter().getInstruments(); 
    return { 
      totalInstruments: instruments.length, 
      available: instruments.filter(i => i.status === 'available').length, 
      issued: instruments.filter(i => i.status === 'issued').length, 
      expiredVerification: instruments.filter(i => isVerificationExpired(i)).length, 
      verificationDueSoon: instruments.filter(i => isVerificationDueSoon(i)).length, 
      totalEmployees: getAdapter().getEmployees().length, 
      totalDepartments: getAdapter().getDepartments().length 
    }; 
  },
};
