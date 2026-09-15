import { useEffect, useRef } from 'react';
import { MeasuringInstrument } from '../types';
import { FileText, ArrowRightLeft, Edit2, Trash2 } from 'lucide-react';

interface SearchContextMenuProps {
  instrument: MeasuringInstrument;
  position: { x: number; y: number };
  onClose: () => void;
  onViewCard: (instrument: MeasuringInstrument) => void;
  onIssue: (instrument: MeasuringInstrument) => void;
  onReturn: (instrument: MeasuringInstrument) => void;
  onEdit: (instrument: MeasuringInstrument) => void;
  onDelete: (instrument: MeasuringInstrument) => void;
}

export default function SearchContextMenu({ instrument, position, onClose, onViewCard, onIssue, onReturn, onEdit, onDelete }: SearchContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose(); };
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => { document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('keydown', handleEscape); };
  }, [onClose]);

  const menuItems = [
    { icon: FileText, label: 'Открыть карточку', action: () => onViewCard(instrument), color: 'text-cyan-400' },
    ...(instrument.status === 'available' ? [{ icon: ArrowRightLeft, label: 'Выдать прибор', action: () => onIssue(instrument), color: 'text-emerald-400' }] : []),
    ...(instrument.status === 'issued' ? [{ icon: ArrowRightLeft, label: 'Вернуть прибор', action: () => onReturn(instrument), color: 'text-amber-400' }] : []),
    { icon: Edit2, label: 'Редактировать', action: () => onEdit(instrument), color: 'text-blue-400' },
    { icon: Trash2, label: 'Удалить', action: () => onDelete(instrument), color: 'text-red-400' }
  ];

  return (
    <div ref={menuRef} className="fixed z-[100] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-2 min-w-[200px]" style={{ left: `${position.x}px`, top: `${position.y}px` }}>
      <div className="px-3 py-2 border-b border-slate-700 mb-1">
        <p className="text-xs text-slate-400">Инв. №{instrument.inventoryNumber}</p>
        <p className="text-sm font-medium text-white truncate">{instrument.name}</p>
      </div>
      {menuItems.map((item, index) => (
        <button key={index} onClick={() => { item.action(); onClose(); }} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-700 transition-colors text-left">
          <item.icon size={16} className={item.color} /><span className="text-sm text-slate-200">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
