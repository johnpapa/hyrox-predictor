import { AthleteProfile, Level } from './athlete';
import { atLevel, resolveAthlete } from './resolve';
import { PredictInput, Prediction, SoloPrediction, predict } from './predictor';
import { STATIONS, STATION_IDS, StationId } from './stations';
import { formatTime } from './time';
import { FALLBACK } from './fallback-params';

/**
 * Deterministic "Insights": where an athlete gains or loses time versus athletes who run at
 * the same pace, and which single improvements would save the most time (by re-running the
 * model). No AI, no network — everything is computed from the prediction model.
 */

export interface StationGap {
  id: StationId | 'roxzone';
  name: string;
  yours: number;
  typical: number;
  /** Positive = slower than typical. */
  gap: number;
}

export interface WhatIf {
  id: string;
  /** What changes, e.g. "Run a 5K 1:00 faster". */
  label: string;
  /** How, in one line, e.g. "22:00 instead of 23:00". */
  detail: string;
  /** Seconds saved on the team/overall finish time. */
  saves: number;
}

export interface Insights {
  athleteIndex: number;
  headline: string;
  limiters: StationGap[];
  strengths: StationGap[];
  whatIfs: WhatIf[];
  running: { runFactorPct: number; typicalPct: number; note: string };
  pacing: string[];
}

const LEVELS: readonly string[] = FALLBACK.levelNames;
const NAMES: Record<StationId, string> = Object.fromEntries(STATIONS.map((s) => [s.id, s.name])) as Record<StationId, string>;

export function stationGaps(solo: SoloPrediction): StationGap[] {
  const gaps: StationGap[] = STATION_IDS.map((id) => ({
    id,
    name: NAMES[id],
    yours: solo.stations[id],
    typical: solo.typical[id],
    gap: solo.stations[id] - solo.typical[id],
  }));
  gaps.push({ id: 'roxzone', name: 'Roxzone', yours: solo.roxzone, typical: solo.typicalRoxzone, gap: solo.roxzone - solo.typicalRoxzone });
  return gaps;
}

/** Candidate single improvements for one athlete; each returns a modified profile. */
function improvements(a: AthleteProfile, solo: SoloPrediction): { id: string; label: string; detail: string; apply: (x: AthleteProfile) => AthleteProfile }[] {
  const r = resolveAthlete(a);
  const out: { id: string; label: string; detail: string; apply: (x: AthleteProfile) => AthleteProfile }[] = [];
  const fiveK = r.fiveK.value;
  out.push({
    id: 'run',
    label: 'Run a 5K 1:00 faster',
    detail: `${formatTime(fiveK - 60)} instead of ${formatTime(fiveK)}`,
    apply: (x) => ({ ...x, fiveKSec: fiveK - 60, tenKSec: null, mileSec: null, halfMarathonSec: null }),
  });
  const squat = r.squat.value;
  out.push({
    id: 'legs',
    label: 'Squat 10% more',
    detail: `≈ ${Math.round(squat * 1.1)} kg instead of ${Math.round(squat)} kg`,
    apply: (x) => ({ ...x, lifts: { ...x.lifts, backSquat: { kg: squat * 1.1, reps: 1 } } }),
  });
  const dl = r.deadlift.value;
  out.push({
    id: 'hinge',
    label: 'Deadlift 10% more',
    detail: `≈ ${Math.round(dl * 1.1)} kg instead of ${Math.round(dl)} kg`,
    apply: (x) => ({ ...x, lifts: { ...x.lifts, deadlift: { kg: dl * 1.1, reps: 1 } } }),
  });
  const wbU = r.wallBallsUnbroken ?? Math.round(solo.typicalWallBallsUnbroken);
  if (!r.tests.wallBalls100) {
    out.push({
      id: 'wallBalls',
      label: '+15 unbroken wall balls',
      detail: `${wbU + 15} instead of ${wbU}`,
      apply: (x) => ({ ...x, wallBallsUnbroken: wbU + 15 }),
    });
  }
  const burpees = a.burpees1Min ?? Math.round(atLevel(FALLBACK.burpees1MinByLevel[a.sex], a.levels.burpees ?? 3));
  if (!r.tests.bbj) {
    out.push({
      id: 'burpees',
      label: '+5 burpees per minute',
      detail: `${burpees + 5}/min instead of ${burpees}/min`,
      apply: (x) => ({ ...x, burpees1Min: burpees + 5 }),
    });
  }
  const hang = a.deadHangSec ?? Math.round(atLevel(FALLBACK.deadHangByLevel[a.sex], a.levels.grip ?? 3));
  if (!r.tests.farmers) {
    out.push({
      id: 'grip',
      label: 'Dead hang 30 s longer',
      detail: `${hang + 30} s instead of ${hang} s`,
      apply: (x) => ({ ...x, deadHangSec: hang + 30 }),
    });
  }
  const rowFresh = r.row1k?.value ?? solo.stations.row / 1.13;
  out.push({
    id: 'erg',
    label: 'Row & ski 10 s faster per 1000 m',
    detail: `Row 1000m ${formatTime(rowFresh - 10)} instead of ${formatTime(rowFresh)}`,
    apply: (x) => ({
      ...x,
      row1kSec: rowFresh - 10,
      skiErg1kSec: (r.ski1k?.value ?? solo.stations.skierg / 1.13) - 10,
    }),
  });
  const tl = a.levels.transitions ?? 3;
  if (tl < 5) {
    out.push({
      id: 'transitions',
      label: 'Sharper Roxzone transitions',
      detail: `One level better (${LEVELS[tl]} instead of ${LEVELS[tl - 1]})`,
      apply: (x) => ({ ...x, levels: { ...x.levels, transitions: (tl + 1) as Level } }),
    });
  }
  return out;
}

export function computeInsights(input: PredictInput, prediction: Prediction, athleteIndex = 0): Insights {
  const idx = Math.min(athleteIndex, prediction.solos.length - 1);
  const solo = prediction.solos[idx];
  const a = input.athletes[idx];
  const gaps = stationGaps(solo);
  const sorted = [...gaps].sort((x, y) => y.gap - x.gap);
  const limiters = sorted.filter((g) => g.gap > 5).slice(0, 3);
  const strengths = sorted.filter((g) => g.gap < -5).reverse().slice(0, 3);

  // What-ifs: re-run the whole prediction (so doubles/relay tactics re-optimise too).
  const whatIfs: WhatIf[] = improvements(a, solo)
    .map((imp) => {
      const athletes = input.athletes.map((x, i) => (i === idx ? imp.apply(x) : x));
      const total = predict({ ...input, athletes }).total;
      return { id: imp.id, label: imp.label, detail: imp.detail, saves: prediction.total - total };
    })
    .filter((w) => w.saves >= 1)
    .sort((x, y) => y.saves - x.saves)
    .slice(0, 5);

  const runFactorPct = Math.round((solo.runFactor - 1) * 100);
  const typicalPct = 20;
  const running = {
    runFactorPct,
    typicalPct,
    note:
      runFactorPct <= 14
        ? 'Your running holds up well between stations.'
        : runFactorPct >= 26
          ? 'Expect your HYROX laps to be much slower than your 5K pace. Practise running on tired legs (compromised running).'
          : 'Your HYROX laps will be about as much slower than 5K pace as most athletes.',
  };

  const runs = prediction.segments.filter((s) => s.kind === 'run').map((s) => s.sec);
  const avg = runs.reduce((x, y) => x + y, 0) / runs.length;
  const pacing = [
    `Run 1: hold back to about ${formatTime(runs[0])} per km, no faster than ${formatTime(avg * 0.93)}. Going out hard costs more later.`,
    `Aim for ${formatTime(avg)} per km on average; expect Run 3 (after the sled push) and Run 8 to be your slowest.`,
    limiters[0]
      ? `Your biggest station risk is ${limiters[0].name}: plan your sets/breaks before race day.`
      : 'No station stands out as a weakness. Keep your pacing even.',
  ];

  const name = a.name?.trim() || `Athlete ${idx + 1}`;
  const who = prediction.solos.length > 1 ? `${name}: ` : '';
  const headline = limiters[0]
    ? `${who}Biggest opportunity is ${limiters[0].name} (${formatTime(limiters[0].gap)} slower than athletes who run like you).`
    : `${who}Well balanced. No station is slower than athletes who run like you.`;

  return { athleteIndex: idx, headline, limiters, strengths, whatIfs, running, pacing };
}
