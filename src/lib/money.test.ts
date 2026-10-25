import { describe, expect, it } from 'vitest';

import { formatMoney, parseRupeesToPaise } from './money';

describe('money UI helpers', () => {
  it('parses rupees into integer paise', () => {
    expect(parseRupeesToPaise('1,234.50')).toBe(123_450);
    expect(parseRupeesToPaise('12.345')).toBeNull();
  });

  it('formats with Indian digit grouping', () => {
    expect(formatMoney(10_000_000)).toBe('₹1,00,000');
    expect(formatMoney(-12_350)).toBe('-₹123.50');
  });
});
