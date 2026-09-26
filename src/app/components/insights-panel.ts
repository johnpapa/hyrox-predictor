import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PredictorStore } from '../core/predictor.store';
import { formatTime } from '../core/time';
import { stationGaps } from '../core/insights';

@Component({
  selector: 'app-insights-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './insights-panel.html',
  styleUrl: './insights-panel.scss',
})
export class InsightsPanel {
  protected readonly store = inject(PredictorStore);
  protected readonly ins = this.store.insights;
  protected readonly fmt = formatTime;
  protected readonly abs = Math.abs;

  protected readonly names = computed(() =>
    this.store.teamAthletes().map((a, i) => a.name?.trim() || `Athlete ${i + 1}`),
  );

  /** All stations + Roxzone as a diverging bar chart of time vs. typical. */
  protected readonly bars = computed(() => {
    const solo = this.store.prediction().solos[this.ins().athleteIndex];
    const gaps = stationGaps(solo);
    const maxAbs = Math.max(30, ...gaps.map((g) => Math.abs(g.gap)));
    return gaps.map((g) => ({ ...g, pct: (Math.abs(g.gap) / maxAbs) * 50 }));
  });

  /** True when nothing entered makes the athlete differ from the typical athlete. */
  protected readonly allTypical = computed(() => this.bars().every((b) => Math.abs(b.gap) < 1));

  /** Which station rows are expanded to show their reasons. */
  protected readonly open = signal<Set<string>>(new Set());
  protected toggle(id: string): void {
    this.open.update((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  protected signed(sec: number): string {
    const s = Math.round(sec);
    if (Math.abs(s) < 1) return '±0:00';
    return (s > 0 ? '+' : '−') + formatTime(Math.abs(s));
  }
}
