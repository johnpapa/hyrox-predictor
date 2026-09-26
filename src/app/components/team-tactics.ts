import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PredictorStore } from '../core/predictor.store';
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
        auto: manual[s.id] == null,
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

  protected autoAll(): void {
    this.store.doublesShares.set({});
  }
}
