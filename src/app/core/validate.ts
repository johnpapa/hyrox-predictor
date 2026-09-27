/**
 * Field-level checks for what people type. Each returns the parsed value or a short, specific
 * message that says how to fix it (shown in red under the field).
 */
export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

export interface NumberRules {
  /** Whole numbers only (reps, age, pull-ups). */
  integer?: boolean;
  /** Whether 0 is a valid answer (e.g. zero weekly runs). */
  allowZero?: boolean;
}

/** A number as typed ("7", "22.5", "22,5"); blank means "not sure" (null). */
export function checkNumber(text: string, rules: NumberRules = {}): Checked<number | null> {
  const t = text.trim().replace(',', '.');
  if (t === '') return { ok: true, value: null };
  if (/^[-−]/.test(t) && /^[-−]\s*\d*\.?\d+$/.test(t)) return { ok: false, error: "Can't be negative" };
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return { ok: false, error: rules.integer ? 'Enter a whole number, e.g. 12' : 'Enter a number, e.g. 12 or 12.5' };
  const n = parseFloat(t);
  if (rules.integer && !Number.isInteger(n)) return { ok: false, error: 'Enter a whole number, e.g. 12' };
  if (n === 0 && !rules.allowZero) return { ok: false, error: 'Must be more than 0' };
  return { ok: true, value: n };
}

/** Why a time string isn't mm:ss / h:mm:ss, or null when it's fine. Blank is fine (not sure). */
export function timeError(text: string): string | null {
  const t = text.trim();
  if (t === '') return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t) > 0 ? null : 'Must be more than 0:00';
  if (t.startsWith('-') || t.startsWith('−')) return "Time can't be negative";
  const parts = t.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) {
    return 'Use mm:ss or h:mm:ss, e.g. 4:30 or 1:05:00';
  }
  if (parts.slice(1).some((p) => Number(p) >= 60)) return 'Minutes and seconds must be 0–59';
  if (parts.every((p) => Number(p) === 0)) return 'Must be more than 0:00';
  return null;
}
