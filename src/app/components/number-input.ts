import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';

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
          <span class="units" role="group" aria-label="Weight units">
            <button type="button" [class.on]="u === 'kg'" [attr.aria-pressed]="u === 'kg'" aria-label="Kilograms"
              (click)="unitsChange.emit('kg')">kg</button>
            <button type="button" [class.on]="u === 'lb'" [attr.aria-pressed]="u === 'lb'" aria-label="Pounds"
              (click)="unitsChange.emit('lb')">lb</button>
          </span>
        }
      </div>
      <input
        [id]="id"
        [attr.aria-label]="ariaLabel() || null"
        [attr.aria-describedby]="hint() ? id + '-hint' : null"
        type="text"
        [attr.inputmode]="integer() ? 'numeric' : 'decimal'"
        autocomplete="off"
        [placeholder]="placeholder()"
        [value]="text()"
        [class.invalid]="invalid()"
        [attr.aria-invalid]="invalid()"
        (input)="onInput($any($event.target).value)"
        (blur)="onBlur()"
      />
      @if (hint()) { <span class="hint" [id]="id + '-hint'">{{ hint() }}</span> }
    </div>
  `,
  styles: `
    .invalid { border-color: var(--warn) !important; }
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

  protected readonly invalid = linkedSignal(() => false);

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
