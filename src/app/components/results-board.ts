import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { PredictorStore } from '../core/predictor.store';
import { Segment } from '../core/predictor';
import { StationId } from '../core/stations';
import { formatTime, parseTime } from '../core/time';

interface TrackPiece {
  kind: 'run' | 'station' | 'roxzone';
  label: string;
  start: number;
  sec: number;
}

const SIM_DURATION_MS = 24000;

@Component({
  selector: 'app-results-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './results-board.html',
  styleUrl: './results-board.scss',
})
export class ResultsBoard {
  protected readonly store = inject(PredictorStore);
  protected readonly p = this.store.prediction;
  protected readonly fmt = formatTime;
  protected readonly editing = signal<StationId | null>(null);

  protected readonly athleteNames = computed(() =>
    this.store.teamAthletes().map((a, i) => a.name?.trim() || `Athlete ${i + 1}`),
  );

  /** Race-order track including roxzone slivers before and after each station. */
  protected readonly track = computed<TrackPiece[]>(() => {
    const p = this.p();
    const rox = p.roxzone / 16;
    const pieces: TrackPiece[] = [];
    let t = 0;
    const push = (kind: TrackPiece['kind'], label: string, sec: number) => {
      pieces.push({ kind, label, start: t, sec });
      t += sec;
    };
    for (const s of p.segments) {
      if (s.kind === 'run') push('run', s.label, s.sec);
      else {
        push('roxzone', 'Roxzone', rox);
        push('station', s.label, s.sec);
        push('roxzone', 'Roxzone', rox);
      }
    }
    return pieces;
  });

  protected readonly rows = computed(() => {
    let cum = 0;
    const p = this.p();
    const roxPer = p.roxzone / 8;
    return p.segments.map((s) => {
      cum += s.sec + (s.kind === 'station' ? roxPer : 0);
      return { s, cum };
    });
  });

  // ── Simulator ────────────────────────────────────────────────────────────────────
  protected readonly simT = signal<number | null>(null);
  private raf = 0;

  protected readonly simPiece = computed(() => {
    const t = this.simT();
    if (t == null) return null;
    return this.track().find((x) => t >= x.start && t < x.start + x.sec) ?? this.track().at(-1)!;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.raf));
  }

  protected toggleSim(): void {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.simT.set(null);
      return;
    }
    const total = this.p().total;
    const t0 = performance.now();
    const tick = (now: number) => {
      const frac = Math.min(1, (now - t0) / SIM_DURATION_MS);
      this.simT.set(frac * total);
      if (frac < 1) this.raf = requestAnimationFrame(tick);
      else this.raf = 0;
    };
    this.raf = requestAnimationFrame(tick);
  }

  protected pct(sec: number): number {
    return (sec / this.p().total) * 100;
  }

  protected pace(s: Segment): string {
    return s.kind === 'run' ? `${formatTime(s.sec)} /km` : s.detail;
  }

  // ── Overrides ────────────────────────────────────────────────────────────────────
  protected startEdit(id: StationId | undefined): void {
    if (id) this.editing.set(id);
  }

  protected commitEdit(id: StationId, value: string): void {
    const sec = parseTime(value);
    this.store.setOverride(id, value.trim() === '' ? null : sec);
    this.editing.set(null);
  }

  protected clearOverride(id: StationId, ev: Event): void {
    ev.stopPropagation();
    this.store.setOverride(id, null);
  }

  protected contributionText(s: Segment): string {
    const names = this.athleteNames();
    if (this.p().division.format === 'doubles' && s.kind === 'station') {
      return s.contributions
        .filter((c) => c.share > 0.001)
        .map((c) => `${names[c.athlete]} ${Math.round(c.share * 100)}%`)
        .join(' · ');
    }
    if (this.p().division.format === 'relay') return names[s.contributions[0].athlete];
    return '';
  }

  protected topLabel(): string {
    const t = this.p().topPercent;
    if (t < 1) return 'Top 1%';
    if (t > 50) return `Top ${Math.round(t)}% · bottom ${Math.round(100 - t)}%`;
    return `Top ${Math.round(t)}%`;
  }
}
