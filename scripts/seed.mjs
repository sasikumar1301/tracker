import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(projectRoot, '.dev');
const databasePath = resolve(outputDirectory, 'dailybudget-demo.db');
mkdirSync(outputDirectory, { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA foreign_keys = ON;
  DROP TABLE IF EXISTS merchant_rules;
  DROP TABLE IF EXISTS savings_entries;
  DROP TABLE IF EXISTS day_totals;
  DROP TABLE IF EXISTS transactions;
  DROP TABLE IF EXISTS categories;
  DROP TABLE IF EXISTS budgets;
  DROP TABLE IF EXISTS settings;
  CREATE TABLE settings (
    id INTEGER PRIMARY KEY NOT NULL,
    currency_symbol TEXT NOT NULL DEFAULT '₹',
    cycle_start_day INTEGER NOT NULL DEFAULT 1,
    reminder_enabled INTEGER NOT NULL DEFAULT 0,
    reminder_time TEXT,
    alert_threshold INTEGER NOT NULL DEFAULT 0,
    app_lock_enabled INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    cycle_start TEXT NOT NULL UNIQUE,
    cycle_end TEXT NOT NULL,
    salary INTEGER NOT NULL,
    fixed_expenses INTEGER NOT NULL,
    spending_budget INTEGER NOT NULL,
    savings_target INTEGER NOT NULL
  );
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL UNIQUE,
    counts_toward_budget INTEGER NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    date TEXT NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    description TEXT,
    note TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    fingerprint TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE day_totals (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    date TEXT NOT NULL UNIQUE,
    amount INTEGER NOT NULL
  );
  CREATE TABLE savings_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    date TEXT NOT NULL,
    amount INTEGER NOT NULL,
    note TEXT
  );
  CREATE TABLE merchant_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    keyword TEXT NOT NULL UNIQUE,
    category_id INTEGER NOT NULL REFERENCES categories(id)
  );
`);

function localDate(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const now = new Date();
const year = now.getFullYear();
const month = now.getMonth();
const cycleStart = localDate(year, month, 1);
const cycleEnd = localDate(year, month, new Date(year, month + 1, 0).getDate());
database
  .prepare(
    `INSERT INTO settings
      (id, currency_symbol, cycle_start_day, reminder_enabled, reminder_time, alert_threshold, app_lock_enabled)
      VALUES (1, '₹', 1, 0, '21:30', 80, 0)`,
  )
  .run();
database
  .prepare(
    `INSERT INTO budgets
      (cycle_start, cycle_end, salary, fixed_expenses, spending_budget, savings_target)
      VALUES (?, ?, ?, ?, ?, ?)`,
  )
  .run(cycleStart, cycleEnd, 6_000_000, 2_000_000, 3_000_000, 1_000_000);

const categoryNames = [
  'Food',
  'Groceries',
  'Transport',
  'Shopping',
  'Bills',
  'Health',
  'Entertainment',
  'Other',
  'Fixed',
];
const insertCategory = database.prepare(
  'INSERT INTO categories (name, counts_toward_budget, is_default) VALUES (?, ?, 1)',
);
for (const name of categoryNames) insertCategory.run(name, name === 'Fixed' ? 0 : 1);

const categoryRows = database.prepare('SELECT id, name FROM categories').all();
const categoryIds = Object.fromEntries(categoryRows.map((row) => [row.name, row.id]));
const insertTransaction = database.prepare(
  `INSERT INTO transactions
    (date, amount, type, category_id, description, note, source, fingerprint, created_at)
    VALUES (?, ?, ?, ?, NULL, ?, 'manual', NULL, ?)`,
);
const samples = [
  ['Food', 18_000, 'Lunch'],
  ['Transport', 7_500, 'Metro and auto'],
  ['Groceries', 43_800, 'Weekly groceries'],
  ['Food', 6_500, 'Breakfast'],
  ['Shopping', 29_900, 'Household item'],
  ['Health', 22_000, 'Pharmacy'],
  ['Entertainment', 35_000, 'Movie night'],
  ['Food', 14_500, 'Dinner'],
  ['Transport', 9_000, 'Cab'],
  ['Bills', 48_000, 'Mobile bill'],
  ['Groceries', 31_250, 'Fresh produce'],
  ['Other', 12_000, 'Small purchase'],
  ['Food', 20_000, 'Lunch with friends'],
  ['Transport', 6_000, 'Bus pass'],
  ['Shopping', 17_500, 'Stationery'],
];
const createdAt = new Date().toISOString();
for (const [index, [category, amount, note]] of samples.entries()) {
  insertTransaction.run(
    localDate(year, month, index + 1),
    amount,
    'expense',
    categoryIds[category],
    note,
    createdAt,
  );
}
insertTransaction.run(
  localDate(year, month, 7),
  10_000,
  'refund',
  categoryIds.Shopping,
  'Returned item',
  createdAt,
);
database
  .prepare('INSERT INTO day_totals (date, amount) VALUES (?, ?)')
  .run(localDate(year, month, 4), 60_000);
database.close();

console.log(`Seeded 15 demo days, one day total, and one refund in ${databasePath}`);
