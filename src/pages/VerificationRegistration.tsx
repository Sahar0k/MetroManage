import { useState, useMemo, useCallback, useEffect } from 'react';
import { store } from '../store';
import { MeasuringInstrument, VerificationProtocol } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import { playSuccess, playError } from '../utils/audio';
import {
  ClipboardCheck, Plus, Save, CheckCircle, XCircle, Trash2,
  FileText, Edit2, Eye, X, Upload, Calendar, User, Hash, MessageSquare, Printer
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { calculateNextVerification, formatDate, formatDateTime } from '../utils/domain';
import { indexedDBCache } from '../services/indexedDBCache';

import { sendToVerification, completeSendoff, getActiveSendoff, getSendoffsForInstrument } from '../services/verificationFlowService';

interface VerificationRegistrationProps {
  theme: 'dark' | 'light';
  userId: string | null;
  prefillInstrumentId?: string | null;
  prefillComment?: string | null;
  prefillSendoffId?: string | null;
}

export default function VerificationRegistration({ theme, userId, prefillInstrumentId, prefillComment, prefillSendoffId }: VerificationRegistrationProps) {
  const [protocols, setProtocols] = useState<VerificationProtocol[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [viewingProtocol, setViewingProtocol] = useState<VerificationProtocol | null>(null);
  const [showPrint, setShowPrint] = useState(false);

  const notification = useNotification();
  const isDark = theme === 'dark';
  const instruments = useMemo(() => store.getInstruments(), []);
  const employees = useMemo(() => store.getEmployees(), []);

  useEffect(() => {
    refresh();
  }, []);

  const refresh = useCallback(() => {
    setProtocols(store.getProtocols());
  }, []);

  const handleDelete = (protocolId: string) => {
    if (!userId || !confirm('Удалить запись?')) return;
    try {
      const result = store.deleteProtocol(protocolId);
      if (result) {
        playSuccess();
        refresh();
        notification.success('Удалено', 'Запись о поверке удалена');
      }
    } catch (err: any) {
      playError();
      notification.error('Ошибка', err.message || 'Не удалось удалить');
    }
  };

  const inputClass = `w-full px-4 py-3 rounded-lg text-base ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900'} border focus:outline-none focus:ring-2 focus:ring-cyan-500`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><ClipboardCheck size={24} className="text-cyan-400" />Регистрация поверок</h2>
          <p className="text-sm text-slate-400 mt-1">{protocols.length} записей</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-3 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600"><Plus size={18} />Зарегистрировать поверку</button>
      </div>

      {/* Список зарегистрированных поверок */}
      <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className={isDark ? 'bg-slate-800' : 'bg-slate-50'}>
              <tr>
                <th className="text-left px-4 py-3 font-medium">СИ</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Дата поверки</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Поверитель</th>
                <th className="text-left px-4 py-3 font-medium">Результат</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">След. поверка</th>
                <th className="text-right px-4 py-3 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-100'}`}>
              {protocols.map(protocol => {
                const emp = employees.find(e => e.id === protocol.operatorId);
                return (
                  <tr key={protocol.id} className={`${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'} transition-colors`}>
                    <td className="px-4 py-3"><div className="font-mono text-xs text-cyan-500">{protocol.instrumentInventoryNumber}</div><div className="font-medium">{protocol.instrumentName}</div></td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-400">{formatDate(protocol.dateEnd || protocol.dateStart)}</td>
                    <td className="px-4 py-3 hidden md:table-cell">{emp?.fullName || '—'}</td>
                    <td className="px-4 py-3">
                      {protocol.result === 'pass' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400"><CheckCircle size={12} />ГОДЕН</span>}
                      {protocol.result === 'fail' && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400"><XCircle size={12} />НЕ ГОДЕН</span>}
                      {!protocol.result && <span className="text-xs text-slate-500">—</span>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-400">{formatDate(protocol.points[0]?.name || '')}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewingProtocol(protocol)} className="p-2 rounded-lg hover:bg-slate-700/30 text-slate-400 hover:text-cyan-400" title="Просмотр"><Eye size={16} /></button>
                        <button onClick={() => handleDelete(protocol.id)} className="p-2 rounded-lg hover:bg-slate-700/30 text-slate-400 hover:text-red-400" title="Удалить"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {protocols.length === 0 && <div className="p-8 text-center text-slate-400">Нет зарегистрированных поверок</div>}
      </div>

      {/* Форма регистрации */}
      {showForm && (
        <RegistrationForm
          instruments={instruments}
          employees={employees}
          userId={userId}
          isDark={isDark}
          inputClass={inputClass}
          onSave={() => { setShowForm(false); refresh(); }}
          onClose={() => setShowForm(false)}
          notification={notification}
          prefillInstrumentId={prefillInstrumentId}
          prefillComment={prefillComment}
          prefillSendoffId={prefillSendoffId}
        />
      )}

      {/* Просмотр */}
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
          <RegistrationPrintView protocol={viewingProtocol} employees={employees} />
        </div>
      )}
    </div>
  );
}

// === Форма регистрации поверки ===

interface RegistrationFormProps {
  instruments: MeasuringInstrument[];
  employees: { id: string; fullName: string }[];
  userId: string | null;
  isDark: boolean;
  inputClass: string;
  onSave: () => void;
  onClose: () => void;
  notification: any;
  prefillInstrumentId?: string | null;
  prefillComment?: string | null;
  prefillSendoffId?: string | null;
}

function RegistrationForm({ instruments, employees, userId, isDark, inputClass, onSave, onClose, notification, prefillInstrumentId, prefillComment, prefillSendoffId }: RegistrationFormProps) {
  const [deviceId, setDeviceId] = useState(prefillInstrumentId || '');
  const [verificationDate, setVerificationDate] = useState(new Date().toISOString().split('T')[0]);
  const [operatorId, setOperatorId] = useState(userId || '');
  const [result, setResult] = useState<'pass' | 'fail'>('pass');
  const [protocolNumber, setProtocolNumber] = useState('');
  const [protocolFile, setProtocolFile] = useState<{ name: string; data: string } | null>(null);
  const [nextVerificationDate, setNextVerificationDate] = useState('');
  const [comment, setComment] = useState(prefillComment || '');

  const selectedInstrument = useMemo(() => instruments.find(i => i.id === deviceId), [instruments, deviceId]);

  const handleInstrumentChange = (id: string) => {
    setDeviceId(id);
    const inst = instruments.find(i => i.id === id);
    if (inst) {
      const nextDate = calculateNextVerification(verificationDate, inst.intervalMonths);
      setNextVerificationDate(nextDate || '');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('pdf') && !file.type.includes('word') && !file.name.endsWith('.docx')) {
      notification.error('Ошибка', 'Поддерживаются только PDF и DOCX файлы');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setProtocolFile({ name: file.name, data: event.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!deviceId || !operatorId || !verificationDate) {
      playError();
      notification.error('Ошибка', 'Заполните все обязательные поля');
      return;
    }

    const inst = instruments.find(i => i.id === deviceId);
    if (!inst) return;

    if (inst.status === 'decommissioned') {
      playError();
      notification.error('Ошибка', 'Нельзя зарегистрировать поверку для списанного СИ');
      return;
    }

    try {
      // Создаём упрощённый протокол
      const protocolId = uuidv4();
      const protocol: Omit<VerificationProtocol, 'id' | 'createdAt' | 'updatedAt'> = {
        deviceId,
        instrumentInventoryNumber: inst.inventoryNumber,
        instrumentName: inst.name,
        operatorId,
        dateStart: verificationDate,
        dateEnd: verificationDate,
        status: 'completed',
        result,
        points: [
          {
            id: uuidv4(),
            name: nextVerificationDate,
            nominal: 0,
            unit: '',
            tolerance: 0,
            actual: 0,
            error: 0,
            verdict: result,
          }
        ],
        notes: protocolNumber || undefined,
      };

      // Сохраняем файл в IndexedDB если есть
      if (protocolFile) {
        await indexedDBCache.cacheCard(`protocol:${protocolId}:file`, protocolFile);
      }

      // Добавляем протокол
      const newProtocol = store.addProtocol(protocol);

      // Если это возврат с поверки, связываем с отправкой
      if (prefillSendoffId) {
        completeSendoff(prefillSendoffId, newProtocol.id, userId || '');
      }

      // Обновляем жизненный цикл СИ
      if (result === 'pass') {
        store.updateInstrument(deviceId, {
          status: 'available',
          lastVerificationDate: verificationDate,
          nextVerificationDate: nextVerificationDate || null,
        });
      } else {
        store.updateInstrument(deviceId, { status: 'repair' });
      }

      // Записываем в OperationLog
      store.addOperation({
        userId: userId || '',
        action: result === 'pass' ? 'return' : 'update',
        entityType: 'protocol',
        entityId: newProtocol.id,
        details: `Зарегистрирована поверка ${inst.inventoryNumber}: ${result === 'pass' ? 'ГОДЕН' : 'НЕ ГОДЕН'}`,
      });

      // Показываем чек-лист
      const statusText = result === 'pass' ? 'доступно' : 'ремонт';
      notification.success(
        'Поверка зарегистрирована',
        `Протокол ${protocolNumber || '№' + newProtocol.id.substring(0, 8)} зарегистрирован. СИ ${inst.name} переведён в статус "${statusText}". Следующая поверка: ${formatDate(nextVerificationDate)}`
      );

      playSuccess();
      onSave();
    } catch (err: any) {
      playError();
      notification.error('Ошибка', err instanceof Error ? err.message : 'Не удалось зарегистрировать');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className={`w-full max-w-2xl rounded-xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} max-h-[95vh] overflow-y-auto my-4`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><ClipboardCheck size={24} className="text-cyan-400" />Регистрация поверки</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700/30"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          {/* Выбор СИ */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2"><FileText size={16} className="text-cyan-400" />Средство измерений *</label>
            <select value={deviceId} onChange={e => handleInstrumentChange(e.target.value)} className={inputClass}>
              <option value="">— Выберите СИ —</option>
              {instruments.filter(i => i.status !== 'decommissioned').map(i => (
                <option key={i.id} value={i.id}>{i.inventoryNumber} — {i.name}</option>
              ))}
            </select>
          </div>

          {/* Дата поверки */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2"><Calendar size={16} className="text-cyan-400" />Дата поверки *</label>
            <input type="date" value={verificationDate} onChange={e => setVerificationDate(e.target.value)} className={inputClass} />
          </div>

          {/* Поверитель */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2"><User size={16} className="text-cyan-400" />Поверитель *</label>
            <select value={operatorId} onChange={e => setOperatorId(e.target.value)} className={inputClass}>
              <option value="">— Выберите поверителя —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
            </select>
          </div>

          {/* Вердикт */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">Вердикт *</label>
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-colors ${result === 'pass' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-slate-600 bg-slate-700/50 text-slate-400'}`}>
                <input type="radio" name="result" value="pass" checked={result === 'pass'} onChange={e => setResult(e.target.value as any)} className="hidden" />
                <CheckCircle size={20} /><span className="font-medium">ГОДЕН</span>
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-colors ${result === 'fail' ? 'border-red-500 bg-red-500/20 text-red-400' : 'border-slate-600 bg-slate-700/50 text-slate-400'}`}>
                <input type="radio" name="result" value="fail" checked={result === 'fail'} onChange={e => setResult(e.target.value as any)} className="hidden" />
                <XCircle size={20} /><span className="font-medium">НЕ ГОДЕН</span>
              </label>
            </div>
          </div>

          {/* Номер протокола */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2"><Hash size={16} className="text-cyan-400" />Номер протокола</label>
            <input type="text" value={protocolNumber} onChange={e => setProtocolNumber(e.target.value)} className={inputClass} placeholder="Например: ПП-2024-001" />
          </div>

          {/* Загрузка файла */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2"><Upload size={16} className="text-cyan-400" />Файл протокола (PDF/DOCX)</label>
            <div className={`border-2 border-dashed rounded-lg p-6 text-center ${protocolFile ? 'border-cyan-500 bg-cyan-500/10' : isDark ? 'border-slate-600 bg-slate-700/30' : 'border-slate-300 bg-slate-50'}`}>
              {protocolFile ? (
                <div>
                  <p className="text-sm font-medium text-cyan-400 mb-2">{protocolFile.name}</p>
                  <button onClick={() => setProtocolFile(null)} className="text-xs text-red-400 hover:text-red-300">Удалить файл</button>
                </div>
              ) : (
                <div>
                  <Upload size={32} className="mx-auto mb-2 text-slate-400" />
                  <p className="text-sm text-slate-400 mb-2">Перетащите файл сюда или</p>
                  <label className="inline-block px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 cursor-pointer">
                    Выбрать файл
                    <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Дата следующей поверки */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2"><Calendar size={16} className="text-cyan-400" />Дата следующей поверки</label>
            <input type="date" value={nextVerificationDate} onChange={e => setNextVerificationDate(e.target.value)} className={inputClass} />
            {selectedInstrument && <p className="text-xs text-slate-500 mt-1">Авто: {formatDate(calculateNextVerification(verificationDate, selectedInstrument.intervalMonths))} (МПИ: {selectedInstrument.intervalMonths} мес.)</p>}
          </div>

          {/* Комментарий */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2"><MessageSquare size={16} className="text-cyan-400" />Комментарий</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} className={`${inputClass} resize-none`} rows={3} placeholder="Дополнительная информация..." />
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
          <button onClick={handleSave} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600"><Save size={16} />Зарегистрировать</button>
          <button onClick={onClose} className="flex-1 py-3 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600">Отмена</button>
        </div>
      </div>
    </div>
  );
}

// === Просмотр зарегистрированной поверки ===

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
      <div className={`w-full max-w-2xl rounded-xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} max-h-[95vh] overflow-y-auto my-4`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><Eye size={24} className="text-cyan-400" />Зарегистрированная поверка</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700/30"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div className={`rounded-lg p-4 ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-slate-400">СИ</p><p className="font-mono text-cyan-400">{protocol.instrumentInventoryNumber}</p><p className="font-medium">{protocol.instrumentName}</p></div>
              <div><p className="text-xs text-slate-400">Поверитель</p><p className="font-medium">{emp?.fullName || '—'}</p></div>
              <div><p className="text-xs text-slate-400">Дата поверки</p><p className="font-medium">{formatDate(protocol.dateEnd || protocol.dateStart)}</p></div>
              <div><p className="text-xs text-slate-400">Следующая поверка</p><p className="font-medium">{protocol.points[0]?.name ? formatDate(protocol.points[0].name) : '—'}</p></div>
            </div>
          </div>

          {protocol.result && (
            <div className={`rounded-lg p-4 border-2 ${protocol.result === 'pass' ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-red-500/50 bg-red-500/10'}`}>
              <div className="flex items-center gap-3">
                {protocol.result === 'pass' ? <CheckCircle size={32} className="text-emerald-400" /> : <XCircle size={32} className="text-red-400" />}
                <div><p className="text-lg font-bold">{protocol.result === 'pass' ? 'СИ ГОДЕН' : 'СИ НЕ ГОДЕН'}</p><p className="text-sm text-slate-400">Результат поверки</p></div>
              </div>
            </div>
          )}

          {protocol.notes && (
            <div className={`rounded-lg p-4 ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
              <p className="text-sm font-medium mb-1">Номер протокола:</p>
              <p className="text-sm text-slate-300">{protocol.notes}</p>
            </div>
          )}

          {protocol.rejectionReason && (
            <div className="rounded-lg p-4 border border-red-500/30 bg-red-500/10">
              <p className="text-sm font-medium text-red-400 mb-1">Причина отклонения:</p>
              <p className="text-sm text-slate-300">{protocol.rejectionReason}</p>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-700 flex gap-3">
          <button onClick={onPrint} className="flex-1 flex items-center justify-center gap-2 py-3 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600"><Printer size={16} />Печать</button>
          <button onClick={onClose} className="flex-1 py-3 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600">Закрыть</button>
        </div>
      </div>
    </div>
  );
}

// === Печатная форма ===

interface RegistrationPrintViewProps {
  protocol: VerificationProtocol;
  employees: { id: string; fullName: string }[];
}

function RegistrationPrintView({ protocol, employees }: RegistrationPrintViewProps) {
  const operator = employees.find(e => e.id === protocol.operatorId);

  return (
    <div className="print-view bg-white text-black p-8 max-w-[210mm] mx-auto">
      <div className="text-center mb-6 border-b-2 border-black pb-4">
        <h1 className="text-2xl font-bold">ПРОТОКОЛ РЕГИСТРАЦИИ ПОВЕРКИ</h1>
        <p className="text-sm mt-2">№ {protocol.notes || protocol.id.substring(0, 8).toUpperCase()}</p>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 border-b border-gray-300 pb-1">1. Сведения о средстве измерений</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr><td className="py-1 font-semibold w-1/3">Инвентарный номер:</td><td className="py-1">{protocol.instrumentInventoryNumber}</td></tr>
            <tr><td className="py-1 font-semibold">Наименование:</td><td className="py-1">{protocol.instrumentName}</td></tr>
            <tr><td className="py-1 font-semibold">Дата поверки:</td><td className="py-1">{formatDate(protocol.dateEnd || protocol.dateStart)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 border-b border-gray-300 pb-1">2. Поверитель</h2>
        <p className="text-sm">{operator?.fullName || '—'}</p>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 border-b border-gray-300 pb-1">3. Результат поверки</h2>
        <div className={`p-4 border-2 ${protocol.result === 'pass' ? 'border-green-600 bg-green-50' : 'border-red-600 bg-red-50'}`}>
          <p className="text-lg font-bold text-center">
            {protocol.result === 'pass' ? 'СРЕДСТВО ИЗМЕРЕНИЙ ГОДНО К ПРИМЕНЕНИЮ' : 'СРЕДСТВО ИЗМЕРЕНИЙ НЕ ГОДНО К ПРИМЕНЕНИЮ'}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 border-b border-gray-300 pb-1">4. Следующая поверка</h2>
        <p className="text-sm">{protocol.points[0]?.name ? formatDate(protocol.points[0].name) : '—'}</p>
      </div>

      <div className="mt-12 grid grid-cols-2 gap-8">
        <div>
          <p className="text-sm font-semibold mb-8">Поверитель:</p>
          <div className="border-b border-black mb-1"></div>
          <p className="text-xs text-center">{operator?.fullName || '—'}</p>
        </div>
        <div>
          <p className="text-sm font-semibold mb-8">Дата:</p>
          <div className="border-b border-black mb-1"></div>
          <p className="text-xs text-center">{formatDate(protocol.dateEnd || protocol.dateStart)}</p>
        </div>
      </div>
    </div>
  );
}
