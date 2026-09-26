import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { AthleteForm } from './components/athlete-form';
import { DivisionPicker } from './components/division-picker';
import { InsightsPanel } from './components/insights-panel';
import { SimulatorPage } from './components/simulator-page';
import { Methodology } from './components/methodology';
import { ResultsBoard } from './components/results-board';
import { TeamTactics } from './components/team-tactics';
import { PredictorStore } from './core/predictor.store';
import { formatTime } from './core/time';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DivisionPicker, AthleteForm, TeamTactics, ResultsBoard, InsightsPanel, Methodology, SimulatorPage],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(PredictorStore);
  protected readonly fmt = formatTime;
  private readonly results = viewChild<ElementRef<HTMLElement>>('results');

  /** Two views, addressed by URL hash so links like …/#simulator work on static hosting. */
  protected readonly view = signal<'predictor' | 'simulator'>(App.viewFromHash());

  constructor() {
    const onHash = () => this.view.set(App.viewFromHash());
    window.addEventListener('hashchange', onHash);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('hashchange', onHash));
  }

  private static viewFromHash(): 'predictor' | 'simulator' {
    return typeof location !== 'undefined' && location.hash === '#simulator' ? 'simulator' : 'predictor';
  }

  protected go(view: 'predictor' | 'simulator'): void {
    this.view.set(view);
    history.replaceState(null, '', view === 'simulator' ? '#simulator' : location.pathname + location.search);
    window.scrollTo({ top: 0 });
  }

  protected scrollToResults(): void {
    this.results()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected reset(): void {
    if (confirm('Reset all inputs to default values?')) this.store.reset();
  }
}
