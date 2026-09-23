import { type DraftData, emptyDraft, type StepId } from './types';

const DRAFT_KEY_PREFIX = 'instrument-wizard-draft:';

// ───────── helpers ─────────

function getDraftKey(userId: string | null): string {
  return `${DRAFT_KEY_PREFIX}${userId || 'anon'}`;
}

function loadDraft<D extends DraftData>(key: string): D | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft<D extends DraftData>(key: string, data: D): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // storage full – silently ignore
  }
}

function removeDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch { /* noop */ }
}

// ───────── state ─────────

let currentStep: StepId = 'identity';
let draft: DraftData = emptyDraft();
let listener: (() => void) | null = null;

function notify(): void {
  listener?.();
}

// ───────── store API ─────────

export const wizardStore = {
  // Step navigation
  goNext(stepId: StepId): void {
    currentStep = stepId;
    notify();
  },
  goBack(): void {
    const idx = ['identity', 'category', 'characteristics', 'logistics', 'review']
      .indexOf(currentStep);
    if (idx > 0) {
      currentStep = ['identity', 'category', 'characteristics', 'logistics', 'review'][idx - 1] as StepId;
      notify();
    }
  },
  goTo(stepId: StepId): void {
    currentStep = stepId;
    notify();
  },
  getCurrentStep(): StepId {
    return currentStep;
  },

  // Draft
  getDraft(): DraftData {
    return structuredClone(draft);
  },
  setDraft(d: DraftData): void {
    draft = d;
    notify();
  },
  patchDraft(patch: Partial<DraftData>): void {
    draft = { ...draft, ...patch };
    notify();
  },

  // Persistence
  persistToLocalStorage(userId: string | null): void {
    saveDraft(getDraftKey(userId), draft);
  },
  restoreFromLocalStorage(userId: string | null): DraftData | null {
    const saved = loadDraft(getDraftKey(userId));
    if (!saved) return null;
    const fresh = emptyDraft();
    // merge only known keys
    for (const k of Object.keys(fresh) as (keyof DraftData)[]) {
      if (k in saved) (fresh as Record<string, unknown>)[k] = saved[k];
    }
    return fresh;
  },
  clearDraft(userId: string | null): void {
    draft = emptyDraft();
    removeDraft(getDraftKey(userId));
    notify();
  },

  // Listener
  subscribe(fn: () => void): () => void {
    listener = fn;
    return () => { listener = null; };
  },
};
