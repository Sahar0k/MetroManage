import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../store';
import { MeasuringInstrument, Employee } from '../types';
import { fetchCard, mapToInstrument, GosreestrCard } from './gosreestrService';

export interface ExcelRow {
  [key: string]: any;
}

export interface ImportMapping {
  inventoryNumber?: string;
  name?: string;
  manufacturer?: string;
  type?: string;
  serialNumber?: string;
  responsible?: string;
  gosreestrNumber?: string;
  purchaseDate?: string;
  warrantyPeriod?: string;
  completeness?: string;
  notes?: string;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ImportReport {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  enriched: number;
  notFound: number;
  errors: ValidationError[];
}

export interface EnrichmentProgress {
  current: number;
  total: number;
  enriched: number;
  notFound: number;
}

export interface EnrichedInstrument extends Partial<MeasuringInstrument> {
  gosreestrNumber?: string;
  gosreestrCard?: any;
  notInRegistry?: boolean;
}

// Стандартный маппинг колонок
export const DEFAULT_MAPPING: ImportMapping = {
  inventoryNumber: '№ п/п',
  name: 'Наименование',
  manufacturer: 'Производитель',
  type: 'Модель',
  serialNumber: 'Заводской номер',
  responsible: 'Ответственный',
  gosreestrNumber: 'Номер в гос. реестре',
  purchaseDate: 'Дата покупки',
  warrantyPeriod: 'Срок гарантии',
  completeness: 'Комплектность',
  notes: 'Примечание',
};

/**
 * Парсинг Excel файла
 */
export function parseExcel(file: File): Promise<ExcelRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        resolve(jsonData as ExcelRow[]);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsBinaryString(file);
  });
}

/**
 * Валидация данных перед импортом
 */
export function validateImport(
  rows: ExcelRow[],
  mapping: ImportMapping
): { valid: boolean; errors: ValidationError[]; duplicates: Set<string> } {
  const errors: ValidationError[] = [];
  const serialNumbers = new Set<string>();
  const duplicates = new Set<string>();
  
  rows.forEach((row, index) => {
    const rowNum = index + 2; // Excel строки начинаются с 1, плюс заголовок
    
    // Проверка обязательных полей
    const name = row[mapping.name || ''];
    if (!name || String(name).trim() === '') {
      errors.push({ row: rowNum, field: 'Наименование', message: 'Обязательное поле' });
    }
    
    const manufacturer = row[mapping.manufacturer || ''];
    if (!manufacturer || String(manufacturer).trim() === '') {
      errors.push({ row: rowNum, field: 'Производитель', message: 'Обязательное поле' });
    }
    
    const type = row[mapping.type || ''];
    if (!type || String(type).trim() === '') {
      errors.push({ row: rowNum, field: 'Модель', message: 'Обязательное поле' });
    }
    
    // Проверка дубликатов заводских номеров
    const serialNumber = row[mapping.serialNumber || ''];
    if (serialNumber && String(serialNumber).trim() !== '') {
      const sn = String(serialNumber).trim();
      if (serialNumbers.has(sn)) {
        duplicates.add(sn);
        errors.push({ row: rowNum, field: 'Заводской номер', message: `Дубликат: ${sn}` });
      } else {
        serialNumbers.add(sn);
      }
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    duplicates,
  };
}

/**
 * Преобразование строки Excel в MeasuringInstrument
 */
export function mapRowToInstrument(
  row: ExcelRow,
  mapping: ImportMapping,
  index: number
): Partial<MeasuringInstrument> {
  const inventoryNumber = row[mapping.inventoryNumber || ''] 
    ? String(row[mapping.inventoryNumber || '']) 
    : `СИ-${String(index + 1).padStart(4, '0')}`;
  
  return {
    inventoryNumber,
    name: String(row[mapping.name || ''] || ''),
    manufacturer: String(row[mapping.manufacturer || ''] || ''),
    type: String(row[mapping.type || ''] || ''),
    serialNumber: String(row[mapping.serialNumber || ''] || ''),
    category: '', // Будет определено позже
    range: '',
    accuracy: '',
    status: 'available',
    lastVerificationDate: null, // Нет даты поверки в Excel
    intervalMonths: 12, // По умолчанию
    nextVerificationDate: null,
    location: 'Кладовая СИ',
    warehouseId: null,
    customFields: {},
  };
}

/**
 * Поиск сотрудника по ФИО
 */
export function findEmployeeByName(fullName: string): Employee | undefined {
  const employees = store.getEmployees();
  return employees.find(emp => 
    emp.fullName.toLowerCase().includes(fullName.toLowerCase()) ||
    fullName.toLowerCase().includes(emp.fullName.toLowerCase())
  );
}

/**
 * Создание черновика сотрудника если не найден
 */
export function createDraftEmployee(fullName: string): Employee {
  const departments = store.getDepartments();
  const warehouses = store.getWarehouses();
  
  return store.addEmployee({
    fullName,
    tabNumber: `DRAFT-${Date.now()}`,
    departmentId: departments[0]?.id || '',
    comment: 'Черновик, создан при импорте',
    warehouseId: warehouses[0]?.id,
  });
}

/**
 * Пакетное обогащение через Госреестр
 */
export async function enrichFromGosreestr(
  instruments: EnrichedInstrument[],
  onProgress: (progress: EnrichmentProgress) => void,
  signal?: AbortSignal
): Promise<{ enriched: number; notFound: number }> {
  let enriched = 0;
  let notFound = 0;
  
  for (let i = 0; i < instruments.length; i++) {
    if (signal?.aborted) break;
    
    const inst = instruments[i];
    const gosreestrNumber = inst.gosreestrNumber;
    
    onProgress({
      current: i + 1,
      total: instruments.length,
      enriched,
      notFound,
    });
    
    try {
      let card: GosreestrCard | null = null;
      
      // Если есть номер в госреестре - точный поиск
      if (gosreestrNumber && gosreestrNumber !== '-' && gosreestrNumber.trim() !== '') {
        // Ищем по номеру
        const { searchByQuery } = await import('./gosreestrService');
        const hints = await searchByQuery(gosreestrNumber, signal);
        
        if (hints.length > 0) {
          card = await fetchCard(hints[0].id, signal);
        }
      } else {
        // Пытаемся поиск по модели
        if (inst.type && inst.type.trim() !== '') {
          const { searchByQuery } = await import('./gosreestrService');
          const hints = await searchByQuery(inst.type, signal);
          
          if (hints.length > 0) {
            card = await fetchCard(hints[0].id, signal);
          }
        }
      }
      
      if (card) {
        const mapped = mapToInstrument(card);
        Object.assign(inst, mapped);
        inst.gosreestrCard = card; // Сохраняем для скачивания PDF
        enriched++;
      } else {
        delete inst.gosreestrNumber;
        inst.notInRegistry = true;
        notFound++;
      }
    } catch (error) {
      console.error('Enrichment error:', error);
      notFound++;
    }
  }
  
  return { enriched, notFound };
}

/**
 * Импорт приборов в store
 */
export function importToStore(
  instruments: Partial<MeasuringInstrument>[],
  mapping: ImportMapping,
  rows: ExcelRow[]
): { imported: number; employees: number } {
  let imported = 0;
  let employeesCreated = 0;
  
  instruments.forEach((inst, index) => {
    const row = rows[index];
    
    // Обработка ответственного
    const responsibleName = row[mapping.responsible || ''];
    let employeeId: string | null = null;
    
    if (responsibleName && String(responsibleName).trim() !== '') {
      const emp = findEmployeeByName(String(responsibleName));
      if (emp) {
        employeeId = emp.id;
      } else {
        // Создаём черновик сотрудника
        const draftEmp = createDraftEmployee(String(responsibleName));
        employeeId = draftEmp.id;
        employeesCreated++;
      }
    }
    
    // Создаём прибор
    const newInstrument = store.addInstrument({
      ...inst,
      category: inst.category || 'Без категории',
      range: inst.range || '—',
      accuracy: inst.accuracy || '—',
      nextVerificationDate: null,
    } as Omit<MeasuringInstrument, 'id'>);
    
    imported++;
  });
  
  return { imported, employees: employeesCreated };
}

/**
 * Получение списка приборов без даты поверки
 */
export function getInstrumentsWithoutVerificationDate(): MeasuringInstrument[] {
  return store.getInstruments().filter(i => !i.lastVerificationDate);
}
