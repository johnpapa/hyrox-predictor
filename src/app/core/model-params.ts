import { StationId } from './stations';
import { Experience } from './athlete';
import { Sex } from './divisions';

/**
 * Tuning constants for the prediction model. Station baselines come from the median split
 * tables in split-tables.ts; everything here adjusts those baselines for an individual.
 * See RESEARCH.md in the project root for sources.
 */
export const PARAMS = {
  // ── Running ───────────────────────────────────────────────────────────────────────
  /**
   * Average HYROX 1 km split ÷ 5K race pace. Research: ~1.12 strong hybrid athletes,
   * ~1.20 typical, ~1.30 beginners (i.e. 30–60 s/km slower than 5K pace).
   */
  runFactor: {
    base: 1.2,
    /** Added per minute of 5K slower than 24:00 (men) / 27:00 (women); subtracted when faster. */
    per5kMinSlower: 0.004,
    ref5kSec: { male: 24 * 60, female: 27 * 60 } satisfies Record<Sex, number>,
    /**
     * Experience effect on the lap factor. For a first race it is split in two:
     * - `firstRace.pacing`: race-craft every first-timer pays (going out too fast, unfamiliar course);
     * - `firstRace.unfamiliar`: never having run on legs tired from stations. Fitness shrinks it:
     *   high running volume, durable race times (short + long race) and regular gym/HYROX work.
     * Beginners' typical "~25–30% slower than 5K pace" is mostly low fitness, not inexperience.
     */
    // Race craft only (same fitness): most of the gain seen between races is training, which the
    // fitness inputs already capture. See RESEARCH.md "Input weighting review".
    experience: { unknown: 0.015, first: 0, some: 0.015, experienced: 0.005, competitive: -0.01 } satisfies Record<Experience, number>,
    firstRace: {
      pacing: 0.015,
      unfamiliar: 0.035,
      /** Offset (0–1) of the unfamiliar part from running volume, up to this at +50 km/week over 25. */
      volumeOffsetMax: 0.6,
      volumeFullAtExtraKm: 50,
      /** Offset when a short + long race show typical-or-better durability (Riegel k ≤ 1.07). */
      enduranceOffset: 0.2,
      /** Offset when doing ≥ this many other training hours (muscular endurance, station work). */
      otherTrainingHours: 4,
      otherTrainingOffset: 0.2,
      maxOffset: 0.8,
    },
    /** Heavier Pro stations compromise the runs more. */
    pro: 0.012,
    /**
     * Weekly running volume (km). Diminishing returns (Tanda 2011; Boston Marathon cohort 2025):
     * above the reference, factor −= max·(1 − e^(−(km − ref)/scale)); below it, up to +penalty.
     * Halved when a short + long race already measure endurance (avoids double counting).
     */
    runningVolume: { refKm: 25, maxBenefit: 0.03, scaleKm: 40, maxPenalty: 0.02, withEnduranceShare: 0.5 },
    min: 1.1,
    max: 1.42,
    /**
     * Endurance: with a 5K and a longer race, the Riegel exponent k = ln(T₂/T₁)/ln(D₂/D₁) says
     * how well pace holds over long efforts (≈1.06 very durable … 1.12+ fades). A HYROX is a
     * 55–120 min effort, so durable athletes compromise less: factor += (k − ref)·scale.
     */
    endurance: { refExponent: 1.07, scale: 0.35, min: -0.02, max: 0.025 },
  },
  /**
   * Relative shape of runs 1–8 (normalised to mean 1). From the data: runs 2–7 average
   * 1.13–1.21 × Run 1; Run 8 is 1.24–1.41 × Run 1 (it includes the finish straight).
   */
  runShape: [1.0, 1.15, 1.2, 1.17, 1.18, 1.16, 1.15, 1.3],
  /**
   * Elites run far more evenly (runs within ~15 s/km). The shape above is scaled towards flat
   * as the run factor drops: full shape at ≥ 1.20, 40% of it at ≤ 1.10.
   */
  runShapeFlatten: { fullAt: 1.2, flatAt: 1.1, minScale: 0.4 },
  /**
   * Other training hours (gym, HYROX classes, erg/sled). Brandt 2025 found no link between
   * resistance-training volume and finish time, so the effect is small and stations-only:
   * ±1% per hour vs. the 3 h reference, capped at ±3%, half-strength on the ergs.
   */
  otherTraining: { refHours: 3, perHour: 0.01, cap: 0.03, ergShare: 0.5 },
  /** Heavy running volume also reduces lap-to-lap fade (up to 30% flatter at +75 km). */
  runVolumeFlatten: { maxShare: 0.3, fullAtExtraKm: 75 },
  /** Combined skill multipliers (self-level × race-craft) never go below this. */
  minSkillMult: 0.86,
  /**
   * All personal adjustments together (strength × bodyweight × skill) stay within this range
   * of the typical time for the athlete's run pace, so extremes can't stack unrealistically.
   * Entered station tests are exempt.
   */
  personalMultRange: [0.65, 1.5] as const,

  // ── Ergs ───────────────────────────────────────────────────────────────────────────
  /** In-race 1000 m station time ÷ fresh 1000 m time-trial (race runs at ~85–90% of TT pace). */
  ergRaceFactor: 1.13,
  /** Fresh 1k row time ÷ half of a 2k time (1k pace is ~3% quicker per 500 m). */
  row1kFrom2k: 0.97,
  /** When only one erg benchmark is known, how much of its deviation to carry to the other erg. */
  ergTransfer: 0.7,

  // ── Strength-driven stations ───────────────────────────────────────────────────────
  /** time × (refCapacity / capacity) ^ exp, capacity = bw·bwShare + lift·liftShare. */
  sledPush: { exp: 1.1, bwShare: 0.5, liftShare: 0.5 },
  sledPull: { exp: 1.0, bwShare: 0.4, liftShare: 0.4 },
  farmers: { exp: 0.45 },
  lunges: { exp: 0.6 },
  /** Heavier athletes move bodyweight less efficiently on burpee broad jumps. */
  bbjBodyweightExp: 0.35,
  /** Heavier athletes pull more watts on the ergs (applied only without an erg benchmark). */
  ergBodyweightExp: -0.15,
  /** Unbroken wall balls drop steeply with ball weight: typical unbroken ÷ loadMult ^ this. */
  wallBallsLoadUnbrokenExp: 2,
  /** Wall balls: time × (typical unbroken for your band / your unbroken) ^ exp. */
  wallBallsUnbrokenExp: 0.3,
  strengthMultClamp: [0.8, 1.6] as const,

  // ── Experience ────────────────────────────────────────────────────────────────────
  /** Race-craft on the loaded stations. */
  experienceStationMult: { unknown: 1.0, first: 1.04, some: 1.0, experienced: 0.99, competitive: 0.97 } satisfies Record<Experience, number>,
  roxzoneExperienceMult: { unknown: 1.0, first: 1.15, some: 1.0, experienced: 0.94, competitive: 0.85 } satisfies Record<Experience, number>,

  // ── Doubles ────────────────────────────────────────────────────────────────────────
  doubles: {
    /**
     * Doing a share x of a station lets you work at higher intensity: time for your share
     * = x · soloTime · (a + (1 − a)·x). Calibrated so an even split reproduces the observed
     * doubles/singles station ratios at matched run pace (ski ≈ 0.90, push ≈ 0.55,
     * pull ≈ 0.62, BBJ ≈ 0.57, row ≈ 0.93, farmers ≈ 0.78, lunges ≈ 0.68, wall balls ≈ 0.66).
     */
    intensityFloor: {
      skierg: 0.76, sledPush: 0.16, sledPull: 0.26, burpeeBroadJump: 0.14,
      row: 0.82, farmersCarry: 0.52, sandbagLunges: 0.32, wallBalls: 0.28,
    } satisfies Record<StationId, number>,
    /** Seconds lost to partner changeovers per station (only when both partners contribute). */
    swapSec: {
      skierg: 6, sledPush: 4, sledPull: 6, burpeeBroadJump: 3,
      row: 10, farmersCarry: 4, sandbagLunges: 4, wallBalls: 5,
    } satisfies Record<StationId, number>,
    /**
     * Elites gain less from splitting (they already work near their limit): the intensity floor
     * moves this far towards 1 for a pair whose run factor is ≤ 1.10, scaling to 0 at ≥ 1.20.
     */
    eliteFloorShift: 0.4,
    /** Share of the solo running compromise that remains when stations are split. */
    runCompromiseShare: 0.8,
    /** Running together at the slower partner's pace costs a little extra. */
    pairRunPenalty: 1.01,
    /**
     * Roxzone: you move together, so the slower partner sets the pace (weight 0.6 on the slower
     * one, 0.4 on the faster), but each of you rests while the other works (× 0.95).
     */
    roxzoneSlowerWeight: 0.6,
    roxzoneFactor: 0.95,
    /** Nobody does all or none of a station: shares are kept in this range. */
    shareRange: [0.2, 0.8] as const,
    /** "Suggest a split" stays practical: between these shares, in 5% steps. */
    suggestRange: [0.3, 0.7] as const,
  },

  // ── Relay ──────────────────────────────────────────────────────────────────────────
  relay: {
    /** 1 km run ÷ 5K pace for each athlete's first and second run. */
    runFactorLeg: [1.03, 1.08],
    /** Stations done on fresh legs (≈ inverse of the 1.15–1.25 race-fatigue factors). */
    stationFreshness: 0.83,
    /** Fresh athletes move through the Roxzone faster. */
    roxzoneFactor: 0.75,
    handoverSec: 5,
  },

  /**
   * Height (optional). Research: under 0.5% of finish time per 10 cm overall. Longer levers
   * and strides help the ergs, lunges and burpee broad jumps; wall balls are roughly neutral
   * (shorter throw vs. longer squat). Per 10 cm vs. the sex reference, capped per station.
   */
  height: {
    refCm: { male: 178, female: 165 },
    perTenCm: { skierg: -0.015, row: -0.015, sandbagLunges: -0.04, burpeeBroadJump: -0.03 } as Partial<Record<StationId, number>>,
    cap: 0.08,
  },
  /**
   * Masters (estimate): once a run time is known most of the age effect is already in it;
   * add a small extra station/Roxzone recovery penalty from 50 (per year), capped.
   */
  mastersStationPerYear: 0.003,
  mastersStationCap: 0.04,

  /** How strongly a previous HYROX result pulls the prediction (0 = ignore, 1 = trust fully). */
  previousResultWeight: 0.6,
} as const;

