import { AthleteProfile, Level } from './athlete';
import { atLevel, levelOf, resolveAthlete } from './resolve';
import { PredictInput, Prediction, SoloPrediction, predict } from './predictor';
import { STATIONS, STATION_IDS, StationId } from './stations';
import { formatTime } from './time';
import { weightForAthlete } from './divisions';
import { loadMultiplier } from './predictor';
import { bandForSplit, bandForWork, bandIndex } from './split-tables';
import { FALLBACK } from './fallback-params';
import { Tip, tipsFor } from './tips';
import { GapExplanation, Reason, explainGaps, profileEffects } from './explain';
export type { Tip } from './tips';

/**
 * Deterministic "Insights": where an athlete gains or loses time versus athletes like them
 * (same build, age, experience, race times and training volume; see `peerProfile`), what their
 * build and background do to their time, and which single improvements would save the most
 * time (by re-running the model). No AI, no network — everything comes from the model.
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
  /** Realistic improvements (8–12 weeks) for abilities the athlete told us about. */
  whatIfs: WhatIf[];
  /** Unknown abilities, ranked by how much measuring them could change the prediction. */
  unknowns: UnknownInput[];
  tips: Tip[];
  /** Why each station differs from athletes like you (per trainable input). */
  explanation: GapExplanation;
  /** What your build and background do to your finish time vs. an average athlete with your race times. */
  profile: Reason[];
  /** Whether masters (50+) scaling was applied to the realistic gains. */
  masters: boolean;
  running: { runFactorPct: number; typicalPct: number; note: string; comparison: string | null };
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

type Candidate = { id: string; label: string; detail: string; apply: (x: AthleteProfile) => AthleteProfile };

const G = () => FALLBACK.realisticGains;

/** Masters athletes adapt more slowly (research: roughly 30–50% smaller gains over 50–60). */
function ageScale(age: number | null): number {
  if (age == null) return 1;
  return age >= 60 ? G().masters60 : age >= 50 ? G().masters50 : 1;
}

/** Realistic 5K improvement fraction for an 8–12 week block, by current level. */
export function realisticRunGain(fiveKSec: number, sex: 'male' | 'female', age: number | null): number {
  const lvl = levelOf(FALLBACK.fiveKByLevel[sex], fiveKSec); // 1 (slow) … 5 (fast)
  return atLevel(G().fiveKPctByLevel, lvl) * ageScale(age);
}

/** Realistic strength improvement fraction, by current strength relative to bodyweight standards. */
export function realisticStrengthGain(kg: number, bw: number, perBw: readonly number[]): number {
  // Research: older lifters gain similar percentages, so no age scaling here.
  return atLevel(G().strengthPctByLevel, levelOf(perBw, kg / bw));
}

const kgText = (kg: number) => `${Math.round(kg)} kg (${Math.round(kg * 2.20462)} lb)`;

/**
 * Improvements the athlete could realistically make in 8–12 weeks, only for abilities they
 * actually told us about (measured, estimated from another test, or self-rated). Unknown
 * abilities are handled separately as "worth measuring", never with invented numbers.
 */
function realisticGains(a: AthleteProfile): Candidate[] {
  const r = resolveAthlete(a);
  const q = r.quality;
  const out: Candidate[] = [];
  const known = (id: keyof typeof q) => q[id] !== 'assumed';

  if (known('run')) {
    const pct = realisticRunGain(r.fiveK.value, a.sex, a.age);
    // Quote a race the athlete actually entered (not the blended 5K-equivalent), and improve
    // every entered race by the same fraction.
    const races: [keyof AthleteProfile, string][] = [['fiveKSec', '5K'], ['tenKSec', '10K'], ['halfMarathonSec', 'Half'], ['marathonSec', 'Marathon']];
    const shown = races.find(([k]) => a[k] != null) ?? null;
    const shownSec = shown ? (a[shown[0]] as number) : r.fiveK.value;
    const shownName = shown ? shown[1] : '5K';
    out.push({
      id: 'run',
      label: 'Sharpen your running',
      detail: `${shownName} ${formatTime(shownSec)} → ${formatTime(shownSec * (1 - pct))} (≈${(pct * 100).toFixed(1)}%), realistic in 8–12 weeks at your level${a.age && a.age >= 50 ? ' and age' : ''}`,
      apply: (x) => {
        const y = { ...x };
        const anyRace = races.some(([k]) => x[k] != null);
        for (const [k] of races) if (x[k] != null) (y as any)[k] = (x[k] as number) * (1 - pct);
        if (!anyRace) y.fiveKSec = r.fiveK.value * (1 - pct);
        return y;
      },
    });
  }
  const strength = (id: 'legs' | 'hinge', lift: 'backSquat' | 'deadlift', name: string, perBw: readonly number[], value: number) => {
    if (!known(id)) return;
    const pct = realisticStrengthGain(value, r.bodyweightKg, perBw);
    const measured = q[id] !== 'rated';
    const set = a.lifts[lift];
    if (set.kg && (set.reps ?? 1) > 1) {
      // Entered as a working set: talk in working sets too (same reps and effort, more weight).
      out.push({
        id,
        label: `Build your ${name}`,
        detail: `Working set ${kgText(set.kg)} × ${set.reps} → ${kgText(set.kg * (1 + pct))} × ${set.reps} (+${Math.round(pct * 100)}%)`,
        apply: (x) => ({ ...x, lifts: { ...x.lifts, [lift]: { ...x.lifts[lift], kg: set.kg! * (1 + pct) } } }),
      });
      return;
    }
    out.push({
      id,
      label: `Build your ${name}`,
      detail: measured
        ? `${kgText(value)} → ${kgText(value * (1 + pct))} (+${Math.round(pct * 100)}%)`
        : `About +${Math.round(pct * 100)}% stronger than your self-rating today`,
      apply: (x) => ({ ...x, lifts: { ...x.lifts, [lift]: { kg: value * (1 + pct), reps: 1 } } }),
    });
  };
  strength('legs', 'backSquat', 'squat', FALLBACK.squatPerBw[a.sex], r.squat.value);
  strength('hinge', 'deadlift', 'deadlift', FALLBACK.deadliftPerBw[a.sex], r.deadlift.value);

  if (known('wallBalls') && !r.tests.wallBalls100) {
    if (r.wallBallsUnbroken) {
      const add = Math.max(3, Math.min(G().wallBallsAddMax, Math.round(r.wallBallsUnbroken * G().wallBallsAddPct)));
      out.push({
        id: 'wallBalls', label: 'Grow your unbroken wall balls',
        detail: `${r.wallBallsUnbroken} → ${r.wallBallsUnbroken + add} unbroken`,
        apply: (x) => ({ ...x, wallBallsUnbroken: r.wallBallsUnbroken! + add }),
      });
    } else if (a.levels.wallBalls && a.levels.wallBalls < 5) {
      const l = a.levels.wallBalls;
      out.push({
        id: 'wallBalls', label: 'Wall-ball capacity work', detail: `${LEVELS[l - 1]} → ${LEVELS[l]}`,
        apply: (x) => ({ ...x, levels: { ...x.levels, wallBalls: (l + 1) as Level } }),
      });
    }
  }
  if (known('burpees') && !r.tests.bbj) {
    if (a.burpees1Min) {
      out.push({
        id: 'burpees', label: 'Burpee conditioning', detail: `${a.burpees1Min} → ${a.burpees1Min + G().burpeesAdd} burpees per minute`,
        apply: (x) => ({ ...x, burpees1Min: a.burpees1Min! + G().burpeesAdd }),
      });
    } else if (a.levels.burpees && a.levels.burpees < 5) {
      const l = a.levels.burpees;
      out.push({
        id: 'burpees', label: 'Burpee conditioning', detail: `${LEVELS[l - 1]} → ${LEVELS[l]}`,
        apply: (x) => ({ ...x, levels: { ...x.levels, burpees: (l + 1) as Level } }),
      });
    }
  }
  if (known('grip') && !r.tests.farmers) {
    if (a.deadHangSec) {
      out.push({
        id: 'grip', label: 'Grip endurance', detail: `Dead hang ${a.deadHangSec} s → ${a.deadHangSec + G().deadHangAdd} s`,
        apply: (x) => ({ ...x, deadHangSec: a.deadHangSec! + G().deadHangAdd }),
      });
    } else if (a.levels.grip && a.levels.grip < 5) {
      const l = a.levels.grip;
      out.push({
        id: 'grip', label: 'Grip endurance', detail: `${LEVELS[l - 1]} → ${LEVELS[l]}`,
        apply: (x) => ({ ...x, levels: { ...x.levels, grip: (l + 1) as Level } }),
      });
    }
  }
  if (known('erg') && (r.ski1k || r.row1k)) {
    const pct = G().ergPct * ageScale(a.age);
    out.push({
      id: 'erg', label: 'Erg fitness',
      detail: `${r.row1k ? `Row 1000m ${formatTime(r.row1k.value)} → ${formatTime(r.row1k.value * (1 - pct))}` : `SkiErg 1000m ${formatTime(r.ski1k!.value)} → ${formatTime(r.ski1k!.value * (1 - pct))}`}`,
      apply: (x) => ({
        ...x,
        row1kSec: r.row1k ? r.row1k.value * (1 - pct) : x.row1kSec,
        skiErg1kSec: r.ski1k ? r.ski1k.value * (1 - pct) : x.skiErg1kSec,
      }),
    });
  }
  // Transitions are pure skill: practising them is realistic for everyone.
  const tl = a.levels.transitions ?? 3;
  if (tl < 5) {
    out.push({
      id: 'transitions', label: 'Practise your Roxzone transitions',
      detail: `${LEVELS[tl - 1]} → ${LEVELS[tl]}: know the layout, jog in and out, no pauses`,
      apply: (x) => ({ ...x, levels: { ...x.levels, transitions: (tl + 1) as Level } }),
    });
  }
  return out;
}

export interface UnknownInput {
  id: string;
  /** What to measure, e.g. "Test your deadlift". */
  label: string;
  how: string;
  /** ± seconds the finish could move depending on the answer (Fair vs Strong). */
  swing: number;
}

const UNKNOWN_HOW: Partial<Record<keyof ReturnType<typeof resolveAthlete>['quality'], [string, string]>> = {
  run: ['Run a 5K time trial', 'Or enter a recent 10K, half or marathon.'],
  legs: ['Enter a squat working set', 'No max needed: your usual set (e.g. 3 × 10) and how many reps you had left.'],
  hinge: ['Enter a deadlift working set', 'Your usual set (e.g. 3 × 8), or a trap-bar deadlift; no max test needed.'],
  grip: ['Time a dead hang', 'Or count your max pull-ups.'],
  burpees: ['Count burpees in 1 minute', 'Chest to floor, full stand.'],
  wallBalls: ['Find your max unbroken wall balls', 'With your race ball and target.'],
  erg: ['Do a 1000 m row or SkiErg', 'A hard, even-paced effort.'],
};

/** For each unknown ability: how much could the answer move the prediction? */
function unknownsWorthMeasuring(input: PredictInput, idx: number, base: number): UnknownInput[] {
  const a = input.athletes[idx];
  const q = resolveAthlete(a).quality;
  const out: UnknownInput[] = [];
  for (const id of Object.keys(UNKNOWN_HOW) as (keyof typeof UNKNOWN_HOW)[]) {
    if (q[id] !== 'assumed') continue;
    const at = (l: Level) =>
      predict({ ...input, athletes: input.athletes.map((x, i) => (i === idx ? { ...x, levels: { ...x.levels, [id]: l } } : x)) }).total;
    const swing = (at(2) - at(4)) / 2;
    if (swing < 5) continue;
    const [label, how] = UNKNOWN_HOW[id]!;
    out.push({ id, label, how, swing });
  }
  return out.sort((x, y) => y.swing - x.swing);
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
  const whatIfs: WhatIf[] = realisticGains(a)
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
    comparison: null as string | null,
    note:
      runFactorPct <= 14
        ? 'Your running holds up well between stations.'
        : runFactorPct >= 26
          ? 'Expect your HYROX laps to be much slower than your 5K pace. Practise running on tired legs (compromised running).'
          : 'Your HYROX laps will be about as much slower than 5K pace as most athletes.',
  };

  // Singles: which finish band do your laps vs. your station work look like?
  let comparison: string | null = null;
  if (prediction.division.format === 'single') {
    const loads = Object.fromEntries(
      STATION_IDS.map((id) => [id, loadMultiplier(a.sex, id, weightForAthlete(prediction.division, a.sex, id))]),
    );
    const avgLap = solo.runs.reduce((x, y) => x + y, 0) / solo.runs.length;
    const runBand = bandForSplit(a.sex, 'run', avgLap);
    const work = STATION_IDS.reduce((acc, id) => acc + solo.stations[id], 0);
    const workBand = bandForWork(a.sex, work, loads);
    const diff = workBand.index - bandIndex(runBand);
    comparison =
      `Your laps (${formatTime(avgLap)}/km avg) look like a ${runBand} min finisher's; your station work looks like a ` +
      `${workBand.label} min finisher's. ` +
      (diff > 0
        ? 'Running is your relative strength: the biggest gains are on the stations.'
        : diff < 0
          ? 'Your stations are your relative strength: running fitness is where most time is.'
          : 'Running and stations are well matched.');
  }

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
    ? `${who}Biggest opportunity is ${limiters[0].name} (${formatTime(limiters[0].gap)} slower than athletes like you).`
    : `${who}Well balanced. No station is slower than athletes like you.`;

  running.comparison = comparison;
  if (a.experience === 'first' && !a.levels.transitions) {
    running.note += ' Your Roxzone includes a first-race allowance (+15%); rate your transitions to replace it.';
  }
  const unknowns = unknownsWorthMeasuring(input, idx, prediction.total);
  const tips = tipsFor(limiters.map((l) => l.id), a.experience === 'first' || a.experience === 'unknown');
  const explanation = explainGaps(a, prediction.division);
  const profile = profileEffects(a, prediction.division);
  return {
    athleteIndex: idx, headline, limiters, strengths, whatIfs, unknowns, tips, explanation, profile,
    masters: (a.age ?? 0) >= 50, running, pacing,
  };
}
