import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { AthleteForm } from './components/athlete-form';
import { ChangeChip } from './components/change-chip';
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
  imports: [ChangeChip, DivisionPicker, AthleteForm, TeamTactics, ResultsBoard, InsightsPanel, Methodology, SimulatorPage],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(PredictorStore);
  protected readonly fmt = formatTime;
  private readonly results = viewChild<ElementRef<HTMLElement>>('results');

  /** Two views, addressed by URL hash so links like …/#simulator work on static hosting. */
  protected readonly view = signal<'predictor' | 'simulator'>(App.viewFromHash());

  /** Whether the results board's clock is on screen (the floating bar shows when it isn't). */
  protected readonly clockVisible = signal(true);
  private observer: IntersectionObserver | null = null;

  constructor() {
    const onHash = () => {
      this.view.set(App.viewFromHash());
      queueMicrotask(() => this.observeClock());
    };
    window.addEventListener('hashchange', onHash);
    const destroy = inject(DestroyRef);
    destroy.onDestroy(() => {
      window.removeEventListener('hashchange', onHash);
      this.observer?.disconnect();
    });
    afterNextRender(() => this.observeClock());
  }

  private observeClock(): void {
    this.observer?.disconnect();
    const clock = document.querySelector('app-results-board .clock');
    if (!clock || typeof IntersectionObserver === 'undefined') return;
    this.observer = new IntersectionObserver(([e]) => this.clockVisible.set(e.isIntersecting), { rootMargin: '-60px 0px 0px 0px' });
    this.observer.observe(clock);
  }

  private static viewFromHash(): 'predictor' | 'simulator' {
    return typeof location !== 'undefined' && location.hash === '#simulator' ? 'simulator' : 'predictor';
  }

  protected go(view: 'predictor' | 'simulator'): void {
    this.view.set(view);
    history.replaceState(null, '', view === 'simulator' ? '#simulator' : location.pathname + location.search);
    window.scrollTo({ top: 0 });
    queueMicrotask(() => this.observeClock());
  }

  protected scrollToResults(): void {
    this.results()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected reset(): void {
    if (confirm('Reset all inputs to default values?')) this.store.reset();
  }
}
