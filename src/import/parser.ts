import type { RecognizedLine } from './ocr';

export type ImportDirection = 'debit' | 'credit' | 'unknown';

export interface ParsedImportRow {
  date: string;
  description: string;
  amount: number;
  direction: ImportDirection;
  uncertain: boolean;
  raw: string;
}

export interface AmountCandidate {
  amount: number;
  raw: string;
  index: number;
}

interface DateMatch {
  date: string;
  raw: string;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
const MONTH_PATTERN =
  '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const CURRENCY_PATTERN = '(?:₹|Rs\.?|INR)';
const NUMBER_PATTERN =
  '(?:\\d{1,3}(?:,\\d{2})*,\\d{3}|\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?';
const AMOUNT_PATTERN = new RegExp(
  `[+\\-−]?\\s*(?:${CURRENCY_PATTERN}\\s*)?${NUMBER_PATTERN}(?:\\s*${CURRENCY_PATTERN})?`,
  'gi',
);

function validIsoDate(year: number, month: number, day: number): string | null {
  const value = new Date(Date.UTC(year, month - 1, day));
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function mostRecentDate(
  day: number,
  month: number,
  yearText: string | undefined,
  referenceDate: string,
): string | null {
  if (yearText) {
    const value = Number(yearText);
    const year = yearText.length === 2 ? (value <= 69 ? 2000 + value : 1900 + value) : value;
    return validIsoDate(year, month, day);
  }
  const referenceYear = Number(referenceDate.slice(0, 4));
  const currentYear = validIsoDate(referenceYear, month, day);
  if (currentYear && currentYear <= referenceDate) return currentYear;
  return validIsoDate(referenceYear - 1, month, day);
}

function findDate(text: string, referenceDate: string): DateMatch | null {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) {
    const date = validIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (date) return { date, raw: iso[0] };
  }

  const numeric = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})\b/.exec(text);
  if (numeric) {
    const date = mostRecentDate(
      Number(numeric[1]),
      Number(numeric[2]),
      numeric[3],
      referenceDate,
    );
    if (date) return { date, raw: numeric[0] };
  }

  const dayFirst = new RegExp(`\\b(\\d{1,2})\\s+${MONTH_PATTERN}(?:\\s+(\\d{4}))?\\b`, 'i').exec(
    text,
  );
  if (dayFirst) {
    const month = MONTHS[dayFirst[2]!.slice(0, 3).toLowerCase()];
    if (month) {
      const date = mostRecentDate(Number(dayFirst[1]), month, dayFirst[3], referenceDate);
      if (date) return { date, raw: dayFirst[0] };
    }
  }

  const monthFirst = new RegExp(
    `\\b${MONTH_PATTERN}\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?\\b`,
    'i',
  ).exec(text);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1]!.slice(0, 3).toLowerCase()];
    if (month) {
      const date = mostRecentDate(Number(monthFirst[2]), month, monthFirst[3], referenceDate);
      if (date) return { date, raw: monthFirst[0] };
    }
  }
  return null;
}

export function parseDate(text: string, referenceDate: string): string | null {
  return findDate(text, referenceDate)?.date ?? null;
}

function beforeRunningBalance(text: string): string {
  const match = /\b(?:available\s+)?(?:bal(?:ance)?)\b/i.exec(text);
  return match ? text.slice(0, match.index) : text;
}

function paiseFromToken(raw: string): number | null {
  const negative = /^[\s]*[\-−]/.test(raw);
  const numeric = raw.replace(/₹|rs\.?|inr/gi, '').replace(/[+\-−,\s]/g, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(numeric)) return null;
  const [whole = '0', fraction = ''] = numeric.split('.');
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(value)) return null;
  return negative ? -value : value;
}

export function parseAmounts(text: string, referenceDate = '2099-12-31'): AmountCandidate[] {
  const date = findDate(text, referenceDate);
  const withoutDate = date ? text.replace(date.raw, ' ') : text;
  const value = beforeRunningBalance(withoutDate);
  const candidates: AmountCandidate[] = [];
  AMOUNT_PATTERN.lastIndex = 0;
  for (const match of value.matchAll(AMOUNT_PATTERN)) {
    const matched = match[0];
    const leadingSpace = matched.length - matched.trimStart().length;
    const trailingSpace = matched.length - matched.trimEnd().length;
    const raw = matched.trim();
    const index = (match.index ?? 0) + leadingSpace;
    const previous = value[index - 1] ?? '';
    const next = value[index + raw.length + trailingSpace] ?? '';
    if (/[A-Za-z0-9]/.test(previous) || /[A-Za-z0-9]/.test(next)) continue;
    const digits = raw.replace(/\D/g, '');
    const marked = /₹|rs\.?|inr|[,.+\-−]/i.test(raw);
    const context = value.slice(Math.max(0, index - 12), index + raw.length + 12);
    const hasDirection = /\b(?:dr|cr|debit(?:ed)?|credit(?:ed)?)\b/i.test(context);
    const endsRow = value.slice(index + raw.length).trim().length === 0;
    if (!marked && !hasDirection && (!endsRow || digits.length > 6)) continue;
    const amount = paiseFromToken(raw);
    if (amount == null) continue;
    candidates.push({ amount: Math.abs(amount), raw, index });
  }
  return candidates;
}

export function detectDirection(text: string): ImportDirection {
  const debit = /(^|\s)[\-−]\s*(?:₹|rs\.?|inr|\d)|\b(?:dr|debit(?:ed)?|paid\s+to|sent\s+to)\b/i.test(
    text,
  );
  const credit = /(^|\s)\+\s*(?:₹|rs\.?|inr|\d)|\b(?:cr|credit(?:ed)?|received\s+from|refund)\b/i.test(
    text,
  );
  if (debit === credit) return 'unknown';
  return debit ? 'debit' : 'credit';
}

export function cleanDescription(text: string, referenceDate = '2099-12-31'): string {
  let value = beforeRunningBalance(text);
  const date = findDate(value, referenceDate);
  if (date) value = value.replace(date.raw, ' ');
  value = value
    .replace(
      /\b(?:upi\s*)?(?:ref(?:erence)?|rrn|utr|txn(?:action)?(?:\s*id)?|ref\s*no|id)\s*[:#/-]?\s*[A-Z0-9-]{5,}\b/gi,
      ' ',
    )
    .replace(/\b\d{7,}\b/g, ' ')
    .replace(AMOUNT_PATTERN, ' ')
    .replace(/^(?:\s*(?:UPI[-/]|POS\b|paid\s+to\b|sent\s+to\b|received\s+from\b))+/i, ' ')
    .replace(/\b(?:dr|cr|debit(?:ed)?|credit(?:ed)?|refund)\b/gi, ' ')
    .replace(/[|•·]/g, ' ')
    .replace(/\s*[-/:]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return value || 'Imported transaction';
}

function amountScore(candidate: AmountCandidate, text: string): number {
  let score = 0;
  if (/₹|rs\.?|inr/i.test(candidate.raw)) score += 4;
  if (/[,.]/.test(candidate.raw)) score += 2;
  if (/^[\s]*[+\-−]/.test(candidate.raw)) score += 2;
  if (text.slice(candidate.index + candidate.raw.length).trim().length === 0) score += 1;
  return score;
}

function parseRow(raw: string, inheritedDate: string, referenceDate: string): ParsedImportRow | null {
  const candidates = parseAmounts(raw, referenceDate);
  if (candidates.length === 0) return null;
  const picked = [...candidates].sort(
    (a, b) => amountScore(b, raw) - amountScore(a, raw) || b.index - a.index,
  )[0]!;
  const direction = detectDirection(raw);
  const date = parseDate(raw, referenceDate) ?? inheritedDate;
  return {
    date,
    description: cleanDescription(raw, referenceDate),
    amount: picked.amount,
    direction,
    uncertain: direction === 'unknown' || date.length === 0 || candidates.length > 1,
    raw,
  };
}

function groupPositionedLines(lines: readonly RecognizedLine[]): string[] {
  const sorted = [...lines].sort((a, b) => {
    const vertical = a.position!.top - b.position!.top;
    return Math.abs(vertical) > 3 ? vertical : a.position!.left - b.position!.left;
  });
  const groups: Array<{ center: number; height: number; lines: RecognizedLine[] }> = [];
  for (const line of sorted) {
    const center = line.position!.top + line.position!.height / 2;
    const existing = groups.find(
      (group) => Math.abs(group.center - center) <= Math.max(6, Math.min(group.height, line.position!.height) * 0.65),
    );
    if (existing) {
      existing.lines.push(line);
      existing.center = (existing.center * (existing.lines.length - 1) + center) / existing.lines.length;
    } else {
      groups.push({ center, height: line.position!.height, lines: [line] });
    }
  }
  return groups
    .sort((a, b) => a.center - b.center)
    .map((group) =>
      group.lines
        .sort((a, b) => a.position!.left - b.position!.left)
        .map((line) => line.text)
        .join(' '),
    );
}

function parsePositionedGroups(groups: readonly string[], referenceDate: string): ParsedImportRow[] {
  const rows: ParsedImportRow[] = [];
  let currentDate = '';
  for (const raw of groups) {
    const date = parseDate(raw, referenceDate);
    const amounts = parseAmounts(raw, referenceDate);
    if (date && amounts.length === 0) {
      currentDate = date;
      continue;
    }
    const row = parseRow(raw, currentDate, referenceDate);
    if (row) rows.push(row);
  }
  return rows;
}

function parseConsecutiveLines(lines: readonly RecognizedLine[], referenceDate: string): ParsedImportRow[] {
  const rows: ParsedImportRow[] = [];
  const buffer: string[] = [];
  let currentDate = '';

  const flush = () => {
    if (buffer.length === 0) return;
    const row = parseRow(buffer.join(' '), currentDate, referenceDate);
    if (row) rows.push(row);
    buffer.length = 0;
  };

  for (const line of lines) {
    const text = line.text.trim();
    if (!text) continue;
    const date = parseDate(text, referenceDate);
    const amounts = parseAmounts(text, referenceDate);
    if (date && amounts.length === 0 && text.replace(findDate(text, referenceDate)!.raw, '').trim().length <= 3) {
      flush();
      currentDate = date;
      continue;
    }
    if (date && buffer.length > 0) flush();
    buffer.push(text);
    if (amounts.length > 0) flush();
  }
  flush();
  return rows;
}

export function parseRecognizedLines(
  lines: readonly RecognizedLine[],
  referenceDate: string,
): ParsedImportRow[] {
  const cleanLines = lines.filter((line) => line.text.trim().length > 0);
  if (cleanLines.length === 0) return [];
  const hasCompletePositions = cleanLines.every((line) => line.position != null);
  return hasCompletePositions
    ? parsePositionedGroups(groupPositionedLines(cleanLines), referenceDate)
    : parseConsecutiveLines(cleanLines, referenceDate);
}
