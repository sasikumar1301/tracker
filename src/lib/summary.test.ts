import { describe, expect, it } from 'vitest';

import { getCycleSummary, type SummaryTransaction } from './summary';

const cycle = { start: '2026-10-01', end: '2026-10-04' };
const transaction = (
  date: string,
  amount: number,
  categoryName: string,
  type: 'expense' | 'refund' = 'expense',
): SummaryTransaction => ({ date, amount, categoryName, type, countsTowardBudget: true });

describe('getCycleSummary', () => {
  it('calculates spending, unitemized amounts, categories, and current-cycle average', () => {
    const summary = getCycleSummary({
      cycle,
      today: '2026-10-02',
      spendingBudget: 10_000,
      savingsTarget: 3_000,
      transactions: [
        transaction('2026-10-01', 2_000, 'Food'),
        transaction('2026-10-01', 500, 'Food', 'refund'),
        transaction('2026-10-02', 1_000, 'Transport'),
      ],
      dayTotals: [{ date: '2026-10-02', amount: 1_500 }],
      savingsEntries: [{ date: '2026-10-02', amount: 1_200 }],
    });

    expect(summary.totalSpent).toBe(3_000);
    expect(summary.remaining).toBe(7_000);
    expect(summary.averageDailySpending).toBe(1_500);
    expect(summary.spendingByCategory).toEqual([
      { category: 'Food', amount: 1_500 },
      { category: 'Transport', amount: 1_000 },
      { category: 'Unitemized', amount: 500 },
    ]);
    expect(summary.loggedSavings).toBe(1_200);
    expect(summary.plannedSavings).toBe(3_000);
  });

  it('uses the full cycle length for a finished cycle and reports overspending', () => {
    const summary = getCycleSummary({
      cycle,
      today: '2026-10-10',
      spendingBudget: 1_000,
      savingsTarget: 0,
      transactions: [transaction('2026-10-01', 2_000, 'Food')],
      dayTotals: [],
      savingsEntries: [],
    });
    expect(summary.daysElapsed).toBe(4);
    expect(summary.averageDailySpending).toBe(500);
    expect(summary.remaining).toBe(0);
    expect(summary.overspent).toBe(1_000);
  });

  it('does not count a non-budget expense in summary spending', () => {
    const fixed = { ...transaction('2026-10-01', 9_000, 'Fixed'), countsTowardBudget: false };
    const summary = getCycleSummary({
      cycle,
      today: '2026-10-01',
      spendingBudget: 10_000,
      savingsTarget: 0,
      transactions: [fixed],
      dayTotals: [],
      savingsEntries: [],
    });
    expect(summary.totalSpent).toBe(0);
    expect(summary.spendingByCategory).toEqual([]);
  });
});
