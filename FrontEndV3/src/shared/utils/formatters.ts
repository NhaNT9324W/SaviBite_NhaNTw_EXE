/** Formats VND consistently across Customer purchase screens. */
const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export function formatVnd(value: number): string {
  return currencyFormatter.format(value);
}
