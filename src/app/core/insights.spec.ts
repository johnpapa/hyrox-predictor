import { AthleteProfile, Level, defaultAthlete, emptyLevels, emptyLifts } from './athlete';
import { computeInsights } from './insights';
import { PredictInput, predict } from './predictor';
import { bandForSplit } from './split-tables';

const ath = (sex: 'male' | 'female', p: Partial<AthleteProfile> & { lv?: Partial<Record<string, Level>> } = {}): AthleteProfile => {
  const { lv, ...rest } = p;
  return {
    ...defaultAthlete(sex),
    fiveKSec: sex === 'male' ? 23 * 60 : 25 * 60,
    bodyweightKg: sex === 'male' ? 82 : 65,
    experience: 'some',
    ...rest,
    levels: { ...emptyLevels(), ...(lv ?? {}) } as AthleteProfile['levels'],
  };
};
const run = (input: PredictInput, idx = 0) => computeInsights(input, predict(input), idx);

describe('insights', () => {
  it('a typical athlete has no limiters and says so', () => {
    const i = run({ divisionId: 'men-open', athletes: [ath('male')] });
    expect(i.limiters).toEqual([]);
    expect(i.headline).toContain('Well balanced');
  });

  it('a runner with no strength is told the sleds are the limiter, and strength saves time', () => {
    const i = run({ divisionId: 'men-open', athletes: [ath('male', { fiveKSec: 18 * 60, lv: { legs: 1, hinge: 1, sled: 1 } })] });
    const names = i.limiters.map((l) => l.name);
    expect(names).toContain('Sled Push');
    expect(names).toContain('Sled Pull');
    expect(i.headline).toMatch(/Sled|Lunges/); // all strength-limited stations
    const strength = i.whatIfs.filter((w) => w.id === 'legs' || w.id === 'hinge');
    expect(strength.length).toBeGreaterThan(0); // self-rated Weak ⇒ realistic gains are offered
    expect(strength.every((w) => w.saves > 0)).toBe(true);
    expect(strength.every((w) => !/kg/.test(w.detail))).toBe(true); // rated, not measured: no kg
  });

  it('weak wall balls show up as the top limiter with a wall-ball what-if', () => {
    const i = run({ divisionId: 'women-open', athletes: [ath('female', { wallBallsUnbroken: 10 })] });
    expect(i.limiters[0].name).toBe('Wall Balls');
    const wb = i.whatIfs.find((w) => w.id === 'wallBalls');
    expect(wb?.saves).toBeGreaterThan(20);
    expect(wb?.detail).toContain('10 → 14 unbroken');
  });

  it('strengths are reported for athletes better than typical', () => {
    const i = run({ divisionId: 'men-open', athletes: [ath('male', { wallBallsUnbroken: 100, deadHangSec: 180, burpees1Min: 35 })] });
    const names = i.strengths.map((s) => s.name);
    expect(names).toContain('Wall Balls');
    expect(i.strengths.every((s) => s.gap < 0)).toBe(true);
  });

  it('what-ifs are real, positive and sorted by savings; better running always helps', () => {
    const i = run({ divisionId: 'men-open', athletes: [ath('male', { wallBallsUnbroken: 30, deadHangSec: 60, burpees1Min: 20 })] });
    expect(i.whatIfs.length).toBeGreaterThan(2);
    for (let k = 1; k < i.whatIfs.length; k++) expect(i.whatIfs[k - 1].saves).toBeGreaterThanOrEqual(i.whatIfs[k].saves);
    const runW = i.whatIfs.find((w) => w.id === 'run')!;
    expect(runW.saves).toBeGreaterThan(20);
    expect(runW.saves).toBeLessThan(4 * 60);
  });

  it('team formats: insights follow the chosen athlete and savings apply to the team total', () => {
    const input: PredictInput = { divisionId: 'mixed-doubles', athletes: [ath('male', { name: 'Sam' }), ath('female', { name: 'Jess', wallBallsUnbroken: 8 })] };
    const i0 = run(input, 0);
    const i1 = run(input, 1);
    expect(i0.athleteIndex).toBe(0);
    expect(i1.athleteIndex).toBe(1);
    expect(i1.limiters[0].name).toBe('Wall Balls');
    expect(i1.headline.startsWith('Jess:')).toBe(true);
    const teamTotal = predict(input).total;
    const wb = i1.whatIfs.find((w) => w.id === 'wallBalls')!;
    expect(wb.saves).toBeLessThan(teamTotal);
  });

  it('pacing advice never tells you to start faster than your average', () => {
    const i = run({ divisionId: 'men-open', athletes: [ath('male')] });
    expect(i.pacing[0]).toMatch(/hold back/);
  });
});

describe('split bands (simulator)', () => {
  it('labels splits by the finish band they are typical of', () => {
    expect(bandForSplit('male', 'run', 318)).toBe('80–90');
    expect(bandForSplit('male', 'wallBalls', 225)).toBe('Sub-60');
    expect(bandForSplit('male', 'wallBalls', 700)).toBe('120+');
    expect(bandForSplit('female', 'sledPush', 148)).toBe('70–80');
    // heavier loads shift the reference
    expect(bandForSplit('male', 'sledPush', 179 * 1.48, 1.48)).toBe('80–90');
  });
});

describe('running vs stations comparison', () => {
  it('flags running as the relative strength for a runner with weak stations', () => {
    const i = run({ divisionId: 'men-open', athletes: [ath('male', { fiveKSec: 19 * 60, wallBallsUnbroken: 10, lv: { legs: 1, hinge: 1, sled: 1 } })] });
    expect(i.running.comparison).toContain('Running is your relative strength');
  });

  it('is omitted for team formats', () => {
    const i = run({ divisionId: 'men-doubles', athletes: [ath('male'), ath('male')] });
    expect(i.running.comparison).toBeNull();
  });
});

describe('realistic, honest suggestions (user feedback)', () => {
  it('REGRESSION: unknown strength never produces kg numbers; it is listed as worth measuring', () => {
    const i = run({ divisionId: 'men-open', athletes: [ath('male', { fiveKSec: 21 * 60 + 8 })] });
    expect(i.whatIfs.find((w) => w.id === 'legs' || w.id === 'hinge')).toBeUndefined();
    expect(i.whatIfs.every((w) => !/kg/.test(w.detail))).toBe(true);
    const ids = i.unknowns.map((u) => u.id);
    expect(ids).toContain('legs');
    expect(ids).toContain('hinge');
    expect(i.unknowns.every((u) => u.swing > 0)).toBe(true);
  });

  it('REGRESSION: the running suggestion quotes the 5K actually entered, not a blended equivalent', () => {
    const i = run({ divisionId: 'men-open', athletes: [ath('male', { fiveKSec: 21 * 60 + 8, marathonSec: 3 * 3600 + 24 * 60, age: 54 })] });
    expect(i.whatIfs.find((x) => x.id === 'run')!.detail).toMatch(/^5K 21:08 → /);
  });

  it('REGRESSION: a 21:08 runner aged 54 gets a realistic running gain, not "1 minute faster"', () => {
    const i = run({ divisionId: 'men-open', athletes: [ath('male', { fiveKSec: 21 * 60 + 8, age: 54 })] });
    const w = i.whatIfs.find((x) => x.id === 'run')!;
    const m = w.detail.match(/→ (\d+):(\d+)/)!;
    const newFive = Number(m[1]) * 60 + Number(m[2]);
    expect(21 * 60 + 8 - newFive).toBeGreaterThan(5);
    expect(21 * 60 + 8 - newFive).toBeLessThan(30); // ≤ ~2% for a well-trained masters runner
  });

  it('beginners are offered bigger gains than well-trained athletes', () => {
    const gain = (five: number) => {
      const i = run({ divisionId: 'men-open', athletes: [ath('male', { fiveKSec: five })] });
      return i.whatIfs.find((x) => x.id === 'run')!.saves;
    };
    expect(gain(33 * 60)).toBeGreaterThan(gain(18 * 60) * 2);
  });

  it('measured lifts show kg (and lb) with a level-appropriate gain', () => {
    const i = run({ divisionId: 'men-open', athletes: [ath('male', { lifts: { ...emptyLifts(), backSquat: { kg: 80, reps: 1 } } })] });
    const w = i.whatIfs.find((x) => x.id === 'legs')!;
    expect(w.detail).toMatch(/80 kg \/ 176 lb → 9\d kg \/ \d+ lb \(\+1\d%\)/); // ≈1×BW squat is just above Fair → ~+10–15%
  });

  it('practical tips target the biggest limiters and always include pacing', () => {
    const i = run({ divisionId: 'men-open', athletes: [ath('male', { wallBallsUnbroken: 10 })] });
    expect(i.tips[0].area).toBe('wallBalls');
    expect(i.tips.map((t) => t.area)).toContain('run');
  });
});

describe('why each station differs (user question: "why am I worse than athletes who run like me?")', () => {
  const john = () =>
    ath('male', {
      fiveKSec: 21 * 60 + 8, marathonSec: 3 * 3600 + 24 * 60, bodyweightKg: 73.5, age: 54, heightCm: 170, experience: 'first',
      runningKmPerWeek: 64, otherTrainingHours: 5.5, wallBallsUnbroken: 20, lv: { transitions: 4 },
    });

  it('explains each gap by the inputs that cause it, and the reasons add up', () => {
    const input: PredictInput = { divisionId: 'men-open', athletes: [john()] };
    const p = predict(input);
    const i = computeInsights(input, p);
    const s = p.solos[0];
    for (const id of ['sledPush', 'sledPull', 'wallBalls', 'sandbagLunges', 'skierg'] as const) {
      const gap = s.stations[id] - s.typical[id];
      const sum = i.explanation.byArea[id].reduce((a, r) => a + r.sec, 0);
      expect(Math.abs(gap - sum)).toBeLessThan(8);
    }
    expect(i.explanation.byArea.wallBalls[0].label).toContain('20 unbroken');
    expect(i.explanation.overall[0].id).toBe('wallBalls');
  });

  it('REGRESSION: a Roxzone rating is attributed only to the Roxzone, not to the stations', () => {
    const input: PredictInput = { divisionId: 'men-open', athletes: [john()] };
    const i = computeInsights(input, predict(input));
    for (const id of ['sledPush', 'sledPull', 'sandbagLunges'] as const) {
      expect(i.explanation.byArea[id].some((r) => r.id === 'transitions')).toBe(false);
    }
    const rox = i.explanation.byArea.roxzone.find((r) => r.id === 'transitions')!;
    expect(rox.sec).toBeLessThan(0); // Strong ⇒ faster
    expect(Math.abs(i.explanation.unexplained.roxzone)).toBeLessThan(5);
  });

  it('REGRESSION: compares against athletes like you, so build and age do not show up as station gaps', () => {
    // User: "It should be versus athletes like you taking into account my height, my weight,
    // my running times, my age, everything overall." With no lifts entered, John's sleds and
    // lunges match athletes like him; before, they showed as slower because of his lighter bodyweight.
    const input: PredictInput = { divisionId: 'men-open', athletes: [john()] };
    const p = predict(input);
    const s = p.solos[0];
    for (const id of ['sledPush', 'sledPull', 'farmersCarry', 'sandbagLunges', 'burpeeBroadJump', 'skierg', 'row'] as const) {
      expect(Math.abs(s.stations[id] - s.typical[id])).toBeLessThan(1);
    }
    const i = computeInsights(input, p);
    expect(i.headline).toContain('athletes like you');
    expect(i.explanation.overall.map((r) => r.id).sort()).toEqual(['transitions', 'wallBalls']);
    // Build and background are reported separately, as effects on the finish time.
    const ids = i.profile.map((r) => r.id);
    for (const id of ['bodyweight', 'age', 'experience', 'runningVolume']) expect(ids).toContain(id);
    expect(i.profile.find((r) => r.id === 'bodyweight')!.label).toMatch(/Lighter bodyweight/);
    expect(i.profile.find((r) => r.id === 'age')!.sec).toBeGreaterThan(0); // 54: masters allowance
    expect(i.profile.find((r) => r.id === 'runningVolume')!.sec).toBeLessThan(0); // 64 km/week helps
  });

  it('entering only build and background never creates a station gap', () => {
    const a = ath('male', { bodyweightKg: 105, heightCm: 195, age: 62, bodyFatPct: 28, otherTrainingHours: 9, runningKmPerWeek: 10, experience: 'first' });
    const input: PredictInput = { divisionId: 'men-open', athletes: [a] };
    const i = computeInsights(input, predict(input));
    expect(i.limiters).toEqual([]);
    expect(i.strengths).toEqual([]);
    expect(i.profile.length).toBeGreaterThanOrEqual(4);
  });

  it('strength reasons compare your estimated 1RM with athletes like you', () => {
    const a = { ...john(), lifts: { ...emptyLifts(), deadlift: { kg: 60, reps: 10, rir: 1.5 } } };
    const input: PredictInput = { divisionId: 'men-open', athletes: [a] };
    const i = computeInsights(input, predict(input));
    const r = i.explanation.byArea.sledPull.find((x) => x.id === 'hinge')!;
    expect(r.label).toMatch(/deadlift 1RM ≈ 83 kg .* for athletes like you/);
  });

  it('REGRESSION: a squat below athletes like you is never credited as faster (deadlift also entered)', () => {
    // Clearing the squat used to make the model estimate it from the deadlift instead, which
    // flipped the sign: "Leg strength (above typical: squat 85 kg vs 116 kg)" with −70 s.
    const set = { kg: 61.2, reps: 10, rir: 1.5 };
    const a = { ...john(), lifts: { ...emptyLifts(), backSquat: set, deadlift: set } };
    const input: PredictInput = { divisionId: 'men-open', athletes: [a] };
    const i = computeInsights(input, predict(input));
    const legs = i.explanation.overall.find((r) => r.id === 'legs')!;
    const hinge = i.explanation.overall.find((r) => r.id === 'hinge')!;
    expect(legs.sec).toBeGreaterThan(0);
    expect(legs.label).toContain('below typical');
    expect(hinge.sec).toBeGreaterThan(0);
  });

  it('realistic gains for a working set are phrased as a working set (same reps, more weight)', () => {
    const a = { ...john(), lifts: { ...emptyLifts(), backSquat: { kg: 60, reps: 10, rir: 1.5 } } };
    const input: PredictInput = { divisionId: 'men-open', athletes: [a] };
    const w = run(input).whatIfs.find((x) => x.id === 'legs')!;
    expect(w.detail).toMatch(/^Working set 60 kg \/ 132 lb × 10 → \d+ kg \/ \d+ lb × 10/);
    expect(w.saves).toBeGreaterThan(0);
  });

  it('a typical athlete has nothing to explain', () => {
    const input: PredictInput = { divisionId: 'men-open', athletes: [ath('male')] };
    const i = computeInsights(input, predict(input));
    expect(i.explanation.overall).toEqual([]);
  });
});
