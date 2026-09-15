import React from 'react';
import { X } from 'lucide-react';

interface DataSourceModalProps { isOpen: boolean; onClose: () => void; }

export default function DataSourceModal({ isOpen, onClose }: DataSourceModalProps) {
  if (!isOpen) return null;
  const currentSource = localStorage.getItem('dataSource') || 'localStorage';
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Источник данных</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-700 transition-colors"><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-400">Выберите источник данных:</p>
          <div className="space-y-3">
            <button className={`w-full p-4 rounded-lg border-2 transition-all text-left ${currentSource === 'localStorage' ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700 bg-slate-800 hover:border-slate-600'}`}>
              <h3 className="font-medium text-white mb-1">Локальное хранилище</h3>
              <p className="text-xs text-slate-400">Данные хранятся в браузере.</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
