import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FoldState } from '../core/fold';

/**
 * A section title that collapses its section: put it inside the heading, and hide the section body
 * with `[hidden]="!fold.isOpen(key)"`. The arrow points down when open and right when collapsed.
 */
@Component({
  selector: 'app-fold',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="fold" [attr.aria-expanded]="open()" [attr.aria-controls]="controls() || null"
      [title]="open() ? 'Collapse' : 'Expand'" (click)="fold.toggle(key())">
      <span class="chev" aria-hidden="true">▾</span><span class="t"><ng-content /></span>
    </button>
  `,
  styles: `
    :host { display: inline; }
    .fold {
      display: inline-flex; align-items: center; gap: 8px; max-width: 100%;
      background: none; border: 0; padding: 0; margin: 0; color: inherit; font: inherit; letter-spacing: inherit;
      text-transform: inherit; text-align: left; cursor: pointer; min-height: 32px;
    }
    .chev {
      display: inline-grid; place-items: center; width: 18px; height: 18px; flex: none;
      font-size: 0.8em; color: var(--accent); transition: transform 0.15s;
    }
    .fold[aria-expanded='false'] .chev { transform: rotate(-90deg); }
    .fold:hover .t { text-decoration: underline; text-decoration-color: var(--line-strong); text-underline-offset: 4px; }
    .fold:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  `,
})
export class FoldToggle {
  protected readonly fold = inject(FoldState);
  readonly key = input.required<string>();
  /** Id of the element this toggles (for aria-controls). */
  readonly controls = input('');
  protected readonly open = computed(() => this.fold.isOpen(this.key()));
}
