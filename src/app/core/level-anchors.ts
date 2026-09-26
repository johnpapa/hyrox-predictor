import { AbilityId, DEFAULT_RIR } from './athlete';
import { LB_PER_KG } from './units';
import { Sex } from './divisions';
import { FALLBACK } from './fallback-params';
import { PARAMS } from './model-params';
import { levelMult } from './resolve';
import { formatTime } from './time';

/**
 * Concrete descriptions for each Weak…Elite level so a self-assessment is anchored to
 * something observable. Numeric anchors come from the same tables the model uses.
 */
export function levelAnchors(id: AbilityId, sex: Sex, bwKg: number, units: 'kg' | 'lb', typicalWallBalls = 36): string[] {
  // Both units, the selected one first, rounded to plate jumps (2.5 kg / 5 lb).
  const w = (kg: number) => {
    const k = `${Math.round(kg / 2.5) * 2.5} kg`;
    const l = `${Math.round((kg * LB_PER_KG) / 5) * 5} lb`;
    return units === 'kg' ? `${k} / ${l}` : `${l} / ${k}`;
  };
  // A max, plus the usual working set it corresponds to (10 reps with 1–2 left ≈ 72% of max).
  const lift = (name: string, m: number) => {
    const max = m * bwKg;
    return `${name} ≈ ${m}× bodyweight: max ≈ ${w(max)}, or sets of 10 at ≈ ${w(max / (1 + (10 + DEFAULT_RIR) / 30))}`;
  };
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
      return ranges(FALLBACK.squatPerBw[sex], (m) => lift('Back squat', m)).map((s, i) =>
        i === 0 ? `${s} — or I don't really lift` : s,
      );
    case 'hinge':
      return ranges(FALLBACK.deadliftPerBw[sex], (m) => lift('Deadlift', m)).map((s, i) =>
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
      // Relative to the typical max set for your running level, and consistent with the model:
      // rating a level predicts the same wall-ball time as entering this many unbroken.
      return ([1, 2, 3, 4, 5] as const).map((l) => {
        const n = typicalWallBalls * Math.pow(levelMult(l, 'wallBalls'), -1 / PARAMS.wallBallsUnbrokenExp);
        return n < 20 ? Math.round(n) : Math.round(n / 5) * 5;
      }).map((n) => `About ${n} unbroken`).map(
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
