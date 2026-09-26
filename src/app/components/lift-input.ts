import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Lift } from '../core/athlete';
import { LB_PER_KG, Units } from '../core/predictor.store';
import { oneRepMax } from '../core/formulas';

/** Weight × reps entry; stores kg, shows the estimated 1RM for multi-rep sets. */
@Component({
  selector: 'app-lift-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <span class="label">{{ label() }}</span>
      <div class="row">
        <input type="number" inputmode="decimal" min="0" placeholder="—" [attr.aria-label]="label() + ' weight in ' + units()"
          [value]="display()" (input)="onWeight($any($event.target).value)" />
        <span class="x">{{ units() }} ×</span>
        <input class="reps" type="number" inputmode="numeric" min="1" max="12" [attr.aria-label]="label() + ' reps'"
          [value]="lift().reps ?? 1" (input)="onReps($any($event.target).value)" />
        <span class="x">reps</span>
      </div>
      <span class="hint">{{ hintText() }}</span>
    </div>
  `,
  styles: `
    .row { display: flex; align-items: center; gap: 6px; }
    .row input { flex: 1; min-width: 0; }
    .row input.reps { flex: 0 0 64px; }
    .x { font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-faint); white-space: nowrap; }
  `,
})
export class LiftInput {
  readonly label = input.required<string>();
  readonly lift = input.required<Lift>();
  readonly units = input<Units>('kg');
  readonly hint = input('');
  readonly liftChange = output<Partial<Lift>>();

  protected readonly display = computed(() => {
    const kg = this.lift().kg;
    if (kg == null) return null;
    return this.units() === 'kg' ? Math.round(kg * 10) / 10 : Math.round(kg * LB_PER_KG);
  });

  protected readonly hintText = computed(() => {
    const l = this.lift();
    if (l.kg && l.reps && l.reps > 1) {
      const rm = oneRepMax(l.kg, l.reps);
      const v = this.units() === 'kg' ? `${Math.round(rm)} kg` : `${Math.round(rm * LB_PER_KG)} lb`;
      return `Est. 1RM ${v} (Epley)`;
    }
    return this.hint();
  });

  protected onWeight(v: string): void {
    const n = parseFloat(v);
    const kg = isFinite(n) && n > 0 ? (this.units() === 'kg' ? n : n / LB_PER_KG) : null;
    this.liftChange.emit({ kg });
  }

  protected onReps(v: string): void {
    const n = Math.round(parseFloat(v));
    this.liftChange.emit({ reps: isFinite(n) && n >= 1 ? Math.min(12, n) : 1 });
  }
}
