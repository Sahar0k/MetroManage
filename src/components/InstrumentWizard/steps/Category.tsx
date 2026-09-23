import { useState, useCallback } from 'react';
import type { InstrumentCategory } from '../../../types';
import { wizardStore } from '../wizardStore';
import type { StepId } from '../types';

interface CategoryStepProps {
  categories: InstrumentCategory[];
  onOpenBuilder: () => void;
  onNext: (step: StepId) => void;
}

export function CategoryStep({ categories, onOpenBuilder, onNext }: CategoryStepProps) {
  const draft = wizardStore.getDraft();
  const [category, setCategory] = useState(draft.category);
  const isDark = true;

  const handleSelect = useCallback((catName: string) => {
    setCategory(catName);
  }, []);

  const handleNext = () => {
    if (!category) return;
    wizardStore.patchDraft({ category });
    onNext('characteristics');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">Выберите категорию</h3>
        <p className="text-xs text-slate-400">Категория определит набор характеристик прибора</p>
      </div>

      <div className="relative max-h-64 overflow-y-auto pr-2 pb-4 [&::-webkit-scrollbar]:w-[8px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#334155] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar]:rounded-full scrollbar-thin scrollbar-thumb-[#334155] scrollbar-track-transparent">
        {/* Fade gradient to avoid cut-off cards at bottom */}
        <div className="pointer-events-none absolute inset-x-0 bottom-14 h-8 bg-gradient-to-t from-[#0B1220] to-transparent rounded-b-lg" />
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => handleSelect(cat.name)}
            className={`p-3 rounded-xl border-2 transition-all text-left ${
              category === cat.name
                ? 'border-cyan-500 bg-cyan-500/10'
                : 'border-slate-700 bg-slate-800 hover:border-slate-600'
            }`}
          >
            <div className="text-sm font-medium text-white">{cat.name}</div>
            <div className="text-xs text-slate-400 mt-1">
              {cat.fields.length} полей
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenBuilder}
          className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
        >
          + Новая категория
        </button>
      </div>

      {category && (
        <div className="p-3 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white">
          Выбрано: <span className="font-semibold text-cyan-400">{category}</span>
        </div>
      )}

      <button
        onClick={handleNext}
        disabled={!category}
        title={!category ? 'Выберите категорию' : ''}
        className="w-full py-2.5 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 disabled:!bg-slate-700/50 disabled:!text-slate-400 disabled:cursor-not-allowed transition-colors"
      >
        Далее →
      </button>
    </div>
  );
}
