export function parseRupeesToPaise(value: string): number | null {
  const normalized = value.replaceAll(',', '').trim();
  if (!/^(?:\d+)(?:\.\d{0,2})?$/.test(normalized)) return null;
  const [rupees = '0', fraction = ''] = normalized.split('.');
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(paise) ? paise : null;
}

export function paiseToInput(value: number): string {
  const rupees = Math.trunc(value / 100);
  const paise = Math.abs(value % 100);
  return paise === 0 ? String(rupees) : `${rupees}.${String(paise).padStart(2, '0')}`;
}

export function formatMoney(amount: number, symbol = '₹'): string {
  const sign = amount < 0 ? '-' : '';
  const absolutePaise = Math.abs(amount);
  const rupees = Math.floor(absolutePaise / 100);
  const paise = absolutePaise % 100;
  const formattedRupees = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(rupees);
  const fraction = paise === 0 ? '' : `.${String(paise).padStart(2, '0')}`;
  return `${sign}${symbol}${formattedRupees}${fraction}`;
}
