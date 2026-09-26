import { AthleteProfile, emptyLifts } from './athlete';
import { DivisionInfo } from './divisions';
import { predictSolo, SoloPrediction } from './predictor';
import { STATION_IDS, StationId } from './stations';

/**
 * Explains the "vs. athletes who run like you" gaps: for each input that differs from the
 * typical athlete, reset just that input to "typical" and measure how much each station's gap
 * changes (leave-one-out attribution). Deterministic and local, like the rest of the model.
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

const REF_BW = { male: 82, female: 65 } as const;
const REF_H = { male: 178, female: 165 } as const;

const FACTORS: Factor[] = [
  {
    id: 'bodyweight',
    applies: (a) => a.bodyweightKg != null,
    label: (a) =>
      `${a.bodyweightKg! < REF_BW[a.sex] ? 'Lighter' : 'Heavier'} bodyweight ` +
      `(${Math.round(a.bodyweightKg!)} kg / ${Math.round(a.bodyweightKg! * 2.20462)} lb vs typical ${REF_BW[a.sex]} kg)`,
    neutral: (a) => ({ ...a, bodyweightKg: null }),
  },
  {
    id: 'height',
    applies: (a) => a.heightCm != null,
    label: (a) => `Height (${Math.round(a.heightCm!)} cm vs typical ${REF_H[a.sex]} cm)`,
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
    id: 'legs',
    applies: (a) => a.levels.legs != null || !!(a.lifts.backSquat.kg || a.lifts.frontSquat.kg || a.lifts.legPress.kg),
    label: (_a, slower) => `Leg strength (${slower ? 'below' : 'above'} typical)`,
    neutral: (a) => ({ ...a, levels: { ...a.levels, legs: null }, lifts: { ...a.lifts, backSquat: emptyLifts().backSquat, frontSquat: emptyLifts().frontSquat, legPress: emptyLifts().legPress } }),
  },
  {
    id: 'hinge',
    applies: (a) =>
      a.levels.hinge != null || !!(a.lifts.deadlift.kg || a.lifts.trapBar.kg || a.lifts.romanianDeadlift.kg || a.lifts.benchPress.kg),
    label: (_a, slower) => `Pulling strength (${slower ? 'below' : 'above'} typical)`,
    neutral: (a) => ({
      ...a,
      levels: { ...a.levels, hinge: null },
      lifts: { ...a.lifts, deadlift: emptyLifts().deadlift, trapBar: emptyLifts().trapBar, romanianDeadlift: emptyLifts().romanianDeadlift, benchPress: emptyLifts().benchPress },
    }),
  },
  {
    id: 'wallBalls',
    applies: (a) => a.levels.wallBalls != null || a.wallBallsUnbroken != null || a.wallBalls100Sec != null || a.karenSec != null,
    label: (a, slower) =>
      a.wallBallsUnbroken != null ? `Wall-ball capacity (${a.wallBallsUnbroken} unbroken, ${slower ? 'below' : 'above'} typical)` : `Wall-ball capacity (${slower ? 'below' : 'above'} typical)`,
    neutral: (a) => ({ ...a, levels: { ...a.levels, wallBalls: null }, wallBallsUnbroken: null, wallBalls100Sec: null, karenSec: null }),
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
    // A transitions rating replaces the experience allowance, so "typical" means neither.
    neutral: (a) => ({ ...a, experience: 'some', levels: { ...a.levels, transitions: null } }),
    areas: ['roxzone'],
  },
  {
    id: 'otherTraining',
    applies: (a) => a.otherTrainingHours != null,
    label: (a) => `Other training (${a.otherTrainingHours} h/week vs typical 3 h)`,
    neutral: (a) => ({ ...a, otherTrainingHours: null }),
  },
];

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
