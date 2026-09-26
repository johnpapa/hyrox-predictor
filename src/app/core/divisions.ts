import { StationId } from './stations';

export type Format = 'single' | 'doubles' | 'relay';
export type WeightClass = 'womenOpen' | 'menOpen' | 'womenPro' | 'menPro';
export type Sex = 'male' | 'female';

export interface DivisionInfo {
  id: string;
  name: string;
  group: string;
  format: Format;
  /** Number of athletes on the team. */
  teamSize: 1 | 2 | 4;
  /**
   * Weight class each athlete slot uses. Mixed divisions use the weight of the athlete
   * doing the work (see `weightForAthlete`).
   */
  /**
   * `mixedOpen`: mixed doubles rule (Men's Open loads for both, target by sex).
   * `ownSexOpen`: every athlete uses the Open standard for their own sex.
   */
  weights: WeightClass | 'mixedOpen' | 'ownSexOpen';
  /** Default sex of each team slot (used to pre-fill forms). */
  defaultSexes: Sex[];
  note?: string;
}

const DOUBLES_NOTE =
  'Partners run every km together (from 2026/27 they must stay within 10 s of each other) and split station work however they like, one athlete working at a time.';

export const DIVISIONS: readonly DivisionInfo[] = [
  { id: 'men-open', name: "Men's Open", group: 'Singles', format: 'single', teamSize: 1, weights: 'menOpen', defaultSexes: ['male'] },
  { id: 'women-open', name: "Women's Open", group: 'Singles', format: 'single', teamSize: 1, weights: 'womenOpen', defaultSexes: ['female'] },
  { id: 'men-pro', name: "Men's Pro", group: 'Singles', format: 'single', teamSize: 1, weights: 'menPro', defaultSexes: ['male'] },
  { id: 'women-pro', name: "Women's Pro", group: 'Singles', format: 'single', teamSize: 1, weights: 'womenPro', defaultSexes: ['female'] },
  {
    id: 'men-elite', name: "Men's Elite 15", group: 'Singles', format: 'single', teamSize: 1, weights: 'menPro', defaultSexes: ['male'],
    note: 'Invitation-only Elite 15 series. Uses Pro weights.',
  },
  {
    id: 'women-elite', name: "Women's Elite 15", group: 'Singles', format: 'single', teamSize: 1, weights: 'womenPro', defaultSexes: ['female'],
    note: 'Invitation-only Elite 15 series. Uses Pro weights.',
  },
  {
    id: 'adaptive', name: 'Adaptive', group: 'Singles', format: 'single', teamSize: 1, weights: 'ownSexOpen', defaultSexes: ['male'],
    note: 'There are 13 Adaptive categories, each with its own equipment and movement standards. The prediction uses Open standards for your sex as a baseline; tap any station time to set your own. No field position is shown.',
  },
  { id: 'men-doubles', name: "Men's Doubles", group: 'Doubles', format: 'doubles', teamSize: 2, weights: 'menOpen', defaultSexes: ['male', 'male'], note: DOUBLES_NOTE },
  { id: 'women-doubles', name: "Women's Doubles", group: 'Doubles', format: 'doubles', teamSize: 2, weights: 'womenOpen', defaultSexes: ['female', 'female'], note: DOUBLES_NOTE },
  {
    id: 'mixed-doubles', name: 'Mixed Doubles', group: 'Doubles', format: 'doubles', teamSize: 2, weights: 'mixedOpen', defaultSexes: ['male', 'female'],
    note: "Mixed doubles race on Men's Open weights for both partners (incl. the 6 kg wall ball); the wall ball target stays 3.00 m for men and 2.70 m for women. " + DOUBLES_NOTE,
  },
  { id: 'men-pro-doubles', name: "Men's Pro Doubles", group: 'Doubles', format: 'doubles', teamSize: 2, weights: 'menPro', defaultSexes: ['male', 'male'], note: DOUBLES_NOTE },
  { id: 'women-pro-doubles', name: "Women's Pro Doubles", group: 'Doubles', format: 'doubles', teamSize: 2, weights: 'womenPro', defaultSexes: ['female', 'female'], note: DOUBLES_NOTE },
  { id: 'men-relay', name: "Men's Relay", group: 'Relay', format: 'relay', teamSize: 4, weights: 'menOpen', defaultSexes: ['male', 'male', 'male', 'male'] },
  { id: 'women-relay', name: "Women's Relay", group: 'Relay', format: 'relay', teamSize: 4, weights: 'womenOpen', defaultSexes: ['female', 'female', 'female', 'female'] },
  {
    id: 'mixed-relay', name: 'Mixed Relay', group: 'Relay', format: 'relay', teamSize: 4, weights: 'ownSexOpen', defaultSexes: ['male', 'male', 'female', 'female'],
    note: 'Mixed relay teams are 2 men + 2 women. Each athlete races on the Open weights for their sex.',
  },
  {
    id: 'corporate-relay', name: 'Corporate Relay', group: 'Relay', format: 'relay', teamSize: 4, weights: 'ownSexOpen', defaultSexes: ['male', 'female', 'male', 'female'],
    note: 'Corporate relay formats vary by event. Modelled like a relay where each athlete uses the Open weights for their sex; check your event rules.',
  },
];

export function findDivision(id: string): DivisionInfo {
  return DIVISIONS.find((d) => d.id === id) ?? DIVISIONS[0];
}

/** Human-readable load per station per weight class. */
export interface StationStandard {
  load: string;
  /** Resistance in kg (sled incl. sled weight, carry = total of both bells, lunges = bag, WB = ball). */
  kg: number;
}

export const STANDARDS: Record<WeightClass, Record<StationId, StationStandard>> = {
  womenOpen: {
    skierg: { load: '1000m', kg: 0 },
    sledPush: { load: '102 kg', kg: 102 },
    sledPull: { load: '78 kg', kg: 78 },
    burpeeBroadJump: { load: 'Bodyweight', kg: 0 },
    row: { load: '1000m', kg: 0 },
    farmersCarry: { load: '2 × 16 kg', kg: 32 },
    sandbagLunges: { load: '10 kg', kg: 10 },
    wallBalls: { load: '4 kg · 2.70 m', kg: 4 },
  },
  menOpen: {
    skierg: { load: '1000m', kg: 0 },
    sledPush: { load: '152 kg', kg: 152 },
    sledPull: { load: '103 kg', kg: 103 },
    burpeeBroadJump: { load: 'Bodyweight', kg: 0 },
    row: { load: '1000m', kg: 0 },
    farmersCarry: { load: '2 × 24 kg', kg: 48 },
    sandbagLunges: { load: '20 kg', kg: 20 },
    wallBalls: { load: '6 kg · 3.00 m', kg: 6 },
  },
  womenPro: {
    skierg: { load: '1000m', kg: 0 },
    sledPush: { load: '152 kg', kg: 152 },
    sledPull: { load: '103 kg', kg: 103 },
    burpeeBroadJump: { load: 'Bodyweight', kg: 0 },
    row: { load: '1000m', kg: 0 },
    farmersCarry: { load: '2 × 24 kg', kg: 48 },
    sandbagLunges: { load: '20 kg', kg: 20 },
    wallBalls: { load: '6 kg · 2.70 m', kg: 6 },
  },
  menPro: {
    skierg: { load: '1000m', kg: 0 },
    sledPush: { load: '202 kg', kg: 202 },
    sledPull: { load: '153 kg', kg: 153 },
    burpeeBroadJump: { load: 'Bodyweight', kg: 0 },
    row: { load: '1000m', kg: 0 },
    farmersCarry: { load: '2 × 32 kg', kg: 64 },
    sandbagLunges: { load: '30 kg', kg: 30 },
    wallBalls: { load: '9 kg · 3.00 m', kg: 9 },
  },
};

/**
 * Weight class an athlete races a given station on.
 * - Mixed doubles: both partners use Men's Open loads, but a woman throws the 6 kg ball to
 *   the 2.70 m target — which is exactly the Women's Pro wall ball standard.
 * - Mixed relay, corporate relay, adaptive: each athlete uses the Open standard for their own sex.
 */
export function weightForAthlete(division: DivisionInfo, sex: Sex, station: StationId): WeightClass {
  const w = division.weights;
  if (w === 'ownSexOpen') return sex === 'male' ? 'menOpen' : 'womenOpen';
  if (w !== 'mixedOpen') return w;
  if (station === 'wallBalls' && sex === 'female') return 'womenPro';
  return 'menOpen';
}

/** Divisions whose team composition is chosen by the athletes rather than fixed by the rules. */
export function sexIsChoosable(division: DivisionInfo): boolean {
  return division.id === 'adaptive' || division.id === 'corporate-relay';
}

/** The athlete's own singles Open division (used to calibrate a previous result). */
export function nativeOpenDivision(sex: Sex): DivisionInfo {
  return findDivision(sex === 'male' ? 'men-open' : 'women-open');
}
