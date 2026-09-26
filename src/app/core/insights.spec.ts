import { AthleteProfile, Level, defaultAthlete, emptyLevels } from './athlete';
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
    trainingHours: 6,
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
    expect(strength.length).toBeGreaterThan(0);
    expect(strength.every((w) => w.saves > 0)).toBe(true);
  });

  it('weak wall balls show up as the top limiter with a wall-ball what-if', () => {
    const i = run({ divisionId: 'women-open', athletes: [ath('female', { wallBallsUnbroken: 10 })] });
    expect(i.limiters[0].name).toBe('Wall Balls');
    const wb = i.whatIfs.find((w) => w.id === 'wallBalls');
    expect(wb?.saves).toBeGreaterThan(20);
    expect(wb?.detail).toContain('25 instead of 10');
  });

  it('strengths are reported for athletes better than typical', () => {
    const i = run({ divisionId: 'men-open', athletes: [ath('male', { wallBallsUnbroken: 100, deadHangSec: 180, burpees1Min: 35 })] });
    const names = i.strengths.map((s) => s.name);
    expect(names).toContain('Wall Balls');
    expect(i.strengths.every((s) => s.gap < 0)).toBe(true);
  });

  it('what-ifs are real, positive and sorted by savings; a faster 5K always helps', () => {
    const i = run({ divisionId: 'men-open', athletes: [ath('male')] });
    expect(i.whatIfs.length).toBeGreaterThan(2);
    for (let k = 1; k < i.whatIfs.length; k++) expect(i.whatIfs[k - 1].saves).toBeGreaterThanOrEqual(i.whatIfs[k].saves);
    const runW = i.whatIfs.find((w) => w.id === 'run')!;
    expect(runW.saves).toBeGreaterThan(60); // 1 min of 5K is worth more than 1 min in HYROX
    expect(runW.saves).toBeLessThan(8 * 60);
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
