import { useState, useMemo } from 'react';
import { store } from '../store';
import { formatDate } from '../utils/domain';
import { Calendar, AlertTriangle, Clock, CheckCircle } from 'lucide-react';

interface VerificationProps { theme: 'dark' | 'light'; onNavigate?: (page: string, filter?: string) => void; }

export default function Verification({ theme, onNavigate }: VerificationProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'expired' | 'due_soon' | 'ok'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const isDark = theme === 'dark';

  const instrumentsWithDays = useMemo(() => {
    return store.getInstruments().filter(i => i.nextVerificationDate && i.status !== 'decommissioned').map(i => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const nextDate = new Date(i.nextVerificationDate!);
      const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      let verificationStatus: 'expired' | 'due_soon' | 'ok';
      if (daysUntil < 0) verificationStatus = 'expired';
      else if (daysUntil <= 30) verificationStatus = 'due_soon';
      else verificationStatus = 'ok';
      return { ...i, daysUntil, verificationStatus };
    }).sort((a, b) => a.daysUntil - b.daysUntil);
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return instrumentsWithDays;
    return instrumentsWithDays.filter(i => i.verificationStatus === statusFilter);
  }, [instrumentsWithDays, statusFilter]);

  const getStatusBadge = (item: typeof instrumentsWithDays[0]) => {
    if (item.verificationStatus === 'expired') return <span className="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400 flex items-center gap-1"><AlertTriangle size={12} />Просрочено на {Math.abs(item.daysUntil)} дн.</span>;
    if (item.verificationStatus === 'due_soon') return <span className="px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-400 flex items-center gap-1"><Clock size={12} />Осталось {item.daysUntil} дн.</span>;
    return <span className="px-2 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-400 flex items-center gap-1"><CheckCircle size={12} />{item.daysUntil} дн.</span>;
  };

  const chartCardClass = `rounded-xl p-4 sm:p-5 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`;

  return (
    <div className="space-y-4">
      <div className={`${chartCardClass}`}>
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Calendar size={16} className="text-cyan-500" />Сводка по поверкам</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={`p-3 rounded-lg ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}><div className="flex items-center gap-2 mb-1"><AlertTriangle size={16} className="text-red-500" /><span className="text-sm font-medium text-red-400">Просрочено</span></div><p className="text-2xl font-bold text-red-500">{instrumentsWithDays.filter(i => i.verificationStatus === 'expired').length}</p></div>
          <div className={`p-3 rounded-lg ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}><div className="flex items-center gap-2 mb-1"><Clock size={16} className="text-amber-500" /><span className="text-sm font-medium text-amber-400">Скоро (≤30 дн.)</span></div><p className="text-2xl font-bold text-amber-500">{instrumentsWithDays.filter(i => i.verificationStatus === 'due_soon').length}</p></div>
          <div className={`p-3 rounded-lg ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}><div className="flex items-center gap-2 mb-1"><CheckCircle size={16} className="text-emerald-500" /><span className="text-sm font-medium text-emerald-400">В норме</span></div><p className="text-2xl font-bold text-emerald-500">{instrumentsWithDays.filter(i => i.verificationStatus === 'ok').length}</p></div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">Режим:</span>
        <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${viewMode === 'table' ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>Таблица</button>
        <button onClick={() => setViewMode('chart')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${viewMode === 'chart' ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>График</button>
      </div>

      {viewMode === 'table' && (
        <>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setStatusFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-medium ${statusFilter === 'all' ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>Все ({instrumentsWithDays.length})</button>
            <button onClick={() => setStatusFilter('expired')} className={`px-4 py-2 rounded-lg text-sm font-medium ${statusFilter === 'expired' ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>Просрочено ({instrumentsWithDays.filter(i => i.verificationStatus === 'expired').length})</button>
            <button onClick={() => setStatusFilter('due_soon')} className={`px-4 py-2 rounded-lg text-sm font-medium ${statusFilter === 'due_soon' ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>Скоро ({instrumentsWithDays.filter(i => i.verificationStatus === 'due_soon').length})</button>
            <button onClick={() => setStatusFilter('ok')} className={`px-4 py-2 rounded-lg text-sm font-medium ${statusFilter === 'ok' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>В норме ({instrumentsWithDays.filter(i => i.verificationStatus === 'ok').length})</button>
          </div>
          <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className={isDark ? 'bg-slate-800' : 'bg-slate-50'}><tr><th className="text-left px-4 py-3 font-medium">Инв. №</th><th className="text-left px-4 py-3 font-medium">Наименование</th><th className="text-left px-4 py-3 font-medium hidden md:table-cell">Тип</th><th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Последняя поверка</th><th className="text-left px-4 py-3 font-medium">Следующая поверка</th><th className="text-left px-4 py-3 font-medium">Статус</th></tr></thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-100'}`}>
                  {filtered.map(item => (
                    <tr key={item.id} className={`${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'} transition-colors cursor-pointer`} onClick={() => onNavigate?.('instruments')}>
                      <td className="px-4 py-3 font-mono text-cyan-500">{item.inventoryNumber}</td>
                      <td className="px-4 py-3"><div className="font-medium">{item.name}</div><div className="text-xs text-slate-400">{item.range} | {item.accuracy}</div></td>
                      <td className="px-4 py-3 hidden md:table-cell">{item.type}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">{formatDate(item.lastVerificationDate)}</td>
                      <td className="px-4 py-3">{formatDate(item.nextVerificationDate)}</td>
                      <td className="px-4 py-3">{getStatusBadge(item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && <div className="p-8 text-center text-slate-400">Нет приборов</div>}
          </div>
        </>
      )}

      {viewMode === 'chart' && (
        <div className={chartCardClass}>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Clock size={20} className="text-cyan-500" />Дней до поверки</h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filtered.slice(0, 50).map(item => (
              <div key={item.id} className="flex items-center gap-3">
                <span className="font-mono text-xs text-cyan-400 w-20">{item.inventoryNumber}</span>
                <span className="text-sm flex-1 truncate">{item.name}</span>
                <div className="w-32 h-4 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${item.daysUntil < 0 ? 'bg-red-500' : item.daysUntil <= 30 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, Math.max(5, (item.daysUntil + 365) / 730 * 100))}%` }} />
                </div>
                <span className={`text-xs font-bold w-16 text-right ${item.daysUntil < 0 ? 'text-red-400' : item.daysUntil <= 30 ? 'text-amber-400' : 'text-emerald-400'}`}>{item.daysUntil}д</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
