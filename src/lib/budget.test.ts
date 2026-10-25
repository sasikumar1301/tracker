import { describe, expect, it } from 'vitest';

import { getCycle, getDashboard, spentOnDay, type BudgetTransaction } from './budget';

const rupees = (value: number) => value * 100;
const cycle = {
  cycleStart: '2026-04-01',
  cycleEnd: '2026-04-30',
  spendingBudget: rupees(30_000),
};

function expense(
  date: string,
  amount: number,
  countsTowardBudget = true,
): BudgetTransaction {
  return { date, amount: rupees(amount), type: 'expense', countsTowardBudget };
}

describe('getDashboard', () => {
  it('allows ₹1,000 on day 1 of a 30-day cycle with ₹30,000', () => {
    const result = getDashboard({ ...cycle, today: '2026-04-01', transactions: [], dayTotals: [] });
    expect(result.allowance).toBe(rupees(1_000));
    expect(result.daysLeft).toBe(30);
  });

  it('allows ₹993 on day 2 after ₹1,200 spent on day 1', () => {
    const result = getDashboard({
      ...cycle,
      today: '2026-04-02',
      transactions: [expense('2026-04-01', 1_200)],
      dayTotals: [],
    });
    expect(result.allowance).toBe(rupees(993));
  });

  it('allows ₹1,010 on day 2 after ₹700 spent on day 1', () => {
    const result = getDashboard({
      ...cycle,
      today: '2026-04-02',
      transactions: [expense('2026-04-01', 700)],
      dayTotals: [],
    });
    expect(result.allowance).toBe(rupees(1_010));
  });

  it('uses a larger day total and reports its unitemized portion', () => {
    const transactions = [expense('2026-04-01', 40), expense('2026-04-01', 180)];
    const detail = spentOnDay('2026-04-01', transactions, rupees(1_000));
    expect(detail.spent).toBe(rupees(1_000));
    expect(detail.unitemized).toBe(rupees(780));

    const dashboard = getDashboard({
      ...cycle,
      today: '2026-04-02',
      transactions,
      dayTotals: [{ date: '2026-04-01', amount: rupees(1_000) }],
    });
    expect(dashboard.allowance).toBe(rupees(1_000));
  });

  it('uses entries when they exceed the day total', () => {
    const result = getDashboard({
      ...cycle,
      today: '2026-04-01',
      transactions: [expense('2026-04-01', 700)],
      dayTotals: [{ date: '2026-04-01', amount: rupees(500) }],
    });
    expect(result.spentToday).toBe(rupees(700));
    expect(result.unitemizedToday).toBe(0);
    expect(result.entriesExceedDayTotal).toBe(true);
  });

  it('subtracts refunds from spending', () => {
    const transactions: BudgetTransaction[] = [
      expense('2026-04-01', 300),
      { date: '2026-04-01', amount: rupees(100), type: 'refund', countsTowardBudget: true },
    ];
    expect(spentOnDay('2026-04-01', transactions, null).spent).toBe(rupees(200));
  });

  it('returns no allowance and a positive overspent amount after exhausting the budget', () => {
    const result = getDashboard({
      ...cycle,
      today: '2026-04-02',
      transactions: [expense('2026-04-01', 30_500)],
      dayTotals: [],
    });
    expect(result.allowance).toBe(0);
    expect(result.overspentAmount).toBe(rupees(500));
  });

  it('allows everything remaining on the last day', () => {
    const result = getDashboard({
      ...cycle,
      today: '2026-04-30',
      transactions: [expense('2026-04-01', 12_345)],
      dayTotals: [],
    });
    expect(result.allowance).toBe(rupees(17_655));
    expect(result.daysLeft).toBe(1);
  });

  it('keeps today allowance fixed while today spending changes left today', () => {
    const before = getDashboard({
      ...cycle,
      today: '2026-04-10',
      transactions: [],
      dayTotals: [],
    });
    const after = getDashboard({
      ...cycle,
      today: '2026-04-10',
      transactions: [expense('2026-04-10', 250)],
      dayTotals: [],
    });
    expect(after.allowance).toBe(before.allowance);
    expect(after.leftToday).toBe(before.leftToday - rupees(250));
  });

  it('ignores expenses in a non-budget category', () => {
    const result = getDashboard({
      ...cycle,
      today: '2026-04-01',
      transactions: [expense('2026-04-01', 900, false)],
      dayTotals: [],
    });
    expect(result.spentToday).toBe(0);
  });

  it('ignores a future entry until its date', () => {
    const transactions = [expense('2026-04-02', 900)];
    const dayOne = getDashboard({
      ...cycle,
      today: '2026-04-01',
      transactions,
      dayTotals: [],
    });
    const dayTwo = getDashboard({
      ...cycle,
      today: '2026-04-02',
      transactions,
      dayTotals: [],
    });
    expect(dayOne.spentToday).toBe(0);
    expect(dayOne.cycleBudgetLeft).toBe(rupees(30_000));
    expect(dayTwo.spentToday).toBe(rupees(900));
  });

  it('treats no entries and an explicit zero day total the same', () => {
    const empty = getDashboard({ ...cycle, today: '2026-04-01', transactions: [], dayTotals: [] });
    const zero = getDashboard({
      ...cycle,
      today: '2026-04-01',
      transactions: [],
      dayTotals: [{ date: '2026-04-01', amount: 0 }],
    });
    expect(zero).toEqual(empty);
  });
});

describe('getCycle', () => {
  it('uses the calendar month for start day 1, including leap February', () => {
    expect(getCycle('2028-02-12', 1)).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });

  it('places dates on either side of start day 15 correctly', () => {
    expect(getCycle('2026-10-14', 15)).toEqual({ start: '2026-09-15', end: '2026-10-14' });
    expect(getCycle('2026-10-15', 15)).toEqual({ start: '2026-10-15', end: '2026-11-14' });
  });

  it('crosses a year boundary for start day 20', () => {
    expect(getCycle('2026-12-25', 20)).toEqual({ start: '2026-12-20', end: '2027-01-19' });
  });

  it('rejects start days outside 1 to 28', () => {
    expect(() => getCycle('2026-04-01', 29)).toThrow();
  });
});
