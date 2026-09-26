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
  row(200, 222, 128, 165, 148, 232,  88, 165, 210, 240, 100), // extrapolated elite
  row(227, 233, 137, 177, 157, 245,  94, 174, 225, 262, 100), // <60
  row(257, 243, 144, 210, 196, 258, 104, 216, 271, 282,  70), // 60–70
  row(288, 253, 160, 242, 244, 270, 116, 251, 317, 342,  52), // 70–80
  row(318, 262, 179, 275, 288, 283, 131, 289, 366, 413,  40), // 80–90
  row(347, 271, 202, 312, 345, 296, 145, 336, 427, 492,  32), // 90–100
  row(386, 281, 227, 356, 407, 311, 162, 394, 502, 581,  25), // 100–120
  row(467, 297, 272, 432, 530, 336, 182, 512, 643, 692,  20), // 120+
];

export const WOMEN_OPEN: BandRow[] = [
  row(215, 248, 115, 190, 160, 255,  92, 150, 130, 240, 100), // extrapolated elite
  row(240, 262, 125, 215, 180, 268, 100, 170, 150, 265, 100), // extrapolated sub-60
  row(267, 275, 135, 246, 220, 283, 110, 195, 174, 294,  75), // 60–70
  row(299, 286, 148, 273, 265, 297, 121, 224, 203, 329,  58), // 70–80
  row(330, 297, 167, 311, 316, 311, 132, 259, 235, 391,  45), // 80–90
  row(363, 309, 187, 354, 368, 324, 142, 297, 269, 451,  35), // 90–100
  row(407, 323, 211, 408, 447, 343, 160, 359, 323, 535,  27), // 100–120
  row(494, 345, 248, 499, 621, 376, 184, 466, 423, 638,  20), // 120+
];

/**
 * Pro-weight multipliers vs Open for the same run pace, derived by comparing Pro and Open
 * medians at matched average run split. Non-loaded stations are left at 1.0 so the same
 * athlete never looks faster on Pro weights.
 */
export const PRO_MULT: Record<Sex, Partial<Record<StationId, number>>> = {
  male: { sledPush: 1.48, sledPull: 1.46, farmersCarry: 1.16, sandbagLunges: 1.13, wallBalls: 1.18 },
  female: { sledPush: 1.6, sledPull: 1.21, farmersCarry: 1.22, sandbagLunges: 1.19, wallBalls: 1.6 },
};

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
export const FIELD: Record<string, { medianMin: number; sigma: number }> = {
  'men-open': { medianMin: 87.6, sigma: 0.18 },
  'women-open': { medianMin: 92.0, sigma: 0.18 },
  'men-pro': { medianMin: 82.0, sigma: 0.17 },
  'women-pro': { medianMin: 85.6, sigma: 0.17 },
  'men-elite': { medianMin: 58.5, sigma: 0.05 },
  'women-elite': { medianMin: 64.5, sigma: 0.05 },
  adaptive: { medianMin: 100, sigma: 0.22 },
  'men-doubles': { medianMin: 79.4, sigma: 0.18 },
  'women-doubles': { medianMin: 88.7, sigma: 0.18 },
  'mixed-doubles': { medianMin: 85.4, sigma: 0.18 },
  'men-pro-doubles': { medianMin: 72, sigma: 0.15 },
  'women-pro-doubles': { medianMin: 80, sigma: 0.15 },
  'men-relay': { medianMin: 76.5, sigma: 0.15 },
  'women-relay': { medianMin: 77, sigma: 0.15 },
  'mixed-relay': { medianMin: 77, sigma: 0.15 },
  'corporate-relay': { medianMin: 82, sigma: 0.17 },
};
