import { Thermometer, Droplets, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface ConditionsBlockProps {
  conditions: { temperature?: number; humidity?: number };
  editable: boolean;
  isDark: boolean;
  onChange: (conditions: { temperature?: number; humidity?: number }) => void;
  inputClass: string;
}

export default function ConditionsBlock({ conditions, editable, isDark, onChange, inputClass }: ConditionsBlockProps) {
  const [showConditions, setShowConditions] = useState(false);

  return (
    <div className={`rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
      <button onClick={() => setShowConditions(!showConditions)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="font-medium flex items-center gap-2"><Thermometer size={16} className="text-cyan-400" />Влияющие величины</span>
        {showConditions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {showConditions && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1"><Thermometer size={12} />Температура (°C)</label>
            {editable ? (
              <input type="number" step="0.1" value={conditions.temperature || ''} onChange={e => onChange({ ...conditions, temperature: parseFloat(e.target.value) || undefined })} className={inputClass} placeholder="20.0" />
            ) : (
              <p className="text-sm font-medium">{conditions.temperature ? `${conditions.temperature} °C` : '—'}</p>
            )}
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1"><Droplets size={12} />Влажность (%)</label>
            {editable ? (
              <input type="number" step="0.1" value={conditions.humidity || ''} onChange={e => onChange({ ...conditions, humidity: parseFloat(e.target.value) || undefined })} className={inputClass} placeholder="60.0" />
            ) : (
              <p className="text-sm font-medium">{conditions.humidity ? `${conditions.humidity} %` : '—'}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
