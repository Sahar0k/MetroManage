import { v4 as uuidv4 } from 'uuid';
import { User, Department, Employee, MeasuringInstrument, Warehouse, IssueRecord, OperationLog, DashboardStats, InstrumentCategory, VerificationProtocol } from './types';
import { calculateNextVerification, isVerificationExpired, isVerificationDueSoon } from './utils/domain';
import { CATEGORY_TEMPLATES } from './utils/customFields';

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

const STORAGE_KEYS = {
  users: 'mk_users',
  departments: 'mk_departments',
  employees: 'mk_employees',
  instruments: 'mk_instruments',
  warehouses: 'mk_warehouses',
  issues: 'mk_issues',
  operations: 'mk_operations',
  currentUser: 'mk_current_user',
  theme: 'mk_theme',
  dataVersion: 'mk_data_version',
  categories: 'mk_categories',
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

  // Добавляем тестовые приборы на поверке
  const verificationInstruments: MeasuringInstrument[] = [
    {
      id: uuidv4(),
      inventoryNumber: 'СИ-ВРФ-001',
      name: 'Анализатор спектра Rohde & Schwarz FSV',
      category: 'Анализатор спектра',
      type: 'FSV',
      serialNumber: 'FSV-2020-5001',
      manufacturer: 'Rohde & Schwarz',
      range: '10 МГц - 43 ГГц',
      accuracy: '±0.5 дБ',
      status: 'verification',
      lastVerificationDate: new Date(today.getFullYear() - 1, today.getMonth(), 15).toISOString().split('T')[0],
      intervalMonths: 12,
      nextVerificationDate: calculateNextVerification(new Date(today.getFullYear() - 1, today.getMonth(), 15).toISOString().split('T')[0], 12),
      location: 'Метрологическая служба',
      warehouseId: null,
      customFields: { freq_min: 10000, freq_max: 43000000000, dyn_range: 115, phase_noise: -105 }
    },
    {
      id: uuidv4(),
      inventoryNumber: 'СИ-ВРФ-002',
      name: 'Осциллограф Rohde & Schwarz RTO1024',
      category: 'Осциллограф',
      type: 'RTO1024',
      serialNumber: 'RTO-2019-3002',
      manufacturer: 'Rohde & Schwarz',
      range: '100 МГц - 2 ГГц',
      accuracy: '±2%',
      status: 'verification',
      lastVerificationDate: new Date(today.getFullYear() - 1, today.getMonth() - 2, 10).toISOString().split('T')[0],
      intervalMonths: 12,
      nextVerificationDate: calculateNextVerification(new Date(today.getFullYear() - 1, today.getMonth() - 2, 10).toISOString().split('T')[0], 12),
      location: 'Метрологическая служба',
      warehouseId: null,
      customFields: { bandwidth: 2000, channels: 4, sample_rate: 10, memory_depth: 100 }
    },
    {
      id: uuidv4(),
      inventoryNumber: 'СИ-ВРФ-003',
      name: 'Мультиметр Keysight 34465A',
      category: 'Мультиметр',
      type: '34465A',
      serialNumber: '34465A-2021-7003',
      manufacturer: 'Keysight',
      range: '0-1000 В',
      accuracy: '±0.02%',
      status: 'verification',
      lastVerificationDate: new Date(today.getFullYear() - 1, today.getMonth() - 1, 20).toISOString().split('T')[0],
      intervalMonths: 12,
      nextVerificationDate: calculateNextVerification(new Date(today.getFullYear() - 1, today.getMonth() - 1, 20).toISOString().split('T')[0], 12),
      location: 'Метрологическая служба',
      warehouseId: null,
      customFields: { voltage_dc_max: 1000, voltage_ac_max: 750, current_max: 3, digits: 6.5 }
    },
    {
      id: uuidv4(),
      inventoryNumber: 'СИ-ВРФ-004',
      name: 'Генератор сигналов Rohde & Schwarz SMA100B',
      category: 'Генератор сигналов',
      type: 'SMA100B',
      serialNumber: 'SMA-2020-4004',
      manufacturer: 'Rohde & Schwarz',
      range: '100 кГц - 43 ГГц',
      accuracy: '±0.1 дБ',
      status: 'verification',
      lastVerificationDate: new Date(today.getFullYear() - 1, today.getMonth() - 3, 5).toISOString().split('T')[0],
      intervalMonths: 12,
      nextVerificationDate: calculateNextVerification(new Date(today.getFullYear() - 1, today.getMonth() - 3, 5).toISOString().split('T')[0], 12),
      location: 'Метрологическая служба',
      warehouseId: null,
      customFields: { freq_min: 100000, freq_max: 43000000000, power_max: 27, modulation: 'AM' }
    },
    {
      id: uuidv4(),
      inventoryNumber: 'СИ-ВРФ-005',
      name: 'Измеритель LCR Keysight E4980A',
      category: 'Измеритель LCR',
      type: 'E4980A',
      serialNumber: 'E4980A-2019-6005',
      manufacturer: 'Keysight',
      range: '20 Гц - 2 МГц',
      accuracy: '±0.05%',
      status: 'verification',
      lastVerificationDate: new Date(today.getFullYear() - 1, today.getMonth() - 4, 25).toISOString().split('T')[0],
      intervalMonths: 12,
      nextVerificationDate: calculateNextVerification(new Date(today.getFullYear() - 1, today.getMonth() - 4, 25).toISOString().split('T')[0], 12),
      location: 'Метрологическая служба',
      warehouseId: null,
      customFields: { freq_test: 1, l_range: '100 мкГн - 100 Гн', c_range: '1 пФ - 1 Ф', r_range: '0.01 Ом - 100 МОм' }
    }
  ];

  instruments.push(...verificationInstruments);

  return instruments;
}

function getSeedUsers(): User[] {
  return [
    { id: uuidv4(), username: 'guest', fullName: 'Гость', role: 'guest' },
    { id: uuidv4(), username: 'metrologist', fullName: 'Петрова Е.В.', role: 'metrologist' },
  ];
}

function initializeStore(): void {
  const storedVersion = localStorage.getItem(STORAGE_KEYS.dataVersion);
  
  if (storedVersion !== CURRENT_DATA_VERSION) {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    
    const warehouses = getSeedWarehouses();
    const departments = getSeedDepartments();
    localStorage.setItem('mk_warehouses', JSON.stringify(warehouses));
    localStorage.setItem('mk_departments', JSON.stringify(departments));
    localStorage.setItem('mk_employees', JSON.stringify(getSeedEmployees(departments, warehouses)));
    localStorage.setItem('mk_instruments', JSON.stringify(getSeedInstruments(warehouses)));
    localStorage.setItem('mk_users', JSON.stringify(getSeedUsers()));
    localStorage.setItem('mk_issues', JSON.stringify([]));
    localStorage.setItem('mk_operations', JSON.stringify([]));
    
    const defaultCategories: InstrumentCategory[] = CATEGORY_TEMPLATES.map((template: { category: string; fields: any[] }) => ({
      id: uuidv4(),
      name: template.category,
      description: `Категория для приборов типа "${template.category}"`,
      fields: template.fields,
      createdAt: new Date().toISOString()
    }));
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(defaultCategories));
    
    localStorage.setItem(STORAGE_KEYS.dataVersion, CURRENT_DATA_VERSION);
  }
}

initializeStore();

export const store = {
  getUsers: (): User[] => { const data = localStorage.getItem('mk_users'); return data ? JSON.parse(data) : []; },
  getCurrentUser: (): User | null => { const data = localStorage.getItem('mk_current_user'); return data ? JSON.parse(data) : null; },
  setCurrentUser: (user: User | null) => { localStorage.setItem('mk_current_user', JSON.stringify(user)); },
  getDepartments: (): Department[] => { const data = localStorage.getItem('mk_departments'); return data ? JSON.parse(data) : []; },
  addDepartment: (dept: Omit<Department, 'id'>): Department => { const departments = store.getDepartments(); const newDept = { ...dept, id: uuidv4() }; departments.push(newDept); localStorage.setItem('mk_departments', JSON.stringify(departments)); return newDept; },
  updateDepartment: (id: string, updates: Partial<Department>) => { const departments = store.getDepartments().map(d => d.id === id ? { ...d, ...updates } : d); localStorage.setItem('mk_departments', JSON.stringify(departments)); },
  deleteDepartment: (id: string): { success: boolean; message: string } => { const employees = store.getEmployees().filter(e => e.departmentId === id); if (employees.length > 0) return { success: false, message: `Нельзя удалить отдел: в нём ${employees.length} сотрудник(ов)` }; const departments = store.getDepartments().filter(d => d.id !== id); localStorage.setItem('mk_departments', JSON.stringify(departments)); return { success: true, message: 'Отдел удалён' }; },
  getWarehouses: (): Warehouse[] => { const data = localStorage.getItem('mk_warehouses'); return data ? JSON.parse(data) : []; },
  addWarehouse: (warehouse: Omit<Warehouse, 'id'>): Warehouse => { const warehouses = store.getWarehouses(); const newWarehouse = { ...warehouse, id: uuidv4() }; warehouses.push(newWarehouse); localStorage.setItem('mk_warehouses', JSON.stringify(warehouses)); return newWarehouse; },
  updateWarehouse: (id: string, updates: Partial<Warehouse>) => { const warehouses = store.getWarehouses().map(w => w.id === id ? { ...w, ...updates } : w); localStorage.setItem('mk_warehouses', JSON.stringify(warehouses)); },
  deleteWarehouse: (id: string): { success: boolean; message: string } => { const employees = store.getEmployees().filter(e => e.warehouseId === id); const instruments = store.getInstruments().filter(i => i.warehouseId === id); if (employees.length > 0 || instruments.length > 0) return { success: false, message: `Нельзя удалить склад: используется` }; const warehouses = store.getWarehouses().filter(w => w.id !== id); localStorage.setItem('mk_warehouses', JSON.stringify(warehouses)); return { success: true, message: 'Склад удалён' }; },
  getEmployees: (): Employee[] => { const data = localStorage.getItem('mk_employees'); return data ? JSON.parse(data) : []; },
  addEmployee: (emp: Omit<Employee, 'id'>): Employee => { const employees = store.getEmployees(); const newEmp = { ...emp, id: uuidv4() }; employees.push(newEmp); localStorage.setItem('mk_employees', JSON.stringify(employees)); return newEmp; },
  updateEmployee: (id: string, updates: Partial<Employee>) => { const employees = store.getEmployees().map(e => e.id === id ? { ...e, ...updates } : e); localStorage.setItem('mk_employees', JSON.stringify(employees)); },
  deleteEmployee: (id: string) => { const employees = store.getEmployees().filter(e => e.id !== id); localStorage.setItem('mk_employees', JSON.stringify(employees)); },
  getInstruments: (): MeasuringInstrument[] => { const data = localStorage.getItem('mk_instruments'); return data ? JSON.parse(data) : []; },
  addInstrument: (inst: Omit<MeasuringInstrument, 'id' | 'nextVerificationDate'>): MeasuringInstrument => { const instruments = store.getInstruments(); const nextVerificationDate = calculateNextVerification(inst.lastVerificationDate, inst.intervalMonths); const newInst = { ...inst, id: uuidv4(), nextVerificationDate }; instruments.push(newInst); localStorage.setItem('mk_instruments', JSON.stringify(instruments)); return newInst; },
  updateInstrument: (id: string, updates: Partial<MeasuringInstrument>) => { const instruments = store.getInstruments().map(i => { if (i.id === id) { const updated = { ...i, ...updates }; if (updates.lastVerificationDate !== undefined || updates.intervalMonths !== undefined) { updated.nextVerificationDate = calculateNextVerification(updated.lastVerificationDate, updated.intervalMonths); } return updated; } return i; }); localStorage.setItem('mk_instruments', JSON.stringify(instruments)); },
  deleteInstrument: (id: string) => { const instruments = store.getInstruments().filter(i => i.id !== id); localStorage.setItem('mk_instruments', JSON.stringify(instruments)); },
  getIssues: (): IssueRecord[] => { const data = localStorage.getItem('mk_issues'); return data ? JSON.parse(data) : []; },
  addIssue: (issue: Omit<IssueRecord, 'id'>): IssueRecord => { const issues = store.getIssues(); const newIssue = { ...issue, id: uuidv4() }; issues.push(newIssue); localStorage.setItem('mk_issues', JSON.stringify(issues)); return newIssue; },
  returnInstrument: (issueId: string, userId: string) => { const issues = store.getIssues().map(i => i.id === issueId ? { ...i, returnedAt: new Date().toISOString(), returnedBy: userId } : i); localStorage.setItem('mk_issues', JSON.stringify(issues)); },
  getOperations: (): OperationLog[] => { const data = localStorage.getItem('mk_operations'); return data ? JSON.parse(data) : []; },
  addOperation: (op: Omit<OperationLog, 'id' | 'timestamp'>): OperationLog => { const operations = store.getOperations(); const newOp = { ...op, id: uuidv4(), timestamp: new Date().toISOString() }; operations.unshift(newOp); localStorage.setItem('mk_operations', JSON.stringify(operations.slice(0, 500))); return newOp; },
  getCategories: (): InstrumentCategory[] => { const data = localStorage.getItem(STORAGE_KEYS.categories); return data ? JSON.parse(data) : []; },
  addCategory: (category: Omit<InstrumentCategory, 'id' | 'createdAt'>): InstrumentCategory => { const categories = store.getCategories(); const newCategory = { ...category, id: uuidv4(), createdAt: new Date().toISOString() }; categories.push(newCategory); localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories)); return newCategory; },
  updateCategory: (id: string, updates: Partial<Omit<InstrumentCategory, 'id' | 'createdAt'>>) => { const categories = store.getCategories().map(c => c.id === id ? { ...c, ...updates } : c); localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories)); },
  deleteCategory: (id: string): { success: boolean; message: string } => { const category = store.getCategories().find(c => c.id === id); if (!category) return { success: false, message: 'Категория не найдена' }; const instruments = store.getInstruments(); const hasInstruments = instruments.some(i => i.category === category.name); if (hasInstruments) return { success: false, message: `Нельзя удалить категорию: в ней есть приборы (${instruments.filter(i => i.category === category.name).length} шт.)` }; const categories = store.getCategories().filter(c => c.id !== id); localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories)); return { success: true, message: 'Категория удалена' }; },
  getDashboardStats: (): DashboardStats => { const instruments = store.getInstruments(); return { totalInstruments: instruments.length, available: instruments.filter(i => i.status === 'available').length, issued: instruments.filter(i => i.status === 'issued').length, expiredVerification: instruments.filter(i => isVerificationExpired(i)).length, verificationDueSoon: instruments.filter(i => isVerificationDueSoon(i)).length, totalEmployees: store.getEmployees().length, totalDepartments: store.getDepartments().length }; },
  // === Рабочее место поверителя ===
  getProtocols: (): VerificationProtocol[] => { const data = localStorage.getItem('mk_verification_protocols'); return data ? JSON.parse(data) : []; },
  addProtocol: (protocol: Omit<VerificationProtocol, 'id' | 'createdAt' | 'updatedAt'>): VerificationProtocol => { const protocols = store.getProtocols(); const newProtocol = { ...protocol, id: uuidv4(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; protocols.push(newProtocol); localStorage.setItem('mk_verification_protocols', JSON.stringify(protocols)); return newProtocol; },
  updateProtocol: (id: string, updates: Partial<VerificationProtocol>): VerificationProtocol | null => { const protocols = store.getProtocols(); const protocol = protocols.find(p => p.id === id); if (!protocol) return null; if (protocol.status === 'completed' || protocol.status === 'rejected') { throw new Error('Нельзя изменять завершённый или отклонённый протокол'); } const updated = { ...protocol, ...updates, updatedAt: new Date().toISOString() }; const newProtocols = protocols.map(p => p.id === id ? updated : p); localStorage.setItem('mk_verification_protocols', JSON.stringify(newProtocols)); return updated; },
  deleteProtocol: (id: string): boolean => { const protocols = store.getProtocols(); const protocol = protocols.find(p => p.id === id); if (!protocol) return false; if (protocol.status === 'completed' || protocol.status === 'rejected') { throw new Error('Нельзя удалить завершённый или отклонённый протокол'); } const newProtocols = protocols.filter(p => p.id !== id); localStorage.setItem('mk_verification_protocols', JSON.stringify(newProtocols)); return true; },
};
