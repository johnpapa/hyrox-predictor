import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FoldState } from '../core/fold';
import { FoldToggle } from './fold-toggle';
import { DIVISIONS } from '../core/divisions';
import { PredictorStore } from '../core/predictor.store';

@Component({
  selector: 'app-division-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FoldToggle],
  template: `
    <section class="panel block">
      <header class="block-head">
        <span class="step">01</span>
        <h2><app-fold key="division" controls="fold-division">Division</app-fold></h2>
        @if (!fold.isOpen('division')) { <span class="current">{{ store.division().name }}</span> }
      </header>
      <div id="fold-division" [hidden]="!fold.isOpen('division')">
      @for (g of groups; track g.name) {
        <div class="group">
          <span class="label">{{ g.name }}</span>
          <div class="chips" role="group" [attr.aria-label]="g.name + ' divisions'">
            @for (d of g.items; track d.id) {
              <button
                type="button"
                class="chip"
                [attr.aria-pressed]="store.divisionId() === d.id"
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
      </div>
    </section>
  `,
  styleUrl: './division-picker.scss',
})
export class DivisionPicker {
  protected readonly store = inject(PredictorStore);
  protected readonly fold = inject(FoldState);
  protected readonly groups = ['Singles', 'Doubles', 'Relay'].map((name) => ({
    name,
    items: DIVISIONS.filter((d) => d.group === name),
  }));
}
