import { describe, it, expect, beforeEach } from 'vitest';
import { wizardStore } from '../wizardStore';

describe('wizardStore', () => {
  beforeEach(() => {
    // Clear draft before each test
    wizardStore.clearDraft(null);
    // Reset step to identity
    wizardStore.goTo('identity');
  });

  it('returns empty draft initially', () => {
    const draft = wizardStore.getDraft();
    expect(draft).toBeDefined();
    expect(draft.inventoryNumber).toBe('');
    expect(draft.source).toBe('gosreestr');
  });

  it('patches draft and notifies', () => {
    let called = false;
    const unsub = wizardStore.subscribe(() => { called = true; });
    wizardStore.patchDraft({ inventoryNumber: 'СИ-0152' });
    expect(called).toBe(true);
    const draft = wizardStore.getDraft();
    expect(draft.inventoryNumber).toBe('СИ-0152');
    unsub();
  });

  it('persists to localStorage and restores', () => {
    wizardStore.patchDraft({
      source: 'manual',
      inventoryNumber: 'СИ-0155',
      model: 'FSU',
      category: 'Анализатор спектра',
    });
    wizardStore.persistToLocalStorage(null);
    const restored = wizardStore.restoreFromLocalStorage(null);
    expect(restored).not.toBeNull();
    expect(restored!.source).toBe('manual');
    expect(restored!.inventoryNumber).toBe('СИ-0155');
    expect(restored!.model).toBe('FSU');
    expect(restored!.category).toBe('Анализатор спектра');
  });

  it('clears draft from store and localStorage', () => {
    wizardStore.patchDraft({ inventoryNumber: 'СИ-0999' });
    wizardStore.persistToLocalStorage(null);
    wizardStore.clearDraft(null);
    const afterClear = wizardStore.getDraft();
    expect(afterClear.inventoryNumber).toBe('');
  });

  it('navigates steps correctly', () => {
    expect(wizardStore.getCurrentStep()).toBe('identity');
    wizardStore.goNext('category');
    expect(wizardStore.getCurrentStep()).toBe('category');
    wizardStore.goBack();
    expect(wizardStore.getCurrentStep()).toBe('identity');
    wizardStore.goTo('logistics');
    expect(wizardStore.getCurrentStep()).toBe('logistics');
  });

  it('cannot go back from identity', () => {
    wizardStore.goBack();
    expect(wizardStore.getCurrentStep()).toBe('identity');
  });

  it('nav 1→2→3→back→forward without losing data', () => {
    wizardStore.patchDraft({ serialNumber: 'SN-123' });
    wizardStore.goNext('category');
    wizardStore.patchDraft({ category: 'Мультиметр' });
    wizardStore.goBack();
    expect(wizardStore.getCurrentStep()).toBe('identity');
    let d = wizardStore.getDraft();
    expect(d.serialNumber).toBe('SN-123');
    wizardStore.goNext('category');
    expect(wizardStore.getCurrentStep()).toBe('category');
    d = wizardStore.getDraft();
    expect(d.category).toBe('Мультиметр');
    expect(d.serialNumber).toBe('SN-123');
  });
});
