import { useState, useMemo, useCallback } from 'react';
import { MeasuringInstrument, FilterCondition, SavedFilter } from '../types';
import { getFieldsForCategory, applyFilters, saveFilter, getSavedFilters, deleteFilter, getAllCategories } from '../utils/customFields';
import { useNotification } from '../contexts/NotificationContext';
import { Filter, Save, Trash2, X, Plus } from 'lucide-react';

interface FilterBuilderProps { instruments: MeasuringInstrument[]; onApplyFilter: (filtered: MeasuringInstrument[]) => void; onClose: () => void; }

export default function FilterBuilder({ instruments, onApplyFilter, onClose }: FilterBuilderProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [filterName, setFilterName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(getSavedFilters());
  const notification = useNotification();
  const categories = useMemo(() => getAllCategories(), []);
  const availableFields = useMemo(() => selectedCategory ? getFieldsForCategory(selectedCategory) : [], [selectedCategory]);

  const filteredInstruments = useMemo(() => {
    let result = instruments;
    if (selectedCategory) result = result.filter(i => i.category === selectedCategory);
    if (conditions.length > 0) result = applyFilters(result, conditions, availableFields);
    return result;
  }, [instruments, selectedCategory, conditions, availableFields]);

  const handleAddCondition = useCallback(() => { if (availableFields.length === 0) return; setConditions([...conditions, { fieldId: availableFields[0].id, operator: 'equals', value: '' }]); }, [availableFields, conditions]);
  const handleUpdateCondition = useCallback((index: number, updates: Partial<FilterCondition>) => { const newConditions = [...conditions]; newConditions[index] = { ...newConditions[index], ...updates }; setConditions(newConditions); }, [conditions]);
  const handleRemoveCondition = useCallback((index: number) => { setConditions(conditions.filter((_, i) => i !== index)); }, [conditions]);
  const handleSaveFilter = useCallback(() => { if (!filterName || !selectedCategory) return; saveFilter({ name: filterName, category: selectedCategory, conditions }); setSavedFilters(getSavedFilters()); setShowSaveDialog(false); setFilterName(''); }, [filterName, selectedCategory, conditions]);
  const handleLoadFilter = useCallback((filter: SavedFilter) => { setSelectedCategory(filter.category); setConditions(filter.conditions); }, []);
  const handleDeleteFilter = useCallback((filterId: string) => { deleteFilter(filterId); setSavedFilters(getSavedFilters()); }, []);

  const handleApply = () => { onApplyFilter(filteredInstruments); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-800 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><Filter size={24} className="text-cyan-400" />Конструктор фильтров</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700"><X size={20} /></button>
        </div>
        {savedFilters.length > 0 && (
          <div className="mb-6"><h3 className="text-sm font-semibold text-slate-300 mb-2">Сохранённые фильтры</h3>
            <div className="flex flex-wrap gap-2">{savedFilters.map(filter => (<div key={filter.id} className="flex items-center gap-2 bg-slate-700 rounded-lg px-3 py-2"><button onClick={() => handleLoadFilter(filter)} className="text-sm text-cyan-400 hover:text-cyan-300">{filter.name}</button><button onClick={() => handleDeleteFilter(filter.id)} className="text-slate-400 hover:text-red-400"><Trash2 size={14} /></button></div>))}</div>
          </div>
        )}
        <div className="mb-6"><label className="block text-sm font-medium text-slate-300 mb-2">Категория</label>
          <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setConditions([]); }} className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"><option value="">Все категории</option>{categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select>
        </div>
        {availableFields.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-slate-300">Условия</h3><button onClick={handleAddCondition} className="flex items-center gap-1 px-3 py-1.5 bg-cyan-500 text-white rounded-lg text-sm hover:bg-cyan-600"><Plus size={14} />Добавить</button></div>
            <div className="space-y-3">{conditions.map((condition, index) => (
              <div key={index} className="flex items-center gap-3 bg-slate-700/50 rounded-lg p-3">
                <select value={condition.fieldId} onChange={(e) => handleUpdateCondition(index, { fieldId: e.target.value })} className="flex-1 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white text-sm">{availableFields.map(field => <option key={field.id} value={field.id}>{field.name}{field.unit ? ` (${field.unit})` : ''}</option>)}</select>
                <select value={condition.operator} onChange={(e) => handleUpdateCondition(index, { operator: e.target.value as FilterCondition['operator'] })} className="px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white text-sm"><option value="equals">=</option><option value="contains">содержит</option><option value="greater">&gt;</option><option value="less">&lt;</option><option value="between">между</option></select>
                <input type="number" value={condition.value as number} onChange={(e) => handleUpdateCondition(index, { value: Number(e.target.value) })} className="w-32 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white text-sm" />
                <button onClick={() => handleRemoveCondition(index)} className="p-1 text-slate-400 hover:text-red-400"><Trash2 size={16} /></button>
              </div>
            ))}</div>
          </div>
        )}
        <div className="mb-6 bg-slate-700/30 rounded-lg p-4"><p className="text-sm text-slate-300">Найдено: <span className="font-bold text-cyan-400">{filteredInstruments.length}</span></p></div>
        <div className="flex gap-3">
          <button onClick={handleApply} className="flex-1 py-2.5 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600">Применить</button>
          <button onClick={() => setShowSaveDialog(true)} disabled={conditions.length === 0} className="flex-1 py-2.5 bg-slate-700 text-slate-300 rounded-lg font-medium hover:bg-slate-600 disabled:opacity-50">Сохранить</button>
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-700 text-slate-300 rounded-lg font-medium hover:bg-slate-600">Отмена</button>
        </div>
        {showSaveDialog && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
            <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-bold mb-4">Сохранить фильтр</h3>
              <input type="text" value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="Название" className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white mb-4" />
              <div className="flex gap-3"><button onClick={handleSaveFilter} disabled={!filterName} className="flex-1 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50">Сохранить</button><button onClick={() => setShowSaveDialog(false)} className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600">Отмена</button></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
