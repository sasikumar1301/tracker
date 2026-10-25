export interface FingerprintInput {
  date: string;
  amount: number;
  description: string;
}

export interface FingerprintedRow extends FingerprintInput {
  fingerprint: string;
}

export interface ExistingTransactionForDedupe {
  id: number;
  date: string;
  amount: number;
  source: 'manual' | 'image';
  fingerprint: string | null;
}

export type DuplicateMatch =
  | { kind: 'already-imported'; transactionId: number }
  | { kind: 'manual-match'; transactionId: number }
  | { kind: 'none' };

export function normalizeFingerprintDescription(description: string): string {
  return description.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function assignFingerprints<T extends FingerprintInput>(
  rows: readonly T[],
): Array<T & { fingerprint: string }> {
  const occurrences = new Map<string, number>();
  return rows.map((row) => {
    const base = `${row.date} | ${row.amount} | ${normalizeFingerprintDescription(row.description)}`;
    const occurrence = (occurrences.get(base) ?? 0) + 1;
    occurrences.set(base, occurrence);
    return { ...row, fingerprint: `${base} | ${occurrence}` };
  });
}

export function findDuplicateMatches(
  rows: readonly FingerprintedRow[],
  existing: readonly ExistingTransactionForDedupe[],
): DuplicateMatch[] {
  const usedManualIds = new Set<number>();
  return rows.map((row) => {
    const imported = existing.find(
      (transaction) =>
        transaction.fingerprint != null && transaction.fingerprint === row.fingerprint,
    );
    if (imported) return { kind: 'already-imported', transactionId: imported.id };
    const manual = existing.find(
      (transaction) =>
        transaction.source === 'manual' &&
        transaction.fingerprint == null &&
        transaction.date === row.date &&
        transaction.amount === row.amount &&
        !usedManualIds.has(transaction.id),
    );
    if (manual) {
      usedManualIds.add(manual.id);
      return { kind: 'manual-match', transactionId: manual.id };
    }
    return { kind: 'none' };
  });
}
