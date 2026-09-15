import { VerificationProtocol, VerificationPoint } from '../../types';
import { Trash2 } from 'lucide-react';

interface PointsTableProps {
  points: Array<VerificationPoint | Omit<VerificationPoint, 'id'>>;
  editable: boolean;
  isDark: boolean;
  onUpdatePoint: (index: number, updates: Partial<VerificationPoint>) => void;
  onRemovePoint: (index: number) => void;
  inputClass: string;
}

export default function PointsTable({ points, editable, isDark, onUpdatePoint, onRemovePoint, inputClass }: PointsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead className={isDark ? 'bg-slate-700' : 'bg-slate-100'}>
          <tr>
            <th className="text-left px-3 py-2 font-medium">Название</th>
            <th className="text-left px-3 py-2 font-medium">Номинал</th>
            <th className="text-left px-3 py-2 font-medium">Ед. изм.</th>
            <th className="text-left px-3 py-2 font-medium">Допуск</th>
            <th className="text-left px-3 py-2 font-medium">Факт.</th>
            <th className="text-left px-3 py-2 font-medium">Погрешн.</th>
            <th className="text-left px-3 py-2 font-medium">Вердикт</th>
            {editable && <th className="px-3 py-2"></th>}
          </tr>
        </thead>
        <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-200'}`}>
          {points.map((point, index) => (
            <tr key={index}>
              <td className="px-3 py-2">
                {editable ? (
                  <input value={point.name} onChange={e => onUpdatePoint(index, { name: e.target.value })} className={`${inputClass} py-2 text-sm`} placeholder="Напр. 100 В" />
                ) : (
                  <span>{point.name}</span>
                )}
              </td>
              <td className="px-3 py-2">
                {editable ? (
                  <input type="number" step="any" value={point.nominal} onChange={e => onUpdatePoint(index, { nominal: parseFloat(e.target.value) || 0 })} className={`${inputClass} py-2 text-sm w-24`} />
                ) : (
                  <span>{point.nominal}</span>
                )}
              </td>
              <td className="px-3 py-2">
                {editable ? (
                  <input value={point.unit} onChange={e => onUpdatePoint(index, { unit: e.target.value })} className={`${inputClass} py-2 text-sm w-20`} placeholder="В" />
                ) : (
                  <span>{point.unit}</span>
                )}
              </td>
              <td className="px-3 py-2">
                {editable ? (
                  <input type="number" step="any" value={point.tolerance} onChange={e => onUpdatePoint(index, { tolerance: parseFloat(e.target.value) || 0 })} className={`${inputClass} py-2 text-sm w-24`} />
                ) : (
                  <span>{point.tolerance}</span>
                )}
              </td>
              <td className="px-3 py-2">
                {editable ? (
                  <input type="number" step="any" value={'actual' in point ? (point.actual ?? '') : ''} onChange={e => onUpdatePoint(index, { actual: parseFloat(e.target.value) || 0 } as any)} className={`${inputClass} py-2 text-sm w-24`} placeholder="—" />
                ) : (
                  <span>{'actual' in point && point.actual !== undefined ? point.actual : '—'}</span>
                )}
              </td>
              <td className="px-3 py-2 text-slate-400">
                {'error' in point && point.error !== undefined ? point.error.toFixed(4) : '—'}
              </td>
              <td className="px-3 py-2">
                {'verdict' in point && point.verdict === 'pass' && <span className="px-2 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400">ГОДЕН</span>}
                {'verdict' in point && point.verdict === 'fail' && <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400">НЕ ГОДЕН</span>}
                {(!('verdict' in point) || !point.verdict) && <span className="text-xs text-slate-500">—</span>}
              </td>
              {editable && (
                <td className="px-3 py-2">
                  <button onClick={() => onRemovePoint(index)} className="p-1 text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
