import { BUILT_IN_MERCHANTS } from './merchants';

const NOISE_WORDS = new Set([
  'a',
  'an',
  'at',
  'by',
  'from',
  'india',
  'limited',
  'ltd',
  'merchant',
  'online',
  'payment',
  'private',
  'pvt',
  'the',
  'to',
  'transaction',
  'upi',
]);

export interface CategoryChoice {
  id: number;
  name: string;
}

export interface MerchantRuleChoice {
  keyword: string;
  categoryId: number;
}

export interface Categorization {
  keyword: string;
  categoryId: number;
  source: 'rule' | 'built-in' | 'fallback';
}

export function normalizeMerchantKeyword(description: string): string {
  const words = description
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word && !NOISE_WORDS.has(word));
  return words.slice(0, 2).join(' ');
}

export function categorizeDescription(
  description: string,
  rules: readonly MerchantRuleChoice[],
  categories: readonly CategoryChoice[],
): Categorization {
  const keyword = normalizeMerchantKeyword(description);
  const rule = rules.find((candidate) => candidate.keyword === keyword);
  if (rule) return { keyword, categoryId: rule.categoryId, source: 'rule' };

  const normalized = description.toLowerCase().replace(/[^a-z]+/g, ' ').trim();
  const builtIn = BUILT_IN_MERCHANTS.find((candidate) =>
    ` ${normalized.split(/\s+/).join(' ')} `.includes(` ${candidate.merchant} `),
  );
  if (builtIn) {
    const category = categories.find((candidate) => candidate.name === builtIn.category);
    if (category) return { keyword, categoryId: category.id, source: 'built-in' };
  }
  const other = categories.find((candidate) => candidate.name === 'Other') ?? categories[0];
  if (!other) throw new Error('No categories are available for imported transactions.');
  return { keyword, categoryId: other.id, source: 'fallback' };
}
