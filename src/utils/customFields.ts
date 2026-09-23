import { CategoryTemplate, CustomField, MeasuringInstrument, FilterCondition } from '../types';

export const CATEGORY_TEMPLATES: CategoryTemplate[] = [
  {
    category: 'Анализатор спектра',
    fields: [
      { id: 'freq_min', name: 'Мин. частота', type: 'number', unit: 'кГц' },
      { id: 'freq_max', name: 'Макс. частота', type: 'number', unit: 'ГГц' },
      { id: 'sensitivity', name: 'Чувствительность', type: 'number', unit: 'дБм' },
      { id: 'dyn_range', name: 'Динамический диапазон', type: 'number', unit: 'дБ' },
    ]
  },
  {
    category: 'Генератор сигналов',
    fields: [
      { id: 'freq_min', name: 'Мин. частота', type: 'number', unit: 'кГц' },
      { id: 'freq_max', name: 'Макс. частота', type: 'number', unit: 'ГГц' },
      { id: 'power_max', name: 'Макс. мощность', type: 'number', unit: 'дБм' },
    ]
  },
  {
    category: 'Осциллограф',
    fields: [
      { id: 'bandwidth', name: 'Полоса пропускания', type: 'number', unit: 'МГц' },
      { id: 'channels', name: 'Количество каналов', type: 'number' },
      { id: 'sample_rate', name: 'Частота дискретизации', type: 'number', unit: 'Гвыб/с' },
    ]
  },
  {
    category: 'Мультиметр',
    fields: [
      { id: 'voltage_dc_max', name: 'Макс. напряжение DC', type: 'number', unit: 'В' },
      { id: 'voltage_ac_max', name: 'Макс. напряжение AC', type: 'number', unit: 'В' },
      { id: 'current_max', name: 'Макс. ток', type: 'number', unit: 'А' },
      { id: 'digits', name: 'Разрядность', type: 'number' },
    ]
  },
  {
    category: 'Измеритель LCR',
    fields: [
      { id: 'freq_min', name: 'Мин. частота', type: 'number', unit: 'Гц' },
      { id: 'freq_max', name: 'Макс. частота', type: 'number', unit: 'МГц' },
      { id: 'accuracy', name: 'Базовая точность', type: 'number', unit: '%' },
    ]
  },
  {
    category: 'Измеритель мощности',
    fields: [
      { id: 'freq_min', name: 'Мин. частота', type: 'number', unit: 'МГц' },
      { id: 'freq_max', name: 'Макс. частота', type: 'number', unit: 'ГГц' },
      { id: 'power_max', name: 'Макс. мощность', type: 'number', unit: 'Вт' },
    ]
  },
  {
    category: 'Измеритель КСВ',
    fields: [
      { id: 'freq_min', name: 'Мин. частота', type: 'number', unit: 'МГц' },
      { id: 'freq_max', name: 'Макс. частота', type: 'number', unit: 'ГГц' },
      { id: 'directivity', name: 'Направленность', type: 'number', unit: 'дБ' },
    ]
  },
  {
    category: 'Источник питания',
    fields: [
      { id: 'voltage_max', name: 'Макс. напряжение', type: 'number', unit: 'В' },
      { id: 'current_max', name: 'Макс. ток', type: 'number', unit: 'А' },
      { id: 'power_max', name: 'Макс. мощность', type: 'number', unit: 'Вт' },
    ]
  },
  {
    category: 'Тепловизор',
    fields: [
      { id: 'temp_min', name: 'Мин. температура', type: 'number', unit: '°C' },
      { id: 'temp_max', name: 'Макс. температура', type: 'number', unit: '°C' },
      { id: 'resolution', name: 'Разрешение', type: 'number', unit: 'пикселей' },
      { id: 'thermal_sensitivity', name: 'Тепловая чувствительность', type: 'number', unit: 'мК' },
    ]
  },
  {
    category: 'Пирометр',
    fields: [
      { id: 'temp_min', name: 'Мин. температура', type: 'number', unit: '°C' },
      { id: 'temp_max', name: 'Макс. температура', type: 'number', unit: '°C' },
      { id: 'accuracy', name: 'Точность', type: 'number', unit: '°C' },
    ]
  }
];

export function getFieldsForCategory(category: string): CustomField[] {
  const template = CATEGORY_TEMPLATES.find(t => t.category === category);
  return template?.fields || [];
}

export function getAllCategories(): string[] {
  return CATEGORY_TEMPLATES.map(t => t.category).sort();
}

export function applyFilters(
  instruments: MeasuringInstrument[],
  conditions: FilterCondition[],
  fields: CustomField[]
): MeasuringInstrument[] {
  if (conditions.length === 0) return instruments;

  return instruments.filter(instrument => {
    return conditions.every(condition => {
      const field = fields.find(f => f.id === condition.fieldId);
      if (!field) return false;

      const value = instrument.customFields?.[condition.fieldId];
      if (value === undefined || value === null) return false;
      const numValue = Number(value);
      if (isNaN(numValue)) return false;

      switch (condition.operator) {
        case 'equals':
          return String(value) === String(condition.value);
        case 'contains':
          return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
        case 'greater':
          // ≥ — больше или равно
          return numValue >= Number(condition.value);
        case 'less':
          // ≤ — меньше или равно
          return numValue <= Number(condition.value);
        case 'between':
          if (Array.isArray(condition.value) && condition.value.length === 2) {
            return numValue >= condition.value[0] && numValue <= condition.value[1];
          }
          return false;
        default:
          return false;
      }
    });
  });
}

const FILTERS_KEY = 'mk_saved_filters';

export function saveFilter(filter: { name: string; category: string; conditions: FilterCondition[] }): string {
  const filters = getSavedFilters();
  const newFilter = {
    id: crypto.randomUUID(),
    ...filter,
    createdAt: new Date().toISOString()
  };
  filters.push(newFilter);
  localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
  return newFilter.id;
}

export function getSavedFilters(): Array<{ id: string; name: string; category: string; conditions: FilterCondition[]; createdAt: string }> {
  const data = localStorage.getItem(FILTERS_KEY);
  return data ? JSON.parse(data) : [];
}

export function deleteFilter(filterId: string): void {
  const filters = getSavedFilters();
  const filtered = filters.filter(f => f.id !== filterId);
  localStorage.setItem(FILTERS_KEY, JSON.stringify(filtered));
}

export function updateFilter(filterId: string, updates: Partial<{ name: string; conditions: FilterCondition[] }>): void {
  const filters = getSavedFilters();
  const updated = filters.map(f => 
    f.id === filterId ? { ...f, ...updates } : f
  );
  localStorage.setItem(FILTERS_KEY, JSON.stringify(updated));
}
