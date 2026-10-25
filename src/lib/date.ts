import { addDays, type LocalDate } from './budget';

export function todayLocal(): LocalDate {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isLocalDate(value: string): boolean {
  try {
    return addDays(value, 0) === value;
  } catch {
    return false;
  }
}
