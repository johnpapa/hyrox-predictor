import { DecimalPipe } from '@angular/common';
import { FoldState } from '../core/fold';
import { FoldToggle } from './fold-toggle';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { weightForAthlete } from '../core/divisions';
import { ageGroupPosition, loadMultiplier, topPercent } from '../core/predictor';
import { PredictorStore } from '../core/predictor.store';
import { bandForSplit } from '../core/split-tables';
import { StationId } from '../core/stations';
import { formatTime, parseTime } from '../core/time';
import { timeError } from '../core/validate';

interface SimRow {
  key: string;
  kind: 'run' | 'station' | 'roxzone';
  label: string;
  stationId?: StationId;
  base: number;
  min: number;
  max: number;
}

/**
 * "What if" race simulator: drag any split and watch the finish time and field position
 * update — like the simulator on the official results pages. Starts from the prediction.
 */
@Component({
  selector: 'app-simulator-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, FoldToggle],
  templateUrl: './simulator-page.html',
  styleUrl: './simulator-page.scss',
})
export class SimulatorPage {
  protected readonly store = inject(PredictorStore);
  protected readonly fold = inject(FoldState);
  protected readonly format = computed(() => this.store.division().format);
  protected readonly formatNote = computed(() =>
    this.format() === 'doubles' ? " (each station is the pair's time, with the work split you set)"
      : this.format() === 'relay' ? " (each split is the leg athlete's time)" : '',
  );
  protected readonly formatLabel = computed(() => ({ single: 'Singles', doubles: 'Doubles', relay: 'Relay' })[this.format()]);
  /** Team divisions: who the team is, so it's clear the splits are the team's. */
  protected readonly teamNames = computed(() => {
    const team = this.store.teamAthletes();
    if (team.length < 2) return '';
    const names = team.map((a, i) => a.name?.trim() || `Athlete ${i + 1}`);
    return names.length === 2 ? names.join(' & ') : names.join(', ');
  });
  protected readonly fmt = formatTime;

  /** Rows seeded from the current prediction. */
  protected readonly rows = computed<SimRow[]>(() => {
    const p = this.store.prediction();
    const rows: SimRow[] = p.segments.map((s, i) => ({
      key: `${s.kind}-${s.index}`,
      kind: s.kind,
      label: s.label,
      stationId: s.stationId,
      base: s.sec,
      min: Math.max(s.kind === 'run' ? 150 : 40, Math.round(s.sec * 0.5)),
      max: Math.round(s.sec * 1.8),
    }));
    rows.push({ key: 'roxzone', kind: 'roxzone', label: 'Roxzone (total)', base: p.roxzone, min: 60, max: Math.round(p.roxzone * 2) });
    return rows;
  });

  /** User-dragged values by row key; missing = follow the prediction. */
  protected readonly edits = signal<Record<string, number>>({});

  protected readonly values = computed(() => {
    const e = this.edits();
    return this.rows().map((r) => e[r.key] ?? r.base);
  });

  protected readonly total = computed(() => this.values().reduce((a, b) => a + b, 0));
  protected readonly predicted = computed(() => this.store.prediction().total);
  protected readonly delta = computed(() => this.total() - this.predicted());
  protected readonly runTotal = computed(() => this.sumKind('run'));
  protected readonly workTotal = computed(() => this.sumKind('station'));
  protected readonly top = computed(() => topPercent(this.store.division().id, this.total()));
  protected readonly ageGroup = computed(() => ageGroupPosition(this.store.division(), this.store.athletes()[0], this.total()));
  protected readonly changed = computed(() => Object.keys(this.edits()).length > 0);

  /** Band labels only make sense for singles (station medians are singles data). */
  protected readonly showBands = computed(() => this.store.division().format === 'single');

  private sumKind(kind: SimRow['kind']): number {
    const v = this.values();
    return this.rows().reduce((acc, r, i) => (r.kind === kind ? acc + v[i] : acc), 0);
  }

  protected band(row: SimRow, sec: number): string {
    if (!this.showBands() || row.kind === 'roxzone') return '';
    const a = this.store.athletes()[0];
    const load = row.stationId ? loadMultiplier(a.sex, row.stationId, weightForAthlete(this.store.division(), a.sex, row.stationId)) : 1;
    return bandForSplit(a.sex, row.stationId ?? 'run', sec, load);
  }

  /** Why a typed split was rejected, per row (shown in red under it until fixed). */
  protected readonly typeErrors = signal<Record<string, string>>({});

  protected set(row: SimRow, raw: string): void {
    this.clearError(row);
    this.edits.update((e) => ({ ...e, [row.key]: Number(raw) }));
  }

  /** Typed split: blank resets the row; anything else must be a time within the slider's range. */
  protected typeTime(row: SimRow, el: HTMLInputElement): void {
    const t = el.value.trim();
    if (t === '') {
      this.resetRow(row);
      el.value = this.fmt(row.base);
      return;
    }
    let err = timeError(t);
    const sec = parseTime(t);
    if (!err && (sec == null || sec < row.min || sec > row.max)) err = `Enter ${this.fmt(row.min)}–${this.fmt(row.max)}`;
    if (err) this.typeErrors.update((e) => ({ ...e, [row.key]: err }));
    else this.set(row, String(sec));
  }

  /** While an error is showing, re-check on every keystroke so it clears as soon as it's fixed. */
  protected retypeTime(row: SimRow, el: HTMLInputElement): void {
    if (this.typeErrors()[row.key] && el.value.trim() !== '') this.typeTime(row, el);
  }

  private clearError(row: SimRow): void {
    if (!this.typeErrors()[row.key]) return;
    this.typeErrors.update((e) => {
      const { [row.key]: _, ...rest } = e;
      return rest;
    });
  }

  protected resetRow(row: SimRow): void {
    this.clearError(row);
    this.edits.update((e) => {
      const { [row.key]: _, ...rest } = e;
      return rest;
    });
  }

  protected resetAll(): void {
    this.typeErrors.set({});
    this.edits.set({});
  }

  protected signed(sec: number): string {
    const s = Math.round(sec);
    if (Math.abs(s) < 1) return '±0:00';
    return (s > 0 ? '+' : '−') + formatTime(Math.abs(s));
  }

  protected topLabel(): string {
    const t = this.top();
    if (t == null) return 'n/a';
    return t < 1 ? 'Top 1%' : `Top ${Math.round(t)}%`;
  }
}
