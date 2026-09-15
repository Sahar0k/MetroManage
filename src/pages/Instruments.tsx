import { useState, useEffect, useMemo, useCallback } from 'react';
import { store } from '../store';
import { MeasuringInstrument, Role } from '../types';
import { formatDate, hasPermission, isVerificationExpired, isVerificationDueSoon } from '../utils/domain';
import { playSuccess, playError } from '../utils/audio';
import { useNotification } from '../contexts/NotificationContext';
import { Search, Plus, CheckCircle, X, Package, Filter, Settings, Clock, Database, Loader2, AlertCircle, Download, WifiOff } from 'lucide-react';
import InstrumentCard from '../components/InstrumentCard';
import InstrumentDetailModal from '../components/InstrumentDetailModal';
import FilterBuilder from '../components/FilterBuilder';
import CategoryBuilder from '../components/CategoryBuilder';
import ConfirmDialog from '../components/ConfirmDialog';
import { useGosreestrSearch } from '../hooks/useGosreestrSearch';
import { fetchCardWithCache, mapToInstrument, downloadAttachment, isGosreestrAccessEnabled } from '../services/gosreestrService';
import { sendToVerification, getActiveSendoff, getOverdueSendoffs, getSendoffsForInstrument } from '../services/verificationFlowService';

interface InstrumentsProps { theme: 'dark' | 'light'; userId: string | null; userRole: Role; initialFilter?: string; onNavigate?: (page: string, filter?: string, instrumentId?: string, comment?: string, sendoffId?: string) => void; }

export default function Instruments({ theme, userId, userRole, initialFilter, onNavigate }: InstrumentsProps) {
  const [instruments, setInstruments] = useState(store.getInstruments());
  const [categories, setCategories] = useState(store.getCategories());
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | undefined>(initialFilter);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<MeasuringInstrument | null>(null);
  const [cardInstrument, setCardInstrument] = useState<MeasuringInstrument | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<MeasuringInstrument | null>(null);
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [customFilteredInstruments, setCustomFilteredInstruments] = useState<MeasuringInstrument[] | null>(null);
  const [showCategoryBuilder, setShowCategoryBuilder] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ type: 'delete' | 'issue' | 'return'; instrument: MeasuringInstrument } | null>(null);
  const warehouses = useMemo(() => store.getWarehouses(), []);
  const [formData, setFormData] = useState({ inventoryNumber: '', name: '', category: '', type: '', serialNumber: '', manufacturer: '', range: '', accuracy: '', status: 'available' as MeasuringInstrument['status'], lastVerificationDate: '', intervalMonths: 12, location: '', warehouseId: warehouses[0]?.id || null, photo: '', customFields: {} as Record<string, string | number> });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const notification = useNotification();
  
  // Госреестр СИ
  const [gosreestrQuery, setGosreestrQuery] = useState('');
  const [showGosreestrHints, setShowGosreestrHints] = useState(false);
  const [gosreestrStatus, setGosreestrStatus] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'invalid' | 'isolated'>('idle');
  const [selectedGosreestrId, setSelectedGosreestrId] = useState<string | null>(null);
  const [descriptionLink, setDescriptionLink] = useState<string | null>(null);
  const [methodLink, setMethodLink] = useState<string | null>(null);
  const [gosreestrAccessEnabled, setGosreestrAccessEnabled] = useState(true);
  const { hints, loading: gosreestrLoading } = useGosreestrSearch(gosreestrQuery);

  // Проверка настройки доступа к Госреестру
  useEffect(() => {
    isGosreestrAccessEnabled().then(enabled => {
      setGosreestrAccessEnabled(enabled);
      if (!enabled) {
        setGosreestrStatus('isolated');
      }
    });
  }, [showForm]);

  useEffect(() => { setActiveFilter(initialFilter); }, [initialFilter]);
  const isDark = theme === 'dark';
  const canEdit = hasPermission(userRole, 'edit_instruments');

  const filtered = useMemo(() => {
    const baseInstruments = customFilteredInstruments || instruments;
    const categoryFiltered = baseInstruments.filter(i => {
      if (!activeFilter) return true;
      if (activeFilter === 'available') return i.status === 'available';
      if (activeFilter === 'issued') return i.status === 'issued';
      if (activeFilter === 'repair') return i.status === 'repair';
      if (activeFilter === 'decommissioned') return i.status === 'decommissioned';
      if (activeFilter === 'verification') return i.status === 'verification';
      if (activeFilter === 'expired') return isVerificationExpired(i);
      if (activeFilter === 'due_soon') return isVerificationDueSoon(i);
      return true;
    });
    const searchLower = search.toLowerCase();
    return categoryFiltered.filter(i => i.name.toLowerCase().includes(searchLower) || i.inventoryNumber.toLowerCase().includes(searchLower) || i.serialNumber.toLowerCase().includes(searchLower) || i.type.toLowerCase().includes(searchLower));
  }, [instruments, customFilteredInstruments, activeFilter, search]);

  const refresh = useCallback(() => { setInstruments(store.getInstruments()); setCategories(store.getCategories()); }, []);

  const openAdd = useCallback(() => {
    setEditItem(null);
    setFormData({ inventoryNumber: `СИ-${String(instruments.length + 1).padStart(4, '0')}`, name: '', category: '', type: '', serialNumber: '', manufacturer: '', range: '', accuracy: '', status: 'available', lastVerificationDate: new Date().toISOString().split('T')[0], intervalMonths: 12, location: 'Кладовая СИ', warehouseId: warehouses[0]?.id || null, photo: '', customFields: {} });
    setValidationErrors({}); 
    setGosreestrQuery('');
    setGosreestrStatus('idle');
    setSelectedGosreestrId(null);
    setDescriptionLink(null);
    setMethodLink(null);
    setShowForm(true);
  }, [instruments.length, warehouses]);

  const openEdit = useCallback((item: MeasuringInstrument) => {
    setEditItem(item);
    setFormData({ inventoryNumber: item.inventoryNumber, name: item.name, category: item.category, type: item.type, serialNumber: item.serialNumber, manufacturer: item.manufacturer, range: item.range, accuracy: item.accuracy, status: item.status, lastVerificationDate: item.lastVerificationDate || '', intervalMonths: item.intervalMonths, location: item.location, warehouseId: item.warehouseId, photo: item.photo || '', customFields: item.customFields || {} });
    setValidationErrors({}); setShowForm(true);
  }, []);

  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!formData.inventoryNumber.trim()) errors.inventoryNumber = 'Обязателен';
    if (!formData.name.trim()) errors.name = 'Обязательно';
    if (!formData.category) errors.category = 'Выберите категорию';
    if (!formData.type.trim()) errors.type = 'Обязательна';
    if (!formData.serialNumber.trim()) errors.serialNumber = 'Обязателен';
    if (!formData.manufacturer.trim()) errors.manufacturer = 'Обязателен';
    if (!formData.range.trim()) errors.range = 'Обязателен';
    if (!formData.accuracy.trim()) errors.accuracy = 'Обязательна';
    if (!formData.lastVerificationDate) errors.lastVerificationDate = 'Обязательна';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSave = useCallback(() => {
    if (!validateForm()) { playError(); return; }
    if (editItem) { store.updateInstrument(editItem.id, { ...formData, lastVerificationDate: formData.lastVerificationDate || null, warehouseId: formData.warehouseId || null, photo: formData.photo || undefined, customFields: formData.customFields }); }
    else { store.addInstrument({ ...formData, lastVerificationDate: formData.lastVerificationDate || null, warehouseId: formData.warehouseId || null, photo: formData.photo || undefined, customFields: formData.customFields }); }
    playSuccess(); refresh(); setShowForm(false); setValidationErrors({});
  }, [formData, editItem, refresh, validateForm]);

  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith('image/')) { playError(); return; }
    const reader = new FileReader();
    reader.onload = (event) => { setFormData(prev => ({ ...prev, photo: event.target?.result as string })); };
    reader.readAsDataURL(file);
  }, []);

  // Обработчик выбора подсказки из Госреестра
  const handleGosreestrSelect = useCallback(async (hintId: string) => {
    setGosreestrStatus('loading');
    setShowGosreestrHints(false);
    setSelectedGosreestrId(hintId);
    
    const { card, fromCache, cacheDate } = await fetchCardWithCache(hintId);
    
    if (card) {
      if (card.status !== 'Действует') {
        setGosreestrStatus('invalid');
        notification.warning('Тип СИ не действует', 'Данные из Госреестра, но тип не является действующим');
      } else {
        setGosreestrStatus('found');
      }
      
      // Автозаполнение полей
      const mapped = mapToInstrument(card);
      setFormData(prev => ({
        ...prev,
        name: mapped.name || prev.name,
        type: mapped.type || prev.type,
        manufacturer: mapped.manufacturer || prev.manufacturer,
        intervalMonths: mapped.intervalMonths || prev.intervalMonths,
      }));
      
      setDescriptionLink(card.descriptionLink || null);
      setMethodLink(card.methodLink || null);
      
      playSuccess();
      if (fromCache) {
        const dateStr = cacheDate ? new Date(cacheDate).toLocaleDateString('ru-RU') : '';
        notification.info('Данные из кэша', `Заполнены поля для ${card.name} (кэш от ${dateStr})`);
      } else {
        notification.success('Данные из Госреестра', `Заполнены поля для ${card.name}`);
      }
    } else {
      setGosreestrStatus('not_found');
      notification.error('Не найдено в Госреестре', 'Заполните поля вручную');
    }
  }, [notification]);

  // Скачивание вложения
  const handleDownloadAttachment = useCallback(async (link: string, filename: string) => {
    const blob = await downloadAttachment(link);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      notification.error('Ошибка скачивания', 'Не удалось скачать файл');
    }
  }, [notification]);

  const getStatusBadge = (item: MeasuringInstrument) => {
    if (item.status === 'decommissioned') return <span className="px-2 py-0.5 rounded-full text-xs bg-slate-500/20 text-slate-400">Списано</span>;
    if (item.status === 'repair') return <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400">Ремонт</span>;
    if (item.status === 'verification') return <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-400 flex items-center gap-1"><Clock size={10} /> На поверке</span>;
    if (item.status === 'issued') return <span className="px-2 py-0.5 rounded-full text-xs bg-cyan-500/20 text-cyan-400">Выдано</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400 flex items-center gap-1"><CheckCircle size={10} /> Доступно</span>;
  };

  const inputClass = `w-full px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'} border focus:outline-none focus:ring-2 focus:ring-cyan-500`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-sm text-slate-400">{filtered.length} из {instruments.length} записей</p>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600"><Plus size={16} />Добавить СИ</button>
            <button onClick={() => setShowCategoryBuilder(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600"><Settings size={16} />Категории</button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {[{ id: 'all', label: 'Все', count: instruments.length }, { id: 'available', label: 'Доступные', count: instruments.filter(i => i.status === 'available').length }, { id: 'issued', label: 'Выданные', count: instruments.filter(i => i.status === 'issued').length }, { id: 'verification', label: 'На поверке', count: instruments.filter(i => i.status === 'verification').length }, { id: 'repair', label: 'Ремонт', count: instruments.filter(i => i.status === 'repair').length }, { id: 'expired', label: 'Просрочено', count: instruments.filter(i => isVerificationExpired(i)).length }, { id: 'due_soon', label: 'Скоро поверка', count: instruments.filter(i => isVerificationDueSoon(i)).length }].map(filter => (
          <button key={filter.id} onClick={() => setActiveFilter(filter.id === 'all' ? undefined : filter.id)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${(activeFilter || 'all') === filter.id ? 'bg-cyan-500 text-white' : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{filter.label} ({filter.count})</button>
        ))}
        <button onClick={() => setShowFilterBuilder(true)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${customFilteredInstruments ? 'bg-purple-500 text-white' : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><Filter size={16} />Фильтры</button>
        {customFilteredInstruments && <button onClick={() => setCustomFilteredInstruments(null)} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30">Сбросить фильтр</button>}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} className={`w-full pl-10 pr-4 py-2.5 rounded-lg text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'} border focus:outline-none focus:ring-2 focus:ring-cyan-500`} />
      </div>

      <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className={isDark ? 'bg-slate-800' : 'bg-slate-50'}><tr><th className="text-left px-4 py-3 font-medium">Инв. №</th><th className="text-left px-4 py-3 font-medium">Наименование</th><th className="text-left px-4 py-3 font-medium hidden md:table-cell">Тип</th><th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Склад</th><th className="text-left px-4 py-3 font-medium hidden lg:table-cell">След. поверка</th><th className="text-left px-4 py-3 font-medium">Статус</th></tr></thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-100'}`}>
              {filtered.map(item => {
                const activeSendoff = getActiveSendoff(item.id);
                const isOverdue = activeSendoff && activeSendoff.expectedReturnDate && new Date(activeSendoff.expectedReturnDate) < new Date();
                return (
                  <tr key={item.id} onClick={() => setSelectedInstrument(item)} className={`${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'} transition-colors cursor-pointer ${isOverdue ? 'bg-amber-500/10' : ''}`}>
                    <td className="px-4 py-3 font-mono text-cyan-500">{item.inventoryNumber}</td>
                    <td className="px-4 py-3"><div className="font-medium">{item.name}</div><div className="text-xs text-slate-400">{item.range} | {item.accuracy}</div></td>
                    <td className="px-4 py-3 hidden md:table-cell">{item.type}</td>
                    <td className="px-4 py-3 hidden lg:table-cell"><span className="text-xs flex items-center gap-1 text-purple-400"><Package size={12} />{warehouses.find(w => w.id === item.warehouseId)?.name || '—'}</span></td>
                    <td className="px-4 py-3 hidden lg:table-cell">{formatDate(item.nextVerificationDate)}</td>
                    <td className="px-4 py-3">{getStatusBadge(item)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="p-8 text-center text-slate-400">Ничего не найдено</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className={`w-full max-w-6xl rounded-xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold">{editItem ? 'Редактировать СИ' : 'Новое средство измерения'}</h2><button onClick={() => { setShowForm(false); setValidationErrors({}); }} className="p-1 rounded-lg hover:bg-slate-700/30"><X size={20} /></button></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <label className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                  <Database size={12} />
                  Поиск в Госреестре СИ (номер или наименование)
                </label>
                <div className="relative">
                  <input 
                    value={gosreestrQuery} 
                    onChange={e => { setGosreestrQuery(e.target.value); setShowGosreestrHints(true); setGosreestrStatus('idle'); }}
                    onFocus={() => setShowGosreestrHints(true)}
                    placeholder="Например: 52797-13 или Р2М-18А"
                    className={`${inputClass} text-base pr-10`}
                  />
                  {gosreestrLoading && (
                    <Loader2 size={18} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-cyan-400" />
                  )}
                  
                  {/* Статус бейдж */}
                  {gosreestrStatus === 'found' && (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
                      <CheckCircle size={16} />
                      Данные из Госреестра
                    </div>
                  )}
                  {gosreestrStatus === 'invalid' && (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm flex items-center gap-2">
                      <AlertCircle size={16} />
                      Тип не действует
                    </div>
                  )}
                  {gosreestrStatus === 'not_found' && (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-slate-500/10 border border-slate-500/30 text-slate-400 text-sm">
                      Не найдено в Госреестре — заполните вручную
                    </div>
                  )}
                  {gosreestrStatus === 'isolated' && (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm flex items-center gap-2">
                      <WifiOff size={16} />
                      Изолированный контур — автозаполнение отключено
                    </div>
                  )}
                  
                  {/* Выпадающий список подсказок */}
                  {showGosreestrHints && hints.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                      {hints.map(hint => (
                        <button
                          key={hint.id}
                          onClick={() => handleGosreestrSelect(hint.id)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-700 border-b border-slate-700 last:border-b-0 transition-colors"
                        >
                          <div className="text-base font-medium text-white">{hint.designation}</div>
                          <div className="text-sm text-slate-400">{hint.number} | {hint.manufacturer}</div>
                          <div className="text-xs text-slate-500 truncate">{hint.name}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Кнопки скачивания вложений */}
                {(descriptionLink || methodLink) && (
                  <div className="flex gap-2 mt-2">
                    {descriptionLink && (
                      <button
                        onClick={() => handleDownloadAttachment(descriptionLink, `Описание_типа_${formData.type || 'СИ'}.pdf`)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30"
                      >
                        <Download size={14} />
                        Описание типа
                      </button>
                    )}
                    {methodLink && (
                      <button
                        onClick={() => handleDownloadAttachment(methodLink, `Методика_поверки_${formData.type || 'СИ'}.pdf`)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-sm hover:bg-purple-500/30"
                      >
                        <Download size={14} />
                        Методика поверки
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              <div><label className="text-xs text-slate-400 mb-1 block">Инв. номер</label><input value={formData.inventoryNumber} onChange={e => setFormData({...formData, inventoryNumber: e.target.value})} className={`${inputClass} ${validationErrors.inventoryNumber ? 'border-red-500' : ''}`} /></div>
              <div className="md:col-span-2"><label className="text-xs text-slate-400 mb-1 block">Наименование</label><input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={`${inputClass} ${validationErrors.name ? 'border-red-500' : ''}`} /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Категория</label><select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value, customFields: {}})} className={inputClass}><option value="">Выберите</option>{categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}</select></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Модель</label><input value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className={inputClass} /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Серийный №</label><input value={formData.serialNumber} onChange={e => setFormData({...formData, serialNumber: e.target.value})} className={inputClass} /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Производитель</label><input value={formData.manufacturer} onChange={e => setFormData({...formData, manufacturer: e.target.value})} className={inputClass} /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Диапазон</label><input value={formData.range} onChange={e => setFormData({...formData, range: e.target.value})} className={inputClass} /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Точность</label><input value={formData.accuracy} onChange={e => setFormData({...formData, accuracy: e.target.value})} className={inputClass} /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Статус</label><select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className={inputClass}><option value="available">Доступно</option><option value="issued">Выдано</option><option value="verification">На поверке</option><option value="repair">Ремонт</option><option value="decommissioned">Списано</option></select></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Дата поверки</label><input type="date" value={formData.lastVerificationDate} onChange={e => setFormData({...formData, lastVerificationDate: e.target.value})} className={inputClass} /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Интервал (мес.)</label><input type="number" min={1} max={120} value={formData.intervalMonths} onChange={e => setFormData({...formData, intervalMonths: parseInt(e.target.value) || 12})} className={inputClass} /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Склад</label><select value={formData.warehouseId || ''} onChange={e => setFormData({...formData, warehouseId: e.target.value || null})} className={inputClass}><option value="">— Не указан —</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
              <div className="md:col-span-2"><label className="text-xs text-slate-400 mb-1 block">Местоположение</label><input value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className={inputClass} /></div>
              <div className="md:col-span-3"><label className="text-xs text-slate-400 mb-1 block">Фото</label><input type="file" accept="image/*" onChange={handlePhotoUpload} className={`${inputClass}`} />{formData.photo && <img src={formData.photo} alt="Preview" className="w-20 h-20 object-cover rounded-lg mt-2" />}</div>
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
              <button onClick={handleSave} className="flex-1 py-2.5 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600">{editItem ? 'Сохранить' : 'Создать'}</button>
              <button onClick={() => { setShowForm(false); setValidationErrors({}); }} className="flex-1 py-2.5 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {cardInstrument && <InstrumentCard instrument={cardInstrument} onClose={() => setCardInstrument(null)} />}
      {showFilterBuilder && <FilterBuilder instruments={instruments} onApplyFilter={(filtered) => setCustomFilteredInstruments(filtered)} onClose={() => setShowFilterBuilder(false)} />}
      {showCategoryBuilder && <CategoryBuilder onClose={() => { setShowCategoryBuilder(false); refresh(); }} />}
      {selectedInstrument && <InstrumentDetailModal instrument={selectedInstrument} onClose={() => setSelectedInstrument(null)} onEdit={(instrument) => { setSelectedInstrument(null); openEdit(instrument); }} onDelete={(instrument) => setConfirmDialog({ type: 'delete', instrument })} onIssue={(instrument) => setConfirmDialog({ type: 'issue', instrument })} onReturn={(instrument) => setConfirmDialog({ type: 'return', instrument })} onCreateCard={(instrument) => { setSelectedInstrument(null); setCardInstrument(instrument); }} onViewSimilar={(instrument) => setSelectedInstrument(instrument)} />}
      {confirmDialog && <ConfirmDialog type={confirmDialog.type} instrument={confirmDialog.instrument} onConfirm={() => { const instrument = confirmDialog.instrument; if (confirmDialog.type === 'delete') { store.deleteInstrument(instrument.id); store.addOperation({ userId: userId || '', action: 'delete', entityType: 'instrument', entityId: instrument.id, details: `Удаление СИ ${instrument.inventoryNumber}` }); playSuccess(); refresh(); setSelectedInstrument(null); } else if (confirmDialog.type === 'issue' || confirmDialog.type === 'return') { setSelectedInstrument(null); onNavigate?.('issue-return', undefined, instrument.id); } setConfirmDialog(null); }} onCancel={() => setConfirmDialog(null)} />}
    </div>
  );
}
