import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { store } from '../store';
import { IssueRecord, MeasuringInstrument, Role } from '../types';
import { canIssueInstrument, canReturnInstrument, formatDateTime, hasPermission } from '../utils/domain';
import { playSuccess, playError, playScan } from '../utils/audio';
import { ArrowLeftRight, CheckCircle, XCircle, AlertTriangle, Search } from 'lucide-react';

interface IssueReturnProps { theme: 'dark' | 'light'; userId: string | null; userRole: Role; initialInstrumentId?: string | null; }

const IssueReturn = memo(function IssueReturn({ theme, userId, userRole, initialInstrumentId }: IssueReturnProps) {
  const [tab, setTab] = useState<'issue' | 'return'>('issue');
  const [instruments, setInstruments] = useState(store.getInstruments());
  const [employees] = useState(store.getEmployees());
  const [departments] = useState(store.getDepartments());
  const [issues, setIssues] = useState(store.getIssues());
  const [search, setSearch] = useState('');
  const [selectedInstrument, setSelectedInstrument] = useState<MeasuringInstrument | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');

  useEffect(() => { if (initialInstrumentId) { const instrument = instruments.find(i => i.id === initialInstrumentId); if (instrument && instrument.status === 'available') { setSelectedInstrument(instrument); setTab('issue'); } } }, [initialInstrumentId, instruments]);

  const isDark = theme === 'dark';
  const canIssue = hasPermission(userRole, 'issue');
  const canReturn = hasPermission(userRole, 'return');
  const refreshData = useCallback(() => { setInstruments(store.getInstruments()); setIssues(store.getIssues()); }, []);
  const activeIssues = useMemo(() => issues.filter(i => !i.returnedAt), [issues]);
  const availableInstruments = useMemo(() => { const searchLower = search.toLowerCase(); return instruments.filter(i => i.name.toLowerCase().includes(searchLower) || i.inventoryNumber.toLowerCase().includes(searchLower)); }, [instruments, search]);

  const handleBarcodeScan = useCallback((barcode: string) => { const found = instruments.find(i => i.inventoryNumber === barcode || i.serialNumber === barcode); if (found) { setSelectedInstrument(found); playScan(); } }, [instruments]);

  const handleIssue = () => {
    if (!selectedInstrument || !selectedEmployee || !userId) return;
    const result = canIssueInstrument(selectedInstrument, userRole);
    if (!result.success) { setMessage({ type: 'error', text: result.message }); playError(); return; }
    store.addIssue({ instrumentId: selectedInstrument.id, employeeId: selectedEmployee, issuedBy: userId, issuedAt: new Date().toISOString(), returnedAt: null, returnedBy: null, note, originalWarehouseId: selectedInstrument.warehouseId });
    store.updateInstrument(selectedInstrument.id, { status: 'issued', location: 'Выдан', warehouseId: null });
    const emp = employees.find(e => e.id === selectedEmployee);
    store.addOperation({ userId, action: 'issue', entityType: 'instrument', entityId: selectedInstrument.id, details: `Выдача ${selectedInstrument.inventoryNumber} → ${emp?.fullName || 'неизвестный'}` });
    setMessage({ type: 'success', text: `СИ ${selectedInstrument.inventoryNumber} выдано` }); playSuccess();
    setSelectedInstrument(null); setSelectedEmployee(''); setNote(''); refreshData();
  };

  const handleReturn = (issue: IssueRecord) => {
    if (!userId) return;
    const result = canReturnInstrument(issue, userRole);
    if (!result.success) { setMessage({ type: 'error', text: result.message }); playError(); return; }
    store.returnInstrument(issue.id, userId);
    store.updateInstrument(issue.instrumentId, { status: 'available', location: 'Кладовая СИ', warehouseId: issue.originalWarehouseId });
    const inst = instruments.find(i => i.id === issue.instrumentId);
    store.addOperation({ userId, action: 'return', entityType: 'instrument', entityId: issue.instrumentId, details: `Возврат ${inst?.inventoryNumber || issue.instrumentId}` });
    setMessage({ type: 'success', text: `СИ ${inst?.inventoryNumber} возвращено` }); playSuccess(); refreshData();
  };

  const inputClass = `w-full px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900'} border focus:outline-none focus:ring-2 focus:ring-cyan-500`;

  return (
    <div className="space-y-4">
      {message && (<div className={`flex items-center gap-3 p-4 rounded-xl border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>{message.type === 'success' ? <CheckCircle size={18} className="text-emerald-500" /> : <XCircle size={18} className="text-red-500" />}<span className={`text-sm ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>{message.text}</span><button onClick={() => setMessage(null)} className="ml-auto text-slate-400 hover:text-white">×</button></div>)}
      <div className="flex gap-2">
        <button onClick={() => setTab('issue')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'issue' ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>Выдача</button>
        <button onClick={() => setTab('return')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'return' ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>Возврат ({activeIssues.length})</button>
      </div>
      {tab === 'issue' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={`rounded-xl p-4 border ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
            <h3 className="font-semibold mb-3">Выберите СИ</h3>
            <div className="flex gap-2 mb-3"><input value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { handleBarcodeScan(barcodeInput); setBarcodeInput(''); } }} placeholder="Штрихкод..." className={inputClass} /></div>
            <div className="relative mb-3"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..." className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'} border focus:outline-none focus:ring-2 focus:ring-cyan-500`} /></div>
            <div className="space-y-1 max-h-64 overflow-y-auto">{availableInstruments.map(inst => (<button key={inst.id} onClick={() => setSelectedInstrument(inst)} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedInstrument?.id === inst.id ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}><div className="flex items-center justify-between"><span className="font-mono text-xs">{inst.inventoryNumber}</span><span className={`text-xs ${inst.status === 'available' ? 'text-emerald-400' : 'text-cyan-400'}`}>{inst.status === 'available' ? 'Доступно' : 'Выдано'}</span></div><div className="font-medium">{inst.name}</div></button>))}</div>
          </div>
          <div className={`rounded-xl p-4 border ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
            <h3 className="font-semibold mb-3">Оформить выдачу</h3>
            {selectedInstrument ? (
              <div className="space-y-3">
                <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}><p className="font-mono text-xs text-cyan-500">{selectedInstrument.inventoryNumber}</p><p className="font-medium">{selectedInstrument.name}</p></div>
                {(() => { const check = canIssueInstrument(selectedInstrument, userRole); if (!check.success) return (<div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30"><AlertTriangle size={16} className="text-red-500" /><span className="text-sm text-red-400">{check.message}</span></div>); return null; })()}
                <div><label className="text-xs text-slate-400 mb-1 block">Сотрудник</label><select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} className={inputClass}><option value="">— Выберите —</option>{employees.map(emp => { const dept = departments.find(d => d.id === emp.departmentId); return <option key={emp.id} value={emp.id}>{emp.fullName} ({dept?.code})</option>; })}</select></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Примечание</label><input value={note} onChange={e => setNote(e.target.value)} className={inputClass} placeholder="Необязательно..." /></div>
                <button onClick={handleIssue} disabled={!canIssue || !selectedEmployee} className="w-full py-2.5 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed">{!canIssue ? 'Недостаточно прав' : 'Выдать СИ'}</button>
              </div>
            ) : (<div className="flex flex-col items-center justify-center py-12 text-slate-500"><ArrowLeftRight size={32} className="mb-2 opacity-50" /><p className="text-sm">Выберите средство измерения</p></div>)}
          </div>
        </div>
      )}
      {tab === 'return' && (
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <table className="w-full min-w-[600px] text-sm">
            <thead className={isDark ? 'bg-slate-800' : 'bg-slate-50'}><tr><th className="text-left px-4 py-3 font-medium">СИ</th><th className="text-left px-4 py-3 font-medium hidden md:table-cell">Сотрудник</th><th className="text-left px-4 py-3 font-medium hidden md:table-cell">Выдано</th><th className="text-right px-4 py-3 font-medium">Действие</th></tr></thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-100'}`}>{activeIssues.map(issue => { const inst = instruments.find(i => i.id === issue.instrumentId); const emp = employees.find(e => e.id === issue.employeeId); return (<tr key={issue.id} className={isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}><td className="px-4 py-3"><div className="font-mono text-xs text-cyan-500">{inst?.inventoryNumber}</div><div className="font-medium">{inst?.name}</div></td><td className="px-4 py-3 hidden md:table-cell">{emp?.fullName}</td><td className="px-4 py-3 hidden md:table-cell">{formatDateTime(issue.issuedAt)}</td><td className="px-4 py-3 text-right"><button onClick={() => handleReturn(issue)} disabled={!canReturn} className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 disabled:opacity-50">Вернуть</button></td></tr>); })}</tbody>
          </table>
          {activeIssues.length === 0 && <div className="p-8 text-center text-slate-400">Нет активных выдач</div>}
        </div>
      )}
    </div>
  );
});

export default IssueReturn;
