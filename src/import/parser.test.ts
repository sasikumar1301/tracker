import { describe, expect, it } from 'vitest';

import bankHistory from './__fixtures__/bank-history.txt?raw';
import statementTable from './__fixtures__/statement-table.txt?raw';
import upiList from './__fixtures__/upi-list.txt?raw';

import type { RecognizedLine } from './ocr';
import {
  cleanDescription,
  detectDirection,
  parseAmounts,
  parseDate,
  parseRecognizedLines,
} from './parser';

function fixture(name: string): RecognizedLine[] {
  const fixtures: Record<string, string> = {
    'bank-history.txt': bankHistory,
    'statement-table.txt': statementTable,
    'upi-list.txt': upiList,
  };
  return fixtures[name]!
    .trim()
    .split(/\r?\n/)
    .map((text) => ({ text }));
}

describe('amount parsing', () => {
  it('supports Indian grouping, currency variants, signs, and optional decimals', () => {
    expect(parseAmounts('Paid INR 1,23,456.78')[0]?.amount).toBe(12_345_678);
    expect(parseAmounts('1,250 Rs.')[0]?.amount).toBe(125_000);
    expect(parseAmounts('Refund +₹99')[0]?.amount).toBe(9_900);
    expect(parseAmounts('Debited − Rs 40.5')[0]?.amount).toBe(4_050);
  });

  it('ignores a labelled running balance', () => {
    expect(parseAmounts('₹250 Dr Balance ₹12,400')).toEqual([
      expect.objectContaining({ amount: 25_000 }),
    ]);
  });
});

describe('date parsing', () => {
  it.each([
    ['24 Oct 2026', '2026-10-24'],
    ['Oct 24, 2026', '2026-10-24'],
    ['24/10/2026', '2026-10-24'],
    ['24-10-26', '2026-10-24'],
    ['2026-10-24', '2026-10-24'],
  ])('parses %s', (text, expected) => {
    expect(parseDate(text, '2026-10-30')).toBe(expected);
  });

  it('uses the most recent non-future year when the year is missing', () => {
    expect(parseDate('24 Oct', '2026-10-23')).toBe('2025-10-24');
    expect(parseDate('22 Oct', '2026-10-23')).toBe('2026-10-22');
  });
});

describe('description and direction', () => {
  it('removes payment prefixes and reference noise', () => {
    expect(cleanDescription('24 Oct 2026 UPI-SWIGGY UTR 123456789012 ₹450 Dr')).toBe(
      'SWIGGY',
    );
  });

  it('recognizes debit, credit, and unknown directions', () => {
    expect(detectDirection('Paid to Zomato ₹325')).toBe('debit');
    expect(detectDirection('Refund +₹500')).toBe('credit');
    expect(detectDirection('Coffee ₹80')).toBe('unknown');
  });
});

describe('synthetic screenshot fixtures', () => {
  it('parses a bank app history with Dr and Cr markers', () => {
    const rows = parseRecognizedLines(fixture('bank-history.txt'), '2026-10-24');
    expect(rows).toHaveLength(3);
    expect(rows.map(({ date, amount, direction }) => ({ date, amount, direction }))).toEqual([
      { date: '2026-10-24', amount: 45_000, direction: 'debit' },
      { date: '2026-10-24', amount: 200_000, direction: 'credit' },
      { date: '2026-10-23', amount: 129_900, direction: 'debit' },
    ]);
  });

  it('applies UPI date headers to rows below them', () => {
    const rows = parseRecognizedLines(fixture('upi-list.txt'), '2026-10-24');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ date: '2026-10-24', description: 'Zomato', direction: 'debit' });
    expect(rows[2]).toMatchObject({ date: '2026-10-23', direction: 'credit', amount: 50_000 });
  });

  it('groups positioned columns into visual rows', () => {
    const lines: RecognizedLine[] = [
      { text: '24 Oct 2026', position: { left: 0, top: 0, width: 90, height: 12 } },
      { text: 'Swiggy', position: { left: 0, top: 24, width: 80, height: 12 } },
      { text: '₹450 Dr', position: { left: 220, top: 24, width: 70, height: 12 } },
      { text: 'Uber', position: { left: 0, top: 48, width: 70, height: 12 } },
      { text: '₹210 Dr', position: { left: 220, top: 48, width: 70, height: 12 } },
    ];
    const rows = parseRecognizedLines(lines, '2026-10-24');
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => ({ date: row.date, description: row.description }))).toEqual([
      { date: '2026-10-24', description: 'Swiggy' },
      { date: '2026-10-24', description: 'Uber' },
    ]);
  });

  it('parses a statement table and ignores each balance', () => {
    const rows = parseRecognizedLines(fixture('statement-table.txt'), '2026-10-24');
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.amount)).toEqual([123_450, 45_000, 5_000_000]);
    expect(rows.map((row) => row.description)).toEqual(['DMART', 'UBER', 'Salary ACME']);
  });

  it('marks missing dates, unknown directions, and multiple amounts as uncertain', () => {
    const rows = parseRecognizedLines(
      [{ text: 'Coffee ₹80 fee ₹5' }],
      '2026-10-24',
    );
    expect(rows[0]).toMatchObject({ date: '', direction: 'unknown', uncertain: true });
  });
});
