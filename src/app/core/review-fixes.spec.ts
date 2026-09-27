/** Regression tests for issues found in the code & HYROX-data reviews. */
import { AthleteProfile, defaultAthlete, migrateAthlete } from './athlete';
import { findDivision, weightForAthlete } from './divisions';
import { paulsLaw } from './formulas';
import { predict, predictSolo, runShapeFor } from './predictor';
import { resolveAthlete } from './resolve';

const ath = (sex: 'male' | 'female', p: Partial<AthleteProfile> = {}): AthleteProfile => ({
  ...defaultAthlete(sex),
  fiveKSec: sex === 'male' ? 23 * 60 : 25 * 60,
  bodyweightKg: sex === 'male' ? 82 : 65,
  experience: 'some',
  ...p,
});
const elite = (sex: 'male' | 'female'): AthleteProfile =>
  ath(sex, {
    fiveKSec: sex === 'male' ? 15 * 60 : 17 * 60,
    experience: 'competitive',
    runningKmPerWeek: 100, otherTrainingHours: 8,
    levels: { run: null, erg: null, legs: 5, hinge: 5, grip: 5, burpees: 5, sled: 5, lunges: 5, wallBalls: 5, transitions: 5 },
  });
const station = (p: ReturnType<typeof predict>, id: string) => p.segments.find((s) => s.stationId === id)!.sec;

describe('divisions & loads', () => {
  it('Adaptive, mixed relay and corporate relay use each athlete\'s own-sex Open weights', () => {
    for (const id of ['adaptive', 'mixed-relay', 'corporate-relay']) {
      const d = findDivision(id);
      expect(weightForAthlete(d, 'female', 'sledPush')).toBe('womenOpen');
      expect(weightForAthlete(d, 'male', 'wallBalls')).toBe('menOpen');
    }
    const w = ath('female');
    expect(predict({ divisionId: 'adaptive', athletes: [w] }).total).toBeCloseTo(
      predict({ divisionId: 'women-open', athletes: [w] }).total, 5);
  });

  it('Adaptive has no field position', () => {
    expect(predict({ divisionId: 'adaptive', athletes: [ath('male')] }).topPercent).toBeNull();
  });
});

describe('calibration', () => {
  it('calibrates against the athlete\'s own Open division, not the current division', () => {
    const w = ath('female');
    const open = predict({ divisionId: 'women-open', athletes: [w] }).total;
    const cal = predictSolo({ ...w, previousHyroxSec: open }, findDivision('mixed-doubles'));
    expect(cal.calibration).toBeCloseTo(1, 2);
  });
});

describe('input robustness', () => {
  it('absurd erg and run inputs are ignored with a warning, never negative', () => {
    expect(paulsLaw(10, 2000, 1000)).toBeGreaterThan(0);
    const r = resolveAthlete(ath('male', { row2kSec: 10, fiveKSec: 5 }));
    expect(r.row1k).toBeNull();
    expect(r.fiveK.quality).not.toBe('measured');
    expect(r.warnings.erg?.[0]).toContain('ignored');
    expect(r.warnings.run?.[0]).toContain('ignored');
    const p = predict({ divisionId: 'men-open', athletes: [ath('male', { row2kSec: 10, fiveKSec: 5 })] });
    expect(p.segments.every((s) => s.sec > 0 && isFinite(s.sec))).toBe(true);
  });

  it('malformed saved data is sanitised instead of crashing', () => {
    const m = migrateAthlete({ sex: 'M', experience: 'guru', fiveKSec: 'fast', levels: { run: 9 }, lifts: { backSquat: { kg: -5, reps: 99 } } }, 0);
    expect(m.sex).toBe('male');
    expect(m.experience).toBe('unknown');
    expect(m.fiveKSec).toBeNull();
    expect(m.levels.run).toBeNull();
    expect(m.lifts.backSquat).toEqual({ kg: null, reps: 15, rir: 0 });
    expect(isFinite(predict({ divisionId: 'men-open', athletes: [m] }).total)).toBe(true);
  });

  it('REGRESSION: lifts saved before the effort choice existed keep meaning a set to failure', () => {
    const old = migrateAthlete({ sex: 'male', lifts: { deadlift: { kg: 100, reps: 5 } } }, 0);
    expect(old.lifts.deadlift.rir).toBe(0);
    const now = migrateAthlete({ sex: 'male', lifts: { deadlift: { kg: 100, reps: 5, rir: 3.5 } } }, 0);
    expect(now.lifts.deadlift.rir).toBe(3.5);
    const bad = migrateAthlete({ sex: 'male', lifts: { deadlift: { kg: 100, reps: 5, rir: 'x' } } }, 0);
    expect(bad.lifts.deadlift.rir).toBe(1.5);
    // A working set with reps left estimates a bigger deadlift than the same set to failure.
    expect(resolveAthlete(now).deadlift.value).toBeGreaterThan(resolveAthlete(old).deadlift.value);
    expect(resolveAthlete(now).sources.hinge).toContain('100 kg / 220 lb × 5 (3–4 left)');
  });

  it('REGRESSION: out-of-range entries without their own check are ignored, matching the inline message', () => {
    const base = ath('male');
    const t = (p: Partial<typeof base>) => predict({ divisionId: 'men-open', athletes: [{ ...base, ...p }] }).total;
    expect(t({ age: 150 })).toBe(t({ age: null }));
    expect(t({ wallBallsUnbroken: 900 })).toBe(t({ wallBallsUnbroken: null }));
    expect(t({ deadHangSec: 5000 })).toBe(t({ deadHangSec: null }));
    expect(t({ burpees1Min: 200 })).toBe(t({ burpees1Min: null }));
    expect(t({ lifts: { ...base.lifts, deadlift: { kg: 900, reps: 1, rir: 0 } } })).toBe(t({}));
    expect(t({ age: 53 })).not.toBe(t({ age: null }));
  });

  it('a sled self-rating only adjusts technique, not strength', () => {
    const r = resolveAthlete(ath('male', { levels: { ...defaultAthlete('male').levels, sled: 5 } }));
    expect(r.squat.quality).toBe('assumed');
  });

  it('"Solid" strength equals "Not sure"', () => {
    const lv = { ...defaultAthlete('male').levels, legs: 3 as const, hinge: 3 as const };
    const solid = predict({ divisionId: 'men-open', athletes: [ath('male', { levels: lv })] }).total;
    const unsure = predict({ divisionId: 'men-open', athletes: [ath('male')] }).total;
    expect(solid).toBeCloseTo(unsure, 5);
  });

  it('lab VO₂max is trusted more than a watch estimate', () => {
    const watch = resolveAthlete(ath('male', { fiveKSec: null, vo2max: 50 })).fiveK;
    const lab = resolveAthlete(ath('male', { fiveKSec: null, vo2max: 50, vo2maxSource: 'lab' })).fiveK;
    expect(lab.value).toBeLessThan(watch.value);
    expect(lab.quality).toBe('converted');
  });
});

describe('HYROX calibration', () => {
  it('Women\'s Open wall balls reflect 100 reps (not the old 75)', () => {
    const p = predict({ divisionId: 'women-open', athletes: [ath('female')] });
    expect(station(p, 'wallBalls')).toBeGreaterThan(5 * 60);
    const e = predict({ divisionId: 'women-open', athletes: [elite('female')] });
    expect(station(e, 'wallBalls')).toBeGreaterThan(2.9 * 60);
  });

  it('elite predictions stay near (not far below) world records', () => {
    const men = predict({ divisionId: 'men-pro', athletes: [elite('male')] }).total / 60;
    expect(men).toBeGreaterThan(51); // Pro men WR ≈ 51:59
    const women = predict({ divisionId: 'women-pro', athletes: [elite('female')] }).total / 60;
    expect(women).toBeGreaterThan(55);
    const dbl = predict({ divisionId: 'men-doubles', athletes: [elite('male'), elite('male')] });
    expect(dbl.total / 60).toBeGreaterThan(45); // Men's doubles WR ≈ 47:57
    expect(station(dbl, 'sledPush')).toBeGreaterThan(60);
  });

  it('a relay is faster than a doubles team of the same athletes', () => {
    const m = ath('male');
    const relay = predict({ divisionId: 'men-relay', athletes: [m, m, m, m] }).total;
    const doubles = predict({ divisionId: 'men-doubles', athletes: [m, m] }).total;
    expect(relay).toBeLessThan(doubles);
  });

  it('elites pace evenly; mid-pack athletes fade', () => {
    const flat = runShapeFor(1.1);
    const full = runShapeFor(1.2);
    expect(flat[2] / flat[0]).toBeLessThan(1.1);
    expect(full[2] / full[0]).toBeGreaterThan(1.15);
    const e = predict({ divisionId: 'men-pro', athletes: [elite('male')] });
    expect(e.segments[0].sec).toBeGreaterThan(15 * 60 / 5); // Run 1 no faster than 5K pace
  });

  it('doubles contributions add up to the station time', () => {
    const p = predict({ divisionId: 'men-doubles', athletes: [ath('male'), ath('male', { fiveKSec: 21 * 60 })] });
    for (const s of p.segments.filter((x) => x.kind === 'station')) {
      const sum = s.contributions.reduce((a, c) => a + c.sec, 0);
      expect(sum).toBeCloseTo(s.sec, 6);
    }
  });
});
