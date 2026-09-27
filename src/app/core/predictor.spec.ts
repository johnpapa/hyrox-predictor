import { defaultAthlete, AthleteProfile, emptyLifts } from './athlete';
import { DIVISIONS, findDivision, weightForAthlete } from './divisions';
import { doublesStationTime, loadMultiplier, optimalDoublesShare, predict, predictSolo, suggestDoublesShares } from './predictor';
import { parseTime, formatTime } from './time';

const man = (patch: Partial<AthleteProfile> = {}) =>
  ({ ...defaultAthlete('male'), fiveKSec: 23 * 60, bodyweightKg: 82, experience: 'some', ...patch }) as AthleteProfile;
const woman = (patch: Partial<AthleteProfile> = {}) =>
  ({ ...defaultAthlete('female', 1), fiveKSec: 25 * 60, bodyweightKg: 65, experience: 'some', ...patch }) as AthleteProfile;
const min = (s: number) => s / 60;

describe('time helpers', () => {
  it('parses and formats', () => {
    expect(parseTime('23:30')).toBe(1410);
    expect(parseTime('1:05:00')).toBe(3900);
    expect(parseTime('22')).toBe(1320);
    expect(parseTime('4:75')).toBeNull();
    expect(parseTime('')).toBeNull();
    expect(formatTime(3900, true)).toBe('01:05:00');
    expect(formatTime(95)).toBe('01:35');
  });
});

describe('solo prediction', () => {
  it('lands near the dataset regression for Open Men (22:00 5K ≈ 85 min)', () => {
    const p = predict({ divisionId: 'men-open', athletes: [man({ fiveKSec: 22 * 60 })] });
    expect(min(p.total)).toBeGreaterThan(78);
    expect(min(p.total)).toBeLessThan(90);
    // running is roughly half the race
    expect(p.runTotal / p.total).toBeGreaterThan(0.45);
    expect(p.runTotal / p.total).toBeLessThan(0.56);
  });

  it('is monotonic in 5K time', () => {
    const times = [17, 20, 23, 26, 30].map((m) => predict({ divisionId: 'men-open', athletes: [man({ fiveKSec: m * 60 })] }).total);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
  });

  it('costs a few minutes to race Pro instead of Open', () => {
    const a = man({ fiveKSec: 21 * 60 });
    const open = predict({ divisionId: 'men-open', athletes: [a] }).total;
    const pro = predict({ divisionId: 'men-pro', athletes: [a] }).total;
    expect(min(pro - open)).toBeGreaterThan(2);
    expect(min(pro - open)).toBeLessThan(10);
  });

  it('uses erg benchmarks for SkiErg and Row', () => {
    const div = findDivision('men-open');
    const s = predictSolo(man({ skiErg1kSec: 200, row1kSec: 190 }), div);
    expect(s.stations.skierg).toBeCloseTo(200 * 1.13, 0);
    expect(s.stations.row).toBeCloseTo(190 * 1.13, 0);
  });

  it('stronger athletes push the sled faster', () => {
    const div = findDivision('men-open');
    const weak = predictSolo(man({ lifts: { ...emptyLifts(), backSquat: { kg: 80, reps: 1 } } }), div).stations.sledPush;
    const strong = predictSolo(man({ lifts: { ...emptyLifts(), backSquat: { kg: 180, reps: 1 } } }), div).stations.sledPush;
    expect(strong).toBeLessThan(weak);
  });

  it('more unbroken wall balls means faster wall balls', () => {
    const div = findDivision('women-open');
    const few = predictSolo(woman({ wallBallsUnbroken: 15 }), div).stations.wallBalls;
    const many = predictSolo(woman({ wallBallsUnbroken: 80 }), div).stations.wallBalls;
    expect(many).toBeLessThan(few);
  });

  it('pulls toward a previous result', () => {
    const div = findDivision('men-open');
    const base = predictSolo(man(), div).total;
    const cal = predictSolo(man({ previousHyroxSec: base + 600 }), div).total;
    expect(cal).toBeGreaterThan(base + 300);
    expect(cal).toBeLessThan(base + 600);
  });
});

describe('loads', () => {
  it('mixed doubles: women race men\'s open sleds but throw to 2.70 m', () => {
    const d = findDivision('mixed-doubles');
    expect(weightForAthlete(d, 'female', 'sledPush')).toBe('menOpen');
    expect(weightForAthlete(d, 'female', 'wallBalls')).toBe('womenPro');
    expect(loadMultiplier('female', 'sledPush', 'menOpen')).toBeGreaterThan(1.3);
  });

  it('corporate relay: men on women\'s open loads are faster on the sled', () => {
    expect(loadMultiplier('male', 'sledPush', 'womenOpen')).toBeLessThan(1);
  });
});

describe('doubles', () => {
  it('splitting evenly is faster than one partner doing it all', () => {
    expect(doublesStationTime('wallBalls', 400, 400, 0.5)).toBeLessThan(400);
    expect(optimalDoublesShare('sledPush', 180, 180)).toBeCloseTo(0.5, 1);
  });

  it('gives the stronger partner more of the work', () => {
    expect(optimalDoublesShare('wallBalls', 300, 450)).toBeGreaterThan(0.5);
  });

  it('is faster than the same athletes racing singles', () => {
    const a = man();
    const single = predict({ divisionId: 'men-open', athletes: [a] }).total;
    const doubles = predict({ divisionId: 'men-doubles', athletes: [a, a] }).total;
    expect(doubles / single).toBeGreaterThan(0.75);
    expect(doubles / single).toBeLessThan(0.93);
  });

  it('respects a manual share, but never all or nothing (20–80%)', () => {
    const p = predict({ divisionId: 'men-doubles', athletes: [man(), man()], doublesShares: { row: 0.65, skierg: 1, sledPush: 0 } });
    expect(p.doublesShares!.row).toBe(0.65);
    expect(p.doublesShares!.skierg).toBe(0.8);
    expect(p.doublesShares!.sledPush).toBe(0.2);
  });

  it('REGRESSION: defaults to 50/50 on every station; suggestions stay within 30–70%', () => {
    // The old optimiser could pick 0% or 100% for a station, which no pair does.
    const strong = man({ bodyweightKg: 105, levels: { ...man().levels, legs: 5, hinge: 5, sled: 5 } });
    const weak = man({ fiveKSec: 30 * 60, levels: { ...man().levels, legs: 1, hinge: 1, wallBalls: 1 } });
    const p = predict({ divisionId: 'men-doubles', athletes: [strong, weak] });
    for (const v of Object.values(p.doublesShares!)) expect(v).toBe(0.5);
    const s = suggestDoublesShares({ divisionId: 'men-doubles', athletes: [strong, weak] });
    for (const v of Object.values(s)) {
      expect(v).toBeGreaterThanOrEqual(0.3);
      expect(v).toBeLessThanOrEqual(0.7);
      expect(Math.round(v * 20)).toBeCloseTo(v * 20, 6); // 5% steps
    }
    expect(s.sledPush).toBeGreaterThan(0.5);
  });

  it('REGRESSION: doubles with a strong partner beats your singles time (Roxzone no longer takes the slower partner in full)', () => {
    // A strong partner should make doubles faster than your own singles race.
    const masters = man({ fiveKSec: 21 * 60 + 30, bodyweightKg: 76, age: 53, heightCm: 173, experience: 'first', levels: { ...man().levels, transitions: 4 } });
    const partner = man({ fiveKSec: 24 * 60, heightCm: 198, bodyweightKg: 105, experience: 'first', levels: { ...man().levels, legs: 4, hinge: 4, sled: 4 } });
    const single = predict({ divisionId: 'men-open', athletes: [masters] });
    const dbl = predict({ divisionId: 'men-doubles', athletes: [masters, partner] });
    expect(dbl.total).toBeLessThan(single.total - 60);
    // Roxzone sits between the two partners, not at the slower one's full singles value.
    const [a, b] = dbl.solos.map((x) => x.roxzone);
    expect(dbl.roxzone).toBeLessThan(Math.max(a, b));
    expect(dbl.roxzone).toBeGreaterThan(Math.min(a, b) * 0.9);
  });
});

describe('relay', () => {
  it('picks a valid order and is faster than a solo race', () => {
    const team = [man(), man({ fiveKSec: 20 * 60 }), woman(), woman()];
    const p = predict({ divisionId: 'mixed-relay', athletes: team });
    expect([...p.relayOrder!].sort()).toEqual([0, 1, 2, 3]);
    const solo = predict({ divisionId: 'men-open', athletes: [man()] }).total;
    expect(p.total).toBeLessThan(solo);
  });
});

describe('every division', () => {
  it('produces 16 finite segments', () => {
    for (const d of DIVISIONS) {
      const team = d.defaultSexes.map((s, i) => defaultAthlete(s, i));
      const p = predict({ divisionId: d.id, athletes: team });
      expect(p.segments.length).toBe(16);
      expect(p.segments.every((s) => isFinite(s.sec) && s.sec > 0)).toBe(true);
      expect(p.low).toBeLessThan(p.total);
    }
  });

  it('honours station overrides', () => {
    const p = predict({ divisionId: 'men-open', athletes: [man()], overrides: { wallBalls: 300 } });
    expect(p.segments.find((s) => s.stationId === 'wallBalls')!.sec).toBe(300);
  });
});
