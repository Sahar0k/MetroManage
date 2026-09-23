import { useState, useMemo, useCallback } from 'react';
import { MeasuringInstrument, FilterCondition, CustomField, SavedFilter } from '../types';
import { getFieldsForCategory, applyFilters, saveFilter, getSavedFilters, deleteFilter, getAllCategories } from '../utils/customFields';
import { useNotification } from '../contexts/NotificationContext';
import { Filter, Save, Trash2, X, Plus } from 'lucide-react';

interface FilterBuilderProps { instruments: MeasuringInstrument[]; onApplyFilter: (filtered: MeasuringInstrument[]) => void; onClose: () => void; }

// Операторы для числовых и текстовых полей
const NUMERIC_OPERATORS: { value: FilterCondition['operator']; label: string }[] = [
  { value: 'equals', label: '=' },
  { value: 'greater', label: '≥' },
  { value: 'less', label: '≤' },
];

const TEXT_OPERATORS: { value: FilterCondition['operator']; label: string }[] = [
  { value: 'equals', label: '=' },
  { value: 'contains', label: 'содержит' },
];

function getFieldByType(fields: CustomField[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const f of fields) {
    map[f.id] = f.type === 'number';
  }
  return map;
}

export default function FilterBuilder({ instruments, onApplyFilter, onClose }: FilterBuilderProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [filterName, setFilterName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(getSavedFilters());
  const notification = useNotification();
  const categories = useMemo(() => getAllCategories(), []);
  const availableFields = useMemo(() => selectedCategory ? getFieldsForCategory(selectedCategory) : [], [selectedCategory]);
  const isNumericMap = useMemo(() => getFieldByType(availableFields), [availableFields]);

  const filteredInstruments = useMemo(() => {
    let result = instruments;
    if (selectedCategory) result = result.filter(i => i.category === selectedCategory);
    if (conditions.length > 0) result = applyFilters(result, conditions, availableFields);
    return result;
  }, [instruments, selectedCategory, conditions, availableFields]);

  const handleAddCondition = useCallback(() => {
    if (availableFields.length === 0) return;
    const firstField = availableFields[0];
    const isNum = isNumericMap[firstField.id];
    setConditions([...conditions, { fieldId: firstField.id, operator: 'equals', value: isNum ? 0 : '' }]);
  }, [availableFields, conditions, isNumericMap]);

  const handleUpdateCondition = useCallback((index: number, updates: Partial<FilterCondition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setConditions(newConditions);
  }, [conditions]);

  const handleRemoveCondition = useCallback((index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  }, [conditions]);

  const handleSaveFilter = useCallback(() => {
    if (!filterName || !selectedCategory) return;
    saveFilter({ name: filterName, category: selectedCategory, conditions });
    setSavedFilters(getSavedFilters());
    setShowSaveDialog(false);
    setFilterName('');
  }, [filterName, selectedCategory, conditions]);

  const handleLoadFilter = useCallback((filter: SavedFilter) => {
    setSelectedCategory(filter.category);
    setConditions(filter.conditions);
  }, []);

  const handleDeleteFilter = useCallback((filterId: string) => {
    deleteFilter(filterId);
    setSavedFilters(getSavedFilters());
  }, []);

  // Обновление значения condition при смене оператора — сбрасываем значение
  const handleOperatorChange = useCallback((index: number, op: FilterCondition['operator']) => {
    const isNum = conditions[index]?.fieldId ? isNumericMap[conditions[index].fieldId] ?? false : false;
    setConditions(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], operator: op, value: isNum ? 0 : '' };
      return copy;
    });
  }, [isNumericMap]);

  const handleApply = () => {
    if (conditions.length === 0) {
      notification.info('Фильтр пуст', 'Добавьте хотя бы одно условие');
      return;
    }
    onApplyFilter(filteredInstruments);
    onClose();
  };

  // Получить индекс условия по fieldId (для inline-обновления)
  const getConditionIndex = (fieldId: string) => conditions.findIndex(c => c.fieldId === fieldId);

  const getInputForOperator = (condition: FilterCondition) => {
    const isNum = isNumericMap[condition.fieldId] ?? false;
    const idx = getConditionIndex(condition.fieldId);
    if (idx < 0) return null;
    switch (condition.operator) {
      case 'equals':
        return (
          <input
            type={isNum ? 'number' : 'text'}
            value={String(condition.value ?? '')}
            onChange={(e) => handleUpdateCondition(idx, {
              fieldId: condition.fieldId,
              operator: condition.operator,
              value: isNum ? Number(e.target.value) : e.target.value,
            })}
            className="w-32 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white text-sm"
            placeholder={isNum ? '0' : 'значение'}
          />
        );
      case 'greater':
      case 'less':
        return (
          <input
            type="number"
            value={String(condition.value ?? '')}
            onChange={(e) => handleUpdateCondition(idx, {
              fieldId: condition.fieldId,
              operator: condition.operator,
              value: Number(e.target.value),
            })}
            className="w-32 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white text-sm"
            placeholder="значение"
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-800 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto wizard-scroll">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Filter size={24} className="text-cyan-400" />
            Конструктор фильтров
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700">
            <X size={20} />
          </button>
        </div>

        {/* Сохранённые фильтры */}
        {savedFilters.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Сохранённые фильтры</h3>
            <div className="flex flex-wrap gap-2">
              {savedFilters.map(filter => (
                <div key={filter.id} className="flex items-center gap-2 bg-slate-700 rounded-lg px-3 py-2">
                  <button
                    onClick={() => handleLoadFilter(filter)}
                    className="text-sm text-cyan-400 hover:text-cyan-300"
                    title={filter.conditions.length + ' условий'}
                  >
                    {filter.name}
                  </button>
                  <button
                    onClick={() => handleDeleteFilter(filter.id)}
                    className="text-slate-400 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Категория */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">Категория</label>
          <select
            value={selectedCategory}
            onChange={(e) => { setSelectedCategory(e.target.value); setConditions([]); }}
            className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
          >
            <option value="">Все категории</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

        {/* Условия */}
        {availableFields.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-300">Условия</h3>
              <button
                onClick={handleAddCondition}
                className="flex items-center gap-1 px-3 py-1.5 bg-cyan-500 text-white rounded-lg text-sm hover:bg-cyan-600"
              >
                <Plus size={14} /> Добавить
              </button>
            </div>
            <div className="space-y-3">
              {conditions.map((condition, index) => {
                const field = availableFields.find(f => f.id === condition.fieldId);
                const numOperators = isNumericMap[condition.fieldId] ?? false;
                return (
                  <div key={index} className="flex items-start gap-2 bg-slate-700/50 rounded-lg p-3">
                    <select
                      value={condition.fieldId}
                      onChange={(e) => handleUpdateCondition(index, { fieldId: e.target.value })}
                      className="flex-1 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white text-sm"
                    >
                      {availableFields.map(field => (
                        <option key={field.id} value={field.id}>
                          {field.name}{field.unit ? ` (${field.unit})` : ''}
                        </option>
                      ))}
                    </select>
                    <select
                      value={condition.operator}
                      onChange={(e) => handleOperatorChange(index, e.target.value as FilterCondition['operator'])}
                      className="px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white text-sm w-24"
                    >
                      {(numOperators ? NUMERIC_OPERATORS : TEXT_OPERATORS).map(op => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                    {getInputForOperator(condition)}
                    <button
                      onClick={() => handleRemoveCondition(index)}
                      className="p-1 text-slate-400 hover:text-red-400 mt-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
              {conditions.length === 0 && (
                <p className="text-xs text-slate-500 italic">Нет условий — добавьте первое</p>
              )}
            </div>
          </div>
        )}

        {/* Счётчик */}
        <div className="mb-6 bg-slate-700/30 rounded-lg p-4">
          <p className="text-sm text-slate-300">
            Найдено:{' '}
            <span className="font-bold text-cyan-400">{filteredInstruments.length}</span>
          </p>
        </div>

        {/* Кнопки */}
        <div className="flex gap-3">
          <button
            onClick={handleApply}
            disabled={conditions.length === 0}
            className="flex-1 py-2.5 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 disabled:!bg-slate-700/50 disabled:!text-slate-400 disabled:cursor-not-allowed transition-colors"
          >
            Применить
          </button>
          <button
            onClick={() => setShowSaveDialog(true)}
            disabled={conditions.length === 0}
            className="flex-1 py-2.5 bg-slate-700 text-slate-300 rounded-lg font-medium hover:bg-slate-600 disabled:!bg-slate-700/50 disabled:!text-slate-400 disabled:cursor-not-allowed transition-colors"
          >
            Сохранить
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-700 text-slate-300 rounded-lg font-medium hover:bg-slate-600 disabled:!bg-slate-700/50 disabled:!text-slate-400 disabled:cursor-not-allowed transition-colors"
          >
            Отмена
          </button>
        </div>

        {/* Диалог сохранения */}
        {showSaveDialog && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
            <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-bold mb-4">Сохранить фильтр</h3>
              <input
                type="text"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="Название"
                className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleSaveFilter}
                  disabled={!filterName}
                  className="flex-1 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50"
                >
                  Сохранить
                </button>
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
