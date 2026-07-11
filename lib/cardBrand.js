// Card brand detection from BIN (bank identification number) prefixes.
// Runs client-side on the raw card number before it's tokenized away.
export function detectCardBrand(number) {
  const digits = (number || '').replace(/\D/g, '');
  if (!digits) return 'Unknown';
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^(6011|65|64[4-9]|622)/.test(digits)) return 'Discover';
  return 'Other';
}
