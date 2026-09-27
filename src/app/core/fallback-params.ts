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
  /**
   * How far each self-rating moves its station, relative to `levelMult`. From the split tables:
   * fastest-to-slowest-band ratio of each station's median, as ln(ratio) ÷ the station average.
   * Ergs barely separate athletes (×1.25 across bands), burpee broad jumps, lunges, wall balls
   * and the Roxzone separate them most (×2.0–2.6). See RESEARCH.md "Input weighting review".
   */
  levelSpread: {
    run: 1, legs: 1, hinge: 1, erg: 0.5, sled: 1.0, grip: 1.0,
    burpees: 1.5, lunges: 1.35, wallBalls: 1.35, transitions: 1.35,
  } as Record<'run' | 'legs' | 'hinge' | 'erg' | 'sled' | 'grip' | 'burpees' | 'lunges' | 'wallBalls' | 'transitions', number>,

  refBodyweightKg: { male: 82, female: 65 } as BySex<number>,

  // ── Running ─────────────────────────────────────────────────────────────────────────
  /** 5K time (s) implied by a running self-level. Anchored to Daniels VDOT ≈ 32/38/44/50/58. */
  fiveKByLevel: {
    male: [32 * 60, 27 * 60, 23 * 60 + 30, 20 * 60 + 30, 17 * 60 + 30],
    female: [36 * 60, 30 * 60 + 30, 26 * 60 + 30, 23 * 60, 19 * 60 + 30],
  } as BySex<ByLevel>,
  /** Riegel exponents: recreational runners fade more than 1.06 from short → long. */
  riegelExp: { tenK: 1.06, half: 1.07, marathon: 1.07 },
  /**
   * How much each race counts when several are entered (research: 10K and half marathon best
   * match a HYROX effort; 5K ≈ VO₂max proxy; marathon noisy). The mile was dropped as too anaerobic.
   */
  raceWeights: { tenK: 1.0, half: 0.9, fiveK: 0.7, marathon: 0.4 },
  /**
   * Age only matters when running ability is unknown: typical 5K slows ~0.7%/yr from 35 to 55
   * and ~1.1%/yr beyond (approximating WMA age-grading factors).
   */
  ageSlowdown: { from: 35, perYear: 0.007, lateFrom: 55, latePerYear: 0.011 },
  /** Wearable VO₂max estimates run high vs race-derived VDOT; subtract this many points. */
  watchVo2Offset: 4,
  /**
   * With race times, VO₂max still gets a small say (races can be old or not all-out), in log-time
   * space against the races' combined weight of 1, and the shift is capped. Watch estimates are
   * largely derived from your running already, so they count less than a lab test.
   */
  vo2WithRaces: { weight: { lab: 0.2, watch: 0.08 }, maxShift: { lab: 0.04, watch: 0.015 } },
  /** Plausible input ranges (seconds unless noted); values outside are ignored with a warning. */
  ranges: {
    fiveK: [12 * 60, 90 * 60], tenK: [26 * 60, 3 * 3600], half: [58 * 60, 4 * 3600],
    marathon: [2 * 3600, 7 * 3600],
    erg500: [70, 300], erg1k: [150, 600], erg2k: [330, 1200], erg5k: [900, 2700],
    sled: [30, 15 * 60], bbj: [90, 20 * 60], farmers: [45, 10 * 60], lunges: [90, 20 * 60],
    wallBalls100: [150, 25 * 60],
    heightCm: [135, 225], bodyFat: [4, 50], runningKm: [0, 250], otherHours: [0, 30], vo2: [20, 90], bodyweightKg: [35, 200],
    age: [16, 95], deadHang: [1, 600], pullUps: [0, 80], burpees1Min: [1, 60], wallBallsUnbroken: [1, 300], wallBallsSetSize: [3, 100],
    liftKg: [5, 500], liftReps: [1, 15],
  },

  // ── Ergs ────────────────────────────────────────────────────────────────────────────
  /** Same athlete: SkiErg is ~8–12 s/500 m (men) / 5–10 s/500 m (women) slower than rowing. */
  skiSlowerThanRowPer1k: { male: 20, female: 15 } as BySex<number>,

  // ── Strength (1RM ÷ bodyweight) ─────────────────────────────────────────────────────
  // Set for a recreational HYROX / functional-fitness population, not for lifters who log
  // their lifts in strength apps (whose "intermediate" is ~1.5× squat / 2× deadlift for men).
  // Solid = a typical mid-pack athlete; see RESEARCH.md "Strength standards".
  squatPerBw: {
    male: [0.6, 0.9, 1.25, 1.6, 2.0],
    female: [0.4, 0.65, 0.9, 1.2, 1.5],
  } as BySex<ByLevel>,
  deadliftPerBw: {
    male: [0.75, 1.1, 1.5, 1.9, 2.4],
    female: [0.5, 0.8, 1.1, 1.4, 1.8],
  } as BySex<ByLevel>,
  /**
   * Typical strength of a HYROX athlete when nothing is known — equal to "Solid" so that
   * "Not sure" and "Solid" mean the same. This is also the model's reference athlete.
   */
  /**
   * Typical HYROX body fat (%). When strength is assumed, it scales with lean mass relative to
   * this reference: a leaner athlete of the same bodyweight carries more muscle.
   */
  typicalBodyFatPct: { male: 18, female: 25 } as BySex<number>,
  typicalPerBw: {
    legs: { male: 1.25, female: 0.9 },
    hinge: { male: 1.5, female: 1.1 },
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
  /**
   * Usual set size for 100 reps ÷ max unbroken. Athletes break well before failure so short rests
   * keep them moving; ~60% is a common coaching target (e.g. sets of 20 ≈ 33 max unbroken).
   */
  wallBallsSetShare: 0.6,

  // ── Fresh station test → in-race time (race fatigue factors, est. 1.10–1.25) ──────────
  raceFatigue: {
    sledPush: 1.15,
    sledPull: 1.15,
    farmersCarry: 1.12,
    burpeeBroadJump: 1.2,
    sandbagLunges: 1.25,
    wallBalls: 1.22,
  },

  // ── Realistic gains for an 8–12 week training block (Insights) ────────────────────
  realisticGains: {
    /** 5K improvement fraction by current running level (Weak … Elite): big early gains, tiny at the top. */
    fiveKPctByLevel: [0.09, 0.05, 0.03, 0.015, 0.008] as ByLevel,
    /**
     * Strength gain fraction by current strength level: novices +20–35%, intermediates +5–10%,
     * advanced +1–3% (meta-analyses). Masters gain similar percentages, so no age scaling.
     */
    strengthPctByLevel: [0.25, 0.15, 0.08, 0.04, 0.02] as ByLevel,
    /** Endurance adaptation is slower for masters: ~60–75% of the gains over 50, less over 60. */
    masters50: 0.7,
    masters60: 0.55,
    wallBallsAddPct: 0.4,
    wallBallsAddMax: 12,
    burpeesAdd: 3,
    deadHangAdd: 15,
    ergPct: 0.025,
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
