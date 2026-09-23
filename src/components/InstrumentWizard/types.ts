import type { MeasuringInstrument } from '../../types';
import type { GosreestrCard } from '../../services/gosreestrService';

export const STEPS = ['identity', 'category', 'characteristics', 'logistics', 'review'] as const;
export type StepId = (typeof STEPS)[number];

export interface DraftData {
  source: 'gosreestr' | 'copy' | 'manual';

  gosreestrSourceId?: string;
  gosreestrPreview?: Omit<GosreestrCard, 'id'>;

  copySourceId?: string;
  copySourceFields?: Record<string, boolean>; // какие поля из донора подставить

  inventoryNumber: string;
  serialNumber: string;
  model: string;

  category: string;
  categoryFields: Record<string, boolean>; // какие поля категории задействовать

  customFields: Record<string, string | number>;
  range: string;
  accuracy: string;

  status: MeasuringInstrument['status'];
  warehouseId: string | null;
  location: string;
  lastVerificationDate: string;
  intervalMonths: number;

  photo: string;
}

export function emptyDraft(): DraftData {
  return {
    source: 'gosreestr',
    inventoryNumber: '',
    serialNumber: '',
    model: '',
    category: '',
    categoryFields: {},
    customFields: {},
    range: '',
    accuracy: '',
    status: 'available',
    warehouseId: null,
    location: '',
    lastVerificationDate: new Date().toISOString().split('T')[0],
    intervalMonths: 12,
    photo: '',
  };
}

export interface DuplicateGuardInfo {
  match: boolean;
  instrumentId?: string;
  inventoryNumber?: string;
}
