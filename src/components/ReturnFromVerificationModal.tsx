import { useState, useMemo } from 'react';
import { MeasuringInstrument } from '../types';
import { store } from '../store';
import { useNotification } from '../contexts/NotificationContext';
import { playSuccess, playError } from '../utils/audio';
import { X, Calendar, CheckCircle, XCircle, Upload, FileText } from 'lucide-react';
import { calculateNextVerification } from '../utils/domain';
import { completeSendoff, getActiveSendoff } from '../services/verificationFlowService';
import { indexedDBCache } from '../services/indexedDBCache';

interface ReturnFromVerificationModalProps {
  instrument: MeasuringInstrument;
  userId: string | null;
  isDark: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReturnFromVerificationModal({ instrument, userId, isDark, onClose, onSuccess }: ReturnFromVerificationModalProps) {
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [verdict, setVerdict] = useState<'pass' | 'fail'>('pass');
  const [verificationDate, setVerificationDate] = useState(new Date().toISOString().split('T')[0]);
  const [nextVerificationDate, setNextVerificationDate] = useState('');
  const [protocolFile, setProtocolFile] = useState<{ name: string; data: string } | null>(null);
  const [comment, setComment] = useState('');

  const notification = useNotification();
  const inputClass = `w-full px-4 py-3 rounded-lg text-base ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900'} border focus:outline-none focus:ring-2 focus:ring-cyan-500`;

  const activeSendoff = useMemo(() => getActiveSendoff(instrument.id), [instrument.id]);

  // Автоматически рассчитываем следующую дату поверки при изменении даты поверки
  useMemo(() => {
    if (verificationDate) {
      const nextDate = calculateNextVerification(verificationDate, instrument.intervalMonths);
      setNextVerificationDate(nextDate || '');
    }
  }, [verificationDate, instrument.intervalMonths]);

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

  const handleSubmit = async () => {
    if (!userId) {
      playError();
      notification.error('Ошибка', 'Необходима авторизация');
      return;
    }

    if (!activeSendoff) {
      playError();
      notification.error('Ошибка', 'Активная отправка не найдена');
      return;
    }

    try {
      // Сохраняем файл протокола в IndexedDB если есть
      if (protocolFile) {
        await indexedDBCache.cacheCard(`protocol:${activeSendoff.id}:file`, protocolFile);
      }

      // Обновляем отправку
      completeSendoff(activeSendoff.id, `protocol-${Date.now()}`, userId);

      // Обновляем жизненный цикл СИ
      if (verdict === 'pass') {
        store.updateInstrument(instrument.id, {
          status: 'available',
          lastVerificationDate: verificationDate,
          nextVerificationDate: nextVerificationDate || null,
        });
      } else {
        store.updateInstrument(instrument.id, {
          status: 'repair',
        });
      }

      // Записываем в OperationLog
      store.addOperation({
        userId,
        action: 'return',
        entityType: 'instrument',
        entityId: instrument.id,
        details: `Возврат с поверки: ${verdict === 'pass' ? 'ГОДЕН' : 'НЕ ГОДЕН'}`,
      });

      // Уведомления
      if (verdict === 'pass') {
        playSuccess();
        notification.success(
          'Прибор возвращён',
          `${instrument.inventoryNumber} годен. Следующая поверка: ${nextVerificationDate ? new Date(nextVerificationDate).toLocaleDateString('ru-RU') : 'не указана'}`
        );
      } else {
        playError();
        notification.warning(
          'Прибор НЕ ГОДЕН',
          `${instrument.inventoryNumber} переведён в ремонт`
        );
      }

      onSuccess();
      onClose();
    } catch (error) {
      playError();
      notification.error('Ошибка', error instanceof Error ? error.message : 'Не удалось завершить возврат');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className={`w-full max-w-2xl rounded-xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} max-h-[95vh] overflow-y-auto my-4`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar size={24} className="text-cyan-400" />
            Возврат с поверки
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700/30"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          {/* Информация о приборе */}
          <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
            <p className="text-xs text-slate-400 mb-1">Прибор</p>
            <p className="font-mono text-cyan-400">{instrument.inventoryNumber}</p>
            <p className="font-medium">{instrument.name}</p>
            {activeSendoff && (
              <div className="mt-2 text-sm text-slate-400">
                <p>Отправлен: {new Date(activeSendoff.sentAt).toLocaleDateString('ru-RU')}</p>
                <p>Место поверки: {activeSendoff.destination}</p>
              </div>
            )}
          </div>

          {/* Дата возврата */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <Calendar size={16} className="text-cyan-400" />
              Дата возврата *
            </label>
            <input
              type="date"
              value={returnDate}
              onChange={e => setReturnDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Вердикт */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">Вердикт *</label>
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-colors ${verdict === 'pass' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-slate-600 bg-slate-700/50 text-slate-400'}`}>
                <input type="radio" name="verdict" value="pass" checked={verdict === 'pass'} onChange={e => setVerdict(e.target.value as any)} className="hidden" />
                <CheckCircle size={20} />
                <span className="font-medium">ГОДЕН</span>
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 cursor-pointer transition-colors ${verdict === 'fail' ? 'border-red-500 bg-red-500/20 text-red-400' : 'border-slate-600 bg-slate-700/50 text-slate-400'}`}>
                <input type="radio" name="verdict" value="fail" checked={verdict === 'fail'} onChange={e => setVerdict(e.target.value as any)} className="hidden" />
                <XCircle size={20} />
                <span className="font-medium">НЕ ГОДЕН</span>
              </label>
            </div>
          </div>

          {/* Дата поверки */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <Calendar size={16} className="text-cyan-400" />
              Дата поверки *
            </label>
            <input
              type="date"
              value={verificationDate}
              onChange={e => setVerificationDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Следующая дата поверки */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <Calendar size={16} className="text-cyan-400" />
              Следующая поверка
            </label>
            <input
              type="date"
              value={nextVerificationDate}
              onChange={e => setNextVerificationDate(e.target.value)}
              className={inputClass}
            />
            <p className="text-xs text-slate-500 mt-1">
              Авто: {nextVerificationDate ? new Date(nextVerificationDate).toLocaleDateString('ru-RU') : '—'} (МПИ: {instrument.intervalMonths} мес.)
            </p>
          </div>

          {/* Файл протокола */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <FileText size={16} className="text-cyan-400" />
              Файл протокола (опционально)
            </label>
            <div className={`border-2 border-dashed rounded-lg p-6 text-center ${protocolFile ? 'border-cyan-500 bg-cyan-500/10' : isDark ? 'border-slate-600 bg-slate-700/30' : 'border-slate-300 bg-slate-50'}`}>
              {protocolFile ? (
                <div>
                  <p className="text-sm font-medium text-cyan-400 mb-2">{protocolFile.name}</p>
                  <button onClick={() => setProtocolFile(null)} className="text-xs text-red-400 hover:text-red-300">
                    Удалить файл
                  </button>
                </div>
              ) : (
                <div>
                  <Upload size={32} className="mx-auto mb-2 text-slate-400" />
                  <p className="text-sm text-slate-400 mb-2">Перетащите файл сюда или</p>
                  <label className="inline-block px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 cursor-pointer">
                    Выбрать файл
                    <input
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Комментарий */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">Комментарий</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              className={`${inputClass} resize-none`}
              rows={3}
              placeholder="Дополнительная информация..."
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
          <button
            onClick={handleSubmit}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600"
          >
            <CheckCircle size={16} />
            Завершить возврат
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
