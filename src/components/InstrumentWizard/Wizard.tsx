import { useState, useEffect, useCallback } from 'react';
import type { MeasuringInstrument } from '../../types';
import type { InstrumentCategory, Warehouse } from '../../types';
import { wizardStore } from './wizardStore';
import { IdentityStep } from './steps/Identity';
import { CategoryStep } from './steps/Category';
import { CharacteristicsStep } from './steps/Characteristics';
import { LogisticsStep } from './steps/Logistics';
import { ReviewStep } from './steps/Review';
import { emptyDraft, type DraftData, type StepId } from './types';
import { X, Save, CheckSquare, Eye } from 'lucide-react';

const STEP_LABELS: Record<StepId, string> = {
  identity: 'Идентичность',
  category: 'Категория',
  characteristics: 'Характеристики',
  logistics: 'Логистика',
  review: 'Проверка',
};

interface WizardProps {
  instruments: MeasuringInstrument[];
  categories: InstrumentCategory[];
  warehouses: Warehouse[];
  gosreestrAccessEnabled: boolean | null;
  onOpenCategoryBuilder: () => void;
  onCreateInstrument: (inst: Omit<MeasuringInstrument, 'id'>) => void;
  onClose: () => void;
}

export default function Wizard({ instruments, categories, warehouses, gosreestrAccessEnabled, onOpenCategoryBuilder, onCreateInstrument, onClose }: WizardProps) {
  const [currentStep, setCurrentStep] = useState<StepId>(wizardStore.getCurrentStep());
  const [draft, setDraft] = useState<DraftData>(wizardStore.getDraft());
  const [hasPendingDraft, setHasPendingDraft] = useState<boolean | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'recently'>('idle');
  const isDark = true;

  // Subscribe to store changes
  useEffect(() => {
    const unsub = wizardStore.subscribe(() => {
      setCurrentStep(wizardStore.getCurrentStep());
      setDraft(wizardStore.getDraft());
    });
    return unsub;
  }, []);

  // Авто-сохранение при изменении черновика (в parent будет вызывать after each field change)
  const persistDraft = useCallback(() => {
    const current = wizardStore.getDraft();
    wizardStore.persistToLocalStorage(null);
    setSaveStatus('recently');
    setTimeout(() => setSaveStatus('saved'), 1500);
  }, []);

  // Предложение продолжить черновик
  useEffect(() => {
    const restored = wizardStore.restoreFromLocalStorage(null);
    if (restored && restored.inventoryNumber && restored.model) {
      setHasPendingDraft(true);
    } else {
      setHasPendingDraft(false);
    }
  }, []);

  const handleContinueDraft = () => {
    const restored = wizardStore.restoreFromLocalStorage(null);
    if (restored) {
      wizardStore.setDraft(restored);
      setDraft(restored);
      setCurrentStep('identity');
      setHasPendingDraft(null);
    }
  };

  const handleStartOver = () => {
    wizardStore.clearDraft(null);
    setDraft(emptyDraft());
    setCurrentStep('identity');
    setHasPendingDraft(null);
  };

  const handleNext = (stepId: StepId) => {
    wizardStore.goNext(stepId);
    persistDraft();
  };

  const handleBack = () => {
    wizardStore.goBack();
    persistDraft();
  };

  const handleCreate = (instrument: Omit<MeasuringInstrument, 'id'>) => {
    onCreateInstrument(instrument);
    wizardStore.clearDraft(null);
    setDraft(emptyDraft());
    onClose();
  };

  const handleDraftSaveAndClose = () => {
    wizardStore.persistToLocalStorage(null);
    onClose();
  };

  const stepOrder: StepId[] = ['identity', 'category', 'characteristics', 'logistics', 'review'];
  const currentIndex = stepOrder.indexOf(currentStep);

  // ───────── DRAFT RESTORE BANNER ─────────
  if (hasPendingDraft === true) {
    const modelName = draft.model || draft.gosreestrPreview?.name || '';
    const invNum = draft.inventoryNumber || '';
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="w-full max-w-md rounded-xl p-6 bg-slate-800 border border-slate-700 text-center space-y-4">
          <div className="text-amber-400 text-lg font-semibold">Обнаружен несохранённый черновик</div>
          <p className="text-sm text-slate-400">
            {invNum ? `Инв. №: ${invNum}` : 'Без инв. номера'} · {modelName}
          </p>
          <div className="flex gap-3 pt-2">
            <button onClick={handleContinueDraft} className="flex-1 py-2.5 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600">
              Продолжить
            </button>
            <button onClick={handleStartOver} className="flex-1 py-2.5 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600">
              Заново
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ───────── MAIN WIZARD UI ─────────
  return (
    <>
      {/* Тёмный тонкий скроллбар для всего воркера */}
      <style>{`
        .wizard-scroll::-webkit-scrollbar { width: 8px; }
        .wizard-scroll::-webkit-scrollbar-track { background: transparent; }
        .wizard-scroll::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        .wizard-scroll::-webkit-scrollbar-thumb:hover { background: #475569; }
        .wizard-scroll { scrollbar-width: thin; scrollbar-color: #334155 transparent; }
        /* disabled next-button — выглядит неактивным */
        .btn-next-disabled {
          @apply bg-slate-700/50 text-slate-400 cursor-not-allowed;
        }
      `}</style>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className={`w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl ${isDark ? 'bg-[#0B1220]' : 'bg-white'}`} style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-slate-700/50 bg-[#0B1220]' : 'border-slate-200 bg-white'}`}>
          <h2 className="text-lg font-bold text-white">Добавить средство измерения</h2>
          <div className="flex items-center gap-3">
            {saveStatus !== 'idle' && (
              <span className={`text-xs px-2 py-1 rounded-full ${
                saveStatus === 'saved' || saveStatus === 'recently'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-slate-700 text-slate-400'
              }`}>
                Черновик сохранён {saveStatus === 'recently' ? '· только что' : ''}
              </span>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700/30 transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex" style={{ maxHeight: 'calc(90vh - 100px)' }}>
          {/* Vertical sidebar */}
          <aside className={`w-48 shrink-0 px-3 py-4 border-r ${isDark ? 'bg-[#12203A] border-slate-700/50' : 'bg-slate-50 border-slate-200'} overflow-y-auto`}>
            <nav className="space-y-1 relative">
              {/* Соединительные сегменты между иконками */}
              {stepOrder.map((stepId, idx) => {
                const isActive = currentStep === stepId;
                const isCompleted = idx < currentIndex;
                const isLast = idx === stepOrder.length - 1;
                // Определяем цвет сегмента: пройденный=cyan, будущий=slate-600/40
                const segmentColor = isCompleted || isActive ? '' : 'slate-600/40';
                return (
                  <div key={stepId} className="relative">
                    {/* Сегмент соединительной линии от центра текущей иконки до центра следующей */}
                    {!isLast && (
                      <div
                        className={`absolute top-5 left-1/2 w-0.5 h-8 -translate-x-1/2 ${
                          idx < currentIndex ? 'bg-cyan-500' : 'bg-slate-600/40'
                        }`}
                      />
                    )}
                    <button
                      key={stepId}
                      onClick={() => wizardStore.goTo(stepId)}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all text-left relative z-10 ${
                        isActive
                          ? 'bg-cyan-500/15 text-cyan-400'
                          : isCompleted
                          ? 'text-emerald-400 hover:text-emerald-300'
                          : isDark
                          ? 'text-slate-500 hover:text-slate-300'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <div className={`shrink-0 w-6 h-6 rounded flex items-center justify-center border-2 transition-all ${
                        isCompleted
                          ? 'bg-emerald-500 border-emerald-500'
                          : isActive
                          ? 'border-cyan-500 bg-cyan-500/20'
                          : isDark
                          ? 'border-slate-600'
                          : 'border-slate-300'
                      }`}>
                        {isCompleted && <CheckSquare size={14} className="text-white" />}
                        {!isCompleted && !isActive && <span className="text-xs">{idx + 1}</span>}
                      </div>
                      <span className="text-xs font-medium leading-tight pt-0.5">{STEP_LABELS[stepId]}</span>
                    </button>
                  </div>
                );
              })}
            </nav>
          </aside>

          {/* Content area */}
          <main className="flex-1 px-6 py-5 overflow-y-auto wizard-scroll">
            {currentStep === 'identity' && (
              <IdentityStep
                instruments={instruments}
                gosreestrAccessEnabled={gosreestrAccessEnabled}
                onNext={handleNext}
                isNew={true}
              />
            )}
            {currentStep === 'category' && (
              <CategoryStep
                categories={categories}
                onOpenBuilder={onOpenCategoryBuilder}
                onNext={handleNext}
              />
            )}
            {currentStep === 'characteristics' && (
              <CharacteristicsStep
                categories={categories}
                instruments={instruments}
                onNext={handleNext}
                onBack={handleBack}
              />
            )}
            {currentStep === 'logistics' && (
              <LogisticsStep
                warehouses={warehouses}
                mpiFromGosreestr={draft.gosreestrPreview?.intervalMonths ?? null}
                onNext={handleNext}
                onBack={handleBack}
              />
            )}
            {currentStep === 'review' && (
              <ReviewStep
                categories={categories}
                instruments={instruments}
                onBack={handleBack}
                onCreate={handleCreate}
              />
            )}
          </main>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-3 border-t ${isDark ? 'border-slate-700/50 bg-[#0B1220]' : 'border-slate-200 bg-white'}`}>
          <button
            onClick={handleDraftSaveAndClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors"
          >
            <Save size={14} />
            Сохранить черновик и закрыть
          </button>
          {currentStep !== 'identity' && currentStep !== 'review' && (
            <button onClick={handleBack} className="text-xs text-slate-400 hover:text-slate-300 transition-colors">
              ← Назад к предыдущему шагу
            </button>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
