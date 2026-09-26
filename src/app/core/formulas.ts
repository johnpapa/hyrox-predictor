/** Standard sports-science conversions used to fill in missing benchmarks. */

/**
 * Estimated 1RM from a rep set (Epley). For a set that stopped short of failure, the reps left
 * in reserve are added ("reps to failure" = reps + RIR; Helms et al. 2016, Zourdos et al. 2016).
 * Singles are taken as the 1RM. Beyond ~10 reps to failure every formula loses accuracy, so the
 * total is capped at 15.
 */
export function oneRepMax(kg: number, reps: number | null | undefined, rir: number | null | undefined = 0): number {
  const r = Math.max(1, Math.round(reps ?? 1));
  if (r === 1) return kg;
  const toFailure = Math.min(15, r + Math.max(0, rir ?? 0));
  return kg * (1 + toFailure / 30);
}

/** Riegel race-time equivalence: T2 = T1 · (D2 / D1)^1.06. */
export function riegel(timeSec: number, fromMeters: number, toMeters: number, exponent = 1.06): number {
  return timeSec * Math.pow(toMeters / fromMeters, exponent);
}

/**
 * Paul's law for ergs: each doubling of distance adds ~5 s per 500 m.
 * Returns the time for `toMeters` given a time over `fromMeters`.
 */
export function paulsLaw(timeSec: number, fromMeters: number, toMeters: number): number {
  const split = timeSec / (fromMeters / 500);
  // Never let the adjustment eat more than half the split (guards absurd inputs).
  const newSplit = Math.max(split * 0.5, split + 5 * Math.log2(toMeters / fromMeters));
  return newSplit * (toMeters / 500);
}

/** Daniels & Gilbert: oxygen cost (ml/kg/min) of running at v metres/minute. */
function vo2Cost(v: number): number {
  return -4.6 + 0.182258 * v + 0.000104 * v * v;
}

/** Daniels & Gilbert: fraction of VO₂max sustainable for t minutes. */
function sustainable(t: number): number {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
}

/** VDOT (Daniels' running VO₂max) from a race performance. */
export function vdotFromRace(meters: number, sec: number): number {
  const t = sec / 60;
  return vo2Cost(meters / t) / sustainable(t);
}

/** Race time for a distance at a given VDOT (solved by bisection). */
export function raceTimeFromVdot(vdot: number, meters: number): number {
  let lo = meters / 500; // absurdly fast (500 m/min)
  let hi = meters / 50; // walking
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (vdotFromRace(meters, mid * 60) > vdot) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 60;
}
