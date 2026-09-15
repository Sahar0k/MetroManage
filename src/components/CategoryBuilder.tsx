import { useState } from 'react';
import { store } from '../store';
import { InstrumentCategory, CustomField } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { X, Plus, Edit2, Trash2, Save, Settings } from 'lucide-react';
import { playSuccess, playError } from '../utils/audio';
import { useNotification } from '../contexts/NotificationContext';

interface CategoryBuilderProps { onClose: () => void; }

export default function CategoryBuilder({ onClose }: CategoryBuilderProps) {
  const [categories, setCategories] = useState(store.getCategories());
  const [editingCategory, setEditingCategory] = useState<InstrumentCategory | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', fields: [] as CustomField[] });
  const notification = useNotification();

  const refresh = () => setCategories(store.getCategories());
  const openAdd = () => { setEditingCategory(null); setFormData({ name: '', description: '', fields: [] }); setShowForm(true); };
  const openEdit = (category: InstrumentCategory) => { setEditingCategory(category); setFormData({ name: category.name, description: category.description || '', fields: category.fields }); setShowForm(true); };
  const handleAddField = () => { setFormData({ ...formData, fields: [...formData.fields, { id: uuidv4(), name: '', type: 'number', unit: '' }] }); };
  const handleUpdateField = (index: number, updates: Partial<CustomField>) => { const newFields = [...formData.fields]; newFields[index] = { ...newFields[index], ...updates }; setFormData({ ...formData, fields: newFields }); };
  const handleRemoveField = (index: number) => { setFormData({ ...formData, fields: formData.fields.filter((_, i) => i !== index) }); };

  const handleSave = () => {
    if (!formData.name.trim()) { playError(); notification.error('Ошибка', 'Введите название категории'); return; }
    if (formData.fields.some(f => !f.name.trim())) { playError(); notification.error('Ошибка', 'Все поля должны иметь название'); return; }
    if (editingCategory) { store.updateCategory(editingCategory.id, { name: formData.name, description: formData.description, fields: formData.fields }); }
    else { store.addCategory({ name: formData.name, description: formData.description, fields: formData.fields }); }
    playSuccess(); refresh(); setShowForm(false);
  };

  const handleDelete = (id: string) => { const result = store.deleteCategory(id); if (!result.success) { playError(); notification.error('Ошибка', result.message); return; } playSuccess(); refresh(); };
  const inputClass = `w-full px-3 py-2 rounded-lg text-sm bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-800 rounded-xl p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><Settings size={24} className="text-cyan-400" />Конструктор категорий</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700"><X size={20} /></button>
        </div>
        {!showForm ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-slate-400">Всего категорий: {categories.length}</p>
              <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600"><Plus size={16} />Создать</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.map(category => (
                <div key={category.id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1"><h3 className="font-semibold text-lg text-cyan-400">{category.name}</h3>{category.description && <p className="text-sm text-slate-400 mt-1">{category.description}</p>}</div>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(category)} className="p-2 rounded-lg hover:bg-slate-600 text-slate-400 hover:text-cyan-400"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(category.id)} className="p-2 rounded-lg hover:bg-slate-600 text-slate-400 hover:text-red-400"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div className="border-t border-slate-600 pt-3">
                    <p className="text-xs text-slate-500 mb-2">Поля ({category.fields.length}):</p>
                    <div className="flex flex-wrap gap-2">{category.fields.map(field => (<span key={field.id} className="px-2 py-1 bg-slate-600 rounded text-xs text-slate-300">{field.name}{field.unit && ` (${field.unit})`}</span>))}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div>
            <h3 className="text-lg font-semibold mb-4">{editingCategory ? 'Редактировать категорию' : 'Новая категория'}</h3>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-300 mb-2">Название *</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputClass} placeholder="Например: Анализатор спектра" /></div>
              <div><label className="block text-sm font-medium text-slate-300 mb-2">Описание</label><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className={`${inputClass} resize-none`} rows={2} /></div>
              <div>
                <div className="flex items-center justify-between mb-2"><label className="block text-sm font-medium text-slate-300">Характеристики</label><button onClick={handleAddField} className="flex items-center gap-1 px-3 py-1.5 bg-cyan-500 text-white rounded-lg text-xs hover:bg-cyan-600"><Plus size={14} />Добавить поле</button></div>
                <div className="space-y-3">
                  {formData.fields.map((field, index) => (
                    <div key={field.id} className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div><label className="block text-xs text-slate-400 mb-1">Название *</label><input type="text" value={field.name} onChange={(e) => handleUpdateField(index, { name: e.target.value })} className={inputClass} /></div>
                            <div><label className="block text-xs text-slate-400 mb-1">Единица</label><input type="text" value={field.unit || ''} onChange={(e) => handleUpdateField(index, { unit: e.target.value })} className={inputClass} /></div>
                          </div>
                          <div><label className="block text-xs text-slate-400 mb-1">Тип</label><select value={field.type} onChange={(e) => handleUpdateField(index, { type: e.target.value as any })} className={inputClass}><option value="number">Число</option><option value="range">Диапазон</option></select></div>
                        </div>
                        <button onClick={() => handleRemoveField(index)} className="p-2 rounded-lg hover:bg-slate-600 text-slate-400 hover:text-red-400"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600"><Save size={16} />{editingCategory ? 'Сохранить' : 'Создать'}</button>
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 bg-slate-700 text-slate-300 rounded-lg font-medium hover:bg-slate-600">Отмена</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
