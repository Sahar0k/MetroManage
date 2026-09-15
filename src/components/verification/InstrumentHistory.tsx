import { useMemo } from 'react';
import { store } from '../../store';
import { MeasuringInstrument, VerificationProtocol, IssueRecord, OperationLog } from '../../types';
import { formatDateTime } from '../../utils/domain';
import { CheckCircle, XCircle, ArrowRightLeft, FileText, Clock, AlertTriangle } from 'lucide-react';

interface InstrumentHistoryProps {
  instrument: MeasuringInstrument;
  isDark: boolean;
  onViewProtocol?: (protocol: VerificationProtocol) => void;
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'protocol_created' | 'protocol_started' | 'protocol_completed' | 'protocol_rejected' | 'issue' | 'return' | 'operation';
  title: string;
  description: string;
  icon: any;
  color: string;
  protocolId?: string;
}

export default function InstrumentHistory({ instrument, isDark, onViewProtocol }: InstrumentHistoryProps) {
  const events = useMemo(() => {
    const allEvents: TimelineEvent[] = [];

    // Протоколы поверок
    const protocols = store.getProtocols().filter(p => p.deviceId === instrument.id);
    protocols.forEach(protocol => {
      // Создание протокола
      allEvents.push({
        id: `${protocol.id}-created`,
        timestamp: protocol.createdAt,
        type: 'protocol_created',
        title: 'Создан протокол поверки',
        description: `Протокол №${protocol.instrumentInventoryNumber}`,
        icon: FileText,
        color: 'bg-blue-500/20 text-blue-400',
        protocolId: protocol.id,
      });

      // Начало поверки
      if (protocol.status === 'in_progress' || protocol.status === 'completed') {
        allEvents.push({
          id: `${protocol.id}-started`,
          timestamp: protocol.dateStart,
          type: 'protocol_started',
          title: 'Начата поверка',
          description: `Поверитель: ${store.getEmployees().find(e => e.id === protocol.operatorId)?.fullName || '—'}`,
          icon: Clock,
          color: 'bg-cyan-500/20 text-cyan-400',
          protocolId: protocol.id,
        });
      }

      // Завершение поверки
      if (protocol.status === 'completed' && protocol.dateEnd) {
        allEvents.push({
          id: `${protocol.id}-completed`,
          timestamp: protocol.dateEnd,
          type: 'protocol_completed',
          title: protocol.result === 'pass' ? 'Поверка завершена: ГОДЕН' : 'Поверка завершена: НЕ ГОДЕН',
          description: `Результат: ${protocol.result === 'pass' ? 'СИ соответствует требованиям' : 'СИ не соответствует требованиям'}`,
          icon: protocol.result === 'pass' ? CheckCircle : XCircle,
          color: protocol.result === 'pass' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400',
          protocolId: protocol.id,
        });
      }

      // Отклонение
      if (protocol.status === 'rejected') {
        allEvents.push({
          id: `${protocol.id}-rejected`,
          timestamp: protocol.updatedAt,
          type: 'protocol_rejected',
          title: 'Протокол отклонён',
          description: protocol.rejectionReason || 'Причина не указана',
          icon: AlertTriangle,
          color: 'bg-red-500/20 text-red-400',
          protocolId: protocol.id,
        });
      }
    });

    // Выдачи и возвраты
    const issues = store.getIssues().filter(i => i.instrumentId === instrument.id);
    issues.forEach(issue => {
      // Выдача
      allEvents.push({
        id: `${issue.id}-issued`,
        timestamp: issue.issuedAt,
        type: 'issue',
        title: 'СИ выдано',
        description: `Получатель: ${store.getEmployees().find(e => e.id === issue.employeeId)?.fullName || '—'}`,
        icon: ArrowRightLeft,
        color: 'bg-purple-500/20 text-purple-400',
      });

      // Возврат
      if (issue.returnedAt) {
        allEvents.push({
          id: `${issue.id}-returned`,
          timestamp: issue.returnedAt,
          type: 'return',
          title: 'СИ возвращено',
          description: `Принял: ${store.getUsers().find(u => u.id === issue.returnedBy)?.fullName || '—'}`,
          icon: ArrowRightLeft,
          color: 'bg-emerald-500/20 text-emerald-400',
        });
      }
    });

    // Операции из журнала
    const operations = store.getOperations().filter(op => op.entityId === instrument.id);
    operations.forEach(op => {
      allEvents.push({
        id: op.id,
        timestamp: op.timestamp,
        type: 'operation',
        title: op.action === 'create' ? 'СИ создано' : op.action === 'update' ? 'СИ обновлено' : op.action === 'delete' ? 'СИ удалено' : 'Операция',
        description: op.details,
        icon: FileText,
        color: 'bg-slate-500/20 text-slate-400',
      });
    });

    // Сортировка по дате (новые сверху)
    return allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [instrument.id]);

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <FileText size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">История пуста</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event, index) => {
        const Icon = event.icon;
        return (
          <div key={event.id} className="relative flex gap-3">
            {/* Вертикальная линия */}
            {index < events.length - 1 && (
              <div className="absolute left-5 top-10 bottom-0 w-px bg-slate-700" />
            )}
            {/* Иконка */}
            <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${event.color}`}>
              <Icon size={18} />
            </div>
            {/* Контент */}
            <div className="flex-1 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-medium text-sm">{event.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{event.description}</p>
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap">{formatDateTime(event.timestamp)}</span>
              </div>
              {event.protocolId && onViewProtocol && (
                <button onClick={() => {
                  const protocol = store.getProtocols().find(p => p.id === event.protocolId);
                  if (protocol) onViewProtocol(protocol);
                }} className="text-xs text-cyan-400 hover:text-cyan-300 mt-1">
                  Открыть протокол →
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
