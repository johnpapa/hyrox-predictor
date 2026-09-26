import { Sex } from './divisions';

/** Self-assessed level: 1 Weak · 2 Fair · 3 Solid · 4 Strong · 5 Elite. `null` = not sure. */
export type Level = 1 | 2 | 3 | 4 | 5;
/** Kept for backwards compatibility with earlier saved data. */
export type Rating = Level;

export const LEVEL_LABELS = ['Weak', 'Fair', 'Solid', 'Strong', 'Elite'] as const;

/** 'unknown' behaves like 'some' but widens the confidence range. */
export type Experience = 'unknown' | 'first' | 'some' | 'experienced' | 'competitive';

/** A lift entered as weight × reps (reps 1 = true 1RM). */
export interface Lift {
  kg: number | null;
  reps: number | null;
}

export type LiftId = 'backSquat' | 'frontSquat' | 'legPress' | 'deadlift' | 'trapBar' | 'romanianDeadlift' | 'benchPress';

/** Abilities the model needs. Each can come from a measured test, a conversion, or a self-level. */
export type AbilityId =
  | 'run'
  | 'erg'
  | 'legs'
  | 'hinge'
  | 'grip'
  | 'burpees'
  | 'sled'
  | 'lunges'
  | 'wallBalls'
  | 'transitions';

export interface AthleteProfile {
  name: string;
  sex: Sex;
  /** Age in years; null = prefer not to say / unknown. */
  age: number | null;
  /** Height in cm; null = unknown. Small effect on ergs, lunges and burpee broad jumps. */
  heightCm: number | null;
  /** Bodyweight in kg (always stored in kg); null = unknown. */
  bodyweightKg: number | null;
  experience: Experience;
  /** Weekly training volume in hours (all modalities); null = unknown. */
  trainingHours: number | null;

  // ── Running (seconds) — first available wins: 5K › 10K › mile › half › VO₂max › level ──
  fiveKSec: number | null;
  tenKSec: number | null;
  halfMarathonSec: number | null;
  /** Marathon time, seconds. Also tells the model how well you hold pace over long efforts. */
  marathonSec: number | null;
  /** VO₂max estimate, e.g. from a sports watch (ml/kg/min). */
  vo2max: number | null;
  /** Lab tests are trusted as-is; watch estimates are discounted. */
  vo2maxSource: 'watch' | 'lab';
  /** Resting heart rate (bpm) — with age, gives a rough VO₂max estimate. */
  restingHr: number | null;

  // ── Ergs (seconds) ──────────────────────────────────────────────────────────────────
  skiErg1kSec: number | null;
  skiErg500Sec: number | null;
  skiErg2kSec: number | null;
  row1kSec: number | null;
  row500Sec: number | null;
  row2kSec: number | null;
  row5kSec: number | null;

  // ── Strength ────────────────────────────────────────────────────────────────────────
  lifts: Record<LiftId, Lift>;

  // ── Grip & bodyweight ───────────────────────────────────────────────────────────────
  /** Max dead hang from a pull-up bar, seconds. */
  deadHangSec: number | null;
  /** Max strict pull-ups. */
  pullUps: number | null;
  /** Max burpees in 1 minute. */
  burpees1Min: number | null;

  // ── Station tests done fresh (not in a race), seconds ──────────────────────────────
  sledPushTestSec: number | null;
  sledPullTestSec: number | null;
  bbjTestSec: number | null;
  farmersTestSec: number | null;
  lungesTestSec: number | null;
  /** 100 wall balls for time with the race ball & target. */
  wallBalls100Sec: number | null;
  /** Max unbroken wall balls with the race ball & target. */
  wallBallsUnbroken: number | null;
  /** "Karen": 150 wall balls for time. */
  karenSec: number | null;

  /** Self-assessed levels; used only when no measured benchmark is available. */
  levels: Record<AbilityId, Level | null>;

  /** Optional previous HYROX result in this division, seconds — used to calibrate. */
  previousHyroxSec: number | null;
}

const emptyLift = (): Lift => ({ kg: null, reps: 1 });

export function emptyLifts(): Record<LiftId, Lift> {
  return {
    backSquat: emptyLift(),
    frontSquat: emptyLift(),
    legPress: emptyLift(),
    deadlift: emptyLift(),
    trapBar: emptyLift(),
    romanianDeadlift: emptyLift(),
    benchPress: emptyLift(),
  };
}

export function emptyLevels(): Record<AbilityId, Level | null> {
  return {
    run: null, erg: null, legs: null, hinge: null, grip: null,
    burpees: null, sled: null, lunges: null, wallBalls: null, transitions: null,
  };
}

/** A blank athlete: everything unknown except sex, so nothing is invented for the user. */
export function defaultAthlete(sex: Sex, index = 0): AthleteProfile {
  return {
    name: `Athlete ${index + 1}`,
    sex,
    age: null,
    heightCm: null,
    bodyweightKg: null,
    experience: 'unknown',
    trainingHours: null,
    fiveKSec: null,
    tenKSec: null,
    halfMarathonSec: null,
    marathonSec: null,
    vo2max: null,
    vo2maxSource: 'watch',
    restingHr: null,
    skiErg1kSec: null,
    skiErg500Sec: null,
    skiErg2kSec: null,
    row1kSec: null,
    row500Sec: null,
    row2kSec: null,
    row5kSec: null,
    lifts: emptyLifts(),
    deadHangSec: null,
    pullUps: null,
    burpees1Min: null,
    sledPushTestSec: null,
    sledPullTestSec: null,
    bbjTestSec: null,
    farmersTestSec: null,
    lungesTestSec: null,
    wallBalls100Sec: null,
    wallBallsUnbroken: null,
    karenSec: null,
    levels: emptyLevels(),
    previousHyroxSec: null,
  };
}

const EXPERIENCES: readonly Experience[] = ['unknown', 'first', 'some', 'experienced', 'competitive'];
const LIFT_IDS: readonly LiftId[] = ['backSquat', 'frontSquat', 'legPress', 'deadlift', 'trapBar', 'romanianDeadlift', 'benchPress'];
const ABILITY_IDS: readonly AbilityId[] = ['run', 'erg', 'legs', 'hinge', 'grip', 'burpees', 'sled', 'lunges', 'wallBalls', 'transitions'];

const numOrNull = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : null);

/**
 * Validate and upgrade a stored athlete (saved data is untrusted: it may come from an older
 * version or have been edited by hand). Unknown or malformed fields fall back to defaults.
 * v1 stored `backSquatKg`/`deadliftKg` and 1–5 `ratings` (3 = average) — carried over, with
 * a neutral 3 treated as "not sure".
 */
export function migrateAthlete(raw: unknown, index: number): AthleteProfile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const out = defaultAthlete(r['sex'] === 'female' ? 'female' : 'male', index);
  if (typeof r['name'] === 'string') out.name = r['name'].slice(0, 24);
  if (EXPERIENCES.includes(r['experience'])) out.experience = r['experience'];
  if (r['vo2maxSource'] === 'lab') out.vo2maxSource = 'lab';
  const numeric: (keyof AthleteProfile)[] = [
    'age', 'bodyweightKg', 'trainingHours', 'fiveKSec', 'tenKSec', 'halfMarathonSec', 'marathonSec', 'vo2max',
    'heightCm', 'restingHr', 'skiErg1kSec', 'skiErg500Sec', 'skiErg2kSec', 'row1kSec', 'row500Sec', 'row2kSec',
    'row5kSec', 'deadHangSec', 'pullUps', 'burpees1Min', 'sledPushTestSec', 'sledPullTestSec', 'bbjTestSec',
    'farmersTestSec', 'lungesTestSec', 'wallBalls100Sec', 'wallBallsUnbroken', 'karenSec', 'previousHyroxSec',
  ];
  for (const k of numeric) (out as any)[k] = numOrNull(r[k]);
  const lifts = r['lifts'] ?? {};
  for (const id of LIFT_IDS) {
    const l = lifts[id] ?? {};
    const reps = numOrNull(l.reps);
    out.lifts[id] = { kg: numOrNull(l.kg), reps: reps && reps >= 1 ? Math.min(12, Math.round(reps)) : 1 };
  }
  const levels = r['levels'] ?? {};
  for (const id of ABILITY_IDS) {
    const v = levels[id];
    out.levels[id] = [1, 2, 3, 4, 5].includes(v) ? (v as Level) : null;
  }
  // v1 → v2
  if (numOrNull(r['backSquatKg']) && !out.lifts.backSquat.kg) out.lifts.backSquat = { kg: r['backSquatKg'], reps: 1 };
  if (numOrNull(r['deadliftKg']) && !out.lifts.deadlift.kg) out.lifts.deadlift = { kg: r['deadliftKg'], reps: 1 };
  const old = r['ratings'];
  if (old && typeof old === 'object' && !r['levels']) {
    const lv = (v: unknown) => ([1, 2, 4, 5].includes(v as number) ? (v as Level) : null);
    Object.assign(out.levels, {
      sled: lv(old['sled']), burpees: lv(old['burpees']), grip: lv(old['grip']),
      lunges: lv(old['lunges']), wallBalls: lv(old['wallBalls']), transitions: lv(old['transitions']),
    });
  }
  return out;
}

/** HYROX age groups (singles): 16–24, 25–29, 30–34 … 65–69, 70+. */
export function hyroxAgeGroup(age: number | null): string | null {
  if (age == null || !isFinite(age) || age < 16) return null;
  if (age < 25) return '16–24';
  if (age >= 70) return '70+';
  const lo = Math.floor(age / 5) * 5;
  return `${lo}–${lo + 4}`;
}
