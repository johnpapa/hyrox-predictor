import { Sex } from './divisions';

type ByLevel = readonly [number, number, number, number, number];
type BySex<T> = Record<Sex, T>;

/**
 * Constants for filling in missing benchmarks. Level tables are indexed
 * Weak / Fair / Solid / Strong / Elite (≈ Strength Level's Beginner / Novice / Intermediate /
 * Advanced / Elite tiers where a published standard exists). See RESEARCH.md.
 */
export const FALLBACK = {
  levelNames: ['Weak', 'Fair', 'Solid', 'Strong', 'Elite'] as const,

  /** Station-time multiplier from a self-level. Solid = typical for your running level. */
  levelMult: [1.16, 1.07, 1.0, 0.94, 0.88] as ByLevel,

  refBodyweightKg: { male: 82, female: 65 } as BySex<number>,

  // ── Running ─────────────────────────────────────────────────────────────────────────
  /** 5K time (s) implied by a running self-level. Anchored to Daniels VDOT ≈ 32/38/44/50/58. */
  fiveKByLevel: {
    male: [32 * 60, 27 * 60, 23 * 60 + 30, 20 * 60 + 30, 17 * 60 + 30],
    female: [36 * 60, 30 * 60 + 30, 26 * 60 + 30, 23 * 60, 19 * 60 + 30],
  } as BySex<ByLevel>,
  /** Riegel exponents: recreational runners fade more than 1.06 from short → long. */
  riegelExp: { tenK: 1.06, mile: 1.07, half: 1.07 },
  /**
   * Age only matters when running ability is unknown: typical 5K slows ~0.7%/yr from 35 to 55
   * and ~1.1%/yr beyond (approximating WMA age-grading factors).
   */
  ageSlowdown: { from: 35, perYear: 0.007, lateFrom: 55, latePerYear: 0.011 },
  /** Uth et al. 2004: VO₂max ≈ 15.3 × HRmax / HRrest; HRmax ≈ 208 − 0.7 × age (Tanaka 2001). */
  uth: { factor: 15.3, hrMaxBase: 208, hrMaxPerYear: 0.7, defaultAge: 35 },
  /** Wearable VO₂max estimates run high vs race-derived VDOT; subtract this many points. */
  watchVo2Offset: 4,
  /** Plausible input ranges (seconds unless noted); values outside are ignored with a warning. */
  ranges: {
    fiveK: [12 * 60, 90 * 60], tenK: [26 * 60, 3 * 3600], mile: [3.6 * 60, 20 * 60], half: [58 * 60, 4 * 3600],
    erg500: [70, 300], erg1k: [150, 600], erg2k: [330, 1200], erg5k: [900, 2700],
    sled: [30, 15 * 60], bbj: [90, 20 * 60], farmers: [45, 10 * 60], lunges: [90, 20 * 60],
    wallBalls100: [150, 25 * 60], karen: [240, 40 * 60],
    cooperM: [1000, 5000], vo2: [20, 90], restingHr: [30, 110], bodyweightKg: [35, 200],
  },

  // ── Ergs ────────────────────────────────────────────────────────────────────────────
  /** Same athlete: SkiErg is ~8–12 s/500 m (men) / 5–10 s/500 m (women) slower than rowing. */
  skiSlowerThanRowPer1k: { male: 20, female: 15 } as BySex<number>,

  // ── Strength (1RM ÷ bodyweight) ─────────────────────────────────────────────────────
  squatPerBw: {
    male: [0.75, 1.25, 1.5, 2.25, 2.75],
    female: [0.5, 0.75, 1.25, 1.5, 2.0],
  } as BySex<ByLevel>,
  deadliftPerBw: {
    male: [1.0, 1.5, 2.0, 2.5, 3.0],
    female: [0.5, 1.0, 1.25, 1.75, 2.5],
  } as BySex<ByLevel>,
  /**
   * Typical strength of a HYROX athlete when nothing is known — equal to "Solid" so that
   * "Not sure" and "Solid" mean the same. This is also the model's reference athlete.
   */
  typicalPerBw: {
    legs: { male: 1.5, female: 1.25 },
    hinge: { male: 2.0, female: 1.25 },
  } as Record<'legs' | 'hinge', BySex<number>>,
  liftRatios: {
    /** Front squat ≈ 0.80–0.85 × back squat. */
    frontToBackSquat: 0.85,
    /** Trap-bar ≈ 1.05–1.10 × conventional deadlift (JSCR 2011: +8%). */
    trapBarToDeadlift: 1.08,
    /** Back squat ≈ 0.80 × deadlift. */
    squatToDeadlift: 0.8,
    /** Romanian deadlift ≈ 0.65–0.85 × deadlift. */
    rdlToDeadlift: 0.75,
    /** 45° leg press is machine-dependent: squat ≈ 0.6 × leg press (weak predictor). */
    legPressToSquat: 0.6,
    /** Deadlift ÷ bench from standards: men ≈ 1.6, women ≈ 2.0 (weak predictor). */
    deadliftToBench: { male: 1.6, female: 2.0 } as BySex<number>,
  },

  // ── Grip ────────────────────────────────────────────────────────────────────────────
  deadHangByLevel: { male: [20, 45, 75, 120, 180], female: [12, 25, 50, 90, 150] } as BySex<ByLevel>,
  pullUpsByLevel: { male: [1, 5, 10, 15, 22], female: [0, 2, 5, 10, 15] } as BySex<ByLevel>,
  /** Grip matters less for the sled pull than for the carry. */
  gripEffectOnPull: 0.5,

  // ── Conditioning ────────────────────────────────────────────────────────────────────
  burpees1MinByLevel: { male: [15, 20, 25, 30, 35], female: [12, 17, 22, 27, 32] } as BySex<ByLevel>,
  wallBallsUnbrokenByLevel: { male: [15, 30, 50, 75, 100], female: [15, 30, 50, 75, 100] } as BySex<ByLevel>,
  /** 100 wall balls ≈ 0.62 × "Karen" (150 reps) time. */
  wallBalls100FromKaren: 0.62,

  // ── Fresh station test → in-race time (race fatigue factors, est. 1.10–1.25) ──────────
  raceFatigue: {
    sledPush: 1.15,
    sledPull: 1.15,
    farmersCarry: 1.12,
    burpeeBroadJump: 1.2,
    sandbagLunges: 1.25,
    wallBalls: 1.22,
  },

  // ── Confidence ──────────────────────────────────────────────────────────────────────
  /** Base uncertainty with everything measured. */
  baseUncertainty: 0.03,
  /** Contribution of each ability to the uncertainty when it is completely unknown. */
  abilityWeight: {
    run: 0.08, erg: 0.008, legs: 0.008, hinge: 0.008, grip: 0.005,
    burpees: 0.008, sled: 0.006, lunges: 0.006, wallBalls: 0.007, transitions: 0.004,
  },
  qualityFactor: { measured: 0, converted: 0.35, rated: 0.6, assumed: 1 },
} as const;
