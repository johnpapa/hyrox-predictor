import { AbilityId } from './athlete';
import { Sex } from './divisions';
import { FALLBACK } from './fallback-params';
import { formatTime } from './time';

/**
 * Concrete descriptions for each Weak…Elite level so a self-assessment is anchored to
 * something observable. Numeric anchors come from the same tables the model uses.
 */
export function levelAnchors(id: AbilityId, sex: Sex, bwKg: number, units: 'kg' | 'lb'): string[] {
  const w = (kg: number) => (units === 'kg' ? `${Math.round(kg / 2.5) * 2.5} kg` : `${Math.round((kg * 2.20462) / 5) * 5} lb`);
  const ranges = (t: readonly number[], f: (x: number) => string) => t.map((x) => f(x));
  switch (id) {
    case 'run':
      return ranges(FALLBACK.fiveKByLevel[sex], (s) => `About a ${formatTime(s)} 5K`);
    case 'erg':
      return [
        'I rarely use a rower or SkiErg',
        'I can row or ski steadily, but slowly',
        'Regular erg work, comfortable at a solid pace',
        'Ergs are a strength; I hold fast splits',
        'Competitive rower / skier splits',
      ];
    case 'legs':
      return ranges(FALLBACK.squatPerBw[sex], (m) => `Back squat ≈ ${m}× bodyweight (${w(m * bwKg)})`).map((s, i) =>
        i === 0 ? `${s} — or I don't really lift` : s,
      );
    case 'hinge':
      return ranges(FALLBACK.deadliftPerBw[sex], (m) => `Deadlift ≈ ${m}× bodyweight (${w(m * bwKg)})`).map((s, i) =>
        i === 0 ? `${s} — or I don't really lift` : s,
      );
    case 'grip':
      return ranges(FALLBACK.deadHangByLevel[sex], (s) => `Dead hang ≈ ${s}s`).map(
        (s, i) => s + [', forearms fail fast', ', some grip fatigue on carries', ', carries feel OK', ', rarely drop the bells', ', grip never limits me'][i],
      );
    case 'burpees':
      return ranges(FALLBACK.burpees1MinByLevel[sex], (n) => `About ${n} burpees in 1 minute`);
    case 'sled':
      return [
        'Stop many times each lane; the sled barely moves',
        'A few stops per lane',
        'Keep it moving with 1–2 short stops',
        'Steady and unbroken',
        'Fast and unbroken, even at Pro weight',
      ];
    case 'lunges':
      return [
        'Need frequent breaks; legs burn out early',
        'Break every 10–15 m',
        'A couple of short breaks',
        'Unbroken at a steady pace',
        'Unbroken and fast',
      ];
    case 'wallBalls':
      return ranges(FALLBACK.wallBallsUnbrokenByLevel[sex], (n) => `About ${n} unbroken`).map(
        (s, i) => s + [', many long breaks', ', sets of ~10–15', ', sets of ~20–25', ', 2–3 big sets', ', 1–2 sets'][i],
      );
    case 'transitions':
      return [
        'I walk between stations and take time to recover',
        'Slow jog, pause before each station',
        'Keep moving, short pauses',
        'Run through the Roxzone, straight into work',
        'Race-sharp: no wasted seconds',
      ];
  }
}
