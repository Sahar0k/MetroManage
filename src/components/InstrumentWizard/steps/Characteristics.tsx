import { useState, useCallback, useMemo } from 'react';
import type { MeasuringInstrument } from '../../../types';
import type { InstrumentCategory } from '../../../types';
import { wizardStore } from '../wizardStore';
import type { StepId } from '../types';

interface CharacteristicsStepProps {
  categories: InstrumentCategory[];
  instruments: MeasuringInstrument[];
  onNext: (step: StepId) => void;
  onBack: () => void;
}

export function CharacteristicsStep({ categories, instruments, onNext, onBack }: CharacteristicsStepProps) {
  const draft = wizardStore.getDraft();
  const currentCat = categories.find(c => c.name === draft.category);
  const fields = currentCat?.fields || [];
  const [customFields, setCustomFields] = useState<Record<string, string | number>>({ ...draft.customFields });
  const [rangeInput, setRangeInput] = useState(draft.range);
  const [accuracyInput, setAccuracyInput] = useState(draft.accuracy);
  const [showDonorDialog, setShowDonorDialog] = useState(false);
  const [donorResults, setDonorResults] = useState<MeasuringInstrument[]>([]);
  const [donorQuery, setDonorQuery] = useState('');
  const [donorSelected, setDonorSelected] = useState<string | null>(null);
  const [donorApplyFields, setDonorApplyFields] = useState<Record<string, boolean>>({});

  // Подставляем начальные значения из Госреестра или донора
  const prefillFromGosreestr = useCallback(() => {
    if (draft.gosreestrPreview && currentCat) {
      const newFields: Record<string, string | number> = { ...customFields };
      for (const field of currentCat.fields) {
        // Попробуем взять из gosreestrPreview если есть маппинг
        // Для простоты — только customFields
      }
      setCustomFields(newFields);
    }
  }, [draft.gosreestrPreview, currentCat, customFields]);

  const handleChange = (fieldId: string, value: string | number) => {
    const updated = { ...customFields, [fieldId]: value };
    setCustomFields(updated);
  };

  const handleDonorSearch = () => {
    if (!draft.category) return;
    const results = instruments.filter(i => i.category === draft.category);
    setDonorResults(results.slice(0, 20));
    setShowDonorDialog(true);
  };

  const handleDonorSelect = (inst: MeasuringInstrument) => {
    setDonorSelected(inst.id);
    // Автоматически отмечаем все кастомные поля текущей категории, где у донора есть значение
    const selectedFields: Record<string, boolean> = {};
    for (const field of currentCat?.fields || []) {
      if (inst.customFields[field.id] !== undefined) {
        selectedFields[field.id] = true;
      }
    }
    setDonorApplyFields(selectedFields);
  };

  // Маппинг fieldId → отображаемое имя поля (из категории или generic)
  const fieldNameMap = useMemo(() => {
    const map: Record<string, string> = {
      inventoryNumber: 'Инв. номер', name: 'Наименование', category: 'Категория',
      type: 'Модель', serialNumber: 'Серийный №', manufacturer: 'Производитель',
      range: 'Диапазон', accuracy: 'Точность', intervalMonths: 'Интервал поверки',
      location: 'Местоположение', status: 'Статус',
    };
    // Добавляем кастомные поля из текущей категории
    for (const field of currentCat?.fields || []) {
      map[field.id] = `${field.name}${field.unit ? ` (${field.unit})` : ''}`;
    }
    return map;
  }, [currentCat]);

  const applyDonorFields = () => {
    if (!donorSelected) return;
    const donor = instruments.find(i => i.id === donorSelected);
    if (!donor) return;
    const updated: Record<string, string | number> = { ...customFields };
    for (const [fieldId, apply] of Object.entries(donorApplyFields)) {
      if (apply && donor.customFields[fieldId] !== undefined) {
        updated[fieldId] = donor.customFields[fieldId];
      }
    }
    setCustomFields(updated);
    setShowDonorDialog(false);
  };

  const persist = () => {
    wizardStore.patchDraft({ customFields, range: rangeInput, accuracy: accuracyInput });
  };

  const handleNext = () => {
    persist();
    wizardStore.patchDraft({ customFields, range: rangeInput, accuracy: accuracyInput });
    onNext('logistics');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white mb-1">Характеристики</h3>
          <p className="text-xs text-slate-400">
            {draft.category ? `Шаблона категории «${draft.category}»` : 'Выберите категорию на предыдущем шаге'}
          </p>
        </div>
        {currentCat && (
          <button
            onClick={handleDonorSearch}
            className="px-3 py-1.5 text-xs bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
          >
            Заполнить из донора…
          </button>
        )}
      </div>

      {/* Основные поля */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Диапазон</label>
          <input
            value={rangeInput}
            onChange={e => setRangeInput(e.target.value)}
            placeholder="Например: 0–1000 В"
            className={`w-full px-3 py-2 rounded-lg text-sm border ${
              'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
            } focus:outline-none focus:ring-2 focus:ring-cyan-500`}
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Точность</label>
          <input
            value={accuracyInput}
            onChange={e => setAccuracyInput(e.target.value)}
            placeholder="Например: ±0.02%"
            className={`w-full px-3 py-2 rounded-lg text-sm border ${
              'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
            } focus:outline-none focus:ring-2 focus:ring-cyan-500`}
          />
        </div>
      </div>

      {/* Custom fields template */}
      {currentCat && currentCat.fields.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-300 mb-3">Поля категории</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentCat.fields.map(field => (
              <div key={field.id}>
                <label className="text-xs text-slate-400 mb-1 block">
                  {field.name}{field.unit ? ` (${field.unit})` : ''}
                </label>
                <input
                  type={field.type === 'range' ? 'number' : 'text'}
                  value={String(customFields[field.id] ?? '')}
                  onChange={e => handleChange(field.id, e.target.value)}
                  placeholder={`${field.name}`}
                  className={`w-full px-3 py-2 rounded-lg text-sm border ${
                    'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                  } focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Donor dialog */}
      {showDonorDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl p-6 bg-slate-800 border border-slate-700 max-h-[80vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white mb-4">Заполнить из существующего СИ</h3>

            <input
              value={donorQuery}
              onChange={e => setDonorQuery(e.target.value)}
              placeholder="Фильтр по названию..."
              className={`w-full px-3 py-2 rounded-lg text-sm border ${
                'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
              } focus:outline-none focus:ring-2 focus:ring-cyan-500`}
            />

            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
              {donorResults
                .filter(i => !donorQuery || i.name.toLowerCase().includes(donorQuery.toLowerCase()))
                .map(inst => (
                <button
                  key={inst.id}
                  onClick={() => handleDonorSelect(inst)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    donorSelected === inst.id
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="text-sm text-white font-medium">{inst.inventoryNumber} — {inst.name}</div>
                  <div className="text-xs text-slate-400">{inst.type} · {inst.serialNumber}</div>
                </button>
              ))}
            </div>

            {donorSelected && (() => {
              const donor = instruments.find(i => i.id === donorSelected);
              if (!donor) return null;
              // Для каждой категории — все кастомные поля как чекбоксы
              const allFieldKeys = currentCat?.fields.map(f => f.id) || [];
              // Если текущее поле уже заполнено новым значением — показываем его
              const displayEntries = allFieldKeys.map(id => ({
                id,
                name: fieldNameMap[id] || id,
                value: donor.customFields[id] ?? '',
                checked: !!donorApplyFields[id],
              }));
              return (
                <div className="mt-4 pt-4 border-t border-slate-700 space-y-1.5">
                  <h4 className="text-xs font-semibold text-cyan-400 mb-2">
                    Донор: {donor.inventoryNumber} — {donor.name}
                  </h4>
                  {displayEntries.length > 0 ? (
                    displayEntries.map(entry => (
                      <label key={entry.id} className="flex items-center gap-2 cursor-pointer py-1">
                        <input
                          type="checkbox"
                          checked={entry.checked}
                          onChange={() => {
                            const f = { ...donorApplyFields, [entry.id]: !entry.checked };
                            setDonorApplyFields(f);
                          }}
                          className="accent-cyan-500"
                        />
                        <span className="text-xs text-slate-300 w-48 truncate">{entry.name}</span>
                        <span className="text-xs text-slate-500">→ {entry.value !== '' ? entry.value : '(пусто)'}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 italic">Нет общих полей категории с донором</p>
                  )}
                </div>
              );
            })()}

            <div className="flex gap-3 mt-6">
              <button onClick={applyDonorFields} disabled={!donorSelected} className="flex-1 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 disabled:opacity-50">
                Применить
              </button>
              <button onClick={() => setShowDonorDialog(false)} className="flex-1 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-2.5 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors">
          ← Назад
        </button>
        <button
          onClick={handleNext}
          className="flex-1 py-2.5 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 disabled:!bg-slate-700/50 disabled:!text-slate-400 disabled:cursor-not-allowed transition-colors"
        >
          Далее →
        </button>
      </div>
    </div>
  );
}
