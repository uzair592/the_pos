/**
 * Utility to format Pakistani Rupee currency according to strict ERP standards:
 * - Always displays "Rs." prefix (never "$")
 * - Formats with Pakistani/Indian locale grouping (or en-PK standard)
 * - Always 2 decimal places by default
 * - Consistent monospace/tabular-nums alignment
 */
export function formatPKR(
  amount: number | string | null | undefined,
  options?: { hideDecimals?: boolean; prefix?: boolean }
): string {
  const val = Number(amount ?? 0);
  if (isNaN(val)) return 'Rs. 0.00';

  const decimals = options?.hideDecimals ? 0 : 2;
  const formatted = val.toLocaleString('en-PK', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const prefix = options?.prefix === false ? '' : 'Rs. ';
  return `${prefix}${formatted}`;
}

export default formatPKR;
