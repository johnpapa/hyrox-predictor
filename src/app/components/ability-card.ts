import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { Level, LEVEL_LABELS } from '../core/athlete';
import { FoldState } from '../core/fold';
import { FoldToggle } from './fold-toggle';

let nextCard = 0;
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
  imports: [FoldToggle],
  template: `
    <section class="card" [attr.data-quality]="quality()">
      <header>
        <h3><app-fold [key]="foldKey()" [controls]="bodyId">{{ heading() }}</app-fold></h3>
        <span class="q" [attr.data-quality]="quality()">{{ qualityLabel() }}</span>
      </header>
      <p class="src">{{ source() }}</p>
      @for (w of warnings(); track w) {
        <p class="warn" role="alert">⚠ {{ w }}</p>
      }

      <div class="body" [id]="bodyId" [hidden]="!fold.isOpen(foldKey())">
      @if (uses()) { <p class="uses">Used for: <b>{{ uses() }}</b></p> }
      <div class="primary"><ng-content select="[primary]" /></div>

      @if (hasAlternatives()) {
        <details [open]="open()" (toggle)="open.set($any($event.target).open)">
          <summary>Don't have that? Other ways to estimate</summary>
          <div class="alt"><ng-content select="[alternatives]" /></div>
        </details>
      }

      @if (showLevels() && anchors().length) {
        <div class="levels">
          <span class="label">{{ levelPrompt() }}</span>
          <div class="chips" role="group" [attr.aria-label]="heading() + ' self-assessment'">
            <button type="button" class="chip unsure" [class.on]="level() == null"
              [attr.aria-pressed]="level() == null" (click)="levelChange.emit(null)">Not sure</button>
            @for (l of labels; track $index) {
              <button type="button" class="chip" [class.on]="level() === $index + 1"
                [attr.aria-pressed]="level() === $index + 1" [title]="anchors()[$index]"
                (click)="levelChange.emit($any($index + 1))">{{ l }}</button>
            }
          </div>
          <p class="anchor">
            @if (level(); as l) { <b>{{ labels[l - 1] }}:</b> {{ anchors()[l - 1] }} }
            @else { Leave on "Not sure" to assume a typical athlete like you (same build, age and race times). }
            @if (measuredWins()) { <span class="ignored">Not used: the {{ quality() === 'measured' ? 'measured' : 'estimated' }} value above ({{ source() }}) takes priority over a self-rating.</span> }
          </p>
        </div>
      }
      </div>
    </section>
  `,
  styleUrl: './ability-card.scss',
})
export class AbilityCard {
  protected readonly fold = inject(FoldState);
  protected readonly bodyId = `card-body-${nextCard++}`;
  protected readonly foldKey = computed(() => 'card:' + this.heading());
  readonly heading = input.required<string>();
  /** Which parts of the race this ability feeds, e.g. "Sled Push · Sandbag Lunges". */
  readonly uses = input('');
  readonly source = input<string>('');
  readonly quality = input<Quality>('assumed');
  readonly anchors = input<string[]>([]);
  readonly level = input<Level | null>(null);
  readonly levelPrompt = input('Or rate yourself');
  readonly hasAlternatives = input(true);
  /** Hide the Weak…Elite self-rating (the Quick view shows only the most useful input per card). */
  readonly showLevels = input(true);
  readonly altOpen = input(false);
  readonly warnings = input<string[]>([]);
  readonly levelChange = output<Level | null>();

  /** Opens when an alternative is filled in, then stays under the user's control. */
  protected readonly open = linkedSignal<boolean, boolean>({
    source: this.altOpen,
    computation: (src, prev) => (prev?.value ?? false) || src,
  });

  protected readonly labels = LEVEL_LABELS;
  protected readonly qualityLabel = computed(() => QUALITY_LABEL[this.quality()]);
  protected readonly measuredWins = computed(() => this.level() != null && (this.quality() === 'measured' || this.quality() === 'converted'));
}
