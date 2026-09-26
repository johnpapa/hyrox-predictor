import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';

let nextId = 0;

/**
 * Numeric field that never rewrites what the user is typing (so "7.", "22.5 lb" or "0" work).
 * `factor` converts model units to display units (e.g. kg → lb); blank emits null.
 */
@Component({
  selector: 'app-number-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
      <input
        [id]="id"
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
        (blur)="onBlur()"
      />
      @if (rangeMsg(); as m) { <span class="hint warn" [id]="id + '-hint'" role="alert">{{ m }}</span> }
      @else if (hint()) { <span class="hint" [id]="id + '-hint'">{{ hint() }}</span> }
    </div>
  `,
  styles: `
    .invalid { border-color: var(--warn) !important; }
    .warn { color: var(--warn); }
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
  readonly valueChange = output<number | null>();
  /** When set, shows an inline kg/lb switch (weights only). */
  readonly units = input<'kg' | 'lb' | null>(null);
  readonly unitsChange = output<'kg' | 'lb'>();
  /** Button text / accessible names for the metric and imperial options. */
  readonly unitLabels = input<[string, string]>(['kg', 'lb']);
  readonly unitNames = input<[string, string]>(['Kilograms', 'Pounds']);

  /** Plausible range in model units; values outside it are ignored by the model, so say so. */
  readonly range = input<readonly [number, number] | null>(null);

  protected readonly invalid = linkedSignal(() => false);

  protected readonly rangeMsg = computed(() => {
    const v = this.value();
    const r = this.range();
    if (v == null || !r || (v >= r[0] && v <= r[1])) return '';
    return `${this.display(v)} isn't realistic, so it's ignored (expected ${this.display(r[0])}–${this.display(r[1])})`;
  });

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

  protected readonly text = linkedSignal<number | null, string>({
    source: this.value,
    computation: (v, prev) => {
      if (prev) {
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
    if (v !== undefined) this.valueChange.emit(v);
  }

  protected onBlur(): void {
    if (!this.invalid()) this.text.set(this.display(this.value()));
  }
}
