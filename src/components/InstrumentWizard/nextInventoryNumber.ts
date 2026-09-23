import type { MeasuringInstrument } from '../../types';

/**
 * Извлекает префикс и номер из инвентарного номера.
 * "СИ-0152" → ["СИ-", 152]
 * "ABC123" → ["ABC", 123]
 */
function parseInventoryId(inventoryNumber: string): [prefix: string, sep: string, num: number | null] {
  // «СИ-0152» → ['СИ', '-', 152]
  const matchDash = inventoryNumber.match(/^(.*?)([-]?)(\d+)$/);
  if (matchDash) {
    return [matchDash[1], matchDash[2] || '', parseInt(matchDash[3], 10)];
  }
  // «ABC123» → ['ABC', '', 123]
  const matchAlphaSuffix = inventoryNumber.match(/^([A-Za-z]+)(\d*)$/);
  if (matchAlphaSuffix && matchAlphaSuffix[2]) {
    return [matchAlphaSuffix[1], '', parseInt(matchAlphaSuffix[2], 10)];
  }
  return [inventoryNumber, '', null];
}

/**
 * Генерирует следующий инвентарный номер по серии.
 * Находит максимальный числовой суффикс среди СИ с тем же префиксом
 * и возвращает префикс + sep + max+1, дополненный нулями до максимальной длины.
 */
export function nextInventoryNumber(instruments: MeasuringInstrument[], prefixOverride?: string): string {
  interface NumInfo { prefix: string; sep: string; num: number; paddedLen: number; }
  const allNumbers: NumInfo[] = [];

  for (const inst of instruments) {
    let prefix: string;
    let sep: string;
    let num: number | null;
    let paddedLen = 0;

    if (prefixOverride) {
      const expected = `${prefixOverride}-`;
      if (!inst.inventoryNumber.startsWith(expected)) continue;
      const suffix = inst.inventoryNumber.slice(expected.length);
      const numMatch = suffix.match(/^(\d+)/);
      if (!numMatch) continue;
      prefix = prefixOverride;
      sep = '-';
      num = parseInt(numMatch[1], 10);
      paddedLen = numMatch[1].length;
    } else {
      const [pfx, s, n] = parseInventoryId(inst.inventoryNumber);
      if (n === null) continue;
      prefix = pfx;
      sep = s;
      num = n;
      paddedLen = String(n).length;
    }

    if (num !== null) {
      allNumbers.push({ prefix, sep, num, paddedLen });
    }
  }

  if (allNumbers.length === 0) {
    const defaultPrefix = prefixOverride ? `${prefixOverride}-` : 'СИ-';
    return `${defaultPrefix}0001`;
  }

  // Находим максимум
  let maxNum = -Infinity;
  let maxPaddedLen = 0;
  let finalPrefix = '';
  let finalSep = '';

  for (const item of allNumbers) {
    if (item.num > maxNum) {
      maxNum = item.num;
      finalPrefix = item.prefix;
      finalSep = item.sep;
      maxPaddedLen = item.paddedLen;
    } else if (item.num === maxNum) {
      maxPaddedLen = Math.max(maxPaddedLen, item.paddedLen);
    }
  }

  const nextNum = maxNum + 1;
  const padLen = Math.max(maxPaddedLen, String(nextNum).length, 4);
  return `${finalPrefix}${finalSep}${String(nextNum).padStart(padLen, '0')}`;
}
