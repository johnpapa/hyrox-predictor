import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DIVISIONS } from '../core/divisions';
import { PredictorStore } from '../core/predictor.store';

@Component({
  selector: 'app-division-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel block">
      <header class="block-head">
        <span class="step">01</span>
        <h2>Division</h2>
      </header>
      @for (g of groups; track g.name) {
        <div class="group">
          <span class="label">{{ g.name }}</span>
          <div class="chips" role="radiogroup" [attr.aria-label]="g.name + ' divisions'">
            @for (d of g.items; track d.id) {
              <button
                type="button"
                class="chip"
                role="radio"
                [attr.aria-checked]="store.divisionId() === d.id"
                [class.on]="store.divisionId() === d.id"
                (click)="store.setDivision(d.id)"
              >{{ d.name }}</button>
            }
          </div>
        </div>
      }
      @if (store.division().note; as note) {
        <p class="note">{{ note }}</p>
      }
    </section>
  `,
  styleUrl: './division-picker.scss',
})
export class DivisionPicker {
  protected readonly store = inject(PredictorStore);
  protected readonly groups = ['Singles', 'Doubles', 'Relay'].map((name) => ({
    name,
    items: DIVISIONS.filter((d) => d.group === name),
  }));
}
