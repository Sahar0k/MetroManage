import { useState, useCallback } from 'react';
import type { Warehouse } from '../../../types';
import { wizardStore } from '../wizardStore';
import type { StepId } from '../types';

interface LogisticsStepProps {
  warehouses: Warehouse[];
  mpiFromGosreestr?: number | null;
  onBack: () => void;
  onNext: (step: StepId) => void;
}

export function LogisticsStep({ warehouses, mpiFromGosreestr, onBack, onNext }: LogisticsStepProps) {
  const draft = wizardStore.getDraft();
  const [status, setStatus] = useState(draft.status);
  const [warehouseId, setWarehouseId] = useState<string>(draft.warehouseId || warehouses[0]?.id || '');
  const [location, setLocation] = useState(draft.location);
  const [lastVerificationDate, setLastVerificationDate] = useState(draft.lastVerificationDate);
  const [intervalMonths, setIntervalMonths] = useState(
    String(draft.intervalMonths)
  );

  // Считаем текущее значение как число для сравнения
  const currentInterval = parseInt(intervalMonths, 10) || 12;
  const mpiDiffers = mpiFromGosreestr !== null && currentInterval !== mpiFromGosreestr;

  const persist = (patch: Record<string, unknown>) => {
    wizardStore.patchDraft(patch);
  };

  const handleWarehouseChange = (val: string) => {
    setWarehouseId(val);
    persist({ warehouseId: val || null });
  };

  const handleIntervalChange = (val: string) => {
    setIntervalMonths(val);
    persist({ intervalMonths: parseInt(val, 10) || 12 });
  };

  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      wizardStore.patchDraft({ photo: dataUrl });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleNext = () => {
    wizardStore.patchDraft({
      status,
      warehouseId: warehouseId || null,
      location,
      lastVerificationDate,
      intervalMonths: currentInterval,
    });
    onNext('review');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">Логистика</h3>
        <p className="text-xs text-slate-400">Статус, склад, дата и интервал поверки</p>
      </div>

      {/* Status */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Статус</label>
        <select
          value={status}
          onChange={e => { setStatus(e.target.value as typeof status); }}
          className={`w-full px-3 py-2 rounded-lg text-sm border ${
            'bg-slate-800 border-slate-700 text-white'
          } focus:outline-none focus:ring-2 focus:ring-cyan-500`}
        >
          <option value="available">Доступно</option>
          <option value="issued">Выдано</option>
          <option value="verification">На поверке</option>
          <option value="repair">Ремонт</option>
          <option value="decommissioned">Списано</option>
        </select>
      </div>

      {/* Warehouse */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Склад</label>
        <select
          value={warehouseId}
          onChange={e => handleWarehouseChange(e.target.value)}
          className={`w-full px-3 py-2 rounded-lg text-sm border ${
            'bg-slate-800 border-slate-700 text-white'
          } focus:outline-none focus:ring-2 focus:ring-cyan-500`}
        >
          <option value="">— Не указан —</option>
          {warehouses.map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      {/* Location */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Местоположение</label>
        <input
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="Например: Корпус А, кабинет 205"
          className={`w-full px-3 py-2 rounded-lg text-sm border ${
            'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
          } focus:outline-none focus:ring-2 focus:ring-cyan-500`}
        />
      </div>

      {/* Verification dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Дата последней поверки</label>
          <input
            type="date"
            value={lastVerificationDate}
            onChange={e => setLastVerificationDate(e.target.value)}
            className={`w-full px-3 py-2 rounded-lg text-sm border ${
              'bg-slate-800 border-slate-700 text-white'
            } focus:outline-none focus:ring-2 focus:ring-cyan-500`}
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Интервал поверки (мес.)</label>
          <input
            type="number"
            min={1}
            max={120}
            value={intervalMonths}
            onChange={e => handleIntervalChange(e.target.value)}
            className={`w-full px-3 py-2 rounded-lg text-sm border ${
              mpiDiffers
                ? 'border-amber-500 bg-amber-500/10 text-white'
                : 'bg-slate-800 border-slate-700 text-white'
            } focus:outline-none focus:ring-2 focus:ring-cyan-500`}
          />
          {mpiDiffers && (
            <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
              ⚠ Отличается от МПИ Госреестра ({mpiFromGosreestr} мес.)
            </p>
          )}
        </div>
      </div>

      {/* Photo upload */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Фото прибора</label>
        <input
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          className={`w-full px-3 py-2 rounded-lg text-sm border ${
            'bg-slate-800 border-slate-700 text-white'
          } focus:outline-none focus:ring-2 focus:ring-cyan-500`}
        />
        {draft.photo && (
          <img src={draft.photo} alt="Preview" className="w-24 h-24 object-cover rounded-lg mt-2" />
        )}
      </div>

      {/* Nav */}
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-2.5 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors">
          ← Назад
        </button>
        <button
          onClick={handleNext}
          className="flex-1 py-2.5 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 disabled:!bg-slate-700/50 disabled:!text-slate-400 disabled:cursor-not-allowed transition-colors"
        >
          Далее → Проверка
        </button>
      </div>
    </div>
  );
}
