import { addDays, daysBetween, type Cycle, type LocalDate } from './budget';

export interface AlertDashboardState {
  leftToday: number;
  cycleBudgetLeft: number;
}

export type ExpenseAlert = 'left-today' | 'cycle-threshold';

export function getCrossedExpenseAlerts(
  before: AlertDashboardState,
  after: AlertDashboardState,
  spendingBudget: number,
  thresholdPercent: number,
): ExpenseAlert[] {
  const alerts: ExpenseAlert[] = [];
  if (before.leftToday >= 0 && after.leftToday < 0) alerts.push('left-today');

  if (spendingBudget > 0 && thresholdPercent >= 50 && thresholdPercent <= 100) {
    const thresholdAmount = Math.ceil((spendingBudget * thresholdPercent) / 100);
    const beforeUsed = spendingBudget - before.cycleBudgetLeft;
    const afterUsed = spendingBudget - after.cycleBudgetLeft;
    if (beforeUsed < thresholdAmount && afterUsed >= thresholdAmount) {
      alerts.push('cycle-threshold');
    }
  }
  return alerts;
}

export function getMissingDays(
  cycle: Cycle,
  today: LocalDate,
  transactions: readonly { date: LocalDate }[],
  dayTotals: readonly { date: LocalDate }[],
): LocalDate[] {
  const lastEligibleDate = addDays(today, -1) < cycle.end ? addDays(today, -1) : cycle.end;
  if (lastEligibleDate < cycle.start) return [];

  const recordedDates = new Set([
    ...transactions.map((transaction) => transaction.date),
    ...dayTotals.map((total) => total.date),
  ]);
  const missing: LocalDate[] = [];
  const dayCount = daysBetween(cycle.start, lastEligibleDate) + 1;
  for (let offset = 0; offset < dayCount; offset += 1) {
    const date = addDays(cycle.start, offset);
    if (!recordedDates.has(date)) missing.push(date);
  }
  return missing;
}
