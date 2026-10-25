import { describe, expect, it } from 'vitest';

import { getCrossedExpenseAlerts, getMissingDays } from './habits';

describe('getCrossedExpenseAlerts', () => {
  it('reports when left today crosses below zero', () => {
    expect(
      getCrossedExpenseAlerts(
        { leftToday: 100, cycleBudgetLeft: 5_000 },
        { leftToday: -1, cycleBudgetLeft: 4_899 },
        10_000,
        80,
      ),
    ).toContain('left-today');
  });

  it('reports a threshold only on the crossing save', () => {
    expect(
      getCrossedExpenseAlerts(
        { leftToday: 100, cycleBudgetLeft: 2_100 },
        { leftToday: 50, cycleBudgetLeft: 1_900 },
        10_000,
        80,
      ),
    ).toContain('cycle-threshold');
    expect(
      getCrossedExpenseAlerts(
        { leftToday: 50, cycleBudgetLeft: 1_900 },
        { leftToday: 0, cycleBudgetLeft: 1_500 },
        10_000,
        80,
      ),
    ).not.toContain('cycle-threshold');
  });

  it('can report both crossings from one save', () => {
    expect(
      getCrossedExpenseAlerts(
        { leftToday: 100, cycleBudgetLeft: 2_100 },
        { leftToday: -100, cycleBudgetLeft: 1_900 },
        10_000,
        80,
      ),
    ).toEqual(['left-today', 'cycle-threshold']);
  });
});

describe('getMissingDays', () => {
  const cycle = { start: '2026-10-01', end: '2026-10-31' };

  it('returns only past cycle days without a transaction or total', () => {
    expect(
      getMissingDays(
        cycle,
        '2026-10-05',
        [{ date: '2026-10-01' }, { date: '2026-10-03' }],
        [{ date: '2026-10-02' }],
      ),
    ).toEqual(['2026-10-04']);
  });

  it('treats an explicit zero day total as recorded', () => {
    expect(getMissingDays(cycle, '2026-10-03', [], [{ date: '2026-10-01' }])).toEqual([
      '2026-10-02',
    ]);
  });

  it('returns no dates on the first day of a cycle', () => {
    expect(getMissingDays(cycle, '2026-10-01', [], [])).toEqual([]);
  });
});
