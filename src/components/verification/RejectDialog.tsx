import { XCircle, X } from 'lucide-react';

interface RejectDialogProps {
  isDark: boolean;
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  inputClass: string;
}

export default function RejectDialog({ isDark, reason, onReasonChange, onConfirm, onCancel, inputClass }: RejectDialogProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4">
      <div className={`rounded-xl p-6 max-w-md w-full ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2"><XCircle size={20} className="text-red-400" />Отклонить протокол</h3>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-slate-700/30"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-slate-400 mb-1 block">Причина отклонения *</label>
            <textarea value={reason} onChange={e => onReasonChange(e.target.value)} className={`${inputClass} resize-none`} rows={4} placeholder="Укажите причину отклонения протокола..." />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onConfirm} disabled={!reason.trim()} className="flex-1 py-3 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50">Отклонить</button>
          <button onClick={onCancel} className="flex-1 py-3 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600">Отмена</button>
        </div>
      </div>
    </div>
  );
}
