/**
 * Realism tests: specific athlete profiles must produce believable HYROX splits.
 *
 * Reference points (see RESEARCH.md): median split tables from results.hyrox.com,
 * HyroxDataLab station averages, and world records (Pro men 51:59, men's doubles 47:57,
 * men's relay 45:43). Bounds are deliberately a little wider than the data so the tests
 * catch unrealistic behaviour without pinning exact numbers.
 */
import { AthleteProfile, Level, defaultAthlete, emptyLevels, emptyLifts } from './athlete';
import { DIVISIONS, weightForAthlete } from './divisions';
import { Prediction, loadMultiplier, predict } from './predictor';
import { STATION_IDS, StationId } from './stations';

const min = (m: number, s = 0) => m * 60 + s;
type Levels = Partial<Record<keyof ReturnType<typeof emptyLevels>, Level>>;

function athlete(sex: 'male' | 'female', p: Partial<AthleteProfile> & { lv?: Levels } = {}): AthleteProfile {
  const { lv, ...rest } = p;
  return {
    ...defaultAthlete(sex),
    bodyweightKg: sex === 'male' ? 82 : 65,
    experience: 'some',
    trainingHours: 6,
    ...rest,
    levels: { ...emptyLevels(), ...(lv ?? {}) },
  };
}

const all = (l: Level): Levels => ({ legs: l, hinge: l, grip: l, burpees: l, sled: l, lunges: l, wallBalls: l, transitions: l });

function run(divisionId: string, ...athletes: AthleteProfile[]): Prediction {
  return predict({ divisionId, athletes });
}
const runs = (p: Prediction) => p.segments.filter((s) => s.kind === 'run').map((s) => s.sec);
const st = (p: Prediction, id: StationId) => p.segments.find((s) => s.stationId === id)!.sec;
const within = (x: number, lo: number, hi: number) => {
  expect(x).toBeGreaterThanOrEqual(lo);
  expect(x).toBeLessThanOrEqual(hi);
};

// ─────────────────────────────────────────────────────────────────────────────────────
describe('realistic personas', () => {
  it('elite engine (VO₂max 70 lab, 15:30 5K): every lap 3:05–4:30, never a 10-minute lap', () => {
    const a = athlete('male', { fiveKSec: min(15, 30), vo2max: 70, vo2maxSource: 'lab', experience: 'competitive', trainingHours: 14 });
    const p = run('men-open', a);
    for (const r of runs(p)) within(r, min(3, 5), min(4, 30));
    within(p.runTotal, min(27), min(34));
    within(p.total, min(52), min(66));
  });

  it('VO₂max alone (no race time) still gives fast runs for a high VO₂max', () => {
    const p = run('men-open', athlete('male', { vo2max: 68, vo2maxSource: 'lab' }));
    for (const r of runs(p)) expect(r).toBeLessThan(min(5));
  });

  it('great runner with no strength: fast laps but slow sleds and lunges', () => {
    const weakRunner = athlete('male', { fiveKSec: min(18), bodyweightKg: 62, lv: { legs: 1, hinge: 1, sled: 1, grip: 1, lunges: 1 } });
    const strongRunner = athlete('male', { fiveKSec: min(18), bodyweightKg: 85, lv: { legs: 4, hinge: 4, sled: 4, grip: 4, lunges: 4 } });
    const w = run('men-open', weakRunner);
    const s = run('men-open', strongRunner);
    for (const r of runs(w)) expect(r).toBeLessThan(min(5));
    expect(st(w, 'sledPush')).toBeGreaterThan(st(s, 'sledPush') * 1.4);
    expect(st(w, 'sledPull')).toBeGreaterThan(st(s, 'sledPull') * 1.3);
    expect(st(w, 'sandbagLunges')).toBeGreaterThan(st(s, 'sandbagLunges') * 1.2);
    // no strength should not "do well" on the sleds: slower than a typical sub-75 athlete
    expect(st(w, 'sledPush')).toBeGreaterThan(min(3));
    expect(st(w, 'sledPull')).toBeGreaterThan(min(4, 30));
  });

  it('strong lifter who runs poorly: slow laps, fast sleds', () => {
    const lifter = athlete('male', {
      fiveKSec: min(30), bodyweightKg: 100,
      lifts: { ...emptyLifts(), backSquat: { kg: 200, reps: 1 }, deadlift: { kg: 250, reps: 1 } },
      lv: { sled: 5, grip: 5 },
    });
    const p = run('men-open', lifter);
    for (const r of runs(p)) within(r, min(6), min(9, 30));
    const weakPeer = run('men-open', athlete('male', { fiveKSec: min(30), lv: { legs: 1, hinge: 1 } }));
    expect(st(p, 'sledPush')).toBeLessThan(st(weakPeer, 'sledPush') * 0.6);
    expect(st(p, 'sledPush')).toBeLessThan(min(3, 30));
    expect(st(p, 'sledPull')).toBeLessThan(min(5));
  });

  it('first-timer beginner (35:00 5K, weak everywhere) lands in the 2–3 hour band', () => {
    const p = run('men-open', athlete('male', { fiveKSec: min(35), experience: 'first', trainingHours: 2, lv: all(1) }));
    within(p.total, min(120), min(185));
    for (const r of runs(p)) within(r, min(6, 30), min(11));
    within(st(p, 'wallBalls'), min(8), min(16));
    within(st(p, 'burpeeBroadJump'), min(7), min(14));
    within(p.roxzone, min(9), min(18));
  });

  it('typical Open man (23:00 5K) looks like a mid-pack finisher', () => {
    const p = run('men-open', athlete('male', { fiveKSec: min(23) }));
    within(p.total, min(80), min(98));
    within(p.avgRun, min(5), min(6));
    within(st(p, 'skierg'), min(4), min(5, 15));
    within(st(p, 'sledPush'), min(2, 30), min(4, 30));
    within(st(p, 'sledPull'), min(4), min(6, 30));
    within(st(p, 'burpeeBroadJump'), min(4), min(6, 30));
    within(st(p, 'row'), min(4, 15), min(5, 30));
    within(st(p, 'farmersCarry'), min(1, 45), min(3));
    within(st(p, 'sandbagLunges'), min(4), min(6, 30));
    within(st(p, 'wallBalls'), min(5), min(8, 30));
    within(p.roxzone, min(5, 30), min(10));
    expect(p.topPercent!).toBeGreaterThan(30);
    expect(p.topPercent!).toBeLessThan(70);
  });

  it('typical Open woman (26:00 5K) looks like a mid-pack finisher', () => {
    const p = run('women-open', athlete('female', { fiveKSec: min(26) }));
    within(p.total, min(88), min(110));
    within(st(p, 'skierg'), min(4, 40), min(5, 50));
    within(st(p, 'sledPush'), min(2, 20), min(4, 15));
    within(st(p, 'wallBalls'), min(5), min(8, 30)); // 100 reps since 2024/25
    within(st(p, 'row'), min(5), min(6, 15));
  });

  it('elite athletes stay just above world records, never below', () => {
    const man = athlete('male', { fiveKSec: min(15), bodyweightKg: 85, experience: 'competitive', trainingHours: 15, lv: all(5) });
    const woman = athlete('female', { fiveKSec: min(17), bodyweightKg: 63, experience: 'competitive', trainingHours: 15, lv: all(5) });
    within(run('men-pro', man).total, min(51, 59), min(60));
    within(run('women-pro', woman).total, min(55), min(66));
    within(run('men-doubles', man, man).total, min(46), min(55));
    within(run('men-relay', man, man, man, man).total, min(42), min(52));
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────
describe('station-specific benchmarks drive the right stations', () => {
  it('a strong rower and skier gets fast erg splits', () => {
    const p = run('men-open', athlete('male', { fiveKSec: min(23), row2kSec: min(6, 30), skiErg1kSec: min(3, 30) }));
    within(st(p, 'row'), min(3, 20), min(3, 50));
    within(st(p, 'skierg'), min(3, 45), min(4, 10));
    const untrained = run('men-open', athlete('male', { fiveKSec: min(23), row2kSec: min(8, 30) }));
    expect(st(untrained, 'row')).toBeGreaterThan(st(p, 'row') + 40);
  });

  it('wall balls: 100 unbroken is fast, 15 unbroken is slow', () => {
    const pro = run('men-open', athlete('male', { fiveKSec: min(21), wallBallsUnbroken: 100 }));
    const weak = run('men-open', athlete('male', { fiveKSec: min(21), wallBallsUnbroken: 15 }));
    within(st(pro, 'wallBalls'), min(3, 15), min(5, 30));
    within(st(weak, 'wallBalls'), min(6), min(12));
  });

  it('grip: a long dead hang helps the carry; a weak grip hurts it', () => {
    const strong = run('men-open', athlete('male', { fiveKSec: min(23), deadHangSec: 150, pullUps: 18 }));
    const weak = run('men-open', athlete('male', { fiveKSec: min(23), deadHangSec: 15, pullUps: 0 }));
    expect(st(weak, 'farmersCarry')).toBeGreaterThan(st(strong, 'farmersCarry') * 1.15);
    expect(st(weak, 'sledPull')).toBeGreaterThan(st(strong, 'sledPull'));
    // grip doesn't change the runs or ergs
    expect(run('men-open', athlete('male', { fiveKSec: min(23), deadHangSec: 150 })).runTotal).toBeCloseTo(weak.runTotal, 5);
  });

  it('burpees per minute drive burpee broad jumps only', () => {
    const fast = run('men-open', athlete('male', { fiveKSec: min(23), burpees1Min: 34 }));
    const slow = run('men-open', athlete('male', { fiveKSec: min(23), burpees1Min: 14 }));
    expect(st(slow, 'burpeeBroadJump')).toBeGreaterThan(st(fast, 'burpeeBroadJump') * 1.2);
    expect(st(slow, 'skierg')).toBeCloseTo(st(fast, 'skierg'), 5);
  });

  it('Pro weights slow the loaded stations, not the runs or ergs', () => {
    const a = athlete('male', { fiveKSec: min(21) });
    const open = run('men-open', a);
    const pro = run('men-pro', a);
    for (const id of ['sledPush', 'sledPull'] as const) within(st(pro, id) / st(open, id), 1.3, 1.7);
    for (const id of ['farmersCarry', 'sandbagLunges', 'wallBalls'] as const) within(st(pro, id) / st(open, id), 1.05, 1.3);
    within(pro.runTotal / open.runTotal, 1.0, 1.04);
    expect(st(pro, 'skierg')).toBeCloseTo(st(open, 'skierg'), 5);
    within(pro.total - open.total, min(3), min(10));
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────
describe('team formats', () => {
  it('doubles: runs follow the slower partner; stations are faster than either solo', () => {
    const fast = athlete('male', { fiveKSec: min(19) });
    const slow = athlete('male', { fiveKSec: min(26) });
    const d = run('men-doubles', fast, slow);
    const soloSlow = run('men-open', slow);
    const soloFast = run('men-open', fast);
    expect(d.runTotal).toBeGreaterThan(soloFast.runTotal);
    expect(d.runTotal).toBeLessThan(soloSlow.runTotal * 1.02);
    for (const id of STATION_IDS) expect(st(d, id)).toBeLessThan(Math.max(st(soloFast, id), st(soloSlow, id)));
    expect(d.total).toBeLessThan(soloSlow.total);
  });

  it('mixed doubles: the stronger partner takes more of the heavy sleds', () => {
    const man = athlete('male', { fiveKSec: min(22), lv: { legs: 4, hinge: 4 } });
    const woman = athlete('female', { fiveKSec: min(24) });
    const d = run('mixed-doubles', man, woman);
    expect(d.doublesShares!.sledPush).toBeGreaterThan(0.5);
    expect(d.doublesShares!.sledPull).toBeGreaterThan(0.5);
  });

  it('relay: each leg run is quicker than the same athlete\'s solo average', () => {
    const a = athlete('male', { fiveKSec: min(22) });
    const relay = run('men-relay', a, a, a, a);
    const solo = run('men-open', a);
    expect(relay.avgRun).toBeLessThan(solo.avgRun);
    expect(relay.total).toBeLessThan(solo.total * 0.9);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────
describe('monotonic cause and effect', () => {
  it('faster 5K ⇒ faster every run, for men and women', () => {
    for (const [sex, div] of [['male', 'men-open'], ['female', 'women-open']] as const) {
      let prev: number[] | null = null;
      for (const m of [16, 18, 20, 22, 25, 28, 32, 38]) {
        const r = runs(run(div, athlete(sex, { fiveKSec: min(m) })));
        if (prev) r.forEach((x, i) => expect(x).toBeGreaterThan(prev![i]));
        prev = r;
      }
    }
  });

  it('stronger ⇒ faster sleds, carry and lunges (level sweep)', () => {
    let prev: Prediction | null = null;
    for (const l of [1, 2, 3, 4, 5] as Level[]) {
      const p = run('men-open', athlete('male', { fiveKSec: min(23), lv: { legs: l, hinge: l } }));
      if (prev) {
        for (const id of ['sledPush', 'sledPull', 'farmersCarry', 'sandbagLunges'] as const) {
          expect(st(p, id)).toBeLessThanOrEqual(st(prev, id));
        }
        expect(st(p, 'skierg')).toBeCloseTo(st(prev, 'skierg'), 5); // strength doesn't touch ergs
      }
      prev = p;
    }
  });

  it('heavier squat (same bodyweight) ⇒ faster sled push', () => {
    const times = [60, 100, 140, 180].map((kg) =>
      st(run('men-open', athlete('male', { fiveKSec: min(23), lifts: { ...emptyLifts(), backSquat: { kg, reps: 1 } } })), 'sledPush'),
    );
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeLessThanOrEqual(times[i - 1]);
    expect(times[0] / times[3]).toBeGreaterThan(1.5);
  });

  it('more experience ⇒ less Roxzone time and less run fade', () => {
    const exp = (e: AthleteProfile['experience']) => run('men-open', athlete('male', { fiveKSec: min(23), experience: e }));
    const first = exp('first');
    const comp = exp('competitive');
    expect(comp.roxzone).toBeLessThan(first.roxzone);
    expect(comp.runTotal).toBeLessThan(first.runTotal);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────
describe('fuzz: random athletes never produce impossible splits', () => {
  // Deterministic PRNG so failures are reproducible.
  let seed = 42;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const maybe = <T>(x: T) => (rand() < 0.5 ? x : null);

  function randomAthlete(sex: 'male' | 'female', i: number): AthleteProfile {
    const five = min(14 + rand() * 26);
    const lvl = () => (rand() < 0.4 ? null : (pick([1, 2, 3, 4, 5]) as Level));
    return {
      ...defaultAthlete(sex, i),
      bodyweightKg: maybe(45 + rand() * 70),
      age: maybe(18 + Math.round(rand() * 55)),
      experience: pick(['unknown', 'first', 'some', 'experienced', 'competitive'] as const),
      trainingHours: maybe(Math.round(rand() * 20)),
      fiveKSec: rand() < 0.8 ? five : null,
      vo2max: maybe(30 + rand() * 45),
      restingHr: maybe(40 + rand() * 40),
      row2kSec: maybe(min(6) + rand() * min(4)),
      skiErg1kSec: maybe(min(3, 20) + rand() * min(2, 30)),
      lifts: { ...emptyLifts(), backSquat: { kg: maybe(40 + rand() * 180), reps: pick([1, 3, 5, 8]) } },
      wallBallsUnbroken: maybe(Math.round(5 + rand() * 120)),
      deadHangSec: maybe(Math.round(rand() * 200)),
      burpees1Min: maybe(Math.round(8 + rand() * 30)),
      levels: { run: lvl(), erg: lvl(), legs: lvl(), hinge: lvl(), grip: lvl(), burpees: lvl(), sled: lvl(), lunges: lvl(), wallBalls: lvl(), transitions: lvl() },
    };
  }

  // Human limits per station (singles, any division/weights); doubles/relay can be quicker.
  const LIMITS: Record<StationId, [number, number]> = {
    skierg: [min(3), min(8)],
    sledPush: [min(1, 30), min(10)],
    sledPull: [min(2), min(12)],
    burpeeBroadJump: [min(2), min(18)], // 120+ min finishers already average ~10:20
    row: [min(3), min(8, 30)],
    farmersCarry: [min(1), min(5, 30)],
    sandbagLunges: [min(2), min(15)],
    wallBalls: [min(2, 45), min(18)],
  };

  it('500 random athletes across all divisions: every split within human limits', () => {
    for (let n = 0; n < 500; n++) {
      const d = DIVISIONS[n % DIVISIONS.length];
      const team = d.defaultSexes.map((s, i) => randomAthlete(s, i));
      const p = predict({ divisionId: d.id, athletes: team });
      const teamFactor = d.format === 'single' ? 1 : 0.45;
      for (const r of runs(p)) within(r, min(2, 40), min(12)); // 2:40 ≈ fresh relay leg of a 14:00 5K runner
      for (const id of STATION_IDS) {
        const [lo, base] = LIMITS[id];
        // Heavier (Pro / mixed) loads legitimately stretch the slow end.
        const heaviest = Math.max(...team.map((a) => loadMultiplier(a.sex, id, weightForAthlete(d, a.sex, id))));
        const hi = base * heaviest;
        const t = st(p, id);
        if (t < lo * teamFactor || t > hi) throw new Error(`${d.id} ${id} ${t.toFixed(0)}s outside ${lo * teamFactor}-${hi}: ${JSON.stringify(team)}`);
      }
      within(p.roxzone, min(1, 30), min(22));
      within(p.total, min(40), min(4 * 60));
      expect(p.low).toBeLessThan(p.total);
      expect(p.high).toBeGreaterThan(p.total);
    }
  });

  it('runs always sit between ~5K pace and 1.6× 5K pace when a 5K is entered', () => {
    for (let n = 0; n < 200; n++) {
      const a = randomAthlete(rand() < 0.5 ? 'male' : 'female', 0);
      a.fiveKSec = min(15 + rand() * 20);
      a.previousHyroxSec = null;
      const div = a.sex === 'male' ? 'men-open' : 'women-open';
      const pace = a.fiveKSec / 5;
      for (const r of runs(run(div, a))) within(r, pace * 0.97, pace * 1.6);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────
describe('user-reported scenario: 54-year-old, 162 lb, VO₂max 53, 21:08 5K, 3:24 marathon', () => {
  const masters = (p: Partial<AthleteProfile> & { lv?: Levels } = {}) =>
    athlete('male', { fiveKSec: min(21, 8), marathonSec: 3 * 3600 + 24 * 60, vo2max: 53, bodyweightKg: 162 / 2.20462, age: 54, ...p });

  it('running is solid: laps around marathon pace, never slow', () => {
    const p = run('men-open', masters());
    const marathonPace = (3 * 3600 + 24 * 60) / 42.195; // ≈ 4:50/km
    within(p.avgRun, marathonPace * 0.95, marathonPace * 1.12);
    for (const r of runs(p)) expect(r).toBeLessThan(min(6));
    within(p.total, min(72), min(90));
  });

  it('a Strong Roxzone rating is faster than typical, even on a first race', () => {
    for (const experience of ['first', 'some', 'unknown'] as const) {
      const p = run('men-open', masters({ experience, lv: { transitions: 4 } }));
      expect(p.solos[0].roxzone).toBeLessThan(p.solos[0].typicalRoxzone);
    }
  });

  it('marathon endurance nudges the running: durable is faster than fading', () => {
    const durable = run('men-open', masters({ marathonSec: 3 * 3600 + 12 * 60 }));
    const fading = run('men-open', masters({ marathonSec: 3 * 3600 + 50 * 60 }));
    expect(durable.runTotal).toBeLessThan(fading.runTotal);
    // …but only modestly: the 5K stays the anchor
    expect(fading.runTotal / durable.runTotal).toBeLessThan(1.12); // 38 min marathon spread ⇒ ≤ ~10% laps
  });

  it('a marathon alone (no 5K) still predicts sensible running', () => {
    const p = run('men-open', masters({ fiveKSec: null }));
    within(p.avgRun, min(4, 45), min(5, 40));
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────
describe('race times, height and age (research-backed inputs)', () => {
  it('all four races can be entered together and are blended (10K/half weigh most)', () => {
    const five = athlete('male', { fiveKSec: min(21) });
    const all = athlete('male', { fiveKSec: min(21), tenKSec: min(44), halfMarathonSec: min(98), marathonSec: 3 * 3600 + 30 * 60 });
    const p = run('men-open', all);
    expect(p.solos[0].resolved.fiveK.source).toContain('5K 21:00 + 10K 44:00 + half 1:38:00 + marathon 3:30:00');
    // slower-than-Riegel long races pull the estimate slower than the 5K alone
    expect(p.total).toBeGreaterThan(run('men-open', five).total);
  });

  it('a 10K alone is enough, and endurance can come from 10K + marathon without a 5K', () => {
    const tenOnly = run('men-open', athlete('male', { tenKSec: min(46) }));
    within(tenOnly.avgRun, min(4, 50), min(5, 50));
    const fading = run('men-open', athlete('male', { tenKSec: min(46), marathonSec: 4 * 3600 }));
    expect(fading.solos[0].runFactor).toBeGreaterThan(tenOnly.solos[0].runFactor);
  });

  it('REGRESSION: the 1-mile and Cooper inputs were removed (too anaerobic / not a race)', () => {
    const a = athlete('male') as unknown as Record<string, unknown>;
    expect('mileSec' in a).toBe(false);
    expect('cooperMeters' in a).toBe(false);
  });

  it('height: taller is slightly faster on ergs, lunges and BBJ; overall effect stays small', () => {
    const short = run('men-open', athlete('male', { fiveKSec: min(21), heightCm: 170 }));
    const tall = run('men-open', athlete('male', { fiveKSec: min(21), heightCm: 201 }));
    for (const id of ['skierg', 'row', 'sandbagLunges', 'burpeeBroadJump'] as const) expect(st(tall, id)).toBeLessThan(st(short, id));
    expect(st(tall, 'wallBalls')).toBeCloseTo(st(short, 'wallBalls'), 5);
    expect((short.total - tall.total) / short.total).toBeLessThan(0.025); // 31 cm apart ⇒ < 2.5%
  });

  it('doubles: the much taller partner takes more of the lunges and burpee broad jumps', () => {
    const p = run('men-doubles', athlete('male', { fiveKSec: min(21), heightCm: 170 }), athlete('male', { fiveKSec: min(21), heightCm: 201 }));
    expect(p.doublesShares!.sandbagLunges).toBeLessThan(0.5); // share of athlete 1 (the shorter one)
    expect(p.doublesShares!.burpeeBroadJump).toBeLessThan(0.5);
  });

  it('masters: a small extra station/Roxzone penalty from 50, not on the runs', () => {
    const young = run('men-open', athlete('male', { fiveKSec: min(21), age: 40 }));
    const older = run('men-open', athlete('male', { fiveKSec: min(21), age: 58 }));
    expect(older.runTotal).toBeCloseTo(young.runTotal, 5);
    within(older.workTotal / young.workTotal, 1.01, 1.05);
  });
});
