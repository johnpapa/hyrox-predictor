import { AbilityId, AthleteProfile, CompromisedRuns, hyroxAgeGroup, peerProfile, sanitizeRanges } from './athlete';
import { FALLBACK } from './fallback-params';
import { ResolvedAthlete, resolveAthlete } from './resolve';
import { DivisionInfo, STANDARDS, Sex, WeightClass, findDivision, nativeOpenDivision, weightForAthlete } from './divisions';
import { PARAMS } from './model-params';
import { AGE_GROUP_FACTOR, FIELD, PRO_MULT, STATION_FLOOR, interpolateBand, tableFor } from './split-tables';
import { STATIONS, STATION_IDS, StationId } from './stations';

// ─────────────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────────────

export type StationTimes = Record<StationId, number>;

/** One athlete's projected race as if they raced the division's stations alone. */
export interface SoloPrediction {
  runs: number[];
  stations: StationTimes;
  roxzone: number;
  /** Average HYROX 1 km ÷ 5K pace. */
  runFactor: number;
  /** 5K used (entered, or assumed). */
  fiveKSec: number;
  /** Relative uncertainty (e.g. 0.06 = ±6%). */
  uncertainty: number;
  /** Applied scale from a previous HYROX result (1 = none). */
  calibration: number;
  /** Where every input came from (measured / converted / rated / assumed). */
  resolved: ResolvedAthlete;
  /**
   * What an athlete like you does on each station (same loads): same sex, age, height, weight,
   * body fat, experience, race times and training volume, typical on every trainable ability.
   */
  typical: StationTimes;
  typicalRoxzone: number;
  /** Typical max unbroken wall balls for this level (race ball). */
  typicalWallBallsUnbroken: number;
  total: number;
}

export interface Contribution {
  athlete: number;
  /** Share of the work (0–1). */
  share: number;
  sec: number;
}

export interface Segment {
  kind: 'run' | 'station';
  /** 0–7: position in the race. */
  index: number;
  stationId?: StationId;
  label: string;
  detail: string;
  sec: number;
  overridden: boolean;
  contributions: Contribution[];
}

export interface Prediction {
  division: DivisionInfo;
  segments: Segment[];
  roxzone: number;
  runTotal: number;
  workTotal: number;
  total: number;
  low: number;
  high: number;
  bestRun: number;
  avgRun: number;
  /** Estimated % of the division field finishing faster than this time (null: no field data). */
  topPercent: number | null;
  /** Singles: estimated position within the athlete's HYROX age group. */
  ageGroup: { label: string; topPercent: number } | null;
  solos: SoloPrediction[];
  /** Doubles: share of each station taken by athlete 0. */
  doublesShares?: StationTimes;
  /** Relay: athlete index doing each leg pair (0–3). */
  relayOrder?: number[];
}

export interface PredictInput {
  divisionId: string;
  athletes: AthleteProfile[];
  /** Doubles: athlete 0's share per station (0–1); missing/null ⇒ optimised automatically. */
  doublesShares?: Partial<Record<StationId, number | null>>;
  /** Relay: athlete index per leg pair; missing ⇒ fastest order is chosen automatically. */
  relayOrder?: number[] | null;
  /** Lock a station to a known total time (seconds). */
  overrides?: Partial<Record<StationId, number | null>>;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────────────

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const nativeClass = (sex: Sex): WeightClass => (sex === 'male' ? 'menOpen' : 'womenOpen');
const proClass = (sex: Sex): WeightClass => (sex === 'male' ? 'menPro' : 'womenPro');

const RUN_SHAPE = (() => {
  const mean = sum([...PARAMS.runShape]) / PARAMS.runShape.length;
  return PARAMS.runShape.map((x) => x / mean);
})();

/** Run shape for a given run factor: elites (low factor) pace far more evenly. */
export function runShapeFor(runFactor: number, runningKm: number | null = null): number[] {
  const f = PARAMS.runShapeFlatten;
  const t = clamp((runFactor - f.flatAt) / (f.fullAt - f.flatAt), 0, 1);
  const V = PARAMS.runVolumeFlatten;
  const extra = runningKm == null ? 0 : Math.max(0, runningKm - PARAMS.runFactor.runningVolume.refKm);
  const scale = (f.minScale + (1 - f.minScale) * t) * (1 - V.maxShare * Math.min(1, extra / V.fullAtExtraKm));
  return RUN_SHAPE.map((x) => 1 + (x - 1) * scale);
}

/**
 * First-race lap penalty: a fixed pacing allowance plus an "unfamiliar with compromised running"
 * part that fitness indicators shrink (running volume, durable race times, other training).
 */
export function firstRaceRunPenalty(
  runningKm: number | null, enduranceK: number | null, otherHours: number | null, compromised: CompromisedRuns | null = null,
): number {
  const F = PARAMS.runFactor.firstRace;
  const extraKm = runningKm == null ? 0 : Math.max(0, runningKm - PARAMS.runFactor.runningVolume.refKm);
  let offset = F.volumeOffsetMax * Math.min(1, extraKm / F.volumeFullAtExtraKm);
  if (enduranceK != null && enduranceK <= PARAMS.runFactor.endurance.refExponent) offset += F.enduranceOffset;
  if (otherHours != null && otherHours >= F.otherTrainingHours) offset += F.otherTrainingOffset;
  if (compromised) offset += PARAMS.runFactor.compromised.firstRaceOffset[compromised];
  return F.pacing + F.unfamiliar * (1 - Math.min(F.maxOffset, offset));
}

/** Run-factor change from weekly running volume (diminishing returns; 0 when unknown). */
export function runningVolumeAdj(km: number | null, enduranceKnown: boolean): number {
  if (km == null) return 0;
  const V = PARAMS.runFactor.runningVolume;
  const adj =
    km >= V.refKm
      ? -V.maxBenefit * (1 - Math.exp(-(km - V.refKm) / V.scaleKm))
      : V.maxPenalty * ((V.refKm - km) / V.refKm);
  return enduranceKnown ? adj * V.withEnduranceShare : adj;
}

/** Self-level × race-craft bonuses are capped so stacked multipliers stay realistic. */
function skill(x: number): number {
  return Math.max(PARAMS.minSkillMult, x);
}

/**
 * Time multiplier for racing a station on a load different from the athlete's own Open
 * standard. Uses a power law whose elasticity is fitted to the observed Pro/Open ratio,
 * so it works for Pro, mixed doubles (women on men's loads) and corporate relay (men on
 * women's loads).
 */
export function loadMultiplier(sex: Sex, station: StationId, cls: WeightClass): number {
  const native = STANDARDS[nativeClass(sex)][station].kg;
  const target = STANDARDS[cls][station].kg;
  const proKg = STANDARDS[proClass(sex)][station].kg;
  const proMult = PRO_MULT[sex][station];
  if (!native || !proMult || target === native || proKg === native) return 1;
  const elasticity = Math.log(proMult) / Math.log(proKg / native);
  return Math.pow(target / native, elasticity);
}

function strengthClamp(x: number): number {
  return clamp(x, PARAMS.strengthMultClamp[0], PARAMS.strengthMultClamp[1]);
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Solo model
// ─────────────────────────────────────────────────────────────────────────────────────

export function predictSolo(raw: AthleteProfile, division: DivisionInfo, withPeer = true): SoloPrediction {
  const a = sanitizeRanges(raw);
  // A previous result is a singles time on the athlete's own weights: calibrate against that race.
  const calibration = previousResultCalibration(a);
  const sex = a.sex;
  const r = resolveAthlete(a);
  const bw = r.bodyweightKg;
  const bwRef = FALLBACK.refBodyweightKg[sex];
  const rf = PARAMS.runFactor;
  const fiveK = r.fiveK.value;

  const loadMult = {} as StationTimes;
  for (const id of STATION_IDS) loadMult[id] = loadMultiplier(sex, id, weightForAthlete(division, sex, id));
  const heavy = loadMult.sledPush > 1.01;

  // Running ────────────────────────────────────────────────────────────────────────
  const E = rf.endurance;
  const k0 = r.fiveK.quality === 'measured' ? enduranceExponent(a) : null;
  const enduranceAdj = k0 == null ? 0 : clamp((k0 - E.refExponent) * E.scale, E.min, E.max);
  const runFactor = clamp(
    enduranceAdj +
    rf.base +
      (rf.per5kMinSlower * (fiveK - rf.ref5kSec[sex])) / 60 +
      rf.experience[a.experience] +
      (a.experience === 'first' ? firstRaceRunPenalty(r.runningKmPerWeek, k0, r.otherTrainingHours, a.compromisedRuns) : 0) +
      (a.compromisedRuns ? rf.compromised.adj[a.compromisedRuns] : 0) +
      (heavy ? rf.pro : 0) +
      runningVolumeAdj(r.runningKmPerWeek, k0 != null),
    rf.min,
    rf.max,
  );
  const avgRun = (fiveK / 5) * runFactor;
  const runs = runShapeFor(runFactor, r.runningKmPerWeek).map((s) => avgRun * s);

  // Baseline: median splits of athletes who run at this pace ─────────────────────────
  // Baselines come from the run pace *without* the Pro running penalty: heavier sleds slow
  // the runs, but they don't make the athlete a weaker skier or rower.
  const band = interpolateBand(tableFor(sex), avgRun - (heavy ? (fiveK / 5) * rf.pro : 0));
  const base = band.stations;
  const st = {} as StationTimes;
  const expMult = PARAMS.experienceStationMult[a.experience];
  const fatigue = FALLBACK.raceFatigue;

  // Ergs: measured/converted 1k › the other erg ± typical ski-vs-row gap › erg level ────
  const gap = FALLBACK.skiSlowerThanRowPer1k[sex];
  const skiTT = r.ski1k?.value ?? (r.row1k ? r.row1k.value + gap : null);
  const rowTT = r.row1k?.value ?? (r.ski1k ? r.ski1k.value - gap : null);
  const ergBw = Math.pow(bw / bwRef, PARAMS.ergBodyweightExp);
  st.skierg = skiTT ? skiTT * PARAMS.ergRaceFactor : base.skierg * ergBw * r.ergMult.value;
  st.row = rowTT ? rowTT * PARAMS.ergRaceFactor : base.row * ergBw * r.ergMult.value;

  // Strength references: the model's typical athlete ─────────────────────────────────
  const squat = r.squat.value;
  const dead = r.deadlift.value;
  const squatRef = bwRef * FALLBACK.typicalPerBw.legs[sex];
  const deadRef = bwRef * FALLBACK.typicalPerBw.hinge[sex];
  const gripOnPull = 1 + (r.grip.value - 1) * FALLBACK.gripEffectOnPull;

  // Sled push ─────────────────────────────────────────────────────────────────────────
  if (r.tests.sledPush) {
    st.sledPush = r.tests.sledPush * fatigue.sledPush;
  } else {
    const push = PARAMS.sledPush;
    const cap = push.bwShare * bw + push.liftShare * squat;
    const capRef = push.bwShare * bwRef + push.liftShare * squatRef;
    st.sledPush = base.sledPush * loadMult.sledPush * strengthClamp(Math.pow(capRef / cap, push.exp)) * skill(r.sled.value * expMult);
  }

  // Sled pull ─────────────────────────────────────────────────────────────────────────
  if (r.tests.sledPull) {
    st.sledPull = r.tests.sledPull * fatigue.sledPull;
  } else {
    const pull = PARAMS.sledPull;
    const cap = pull.bwShare * bw + pull.liftShare * dead;
    const capRef = pull.bwShare * bwRef + pull.liftShare * deadRef;
    st.sledPull =
      base.sledPull * loadMult.sledPull * strengthClamp(Math.pow(capRef / cap, pull.exp)) * skill(r.sled.value * gripOnPull * expMult);
  }

  // Burpee broad jumps ───────────────────────────────────────────────────────────────
  st.burpeeBroadJump = r.tests.bbj
    ? r.tests.bbj * fatigue.burpeeBroadJump
    : base.burpeeBroadJump * Math.pow(bw / bwRef, PARAMS.bbjBodyweightExp) * skill(r.burpees.value);

  // Farmers carry ────────────────────────────────────────────────────────────────────
  st.farmersCarry = r.tests.farmers
    ? r.tests.farmers * fatigue.farmersCarry
    : base.farmersCarry * loadMult.farmersCarry * strengthClamp(Math.pow(deadRef / dead, PARAMS.farmers.exp)) * skill(r.grip.value);

  // Sandbag lunges ───────────────────────────────────────────────────────────────────
  if (r.tests.lunges) {
    st.sandbagLunges = r.tests.lunges * fatigue.sandbagLunges;
  } else {
    const bag = STANDARDS[nativeClass(sex)].sandbagLunges.kg;
    st.sandbagLunges =
      base.sandbagLunges * loadMult.sandbagLunges * skill(expMult * r.lunges.value) *
      strengthClamp(Math.pow((bw + bag) / squat / ((bwRef + bag) / squatRef), PARAMS.lunges.exp));
  }

  // Wall balls: 100-rep test › unbroken max › level ──────────────────────────────────
  if (r.tests.wallBalls100) {
    st.wallBalls = r.tests.wallBalls100 * fatigue.wallBalls;
  } else if (r.wallBallsUnbroken) {
    const typical = band.wbUnbroken / Math.pow(loadMult.wallBalls, PARAMS.wallBallsLoadUnbrokenExp);
    st.wallBalls =
      base.wallBalls * loadMult.wallBalls * strengthClamp(Math.pow(typical / r.wallBallsUnbroken, PARAMS.wallBallsUnbrokenExp));
  } else {
    st.wallBalls = base.wallBalls * loadMult.wallBalls * skill(r.wallBalls.value);
  }

  // Cap the combined personal adjustment for formula-based stations ───────────────────
  const tested: Partial<Record<StationId, boolean>> = {
    sledPush: !!r.tests.sledPush, sledPull: !!r.tests.sledPull, burpeeBroadJump: !!r.tests.bbj,
    farmersCarry: !!r.tests.farmers, sandbagLunges: !!r.tests.lunges, wallBalls: !!r.tests.wallBalls100,
    skierg: !!skiTT, row: !!rowTT,
  };
  // Height (optional, small) and masters recovery (from 50) ────────────────────────────
  if (r.heightCm) {
    const H = PARAMS.height;
    const tens = (r.heightCm - H.refCm[sex]) / 10;
    for (const [id, per] of Object.entries(H.perTenCm) as [StationId, number][]) {
      if (tested[id]) continue;
      st[id] *= 1 + clamp(per * tens, -H.cap, H.cap);
    }
  }
  if (r.otherTrainingHours != null) {
    const O = PARAMS.otherTraining;
    const m = clamp(-O.perHour * (r.otherTrainingHours - O.refHours), -O.cap, O.cap);
    for (const id of STATION_IDS) {
      if (tested[id]) continue;
      st[id] *= 1 + (id === 'skierg' || id === 'row' ? m * O.ergShare : m);
    }
  }
  const masters = a.age && a.age > 50 ? Math.min(PARAMS.mastersStationCap, (a.age - 50) * PARAMS.mastersStationPerYear) : 0;
  if (masters) for (const id of STATION_IDS) if (!tested[id]) st[id] *= 1 + masters;

  const [lo, hi] = PARAMS.personalMultRange;
  for (const id of STATION_IDS) {
    if (tested[id]) continue;
    const typical = base[id] * loadMult[id];
    st[id] = clamp(st[id], typical * lo, typical * hi);
  }

  // World-class floors (scaled for heavier loads) ─────────────────────────────────────
  for (const id of STATION_IDS) st[id] = Math.max(st[id], STATION_FLOOR[sex][id] * loadMult[id]);

  // Roxzone ──────────────────────────────────────────────────────────────────────────
  // A transitions self-rating describes how you actually move, so it replaces the
  // experience-based allowance instead of stacking with it.
  let roxzone =
    (1 + masters) *
    band.roxzone * (a.levels.transitions ? 1 : PARAMS.roxzoneExperienceMult[a.experience]) * r.transitions.value;

  // Calibration from a previous result ───────────────────────────────────────────────
  if (calibration !== 1) {
    for (let i = 0; i < runs.length; i++) runs[i] *= calibration;
    for (const id of STATION_IDS) st[id] *= calibration;
    roxzone *= calibration;
  }

  // Comparison athlete: you, minus everything trainable (scaled by the same calibration) ──
  const peer = withPeer ? predictSolo(peerProfile(a), division, false) : null;

  return {
    runs,
    stations: st,
    roxzone,
    runFactor,
    fiveKSec: fiveK,
    uncertainty: soloUncertainty(a, r),
    calibration,
    resolved: r,
    typical: peer
      ? (Object.fromEntries(STATION_IDS.map((id) => [id, peer.stations[id] * calibration])) as StationTimes)
      : { ...st },
    typicalRoxzone: peer ? peer.roxzone * calibration : roxzone,
    typicalWallBallsUnbroken: band.wbUnbroken / Math.pow(loadMult.wallBalls, PARAMS.wallBallsLoadUnbrokenExp),
    total: sum(runs) + sum(STATION_IDS.map((id) => st[id])) + roxzone,
  };
}

/** Riegel exponent between the 5K and the longest other race entered (null if none). */
export function enduranceExponent(a: AthleteProfile): number | null {
  // Shortest and longest races entered.
  const races = ([
    [a.fiveKSec, 5000],
    [a.tenKSec, 10000],
    [a.halfMarathonSec, 21097.5],
    [a.marathonSec, 42195],
  ] as [number | null, number][]).filter(([t]) => t != null && t > 0) as [number, number][];
  if (races.length < 2) return null;
  const [t1, d1] = races[0];
  const [t2, d2] = races[races.length - 1];
  if (t2 <= t1) return null;
  const k = Math.log(t2 / t1) / Math.log(d2 / d1);
  return k > 0.95 && k < 1.3 ? k : null; // ignore implausible combinations
}

/**
 * Scale factor from a previous singles result, compared with this model's prediction for the
 * athlete's own Open division (so switching to Pro, mixed doubles, etc. doesn't distort it).
 */
function previousResultCalibration(a: AthleteProfile): number {
  const prev = a.previousHyroxSec;
  if (!prev || !isFinite(prev) || prev < 40 * 60 || prev > 4 * 3600) return 1;
  const native = predictSolo({ ...a, previousHyroxSec: null }, nativeOpenDivision(a.sex), false).total;
  return clamp(1 + PARAMS.previousResultWeight * (prev / native - 1), 0.75, 1.3);
}

export function soloUncertainty(a: AthleteProfile, r: ResolvedAthlete = resolveAthlete(a)): number {
  let u = FALLBACK.baseUncertainty;
  for (const id of Object.keys(r.quality) as AbilityId[]) {
    u += FALLBACK.abilityWeight[id] * FALLBACK.qualityFactor[r.quality[id]];
  }
  if (!r.bodyweightKnown) u += 0.005;
  if (r.runningKmPerWeek == null) u += 0.004;
  if (r.otherTrainingHours == null) u += 0.002;
  if (a.experience === 'first') u += 0.015;
  if (a.experience === 'unknown') u += 0.01;
  if (a.previousHyroxSec) u -= 0.025;
  return clamp(u, 0.025, 0.2);
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Doubles
// ─────────────────────────────────────────────────────────────────────────────────────

/** Station time when athlete A does share p of the work and B does the rest. */
/** Intensity floor for a pair; fitter pairs (lower run factor) benefit less from splitting. */
export function doublesFloor(id: StationId, pairRunFactor = 1.2): number {
  const base = PARAMS.doubles.intensityFloor[id];
  const t = clamp((1.2 - pairRunFactor) / 0.1, 0, 1);
  return base + (1 - base) * PARAMS.doubles.eliteFloorShift * t;
}

export function doublesStationTime(id: StationId, ta: number, tb: number, p: number, pairRunFactor = 1.2): number {
  const a = doublesFloor(id, pairRunFactor);
  const q = 1 - p;
  const swap = p > 0.001 && q > 0.001 ? PARAMS.doubles.swapSec[id] : 0;
  return p * ta * (a + (1 - a) * p) + q * tb * (a + (1 - a) * q) + swap;
}

export function optimalDoublesShare(id: StationId, ta: number, tb: number, pairRunFactor = 1.2): number {
  let best = 0.5;
  let bestT = Infinity;
  for (let i = 0; i <= 20; i++) {
    const p = i / 20;
    const t = doublesStationTime(id, ta, tb, p, pairRunFactor);
    if (t < bestT - 1e-9) {
      bestT = t;
      best = p;
    }
  }
  return best;
}

function doublesRun(solo: SoloPrediction): number[] {
  const factor = 1 + (solo.runFactor - 1) * PARAMS.doubles.runCompromiseShare;
  return runShapeFor(factor, solo.resolved.runningKmPerWeek).map((s) => (solo.fiveKSec / 5) * factor * s * solo.calibration);
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Relay
// ─────────────────────────────────────────────────────────────────────────────────────

interface RelayResult {
  runs: { sec: number; athlete: number }[];
  stations: { sec: number; athlete: number }[];
  roxzone: number;
  total: number;
}

function relayFor(order: number[], solos: SoloPrediction[]): RelayResult {
  const runs: RelayResult['runs'] = [];
  const stations: RelayResult['stations'] = [];
  let roxzone = PARAMS.relay.handoverSec * 3;
  for (let leg = 0; leg < 4; leg++) {
    const ath = order[leg];
    const solo = solos[ath];
    const extra = (solo.runFactor - PARAMS.runFactor.base) * 0.5;
    for (let j = 0; j < 2; j++) {
      const idx = leg * 2 + j;
      runs.push({
        sec: (solo.fiveKSec / 5) * (PARAMS.relay.runFactorLeg[j] + extra) * solo.calibration * (idx === 7 ? 1.08 : 1),
        athlete: ath,
      });
      stations.push({ sec: solo.stations[STATION_IDS[idx]] * PARAMS.relay.stationFreshness, athlete: ath });
      roxzone += (solo.roxzone / 8) * PARAMS.relay.roxzoneFactor;
    }
  }
  const total = sum(runs.map((r) => r.sec)) + sum(stations.map((s) => s.sec)) + roxzone;
  return { runs, stations, roxzone, total };
}

function permutations(xs: number[]): number[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

export function bestRelayOrder(solos: SoloPrediction[]): number[] {
  let best = [0, 1, 2, 3];
  let bestT = Infinity;
  for (const p of permutations([0, 1, 2, 3])) {
    const t = relayFor(p, solos).total;
    if (t < bestT - 1e-9) {
      bestT = t;
      best = p;
    }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Top level
// ─────────────────────────────────────────────────────────────────────────────────────

/** Standard normal CDF (Abramowitz–Stegun 7.1.26). */
function normCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y =
    1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

export function topPercent(divisionId: string, totalSec: number, medianFactor = 1): number | null {
  const f = FIELD[divisionId];
  if (!f) return null;
  const z = (Math.log(totalSec / 60) - Math.log(f.medianMin * medianFactor)) / f.sigma;
  return clamp(normCdf(z) * 100, 0.1, 99.9);
}

/** Position within the athlete's HYROX 5-year age group (singles; null if age unknown). */
export function ageGroupPosition(division: DivisionInfo, athlete: AthleteProfile | undefined, totalSec: number): { label: string; topPercent: number } | null {
  if (division.format !== 'single' || !athlete) return null;
  const group = hyroxAgeGroup(sanitizeRanges(athlete).age);
  if (!group) return null;
  const factor = AGE_GROUP_FACTOR[athlete.sex][group];
  const top = topPercent(division.id, totalSec, factor);
  if (top == null) return null;
  return { label: `${athlete.sex === 'male' ? 'Men' : 'Women'} ${group}`, topPercent: top };
}

export function predict(input: PredictInput): Prediction {
  const division = findDivision(input.divisionId);
  const athletes = input.athletes.slice(0, division.teamSize);
  const solos = athletes.map((a) => predictSolo(a, division));

  const runSecs: number[] = [];
  const runContrib: Contribution[][] = [];
  const stSecs = {} as StationTimes;
  const stContrib = {} as Record<StationId, Contribution[]>;
  let roxzone: number;
  let doublesShares: StationTimes | undefined;
  let relayOrder: number[] | undefined;

  if (division.format === 'single') {
    const s = solos[0];
    s.runs.forEach((r) => {
      runSecs.push(r);
      runContrib.push([{ athlete: 0, share: 1, sec: r }]);
    });
    for (const id of STATION_IDS) {
      stSecs[id] = s.stations[id];
      stContrib[id] = [{ athlete: 0, share: 1, sec: s.stations[id] }];
    }
    roxzone = s.roxzone;
  } else if (division.format === 'doubles') {
    const [sa, sb] = solos;
    const ra = doublesRun(sa);
    const rb = doublesRun(sb);
    for (let i = 0; i < 8; i++) {
      const r = Math.max(ra[i], rb[i]) * PARAMS.doubles.pairRunPenalty;
      runSecs.push(r);
      runContrib.push([
        { athlete: 0, share: 1, sec: r },
        { athlete: 1, share: 1, sec: r },
      ]);
    }
    doublesShares = {} as StationTimes;
    const pairRf = (sa.runFactor + sb.runFactor) / 2;
    for (const id of STATION_IDS) {
      const ta = sa.stations[id];
      const tb = sb.stations[id];
      const given = input.doublesShares?.[id];
      const p = given != null && isFinite(given) ? clamp(given, 0, 1) : optimalDoublesShare(id, ta, tb, pairRf);
      doublesShares[id] = p;
      const a = doublesFloor(id, pairRf);
      const total = doublesStationTime(id, ta, tb, p, pairRf);
      stSecs[id] = total;
      // Changeover time is shared in proportion to the work so contributions add up.
      const workA = p * ta * (a + (1 - a) * p);
      const workB = (1 - p) * tb * (a + (1 - a) * (1 - p));
      const swap = total - workA - workB;
      stContrib[id] = [
        { athlete: 0, share: p, sec: workA + swap * p },
        { athlete: 1, share: 1 - p, sec: workB + swap * (1 - p) },
      ];
    }
    roxzone = Math.max(sa.roxzone, sb.roxzone) * PARAMS.doubles.roxzoneFactor;
  } else {
    const valid =
      input.relayOrder && input.relayOrder.length === 4 && new Set(input.relayOrder).size === 4 &&
      input.relayOrder.every((x) => x >= 0 && x < 4);
    relayOrder = valid ? [...input.relayOrder!] : bestRelayOrder(solos);
    const r = relayFor(relayOrder, solos);
    r.runs.forEach((x) => {
      runSecs.push(x.sec);
      runContrib.push([{ athlete: x.athlete, share: 1, sec: x.sec }]);
    });
    STATION_IDS.forEach((id, i) => {
      stSecs[id] = r.stations[i].sec;
      stContrib[id] = [{ athlete: r.stations[i].athlete, share: 1, sec: r.stations[i].sec }];
    });
    roxzone = r.roxzone;
  }

  // Overrides ──────────────────────────────────────────────────────────────────────
  const overridden = new Set<StationId>();
  for (const id of STATION_IDS) {
    const o = input.overrides?.[id];
    if (o != null && o > 0) {
      const scale = o / stSecs[id];
      stSecs[id] = o;
      stContrib[id] = stContrib[id].map((c) => ({ ...c, sec: c.sec * scale }));
      overridden.add(id);
    }
  }

  // Assemble race-order segments ───────────────────────────────────────────────────
  const segments: Segment[] = [];
  STATIONS.forEach((s, i) => {
    segments.push({
      kind: 'run', index: i, label: `Running ${i + 1}`, detail: '1 km',
      sec: runSecs[i], overridden: false, contributions: runContrib[i],
    });
    const lead = stContrib[s.id].reduce((x, y) => (y.share > x.share ? y : x));
    const std = STANDARDS[weightForAthlete(division, athletes[lead.athlete].sex, s.id)][s.id];
    segments.push({
      kind: 'station', index: i, stationId: s.id, label: `${s.distance} ${s.name}`.replace('100 reps ', ''),
      detail: s.id === 'wallBalls' ? `100 reps · ${std.load}` : std.load,
      sec: stSecs[s.id], overridden: overridden.has(s.id), contributions: stContrib[s.id],
    });
  });

  const runTotal = sum(runSecs);
  const workTotal = sum(STATION_IDS.map((id) => stSecs[id]));
  const total = runTotal + workTotal + roxzone;
  const u = sum(solos.map((s) => s.uncertainty)) / solos.length;
  const unlocked = total - sum([...overridden].map((id) => stSecs[id]));
  const spread = unlocked * u;

  return {
    division,
    segments,
    roxzone,
    runTotal,
    workTotal,
    total,
    low: total - spread,
    high: total + spread,
    bestRun: Math.min(...runSecs),
    avgRun: runTotal / 8,
    topPercent: topPercent(division.id, total),
    ageGroup: ageGroupPosition(division, athletes[0], total),
    solos,
    doublesShares,
    relayOrder,
  };
}
