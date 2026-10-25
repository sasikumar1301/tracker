import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';

import {
  findDuplicateMatches,
  type ExistingTransactionForDedupe,
  type FingerprintedRow,
} from '@/import/dedupe';

import { db, sqlite } from './client';
import * as schema from './schema';
import { merchantRules, transactions, type MerchantRule } from './schema';

export interface ImportRuleUpdate {
  keyword: string;
  categoryId: number;
}

export interface ImportSaveRow extends FingerprintedRow {
  categoryId: number;
  type: 'expense' | 'refund';
  duplicateAction: 'insert' | 'merge' | 'keep';
}

export interface ImportSaveResult {
  added: number;
  merged: number;
  duplicatesSkipped: number;
}

export async function getMerchantRules(): Promise<MerchantRule[]> {
  return db.select().from(merchantRules);
}

export async function getTransactionsForDedupe(): Promise<ExistingTransactionForDedupe[]> {
  return db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      source: transactions.source,
      fingerprint: transactions.fingerprint,
    })
    .from(transactions);
}

export async function saveImportedTransactions(
  rows: readonly ImportSaveRow[],
  ruleUpdates: readonly ImportRuleUpdate[],
): Promise<ImportSaveResult> {
  const result: ImportSaveResult = { added: 0, merged: 0, duplicatesSkipped: 0 };
  await sqlite.withExclusiveTransactionAsync(async (transaction) => {
    const transactionDb = drizzle(transaction, { schema });
    const existing = await transactionDb
      .select({
        id: transactions.id,
        date: transactions.date,
        amount: transactions.amount,
        source: transactions.source,
        fingerprint: transactions.fingerprint,
      })
      .from(transactions);
    const matches = findDuplicateMatches(rows, existing);
    for (const [index, row] of rows.entries()) {
      const match = matches[index]!;
      if (match.kind === 'already-imported') {
        result.duplicatesSkipped += 1;
        continue;
      }
      if (match.kind === 'manual-match' && row.duplicateAction !== 'keep') {
        if (row.duplicateAction === 'merge') {
          await transactionDb
            .update(transactions)
            .set({ fingerprint: row.fingerprint })
            .where(eq(transactions.id, match.transactionId));
          result.merged += 1;
        } else {
          result.duplicatesSkipped += 1;
        }
        continue;
      }
      await transactionDb.insert(transactions).values({
        date: row.date,
        amount: row.amount,
        type: row.type,
        categoryId: row.categoryId,
        description: row.description,
        note: null,
        source: 'image',
        fingerprint: row.fingerprint,
        createdAt: new Date().toISOString(),
      });
      result.added += 1;
    }

    for (const rule of ruleUpdates) {
      if (!rule.keyword) continue;
      await transactionDb
        .insert(merchantRules)
        .values(rule)
        .onConflictDoUpdate({
          target: merchantRules.keyword,
          set: { categoryId: rule.categoryId },
        });
    }
  });
  return result;
}
