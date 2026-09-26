import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AbilityId, AthleteProfile, Experience, Level, Lift, LiftId, hyroxAgeGroup } from '../core/athlete';
import { FALLBACK } from '../core/fallback-params';
import { levelAnchors } from '../core/level-anchors';
import { enduranceExponent } from '../core/predictor';
import { LB_PER_KG, PredictorStore } from '../core/predictor.store';
import { Quality } from '../core/resolve';
import { formatTime } from '../core/time';
import { AbilityCard } from './ability-card';
import { LiftInput } from './lift-input';
import { NumberInput } from './number-input';
import { TimeInput } from './time-input';

const ABILITY_NAMES: Record<AbilityId, string> = {
  run: 'Running',
  erg: 'Ergs',
  legs: 'Leg strength',
  hinge: 'Pulling strength',
  grip: 'Grip',
  burpees: 'Burpees',
  sled: 'Sleds',
  lunges: 'Lunges',
  wallBalls: 'Wall balls',
  transitions: 'Roxzone',
};

const NEXT_STEP: Record<AbilityId, string> = {
  run: 'a recent race time (5K, 10K, half or marathon)',
  erg: 'a 1000m row or SkiErg time',
  legs: 'a squat (any reps)',
  hinge: 'a deadlift or trap-bar deadlift',
  grip: 'a dead hang time or max pull-ups',
  burpees: 'how many burpees you can do in 1 minute',
  sled: 'a sled push/pull test at race weight',
  lunges: 'a 100m sandbag lunge test',
  wallBalls: 'your max unbroken wall balls',
  transitions: 'a Roxzone self-rating',
};

@Component({
  selector: 'app-athlete-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TimeInput, AbilityCard, LiftInput, NumberInput],
  templateUrl: './athlete-form.html',
  styleUrl: './athlete-form.scss',
})
export class AthleteForm {
  protected readonly store = inject(PredictorStore);
  protected readonly idx = computed(() => Math.min(this.store.activeAthlete(), this.store.division().teamSize - 1));
  protected readonly a = computed(() => this.store.athletes()[this.idx()]);
  protected readonly solo = computed(() => this.store.prediction().solos[this.idx()]);
  protected readonly r = computed(() => this.solo().resolved);
  protected readonly unit = computed(() => this.store.units());

  protected readonly experiences: { id: Experience; label: string }[] = [
    { id: 'unknown', label: 'Not sure' },
    { id: 'first', label: 'First HYROX' },
    { id: 'some', label: '1–2 races' },
    { id: 'experienced', label: '3+ races' },
    { id: 'competitive', label: 'Competitive / podium' },
  ];

  /** Level descriptions for each ability, personalised to sex, bodyweight and units. */
  protected readonly anchors = computed(() => {
    const a = this.a();
    const bw = this.r().bodyweightKg;
    const out = {} as Record<AbilityId, string[]>;
    for (const id of Object.keys(ABILITY_NAMES) as AbilityId[]) out[id] = levelAnchors(id, a.sex, bw, this.unit());
    return out;
  });

  protected readonly confidence = computed(() => {
    const q = this.r().quality;
    const counts: Record<Quality, number> = { measured: 0, converted: 0, rated: 0, assumed: 0 };
    let best: AbilityId | null = null;
    let bestGain = 0;
    for (const id of Object.keys(q) as AbilityId[]) {
      counts[q[id]]++;
      const gain = FALLBACK.abilityWeight[id] * FALLBACK.qualityFactor[q[id]];
      if (gain > bestGain + 1e-9) {
        bestGain = gain;
        best = id;
      }
    }
    const items = (Object.keys(q) as AbilityId[]).map((id) => ({ id, name: ABILITY_NAMES[id], quality: q[id] }));
    return {
      pct: Math.round(this.solo().uncertainty * 100),
      counts,
      items,
      tip: best && bestGain > 0.002 ? `Add ${NEXT_STEP[best]} to narrow the range most.` : 'Great, your inputs are well covered.',
    };
  });

  protected readonly ageGroup = computed(() => hyroxAgeGroup(this.a().age));

  protected readonly heightHint = computed(() => {
    const h = this.a().heightCm;
    if (!h) return 'Optional · small effect';
    return this.unit() === 'kg' ? '' : `${Math.floor(h / 30.48)}′${Math.round((h / 2.54) % 12)}″`;
  });

  protected readonly runHint = computed(() => {
    const s = this.solo();
    const avg = (s.fiveKSec / 5) * s.runFactor;
    const k = enduranceExponent(this.a());
    const endurance =
      k == null ? '' : k <= 1.055 ? ' · Endurance: strong (long races hold pace well)' : k >= 1.09 ? ' · Endurance: fades over long races' : ' · Endurance: typical';
    return `HYROX run pace ≈ ${formatTime(avg)}/km (${Math.round((s.runFactor - 1) * 100)}% slower than 5K pace)${endurance}`;
  });

  protected patch(p: Partial<AthleteProfile>): void {
    this.store.updateAthlete(this.idx(), p);
  }

  protected level(id: AbilityId, l: Level | null): void {
    this.store.setLevel(this.idx(), id, l);
  }

  protected lift(id: LiftId, p: Partial<Lift>): void {
    this.store.setLift(this.idx(), id, p);
  }

  protected readonly weightFactor = computed(() => (this.unit() === 'kg' ? 1 : LB_PER_KG));

  /** Arrow-key navigation between athlete tabs (WAI-ARIA tabs pattern). */
  protected moveTab(delta: number): void {
    const n = this.store.division().teamSize;
    const next = (this.idx() + delta + n) % n;
    this.store.activeAthlete.set(next);
    queueMicrotask(() => document.getElementById('athlete-tab-' + next)?.focus());
  }

  protected any(...xs: unknown[]): boolean {
    return xs.some((x) => x != null && x !== 0);
  }
}
