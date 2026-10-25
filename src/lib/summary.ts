import {
  addDays,
  daysBetween,
  spentOnDay,
  type BudgetDayTotal,
  type BudgetTransaction,
  type Cycle,
  type LocalDate,
} from './budget';

export interface SummaryTransaction extends BudgetTransaction {
  categoryName: string;
}

export interface SummarySavingsEntry {
  date: LocalDate;
  amount: number;
}

export interface CategorySpending {
  category: string;
  amount: number;
}

export interface CycleSummaryInput {
  cycle: Cycle;
  today: LocalDate;
  spendingBudget: number;
  savingsTarget: number;
  transactions: readonly SummaryTransaction[];
  dayTotals: readonly BudgetDayTotal[];
  savingsEntries: readonly SummarySavingsEntry[];
}

export interface CycleSummary {
  totalSpent: number;
  remaining: number;
  overspent: number;
  spendingByCategory: CategorySpending[];
  averageDailySpending: number;
  daysElapsed: number;
  plannedSavings: number;
  loggedSavings: number;
}

export function getCycleSummary(input: CycleSummaryInput): CycleSummary {
  const { cycle, today, spendingBudget, savingsTarget, transactions, dayTotals, savingsEntries } =
    input;
  const totalsByDate = new Map(dayTotals.map((total) => [total.date, total.amount]));
  const fullCycleDays = daysBetween(cycle.start, cycle.end) + 1;
  const daysElapsed =
    today > cycle.end
      ? fullCycleDays
      : today < cycle.start
        ? 0
        : Math.min(fullCycleDays, daysBetween(cycle.start, today) + 1);

  let totalSpent = 0;
  let unitemized = 0;
  for (let offset = 0; offset < daysElapsed; offset += 1) {
    const date = addDays(cycle.start, offset);
    const detail = spentOnDay(date, transactions, totalsByDate.get(date));
    totalSpent += detail.spent;
    unitemized += detail.unitemized;
  }

  const categoryAmounts = new Map<string, number>();
  const reportEnd = today < cycle.end ? today : cycle.end;
  for (const transaction of transactions) {
    if (transaction.date < cycle.start || transaction.date > reportEnd) continue;
    const current = categoryAmounts.get(transaction.categoryName) ?? 0;
    if (transaction.type === 'refund') {
      categoryAmounts.set(transaction.categoryName, current - transaction.amount);
    } else if (transaction.countsTowardBudget) {
      categoryAmounts.set(transaction.categoryName, current + transaction.amount);
    }
  }
  if (unitemized > 0) categoryAmounts.set('Unitemized', unitemized);

  const spendingByCategory = [...categoryAmounts.entries()]
    .filter(([, amount]) => amount !== 0)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
  const loggedSavings = savingsEntries
    .filter((entry) => entry.date >= cycle.start && entry.date <= reportEnd)
    .reduce((sum, entry) => sum + entry.amount, 0);

  return {
    totalSpent,
    remaining: Math.max(0, spendingBudget - totalSpent),
    overspent: Math.max(0, totalSpent - spendingBudget),
    spendingByCategory,
    averageDailySpending: daysElapsed > 0 ? Math.floor(totalSpent / daysElapsed) : 0,
    daysElapsed,
    plannedSavings: savingsTarget,
    loggedSavings,
  };
}
