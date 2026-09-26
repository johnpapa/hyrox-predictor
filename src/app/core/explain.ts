import { AthleteProfile, emptyLifts, peerProfile } from './athlete';
import { resolveAthlete } from './resolve';
import { cmFtIn, kgLb } from './units';
import { DivisionInfo } from './divisions';
import { predictSolo, SoloPrediction } from './predictor';
import { STATION_IDS, StationId } from './stations';

/**
 * Explains the "vs. athletes like you" gaps. The comparison athlete already shares your build,
 * age, experience, race times and training volume (see `peerProfile`), so only trainable
 * abilities can create a gap: for each one you entered, reset just that input to "typical" and
 * measure how much each station's gap changes (leave-one-out attribution).
 *
 * `profileEffects` separately shows what your build and background do to your finish time
 * versus an average athlete with your race times. Deterministic and local, like the rest of
 * the model.
 */

export type GapArea = StationId | 'roxzone';

export interface Reason {
  id: string;
  /** e.g. "Lighter bodyweight (73 kg vs typical 82 kg)". */
  label: string;
  /** Seconds this input adds to the gap (+ slower, − faster). */
  sec: number;
}

export interface GapExplanation {
  byArea: Record<GapArea, Reason[]>;
  /** Part of each gap not attributable to a single input (interactions, caps). */
  unexplained: Record<GapArea, number>;
  /** Reasons summed across all stations and the Roxzone, largest first. */
  overall: Reason[];
}

interface Factor {
  id: string;
  applies: (a: AthleteProfile) => boolean;
  label: (a: AthleteProfile, slower: boolean) => string;
  neutral: (a: AthleteProfile) => AthleteProfile;
  /** Limit attribution to these areas (when the neutral profile also touches other things). */
  areas?: GapArea[];
}

const lbText = kgLb;

/** "squat ≈ 95 kg / 209 lb vs ≈ 120 kg / 265 lb for athletes like you" (estimated 1RMs). */
function strengthVsPeer(a: AthleteProfile, lift: 'squat' | 'deadlift'): string {
  const yours = resolveAthlete(a)[lift].value;
  const peer = resolveAthlete(peerProfile(a))[lift].value;
  return `${lift} 1RM ≈ ${lbText(yours)} vs ≈ ${lbText(peer)} for athletes like you`;
}

/** The comparison athlete's estimated 1RM, as a single. */
function peerLift(a: AthleteProfile, lift: 'squat' | 'deadlift') {
  return { kg: resolveAthlete(peerProfile(a))[lift].value, reps: 1, rir: 0 };
}

const REF_BW = { male: 82, female: 65 } as const;
const REF_H = { male: 178, female: 165 } as const;

const FACTORS: Factor[] = [
  {
    id: 'legs',
    applies: (a) => a.levels.legs != null || !!(a.lifts.backSquat.kg || a.lifts.frontSquat.kg || a.lifts.legPress.kg),
    label: (a, slower) => `Leg strength (${slower ? 'below' : 'above'} typical: ${strengthVsPeer(a, 'squat')})`,
    // Set the squat to the comparison athlete's (not just blank: a blank squat would be
    // estimated from your deadlift instead, mixing the two strengths up).
    neutral: (a) => ({
      ...a, levels: { ...a.levels, legs: null },
      lifts: { ...a.lifts, backSquat: peerLift(a, 'squat'), frontSquat: emptyLifts().frontSquat, legPress: emptyLifts().legPress },
    }),
  },
  {
    id: 'hinge',
    applies: (a) =>
      a.levels.hinge != null || !!(a.lifts.deadlift.kg || a.lifts.trapBar.kg || a.lifts.romanianDeadlift.kg || a.lifts.benchPress.kg),
    label: (a, slower) => `Pulling strength (${slower ? 'below' : 'above'} typical: ${strengthVsPeer(a, 'deadlift')})`,
    neutral: (a) => ({
      ...a,
      levels: { ...a.levels, hinge: null },
      lifts: { ...a.lifts, deadlift: peerLift(a, 'deadlift'), trapBar: emptyLifts().trapBar, romanianDeadlift: emptyLifts().romanianDeadlift, benchPress: emptyLifts().benchPress },
    }),
  },
  {
    id: 'wallBalls',
    applies: (a) => a.levels.wallBalls != null || a.wallBallsUnbroken != null || a.wallBallsSetSize != null || a.wallBalls100Sec != null || a.karenSec != null,
    label: (a, slower) =>
      a.wallBallsUnbroken != null
        ? `Wall-ball capacity (${a.wallBallsUnbroken} unbroken, ${slower ? 'below' : 'above'} typical)`
        : a.wallBallsSetSize != null
          ? `Wall-ball capacity (sets of ${a.wallBallsSetSize}, ${slower ? 'below' : 'above'} typical)`
          : `Wall-ball capacity (${slower ? 'below' : 'above'} typical)`,
    neutral: (a) => ({ ...a, levels: { ...a.levels, wallBalls: null }, wallBallsUnbroken: null, wallBallsSetSize: null, wallBalls100Sec: null, karenSec: null }),
  },
  {
    id: 'burpees',
    applies: (a) => a.levels.burpees != null || a.burpees1Min != null || a.bbjTestSec != null,
    label: (_a, slower) => `Burpee conditioning (${slower ? 'below' : 'above'} typical)`,
    neutral: (a) => ({ ...a, levels: { ...a.levels, burpees: null }, burpees1Min: null, bbjTestSec: null }),
  },
  {
    id: 'grip',
    applies: (a) => a.levels.grip != null || a.deadHangSec != null || a.pullUps != null || a.farmersTestSec != null,
    label: (_a, slower) => `Grip (${slower ? 'below' : 'above'} typical)`,
    neutral: (a) => ({ ...a, levels: { ...a.levels, grip: null }, deadHangSec: null, pullUps: null, farmersTestSec: null }),
  },
  {
    id: 'sled',
    applies: (a) => a.levels.sled != null || a.sledPushTestSec != null || a.sledPullTestSec != null,
    label: (_a, slower) => `Sled technique (${slower ? 'below' : 'above'} typical)`,
    neutral: (a) => ({ ...a, levels: { ...a.levels, sled: null }, sledPushTestSec: null, sledPullTestSec: null }),
  },
  {
    id: 'lunges',
    applies: (a) => a.levels.lunges != null || a.lungesTestSec != null,
    label: (_a, slower) => `Lunge endurance (${slower ? 'below' : 'above'} typical)`,
    neutral: (a) => ({ ...a, levels: { ...a.levels, lunges: null }, lungesTestSec: null }),
  },
  {
    id: 'erg',
    applies: (a) =>
      a.levels.erg != null || [a.skiErg1kSec, a.skiErg500Sec, a.skiErg2kSec, a.row1kSec, a.row500Sec, a.row2kSec, a.row5kSec].some((x) => x != null),
    label: (_a, slower) => `Erg fitness (${slower ? 'below' : 'above'} typical)`,
    neutral: (a) => ({
      ...a, levels: { ...a.levels, erg: null },
      skiErg1kSec: null, skiErg500Sec: null, skiErg2kSec: null, row1kSec: null, row500Sec: null, row2kSec: null, row5kSec: null,
    }),
  },
  {
    id: 'transitions',
    applies: (a) => a.levels.transitions != null,
    label: (_a, slower) => `Roxzone transitions (${slower ? 'slower' : 'faster'} than typical)`,
    // The comparison athlete shares your experience, so clearing the rating is enough.
    neutral: (a) => ({ ...a, levels: { ...a.levels, transitions: null } }),
    areas: ['roxzone'],
  },
];

/** Build and background: part of "athletes like you", reported as effects on the finish time. */
const PROFILE_FACTORS: Factor[] = [
  {
    id: 'bodyweight',
    applies: (a) => a.bodyweightKg != null,
    label: (a) =>
      `${a.bodyweightKg! < REF_BW[a.sex] ? 'Lighter' : 'Heavier'} bodyweight ` +
      `(${kgLb(a.bodyweightKg!)} vs typical ${kgLb(REF_BW[a.sex])})`,
    neutral: (a) => ({ ...a, bodyweightKg: null }),
  },
  {
    id: 'bodyFat',
    applies: (a) => a.bodyFatPct != null,
    label: (a) => `Body fat ${a.bodyFatPct}% (lean mass vs typical ${a.sex === 'male' ? 18 : 25}%)`,
    neutral: (a) => ({ ...a, bodyFatPct: null }),
  },
  {
    id: 'height',
    applies: (a) => a.heightCm != null,
    label: (a) => `Height (${cmFtIn(a.heightCm!)} vs typical ${cmFtIn(REF_H[a.sex])})`,
    neutral: (a) => ({ ...a, heightCm: null }),
  },
  {
    id: 'age',
    applies: (a) => a.age != null && a.age > 50,
    label: (a) => `Age ${a.age} (recovery allowance over 50)`,
    neutral: (a) => ({ ...a, age: null }),
  },
  {
    id: 'experience',
    applies: (a) => a.experience !== 'some' && a.experience !== 'unknown',
    label: (a) =>
      ({ first: 'First HYROX (race-craft allowance)', experienced: '3+ races (race-craft)', competitive: 'Competitive race-craft' } as Record<string, string>)[
        a.experience
      ] ?? 'Experience',
    neutral: (a) => ({ ...a, experience: 'some' }),
  },
  {
    id: 'otherTraining',
    applies: (a) => a.otherTrainingHours != null,
    label: (a) => `Other training (${a.otherTrainingHours} h/week vs typical 3 h)`,
    neutral: (a) => ({ ...a, otherTrainingHours: null }),
  },
  {
    id: 'runningVolume',
    applies: (a) => a.runningKmPerWeek != null,
    label: (a) => `Weekly running (${Math.round(a.runningKmPerWeek!)} km / ${Math.round(a.runningKmPerWeek! / 1.609)} mi vs typical 25 km)`,
    neutral: (a) => ({ ...a, runningKmPerWeek: null }),
  },
];

/**
 * What each part of your build and background does to your finish time, versus an average
 * athlete with the same race times (seconds; + slower, − faster). Largest first.
 */
export function profileEffects(a: AthleteProfile, division: DivisionInfo): Reason[] {
  const total = predictSolo(a, division, false).total;
  const out: Reason[] = [];
  for (const f of PROFILE_FACTORS) {
    if (!f.applies(a)) continue;
    const sec = total - predictSolo(f.neutral(a), division, false).total;
    if (Math.abs(sec) >= 1) out.push({ id: f.id, label: f.label(a, sec > 0), sec });
  }
  return out.sort((x, y) => Math.abs(y.sec) - Math.abs(x.sec));
}

function gaps(s: SoloPrediction): Record<GapArea, number> {
  const g = {} as Record<GapArea, number>;
  for (const id of STATION_IDS) g[id] = s.stations[id] - s.typical[id];
  g.roxzone = s.roxzone - s.typicalRoxzone;
  return g;
}

export function explainGaps(a: AthleteProfile, division: DivisionInfo): GapExplanation {
  const base = gaps(predictSolo(a, division));
  const byArea = Object.fromEntries([...STATION_IDS, 'roxzone'].map((k) => [k, [] as Reason[]])) as Record<GapArea, Reason[]>;
  const totals = new Map<string, Reason>();
  for (const f of FACTORS) {
    if (!f.applies(a)) continue;
    const g = gaps(predictSolo(f.neutral(a), division));
    let sum = 0;
    for (const area of Object.keys(base) as GapArea[]) {
      if (f.areas && !f.areas.includes(area)) continue;
      const sec = base[area] - g[area];
      if (Math.abs(sec) >= 1) {
        byArea[area].push({ id: f.id, label: f.label(a, sec > 0), sec });
        sum += sec;
      }
    }
    if (Math.abs(sum) >= 1) totals.set(f.id, { id: f.id, label: f.label(a, sum > 0), sec: sum });
  }
  for (const list of Object.values(byArea)) list.sort((x, y) => Math.abs(y.sec) - Math.abs(x.sec));
  const overall = [...totals.values()].sort((x, y) => Math.abs(y.sec) - Math.abs(x.sec));
  const unexplained = {} as Record<GapArea, number>;
  for (const area of Object.keys(base) as GapArea[]) {
    unexplained[area] = base[area] - byArea[area].reduce((acc, r) => acc + r.sec, 0);
  }
  return { byArea, overall, unexplained };
}
