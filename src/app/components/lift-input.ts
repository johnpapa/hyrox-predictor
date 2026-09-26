import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DEFAULT_RIR, Lift, MAX_LIFT_REPS, RIR_OPTIONS } from '../core/athlete';
import { oneRepMax } from '../core/formulas';
import { LB_PER_KG, Units } from '../core/predictor.store';
import { NumberInput } from './number-input';

/**
 * Your usual working set: weight × reps, plus how many reps were left in the tank. No max test
 * needed; the estimated 1RM is shown for multi-rep sets.
 */
@Component({
  selector: 'app-lift-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NumberInput],
  template: `
    <div class="lift">
      <app-number-input class="w" [label]="label() + ' (' + units() + ')'" placeholder="—" [value]="lift().kg"
        [factor]="factor()" [decimals]="units() === 'kg' ? 1 : 0" [units]="units()" (unitsChange)="unitsChange.emit($event)"
        (valueChange)="liftChange.emit({ kg: $event })" />
      <app-number-input class="r" label="Reps" [ariaLabel]="label() + ' reps'" placeholder="1" [value]="lift().reps" [integer]="true"
        (valueChange)="onReps($event)" />
      @if (multiRep()) {
        <label class="field effort">
          <span class="label">How hard was the set?</span>
          <select [attr.aria-label]="label() + ' effort'" (change)="liftChange.emit({ rir: +$any($event.target).value })">
            @for (o of options; track o.rir) {
              <option [value]="o.rir" [selected]="rir() === o.rir">{{ o.label }}</option>
            }
          </select>
        </label>
      }
      <span class="hint">{{ hintText() }}</span>
    </div>
  `,
  styles: `
    .lift { display: grid; grid-template-columns: minmax(0, 1fr) 72px; gap: 4px 8px; align-items: end; }
    .effort { grid-column: 1 / -1; }
    .hint { grid-column: 1 / -1; font-size: 0.78rem; color: var(--text-faint); }
  `,
})
export class LiftInput {
  readonly label = input.required<string>();
  readonly lift = input.required<Lift>();
  readonly units = input<Units>('kg');
  readonly hint = input('');
  readonly liftChange = output<Partial<Lift>>();
  readonly unitsChange = output<Units>();

  protected readonly options = RIR_OPTIONS;
  protected readonly factor = computed(() => (this.units() === 'kg' ? 1 : LB_PER_KG));
  protected readonly multiRep = computed(() => (this.lift().reps ?? 1) > 1);
  protected readonly rir = computed(() => this.lift().rir ?? DEFAULT_RIR);

  protected readonly hintText = computed(() => {
    const l = this.lift();
    if (l.kg && this.multiRep()) {
      const rm = oneRepMax(l.kg, l.reps, this.rir());
      const kg = `${Math.round(rm)} kg`;
      const lb = `${Math.round(rm * LB_PER_KG)} lb`;
      const v = this.units() === 'kg' ? `${kg} / ${lb}` : `${lb} / ${kg}`;
      const toFailure = (l.reps ?? 1) + this.rir();
      return `Est. 1RM ${v} (Epley, ≈${Math.round(toFailure)} reps to failure${toFailure > 10 ? '; rougher above 10' : ''})`;
    }
    return this.hint();
  });

  /** Blank reps means a single (1RM); values are capped where the formula stays usable. */
  protected onReps(n: number | null): void {
    const reps = n == null ? null : Math.min(MAX_LIFT_REPS, Math.max(1, n));
    // A new multi-rep entry starts from the default effort unless one was already chosen.
    this.liftChange.emit(this.lift().rir == null ? { reps, rir: DEFAULT_RIR } : { reps });
  }
}
