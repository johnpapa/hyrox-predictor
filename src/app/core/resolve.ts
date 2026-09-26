import { AbilityId, AthleteProfile, Level, LiftId } from './athlete';
import { Sex } from './divisions';
import { oneRepMax, paulsLaw, raceTimeFromVdot, riegel } from './formulas';
import { FALLBACK } from './fallback-params';

/**
 * How a value was obtained. Drives the confidence range:
 *  measured  – the athlete entered the benchmark itself
 *  converted – derived from a related benchmark (another lift, race distance, erg distance)
 *  rated     – from a Weak…Elite self-assessment
 *  assumed   – nothing entered; typical value for an athlete at the same running level
 */
export type Quality = 'measured' | 'converted' | 'rated' | 'assumed';

export interface Resolved {
  value: number;
  quality: Quality;
  /** Human-readable description of where the value came from. */
  source: string;
}

export interface ResolvedAthlete {
  bodyweightKg: number;
  /** 5K time, seconds. */
  fiveK: Resolved;
  /** Fresh 1000 m erg times (null = use typical for run level × `ergMult`). */
  ski1k: Resolved | null;
  row1k: Resolved | null;
  ergMult: Resolved;
  /** Estimated 1RMs, kg. */
  squat: Resolved;
  deadlift: Resolved;
  /** Station-time multipliers (1 = typical for run level, < 1 faster). */
  grip: Resolved;
  burpees: Resolved;
  sled: Resolved;
  lunges: Resolved;
  wallBalls: Resolved;
  transitions: Resolved;
  /** Fresh station tests, seconds (null when not entered). */
  tests: {
    sledPush: number | null;
    sledPull: number | null;
    bbj: number | null;
    farmers: number | null;
    lunges: number | null;
    wallBalls100: number | null;
  };
  wallBallsUnbroken: number | null;
  /** Quality per ability, for the confidence display. */
  quality: Record<AbilityId, Quality>;
  /** What each ability's estimate is based on, for display. */
  sources: Record<AbilityId, string>;
}

const fmtKg = (kg: number) => `${Math.round(kg)} kg`;
const fmtT = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};
const levelName = (l: Level) => FALLBACK.levelNames[l - 1];
const pos = (x: number | null | undefined): x is number => x != null && isFinite(x) && x > 0;

/** Interpolate a 5-point level table at a (possibly fractional) level 1..5. */
export function atLevel(table: readonly number[], level: number): number {
  const x = Math.min(4, Math.max(0, level - 1));
  const i = Math.min(3, Math.floor(x));
  return table[i] + (table[i + 1] - table[i]) * (x - i);
}

/** Inverse of `atLevel` for a monotonic table: which (fractional) level does a value sit at? */
export function levelOf(table: readonly number[], value: number): number {
  const asc = table[4] > table[0];
  const t = asc ? table : [...table].reverse();
  const v = value;
  if (v <= t[0]) return asc ? 1 - Math.min(1, (t[0] - v) / (t[1] - t[0])) : 5 + Math.min(1, (t[0] - v) / (t[1] - t[0]));
  for (let i = 0; i < 4; i++) {
    if (v <= t[i + 1]) {
      const f = i + (v - t[i]) / (t[i + 1] - t[i]);
      return asc ? 1 + f : 5 - f;
    }
  }
  const over = Math.min(1, (v - t[4]) / (t[4] - t[3]));
  return asc ? 5 + over : 1 - over;
}

/** Station multiplier for a level (3 ⇒ 1.0). */
function levelMult(level: number): number {
  return atLevel(FALLBACK.levelMult, level);
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Running
// ─────────────────────────────────────────────────────────────────────────────────────

function resolveFiveK(a: AthleteProfile): Resolved {
  if (pos(a.fiveKSec)) return { value: a.fiveKSec, quality: 'measured', source: `5K ${fmtT(a.fiveKSec)}` };
  if (pos(a.tenKSec)) {
    return { value: riegel(a.tenKSec, 10000, 5000, FALLBACK.riegelExp.tenK), quality: 'converted', source: `from 10K ${fmtT(a.tenKSec)} (Riegel)` };
  }
  if (pos(a.mileSec)) {
    return { value: riegel(a.mileSec, 1609.34, 5000, FALLBACK.riegelExp.mile), quality: 'converted', source: `from mile ${fmtT(a.mileSec)} (Riegel)` };
  }
  if (pos(a.halfMarathonSec)) {
    return {
      value: riegel(a.halfMarathonSec, 21097.5, 5000, FALLBACK.riegelExp.half),
      quality: 'converted',
      source: `from half marathon ${fmtT(a.halfMarathonSec)} (Riegel)`,
    };
  }
  if (pos(a.cooperMeters) && a.cooperMeters > 1000) {
    const vo2 = (a.cooperMeters - 504.9) / 44.73;
    return {
      value: raceTimeFromVdot(vo2, 5000),
      quality: 'converted',
      source: `from Cooper test ${Math.round(a.cooperMeters)} m (VO₂max ≈ ${vo2.toFixed(0)})`,
    };
  }
  if (pos(a.vo2max) && a.vo2max > 20 && a.vo2max < 90) {
    const vdot = a.vo2max - FALLBACK.watchVo2Offset;
    // Watch estimates are loose, so treat this like a self-rating for confidence.
    return { value: raceTimeFromVdot(vdot, 5000), quality: 'rated', source: `from VO₂max ${a.vo2max} (Daniels VDOT)` };
  }
  if (pos(a.restingHr) && a.restingHr >= 30 && a.restingHr <= 110) {
    const U = FALLBACK.uth;
    const hrMax = U.hrMaxBase - U.hrMaxPerYear * (a.age ?? U.defaultAge);
    const vo2 = (U.factor * hrMax) / a.restingHr;
    return {
      value: raceTimeFromVdot(vo2 - FALLBACK.watchVo2Offset, 5000),
      quality: 'rated',
      source: `from resting HR ${a.restingHr}${a.age ? ` & age ${a.age}` : ''} (VO₂max ≈ ${vo2.toFixed(0)}, rough)`,
    };
  }
  const lvl = a.levels.run;
  if (lvl) {
    const v = atLevel(FALLBACK.fiveKByLevel[a.sex], lvl);
    return { value: v, quality: 'rated', source: `${levelName(lvl)} runner ≈ ${fmtT(v)} 5K` };
  }
  const v = atLevel(FALLBACK.fiveKByLevel[a.sex], 3) * ageFactor(a.age);
  return {
    value: v,
    quality: 'assumed',
    source: `assumed ≈ ${fmtT(v)} 5K${a.age ? ` for age ${a.age}` : ''} (enter a run time!)`,
  };
}

/** Typical-performance slowdown with age (only used when running ability is unknown). */
export function ageFactor(age: number | null): number {
  if (age == null || !isFinite(age)) return 1;
  const A = FALLBACK.ageSlowdown;
  const mid = Math.max(0, Math.min(age, A.lateFrom) - A.from) * A.perYear;
  const late = Math.max(0, age - A.lateFrom) * A.latePerYear;
  return 1 + mid + late;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Ergs
// ─────────────────────────────────────────────────────────────────────────────────────

function resolveErg(
  kind: 'SkiErg' | 'Row',
  k1: number | null,
  k500: number | null,
  k2: number | null,
  k5: number | null,
): Resolved | null {
  if (pos(k1)) return { value: k1, quality: 'measured', source: `${kind} 1000m ${fmtT(k1)}` };
  if (pos(k2)) return { value: paulsLaw(k2, 2000, 1000), quality: 'converted', source: `from ${kind} 2000m ${fmtT(k2)}` };
  if (pos(k500)) return { value: paulsLaw(k500, 500, 1000), quality: 'converted', source: `from ${kind} 500m ${fmtT(k500)}` };
  if (pos(k5)) return { value: paulsLaw(k5, 5000, 1000), quality: 'converted', source: `from ${kind} 5000m ${fmtT(k5)}` };
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Strength
// ─────────────────────────────────────────────────────────────────────────────────────

function liftRM(a: AthleteProfile, id: LiftId): number | null {
  const l = a.lifts[id];
  return l && pos(l.kg) ? oneRepMax(l.kg, l.reps) : null;
}

function repsText(a: AthleteProfile, id: LiftId): string {
  const l = a.lifts[id];
  return l.reps && l.reps > 1 ? `${fmtKg(l.kg!)} × ${l.reps}` : fmtKg(l.kg!);
}

function resolveSquat(a: AthleteProfile, bw: number): Resolved {
  const R = FALLBACK.liftRatios;
  const back = liftRM(a, 'backSquat');
  if (back) return { value: back, quality: 'measured', source: `back squat ${repsText(a, 'backSquat')}${a.lifts.backSquat.reps! > 1 ? ` → 1RM ${fmtKg(back)}` : ''}` };
  const front = liftRM(a, 'frontSquat');
  if (front) return { value: front / R.frontToBackSquat, quality: 'converted', source: `from front squat ${repsText(a, 'frontSquat')}` };
  const dl = liftRM(a, 'deadlift');
  if (dl) return { value: dl * R.squatToDeadlift, quality: 'converted', source: `from deadlift ${repsText(a, 'deadlift')}` };
  const trap = liftRM(a, 'trapBar');
  if (trap) return { value: (trap / R.trapBarToDeadlift) * R.squatToDeadlift, quality: 'converted', source: `from trap-bar deadlift ${repsText(a, 'trapBar')}` };
  const rdl = liftRM(a, 'romanianDeadlift');
  if (rdl) return { value: (rdl / R.rdlToDeadlift) * R.squatToDeadlift, quality: 'converted', source: `from Romanian deadlift ${repsText(a, 'romanianDeadlift')}` };
  // Weak predictors: machine-dependent or upper body — confidence like a self-rating.
  const lp = liftRM(a, 'legPress');
  if (lp) return { value: lp * R.legPressToSquat, quality: 'rated', source: `from leg press ${repsText(a, 'legPress')} (rough)` };
  const bench = liftRM(a, 'benchPress');
  if (bench) return { value: bench * R.deadliftToBench[a.sex] * R.squatToDeadlift, quality: 'rated', source: `from bench press ${repsText(a, 'benchPress')} (rough)` };
  return fromStrengthLevel(a, bw, 'legs', FALLBACK.squatPerBw[a.sex], 'squat');
}

function resolveDeadlift(a: AthleteProfile, bw: number): Resolved {
  const R = FALLBACK.liftRatios;
  const dl = liftRM(a, 'deadlift');
  if (dl) return { value: dl, quality: 'measured', source: `deadlift ${repsText(a, 'deadlift')}${a.lifts.deadlift.reps! > 1 ? ` → 1RM ${fmtKg(dl)}` : ''}` };
  const trap = liftRM(a, 'trapBar');
  if (trap) return { value: trap / R.trapBarToDeadlift, quality: 'converted', source: `from trap-bar deadlift ${repsText(a, 'trapBar')}` };
  const rdl = liftRM(a, 'romanianDeadlift');
  if (rdl) return { value: rdl / R.rdlToDeadlift, quality: 'converted', source: `from Romanian deadlift ${repsText(a, 'romanianDeadlift')}` };
  const back = liftRM(a, 'backSquat');
  if (back) return { value: back / R.squatToDeadlift, quality: 'converted', source: `from back squat ${repsText(a, 'backSquat')}` };
  const front = liftRM(a, 'frontSquat');
  if (front) return { value: front / R.frontToBackSquat / R.squatToDeadlift, quality: 'converted', source: `from front squat ${repsText(a, 'frontSquat')}` };
  const lp = liftRM(a, 'legPress');
  if (lp) return { value: (lp * R.legPressToSquat) / R.squatToDeadlift, quality: 'rated', source: `from leg press ${repsText(a, 'legPress')} (rough)` };
  const bench = liftRM(a, 'benchPress');
  if (bench) return { value: bench * R.deadliftToBench[a.sex], quality: 'rated', source: `from bench press ${repsText(a, 'benchPress')} (rough)` };
  return fromStrengthLevel(a, bw, 'hinge', FALLBACK.deadliftPerBw[a.sex], 'deadlift');
}

function fromStrengthLevel(a: AthleteProfile, bw: number, ability: 'legs' | 'hinge', perBw: readonly number[], name: string): Resolved {
  const own = a.levels[ability];
  if (own) {
    const v = bw * atLevel(perBw, own);
    return { value: v, quality: 'rated', source: `${levelName(own)} strength ≈ ${fmtKg(v)} ${name}` };
  }
  // A sled self-rating says something about leg/hip strength too.
  if (a.levels.sled) {
    const v = bw * atLevel(perBw, a.levels.sled) * 0.98;
    return { value: v, quality: 'rated', source: `from sled rating (${levelName(a.levels.sled)}) ≈ ${fmtKg(v)} ${name}` };
  }
  const v = bw * FALLBACK.typicalPerBw[ability][a.sex];
  return { value: v, quality: 'assumed', source: `typical ≈ ${fmtKg(v)} ${name}` };
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Station multipliers from bodyweight tests or levels
// ─────────────────────────────────────────────────────────────────────────────────────

function fromLevel(a: AthleteProfile, id: AbilityId, what: string): Resolved {
  const l = a.levels[id];
  if (l) return { value: levelMult(l), quality: 'rated', source: `${levelName(l)} ${what}` };
  return { value: 1, quality: 'assumed', source: `typical ${what} for your level` };
}

function resolveGrip(a: AthleteProfile): Resolved {
  const hang = pos(a.deadHangSec) ? levelOf(FALLBACK.deadHangByLevel[a.sex], a.deadHangSec) : null;
  const pull = a.pullUps != null && a.pullUps >= 0 ? levelOf(FALLBACK.pullUpsByLevel[a.sex], a.pullUps) : null;
  if (hang != null && pull != null) {
    const l = (hang + pull) / 2;
    return { value: levelMult(l), quality: 'converted', source: `dead hang ${a.deadHangSec}s + ${a.pullUps} pull-ups ≈ ${levelName(Math.round(clampLevel(l)) as Level)}` };
  }
  if (hang != null) return { value: levelMult(hang), quality: 'converted', source: `dead hang ${a.deadHangSec}s ≈ ${levelName(Math.round(clampLevel(hang)) as Level)} grip` };
  if (pull != null) return { value: levelMult(pull), quality: 'converted', source: `${a.pullUps} pull-ups ≈ ${levelName(Math.round(clampLevel(pull)) as Level)} grip` };
  return fromLevel(a, 'grip', 'grip');
}

function resolveBurpees(a: AthleteProfile): Resolved {
  if (a.burpees1Min != null && a.burpees1Min > 0) {
    const l = levelOf(FALLBACK.burpees1MinByLevel[a.sex], a.burpees1Min);
    return { value: levelMult(l), quality: 'converted', source: `${a.burpees1Min} burpees in 1 min ≈ ${levelName(Math.round(clampLevel(l)) as Level)}` };
  }
  return fromLevel(a, 'burpees', 'burpee conditioning');
}

function clampLevel(l: number): number {
  return Math.min(5, Math.max(1, l));
}

// ─────────────────────────────────────────────────────────────────────────────────────

export function resolveAthlete(a: AthleteProfile): ResolvedAthlete {
  const sex: Sex = a.sex;
  const bw = pos(a.bodyweightKg) && a.bodyweightKg > 30 ? a.bodyweightKg : FALLBACK.refBodyweightKg[sex];

  const fiveK = resolveFiveK(a);
  const ski1k = resolveErg('SkiErg', a.skiErg1kSec, a.skiErg500Sec, a.skiErg2kSec, null);
  const row1k = resolveErg('Row', a.row1kSec, a.row500Sec, a.row2kSec, a.row5kSec);
  const ergMult = fromLevel(a, 'erg', 'erg engine');
  const squat = resolveSquat(a, bw);
  const deadlift = resolveDeadlift(a, bw);
  const grip = resolveGrip(a);
  const burpees = resolveBurpees(a);
  const sled = fromLevel(a, 'sled', 'sled technique');
  const lunges = fromLevel(a, 'lunges', 'lunge endurance');
  const wallBalls = fromLevel(a, 'wallBalls', 'wall balls');
  const transitions = fromLevel(a, 'transitions', 'transitions');

  const tests = {
    sledPush: pos(a.sledPushTestSec) ? a.sledPushTestSec : null,
    sledPull: pos(a.sledPullTestSec) ? a.sledPullTestSec : null,
    bbj: pos(a.bbjTestSec) ? a.bbjTestSec : null,
    farmers: pos(a.farmersTestSec) ? a.farmersTestSec : null,
    lunges: pos(a.lungesTestSec) ? a.lungesTestSec : null,
    wallBalls100: pos(a.wallBalls100Sec)
      ? a.wallBalls100Sec
      : pos(a.karenSec)
        ? a.karenSec * FALLBACK.wallBalls100FromKaren
        : null,
  };
  const wbU = pos(a.wallBallsUnbroken) ? a.wallBallsUnbroken : null;

  const best = (...qs: Quality[]): Quality => {
    const order: Quality[] = ['measured', 'converted', 'rated', 'assumed'];
    return qs.reduce((x, y) => (order.indexOf(y) < order.indexOf(x) ? y : x), 'assumed');
  };
  const quality: Record<AbilityId, Quality> = {
    run: fiveK.quality,
    erg: best(ski1k?.quality ?? 'assumed', row1k?.quality ?? 'assumed', ergMult.quality),
    legs: squat.quality,
    hinge: deadlift.quality,
    grip: best(grip.quality, tests.farmers ? 'measured' : 'assumed'),
    burpees: best(burpees.quality, tests.bbj ? 'measured' : 'assumed'),
    sled: best(sled.quality, tests.sledPush || tests.sledPull ? 'measured' : 'assumed'),
    lunges: best(lunges.quality, tests.lunges ? 'measured' : 'assumed'),
    wallBalls: best(wallBalls.quality, a.wallBalls100Sec || wbU ? 'measured' : a.karenSec ? 'converted' : 'assumed'),
    transitions: transitions.quality,
  };

  const t = (sec: number | null, what: string) => (sec ? `${what} test ${fmtT(sec)}` : null);
  const ergSrc = [ski1k?.source, row1k?.source].filter(Boolean).join(' · ');
  const sources: Record<AbilityId, string> = {
    run: fiveK.source,
    erg: ergSrc || ergMult.source,
    legs: squat.source,
    hinge: deadlift.source,
    grip: t(tests.farmers, 'farmers carry') ?? grip.source,
    burpees: t(tests.bbj, '80m BBJ') ?? burpees.source,
    sled: [t(tests.sledPush, 'sled push'), t(tests.sledPull, 'sled pull')].filter(Boolean).join(' · ') || sled.source,
    lunges: t(tests.lunges, 'lunges') ?? lunges.source,
    wallBalls: pos(a.wallBalls100Sec)
      ? `100 wall balls ${fmtT(a.wallBalls100Sec)}`
      : wbU
        ? `${wbU} unbroken wall balls`
        : pos(a.karenSec)
          ? `from Karen ${fmtT(a.karenSec)} ≈ ${fmtT(tests.wallBalls100!)} per 100`
          : wallBalls.source,
    transitions: transitions.source,
  };

  return { sources, bodyweightKg: bw, fiveK, ski1k, row1k, ergMult, squat, deadlift, grip, burpees, sled, lunges, wallBalls, transitions, tests, wallBallsUnbroken: wbU, quality };
}
