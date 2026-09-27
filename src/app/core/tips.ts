import { StationId } from './stations';

export interface Tip {
  id: string;
  /** What the tip is about (a station, the runs, or the Roxzone). */
  area: StationId | 'run' | 'roxzone' | 'race';
  title: string;
  text: string;
}

/**
 * Practical, technique-level advice. Shown for the athlete's biggest limiters plus race-craft
 * that helps everyone. Sources: HYROX coaching guides (roxlyfe, HyroxDataLab, official HYROX
 * training content); see RESEARCH.md.
 */
export const TIPS: Record<Tip['area'], Tip> = {
  run: {
    id: 'run', area: 'run', title: 'Run the first kilometre at race pace, not faster',
    text: 'Going out hard on Run 1 is the most common pacing mistake. Aim for your average lap pace and let the fresh legs feel easy. Practise "compromised" runs: 1 km straight after sled or lunge work.',
  },
  roxzone: {
    id: 'roxzone', area: 'roxzone', title: 'Treat the Roxzone as part of the race',
    text: 'Walk the venue map beforehand, jog in and out of every station, and take a breath while moving rather than standing. Elites spend about 4 minutes in the Roxzone in total; many first-timers spend 10 or more.',
  },
  race: {
    id: 'race', area: 'race', title: 'Rehearse a full simulation',
    text: 'One or two half or full race simulations in the 3–6 weeks before race day teach pacing, fuelling and transitions. That is often the cheapest time you will ever save.',
  },
  skierg: {
    id: 'skierg', area: 'skierg', title: 'SkiErg: hinge, don’t just pull',
    text: 'Drive down with your lats and a hip hinge, arms fairly straight. Settle into a sustainable rhythm; it’s the first station, so don’t burn matches.',
  },
  sledPush: {
    id: 'sledPush', area: 'sledPush', title: 'Sled push: low angle, short fast steps',
    text: 'Arms locked or slightly bent, body low (around 45°), drive through the balls of your feet with short quick steps. Keeping it moving beats stop-start, because every restart costs strength.',
  },
  sledPull: {
    id: 'sledPull', area: 'sledPull', title: 'Sled pull: use your legs and body weight',
    text: 'Sit back into a quarter squat and walk backwards while pulling hand over hand. Keep the rope in the box and your arms long. Grip and legs do the work together.',
  },
  burpeeBroadJump: {
    id: 'burpeeBroadJump', area: 'burpeeBroadJump', title: 'Burpee broad jumps: find a rhythm you can hold',
    text: 'Step back instead of jumping back if it keeps you moving. Jump a comfortable distance rather than a max. A steady pace with no stops beats fast bursts with rests.',
  },
  row: {
    id: 'row', area: 'row', title: 'Rowing: legs, body, arms at a steady rate',
    text: 'Push with the legs first and keep a controlled 26–32 strokes per minute with the damper around 5–7. Treat it as active recovery before Run 6, not a sprint.',
  },
  farmersCarry: {
    id: 'farmersCarry', area: 'farmersCarry', title: 'Farmers carry: fast feet, never set them down early',
    text: 'Chalk up, stand tall and take short quick steps. If your grip is going, slow down rather than drop the bells. Picking them back up costs more than it saves.',
  },
  sandbagLunges: {
    id: 'sandbagLunges', area: 'sandbagLunges', title: 'Lunges: steady steps, plan your breaks',
    text: 'Keep the bag high on your upper back and an upright torso, and touch the knee lightly. Break briefly before your legs fail, e.g. every 20–25 m, rather than grinding to a halt.',
  },
  wallBalls: {
    id: 'wallBalls', area: 'wallBalls', title: 'Wall balls: pick a set plan before race day',
    text: 'Plan your sets, for example 25-20-20-15-10-10, and rest 5–8 s between them before you hit failure. Catch high and ride the ball into the squat. Plan your breathing: exhale on the throw.',
  },
};

/** Tips for the athlete's top limiters, plus the race-craft tips that help everyone. */
export function tipsFor(limiterIds: Tip['area'][], firstRace: boolean): Tip[] {
  const picked: Tip[] = [];
  for (const id of limiterIds) if (TIPS[id] && !picked.includes(TIPS[id])) picked.push(TIPS[id]);
  for (const general of [TIPS.run, TIPS.roxzone, ...(firstRace ? [TIPS.race] : [])]) {
    if (!picked.includes(general)) picked.push(general);
  }
  return picked.slice(0, 5);
}

export interface DoublesTip {
  id: StationId;
  title: string;
  /** How often to switch and how to hand over. */
  how: string;
  /** Who does how much, from the optimised (or your own) split. */
  plan: string;
}

/** How much work each station is, and the natural unit to split it in. */
const DOUBLES_WORK: Record<StationId, { total: number; unit: string; step: number }> = {
  skierg: { total: 1000, unit: 'm', step: 50 },
  sledPush: { total: 4, unit: 'lengths', step: 1 },
  sledPull: { total: 4, unit: 'lengths', step: 1 },
  burpeeBroadJump: { total: 80, unit: 'm', step: 5 },
  row: { total: 1000, unit: 'm', step: 50 },
  farmersCarry: { total: 200, unit: 'm', step: 10 },
  sandbagLunges: { total: 100, unit: 'm', step: 12.5 },
  wallBalls: { total: 100, unit: 'reps', step: 5 },
};

/**
 * Doubles hand-over advice. Only one partner works at a time and you can switch as often as you
 * like, so short, frequent swaps keep both of you working near your best pace; the cost is a few
 * seconds per hand-over, which is why the row (straps) gets fewer swaps than the SkiErg.
 * Sources: HYROX doubles coaching guides (roxlyfe, official HYROX training content); see RESEARCH.md.
 */
const DOUBLES_HOW: Record<StationId, [string, string]> = {
  skierg: ['SkiErg: swap every 100–250 m',
    'About every 30–60 s. Swaps are quick (no straps), so shorter pulls at a harder pace beat long, fading ones. Call the swap 2–3 strokes early.'],
  sledPush: ['Sled push: swap every length (12.5 m)',
    'The resting partner waits at the far end ready to go. If one of you is much stronger, they take 3 of the 4 lengths rather than splitting a length.'],
  sledPull: ['Sled pull: swap every length',
    'Change over once the sled crosses the line. Swap mid-length only if the puller is stalling; a stopped sled costs more than a hand-over.'],
  burpeeBroadJump: ['Burpee broad jumps: swap every 10–20 m',
    'Roughly every 5–8 reps. Short turns keep jumps long; the resting partner walks alongside to take over exactly where the other landed.'],
  row: ['Row: swap every 250 m',
    'Getting in and out of the foot straps costs about 4–6 s, so swap less often than on the SkiErg. Leave the straps loose and set the monitor to show distance.'],
  farmersCarry: ['Farmers carry: swap every 50 m, or when grip starts to go',
    'Put the bells down under control and let your partner pick them up; one long turn usually ends with a grip failure and a slow restart.'],
  sandbagLunges: ['Sandbag lunges: swap every 12.5–25 m',
    'Hand the bag over at shoulder height to save a floor-to-shoulder lift. Short turns keep the knee touching and the stride long.'],
  wallBalls: ['Wall balls: swap every 10–15 reps',
    'Before either of you hits failure (5–10 reps if wall balls are your weakness; strong pairs do 15–25). Hand the ball over rather than dropping it and count out loud.'],
};

/** Per-station hand-over tips with each partner's share (athlete 0's share per station). */
export function doublesTips(shares: Record<StationId, number>, names: [string, string], stationNames: Record<StationId, string>): DoublesTip[] {
  return (Object.keys(DOUBLES_HOW) as StationId[]).map((id) => {
    const w = DOUBLES_WORK[id];
    const a = Math.round((shares[id] * w.total) / w.step) * w.step;
    const b = w.total - a;
    const amt = (x: number, exact: number) => {
      // Sled lengths are whole: say "2–3 of 4" when the best share falls between them.
      if (w.unit === 'lengths') {
        const lo = Math.floor(exact), hi = Math.ceil(exact);
        return Math.abs(exact - Math.round(exact)) > 0.25 ? `${lo}–${hi} of 4 lengths` : `${x} of 4 lengths`;
      }
      return `${Number.isInteger(x) ? x : x.toFixed(1)} ${w.unit}`;
    };
    const [title, how] = DOUBLES_HOW[id];
    return {
      id, title, how,
      plan: `${stationNames[id]} plan: ${names[0]} ≈ ${Math.round(shares[id] * 100)}% (${amt(a, shares[id] * w.total)}), ` +
        `${names[1]} ≈ ${Math.round((1 - shares[id]) * 100)}% (${amt(b, (1 - shares[id]) * w.total)}).`,
    };
  });
}
