export function toInteger(value: string): number | null {
  const trimmed = value.trim();

  // 1.  Only optional sign + digits
  if (!/^-?\d+$/.test(trimmed)) return null;

  // 2.  Convert
  const num = Number(trimmed);

  // 3.  Double-check it really is an integer and inside the safe range
  if (!Number.isInteger(num)) return null;     // NaN or 3.0000000000000004
  if (!Number.isSafeInteger(num)) return null; // >2^53-1 or < -(2^53-1)

  return num;
}