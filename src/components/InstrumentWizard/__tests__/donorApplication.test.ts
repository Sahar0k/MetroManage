import { describe, it, expect } from 'vitest';
import type { MeasuringInstrument } from '../../../../types';

const makeInst = (inv: string, cat: string, customFields: Record<string, string | number>): MeasuringInstrument => ({
  id: inv, inventoryNumber: inv, name: '', category: cat, type: '', serialNumber: '',
  manufacturer: '', range: '', accuracy: '', status: 'available',
  lastVerificationDate: null, intervalMonths: 12, nextVerificationDate: null,
  location: '', warehouseId: null, customFields,
});

/**
 * Simulates applying donor fields with selective checkboxes.
 */
function applyDonorFields(
  currentFields: Record<string, string | number>,
  donor: MeasuringInstrument,
  selectedFieldIds: Record<string, boolean>
): Record<string, string | number> {
  const updated = { ...currentFields };
  for (const [fieldId, apply] of Object.entries(selectedFieldIds)) {
    if (apply && donor.customFields[fieldId] !== undefined) {
      updated[fieldId] = donor.customFields[fieldId];
    }
  }
  return updated;
}

describe('donor: selective field application', () => {
  it('applies only checked fields', () => {
    const donor = makeInst('donor-1', 'Мультиметр', { voltage_dc_max: 1000, voltage_ac_max: 750, current_max: 3, digits: 6.5 });
    const current: Record<string, string | number> = {};
    const selected = { voltage_dc_max: true, voltage_ac_max: false, current_max: true, digits: false };

    const result = applyDonorFields(current, donor, selected);
    expect(result.voltage_dc_max).toBe(1000);
    expect(result.voltage_ac_max).toBeUndefined();
    expect(result.current_max).toBe(3);
    expect(result.digits).toBeUndefined();
  });

  it('does not overwrite unselected existing values', () => {
    const donor = makeInst('donor-1', 'Мультиметр', { voltage_dc_max: 1000 });
    const current = { voltage_dc_max: 500 }; // already set by user
    const selected = { voltage_dc_max: false }; // user un-checked

    const result = applyDonorFields(current, donor, selected);
    expect(result.voltage_dc_max).toBe(500); // preserved original value
  });

  it('merges multiple selections without losing existing data', () => {
    const donor = makeInst('donor-1', 'Осциллограф', { bandwidth: 1000, channels: 4, sample_rate: 2.5 });
    const current = { someOtherField: 'custom' };
    const selected = { bandwidth: true, channels: true, sample_rate: false };

    const result = applyDonorFields(current, donor, selected);
    expect(result.someOtherField).toBe('custom');
    expect(result.bandwidth).toBe(1000);
    expect(result.channels).toBe(4);
    expect(result.sample_rate).toBeUndefined();
  });

  it('handles empty selection gracefully', () => {
    const donor = makeInst('donor-1', 'Мультиметр', { voltage_dc_max: 1000 });
    const current = { voltage_dc_max: 999 };
    const selected: Record<string, boolean> = {};

    const result = applyDonorFields(current, donor, selected);
    expect(result.voltage_dc_max).toBe(999); // unchanged
  });

  it('is blind-copy safe: only copies what is explicitly selected', () => {
    const donor = makeInst('donor-1', 'Мультиметр', {
      voltage_dc_max: 1000, voltage_ac_max: 750,
      current_max: 3, digits: 6.5, hidden_field: 'SECRET',
    });
    const current: Record<string, string | number> = {};
    const selected = { voltage_dc_max: true };

    const result = applyDonorFields(current, donor, selected);
    // Only one field copied — no blind copy of all donor fields
    expect(Object.keys(result)).toHaveLength(1);
    expect(result.voltage_dc_max).toBe(1000);
  });
});
