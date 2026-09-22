import { useMemo, useCallback, useEffect } from 'react';
import { store } from '../store';
import { isVerificationExpired, isVerificationDueSoon } from '../utils/domain';
import { AlertTriangle, Clock, Wrench, Calendar, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { getOverdueSendoffs } from '../services/verificationFlowService';
import { useNotification } from '../contexts/NotificationContext';

interface DashboardProps { theme: 'dark' | 'light'; onNavigate?: (page: string, filter?: string) => void; }

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) return (<div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 shadow-xl">{payload.map((entry: any, idx: number) => (<p key={idx} className="text-sm font-semibold" style={{ color: entry.color || entry.fill }}>{entry.name}: {entry.value}</p>))}</div>);
  return null;
};

export default function Dashboard({ theme, onNavigate }: DashboardProps) {
  const isDark = theme === 'dark';
  const notification = useNotification();
  const { stats, statusData, verificationData, criticalInstruments, upcomingVerifications, repairInstruments, recentOperations, urgentInstruments, onVerification, overdueSendoffs } = useMemo(() => {
    const instruments = store.getInstruments();
    const operations = store.getOperations();
    const stats = store.getDashboardStats();
    const expiredInstruments = instruments.filter(i => isVerificationExpired(i));
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const upcomingThisMonth = instruments.filter(i => { if (!i.nextVerificationDate) return false; const nextDate = new Date(i.nextVerificationDate); return nextDate.getMonth() === currentMonth && nextDate.getFullYear() === currentYear; });
    const repairInstruments = instruments.filter(i => i.status === 'repair');
    const recentOperations = operations.slice(0, 8);
    const dueSoonInstruments = instruments.filter(i => { if (!i.nextVerificationDate) return false; const nextDate = new Date(i.nextVerificationDate); const diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)); return diffDays >= 0 && diffDays <= 7 && i.status === 'issued'; });
    const urgentInstruments = [...expiredInstruments.map(i => ({ ...i, priority: 1, daysUntil: Math.ceil((new Date(i.nextVerificationDate!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) })), ...dueSoonInstruments.map(i => ({ ...i, priority: 2, daysUntil: Math.ceil((new Date(i.nextVerificationDate!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) }))].sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 7);
    const onVerification = instruments.filter(i => i.status === 'verification');
    const overdueSendoffs = getOverdueSendoffs();
    const statusData = [
      { name: 'Доступно', value: stats.available, color: '#6ee7b7', filter: 'available' },
      { name: 'Выдано', value: stats.issued, color: '#67e8f9', filter: 'issued' },
      { name: 'На поверке', value: onVerification.length, color: '#a78bfa', filter: 'verification' },
      { name: 'Ремонт', value: instruments.filter(i => i.status === 'repair').length, color: '#fcd34d', filter: 'repair' },
      { name: 'Списано', value: instruments.filter(i => i.status === 'decommissioned').length, color: '#94a3b8', filter: 'decommissioned' },
    ].filter(d => d.value > 0);
    const verificationData = [
      { name: 'Просрочена', value: stats.expiredVerification, color: '#fca5a5', filter: 'expired' },
      { name: 'Скоро (30 дн.)', value: stats.verificationDueSoon, color: '#fcd34d', filter: 'due_soon' },
      { name: 'В норме', value: stats.totalInstruments - stats.expiredVerification - stats.verificationDueSoon, color: '#6ee7b7', filter: undefined },
    ].filter(d => d.value > 0);
    return { stats, statusData, verificationData, criticalInstruments: { expired: expiredInstruments.length, dueSoon: dueSoonInstruments.length }, upcomingVerifications: upcomingThisMonth, repairInstruments, recentOperations, urgentInstruments, onVerification, overdueSendoffs };
  }, []);

  // Одноразовое уведомление о просроченных возвратах
  useEffect(() => {
    if (overdueSendoffs.length > 0) {
      notification.warning(
        'Просрочен возврат с поверки',
        `${overdueSendoffs.length} прибор(ов) не возвращены в срок`
      );
    }
  }, [overdueSendoffs.length]);

  const handleChartClick = useCallback((data: any) => { if (onNavigate && data && data.filter) onNavigate('instruments', data.filter); }, [onNavigate]);
  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const currentMonthName = monthNames[new Date().getMonth()];
  const chartCardClass = `rounded-xl p-4 sm:p-5 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200 shadow-sm'}`;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className={`rounded-xl p-4 border-2 flex flex-col ${isDark ? 'bg-red-400/5 border-red-400/20' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-2 mb-3"><AlertTriangle size={20} className="text-red-400" /><h3 className="font-semibold text-red-300">Критические СИ</h3></div>
          <div className="space-y-2 mb-3 flex-1">
            <div className="flex items-center justify-between"><span className="text-sm text-slate-300">Поверка просрочена:</span><span className="text-lg font-bold text-red-400">{criticalInstruments.expired} шт.</span></div>
            <div className="flex items-center justify-between"><span className="text-sm text-slate-300">Выданы, поверка &lt;7д:</span><span className="text-lg font-bold text-amber-400">{criticalInstruments.dueSoon} шт.</span></div>
          </div>
          <button onClick={() => onNavigate?.('instruments', 'expired')} className="w-full py-2 bg-red-400 text-white rounded-lg text-sm font-medium hover:bg-red-500">Перейти к просроченным →</button>
        </div>
        <div className={`rounded-xl p-4 border-2 flex flex-col ${isDark ? 'bg-cyan-400/5 border-cyan-400/20' : 'bg-cyan-50 border-cyan-200'}`}>
          <div className="flex items-center gap-2 mb-3"><Calendar size={20} className="text-cyan-400" /><h3 className="font-semibold text-cyan-300">Ближайшие поверки</h3></div>
          <div className="flex-1"><p className="text-sm mb-2 text-slate-300">{currentMonthName} {new Date().getFullYear()}</p><p className="text-3xl font-bold text-cyan-400 mb-3">{upcomingVerifications.length}</p></div>
          <button onClick={() => onNavigate?.('verification')} className="w-full py-2 bg-cyan-400 text-white rounded-lg text-sm font-medium hover:bg-cyan-500">Открыть график →</button>
        </div>
        <div className={`rounded-xl p-4 border-2 flex flex-col ${isDark ? 'bg-amber-400/5 border-amber-400/20' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-2 mb-3"><Wrench size={20} className="text-amber-400" /><h3 className="font-semibold text-amber-300">Ремонт</h3></div>
          <div className="space-y-2 mb-3 flex-1"><div className="flex items-center justify-between"><span className="text-sm text-slate-300">В ремонте:</span><span className="text-lg font-bold text-amber-400">{repairInstruments.length} шт.</span></div></div>
          <button onClick={() => onNavigate?.('instruments', 'repair')} className="w-full py-2 bg-amber-400 text-white rounded-lg text-sm font-medium hover:bg-amber-500">Показать детали →</button>
        </div>
        <div className={`rounded-xl p-4 border-2 flex flex-col ${isDark ? 'bg-purple-400/5 border-purple-400/20' : 'bg-purple-50 border-purple-200'}`}>
          <div className="flex items-center gap-2 mb-3"><Clock size={20} className="text-purple-400" /><h3 className="font-semibold text-purple-300">На поверке</h3></div>
          <div className="space-y-2 mb-3 flex-1">
            <div className="flex items-center justify-between"><span className="text-sm text-slate-300">Отправлено:</span><span className="text-lg font-bold text-purple-400">{onVerification.length} шт.</span></div>
            {overdueSendoffs.length > 0 && <div className="flex items-center justify-between"><span className="text-sm text-slate-300">Просрочен возврат:</span><span className="text-lg font-bold text-red-400">{overdueSendoffs.length} шт.</span></div>}
          </div>
          <button onClick={() => onNavigate?.('instruments', 'verification')} className="w-full py-2 bg-purple-400 text-white rounded-lg text-sm font-medium hover:bg-purple-500">Показать детали →</button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <div className={chartCardClass}>
          <h3 className="text-base sm:text-lg font-semibold mb-3 flex items-center gap-2"><TrendingUp size={20} className="text-cyan-400" />Статусы СИ</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart><Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" paddingAngle={2} onClick={handleChartClick} cursor="pointer">{statusData.map((entry, index) => (<Cell key={index} fill={entry.color} stroke="none" />))}</Pie><Tooltip content={<CustomTooltip />} /><Legend verticalAlign="bottom" height={36} formatter={(value: string) => (<span className="text-slate-300 text-xs">{value}</span>)} onClick={handleChartClick} cursor="pointer" /></PieChart>
          </ResponsiveContainer>
        </div>
        <div className={chartCardClass}>
          <h3 className="text-base sm:text-lg font-semibold mb-3 flex items-center gap-2"><Clock size={20} className="text-amber-400" />Состояние поверок</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart><Pie data={verificationData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" paddingAngle={2} onClick={handleChartClick} cursor="pointer">{verificationData.map((entry, index) => (<Cell key={index} fill={entry.color} stroke="none" />))}</Pie><Tooltip content={<CustomTooltip />} /><Legend verticalAlign="bottom" height={36} formatter={(value: string) => (<span className="text-slate-300 text-xs">{value}</span>)} onClick={handleChartClick} cursor="pointer" /></PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <div className={chartCardClass}>
          <h3 className="text-base sm:text-lg font-semibold mb-3 flex items-center gap-2"><AlertTriangle size={20} className="text-red-400" />Срочные СИ</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-700"><tr><th className="text-left px-3 py-2 font-medium">Статус</th><th className="text-left px-3 py-2 font-medium">Наименование</th><th className="text-left px-3 py-2 font-medium hidden md:table-cell">Местоположение</th><th className="text-left px-3 py-2 font-medium">Дней</th></tr></thead>
              <tbody className="divide-y divide-slate-700">{urgentInstruments.map(item => (<tr key={item.id} className="hover:bg-slate-700/50"><td className="px-3 py-2"><span className={`px-2 py-1 rounded text-xs ${item.priority === 1 ? 'bg-red-400/15 text-red-300' : 'bg-amber-400/15 text-amber-300'}`}>{item.priority === 1 ? 'Просрочено' : 'Скоро'}</span></td><td className="px-3 py-2"><div className="font-mono text-xs text-cyan-400">{item.inventoryNumber}</div><div className="font-medium">{item.name}</div></td><td className="px-3 py-2 hidden md:table-cell text-xs text-slate-400">{item.location}</td><td className="px-3 py-2"><span className={`font-bold ${item.daysUntil < 0 ? 'text-red-400' : 'text-amber-400'}`}>{item.daysUntil < 0 ? `${Math.abs(item.daysUntil)}д назад` : `${item.daysUntil}д`}</span></td></tr>))}</tbody>
            </table>
            {urgentInstruments.length === 0 && <div className="p-8 text-center text-slate-400">Нет срочных СИ</div>}
          </div>
        </div>
        <div className={chartCardClass}>
          <h3 className="text-base sm:text-lg font-semibold mb-3 flex items-center gap-2"><Clock size={20} className="text-cyan-400" />Журнал операций</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {recentOperations.map(op => { const time = new Date(op.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); return (<div key={op.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-700/50"><span className="text-xs font-mono text-slate-400">{time}</span><span className={`px-2 py-0.5 rounded text-xs ${op.action === 'issue' ? 'bg-cyan-400/15 text-cyan-300' : op.action === 'return' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}>{op.action === 'issue' ? 'Выдача' : op.action === 'return' ? 'Возврат' : 'Другое'}</span><span className="text-sm flex-1 text-slate-300">{op.details}</span></div>); })}
            {recentOperations.length === 0 && <div className="p-8 text-center text-slate-400">Нет операций</div>}
          </div>
          <button onClick={() => onNavigate?.('operations')} className="w-full mt-3 py-2 rounded-lg text-sm font-medium bg-slate-700 text-slate-300 hover:bg-slate-600">Все записи в Журнале →</button>
        </div>
      </div>
    </div>
  );
}
