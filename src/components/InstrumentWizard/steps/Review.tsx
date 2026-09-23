import { useState, useEffect } from 'react';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import type { MeasuringInstrument } from '../../../types';
import { wizardStore } from '../wizardStore';
import type { StepId } from '../types';

interface ReviewStepProps {
  categories: import('../../../types').InstrumentCategory[];
  instruments: MeasuringInstrument[];
  onBack: () => void;
  onCreate: (instrument: Omit<MeasuringInstrument, 'id'>) => void;
}

interface DuplicateInfo {
  match: boolean;
  instrumentId?: string;
  inventoryNumber?: string;
}

export function ReviewStep({ categories, instruments, onBack, onCreate }: ReviewStepProps) {
  const draft = wizardStore.getDraft();
  const [duplicate, setDuplicate] = useState<DuplicateInfo>({ match: false });
  const [categoryFields, setCategoryFields] = useState<Record<string, unknown>>({});

  // Считаем nextVerificationDate
  const calcNextDate = (lastDate: string, interval: number): string | null => {
    if (!lastDate || !interval) return null;
    const d = new Date(lastDate);
    d.setMonth(d.getMonth() + interval);
    return d.toISOString().split('T')[0];
  };

  const mpiFromGosreestr = draft.gosreestrPreview?.intervalMonths ?? null;
  const nextVerificationDate = calcNextDate(draft.lastVerificationDate, draft.intervalMonths);

  // Дубль-guard: модель + серийный
  useEffect(() => {
    const matched = instruments.find(
      i => i.type.toLowerCase() === draft.model.toLowerCase() &&
           i.serialNumber.toLowerCase() === draft.serialNumber.toLowerCase()
    );
    if (matched) {
      setDuplicate({ match: true, instrumentId: matched.id, inventoryNumber: matched.inventoryNumber });
    } else {
      // Проверяем по инв. номеру
      const invMatched = instruments.find(
        i => i.inventoryNumber.toLowerCase() === draft.inventoryNumber.toLowerCase()
      );
      if (invMatched) {
        setDuplicate({ match: true, instrumentId: invMatched.id, inventoryNumber: invMatched.inventoryNumber });
      } else {
        setDuplicate({ match: false });
      }
    }
  }, [draft.model, draft.serialNumber, draft.inventoryNumber, instruments]);

  // Клик по секции → возврат
  const getStepBySection = (sectionName: string): StepId | null => {
    const map: Record<string, StepId> = {
      'Идентичность': 'identity',
      'Категория': 'category',
      'Характеристики': 'characteristics',
      'Логистика': 'logistics',
    };
    return map[sectionName] || null;
  };

  const goToStep = (stepId: StepId) => {
    wizardStore.goTo(stepId);
  };

  const category = categories.find(c => c.name === draft.category);

  const handleCreate = () => {
    const instrumentData: Omit<MeasuringInstrument, 'id'> = {
      inventoryNumber: draft.inventoryNumber,
      name: '', // Будет заполнено из Госреестра или вручную
      category: draft.category,
      type: draft.model,
      serialNumber: draft.serialNumber,
      manufacturer: draft.gosreestrPreview?.manufacturer || '',
      range: draft.range,
      accuracy: draft.accuracy,
      status: draft.status,
      lastVerificationDate: draft.lastVerificationDate || null,
      intervalMonths: draft.intervalMonths,
      nextVerificationDate,
      location: draft.location,
      warehouseId: draft.warehouseId,
      customFields: draft.customFields,
    };
    onCreate(instrumentData);
  };

  return (
    <div className="space-y-5">
      {/* Duplicate guard banner */}
      {duplicate.match && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm text-amber-400 font-medium">
              Похоже, такой СИ уже есть в реестре
            </div>
            {duplicate.inventoryNumber && (
              <div className="text-xs text-slate-400 mt-1">
                Инв. №: <span className="font-mono text-white">{duplicate.inventoryNumber}</span>
                {' '}—{' '}
                <span className="underline cursor-pointer" onClick={() => {/* TODO: открыть карточку */}}>открыть карточку</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review sections */}
      {[
        { label: '1. Идентичность', step: 'identity' as StepId },
        { label: '2. Категория', step: 'category' as StepId },
        { label: '3. Характеристики', step: 'characteristics' as StepId },
        { label: '4. Логистика', step: 'logistics' as StepId },
      ].map(section => (
        <button
          key={section.label}
          onClick={() => goToStep(section.step)}
          className={`w-full text-left p-4 rounded-xl border transition-all ${
            'border-slate-700 bg-slate-800 hover:border-cyan-500/50'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-cyan-400">{section.label}</h4>
            <ChevronRight size={16} className="text-slate-500" />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {section.step === 'identity' && (
              <>
                <span className="text-slate-400">Инв. №:</span><span className="text-white font-mono">{draft.inventoryNumber}</span>
                <span className="text-slate-400">Серийный №:</span><span className="text-white">{draft.serialNumber}</span>
                <span className="text-slate-400">Модель:</span><span className="text-white">{draft.model}</span>
                <span className="text-slate-400">Источник:</span><span className="text-white">
                  {draft.source === 'gosreestr' ? 'Госреестр' : draft.source === 'copy' ? 'Копия' : 'Вручную'}
                </span>
              </>
            )}
            {section.step === 'category' && (
              <>
                <span className="text-slate-400 col-span-2">Категория:</span>
                <span className="text-white col-span-2 font-medium">{draft.category || 'Не выбрана'}</span>
              </>
            )}
            {section.step === 'characteristics' && (
              <>
                <span className="text-slate-400">Диапазон:</span><span className="text-white">{draft.range || '—'}</span>
                <span className="text-slate-400">Точность:</span><span className="text-white">{draft.accuracy || '—'}</span>
                {Object.entries(draft.customFields).slice(0, 4).map(([k, v]) => (
                  <>
                    <span className="text-slate-400">{k}:</span><span className="text-white">{String(v)}</span>
                  </>
                ))}
              </>
            )}
            {section.step === 'logistics' && (
              <>
                <span className="text-slate-400">Статус:</span><span className="text-white">{draft.status}</span>
                <span className="text-slate-400">Склад:</span><span className="text-white">{draft.warehouseId ? 'Указан' : '—'}</span>
                <span className="text-slate-400">Дата поверки:</span><span className="text-white">{draft.lastVerificationDate || '—'}</span>
                <span className="text-slate-400">Интервал:</span><span className="text-white">{draft.intervalMonths} мес.</span>
                <span className="text-slate-400">Следующая поверка:</span><span className="text-white">{nextVerificationDate || '—'}</span>
              </>
            )}
          </div>
        </button>
      ))}

      {/* Nav */}
      <div className="flex gap-3 pt-2">
        <button onClick={onBack} className="flex-1 py-2.5 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors">
          ← Назад
        </button>
        <button
          onClick={handleCreate}
          className="flex-1 py-2.5 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 transition-colors shadow-lg shadow-cyan-500/20"
        >
          Создать
        </button>
      </div>
    </div>
  );
}
