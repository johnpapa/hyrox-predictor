import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PredictorStore } from '../core/predictor.store';
import { suggestDoublesShares } from '../core/predictor';
import { STATIONS, StationId } from '../core/stations';
import { formatTime } from '../core/time';

@Component({
  selector: 'app-team-tactics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-tactics.html',
  styleUrl: './team-tactics.scss',
})
export class TeamTactics {
  protected readonly store = inject(PredictorStore);
  protected readonly fmt = formatTime;
  protected readonly stations = STATIONS;
  protected readonly format = computed(() => this.store.division().format);
  protected readonly names = computed(() =>
    this.store.teamAthletes().map((a, i) => a.name?.trim() || `Athlete ${i + 1}`),
  );

  protected readonly doublesRows = computed(() => {
    const p = this.store.prediction();
    const manual = this.store.doublesShares();
    return STATIONS.map((s) => {
      const seg = p.segments.find((x) => x.stationId === s.id)!;
      const share = p.doublesShares?.[s.id] ?? 0.5;
      return {
        station: s,
        share,
        sec: seg.sec,
        soloA: p.solos[0]?.stations[s.id] ?? 0,
        soloB: p.solos[1]?.stations[s.id] ?? 0,
      };
    });
  });

  protected readonly relayLegs = computed(() => {
    const order = this.store.prediction().relayOrder ?? [0, 1, 2, 3];
    return [0, 1, 2, 3].map((leg) => ({
      leg,
      athlete: order[leg],
      label: `${STATIONS[leg * 2].name} + ${STATIONS[leg * 2 + 1].name}`,
      runs: `Runs ${leg * 2 + 1} & ${leg * 2 + 2}`,
    }));
  });

  protected setShare(id: StationId, pct: string): void {
    this.store.setShare(id, Number(pct) / 100);
  }

  protected readonly isEven = computed(() => Object.values(this.store.doublesShares()).every((v) => v == null || v === 0.5));

  /** Who sets the running pace in doubles, and whether their pace is only assumed. */
  protected readonly runNote = computed(() => {
    const p = this.store.prediction();
    if (this.format() !== 'doubles' || p.solos.length < 2) return null;
    const [a, b] = p.solos;
    const slower = a.fiveKSec >= b.fiveKSec ? 0 : 1;
    const s = p.solos[slower];
    const other = p.solos[1 - slower];
    const assumed = s.resolved.quality.run === 'assumed';
    const gap = s.fiveKSec - other.fiveKSec;
    return {
      name: this.names()[slower],
      fiveK: formatTime(s.fiveKSec),
      assumed,
      gap: gap >= 10 ? formatTime(gap) : null,
    };
  });

  protected suggest(): void {
    const athletes = this.store.teamAthletes();
    this.store.doublesShares.set(suggestDoublesShares({ divisionId: this.store.division().id, athletes }));
  }

  protected even(): void {
    this.store.doublesShares.set({});
  }
}
