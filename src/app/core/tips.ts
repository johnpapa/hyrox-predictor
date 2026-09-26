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
export function tipsFor(limiterIds: (StationId | 'roxzone')[], firstRace: boolean): Tip[] {
  const picked: Tip[] = [];
  for (const id of limiterIds) if (TIPS[id] && !picked.includes(TIPS[id])) picked.push(TIPS[id]);
  for (const general of [TIPS.run, TIPS.roxzone, ...(firstRace ? [TIPS.race] : [])]) {
    if (!picked.includes(general)) picked.push(general);
  }
  return picked.slice(0, 5);
}
