import { describe, it, expect } from 'vitest';
import type { MeasuringInstrument } from '../../../../types';

const makeInst = (inv: string, model: string, serial: string): MeasuringInstrument => ({
  id: `inst-${serial}`, inventoryNumber: inv, name: '', category: '',
  type: model, serialNumber: serial, manufacturer: '', range: '', accuracy: '',
  status: 'available', lastVerificationDate: null, intervalMonths: 12,
  nextVerificationDate: null, location: '', warehouseId: null, customFields: {},
});

/**
 * Simulates the duplicate-guard logic from Review step.
 */
function checkDuplicate(
  instruments: MeasuringInstrument[],
  model: string,
  serial: string,
  inventoryNumber: string
): { match: boolean; instrumentId?: string; inventoryNumber?: string } {
  const matched = instruments.find(
    i => i.type.toLowerCase() === model.toLowerCase() &&
         i.serialNumber.toLowerCase() === serial.toLowerCase()
  );
  if (matched) {
    return { match: true, instrumentId: matched.id, inventoryNumber: matched.inventoryNumber };
  }
  const invMatched = instruments.find(
    i => i.inventoryNumber.toLowerCase() === inventoryNumber.toLowerCase()
  );
  if (invMatched) {
    return { match: true, instrumentId: invMatched.id, inventoryNumber: invMatched.inventoryNumber };
  }
  return { match: false };
}

describe('duplicate guard', () => {
  it('detects model+serial match', () => {
    const insts = [makeInst('СИ-0150', 'FSU', 'SN-1234')];
    const result = checkDuplicate(insts, 'FSU', 'SN-1234', 'СИ-0999');
    expect(result.match).toBe(true);
    expect(result.inventoryNumber).toBe('СИ-0150');
  });

  it('detects inventory number duplicate even if model/serial differ', () => {
    const insts = [makeInst('СИ-0150', 'FSU', 'SN-1234')];
    const result = checkDuplicate(insts, 'FSL', 'SN-5678', 'СИ-0150');
    expect(result.match).toBe(true);
    expect(result.inventoryNumber).toBe('СИ-0150');
  });

  it('returns no match for new SI', () => {
    const insts = [makeInst('СИ-0150', 'FSU', 'SN-1234'), makeInst('СИ-0151', 'FSL', 'SN-5678')];
    const result = checkDuplicate(insts, 'FSV', 'SN-9999', 'СИ-0152');
    expect(result.match).toBe(false);
    expect(result.instrumentId).toBeUndefined();
  });

  it('is case-insensitive', () => {
    const insts = [makeInst('СИ-0150', 'FSU', 'SN-1234')];
    const result = checkDuplicate(insts, 'fsu', 'sn-1234', 'СИ-0999');
    expect(result.match).toBe(true);
  });

  it('prefers model+serial over inventory dup', () => {
    // Even though inventory matches a different instrument, model+serial is checked first
    const insts = [
      makeInst('СИ-0150', 'FSU', 'SN-1234'),
      makeInst('СИ-0151', 'FSL', 'SN-1234'), // same serial, different model
    ];
    const result = checkDuplicate(insts, 'FSU', 'SN-1234', 'СИ-0151');
    expect(result.match).toBe(true);
    expect(result.inventoryNumber).toBe('СИ-0150'); // Found by model+serial first
  });
});
