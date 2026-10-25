import { describe, expect, it } from 'vitest';

import { categorizeDescription, normalizeMerchantKeyword } from './categorize';

const categories = [
  { id: 1, name: 'Food' },
  { id: 2, name: 'Groceries' },
  { id: 3, name: 'Transport' },
  { id: 4, name: 'Other' },
];

describe('merchant categorization', () => {
  it('normalizes letters, drops noise, and keeps two meaningful words', () => {
    expect(normalizeMerchantKeyword('UPI / The Coffee House Pvt Ltd 1234')).toBe('coffee house');
  });

  it('uses user rules before built-in mappings', () => {
    expect(
      categorizeDescription('Swiggy order', [{ keyword: 'swiggy order', categoryId: 4 }], categories),
    ).toMatchObject({ categoryId: 4, source: 'rule' });
  });

  it('maps common merchants and falls back to Other', () => {
    expect(categorizeDescription('Paid to Zomato', [], categories)).toMatchObject({
      categoryId: 1,
      source: 'built-in',
    });
    expect(categorizeDescription('Uber India', [], categories)).toMatchObject({
      categoryId: 3,
      source: 'built-in',
    });
    expect(categorizeDescription('Neighbourhood bakery', [], categories)).toMatchObject({
      categoryId: 4,
      source: 'fallback',
    });
  });
});
