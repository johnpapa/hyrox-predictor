import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PredictorStore } from '../core/predictor.store';
import { formatTime } from '../core/time';

/** Briefly shows how much the last change moved the finish time ("−0:39 faster"). */
@Component({
  selector: 'app-change-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (c of changes(); track c.id) {
      <span class="chip mono" [class.faster]="c.delta < 0" [class.slower]="c.delta > 0" role="status">
        {{ c.delta < 0 ? '▼ −' : '▲ +' }}{{ fmt(abs(c.delta)) }} {{ c.delta < 0 ? 'faster' : 'slower' }}
      </span>
    }
  `,
  styles: `
    :host { display: inline-block; min-height: 1.4em; }
    .chip {
      display: inline-block; padding: 2px 8px; border-radius: 2px; font-size: 0.78rem; font-weight: 700;
      animation: flash 4s ease-out forwards;
    }
    .faster { color: var(--good); background: rgba(74, 222, 128, 0.12); }
    .slower { color: var(--warn); background: rgba(251, 146, 60, 0.12); }
    @keyframes flash { 0% { opacity: 0; transform: translateY(4px); } 8% { opacity: 1; transform: none; } 75% { opacity: 1; } 100% { opacity: 0.35; } }
    @media (prefers-reduced-motion: reduce) { .chip { animation: none; } }
  `,
})
export class ChangeChip {
  private readonly store = inject(PredictorStore);
  protected readonly fmt = formatTime;
  protected readonly abs = Math.abs;
  protected readonly changes = computed(() => {
    const c = this.store.lastChange();
    return c ? [c] : [];
  });
}
