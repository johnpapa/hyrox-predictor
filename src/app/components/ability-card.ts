import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Level, LEVEL_LABELS } from '../core/athlete';
import { Quality } from '../core/resolve';

const QUALITY_LABEL: Record<Quality, string> = {
  measured: 'Measured',
  converted: 'Estimated',
  rated: 'Self-rated',
  assumed: 'Assumed',
};

/**
 * One predictor "ability": primary measured inputs, alternative inputs behind a disclosure,
 * and a Weak…Elite self-assessment as the last fallback.
 */
@Component({
  selector: 'app-ability-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card" [attr.data-quality]="quality()">
      <header>
        <h3>{{ heading() }}</h3>
        <span class="q" [attr.data-quality]="quality()">{{ qualityLabel() }}</span>
      </header>
      <p class="src">{{ source() }}</p>

      <div class="primary"><ng-content select="[primary]" /></div>

      @if (hasAlternatives()) {
        <details [open]="altOpen()">
          <summary>Don't have that? Other ways to estimate</summary>
          <div class="alt"><ng-content select="[alternatives]" /></div>
        </details>
      }

      @if (anchors().length) {
        <div class="levels">
          <span class="label">{{ levelPrompt() }}</span>
          <div class="chips" role="radiogroup" [attr.aria-label]="heading() + ' self-assessment'">
            <button type="button" role="radio" class="chip unsure" [class.on]="level() == null"
              [attr.aria-checked]="level() == null" (click)="levelChange.emit(null)">Not sure</button>
            @for (l of labels; track $index) {
              <button type="button" role="radio" class="chip" [class.on]="level() === $index + 1"
                [attr.aria-checked]="level() === $index + 1" [title]="anchors()[$index]"
                (click)="levelChange.emit($any($index + 1))">{{ l }}</button>
            }
          </div>
          <p class="anchor">
            @if (level(); as l) { <b>{{ labels[l - 1] }}:</b> {{ anchors()[l - 1] }} }
            @else { Leave on "Not sure" to assume a typical athlete who runs at your pace. }
            @if (measuredWins()) { <span class="ignored">Your numbers above take priority.</span> }
          </p>
        </div>
      }
    </section>
  `,
  styleUrl: './ability-card.scss',
})
export class AbilityCard {
  readonly heading = input.required<string>();
  readonly source = input<string>('');
  readonly quality = input<Quality>('assumed');
  readonly anchors = input<string[]>([]);
  readonly level = input<Level | null>(null);
  readonly levelPrompt = input('Or rate yourself');
  readonly hasAlternatives = input(true);
  readonly altOpen = input(false);
  readonly levelChange = output<Level | null>();

  protected readonly labels = LEVEL_LABELS;
  protected readonly qualityLabel = computed(() => QUALITY_LABEL[this.quality()]);
  protected readonly measuredWins = computed(() => this.level() != null && (this.quality() === 'measured' || this.quality() === 'converted'));
}
