/** Format seconds as H:MM:SS (or MM:SS when under an hour). */
export function formatTime(totalSec: number, forceHours = false): string {
  if (!isFinite(totalSec) || totalSec < 0) return '--:--';
  const s = Math.round(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 || forceHours ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Parse "mm:ss", "h:mm:ss", or a bare number of minutes into seconds.
 * Returns null for empty / invalid input.
 */
export function parseTime(input: string | null | undefined): number | null {
  if (input == null) return null;
  const t = String(input).trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(parseFloat(t) * 60);
  const parts = t.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n >= 60)) return null;
  return Math.round(nums.length === 3 ? nums[0] * 3600 + nums[1] * 60 + nums[2] : nums[0] * 60 + nums[1]);
}

/** Pace per km / per 500m helper, e.g. "4:35". */
export function formatPace(secPerUnit: number): string {
  return formatTime(secPerUnit);
}
