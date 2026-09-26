import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { RepeatPress } from './repeat-press';

let nextId = 0;

/**
 * Numeric field that never rewrites what the user is typing (so "7.", "22.5 lb" or "0" work).
 * `factor` converts model units to display units (e.g. kg → lb); blank emits null.
 */
@Component({
  selector: 'app-number-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RepeatPress],
  template: `
    <div class="field">
      <div class="lab-row">
        <label class="label" [for]="id">{{ label() }}</label>
        @if (units(); as u) {
          <span class="units" role="group" aria-label="Units">
            <button type="button" [class.on]="u === 'kg'" [attr.aria-pressed]="u === 'kg'" [attr.aria-label]="unitNames()[0]"
              (click)="unitsChange.emit('kg')">{{ unitLabels()[0] }}</button>
            <button type="button" [class.on]="u === 'lb'" [attr.aria-pressed]="u === 'lb'" [attr.aria-label]="unitNames()[1]"
              (click)="unitsChange.emit('lb')">{{ unitLabels()[1] }}</button>
          </span>
        }
      </div>
      <div class="stepper">
      <button type="button" class="step" tabindex="-1" aria-label="Decrease" [attr.aria-controls]="id"
        [disabled]="atMin()" appRepeatPress (repeatPress)="stepBy(-1)">−</button>
      <input
        [id]="id"
        role="spinbutton"
        [attr.aria-valuenow]="value() == null ? null : displayNum(value()!)"
        [attr.aria-valuemin]="range() ? displayNum(range()![0]) : null"
        [attr.aria-valuemax]="range() ? displayNum(range()![1]) : null"
        [attr.aria-label]="ariaLabel() || null"
        [attr.aria-describedby]="hint() || rangeMsg() ? id + '-hint' : null"
        type="text"
        [attr.inputmode]="integer() ? 'numeric' : 'decimal'"
        autocomplete="off"
        [placeholder]="placeholder()"
        [value]="text()"
        [class.invalid]="invalid() || !!rangeMsg()"
        [attr.aria-invalid]="invalid() || !!rangeMsg()"
        (input)="onInput($any($event.target).value)"
        (keydown)="onKey($event)"
        (blur)="onBlur()"
      />
      <button type="button" class="step" tabindex="-1" aria-label="Increase" [attr.aria-controls]="id"
        [disabled]="atMax()" appRepeatPress (repeatPress)="stepBy(1)">+</button>
      </div>
      @if (rangeMsg(); as m) { <span class="hint warn" [id]="id + '-hint'" role="alert">{{ m }}</span> }
      @else if (hint()) { <span class="hint" [id]="id + '-hint'">{{ hint() }}</span> }
      @if (uses()) { <span class="uses">Used for: <b>{{ uses() }}</b></span> }
    </div>
  `,
  styles: `
    .invalid { border-color: var(--warn) !important; }
    .warn { color: var(--warn); }
    .uses { font-size: 0.74rem; color: var(--text-faint); }
    .uses b { color: var(--accent); font-weight: 600; }
    .stepper { display: grid; grid-template-columns: 36px minmax(0, 1fr) 36px; }
    .stepper input { border-radius: 0; text-align: center; padding-left: 4px; padding-right: 4px; }
    .step {
      min-height: 44px; border: 1px solid var(--line-strong); background: var(--bg-elev); color: var(--text);
      font-size: 1.1rem; cursor: pointer; touch-action: manipulation; user-select: none; -webkit-user-select: none;
    }
    .step:first-child { border-right: 0; border-radius: var(--radius) 0 0 var(--radius); }
    .step:last-child { border-left: 0; border-radius: 0 var(--radius) var(--radius) 0; }
    .step:hover:not(:disabled) { color: var(--accent); }
    .step:disabled { color: var(--text-faint); cursor: default; }
    .lab-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-height: 22px; }
    .units { display: inline-flex; border: 1px solid var(--line-strong); border-radius: 2px; overflow: hidden; flex: none; }
    .units button {
      min-height: 24px; min-width: 30px; padding: 0 6px; border: 0; background: transparent; color: var(--text-dim); cursor: pointer;
      font-family: var(--font-mono); font-size: 0.7rem; text-transform: uppercase;
    }
    .units button.on { background: var(--accent); color: var(--accent-ink); font-weight: 700; }
  `,
})
export class NumberInput {
  protected readonly id = `num-${nextId++}`;
  readonly label = input.required<string>();
  /** Accessible name when the visible label is ambiguous (e.g. several "Reps" fields). */
  readonly ariaLabel = input('');
  /** Value in model units. */
  readonly value = input<number | null>(null);
  readonly factor = input(1);
  readonly decimals = input(1);
  readonly integer = input(false);
  readonly allowZero = input(false);
  readonly placeholder = input('Not sure');
  readonly hint = input('');
  /** Which parts of the race this value feeds (shown under the field). */
  readonly uses = input('');
  readonly valueChange = output<number | null>();
  /** When set, shows an inline kg/lb switch (weights only). */
  readonly units = input<'kg' | 'lb' | null>(null);
  readonly unitsChange = output<'kg' | 'lb'>();
  /** Button text / accessible names for the metric and imperial options. */
  readonly unitLabels = input<[string, string]>(['kg', 'lb']);
  readonly unitNames = input<[string, string]>(['Kilograms', 'Pounds']);

  /** Plausible range in model units; values outside it are ignored by the model, so say so. */
  readonly range = input<readonly [number, number] | null>(null);
  /** −/+ step in display units (e.g. 2.5 kg or 5 lb). Arrow keys step too; Shift × 10. */
  readonly step = input(1);
  /** Model value the first press starts from when the field is empty. */
  readonly start = input<number | null>(null);

  protected readonly invalid = linkedSignal(() => false);

  protected readonly rangeMsg = computed(() => {
    const v = this.value();
    const r = this.range();
    if (v == null || !r || (v >= r[0] && v <= r[1])) return '';
    return `${this.display(v)} isn't realistic, so it's ignored (expected ${this.display(r[0])}–${this.display(r[1])})`;
  });

  protected displayNum(v: number): number {
    const d = this.integer() ? 0 : Math.max(this.decimals(), 2);
    return Math.round(v * this.factor() * 10 ** d) / 10 ** d;
  }

  protected readonly atMin = computed(() => {
    const v = this.value(), r = this.range();
    return v != null && r != null && v <= r[0] + 1e-9;
  });
  protected readonly atMax = computed(() => {
    const v = this.value(), r = this.range();
    return v != null && r != null && v >= r[1] - 1e-9;
  });

  /** Step in display units from the current value (or `start`), snapped to the step, kept in range. */
  protected stepBy(dir: number, n = 1): void {
    const step = this.step();
    const f = this.factor();
    const cur = this.value();
    let shown: number;
    if (cur == null) {
      const s = this.start() ?? this.range()?.[0] ?? 0;
      shown = s * f;
      shown = Math.round(shown / step) * step;
    } else {
      const now = cur * f;
      const snapped = Math.round(now / step) * step;
      // First press from an off-step value snaps in the pressed direction.
      shown = Math.abs(snapped - now) > 1e-6
        ? (dir > 0 ? Math.ceil(now / step) : Math.floor(now / step)) * step + dir * (n - 1) * step
        : now + dir * n * step;
    }
    const r = this.range();
    if (r) shown = Math.min(r[1] * f, Math.max(r[0] * f, shown));
    const lo = this.allowZero() ? 0 : step;
    shown = Math.max(lo, Math.round(shown * 1000) / 1000);
    const v = shown / f;
    this.invalid.set(false);
    this.text.set(this.display(v));
    this.pending.push(v);
    this.valueChange.emit(v);
  }

  protected onKey(e: KeyboardEvent): void {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    this.stepBy(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey ? 10 : 1);
  }

  private display(v: number | null): string {
    if (v == null) return '';
    const d = this.integer() ? 0 : this.decimals();
    return String(Math.round(v * this.factor() * 10 ** d) / 10 ** d);
  }

  private parse(t: string): number | null | undefined {
    const trimmed = t.trim().replace(',', '.');
    if (trimmed === '') return null;
    if (!/^\d*\.?\d*$/.test(trimmed)) return undefined;
    const n = parseFloat(trimmed);
    if (!isFinite(n) || n < 0 || (n === 0 && !this.allowZero())) return undefined;
    return (this.integer() ? Math.round(n) : n) / this.factor();
  }

  /**
   * Values this field emitted that the parent hasn't echoed back yet. On a slow device an echo can
   * arrive after later keystrokes, and it must never rewrite what the user has typed since.
   */
  private pending: (number | null)[] = [];

  /** True (and consumed) if `v` is the echo of something this field emitted. */
  private isEcho(v: number | null): boolean {
    const i = this.pending.findIndex((p) => p === v || (p != null && v != null && Math.abs(p - v) < 1e-9));
    if (i < 0) return false;
    this.pending.splice(0, i + 1);
    return true;
  }

  /** The value together with its display factor: a kg ↔ lb switch must re-render even an echo. */
  private readonly shown = computed(() => ({ v: this.value(), f: this.factor() }));

  protected readonly text = linkedSignal<{ v: number | null; f: number }, string>({
    source: this.shown,
    computation: ({ v, f }, prev) => {
      if (prev && prev.source.f === f) {
        if (this.isEcho(v)) return prev.value;
        const p = this.parse(prev.value);
        if (p === v || (p != null && v != null && Math.abs(p - v) < 1e-9)) return prev.value;
      }
      return this.display(v);
    },
  });

  protected onInput(t: string): void {
    this.text.set(t);
    const v = this.parse(t);
    this.invalid.set(v === undefined);
    if (v !== undefined) {
      this.pending.push(v);
      this.valueChange.emit(v);
    }
  }

  protected onBlur(): void {
    this.pending = [];
    if (!this.invalid()) this.text.set(this.display(this.value()));
  }
}
