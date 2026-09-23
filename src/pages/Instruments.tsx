import { useState, useEffect, useMemo, useCallback } from 'react';
import { store } from '../store';
import { MeasuringInstrument, Role, InstrumentCategory, Warehouse } from '../types';
import { formatDate, hasPermission, isVerificationExpired, isVerificationDueSoon } from '../utils/domain';
import { playSuccess, playError } from '../utils/audio';
import { useNotification } from '../contexts/NotificationContext';
import { Search, Plus, CheckCircle, X, Package, Filter, Settings, Clock, Database, Loader2, AlertCircle, Download, WifiOff } from 'lucide-react';
import InstrumentCard from '../components/InstrumentCard';
import InstrumentDetailModal from '../components/InstrumentDetailModal';
import FilterBuilder from '../components/FilterBuilder';
import CategoryBuilder from '../components/CategoryBuilder';
import ConfirmDialog from '../components/ConfirmDialog';
import ReturnFromVerificationModal from '../components/ReturnFromVerificationModal';
import Wizard from '../components/InstrumentWizard/Wizard';
import { useGosreestrSearch } from '../hooks/useGosreestrSearch';
import { fetchCardWithCache, mapToInstrument, downloadAttachment, isGosreestrAccessEnabled } from '../services/gosreestrService';
import { sendToVerification, getActiveSendoff, getOverdueSendoffs, getSendoffsForInstrument } from '../services/verificationFlowService';

interface InstrumentsProps { theme: 'dark' | 'light'; userId: string | null; userRole: Role; initialFilter?: string; onNavigate?: (page: string, filter?: string, instrumentId?: string, comment?: string, sendoffId?: string) => void; }

export default function Instruments({ theme, userId, userRole, initialFilter, onNavigate }: InstrumentsProps) {
  const [instruments, setInstruments] = useState(store.getInstruments());
  const [categories, setCategories] = useState(store.getCategories());
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | undefined>(initialFilter);
  const [editItem, setEditItem] = useState<MeasuringInstrument | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [cardInstrument, setCardInstrument] = useState<MeasuringInstrument | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<MeasuringInstrument | null>(null);
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [customFilteredInstruments, setCustomFilteredInstruments] = useState<MeasuringInstrument[] | null>(null);
  const [showCategoryBuilder, setShowCategoryBuilder] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ type: 'delete' | 'issue' | 'return'; instrument: MeasuringInstrument } | null>(null);
  const [showReturnModal, setShowReturnModal] = useState<MeasuringInstrument | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const warehouses = useMemo(() => store.getWarehouses(), []);
  const notification = useNotification();
  
  // Gosreestr fields (unused by wizard but kept for compatibility)
  const { hints: gosHints } = useGosreestrSearch('');
  const [gosreestrAccessEnabled, setGosreestrAccessEnabled] = useState(true);
  const [editingPhotoDataUrl, setEditingPhotoDataUrl] = useState('');

  useEffect(() => {
    isGosreestrAccessEnabled().then(enabled => {
      setGosreestrAccessEnabled(enabled);
    });
  }, []);

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

  // ── Actions ──────────────────────────────────────

  const openWizard = useCallback(() => {
    setEditItem(null);
    setShowWizard(true);
  }, []);

  const handleWizardCreate = useCallback((inst: Omit<MeasuringInstrument, 'id'>) => {
    store.addInstrument(inst);
    playSuccess();
    refresh();
    setShowWizard(false);
  }, [refresh]);

  const openEdit = useCallback((item: MeasuringInstrument) => {
    setEditItem(item);
    setEditingPhotoDataUrl(item.photo || '');
    setShowEditForm(true);
  }, []);

  // Edit form state
  const [editInv, setEditInv] = useState('');
  const [editName, setEditName] = useState('');
  const [editCat, setEditCat] = useState('');
  const [editType, setEditType] = useState('');
  const [editSerial, setEditSerial] = useState('');
  const [editMfr, setEditMfr] = useState('');
  const [editRange, setEditRange] = useState('');
  const [editAccuracy, setEditAccuracy] = useState('');
  const [editStatus, setStatus] = useState<MeasuringInstrument['status']>('available');
  const [editLastVerif, setEditLastVerif] = useState('');
  const [editInterval, setEditInterval] = useState(12);
  const [editLocation, setEditLocation] = useState('');
  const [editWarehouseId, setEditWarehouseId] = useState<string | null>(null);
  const [editCustomFields, setEditCustomFields] = useState<Record<string, string | number>>({});
  const [editValidationErrors, setEditValidationErrors] = useState<Record<string, string>>({});

  // Open edit — populate fields
  useEffect(() => {
    if (editItem && showEditForm) {
      setEditInv(editItem.inventoryNumber);
      setEditName(editItem.name);
      setEditCat(editItem.category);
      setEditType(editItem.type);
      setEditSerial(editItem.serialNumber);
      setEditMfr(editItem.manufacturer);
      setEditRange(editItem.range);
      setEditAccuracy(editItem.accuracy);
      setStatus(editItem.status);
      setEditLastVerif(editItem.lastVerificationDate || '');
      setEditInterval(editItem.intervalMonths);
      setEditLocation(editItem.location);
      setEditWarehouseId(editItem.warehouseId);
      setEditCustomFields(editItem.customFields || {});
      setEditValidationErrors({});
      setEditingPhotoDataUrl(editItem.photo || '');
    }
  }, [editItem, showEditForm]);

  const validateEdit = (): boolean => {
    const errors: Record<string, string> = {};
    if (!editInv.trim()) errors.inv = 'Обязателен';
    if (!editName.trim()) errors.name = 'Обязательно';
    if (!editCat) errors.cat = 'Выберите категорию';
    if (!editType.trim()) errors.type = 'Обязательна';
    if (!editSerial.trim()) errors.serial = 'Обязателен';
    if (!editMfr.trim()) errors.mfr = 'Обязателен';
    if (!editRange.trim()) errors.range = 'Обязателен';
    if (!editAccuracy.trim()) errors.acc = 'Обязательна';
    if (!editLastVerif) errors.lastVerif = 'Обязательна';
    setEditValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEditSave = () => {
    if (!validateEdit() || !editItem) return;
    store.updateInstrument(editItem.id, {
      inventoryNumber: editInv,
      name: editName,
      category: editCat,
      type: editType,
      serialNumber: editSerial,
      manufacturer: editMfr,
      range: editRange,
      accuracy: editAccuracy,
      status: editStatus,
      lastVerificationDate: editLastVerif || null,
      intervalMonths: editInterval,
      location: editLocation,
      warehouseId: editWarehouseId,
      customFields: editCustomFields,
    });
    playSuccess();
    refresh();
    setShowEditForm(false);
    setEditValidationErrors({});
  };

  const handleEditPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => setEditingPhotoDataUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // Gosreestr select handler (kept for compat but wizard handles it now)
  const handleGosreestrSelect = useCallback(async (hintId: string) => {
    const { card, fromCache, cacheDate } = await fetchCardWithCache(hintId);
    if (card) {
      if (!card.isActual) {
        const validToStr = card.validTo ? ` (действительно до ${formatDate(card.validTo)})` : '';
        notification.warning('Тип СИ не действует', `Данные из Госреестра, но тип не является действующим${validToStr}`);
      } else {
        notification.success('Данные из Госреестра', `${card.name}`);
      }
      playSuccess();
    } else {
      notification.error('Не найдено в Госреестре', 'Заполните поля вручную');
    }
  }, [notification]);

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

  // ── Render ───────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-sm text-slate-400">{filtered.length} из {instruments.length} записей</p>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={openWizard} className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600"><Plus size={16} />Добавить СИ</button>
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
            <thead className={isDark ? 'bg-slate-800' : 'bg-slate-50'}><tr><th className="text-left px-4 py-3 font-medium">Инв. №</th><th className="text-left px-4 py-3 font-medium">Наименование</th><th className="text-left px-4 py-3 font-medium hidden md:table-cell">Тип</th><th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Склад</th><th className="text-left px-4 py-3 font-medium hidden lg:table-cell">След. поверка</th><th className="text-left px-4 py-3 font-medium">Статус</th><th className="text-left px-4 py-3 font-medium">Действия</th></tr></thead>
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
                    <td className="px-4 py-3">
                      {item.status === 'verification' && (
                        <button onClick={(e) => { e.stopPropagation(); setShowReturnModal(item); }} className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600">Вернулся с поверки</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="p-8 text-center text-slate-400">Ничего не найдено</div>}
      </div>

      {/* ═══════ Wizard modal (add only) ═══════ */}
      {showWizard && (
        <Wizard
          instruments={instruments}
          categories={categories}
          warehouses={warehouses}
          gosreestrAccessEnabled={gosreestrAccessEnabled}
          onOpenCategoryBuilder={() => setShowCategoryBuilder(true)}
          onCreateInstrument={handleWizardCreate}
          onClose={() => setShowWizard(false)}
        />
      )}

      {/* ═══════ Edit form (legacy, for edit only) ═══════ */}
      {showEditForm && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className={`w-full max-w-2xl rounded-xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Редактировать СИ</h2>
              <button onClick={() => setShowEditForm(false)} className="p-1 rounded-lg hover:bg-slate-700/30"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Инв. номер</label>
                <input value={editInv} onChange={e => setEditInv(e.target.value)} className={`${inputClass} ${editValidationErrors.inv ? 'border-red-500' : ''}`} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Наименование</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className={`${inputClass} ${editValidationErrors.name ? 'border-red-500' : ''}`} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Категория</label>
                <select value={editCat} onChange={e => setEditCat(e.target.value)} className={inputClass}><option value="">Выберите</option>{categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}</select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Модель</label>
                <input value={editType} onChange={e => setEditType(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Серийный №</label>
                <input value={editSerial} onChange={e => setEditSerial(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Производитель</label>
                <input value={editMfr} onChange={e => setEditMfr(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Диапазон</label>
                <input value={editRange} onChange={e => setEditRange(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Точность</label>
                <input value={editAccuracy} onChange={e => setEditAccuracy(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Статус</label>
                <select value={editStatus} onChange={e => setStatus(e.target.value as MeasuringInstrument['status'])} className={inputClass}>
                  <option value="available">Доступно</option><option value="issued">Выдано</option><option value="verification">На поверке</option><option value="repair">Ремонт</option><option value="decommissioned">Списано</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Дата поверки</label>
                <input type="date" value={editLastVerif} onChange={e => setEditLastVerif(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Интервал (мес.)</label>
                <input type="number" min={1} max={120} value={editInterval} onChange={e => setEditInterval(parseInt(e.target.value) || 12)} className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Склад</label>
                <select value={editWarehouseId || ''} onChange={e => setEditWarehouseId(e.target.value || null)} className={inputClass}>
                  <option value="">— Не указан —</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Местоположение</label>
                <input value={editLocation} onChange={e => setEditLocation(e.target.value)} className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Фото</label>
                <input type="file" accept="image/*" onChange={handleEditPhotoUpload} className={inputClass} />
                {editingPhotoDataUrl && <img src={editingPhotoDataUrl} alt="Preview" className="w-20 h-20 object-cover rounded-lg mt-2" />}
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
              <button onClick={handleEditSave} className="flex-1 py-2.5 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600">Сохранить</button>
              <button onClick={() => setShowEditForm(false)} className="flex-1 py-2.5 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {cardInstrument && <InstrumentCard instrument={cardInstrument} onClose={() => setCardInstrument(null)} />}
      {showFilterBuilder && <FilterBuilder instruments={instruments} onApplyFilter={(f) => setCustomFilteredInstruments(f)} onClose={() => setShowFilterBuilder(false)} />}
      {showCategoryBuilder && <CategoryBuilder onClose={() => { setShowCategoryBuilder(false); refresh(); }} />}
      {selectedInstrument && <InstrumentDetailModal instrument={selectedInstrument} onClose={() => setSelectedInstrument(null)} onEdit={(i) => { setSelectedInstrument(null); openEdit(i); }} onDelete={(i) => setConfirmDialog({ type: 'delete', instrument: i })} onIssue={(i) => setConfirmDialog({ type: 'issue', instrument: i })} onReturn={(i) => setConfirmDialog({ type: 'return', instrument: i })} onCreateCard={(i) => { setSelectedInstrument(null); setCardInstrument(i); }} onViewSimilar={(i) => setSelectedInstrument(i)} />}
      {confirmDialog && <ConfirmDialog type={confirmDialog.type} instrument={confirmDialog.instrument} onConfirm={() => { const inst = confirmDialog.instrument; if (confirmDialog.type === 'delete') { store.deleteInstrument(inst.id); store.addOperation({ userId: userId || '', action: 'delete', entityType: 'instrument', entityId: inst.id, details: `Удаление СИ ${inst.inventoryNumber}` }); playSuccess(); refresh(); setSelectedInstrument(null); } else if (confirmDialog.type === 'issue' || confirmDialog.type === 'return') { setSelectedInstrument(null); onNavigate?.('issue-return', undefined, inst.id); } setConfirmDialog(null); }} onCancel={() => setConfirmDialog(null)} />}
      
      {showReturnModal && (
        <ReturnFromVerificationModal
          instrument={showReturnModal}
          userId={userId}
          isDark={isDark}
          onClose={() => setShowReturnModal(null)}
          onSuccess={() => { refresh(); setShowReturnModal(null); }}
        />
      )}
    </div>
  );
}
