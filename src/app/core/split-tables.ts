import { Sex, WeightClass } from './divisions';
import { StationId } from './stations';

/**
 * Median HYROX splits (seconds) by finish band, keyed by the average 1 km run split.
 *
 * Source: ~15k Open results scraped from results.hyrox.com (seasons 4–5), grouped into
 * finish-time bands (<60, 60–70, 70–80, 80–90, 90–100, 100–120, 120+ min). Rows marked
 * "extrapolated" extend the table where the sample was too small. `wbUnbroken` is the typical
 * max unbroken wall-ball set for the band (coach benchmarks: ~100 for sub-60, ~40 for 80–90,
 * ~20 for 120+). See RESEARCH.md.
 *
 * Women's Open wall balls went from 75 to 100 reps in 2024/25, after this data was collected,
 * so that column is scaled ×1.34 (≈ 100/75 plus fatigue). The women's sled pull column is
 * reduced 10% to match current HyroxDataLab averages (men and women near-identical).
 */
export interface BandRow {
  run: number;
  roxzone: number;
  wbUnbroken: number;
  stations: Record<StationId, number>;
}

const row = (
  run: number,
  skierg: number, sledPush: number, sledPull: number, burpeeBroadJump: number,
  row: number, farmersCarry: number, sandbagLunges: number, wallBalls: number,
  roxzone: number, wbUnbroken: number,
): BandRow => ({
  run, roxzone, wbUnbroken,
  stations: { skierg, sledPush, sledPull, burpeeBroadJump, row, farmersCarry, sandbagLunges, wallBalls },
});

//            run   ski  push  pull  bbj   row  farm lunge   wb   rox  wbU
export const MEN_OPEN: BandRow[] = [
  row(200, 222, 140, 185, 165, 232,  90, 180, 215, 240, 100), // extrapolated elite
  row(227, 233, 137, 177, 157, 245,  94, 174, 225, 262, 100), // <60
  row(257, 243, 144, 210, 196, 258, 104, 216, 271, 282,  70), // 60–70
  row(288, 253, 160, 242, 244, 270, 116, 251, 317, 342,  52), // 70–80
  row(318, 262, 179, 275, 288, 283, 131, 289, 366, 413,  40), // 80–90
  row(347, 271, 202, 312, 345, 296, 145, 336, 427, 492,  32), // 90–100
  row(386, 281, 227, 356, 407, 311, 162, 394, 502, 581,  25), // 100–120
  row(467, 297, 272, 432, 530, 336, 182, 512, 643, 692,  20), // 120+
];

export const WOMEN_OPEN: BandRow[] = [
  row(215, 248, 115, 171, 160, 255,  92, 150, 200, 240, 100), // extrapolated elite
  row(240, 262, 125, 194, 180, 268, 100, 170, 222, 265, 100), // extrapolated sub-60
  row(267, 275, 135, 221, 220, 283, 110, 195, 233, 294,  75), // 60–70
  row(299, 286, 148, 246, 265, 297, 121, 224, 272, 329,  58), // 70–80
  row(330, 297, 167, 280, 316, 311, 132, 259, 315, 391,  45), // 80–90
  row(363, 309, 187, 319, 368, 324, 142, 297, 360, 451,  35), // 90–100
  row(407, 323, 211, 367, 447, 343, 160, 359, 433, 535,  27), // 100–120
  row(494, 345, 248, 449, 621, 376, 184, 466, 567, 638,  20), // 120+
];

/**
 * Pro-weight multipliers vs Open for the same run pace, derived by comparing Pro and Open
 * medians at matched average run split. Non-loaded stations are left at 1.0 so the same
 * athlete never looks faster on Pro weights.
 */
export const PRO_MULT: Record<Sex, Partial<Record<StationId, number>>> = {
  male: { sledPush: 1.48, sledPull: 1.46, farmersCarry: 1.16, sandbagLunges: 1.13, wallBalls: 1.18 },
  female: { sledPush: 1.6, sledPull: 1.21, farmersCarry: 1.22, sandbagLunges: 1.19, wallBalls: 1.2 },
};

/**
 * World-class floors per station at the athlete's own Open weights (seconds). Individual
 * multipliers can stack at the extremes; no prediction goes below these (scaled up for
 * heavier loads). Based on the fastest splits seen in elite Open/Pro racing.
 */
export const STATION_FLOOR: Record<Sex, Record<StationId, number>> = {
  male: { skierg: 195, sledPush: 100, sledPull: 135, burpeeBroadJump: 135, row: 190, farmersCarry: 65, sandbagLunges: 135, wallBalls: 170 },
  female: { skierg: 220, sledPush: 90, sledPull: 140, burpeeBroadJump: 150, row: 215, farmersCarry: 70, sandbagLunges: 135, wallBalls: 170 },
};

/** Finish-band label for each row of MEN_OPEN / WOMEN_OPEN (same order). */
export const BAND_LABELS = ['Elite', 'Sub-60', '60–70', '70–80', '80–90', '90–100', '100–120', '120+'] as const;

/**
 * Which finish band a single split looks like (median closest to the time), for an athlete
 * racing their own Open weights. Heavier loads are scaled by `loadMult`.
 */
export function bandForSplit(sex: Sex, id: StationId | 'run', sec: number, loadMult = 1): string {
  const table = tableFor(sex);
  let best = 0;
  let bestErr = Infinity;
  table.forEach((row, i) => {
    const ref = (id === 'run' ? row.run : row.stations[id]) * loadMult;
    const err = Math.abs(Math.log(sec / ref));
    if (err < bestErr) {
      bestErr = err;
      best = i;
    }
  });
  return BAND_LABELS[best];
}

/** Which finish band a total of station work looks like (per-station loads applied). */
export function bandForWork(sex: Sex, workSec: number, loadMult: Partial<Record<StationId, number>> = {}): { label: string; index: number } {
  const table = tableFor(sex);
  let best = 0;
  let bestErr = Infinity;
  table.forEach((row, i) => {
    const ref = (Object.keys(row.stations) as StationId[]).reduce((acc, id) => acc + row.stations[id] * (loadMult[id] ?? 1), 0);
    const err = Math.abs(Math.log(workSec / ref));
    if (err < bestErr) {
      bestErr = err;
      best = i;
    }
  });
  return { label: BAND_LABELS[best], index: best };
}

export function bandIndex(label: string): number {
  return (BAND_LABELS as readonly string[]).indexOf(label);
}

export function tableFor(sex: Sex): BandRow[] {
  return sex === 'male' ? MEN_OPEN : WOMEN_OPEN;
}

/** Sex whose Open table best represents a weight class. */
export function weightClassSex(w: WeightClass): Sex {
  return w === 'menOpen' || w === 'menPro' ? 'male' : 'female';
}

export function isPro(w: WeightClass): boolean {
  return w === 'menPro' || w === 'womenPro';
}

/** Linearly interpolate (and linearly extrapolate at the ends) a band row by run split. */
export function interpolateBand(table: BandRow[], runSec: number): BandRow {
  let i = 0;
  while (i < table.length - 2 && runSec > table[i + 1].run) i++;
  const a = table[i];
  const b = table[i + 1];
  // Extrapolate at most half a band beyond the ends to avoid silly values.
  const tRaw = (runSec - a.run) / (b.run - a.run);
  const t = Math.max(-0.5, Math.min(i === table.length - 2 ? 1.5 : 1, tRaw));
  const lerp = (x: number, y: number) => x + (y - x) * t;
  const stations = {} as Record<StationId, number>;
  for (const k of Object.keys(a.stations) as StationId[]) stations[k] = lerp(a.stations[k], b.stations[k]);
  return {
    run: runSec,
    roxzone: lerp(a.roxzone, b.roxzone),
    wbUnbroken: Math.max(10, lerp(a.wbUnbroken, b.wbUnbroken)),
    stations,
  };
}

/**
 * Approximate field distribution per division: median finish (minutes) and log-normal sigma.
 * Singles from the scraped dataset (p10–p90 ≈ 70–112 min for Open Men ⇒ σ ≈ 0.18);
 * doubles medians from HyroxDataLab.
 */
/**
 * Age-group median finish relative to the division median, by HYROX 5-year age group.
 * HyroxDataLab (~700k results): times rise ~1.5–3% per 5-year bracket after 30; at 50–54 men
 * are ~11% and women ~10% slower than their peak group; decline accelerates after 50.
 * The division median sits near the 30–39 groups (most entrants). Estimate; see RESEARCH.md.
 */
export const AGE_GROUP_FACTOR: Record<Sex, Record<string, number>> = {
  male: {
    '16–24': 0.99, '25–29': 0.97, '30–34': 0.97, '35–39': 0.99, '40–44': 1.02, '45–49': 1.05,
    '50–54': 1.09, '55–59': 1.14, '60–64': 1.2, '65–69': 1.28, '70+': 1.38,
  },
  female: {
    '16–24': 0.99, '25–29': 0.97, '30–34': 0.97, '35–39': 0.99, '40–44': 1.02, '45–49': 1.05,
    '50–54': 1.08, '55–59': 1.12, '60–64': 1.18, '65–69': 1.26, '70+': 1.35,
  },
};

/** Adaptive has no single field distribution, so it has no entry (no field position shown). */
export const FIELD: Record<string, { medianMin: number; sigma: number }> = {
  'men-open': { medianMin: 89, sigma: 0.18 },
  'women-open': { medianMin: 97, sigma: 0.18 },
  'men-pro': { medianMin: 82.0, sigma: 0.17 },
  'women-pro': { medianMin: 85.6, sigma: 0.17 },
  'men-elite': { medianMin: 58.5, sigma: 0.05 },
  'women-elite': { medianMin: 64.5, sigma: 0.05 },
  'men-doubles': { medianMin: 79.4, sigma: 0.18 },
  'women-doubles': { medianMin: 88.7, sigma: 0.18 },
  'mixed-doubles': { medianMin: 85.4, sigma: 0.18 },
  'men-pro-doubles': { medianMin: 72, sigma: 0.15 },
  'women-pro-doubles': { medianMin: 80, sigma: 0.15 },
  'men-relay': { medianMin: 68, sigma: 0.15 },
  'women-relay': { medianMin: 76, sigma: 0.15 },
  'mixed-relay': { medianMin: 71, sigma: 0.15 },
  'corporate-relay': { medianMin: 78, sigma: 0.17 },
};
