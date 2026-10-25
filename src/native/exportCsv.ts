import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getDayTotals, getSavingsEntries, getTransactions } from '@/db/queries';

function csvCell(value: string | number | null): string {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvRow(values: readonly (string | number | null)[]): string {
  return values.map(csvCell).join(',');
}

function rupees(amount: number): string {
  return (amount / 100).toFixed(2);
}

async function shareCsv(name: string, rows: readonly string[]): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  try {
    await file.write(`${rows.join('\r\n')}\r\n`);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: `Export ${name}` });
  } finally {
    if (file.exists) file.delete();
  }
}

export async function exportAllCsvFiles(): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('The system share sheet is unavailable on this device.');
  }
  const [transactions, dayTotals, savings] = await Promise.all([
    getTransactions(),
    getDayTotals(),
    getSavingsEntries(),
  ]);

  await shareCsv('dailybudget-transactions.csv', [
    csvRow(['date', 'amount_rupees', 'type', 'category', 'description', 'note', 'source']),
    ...transactions.map((row) =>
      csvRow([
        row.date,
        rupees(row.amount),
        row.type,
        row.categoryName,
        row.description,
        row.note,
        row.source,
      ]),
    ),
  ]);
  await shareCsv('dailybudget-day-totals.csv', [
    csvRow(['date', 'amount_rupees']),
    ...dayTotals.map((row) => csvRow([row.date, rupees(row.amount)])),
  ]);
  await shareCsv('dailybudget-savings.csv', [
    csvRow(['date', 'amount_rupees', 'note']),
    ...savings.map((row) => csvRow([row.date, rupees(row.amount), row.note])),
  ]);
}
