import { MeasuringInstrument } from '../types';
import { X, Trash2, ArrowRightLeft, AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  type: 'delete' | 'issue' | 'return';
  instrument: MeasuringInstrument;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ type, instrument, onConfirm, onCancel }: ConfirmDialogProps) {
  const config = {
    delete: { icon: Trash2, title: 'Удалить прибор?', description: 'Это действие нельзя отменить.', confirmText: 'Удалить', confirmColor: 'bg-red-500 hover:bg-red-600', iconBg: 'bg-red-500/20', iconColor: 'text-red-400' },
    issue: { icon: ArrowRightLeft, title: 'Выдать прибор?', description: 'Прибор будет отмечен как выданный.', confirmText: 'Выдать', confirmColor: 'bg-emerald-500 hover:bg-emerald-600', iconBg: 'bg-emerald-500/20', iconColor: 'text-emerald-400' },
    return: { icon: ArrowRightLeft, title: 'Вернуть прибор?', description: 'Прибор будет отмечен как возвращённый.', confirmText: 'Вернуть', confirmColor: 'bg-amber-500 hover:bg-amber-600', iconBg: 'bg-amber-500/20', iconColor: 'text-amber-400' },
  };
  const { icon: Icon, title, description, confirmText, confirmColor, iconBg, iconColor } = config[type];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-800 rounded-xl max-w-md w-full shadow-2xl border border-slate-700">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center`}><Icon size={24} className={iconColor} /></div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-slate-700 transition-colors"><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0"><AlertTriangle size={18} className="text-white" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 font-mono">Инв. №{instrument.inventoryNumber}</p>
                <p className="text-sm font-medium text-white truncate">{instrument.name}</p>
                <p className="text-xs text-slate-400 mt-1">{instrument.category} • {instrument.type}</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-300">{description}</p>
        </div>
        <div className="flex gap-3 p-6 border-t border-slate-700">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 bg-slate-700 text-slate-300 rounded-lg font-medium hover:bg-slate-600 transition-colors">Отмена</button>
          <button onClick={onConfirm} className={`flex-1 px-4 py-2.5 text-white rounded-lg font-medium transition-colors ${confirmColor}`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
