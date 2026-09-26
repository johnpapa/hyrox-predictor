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
  /** Bodyweight in kg (always stored in kg); null = unknown. */
  bodyweightKg: number | null;
  experience: Experience;
  /** Weekly training volume in hours (all modalities); null = unknown. */
  trainingHours: number | null;

  // ── Running (seconds) — first available wins: 5K › 10K › mile › half › VO₂max › level ──
  fiveKSec: number | null;
  tenKSec: number | null;
  mileSec: number | null;
  halfMarathonSec: number | null;
  /** VO₂max estimate, e.g. from a sports watch (ml/kg/min). */
  vo2max: number | null;
  /** Cooper test: metres covered in 12 minutes. */
  cooperMeters: number | null;
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
    bodyweightKg: null,
    experience: 'unknown',
    trainingHours: null,
    fiveKSec: null,
    tenKSec: null,
    mileSec: null,
    halfMarathonSec: null,
    vo2max: null,
    cooperMeters: null,
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

/**
 * Upgrade a stored athlete from an older save format, filling in any missing fields.
 * v1 stored `backSquatKg`/`deadliftKg` and 1–5 `ratings` (3 = average) — carried over, with
 * a neutral 3 treated as "not sure".
 */
export function migrateAthlete(raw: unknown, index: number): AthleteProfile {
  const r = (raw ?? {}) as Record<string, any>;
  const base = defaultAthlete(r['sex'] === 'female' ? 'female' : 'male', index);
  const out: AthleteProfile = {
    ...base,
    ...r,
    lifts: { ...emptyLifts(), ...(r['lifts'] ?? {}) },
    levels: { ...emptyLevels(), ...(r['levels'] ?? {}) },
  } as AthleteProfile;
  if (r['backSquatKg'] && !out.lifts.backSquat.kg) out.lifts.backSquat = { kg: r['backSquatKg'], reps: 1 };
  if (r['deadliftKg'] && !out.lifts.deadlift.kg) out.lifts.deadlift = { kg: r['deadliftKg'], reps: 1 };
  const old = r['ratings'] as Record<string, number> | undefined;
  if (old && !r['levels']) {
    const lv = (v: number | undefined) => (v && v !== 3 ? (v as Level) : null);
    out.levels = {
      ...out.levels,
      sled: lv(old['sled']), burpees: lv(old['burpees']), grip: lv(old['grip']),
      lunges: lv(old['lunges']), wallBalls: lv(old['wallBalls']), transitions: lv(old['transitions']),
    };
  }
  for (const k of ['backSquatKg', 'deadliftKg', 'ratings']) delete (out as any)[k];
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
