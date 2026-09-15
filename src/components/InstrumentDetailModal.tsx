import { useMemo, useState } from 'react';
import { store } from '../store';
import { MeasuringInstrument, VerificationProtocol } from '../types';
import { formatDate } from '../utils/domain';
import { X, Edit2, Trash2, FileText, ArrowRightLeft, Package, Calendar, MapPin, CheckCircle2, AlertCircle, Clock, Cpu, Info, FileCheck, History, Wrench as WrenchIcon } from 'lucide-react';
import { InstrumentHistory } from './verification';

interface InstrumentDetailModalProps {
  instrument: MeasuringInstrument;
  onClose: () => void;
  onEdit: (instrument: MeasuringInstrument) => void;
  onDelete: (instrument: MeasuringInstrument) => void;
  onIssue: (instrument: MeasuringInstrument) => void;
  onReturn: (instrument: MeasuringInstrument) => void;
  onCreateCard: (instrument: MeasuringInstrument) => void;
  onViewSimilar?: (instrument: MeasuringInstrument) => void;
  onViewProtocol?: (protocol: VerificationProtocol) => void;
}

type TabId = 'main' | 'metrology' | 'docs' | 'history' | 'maintenance';
const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'main', label: 'Главная инфо', icon: Info },
  { id: 'metrology', label: 'Метрология', icon: FileCheck },
  { id: 'docs', label: 'Документация', icon: FileText },
  { id: 'history', label: 'История', icon: History },
  { id: 'maintenance', label: 'Обслуживание', icon: WrenchIcon },
];

function Logo() {
  return (
    <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyan-500/20">
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M4 18 L4 20 L22 20 L22 18" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"/><path d="M7 20 L7 18 M11 20 L11 17 M15 20 L15 18 M19 20 L19 17" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.6"/><path d="M3 12 C6 6, 9 6, 12 12 C15 18, 18 18, 21 12 C23 8, 24 8, 25 10" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"/><circle cx="21" cy="12" r="1.5" fill="white"/></svg>
    </div>
  );
}

export default function InstrumentDetailModal({ instrument, onClose, onEdit, onDelete, onIssue, onReturn, onCreateCard, onViewSimilar, onViewProtocol }: InstrumentDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('main');
  const warehouses = store.getWarehouses();
  const allInstruments = store.getInstruments();

  if (!instrument) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
        <div className="bg-slate-900 rounded-2xl max-w-md w-full p-8 shadow-2xl border border-slate-800">
          <div className="text-center">
            <h3 className="text-xl font-bold text-white mb-2">Ошибка</h3>
            <p className="text-slate-400 mb-6">Прибор не найден</p>
            <button onClick={onClose} className="px-6 py-2 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600">Закрыть</button>
          </div>
        </div>
      </div>
    );
  }

  const similarInstruments = useMemo(() => allInstruments.filter(i => i.category === instrument.category && i.id !== instrument.id).slice(0, 5), [allInstruments, instrument]);
  const warehouse = warehouses.find(w => w.id === instrument.warehouseId);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'available': return { label: 'В наличии', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400', icon: CheckCircle2 };
      case 'issued': return { label: 'Выдано', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30', dot: 'bg-cyan-400', icon: ArrowRightLeft };
      case 'verification': return { label: 'На поверке', color: 'bg-purple-500/15 text-purple-300 border-purple-500/30', dot: 'bg-purple-400', icon: Clock };
      case 'repair': return { label: 'На обслуживании', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30', dot: 'bg-amber-400', icon: AlertCircle };
      case 'decommissioned': return { label: 'Списано', color: 'bg-slate-500/15 text-slate-300 border-slate-500/30', dot: 'bg-slate-400', icon: X };
      default: return { label: status, color: 'bg-slate-500/15 text-slate-300 border-slate-500/30', dot: 'bg-slate-400', icon: Info };
    }
  };

  const statusConfig = getStatusConfig(instrument.status);
  const StatusIcon = statusConfig.icon;

  const customSpecs = useMemo(() => {
    const category = store.getCategories().find(c => c.name === instrument.category);
    if (!category?.fields) return [];
    return category.fields.map(field => {
      let value = '';
      if (field.type === 'number') {
        const v = instrument.customFields?.[field.id];
        value = v !== undefined ? `${v}${field.unit ? ' ' + field.unit : ''}` : '—';
      }
      return { label: field.name, value };
    });
  }, [instrument]);

  return (
    <div onClick={onClose} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div onClick={(e) => e.stopPropagation()} className="bg-slate-900 rounded-2xl max-w-6xl w-full my-8 shadow-2xl border border-slate-800 overflow-hidden">
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border-b border-slate-800 px-8 py-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-5 min-w-0">
              <Logo />
              <div className="min-w-0 pt-0.5">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">Учёт средств измерений</p>
                <h1 className="text-2xl font-bold text-white truncate">Карточка {instrument.category} {instrument.type}</h1>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  <span className="font-mono">Инв. №{instrument.inventoryNumber}</span>
                  <span className="text-slate-600">•</span>
                  <span>{instrument.manufacturer}</span>
                  <span className="text-slate-600">•</span>
                  <span>S/N: {instrument.serialNumber}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 transition-colors flex-shrink-0"><X size={20} className="text-slate-400" /></button>
          </div>
          <div className="flex items-center gap-1 mt-6 -mb-6 overflow-x-auto">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                  <Icon size={15} />{tab.label}
                  {isActive && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-cyan-400 rounded-full" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900">
          {activeTab === 'main' && (
            <div className="p-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                  <div className="bg-slate-800/50 rounded-xl border border-slate-800 overflow-hidden">
                    {instrument.photo ? <img src={instrument.photo} alt={instrument.name} className="w-full h-56 object-cover" /> : (
                      <div className="h-56 flex flex-col items-center justify-center text-center p-6 bg-gradient-to-br from-slate-800 to-slate-900">
                        <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-3"><Package size={24} className="text-slate-600" /></div>
                        <p className="text-sm font-medium text-slate-300">{instrument.manufacturer} {instrument.type}</p>
                        <p className="text-xs text-slate-500 mt-1">Фото отсутствует</p>
                      </div>
                    )}
                  </div>
                  <div className={`rounded-xl border ${statusConfig.color} p-4`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-opacity-20 flex items-center justify-center`}><StatusIcon size={20} className="text-white" /></div>
                      <div><p className="text-xs text-slate-400 uppercase tracking-wider">Статус</p><p className="text-base font-semibold text-white">{statusConfig.label}</p></div>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl border border-slate-800 p-4 space-y-3">
                    <div className="flex items-center justify-between"><span className="text-xs text-slate-500">Категория</span><span className="text-sm text-white font-medium">{instrument.category}</span></div>
                    <div className="h-px bg-slate-800" />
                    <div className="flex items-center justify-between"><span className="text-xs text-slate-500">Склад</span><span className="text-sm text-white font-medium">{warehouse?.name || '—'}</span></div>
                    <div className="h-px bg-slate-800" />
                    <div className="flex items-center justify-between"><span className="text-xs text-slate-500">Местоположение</span><span className="text-sm text-white font-medium">{instrument.location}</span></div>
                  </div>
                </div>
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-slate-800/50 rounded-xl border border-slate-800 p-5">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Cpu size={14} />Технические характеристики</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                      <SpecRow label="Производитель" value={instrument.manufacturer} />
                      <SpecRow label="Модель" value={`${instrument.category} ${instrument.type}`} />
                      <SpecRow label="Серийный номер" value={instrument.serialNumber} mono />
                      <SpecRow label="Инвентарный номер" value={instrument.inventoryNumber} mono />
                      <SpecRow label="Диапазон" value={instrument.range} />
                      <SpecRow label="Точность" value={instrument.accuracy} />
                      {customSpecs.map(spec => <SpecRow key={spec.label} label={spec.label} value={spec.value} />)}
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl border border-slate-800 p-5">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Clock size={14} />Ключевые даты</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                      <SpecRow label="Последняя поверка" value={formatDate(instrument.lastVerificationDate)} icon={Calendar} />
                      <SpecRow label="Следующая поверка" value={formatDate(instrument.nextVerificationDate)} icon={Calendar} highlight />
                      <SpecRow label="Местоположение" value={`${instrument.location}${warehouse ? ` (${warehouse.name})` : ''}`} icon={MapPin} />
                    </div>
                  </div>
                </div>
              </div>
              {similarInstruments.length > 0 && (
                <div className="mt-6 bg-slate-800/30 rounded-xl border border-slate-800 overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-800"><h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Похожие приборы ({similarInstruments.length})</h4></div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-800"><th className="text-left px-5 py-2.5 text-[11px] font-medium text-slate-500 uppercase">Инв. №</th><th className="text-left px-5 py-2.5 text-[11px] font-medium text-slate-500 uppercase">Наименование</th><th className="text-left px-5 py-2.5 text-[11px] font-medium text-slate-500 uppercase">Статус</th><th className="text-right px-5 py-2.5 text-[11px] font-medium text-slate-500 uppercase">Действие</th></tr></thead>
                      <tbody>{similarInstruments.map(similar => { const simStatus = getStatusConfig(similar.status); return (<tr key={similar.id} className="border-b border-slate-800/50 hover:bg-slate-800/30"><td className="px-5 py-3 font-mono text-xs text-cyan-400">{similar.inventoryNumber}</td><td className="px-5 py-3 text-white">{similar.type}</td><td className="px-5 py-3"><span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs border ${simStatus.color}`}><span className={`w-1.5 h-1.5 rounded-full ${simStatus.dot}`} />{simStatus.label}</span></td><td className="px-5 py-3 text-right"><button onClick={() => onViewSimilar?.(similar)} className="text-xs font-medium text-cyan-400 hover:text-cyan-300">Открыть →</button></td></tr>); })}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'history' && (
            <div className="p-8">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><History size={20} className="text-cyan-400" />История прибора</h3>
              <InstrumentHistory instrument={instrument} isDark={true} onViewProtocol={onViewProtocol} />
            </div>
          )}
          {activeTab !== 'main' && activeTab !== 'history' && (
            <div className="p-16 text-center">
              <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
                {(() => { const tab = TABS.find(t => t.id === activeTab); const Icon = tab?.icon || Info; return <Icon size={28} className="text-slate-500" />; })()}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{TABS.find(t => t.id === activeTab)?.label}</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">Раздел находится в разработке.</p>
            </div>
          )}
        </div>

        <div className="bg-slate-900 border-t border-slate-800 px-8 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => { onClose(); onCreateCard(instrument); }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white border border-purple-500/50 bg-purple-500/10 hover:bg-purple-500/20"><FileText size={15} />Создать карточку</button>
            <button onClick={() => onEdit(instrument)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white border border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20"><Edit2 size={15} />Редактировать</button>
            {instrument.status === 'available' && <button onClick={() => onIssue(instrument)} className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"><ArrowRightLeft size={15} />Выдать</button>}
            {instrument.status === 'issued' && <button onClick={() => onReturn(instrument)} className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-amber-500 hover:bg-amber-400 shadow-lg shadow-amber-500/20"><ArrowRightLeft size={15} />Вернуть</button>}
          </div>
          <button onClick={() => onDelete(instrument)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10"><Trash2 size={15} />Удалить</button>
        </div>
      </div>
    </div>
  );
}

function SpecRow({ label, value, mono = false, highlight = false, icon: Icon }: { label: string; value: string; mono?: boolean; highlight?: boolean; icon?: any }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-slate-500 flex items-center gap-1.5 flex-shrink-0">{Icon && <Icon size={12} className="text-slate-600" />}{label}</span>
      <span className={`text-sm text-right ${highlight ? 'text-cyan-300 font-semibold' : 'text-white font-medium'} ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</span>
    </div>
  );
}
