import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Lift } from '../core/athlete';
import { oneRepMax } from '../core/formulas';
import { LB_PER_KG, Units } from '../core/predictor.store';
import { NumberInput } from './number-input';

/** Weight × reps entry; stores kg, shows the estimated 1RM for multi-rep sets. */
@Component({
  selector: 'app-lift-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NumberInput],
  template: `
    <div class="lift">
      <app-number-input class="w" [label]="label() + ' (' + units() + ')'" placeholder="—" [value]="lift().kg"
        [factor]="factor()" [decimals]="units() === 'kg' ? 1 : 0" (valueChange)="liftChange.emit({ kg: $event })" />
      <app-number-input class="r" label="Reps" [ariaLabel]="label() + ' reps'" placeholder="1" [value]="lift().reps" [integer]="true"
        (valueChange)="onReps($event)" />
      <span class="hint">{{ hintText() }}</span>
    </div>
  `,
  styles: `
    .lift { display: grid; grid-template-columns: minmax(0, 1fr) 72px; gap: 4px 8px; align-items: end; }
    .hint { grid-column: 1 / -1; font-size: 0.78rem; color: var(--text-faint); }
  `,
})
export class LiftInput {
  readonly label = input.required<string>();
  readonly lift = input.required<Lift>();
  readonly units = input<Units>('kg');
  readonly hint = input('');
  readonly liftChange = output<Partial<Lift>>();

  protected readonly factor = computed(() => (this.units() === 'kg' ? 1 : LB_PER_KG));

  protected readonly hintText = computed(() => {
    const l = this.lift();
    if (l.kg && l.reps && l.reps > 1) {
      const rm = oneRepMax(l.kg, l.reps);
      const v = this.units() === 'kg' ? `${Math.round(rm)} kg` : `${Math.round(rm * LB_PER_KG)} lb`;
      return `Est. 1RM ${v} (Epley${l.reps > 10 ? ', less accurate above 10 reps' : ''})`;
    }
    return this.hint();
  });

  /** Blank reps means a single (1RM); values are capped at 12 where formulas stay usable. */
  protected onReps(n: number | null): void {
    this.liftChange.emit({ reps: n == null ? null : Math.min(12, Math.max(1, n)) });
  }
}
