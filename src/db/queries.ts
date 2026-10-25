import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';

import type { BudgetTransaction } from '@/lib/budget';

import { db, sqlite } from './client';
import {
  budgets,
  categories,
  dayTotals,
  merchantRules,
  savingsEntries,
  settings,
  transactions,
  type Budget,
  type Category,
  type DayTotal,
  type SavingsEntry,
  type Settings,
  type Transaction,
} from './schema';
import * as schema from './schema';

const DEFAULT_CATEGORIES = [
  'Food',
  'Groceries',
  'Transport',
  'Shopping',
  'Bills',
  'Health',
  'Entertainment',
  'Other',
] as const;

export interface SetupValues {
  currencySymbol: string;
  cycleStartDay: number;
  cycleStart: string;
  cycleEnd: string;
  salary: number;
  fixedExpenses: number;
  spendingBudget: number;
  savingsTarget: number;
}

export interface TransactionWithCategory extends Transaction {
  categoryName: string;
  countsTowardBudget: boolean;
}

export async function seedDefaultCategories(): Promise<void> {
  await db
    .insert(categories)
    .values([
      ...DEFAULT_CATEGORIES.map((name) => ({
        name,
        countsTowardBudget: true,
        isDefault: true,
      })),
      { name: 'Fixed', countsTowardBudget: false, isDefault: true },
    ])
    .onConflictDoNothing();
}

export async function getSettings(): Promise<Settings | null> {
  const rows = await db.select().from(settings).limit(1);
  return rows[0] ?? null;
}

export async function getCategories(): Promise<Category[]> {
  return db.select().from(categories).orderBy(asc(categories.id));
}

export async function saveInitialSetup(values: SetupValues): Promise<void> {
  await sqlite.withTransactionAsync(async () => {
    await db.insert(settings).values({
      id: 1,
      currencySymbol: values.currencySymbol,
      cycleStartDay: values.cycleStartDay,
      reminderEnabled: false,
      reminderTime: '21:30',
      alertThreshold: 80,
      appLockEnabled: false,
    });
    await db.insert(budgets).values({
      cycleStart: values.cycleStart,
      cycleEnd: values.cycleEnd,
      salary: values.salary,
      fixedExpenses: values.fixedExpenses,
      spendingBudget: values.spendingBudget,
      savingsTarget: values.savingsTarget,
    });
  });
}

export async function getBudgetForDate(date: string): Promise<Budget | null> {
  const rows = await db
    .select()
    .from(budgets)
    .where(and(lte(budgets.cycleStart, date), gte(budgets.cycleEnd, date)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLatestBudget(): Promise<Budget | null> {
  const rows = await db.select().from(budgets).orderBy(desc(budgets.cycleEnd)).limit(1);
  return rows[0] ?? null;
}

export async function getBudgets(): Promise<Budget[]> {
  return db.select().from(budgets).orderBy(desc(budgets.cycleEnd));
}

export async function updateBudget(
  id: number,
  values: Pick<Budget, 'salary' | 'fixedExpenses' | 'spendingBudget' | 'savingsTarget'>,
): Promise<void> {
  await db.update(budgets).set(values).where(eq(budgets.id, id));
}

export async function updateSettings(values: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await db.update(settings).set(values).where(eq(settings.id, 1));
}

export async function createBudget(values: Omit<Budget, 'id'>): Promise<void> {
  await db.insert(budgets).values(values);
}

export async function getTransactions(
  startDate?: string,
  endDate?: string,
): Promise<TransactionWithCategory[]> {
  const conditions = [
    startDate ? gte(transactions.date, startDate) : undefined,
    endDate ? lte(transactions.date, endDate) : undefined,
  ].filter((condition) => condition !== undefined);
  const rows = await db
    .select({
      transaction: transactions,
      categoryName: categories.name,
      countsTowardBudget: categories.countsTowardBudget,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(transactions.date), desc(transactions.id));
  return rows.map((row) => ({
    ...row.transaction,
    categoryName: row.categoryName,
    countsTowardBudget: row.countsTowardBudget,
  }));
}

export async function getTransaction(id: number): Promise<TransactionWithCategory | null> {
  const rows = await db
    .select({
      transaction: transactions,
      categoryName: categories.name,
      countsTowardBudget: categories.countsTowardBudget,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(eq(transactions.id, id))
    .limit(1);
  const row = rows[0];
  return row
    ? { ...row.transaction, categoryName: row.categoryName, countsTowardBudget: row.countsTowardBudget }
    : null;
}

export async function saveTransaction(values: {
  id?: number;
  date: string;
  amount: number;
  type: 'expense' | 'refund';
  categoryId: number;
  note: string | null;
}): Promise<void> {
  const row = {
    date: values.date,
    amount: values.amount,
    type: values.type,
    categoryId: values.categoryId,
    note: values.note,
    description: null,
    source: 'manual' as const,
    fingerprint: null,
    createdAt: new Date().toISOString(),
  };
  if (values.id == null) {
    await db.insert(transactions).values(row);
  } else {
    await db.update(transactions).set(row).where(eq(transactions.id, values.id));
  }
}

export async function deleteTransaction(id: number): Promise<void> {
  await db.delete(transactions).where(eq(transactions.id, id));
}

export async function getDayTotals(startDate?: string, endDate?: string): Promise<DayTotal[]> {
  const conditions = [
    startDate ? gte(dayTotals.date, startDate) : undefined,
    endDate ? lte(dayTotals.date, endDate) : undefined,
  ].filter((condition) => condition !== undefined);
  return db
    .select()
    .from(dayTotals)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(dayTotals.date));
}

export async function getDayTotal(date: string): Promise<DayTotal | null> {
  const rows = await db.select().from(dayTotals).where(eq(dayTotals.date, date)).limit(1);
  return rows[0] ?? null;
}

export async function saveDayTotal(date: string, amount: number): Promise<void> {
  await db
    .insert(dayTotals)
    .values({ date, amount })
    .onConflictDoUpdate({ target: dayTotals.date, set: { amount } });
}

export async function getSavingsEntries(
  startDate?: string,
  endDate?: string,
): Promise<SavingsEntry[]> {
  const conditions = [
    startDate ? gte(savingsEntries.date, startDate) : undefined,
    endDate ? lte(savingsEntries.date, endDate) : undefined,
  ].filter((condition) => condition !== undefined);
  return db
    .select()
    .from(savingsEntries)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(savingsEntries.date), desc(savingsEntries.id));
}

export async function saveSavingsEntry(values: {
  date: string;
  amount: number;
  note: string | null;
}): Promise<void> {
  await db.insert(savingsEntries).values(values);
}

export async function deleteSavingsEntry(id: number): Promise<void> {
  await db.delete(savingsEntries).where(eq(savingsEntries.id, id));
}

export async function deleteAllData(): Promise<void> {
  await sqlite.withExclusiveTransactionAsync(async (transaction) => {
    const transactionDb = drizzle(transaction, { schema });
    await transactionDb.delete(merchantRules);
    await transactionDb.delete(savingsEntries);
    await transactionDb.delete(dayTotals);
    await transactionDb.delete(transactions);
    await transactionDb.delete(budgets);
    await transactionDb.delete(settings);
    await transactionDb.delete(categories);
    await transactionDb.insert(categories).values([
      ...DEFAULT_CATEGORIES.map((name) => ({
        name,
        countsTowardBudget: true,
        isDefault: true,
      })),
      { name: 'Fixed', countsTowardBudget: false, isDefault: true },
    ]);
  });
}

export function toBudgetTransactions(rows: readonly TransactionWithCategory[]): BudgetTransaction[] {
  return rows.map((row) => ({
    date: row.date,
    amount: row.amount,
    type: row.type,
    countsTowardBudget: row.countsTowardBudget,
  }));
}
