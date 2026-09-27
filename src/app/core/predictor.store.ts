import { LB_PER_KG } from './units';
import { Injectable, computed, effect, signal, untracked } from '@angular/core';
import { AbilityId, AthleteProfile, Level, Lift, LiftId, defaultAthlete, migrateAthlete } from './athlete';
import { DIVISIONS, Sex, findDivision, sexIsChoosable } from './divisions';
import { PredictInput, predict } from './predictor';
import { computeInsights } from './insights';
import { STATION_IDS, StationId } from './stations';

export type Units = 'kg' | 'lb';
/** Quick shows only the inputs that drive the prediction most; Detailed shows everything. */
export type FormMode = 'quick' | 'detailed';

interface Persisted {
  v: 1;
  divisionId: string;
  athletes: AthleteProfile[];
  units: Units;
  doublesShares: Partial<Record<StationId, number | null>>;
  relayOrder: number[] | null;
  overrides: Partial<Record<StationId, number | null>>;
}

/**
 * Inputs are only persisted when the user opts in ("Save my inputs on this device").
 * They go to this browser's localStorage, never to a server and never in a cookie, so
 * nothing is sent with network requests. Turning the option off deletes the saved copy.
 */
const STORAGE_KEY = 'hyrox-predictor:saved';
/** Pre-opt-in versions auto-saved here; removed on startup. */
const LEGACY_KEY = 'hyrox-predictor:v1';
export { LB_PER_KG } from './units';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // blocked by browser settings
  }
}

function load(): Persisted | null {
  const store = storage();
  try {
    store?.removeItem(LEGACY_KEY);
    const raw = store?.getItem(STORAGE_KEY);
    if (!raw) return null;
    return sanitize(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Saved data is untrusted input: validate every field and drop anything malformed. */
function sanitize(raw: unknown): Persisted | null {
  const p = raw as Partial<Persisted> | null;
  if (!p || p.v !== 1 || !Array.isArray(p.athletes)) return null;
  const athletes = [0, 1, 2, 3].map((i) => migrateAthlete(p.athletes![i], i));
  const shareOk = (x: unknown) => typeof x === 'number' && isFinite(x) && x >= 0 && x <= 1;
  const secOk = (x: unknown) => typeof x === 'number' && isFinite(x) && x > 0 && x < 3600;
  const doublesShares: Persisted['doublesShares'] = {};
  const overrides: Persisted['overrides'] = {};
  for (const id of STATION_IDS) {
    if (shareOk(p.doublesShares?.[id])) doublesShares[id] = p.doublesShares![id]!;
    if (secOk(p.overrides?.[id])) overrides[id] = p.overrides![id]!;
  }
  const order = p.relayOrder;
  const relayOrder =
    Array.isArray(order) && order.length === 4 && [0, 1, 2, 3].every((i) => order.includes(i)) ? [...order] : null;
  return {
    v: 1,
    divisionId: DIVISIONS.some((d) => d.id === p.divisionId) ? p.divisionId! : DIVISIONS[0].id,
    athletes,
    units: p.units === 'lb' ? 'lb' : 'kg',
    doublesShares,
    relayOrder,
    overrides,
  };
}

@Injectable({ providedIn: 'root' })
export class PredictorStore {
  private readonly saved = load();

  /** Opt-in persistence; true only if the user previously chose to save. */
  readonly remember = signal(this.saved != null);
  readonly storageAvailable = storage() != null;

  readonly divisionId = signal(this.saved?.divisionId ?? DIVISIONS[0].id);
  readonly athletes = signal<AthleteProfile[]>(
    this.saved?.athletes ?? [defaultAthlete('male', 0), defaultAthlete('male', 1), defaultAthlete('female', 2), defaultAthlete('female', 3)],
  );
  readonly units = signal<Units>(this.saved?.units ?? 'kg');
  readonly doublesShares = signal<Partial<Record<StationId, number | null>>>(this.saved?.doublesShares ?? {});
  readonly relayOrder = signal<number[] | null>(this.saved?.relayOrder ?? null);
  readonly overrides = signal<Partial<Record<StationId, number | null>>>(this.saved?.overrides ?? {});
  readonly activeAthlete = signal(0);
  /**
   * The form always opens in Quick. Saved details still count, and Quick lists them ("Also using from
   * Detailed"). The mode isn't saved.
   */
  readonly mode = signal<FormMode>('quick');

  readonly division = computed(() => findDivision(this.divisionId()));
  readonly teamAthletes = computed(() => this.athletes().slice(0, this.division().teamSize));

  readonly predictInput = computed<PredictInput>(() => ({
    divisionId: this.divisionId(),
    athletes: this.athletes(),
    doublesShares: this.doublesShares(),
    relayOrder: this.relayOrder(),
    overrides: this.overrides(),
  }));

  readonly prediction = computed(() => predict(this.predictInput()));

  /** How much the last input change moved the finish time (for live feedback). */
  readonly lastChange = signal<{ delta: number; id: number } | null>(null);
  private previousTotal: number | null = null;
  private changeId = 0;

  /** Deterministic coaching insights for the selected athlete. */
  readonly insights = computed(() =>
    computeInsights(this.predictInput(), this.prediction(), Math.min(this.activeAthlete(), this.division().teamSize - 1)),
  );

  constructor() {
    effect(() => {
      const total = this.prediction().total;
      untracked(() => {
        const prev = this.previousTotal;
        this.previousTotal = total;
        if (prev != null && Math.abs(total - prev) >= 0.5) this.lastChange.set({ delta: total - prev, id: ++this.changeId });
      });
    });
    effect(() => {
      const store = storage();
      if (!store) return;
      if (!this.remember()) {
        store.removeItem(STORAGE_KEY);
        return;
      }
      const state: Persisted = {
        v: 1,
        divisionId: this.divisionId(),
        athletes: this.athletes(),
        units: this.units(),
        doublesShares: this.doublesShares(),
        relayOrder: this.relayOrder(),
        overrides: this.overrides(),
      };
      try {
        store.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* quota exceeded / private mode — the app still works without saving */
      }
    });
  }

  /**
   * Whether athlete sex is fixed by the division: single-sex divisions, and mixed divisions
   * whose rules fix the composition (mixed doubles 1+1, mixed relay 2+2).
   */
  readonly sexLocked = computed(() => !sexIsChoosable(this.division()));

  setDivision(id: string): void {
    const d = findDivision(id);
    this.divisionId.set(id);
    this.relayOrder.set(null);
    this.doublesShares.set({});
    // Locked splits belong to one format (a singles split makes no sense in doubles).
    this.overrides.set({});
    if (this.activeAthlete() >= d.teamSize) this.activeAthlete.set(0);
    if (!this.sexLocked()) return;
    // Align athlete sexes with the division, keeping everything else the user entered.
    this.athletes.update((list) =>
      list.map((a, i) => {
        const want: Sex | undefined = d.defaultSexes[i];
        return !want || a.sex === want ? a : { ...a, sex: want };
      }),
    );
  }

  updateAthlete(index: number, patch: Partial<AthleteProfile>): void {
    this.athletes.update((list) => list.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  setLevel(index: number, key: AbilityId, value: Level | null): void {
    this.athletes.update((list) =>
      list.map((a, i) => (i === index ? { ...a, levels: { ...a.levels, [key]: value } } : a)),
    );
  }

  setLift(index: number, id: LiftId, patch: Partial<Lift>): void {
    this.athletes.update((list) =>
      list.map((a, i) => (i === index ? { ...a, lifts: { ...a.lifts, [id]: { ...a.lifts[id], ...patch } } } : a)),
    );
  }

  setShare(id: StationId, share: number | null): void {
    this.doublesShares.update((s) => ({ ...s, [id]: share }));
  }

  setOverride(id: StationId, sec: number | null): void {
    this.overrides.update((o) => ({ ...o, [id]: sec }));
  }

  setRelayLeg(leg: number, athlete: number): void {
    const current = this.relayOrder() ?? this.prediction().relayOrder ?? [0, 1, 2, 3];
    const next = [...current];
    const other = next.indexOf(athlete);
    if (other >= 0) next[other] = next[leg];
    next[leg] = athlete;
    this.relayOrder.set(next);
  }

  reset(): void {
    this.athletes.set([defaultAthlete('male', 0), defaultAthlete('male', 1), defaultAthlete('female', 2), defaultAthlete('female', 3)]);
    this.doublesShares.set({});
    this.relayOrder.set(null);
    this.overrides.set({});
    this.setDivision(this.divisionId());
  }

  // ── Unit helpers ──────────────────────────────────────────────────────────────────
  toDisplayWeight(kg: number | null): number | null {
    if (kg == null) return null;
    return this.units() === 'kg' ? Math.round(kg * 10) / 10 : Math.round(kg * LB_PER_KG);
  }

  fromDisplayWeight(v: number | null): number | null {
    if (v == null || !isFinite(v) || v <= 0) return null;
    return this.units() === 'kg' ? v : v / LB_PER_KG;
  }
}
