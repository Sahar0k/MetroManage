import { useState, useMemo, useCallback } from 'react';
import { store } from '../store';
import { VerificationProtocol, VerificationPoint, MeasuringInstrument } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { playSuccess, playError } from '../utils/audio';
import {
  ClipboardCheck, Plus, Save, CheckCircle, XCircle, Trash2,
  FileText, Edit2, Eye, X
} from 'lucide-react';
import {
  createProtocol, startVerification, updateProtocolPoint,
  completeProtocol, rejectProtocol, deleteProtocol,
  hasActiveProtocol
} from '../services/verificationService';
import { formatDate, formatDateTime } from '../utils/domain';
import { PointsTable, ConditionsBlock, RejectDialog, PrintView } from '../components/verification';

interface VerificationWorkspaceProps {
  theme: 'dark' | 'light';
  userId: string | null;
}

type StatusFilter = 'all' | 'draft' | 'in_progress' | 'completed' | 'rejected';

export default function VerificationWorkspace({ theme, userId }: VerificationWorkspaceProps) {
  const [protocols, setProtocols] = useState(store.getProtocols());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState<VerificationProtocol | null>(null);
  const [viewingProtocol, setViewingProtocol] = useState<VerificationProtocol | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showPrint, setShowPrint] = useState(false);

  const notification = useNotification();
  const isDark = theme === 'dark';
  const instruments = useMemo(() => store.getInstruments(), []);
  const employees = useMemo(() => store.getEmployees(), []);

  const filteredProtocols = useMemo(() => {
    if (statusFilter === 'all') return protocols;
    return protocols.filter((p: VerificationProtocol) => p.status === statusFilter);
  }, [protocols, statusFilter]);

  const refresh = useCallback(() => setProtocols(store.getProtocols()), []);

  const getStatusBadge = (status: VerificationProtocol['status']) => {
    const config: Record<VerificationProtocol['status'], { label: string; color: string; icon: any }> = {
      draft: { label: 'Черновик', color: 'bg-slate-500/20 text-slate-400', icon: FileText },
      in_progress: { label: 'В работе', color: 'bg-cyan-500/20 text-cyan-400', icon: Eye },
      completed: { label: 'Завершён', color: 'bg-emerald-500/20 text-emerald-400', icon: CheckCircle },
      rejected: { label: 'Отклонён', color: 'bg-red-500/20 text-red-400', icon: XCircle },
    };
    const { label, color, icon: Icon } = config[status];
    return <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}><Icon size={12} />{label}</span>;
  };

  const getResultBadge = (result?: 'pass' | 'fail') => {
    if (!result) return null;
    return result === 'pass'
      ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400"><CheckCircle size={12} />ГОДЕН</span>
      : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400"><XCircle size={12} />НЕ ГОДЕН</span>;
  };

  const handleStartVerification = (protocolId: string) => {
    if (!userId) return;
    try { startVerification(protocolId, userId); playSuccess(); refresh(); }
    catch (err: any) { playError(); notification.error('Ошибка', err instanceof Error ? err.message : 'Не удалось начать'); }
  };

  const handleComplete = (protocolId: string) => {
    if (!userId) return;
    try {
      const updated = completeProtocol(protocolId, userId);
      if (updated?.result === 'fail') {
        notification.warning('Прибор НЕ ГОДЕН', `Протокол ${updated.instrumentInventoryNumber} завершён с отрицательным результатом.`);
        playError();
      } else {
        notification.success('Поверка завершена', `Протокол ${updated?.instrumentInventoryNumber} завершён. СИ ГОДЕН.`);
        playSuccess();
      }
      refresh();
    } catch (err: any) { playError(); notification.error('Ошибка', err instanceof Error ? err.message : 'Не удалось завершить'); }
  };

  const handleReject = (protocolId: string) => {
    if (!userId || !rejectReason.trim()) return;
    try { rejectProtocol(protocolId, rejectReason, userId); playSuccess(); setShowRejectDialog(null); setRejectReason(''); refresh(); }
    catch (err) { playError(); notification.error('Ошибка', err instanceof Error ? err.message : 'Не удалось отклонить'); }
  };

  const handleDelete = (protocolId: string) => {
    if (!userId || !confirm('Удалить протокол?')) return;
    try { deleteProtocol(protocolId, userId); playSuccess(); refresh(); }
    catch (err) { playError(); notification.error('Ошибка', err instanceof Error ? err.message : 'Не удалось удалить'); }
  };

  const handleEdit = (protocol: VerificationProtocol) => {
    if (protocol.status === 'completed' || protocol.status === 'rejected') { setViewingProtocol(protocol); return; }
    setEditingProtocol(protocol); setShowForm(true);
  };

  const handleView = (protocol: VerificationProtocol) => {
    setViewingProtocol(protocol);
  };

  const inputClass = `w-full px-4 py-3 rounded-lg text-base ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900'} border focus:outline-none focus:ring-2 focus:ring-cyan-500`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><ClipboardCheck size={24} className="text-cyan-400" />Рабочее место поверителя</h2>
          <p className="text-sm text-slate-400 mt-1">{protocols.length} протоколов</p>
        </div>
        <button onClick={() => { setEditingProtocol(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-3 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600"><Plus size={18} />Создать протокол</button>
      </div>

      {/* Фильтры */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all' as StatusFilter, label: 'Все', count: protocols.length },
          { id: 'draft' as StatusFilter, label: 'Черновики', count: protocols.filter((p: VerificationProtocol) => p.status === 'draft').length },
          { id: 'in_progress' as StatusFilter, label: 'В работе', count: protocols.filter((p: VerificationProtocol) => p.status === 'in_progress').length },
          { id: 'completed' as StatusFilter, label: 'Завершённые', count: protocols.filter((p: VerificationProtocol) => p.status === 'completed').length },
          { id: 'rejected' as StatusFilter, label: 'Отклонённые', count: protocols.filter((p: VerificationProtocol) => p.status === 'rejected').length },
        ].map(filter => (
          <button key={filter.id} onClick={() => setStatusFilter(filter.id)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === filter.id ? 'bg-cyan-500 text-white' : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{filter.label} ({filter.count})</button>
        ))}
      </div>

      {/* Таблица протоколов */}
      <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className={isDark ? 'bg-slate-800' : 'bg-slate-50'}>
              <tr>
                <th className="text-left px-4 py-3 font-medium">СИ</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Поверитель</th>
                <th className="text-left px-4 py-3 font-medium">Статус</th>
                <th className="text-left px-4 py-3 font-medium">Результат</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Дата</th>
                <th className="text-right px-4 py-3 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-100'}`}>
              {filteredProtocols.map(protocol => {
                const emp = employees.find(e => e.id === protocol.operatorId);
                return (
                  <tr key={protocol.id} className={`${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'} transition-colors`}>
                    <td className="px-4 py-3"><div className="font-mono text-xs text-cyan-500">{protocol.instrumentInventoryNumber}</div><div className="font-medium">{protocol.instrumentName}</div></td>
                    <td className="px-4 py-3 hidden md:table-cell">{emp?.fullName || '—'}</td>
                    <td className="px-4 py-3">{getStatusBadge(protocol.status)}</td>
                    <td className="px-4 py-3">{getResultBadge(protocol.result)}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-400">{formatDate(protocol.dateStart)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(protocol.status === 'completed' || protocol.status === 'rejected') ? (
                          <button onClick={() => setViewingProtocol(protocol)} className="p-2 rounded-lg hover:bg-slate-700/30 text-slate-400 hover:text-cyan-400" title="Просмотр"><Eye size={16} /></button>
                        ) : (
                          <>
                            {protocol.status === 'draft' && <button onClick={() => handleStartVerification(protocol.id)} className="p-2 rounded-lg hover:bg-slate-700/30 text-slate-400 hover:text-emerald-400" title="Начать поверку"><Edit2 size={16} /></button>}
                            <button onClick={() => handleEdit(protocol)} className="p-2 rounded-lg hover:bg-slate-700/30 text-slate-400 hover:text-cyan-400" title="Редактировать"><Edit2 size={16} /></button>
                            <button onClick={() => handleDelete(protocol.id)} className="p-2 rounded-lg hover:bg-slate-700/30 text-slate-400 hover:text-red-400" title="Удалить"><Trash2 size={16} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredProtocols.length === 0 && <div className="p-8 text-center text-slate-400">Нет протоколов</div>}
      </div>

      {/* Форма протокола */}
      {showForm && (
        <ProtocolForm
          protocol={editingProtocol}
          instruments={instruments}
          employees={employees}
          userId={userId}
          isDark={isDark}
          inputClass={inputClass}
          onSave={() => { setShowForm(false); refresh(); }}
          onClose={() => setShowForm(false)}
          onStartVerification={handleStartVerification}
          onComplete={handleComplete}
          onReject={(id) => { setShowRejectDialog(id); }}
          notification={notification}
        />
      )}

      {/* Просмотр завершённого протокола */}
      {viewingProtocol && (
        <ProtocolView
          protocol={viewingProtocol}
          employees={employees}
          isDark={isDark}
          onClose={() => setViewingProtocol(null)}
          onPrint={() => setShowPrint(true)}
        />
      )}

      {/* Печать */}
      {showPrint && viewingProtocol && (
        <div className="fixed inset-0 z-[300] bg-white overflow-auto print-mode">
          <div className="no-print fixed top-4 right-4 z-[301]">
            <button onClick={() => { setShowPrint(false); window.print(); }} className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 shadow-lg">Печать / Закрыть</button>
          </div>
          <PrintView protocol={viewingProtocol} />
        </div>
      )}

      {/* Диалог отклонения */}
      {showRejectDialog && (
        <RejectDialog
          isDark={isDark}
          reason={rejectReason}
          onReasonChange={setRejectReason}
          onConfirm={() => handleReject(showRejectDialog)}
          onCancel={() => { setShowRejectDialog(null); setRejectReason(''); }}
          inputClass={inputClass}
        />
      )}
    </div>
  );
}

// === Форма протокола ===

interface ProtocolFormProps {
  protocol: VerificationProtocol | null;
  instruments: MeasuringInstrument[];
  employees: { id: string; fullName: string }[];
  userId: string | null;
  isDark: boolean;
  inputClass: string;
  onSave: () => void;
  onClose: () => void;
  onStartVerification: (id: string) => void;
  onComplete: (id: string) => void;
  onReject: (id: string) => void;
  notification: any;
}

function ProtocolForm({ protocol, instruments, employees, userId, isDark, inputClass, onSave, onClose, onStartVerification, onComplete, onReject, notification }: ProtocolFormProps) {
  const [deviceId, setDeviceId] = useState(protocol?.deviceId || '');
  const [operatorId, setOperatorId] = useState(protocol?.operatorId || userId || '');
  const [points, setPoints] = useState<Omit<VerificationPoint, 'id'>[]>(
    protocol?.points.map(p => ({ name: p.name, nominal: p.nominal, unit: p.unit, actual: p.actual, error: p.error, tolerance: p.tolerance, verdict: p.verdict })) || []
  );
  const [conditions, setConditions] = useState(protocol?.conditions || {});
  const [notes, setNotes] = useState(protocol?.notes || '');

  const availableInstruments = useMemo(() => 
    instruments.filter(i => !hasActiveProtocol(i.id) || i.id === protocol?.deviceId),
    [instruments, protocol]
  );

  const addPoint = () => setPoints([...points, { name: '', nominal: 0, unit: '', tolerance: 0 }]);
  const updatePoint = (index: number, updates: Partial<Omit<VerificationPoint, 'id'>>) => { const newPoints = [...points]; newPoints[index] = { ...newPoints[index], ...updates }; setPoints(newPoints); };
  const removePoint = (index: number) => setPoints(points.filter((_, i) => i !== index));

  const updateActual = (index: number, actual: number) => {
    const point = points[index];
    const error = Math.abs(actual - point.nominal);
    const verdict = error <= point.tolerance + 1e-9 ? 'pass' as const : 'fail' as const;
    updatePoint(index, { actual, error, verdict });
  };

  const handleSave = () => {
    if (!deviceId || !operatorId) { playError(); notification.error('Ошибка', 'Выберите СИ и поверителя'); return; }
    if (points.length === 0) { playError(); notification.error('Ошибка', 'Добавьте хотя бы одну точку измерений'); return; }

    if (protocol) {
      try {
        store.updateProtocol(protocol.id, {
          deviceId, operatorId,
          points: points.map(p => ({ ...p, id: protocol.points.find(op => op.name === p.name && op.nominal === p.nominal)?.id || Math.random().toString(36).substr(2, 9) })),
          conditions: Object.keys(conditions).length > 0 ? conditions : undefined,
          notes: notes || undefined,
        });
        playSuccess(); onSave();
      } catch (err: any) { playError(); notification.error('Ошибка', err instanceof Error ? err.message : 'Не удалось сохранить'); }
    } else {
      try {
        createProtocol(deviceId, operatorId, points, Object.keys(conditions).length > 0 ? conditions : undefined, notes || undefined);
        playSuccess(); onSave();
      } catch (err: any) { playError(); notification.error('Ошибка', err instanceof Error ? err.message : 'Не удалось создать'); }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className={`w-full max-w-5xl rounded-xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} max-h-[95vh] overflow-y-auto my-4`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><ClipboardCheck size={24} className="text-cyan-400" />{protocol ? 'Редактировать протокол' : 'Новый протокол поверки'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700/30"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-slate-300 mb-2 block">Средство измерений *</label><select value={deviceId} onChange={e => setDeviceId(e.target.value)} className={inputClass} disabled={!!protocol}><option value="">— Выберите СИ —</option>{availableInstruments.map(i => <option key={i.id} value={i.id}>{i.inventoryNumber} — {i.name}</option>)}</select></div>
            <div><label className="text-sm font-medium text-slate-300 mb-2 block">Поверитель *</label><select value={operatorId} onChange={e => setOperatorId(e.target.value)} className={inputClass}><option value="">— Выберите поверителя —</option>{employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}</select></div>
          </div>

          <ConditionsBlock conditions={conditions} editable={true} isDark={isDark} onChange={setConditions} inputClass={inputClass} />

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium flex items-center gap-2"><FileText size={16} className="text-cyan-400" />Точки измерений</h3>
              <button onClick={addPoint} className="flex items-center gap-1 px-3 py-2 bg-cyan-500 text-white rounded-lg text-sm hover:bg-cyan-600"><Plus size={14} />Добавить точку</button>
            </div>
            <PointsTable points={points} editable={true} isDark={isDark} onUpdatePoint={updatePoint} onRemovePoint={removePoint} inputClass={inputClass} />
            {points.length === 0 && <p className="text-center text-slate-500 py-4">Добавьте точки измерений</p>}
          </div>

          <div><label className="text-sm font-medium text-slate-300 mb-2 block">Примечания</label><textarea value={notes} onChange={e => setNotes(e.target.value)} className={`${inputClass} resize-none`} rows={3} placeholder="Дополнительная информация..." /></div>
        </div>

        <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-slate-700">
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-3 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600"><Save size={16} />Сохранить</button>
          {protocol && protocol.status === 'draft' && <button onClick={() => { handleSave(); onStartVerification(protocol.id); }} className="flex items-center gap-2 px-4 py-3 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600"><Edit2 size={16} />Начать поверку</button>}
          {protocol && protocol.status === 'in_progress' && (
            <>
              <button onClick={() => onComplete(protocol.id)} className="flex items-center gap-2 px-4 py-3 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600"><CheckCircle size={16} />Завершить</button>
              <button onClick={() => onReject(protocol.id)} className="flex items-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"><XCircle size={16} />Отклонить</button>
            </>
          )}
          <button onClick={onClose} className="flex-1 py-3 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600">Отмена</button>
        </div>
      </div>
    </div>
  );
}

// === Просмотр завершённого протокола ===

interface ProtocolViewProps {
  protocol: VerificationProtocol;
  employees: { id: string; fullName: string }[];
  isDark: boolean;
  onClose: () => void;
  onPrint: () => void;
}

function ProtocolView({ protocol, employees, isDark, onClose, onPrint }: ProtocolViewProps) {
  const emp = employees.find(e => e.id === protocol.operatorId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className={`w-full max-w-4xl rounded-xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} max-h-[95vh] overflow-y-auto my-4`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><Eye size={24} className="text-cyan-400" />Протокол поверки</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700/30"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div className={`rounded-lg p-4 ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs text-slate-400">СИ</p><p className="font-mono text-cyan-400">{protocol.instrumentInventoryNumber}</p><p className="font-medium">{protocol.instrumentName}</p></div>
              <div><p className="text-xs text-slate-400">Поверитель</p><p className="font-medium">{emp?.fullName || '—'}</p></div>
              <div><p className="text-xs text-slate-400">Дата начала</p><p className="font-medium">{formatDateTime(protocol.dateStart)}</p></div>
              <div><p className="text-xs text-slate-400">Дата завершения</p><p className="font-medium">{protocol.dateEnd ? formatDateTime(protocol.dateEnd) : '—'}</p></div>
            </div>
          </div>

          {protocol.conditions && (protocol.conditions.temperature || protocol.conditions.humidity) && (
            <ConditionsBlock conditions={protocol.conditions} editable={false} isDark={isDark} onChange={() => {}} inputClass="" />
          )}

          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2"><FileText size={16} className="text-cyan-400" />Точки измерений</h3>
            <PointsTable points={protocol.points} editable={false} isDark={isDark} onUpdatePoint={() => {}} onRemovePoint={() => {}} inputClass="" />
          </div>

          {protocol.result && (
            <div className={`rounded-lg p-4 border-2 ${protocol.result === 'pass' ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-red-500/50 bg-red-500/10'}`}>
              <div className="flex items-center gap-3">
                {protocol.result === 'pass' ? <CheckCircle size={32} className="text-emerald-400" /> : <XCircle size={32} className="text-red-400" />}
                <div><p className="text-lg font-bold">{protocol.result === 'pass' ? 'СИ ГОДЕН' : 'СИ НЕ ГОДЕН'}</p><p className="text-sm text-slate-400">Итоговый вердикт по протоколу</p></div>
              </div>
            </div>
          )}

          {protocol.rejectionReason && (
            <div className="rounded-lg p-4 border border-red-500/30 bg-red-500/10"><p className="text-sm font-medium text-red-400 mb-1">Причина отклонения:</p><p className="text-sm text-slate-300">{protocol.rejectionReason}</p></div>
          )}

          {protocol.notes && (
            <div className={`rounded-lg p-4 ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}><p className="text-sm font-medium mb-1">Примечания:</p><p className="text-sm text-slate-300">{protocol.notes}</p></div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-700 flex gap-3">
          <button onClick={onPrint} className="flex-1 py-3 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600">Печать</button>
          <button onClick={onClose} className="flex-1 py-3 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600">Закрыть</button>
        </div>
      </div>
    </div>
  );
}
