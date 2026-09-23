import { describe, it, expect } from 'vitest';
import type { MeasuringInstrument } from '../../../../types';
import { nextInventoryNumber } from '../nextInventoryNumber';

const makeInst = (inv: string): MeasuringInstrument => ({
  id: 'x', inventoryNumber: inv, name: '', category: '', type: '',
  serialNumber: '', manufacturer: '', range: '', accuracy: '',
  status: 'available', lastVerificationDate: null, intervalMonths: 12,
  nextVerificationDate: null, location: '', warehouseId: null, customFields: {},
});

describe('nextInventoryNumber', () => {
  it('returns СИ-0001 for empty list', () => {
    const result = nextInventoryNumber([]);
    expect(result).toBe('СИ-0001');
  });

  it('increments max numeric suffix', () => {
    const insts = [makeInst('СИ-0151'), makeInst('СИ-0153'), makeInst('СИ-0152')];
    const result = nextInventoryNumber(insts);
    expect(result).toBe('СИ-0154');
  });

  it('respects prefixOverride', () => {
    const insts = [makeInst('СИ-0100'), makeInst('ОСЦ-0005')];
    const result = nextInventoryNumber(insts, 'СИ');
    expect(result).toBe('СИ-0101');
  });

  it('handles non-numeric suffix gracefully (ignores)', () => {
    const insts = [makeInst('СИ-ABC'), makeInst('СИ-0099')];
    const result = nextInventoryNumber(insts);
    expect(result).toBe('СИ-0100');
  });

  it('preserves padding length from max', () => {
    const insts = [makeInst('СИ-0001'), makeInst('СИ-0099')];
    const result = nextInventoryNumber(insts);
    expect(result).toBe('СИ-0100');
  });

  it('uses overridden prefix with dash', () => {
    const insts: MeasuringInstrument[] = [];
    const result = nextInventoryNumber(insts, 'ЛАБ');
    expect(result).toBe('ЛАБ-0001');
  });

  it('filters by prefix and skips others', () => {
    const insts = [
      makeInst('СИ-0010'),
      makeInst('ОСЦ-0005'),
      makeInst('СИ-0020'),
    ];
    const result = nextInventoryNumber(insts, 'СИ');
    expect(result).toBe('СИ-0021');
  });
});
