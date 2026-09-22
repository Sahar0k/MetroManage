import { useState, useMemo, useCallback } from 'react';
import { store } from '../store';
import { formatDateTime } from '../utils/domain';
import { ScrollText, Search } from 'lucide-react';

interface OperationsLogProps { theme: 'dark' | 'light'; }

export default function OperationsLog({ theme }: OperationsLogProps) {
  const [operations] = useState(store.getOperations());
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const isDark = theme === 'dark';
  const users = useMemo(() => store.getUsers(), []);

  const filtered = useMemo(() => {
    const searchLower = search.toLowerCase();
    return operations.filter(op => {
      const matchesSearch = op.details.toLowerCase().includes(searchLower) || op.entityType.toLowerCase().includes(searchLower);
      const matchesAction = !actionFilter || op.action === actionFilter;
      return matchesSearch && matchesAction;
    });
  }, [operations, search, actionFilter]);

  const getActionBadge = useCallback((action: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      issue: { label: 'Выдача', color: 'bg-cyan-500/20 text-cyan-400' },
      return: { label: 'Возврат', color: 'bg-emerald-500/20 text-emerald-400' },
      create: { label: 'Создание', color: 'bg-blue-500/20 text-blue-400' },
      update: { label: 'Изменение', color: 'bg-amber-500/20 text-amber-400' },
      delete: { label: 'Удаление', color: 'bg-red-500/20 text-red-400' },
    };
    const badge = badges[action] || { label: action, color: 'bg-slate-500/20 text-slate-400' };
    return <span className={`px-2 py-0.5 rounded-full text-xs ${badge.color}`}>{badge.label}</span>;
  }, []);

  const getUserName = useCallback((userId: string) => users.find(u => u.id === userId)?.fullName || 'Система', [users]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">{operations.length} записей</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..." className={`w-full pl-9 pr-4 py-2.5 rounded-lg text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'} border focus:outline-none focus:ring-2 focus:ring-cyan-500`} /></div>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className={`px-4 py-2.5 rounded-lg text-sm ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'} border focus:outline-none focus:ring-2 focus:ring-cyan-500`}><option value="">Все действия</option><option value="issue">Выдача</option><option value="return">Возврат</option><option value="create">Создание</option><option value="update">Изменение</option><option value="delete">Удаление</option></select>
      </div>
      <div className="space-y-2">
        {filtered.map(op => (
          <div key={op.id} className={`rounded-xl p-4 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">{getActionBadge(op.action)}</div>
              <span className="text-xs text-slate-500">{formatDateTime(op.timestamp)}</span>
            </div>
            <p className="mt-2 text-sm text-slate-200">{op.details}</p>
            <p className="text-xs mt-1 text-slate-500">Пользователь: {getUserName(op.userId)}</p>
          </div>
        ))}
      </div>
      {filtered.length === 0 && (<div className="flex flex-col items-center justify-center py-16 text-slate-400"><ScrollText size={40} className="mb-3 opacity-30" /><p className="text-sm">Операции не найдены</p></div>)}
    </div>
  );
}
