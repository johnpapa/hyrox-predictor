/**
 * Input weighting review (expert pass, Sept 2026): every input should move the prediction by a
 * believable amount relative to the others. See RESEARCH.md "Input weighting review".
 */
import { AthleteProfile, Level, defaultAthlete, migrateAthlete } from './athlete';
import { findDivision } from './divisions';
import { levelAnchors } from './level-anchors';
import { predict, predictSolo } from './predictor';
import { computeInsights } from './insights';

const base: AthleteProfile = { ...defaultAthlete('male'), fiveKSec: 23 * 60, bodyweightKg: 82, age: 35, experience: 'some' };
const total = (p: Partial<AthleteProfile>) => predict({ divisionId: 'men-open', athletes: [{ ...base, ...p }] }).total;
const lv = (id: string, l: Level) => ({ levels: { ...base.levels, [id]: l } }) as Partial<AthleteProfile>;
const swing = (id: string) => total(lv(id, 2)) - total(lv(id, 4));

describe('self-ratings are weighted by how much each station varies in real results', () => {
  it('wall balls, lunges, burpees and transitions spread more than ergs', () => {
    for (const id of ['wallBalls', 'lunges', 'burpees', 'transitions']) expect(swing(id)).toBeGreaterThan(swing('erg') * 1.4);
    expect(swing('erg')).toBeLessThan(50);
    expect(swing('wallBalls')).toBeGreaterThan(60);
  });

  it('REGRESSION: wall-ball anchors match the model (rating a level = entering its unbroken count)', () => {
    // "Solid ≈ 50 unbroken" used to be scored like Elite for a 23:00 5K runner (typical ≈ 36).
    const d = findDivision('men-open');
    const typical = predictSolo(base, d).typicalWallBallsUnbroken;
    const anchors = levelAnchors('wallBalls', 'male', 82, 'kg', typical);
    for (const l of [2, 3, 4] as const) {
      const n = Number(anchors[l - 1].match(/About (\d+) unbroken/)![1]);
      const byRating = predictSolo({ ...base, ...lv('wallBalls', l) }, d).stations.wallBalls;
      const byCount = predictSolo({ ...base, wallBallsUnbroken: n }, d).stations.wallBalls;
      expect(Math.abs(byRating - byCount) / byRating).toBeLessThan(0.04);
    }
    expect(anchors[2]).toMatch(/About 3\d unbroken/);
  });
});

describe('experience is race craft, not fitness', () => {
  it('first race costs 3–6.5%; 3+ races saves under 2.5% at the same fitness', () => {
    const some = total({});
    const first = total({ experience: 'first' });
    const exp = total({ experience: 'experienced' });
    expect((first - some) / some).toBeGreaterThan(0.03);
    expect((first - some) / some).toBeLessThan(0.065);
    expect((some - exp) / some).toBeGreaterThan(0.005);
    expect((some - exp) / some).toBeLessThan(0.025);
  });
});

describe('inputs that were not worth entering are gone', () => {
  it('REGRESSION: resting HR and "runs straight after stations" were removed; old saves drop them', () => {
    // User: "Let's not make people enter information that is not valuable." / "nobody's gonna know that".
    const m = migrateAthlete({ sex: 'male', restingHr: 50, compromisedRuns: 'weekly', fiveKSec: 1500 }, 0) as unknown as Record<string, unknown>;
    expect('restingHr' in m).toBe(false);
    expect('compromisedRuns' in m).toBe(false);
    expect('restingHr' in defaultAthlete('male')).toBe(false);
  });
});

describe('doubles hand-over tips', () => {
  it('give a switch pattern and each partner’s share for every station, in doubles only', () => {
    const tall = { ...base, name: 'Jo', heightCm: 201, bodyweightKg: 100 };
    const input = { divisionId: 'men-doubles', athletes: [{ ...base, name: 'John' }, tall] };
    const i = computeInsights(input, predict(input));
    expect(i.doubles).toHaveLength(8);
    const row = i.doubles!.find((t) => t.id === 'row')!;
    expect(row.title).toContain('every 250 m');
    expect(i.doubles!.find((t) => t.id === 'wallBalls')!.title).toContain('10–15 reps');
    for (const t of i.doubles!) expect(t.plan).toMatch(/John ≈ \d+% .*Jo ≈ \d+%/);
    // Amounts add up (e.g. 1000 m of rowing, 4 sled lengths).
    const [a, b] = [...row.plan.matchAll(/\((\d+) m\)/g)].map((m) => Number(m[1]));
    expect(a + b).toBe(1000);
    for (const id of ['sledPush', 'sledPull'] as const) {
      expect(i.doubles!.find((t) => t.id === id)!.plan).toMatch(/\d(–\d)? of 4 lengths.*\d(–\d)? of 4 lengths/);
    }
    const solo = { divisionId: 'men-open', athletes: [base] };
    expect(computeInsights(solo, predict(solo)).doubles).toBeNull();
  });
});
