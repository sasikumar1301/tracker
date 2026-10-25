export type LocalDate = string;
export type TransactionType = 'expense' | 'refund';

export interface BudgetTransaction {
  date: LocalDate;
  amount: number;
  type: TransactionType;
  countsTowardBudget: boolean;
}

export interface BudgetDayTotal {
  date: LocalDate;
  amount: number;
}

export interface Cycle {
  start: LocalDate;
  end: LocalDate;
}

export interface DaySpending {
  itemized: number;
  refunds: number;
  spent: number;
  unitemized: number;
  entriesExceedDayTotal: boolean;
}

export interface DashboardInput {
  today: LocalDate;
  cycleStart: LocalDate;
  cycleEnd: LocalDate;
  spendingBudget: number;
  transactions: readonly BudgetTransaction[];
  dayTotals: readonly BudgetDayTotal[];
}

export interface Dashboard {
  allowance: number;
  spentToday: number;
  leftToday: number;
  overToday: number;
  cycleBudgetLeft: number;
  overspentAmount: number;
  daysLeft: number;
  unitemizedToday: number;
  entriesExceedDayTotal: boolean;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_IN_MS = 86_400_000;

function toDate(value: LocalDate): Date {
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Invalid local date: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const result = new Date(Date.UTC(year, month - 1, day));
  if (
    result.getUTCFullYear() !== year ||
    result.getUTCMonth() !== month - 1 ||
    result.getUTCDate() !== day
  ) {
    throw new Error(`Invalid local date: ${value}`);
  }
  return result;
}

function fromDate(value: Date): LocalDate {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date: LocalDate, amount: number): LocalDate {
  const value = toDate(date);
  value.setUTCDate(value.getUTCDate() + amount);
  return fromDate(value);
}

export function daysBetween(start: LocalDate, end: LocalDate): number {
  return Math.round((toDate(end).getTime() - toDate(start).getTime()) / DAY_IN_MS);
}

function startOfCycleMonth(date: Date, startDay: number): Date {
  const monthOffset = date.getUTCDate() < startDay ? -1 : 0;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, startDay));
}

export function getCycle(date: LocalDate, startDay: number): Cycle {
  if (!Number.isInteger(startDay) || startDay < 1 || startDay > 28) {
    throw new Error('Cycle start day must be an integer from 1 to 28.');
  }

  const startDate = startOfCycleMonth(toDate(date), startDay);
  const nextStart = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, startDay),
  );
  nextStart.setUTCDate(nextStart.getUTCDate() - 1);
  return { start: fromDate(startDate), end: fromDate(nextStart) };
}

export function spentOnDay(
  date: LocalDate,
  transactions: readonly BudgetTransaction[],
  dayTotal: number | null | undefined,
): DaySpending {
  let itemized = 0;
  let refunds = 0;

  for (const transaction of transactions) {
    if (transaction.date !== date) continue;
    if (transaction.type === 'refund') {
      refunds += transaction.amount;
    } else if (transaction.countsTowardBudget) {
      itemized += transaction.amount;
    }
  }

  const reconciledTotal = dayTotal ?? 0;
  return {
    itemized,
    refunds,
    spent: Math.max(itemized, reconciledTotal) - refunds,
    unitemized: Math.max(0, reconciledTotal - itemized),
    entriesExceedDayTotal: dayTotal != null && itemized > dayTotal,
  };
}

export function getDashboard(input: DashboardInput): Dashboard {
  const { today, cycleStart, cycleEnd, spendingBudget, transactions, dayTotals } = input;
  const daysFromStart = daysBetween(cycleStart, today);
  const daysLeft = daysBetween(today, cycleEnd) + 1;
  if (daysFromStart < 0 || daysLeft < 1) {
    throw new Error('Today must be inside the supplied budget cycle.');
  }

  const totalsByDate = new Map(dayTotals.map((total) => [total.date, total.amount]));
  let spentBeforeToday = 0;
  for (let offset = 0; offset < daysFromStart; offset += 1) {
    const date = addDays(cycleStart, offset);
    spentBeforeToday += spentOnDay(date, transactions, totalsByDate.get(date)).spent;
  }

  const todaySpending = spentOnDay(today, transactions, totalsByDate.get(today));
  const budgetAtStartOfToday = spendingBudget - spentBeforeToday;
  const rawAllowance =
    Math.floor(Math.max(0, budgetAtStartOfToday) / daysLeft / 100) * 100;
  const cycleBudgetLeft = budgetAtStartOfToday - todaySpending.spent;
  const overspentAmount = Math.max(0, -cycleBudgetLeft);
  const allowance = overspentAmount > 0 ? 0 : rawAllowance;
  const leftToday = allowance - todaySpending.spent;

  return {
    allowance,
    spentToday: todaySpending.spent,
    leftToday,
    overToday: Math.max(0, -leftToday),
    cycleBudgetLeft,
    overspentAmount,
    daysLeft,
    unitemizedToday: todaySpending.unitemized,
    entriesExceedDayTotal: todaySpending.entriesExceedDayTotal,
  };
}
