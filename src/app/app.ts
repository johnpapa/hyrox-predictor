import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import { AthleteForm } from './components/athlete-form';
import { DivisionPicker } from './components/division-picker';
import { Methodology } from './components/methodology';
import { ResultsBoard } from './components/results-board';
import { TeamTactics } from './components/team-tactics';
import { PredictorStore } from './core/predictor.store';
import { formatTime } from './core/time';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DivisionPicker, AthleteForm, TeamTactics, ResultsBoard, Methodology],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(PredictorStore);
  protected readonly fmt = formatTime;
  private readonly results = viewChild.required<ElementRef<HTMLElement>>('results');

  protected scrollToResults(): void {
    this.results().nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected reset(): void {
    if (confirm('Reset all inputs to default values?')) this.store.reset();
  }
}
