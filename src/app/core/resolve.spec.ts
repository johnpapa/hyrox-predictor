import { AthleteProfile, defaultAthlete, emptyLifts, hyroxAgeGroup, migrateAthlete } from './athlete';
import { oneRepMax, paulsLaw, raceTimeFromVdot, riegel, vdotFromRace } from './formulas';
import { levelAnchors } from './level-anchors';
import { predict } from './predictor';
import { ageFactor, atLevel, levelOf, resolveAthlete } from './resolve';

const man = (p: Partial<AthleteProfile> = {}) =>
  ({ ...defaultAthlete('male'), fiveKSec: 23 * 60, bodyweightKg: 82, experience: 'some', ...p }) as AthleteProfile;
const lifts = (p: Partial<ReturnType<typeof emptyLifts>>) => ({ ...emptyLifts(), ...p });

describe('formulas', () => {
  it('Epley 1RM', () => {
    expect(oneRepMax(100, 1)).toBe(100);
    expect(oneRepMax(100, 5)).toBeCloseTo(116.7, 1);
    expect(oneRepMax(100, 30)).toBeCloseTo(150, 1); // capped at 15 reps to failure
  });
  it('working sets: reps left in reserve count toward the 1RM estimate (user: "I never do my max")', () => {
    // 60 kg × 10 with 1–2 reps left ≈ 11.5 reps to failure.
    expect(oneRepMax(60, 10, 1.5)).toBeCloseTo(60 * (1 + 11.5 / 30), 5);
    expect(oneRepMax(60, 10, 1.5)).toBeGreaterThan(oneRepMax(60, 10, 0));
    // A single is taken as the max whatever the effort; totals are capped at 15.
    expect(oneRepMax(100, 1, 5.5)).toBe(100);
    expect(oneRepMax(100, 12, 5.5)).toBeCloseTo(150, 5);
  });
  it('Riegel', () => expect(riegel(50 * 60, 10000, 5000)).toBeCloseTo(1439, 0));
  it("Paul's law: 2k → 1k is 5 s/500 m faster", () => expect(paulsLaw(480, 2000, 1000)).toBeCloseTo(230, 5));
  it('VDOT round-trips and matches Daniels tables', () => {
    expect(vdotFromRace(5000, 19 * 60 + 57)).toBeCloseTo(50, 0);
    expect(raceTimeFromVdot(40, 5000) / 60).toBeGreaterThan(23.8);
    expect(raceTimeFromVdot(40, 5000) / 60).toBeLessThan(24.8);
  });
});

describe('level tables', () => {
  it('interpolates and inverts', () => {
    const t = [10, 20, 30, 40, 50] as const;
    expect(atLevel(t, 3)).toBe(30);
    expect(atLevel(t, 2.5)).toBe(25);
    expect(levelOf(t, 35)).toBeCloseTo(3.5);
    expect(levelOf([50, 40, 30, 20, 10], 35)).toBeCloseTo(2.5); // descending (times)
  });
});

describe('running fallbacks', () => {
  it('uses race times first (blended), then a self-level, then an assumption', () => {
    expect(resolveAthlete(man()).fiveK.quality).toBe('measured');
    const tenK = resolveAthlete(man({ fiveKSec: null, tenKSec: 50 * 60 })).fiveK;
    expect(tenK.quality).toBe('measured'); // a real race result
    expect(tenK.value / 60).toBeCloseTo(24, 0);
    const rated = resolveAthlete(man({ fiveKSec: null, levels: { ...defaultAthlete('male').levels, run: 4 } })).fiveK;
    expect(rated.quality).toBe('rated');
    expect(resolveAthlete(man({ fiveKSec: null })).fiveK.quality).toBe('assumed');
  });

  it('a self-rated Elite runner is predicted faster than a Weak one', () => {
    const lv = (run: 1 | 5) => predict({ divisionId: 'men-open', athletes: [man({ fiveKSec: null, levels: { ...defaultAthlete('male').levels, run } })] }).total;
    expect(lv(5)).toBeLessThan(lv(1));
  });
});

describe('strength fallbacks', () => {
  it('estimates squat from front squat, deadlift, trap bar, or a level', () => {
    expect(resolveAthlete(man({ lifts: lifts({ frontSquat: { kg: 85, reps: 1 } }) })).squat.value).toBeCloseTo(100, 0);
    expect(resolveAthlete(man({ lifts: lifts({ deadlift: { kg: 150, reps: 1 } }) })).squat.value).toBeCloseTo(120, 0);
    const trap = resolveAthlete(man({ lifts: lifts({ trapBar: { kg: 162, reps: 1 } }) }));
    expect(trap.deadlift.value).toBeCloseTo(150, 0);
    expect(trap.deadlift.quality).toBe('converted');
    const lvl = resolveAthlete(man({ bodyweightKg: 80, levels: { ...defaultAthlete('male').levels, legs: 3 } }));
    expect(lvl.squat.value).toBeCloseTo(100, 0); // Solid = 1.25 × BW
    expect(lvl.squat.quality).toBe('rated');
  });

  it('uses rep sets via estimated 1RM', () => {
    const r = resolveAthlete(man({ lifts: lifts({ backSquat: { kg: 100, reps: 5 } }) }));
    expect(r.squat.value).toBeCloseTo(116.7, 1);
    expect(r.squat.quality).toBe('measured');
  });

  it('leaving strength blank assumes the typical athlete (no change to prediction)', () => {
    const blank = predict({ divisionId: 'men-open', athletes: [man()] }).total;
    const typical = predict({
      divisionId: 'men-open',
      athletes: [man({ lifts: lifts({ backSquat: { kg: 82 * 1.25, reps: 1 }, deadlift: { kg: 82 * 1.5, reps: 1 } }) })],
    }).total;
    expect(Math.abs(blank - typical)).toBeLessThan(5);
  });
});

describe('strength standards (user: "147 kg deadlift is just Solid? That\'s heavy as hell")', () => {
  it('REGRESSION: Solid means a recreational HYROX athlete, not a powerlifter', () => {
    // 73.5 kg man: Solid deadlift ≈ 110 kg (243 lb), squat ≈ 92 kg (203 lb); 147 kg deadlift is Strong+.
    const m = (lv: 'legs' | 'hinge', l: 1 | 2 | 3 | 4 | 5) =>
      resolveAthlete(man({ bodyweightKg: 73.5, levels: { ...defaultAthlete('male').levels, [lv]: l } }));
    expect(m('hinge', 3).deadlift.value).toBeCloseTo(110, 0);
    expect(m('legs', 3).squat.value).toBeCloseTo(92, 0);
    expect(m('hinge', 4).deadlift.value).toBeLessThan(147);
    expect(m('hinge', 5).deadlift.value).toBeGreaterThan(147);
    // Typical ("Not sure") equals Solid, and women's squat stays below their deadlift.
    expect(resolveAthlete(man({ bodyweightKg: 73.5 })).deadlift.value).toBeCloseTo(110, 0);
    const w = resolveAthlete({ ...defaultAthlete('female'), bodyweightKg: 65 });
    expect(w.squat.value).toBeLessThan(w.deadlift.value);
    expect(w.deadlift.value).toBeLessThan(80);
  });
});

describe('grip, burpees & wall balls', () => {
  it('turns dead hang / pull-ups / burpees into levels', () => {
    const strong = resolveAthlete(man({ deadHangSec: 120, pullUps: 15, burpees1Min: 30 }));
    expect(strong.grip.value).toBeLessThan(1);
    expect(strong.burpees.value).toBeLessThan(1);
    const weak = resolveAthlete(man({ deadHangSec: 15, pullUps: 0 }));
    expect(weak.grip.value).toBeGreaterThan(1);
  });

  it('converts Karen to a 100 wall-ball time', () => {
    const r = resolveAthlete(man({ karenSec: 600 }));
    expect(r.tests.wallBalls100).toBeCloseTo(372, 0);
    expect(r.quality.wallBalls).toBe('converted');
  });

  it('station tests override formula estimates', () => {
    const p = predict({ divisionId: 'men-open', athletes: [man({ sledPushTestSec: 120 })] });
    expect(p.segments.find((s) => s.stationId === 'sledPush')!.sec).toBeCloseTo(138, 0);
  });
});

describe('confidence', () => {
  it('narrows as more is measured', () => {
    const few = predict({ divisionId: 'men-open', athletes: [man()] });
    const many = predict({
      divisionId: 'men-open',
      athletes: [man({
        row1kSec: 215, skiErg1kSec: 235, deadHangSec: 70, burpees1Min: 24, wallBallsUnbroken: 40,
        lifts: lifts({ backSquat: { kg: 110, reps: 3 }, deadlift: { kg: 140, reps: 3 } }),
      })],
    });
    const blank = predict({ divisionId: 'men-open', athletes: [man({ fiveKSec: null })] });
    expect(many.high - many.low).toBeLessThan(few.high - few.low);
    expect(blank.high - blank.low).toBeGreaterThan(few.high - few.low);
  });
});

describe('migration & anchors', () => {
  it('upgrades v1 saves', () => {
    const m = migrateAthlete({ sex: 'female', backSquatKg: 80, ratings: { sled: 5, grip: 3 } }, 0);
    expect(m.lifts.backSquat.kg).toBe(80);
    expect(m.levels.sled).toBe(5);
    expect(m.levels.grip).toBeNull();
    expect((m as any).ratings).toBeUndefined();
  });
  it('provides 5 anchors for every ability', () => {
    for (const id of ['run', 'erg', 'legs', 'hinge', 'grip', 'burpees', 'sled', 'lunges', 'wallBalls', 'transitions'] as const) {
      expect(levelAnchors(id, 'female', 65, 'lb').length).toBe(5);
    }
  });
});

describe('age, VO2max, resting HR & unknowns', () => {
  it('maps ages to HYROX age groups', () => {
    expect(hyroxAgeGroup(null)).toBeNull();
    expect(hyroxAgeGroup(22)).toBe('16–24');
    expect(hyroxAgeGroup(37)).toBe('35–39');
    expect(hyroxAgeGroup(74)).toBe('70+');
  });

  it('a blank athlete still gets a finite prediction with a wide range', () => {
    const p = predict({ divisionId: 'women-open', athletes: [defaultAthlete('female')] });
    expect(isFinite(p.total)).toBe(true);
    expect((p.high - p.low) / p.total).toBeGreaterThan(0.25);
  });

  it('uses VO2max when no run time is known (resting HR was removed: too rough to be worth entering)', () => {
    const vo2 = resolveAthlete(man({ fiveKSec: null, vo2max: 50 })).fiveK;
    expect(vo2.value / 60).toBeGreaterThan(20); // VDOT 46 ≈ 21:20
    expect(vo2.value / 60).toBeLessThan(22.5);
    // a race time always wins
    expect(resolveAthlete(man({ vo2max: 70 })).fiveK.quality).toBe('measured');
  });

  it('age only shifts the assumed runner', () => {
    expect(ageFactor(null)).toBe(1);
    expect(ageFactor(30)).toBe(1);
    expect(ageFactor(60)).toBeGreaterThan(1.15);
    const young = resolveAthlete(man({ fiveKSec: null, age: 30 })).fiveK.value;
    const old = resolveAthlete(man({ fiveKSec: null, age: 60 })).fiveK.value;
    expect(old).toBeGreaterThan(young);
    expect(resolveAthlete(man({ age: 60 })).fiveK.value).toBe(23 * 60);
  });

  it('unknown experience widens the range but does not shift the time', () => {
    const some = predict({ divisionId: 'men-open', athletes: [man()] });
    const unk = predict({ divisionId: 'men-open', athletes: [man({ experience: 'unknown' })] });
    expect(unk.total).toBeCloseTo(some.total, 5);
    expect(unk.high - unk.low).toBeGreaterThan(some.high - some.low);
  });
});
