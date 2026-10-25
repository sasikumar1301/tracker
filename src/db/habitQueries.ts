import { getDashboard, type Dashboard } from '@/lib/budget';

import {
  getBudgetForDate,
  getDayTotals,
  getSettings,
  getTransactions,
  toBudgetTransactions,
} from './queries';

export interface DashboardAlertSnapshot {
  dashboard: Dashboard;
  spendingBudget: number;
  thresholdPercent: number;
}

export async function getDashboardAlertSnapshot(
  today: string,
): Promise<DashboardAlertSnapshot | null> {
  const [budget, settings] = await Promise.all([getBudgetForDate(today), getSettings()]);
  if (!budget) return null;
  const [transactions, dayTotals] = await Promise.all([
    getTransactions(budget.cycleStart, budget.cycleEnd),
    getDayTotals(budget.cycleStart, budget.cycleEnd),
  ]);
  return {
    dashboard: getDashboard({
      today,
      cycleStart: budget.cycleStart,
      cycleEnd: budget.cycleEnd,
      spendingBudget: budget.spendingBudget,
      transactions: toBudgetTransactions(transactions),
      dayTotals,
    }),
    spendingBudget: budget.spendingBudget,
    thresholdPercent:
      settings && settings.alertThreshold >= 50 && settings.alertThreshold <= 100
        ? settings.alertThreshold
        : 80,
  };
}
