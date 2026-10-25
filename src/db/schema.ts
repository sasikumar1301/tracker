import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  currencySymbol: text('currency_symbol').notNull().default('₹'),
  cycleStartDay: integer('cycle_start_day').notNull().default(1),
  reminderEnabled: integer('reminder_enabled', { mode: 'boolean' }).notNull().default(false),
  reminderTime: text('reminder_time').default('21:30'),
  alertThreshold: integer('alert_threshold').notNull().default(80),
  appLockEnabled: integer('app_lock_enabled', { mode: 'boolean' }).notNull().default(false),
});

export const budgets = sqliteTable('budgets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cycleStart: text('cycle_start').notNull().unique(),
  cycleEnd: text('cycle_end').notNull(),
  salary: integer('salary').notNull(),
  fixedExpenses: integer('fixed_expenses').notNull(),
  spendingBudget: integer('spending_budget').notNull(),
  savingsTarget: integer('savings_target').notNull(),
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  countsTowardBudget: integer('counts_toward_budget', { mode: 'boolean' }).notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
});

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  amount: integer('amount').notNull(),
  type: text('type', { enum: ['expense', 'refund'] }).notNull(),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id),
  description: text('description'),
  note: text('note'),
  source: text('source', { enum: ['manual', 'image'] }).notNull().default('manual'),
  fingerprint: text('fingerprint'),
  createdAt: text('created_at').notNull(),
});

export const dayTotals = sqliteTable('day_totals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  amount: integer('amount').notNull(),
});

export const savingsEntries = sqliteTable('savings_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  amount: integer('amount').notNull(),
  note: text('note'),
});

export const merchantRules = sqliteTable('merchant_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  keyword: text('keyword').notNull().unique(),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id),
});

export type Settings = typeof settings.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type DayTotal = typeof dayTotals.$inferSelect;
export type SavingsEntry = typeof savingsEntries.$inferSelect;
export type MerchantRule = typeof merchantRules.$inferSelect;
