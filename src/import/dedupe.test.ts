import { describe, expect, it } from 'vitest';

import { assignFingerprints, findDuplicateMatches } from './dedupe';

const identicalRows = [
  { date: '2026-10-24', amount: 25_000, description: 'Zomato' },
  { date: '2026-10-24', amount: 25_000, description: 'Zomato' },
];

describe('import dedupe', () => {
  it('keeps identical rows in one import by assigning occurrence numbers', () => {
    const rows = assignFingerprints(identicalRows);
    expect(rows[0]?.fingerprint.endsWith('| 1')).toBe(true);
    expect(rows[1]?.fingerprint.endsWith('| 2')).toBe(true);
    expect(findDuplicateMatches(rows, []).map((match) => match.kind)).toEqual(['none', 'none']);
  });

  it('flags an exact prior fingerprint as already imported', () => {
    const rows = assignFingerprints(identicalRows.slice(0, 1));
    expect(
      findDuplicateMatches(rows, [
        {
          id: 8,
          date: rows[0]!.date,
          amount: rows[0]!.amount,
          source: 'image',
          fingerprint: rows[0]!.fingerprint,
        },
      ])[0],
    ).toEqual({ kind: 'already-imported', transactionId: 8 });
  });

  it('flags one matching manual transaction without consuming it twice', () => {
    const rows = assignFingerprints(identicalRows);
    const matches = findDuplicateMatches(rows, [
      {
        id: 4,
        date: '2026-10-24',
        amount: 25_000,
        source: 'manual',
        fingerprint: null,
      },
    ]);
    expect(matches).toEqual([
      { kind: 'manual-match', transactionId: 4 },
      { kind: 'none' },
    ]);
  });
});
