import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Loader2, Copy, Search } from 'lucide-react';
import type { MeasuringInstrument } from '../../../types';
import type { GosreestrHint } from '../../../services/gosreestrService';
import { useGosreestrSearch } from '../../../hooks/useGosreestrSearch';
import { wizardStore } from '../wizardStore';
import { nextInventoryNumber } from '../nextInventoryNumber';
import type { StepId, DraftData } from '../types';

interface IdentityStepProps {
  instruments: MeasuringInstrument[];
  gosreestrAccessEnabled: boolean | null;
  onNext: (step: StepId) => void;
  isNew: boolean;
}

export function IdentityStep({ instruments, gosreestrAccessEnabled, onNext, isNew }: IdentityStepProps) {
  const draft = wizardStore.getDraft();
  const [source, setSource] = useState(draft.source || 'gosreestr');
  const [gosreestrQuery, setGosreestrQuery] = useState('');
  const [gosreestrSelectedId, setGosreestrSelectedId] = useState<string | null>(draft.gosreestrSourceId || null);
  const [gosreestrPreview, setGosreestrPreview] = useState<NonNullable<typeof draft.gosreestrPreview>>(
    draft.gosreestrPreview ? { ...draft.gosreestrPreview } : undefined
  );
  const [invInput, setInvInput] = useState(draft.inventoryNumber);
  const [serialInput, setSerialInput] = useState(draft.serialNumber);
  const [modelInput, setModelInput] = useState(draft.model);
  const [duplicateInvError, setDuplicateInvError] = useState(false);
  const [hasAutoInv, setHasAutoInv] = useState(true);

  // Gosreestr search
  const { hints, loading: gosLoading } = useGosreestrSearch(source === 'gosreestr' && gosreestrSelectedId ? gosreestrQuery : '');

  // Предзаполнение на старте (только для новых)
  useEffect(() => {
    if (isNew && source === 'gosreestr') {
      setInvInput(nextInventoryNumber(instruments));
      setHasAutoInv(true);
    }
  }, [isNew, source, instruments]);

  // Автоинвентарный номер при изменении префикса
  useEffect(() => {
    if (hasAutoInv && isNew && (source === 'gosreestr')) {
      setInvInput(nextInventoryNumber(instruments));
    }
  }, [instruments.length, hasAutoInv, isNew, source]);

  // Проверка дубликата на blur
  const handleInvBlur = () => {
    if (!invInput.trim()) return;
    const exists = instruments.some(
      i => i.inventoryNumber.toLowerCase() === invInput.toLowerCase().trim()
    );
    setDuplicateInvError(exists);
    setHasAutoInv(false);
  };

  // Выбор подсказки Госреестра
  const handleGosreestrSelect = async (hint: GosreestrHint) => {
    setGosreestrQuery(hint.number || hint.name);
    setGosreestrSelectedId(hint.id);
    // Fetch full card via service
    const { fetchCardWithCache } = await import('../../../services/gosreestrService');
    const { card } = await fetchCardWithCache(hint.id);
    if (card) {
      const preview = { ...card };
      setGosreestrPreview(preview);
      // Auto-fill editable fields
      setModelInput(prev => prev || card.type || '');
      setSerialInput(prev => prev || '');
      wizardStore.patchDraft({
        gosreestrSourceId: hint.id,
        gosreestrPreview: preview as any,
      });
    }
  };

  const persist = (patch: Partial<typeof draft>) => {
    wizardStore.patchDraft(patch);
    wizardStore.persistToLocalStorage(null);
  };

  const canProceed = (): boolean => {
    if (source === 'gosreestr') return !!gosreestrSelectedId || gosreestrQuery.length >= 3;
    return true;
  };

  const handleNext = () => {
    if (!canProceed()) return;
    wizardStore.patchDraft({
      source,
      gosreestrSourceId: gosreestrSelectedId ?? undefined,
      gosreestrPreview: gosreestrPreview,
      inventoryNumber: invInput,
      serialNumber: serialInput,
      model: modelInput,
    });
    onNext('category');
  };

  const sourceOptions: { key: typeof source; label: string; icon: React.ReactNode }[] = [
    { key: 'gosreestr', label: 'Из Госреестра', icon: <CheckCircle size={16} className="text-emerald-400" /> },
    { key: 'copy', label: 'Копия существующего СИ', icon: <Copy size={16} className="text-cyan-400" /> },
    { key: 'manual', label: 'Вручную', icon: <Search size={16} className="text-slate-400" /> },
  ];

  const isDark = true;

  return (
    <div className="space-y-6">
      {/* Source cards */}
      <div className="grid grid-cols-3 gap-3">
        {sourceOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => {
              setSource(opt.key);
              persist({ source: opt.key });
            }}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              source === opt.key
                ? 'border-cyan-500 bg-cyan-500/10'
                : isDark
                ? 'border-slate-700 bg-slate-800 hover:border-slate-600'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">{opt.icon}{opt.label}</div>
          </button>
        ))}
      </div>

      {/* GOSREESTR source */}
      {source === 'gosreestr' && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={gosreestrQuery}
              onChange={e => { setGosreestrQuery(e.target.value); setGosreestrSelectedId(null); }}
              onFocus={() => {}}
              placeholder="Номер или наименование из Госреестра..."
              className={`w-full pl-10 pr-4 py-3 rounded-lg text-sm border ${
                isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400' : 'bg-white border-slate-300'
              } focus:outline-none focus:ring-2 focus:ring-cyan-500`}
            />
            {gosLoading && <Loader2 size={18} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-cyan-400" />}
          </div>

          {hints.length > 0 && gosreestrQuery.length >= 3 && gosreestrSelectedId !== 'loaded' && (
            <div className={`rounded-lg border overflow-hidden max-h-48 overflow-y-auto ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
              {hints.map(hint => (
                <button
                  key={hint.id}
                  onClick={() => handleGosreestrSelect(hint)}
                  className={`w-full text-left px-4 py-3 text-sm border-b last:border-0 ${
                    gosreestrSelectedId === hint.id
                      ? 'bg-cyan-500/20'
                      : isDark
                      ? 'hover:bg-slate-700'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="font-medium text-white flex items-center gap-2">
                    {hint.designation && hint.designation !== 'Обозначение отсутствует'
                      ? hint.designation
                      : hint.name.substring(0, 50)}
                    {!hint.isActual && <span className="text-xs text-amber-400">Не действует</span>}
                  </div>
                  <div className="text-xs text-slate-400">{hint.number} · {hint.manufacturer}</div>
                </button>
              ))}
            </div>
          )}

          {/* Preview from Gosreestr */}
          {gosreestrPreview && (
            <div className={`p-4 rounded-xl border ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
              <h4 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                <CheckCircle size={16} /> Данные из Госреестра
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Наименование:</span><span className="text-white">{gosreestrPreview.name}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Тип:</span><span className="text-white">{gosreestrPreview.type}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Производитель:</span><span className="text-white">{gosreestrPreview.manufacturer}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">МПИ:</span><span className="text-white">{gosreestrPreview.intervalMonths ? `${gosreestrPreview.intervalMonths} мес.` : 'не указан'}</span></div>
              </div>
              {gosreestrPreview.productionType !== 'unknown' && (
                <div className="mt-2 text-xs text-slate-400">
                  Серия: {gosreestrPreview.productionType === 'serial' ? 'Серийное' : 'Единичное'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* COPY source */}
      {source === 'copy' && (
        <CopySourcePanel instruments={instruments} onPersist={persist} />
      )}

      {/* MANUAL source — just empty, user fills manually */}

      {/* Fields common to all sources */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Инвентарный №</label>
          <div className="relative">
            <input
              value={invInput}
              onChange={e => { setInvInput(e.target.value); setHasAutoInv(false); setDuplicateInvError(false); }}
              onBlur={handleInvBlur}
              className={`w-full px-3 py-2 rounded-lg text-sm border ${
                duplicateInvError
                  ? 'border-red-500 bg-red-500/10'
                  : !duplicateInvError && invInput && !hasAutoInv
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : isDark ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-300 bg-white'
              } focus:outline-none focus:ring-2 focus:ring-cyan-500`}
            />
            {invInput && !duplicateInvError && !hasAutoInv && (
              <CheckCircle size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-400" />
            )}
            {duplicateInvError && (
              <AlertCircle size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400" />
            )}
          </div>
          {duplicateInvError && <p className="text-xs text-red-400 mt-1">Этот номер уже занят</p>}
          {!duplicateInvError && invInput && !hasAutoInv && <p className="text-xs text-emerald-400 mt-1">✓ Номер свободен</p>}
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Серийный №</label>
          <input
            value={serialInput}
            onChange={e => setSerialInput(e.target.value)}
            className={`w-full px-3 py-2 rounded-lg text-sm border ${isDark ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-300 bg-white'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Модель</label>
          <input
            value={modelInput}
            onChange={e => setModelInput(e.target.value)}
            className={`w-full px-3 py-2 rounded-lg text-sm border ${isDark ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-300 bg-white'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
          />
        </div>
      </div>

      <button
        onClick={handleNext}
        disabled={!invInput.trim()}
        title={!invInput.trim() ? 'Укажите инвентарный номер' : ''}
        className="w-full py-2.5 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 disabled:!bg-slate-700/50 disabled:!text-slate-400 disabled:cursor-not-allowed transition-colors"
      >
        Далее →
      </button>
    </div>
  );
}

// ───────── Copy source panel ─────────

function CopySourcePanel({ instruments, onPersist }: {
  instruments: MeasuringInstrument[];
  onPersist: (patch: Record<string, unknown>) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, boolean>>({
    inventoryNumber: true, name: true, category: true, type: true,
    serialNumber: true, manufacturer: true, range: true, accuracy: true,
    intervalMonths: true, location: true,
  });

  const filtered = instruments.filter(i => {
    if (!query) return false;
    const q = query.toLowerCase();
    return i.type.toLowerCase().includes(q) || i.serialNumber.toLowerCase().includes(q)
      || i.inventoryNumber.toLowerCase().includes(q) || i.name.toLowerCase().includes(q);
  }).slice(0, 10);

  const donor = selectedId ? instruments.find(i => i.id === selectedId) : null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedId(null); }}
          placeholder="Поиск по модели, серийному или инв. номеру..."
          className={`w-full pl-10 pr-4 py-3 rounded-lg text-sm border ${
            'bg-slate-800 border-slate-700 text-white placeholder-slate-400'
          } focus:outline-none focus:ring-2 focus:ring-cyan-500`}
        />
      </div>

      {filtered.length > 0 && !donor && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 max-h-48 overflow-y-auto">
          {filtered.map(inst => (
            <button
              key={inst.id}
              onClick={() => setSelectedId(inst.id)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-700 border-b border-slate-700 last:border-0"
            >
              <div className="text-white font-medium">{inst.inventoryNumber} — {inst.name}</div>
              <div className="text-xs text-slate-400">{inst.type} · {inst.serialNumber}</div>
            </button>
          ))}
        </div>
      )}

      {donor && (
        <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 space-y-3">
          <h4 className="text-sm font-semibold text-cyan-400">Донор: {donor.inventoryNumber} — {donor.name}</h4>
          <div className="space-y-1.5 text-sm">
            {(Object.keys(fields) as string[]).map(key => {
              const labels: Record<string, string> = {
                inventoryNumber: 'Инв. номер', name: 'Наименование', category: 'Категория',
                type: 'Модель', serialNumber: 'Серийный №', manufacturer: 'Производитель',
                range: 'Диапазон', accuracy: 'Точность', intervalMonths: 'Интервал поверки',
                location: 'Местоположение',
              };
              const valMap: Record<string, string | number> = {
                inventoryNumber: donor.inventoryNumber, name: donor.name, category: donor.category,
                type: donor.type, serialNumber: donor.serialNumber, manufacturer: donor.manufacturer,
                range: donor.range, accuracy: donor.accuracy, intervalMonths: donor.intervalMonths,
                location: donor.location,
              };
              return (
                <label key={key} className="flex items-center gap-2 text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!fields[key]}
                    onChange={() => {
                      const f = { ...fields, [key]: !fields[key] };
                      setFields(f);
                      onPersist({ copySourceFields: f });
                    }}
                    className="accent-cyan-500"
                  />
                  <span className="text-xs text-slate-400 w-28">{labels[key]}</span>
                  <span className="text-xs text-slate-500 truncate">
                    {typeof valMap[key] === 'number' ? valMap[key] : valMap[key]?.toString?.()}
                  </span>
                </label>
              );
            })}
          </div>
          <div className="pt-2 border-t border-slate-700 text-xs text-slate-400">
            Выбранные поля подставятся в характеристики
          </div>
        </div>
      )}
    </div>
  );
}
